import { useCallback, useEffect, useState } from 'react';
import { supabase, hayBase } from '../utils/supabase.js';
import { formatPrice } from '../utils/format.js';
import EditarPedido from './EditarPedido.jsx';
import DeliveryPeya from './DeliveryPeya.jsx';
import { textoDescuento } from '../utils/descuento.js';
import { esMostrador, getUnidad, UNIDAD_LABEL, configurarAparato } from '../config/unidad.js';

/**
 * Panel de pedidos del local. Se abre con #pedidos.
 *
 * Quién lo ve: el botón "Pedidos" sólo aparece en el iPad en modo mostrador.
 * Un cliente del QR nunca llega acá; y si escribe #pedidos a mano, se
 * encuentra con el login y nada más.
 *
 * Qué puede hacer: exactamente lo que permiten las cuatro funciones de la
 * parte 17 de la base — cancelar (con PIN), deshacer, y anotar con qué se
 * cobró. La sesión del dueño en el iPad no puede modificar nada más, ni
 * aunque alguien abra la consola del navegador.
 *
 * El PIN se verifica en el servidor. Acá sólo se pide y se manda.
 */

const OWNER_HINT = 'Entrá con el mail y la contraseña del dueño. Queda guardado en este aparato.';

const MEDIOS = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transf.' },
    { id: 'posnet', label: 'Tarjeta/QR' },
    // Uber Eats ya no se marca a mano: entra con el reporte semanal (parte 27).
];


/** Principio y fin del día calendario del aparato, en ISO para la consulta. */
function limitesDelDia(fecha) {
    const ini = new Date(fecha);
    ini.setHours(0, 0, 0, 0);
    const fin = new Date(ini);
    fin.setDate(fin.getDate() + 1);
    return { ini: ini.toISOString(), fin: fin.toISOString() };
}

function etiquetaDia(fecha) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    const dif = Math.round((hoy - d) / 86400000);
    const crudo = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const texto = crudo.charAt(0).toUpperCase() + crudo.slice(1);
    if (dif === 0) return `Hoy · ${texto}`;
    if (dif === 1) return `Ayer · ${texto}`;
    return texto;
}

const esHoy = (fecha) => {
    const a = new Date(fecha); a.setHours(0, 0, 0, 0);
    const b = new Date(); b.setHours(0, 0, 0, 0);
    return a.getTime() === b.getTime();
};

const hora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

const volverAlMenu = () => { window.location.hash = ''; };

// Día y hora de un pedido en hora de Mar del Plata, para los campos de
// "Cambiar día u hora" (el aparato podría estar en otra zona horaria).
const ZONA = 'America/Argentina/Buenos_Aires';
const diaAR = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const horaAR = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
// Argentina no tiene horario de verano: siempre UTC−3.
const isoAR = (dia, hhmm) => `${dia}T${hhmm}:00-03:00`;
const diaLindo = (dia) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });

/**
 * El medio de pago que se ve marcado: el que se anotó al cobrar y, si no se
 * anotó nada, el que se eligió en el checkout. Así lo elegido al hacer el
 * pedido ya aparece marcado, y sólo se toca si cambió.
 */
const medioEfectivo = (pedido) => pedido.medio_pago_cobro || pedido.medio_pago || null;

/**
 * Filtros del panel: en qué "pila" cae cada pedido. Tarjeta y QR se separan
 * (posnet_tipo); el efectivo de PeYa va aparte del efectivo del mostrador
 * aunque para la caja sea efectivo; los cancelados no cuentan en ningún medio.
 */
const FILTROS = [
    { id: 'todos', label: 'Todos' },
    { id: 'efectivo', label: '💵 Efectivo' },
    { id: 'transferencia', label: '🏦 Transferencia' },
    { id: 'tarjeta', label: '💳 Tarjeta' },
    { id: 'qr', label: '📱 QR' },
    { id: 'posnet', label: '💳 Posnet (sin aclarar)' },
    { id: 'peya', label: '🛵 PeYa efectivo' },
    { id: 'uber', label: '🛵 Uber Eats' },
    { id: 'otro', label: 'Otro' },
    { id: 'sin', label: '⚠️ Sin medio' },
    { id: 'cancelado', label: 'Cancelados' },
];

function pilaDe(pedido) {
    if (pedido.estado === 'cancelado') return 'cancelado';
    if (pedido.peya_efectivo) return 'peya';
    const medio = medioEfectivo(pedido);
    if (!medio) return 'sin';
    if (medio === 'posnet') return pedido.posnet_tipo === 'qr' ? 'qr' : pedido.posnet_tipo === 'tarjeta' ? 'tarjeta' : 'posnet';
    if (FILTROS.some((f) => f.id === medio)) return medio;
    return 'otro';
}

/**
 * "Para el cierre": lo que el menú dice que se cobró ese día, agrupado como
 * se carga el cierre. El efectivo de PeYa va junto con el efectivo porque
 * está en la caja. Uber no se muestra: no pasa por la caja.
 */
function ParaElCierre({ pedidos, unidad, dia }) {
    const [copiado, setCopiado] = useState(false);
    const suma = (claves) => pedidos.filter((p) => claves.includes(pilaDe(p))).reduce((a, p) => a + (Number(p.total) || 0), 0);
    const efectivo = suma(['efectivo', 'peya']);
    const peya = suma(['peya']);
    const filas = [
        { id: 'efectivo', label: '💵 Efectivo cobrado', monto: efectivo, nota: peya > 0 ? `incluye ${formatPrice(peya)} de PeYa` : null },
        { id: 'transferencia', label: '🏦 Transferencias', monto: suma(['transferencia']) },
        { id: 'qr', label: '📱 QR', monto: suma(['qr']) },
        { id: 'tarjeta', label: '💳 Tarjeta', monto: suma(['tarjeta']) },
        { id: 'posnet', label: '💳 Posnet sin aclarar', monto: suma(['posnet']), soloSiHay: true },
        { id: 'sin', label: '⚠️ Sin medio de pago', monto: suma(['sin']), soloSiHay: true },
        { id: 'otro', label: 'Otros', monto: suma(['otro', 'uber']), soloSiHay: true },
    ].filter((f) => !f.soloSiHay || f.monto > 0);
    const total = pedidos.filter((p) => p.estado !== 'cancelado').reduce((a, p) => a + (Number(p.total) || 0), 0);

    const copiar = async () => {
        const texto = [
            `Cierre ${UNIDAD_LABEL[unidad]} · ${etiquetaDia(dia)}`,
            ...filas.map((f) => `${f.label}: ${formatPrice(f.monto)}${f.nota ? ` (${f.nota})` : ''}`),
            `Total menú: ${formatPrice(total)}`,
        ].join('\n');
        try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch { /* sin portapapeles: se lee en pantalla */ }
    };

    return (
        <section className="panel-cierre" aria-label="Para el cierre">
            <div className="panel-cierre-cab">
                <h3>🧮 Para el cierre</h3>
                <button type="button" className="panel-btn-sec" onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar'}</button>
            </div>
            <dl className="panel-cierre-filas">
                {filas.map((f) => (
                    <div key={f.id} className={f.id === 'efectivo' ? 'principal' : ''}>
                        <dt>{f.label}{f.nota && <small>{f.nota}</small>}</dt>
                        <dd>{formatPrice(f.monto)}</dd>
                    </div>
                ))}
                <div className="total"><dt>Total del menú</dt><dd>{formatPrice(total)}</dd></div>
            </dl>
        </section>
    );
}

/** Pedidos sin medio de pago: son los que después hacen que la caja no cuadre. */
function AvisoSinMedio({ pedidos, onVer }) {
    const sin = pedidos.filter((p) => pilaDe(p) === 'sin');
    if (!sin.length) return null;
    const monto = sin.reduce((a, p) => a + (Number(p.total) || 0), 0);
    return (
        <p className="panel-aviso-sin" role="alert">
            <span>⚠️ <strong>{sin.length} {sin.length === 1 ? 'pedido' : 'pedidos'} sin medio de pago</strong> ({formatPrice(monto)}). Marcá con qué se cobró antes de cerrar.</span>
            <button type="button" className="panel-btn-sec" onClick={onVer}>Ver</button>
        </p>
    );
}

/** Chips con cantidad y plata de cada medio. Sólo aparecen los que tienen algo (y el elegido). */
function FiltroMedios({ pedidos, filtro, onFiltro }) {
    const pilas = {};
    pedidos.forEach((p) => {
        const k = pilaDe(p);
        pilas[k] = pilas[k] || { n: 0, total: 0 };
        pilas[k].n += 1;
        pilas[k].total += Number(p.total) || 0;
    });
    const activos = pedidos.filter((p) => p.estado !== 'cancelado');
    pilas.todos = { n: activos.length, total: activos.reduce((a, p) => a + (Number(p.total) || 0), 0) };
    const visibles = FILTROS.filter((f) => f.id === 'todos' || f.id === filtro || pilas[f.id]);
    return (
        <div className="panel-filtros" role="group" aria-label="Filtrar por medio de pago">
            {visibles.map((f) => {
                const d = pilas[f.id] || { n: 0, total: 0 };
                return (
                    <button
                        key={f.id}
                        type="button"
                        className={`panel-filtro ${filtro === f.id ? 'activo' : ''} ${f.id === 'sin' ? 'alerta' : ''}`}
                        aria-pressed={filtro === f.id}
                        onClick={() => onFiltro(filtro === f.id ? 'todos' : f.id)}
                    >
                        <span className="panel-filtro-nombre">{f.label} <strong>{d.n}</strong></span>
                        {f.id !== 'cancelado' && <span className="panel-filtro-total">{formatPrice(d.total)}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/*
 * Switch Local / Food Truck: qué pedidos se ven en el panel (para hacer los
 * dos cierres sin salir de acá). Sólo cambia lo que se MIRA: el aparato sigue
 * siendo lo que era y lo que se cargue en él sigue saliendo de su unidad.
 * La tablet del truck no lo tiene: ahí se ven sólo los del truck.
 */
const VISTA_KEY = 'buba-panel-vista';
const SWITCH_OPCIONES = [
    { id: 'local', icono: '🏠', nombre: 'Local' },
    { id: 'food_truck', icono: '🚐', nombre: 'Food Truck' },
];
const puedeCambiarVista = () => !(esMostrador() && getUnidad() === 'food_truck');

function vistaInicial() {
    if (!puedeCambiarVista()) return getUnidad();
    try {
        const v = sessionStorage.getItem(VISTA_KEY);
        if (v === 'local' || v === 'food_truck') return v;
    } catch { /* sigue */ }
    return getUnidad();
}

function guardarVista(v) {
    try { sessionStorage.setItem(VISTA_KEY, v); } catch { /* sigue */ }
}

function SwitchUnidad({ vista, onCambiar }) {
    return (
        <div className="panel-switch" role="radiogroup" aria-label="Pedidos de">
            {SWITCH_OPCIONES.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={vista === o.id}
                    className={`panel-switch-op ${vista === o.id ? 'activa' : ''}`}
                    onClick={() => onCambiar(o.id)}
                >
                    <span className="panel-switch-icono" aria-hidden="true">{o.icono}</span> {o.nombre}
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ */

function Login({ onEntro }) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const entrar = async (e) => {
        e.preventDefault();
        setError('');
        setCargando(true);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        setCargando(false);
        if (error) { setError('Mail o contraseña incorrectos'); return; }
        setPass('');
        onEntro?.();
    };

    return (
        <form className="admin-login panel-login" onSubmit={entrar}>
            <p className="panel-ayuda">{OWNER_HINT}</p>
            <label className="checkout-field">
                <span>Mail</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </label>
            <label className="checkout-field">
                <span>Contraseña</span>
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
            </label>
            {error && <p className="field-error">{error}</p>}
            <button className="builder-add-btn" type="submit" disabled={cargando}>
                {cargando ? 'Entrando…' : 'Entrar'}
            </button>
        </form>
    );
}

/** Entrada de PIN: 4 dígitos, teclado numérico, se ve como contraseña. */
function CampoPin({ label, valor, onChange, autoFocus }) {
    return (
        <label className="checkout-field panel-pin-campo">
            <span>{label}</span>
            <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={valor}
                onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                autoFocus={autoFocus}
                autoComplete="off"
            />
        </label>
    );
}

/** Definir el PIN por primera vez, o cambiarlo (pide el actual). */
/**
 * Qué es este aparato: mostrador del local, del truck, o uno cualquiera.
 * Está acá (detrás del login) para cambiarlo sin andar con links: un aparato
 * que abrió el link del truck y ahora tiene que ser el del local se arregla
 * con dos toques.
 */
const OPCIONES_APARATO = [
    { id: 'local', titulo: '🏠 Mostrador del Local', ayuda: 'El iPad de Bolívar.' },
    { id: 'food_truck', titulo: '🚚 Mostrador del Food Truck', ayuda: 'La tablet del truck. Ve y cancela sólo los pedidos del truck.' },
    { id: null, titulo: '📱 Aparato común', ayuda: 'Como el celular de un cliente: sin botón Pedidos, lo que se pida cuenta como QR.' },
];

function EsteAparato({ onCerrar }) {
    const actual = esMostrador() ? getUnidad() : null;
    const [elegida, setElegida] = useState(actual);
    return (
        <div className="panel-caja panel-aparato">
            <h3>¿Qué es este aparato?</h3>
            <p className="panel-ayuda">Define qué pedidos ve el panel, qué stock se toca y de qué unidad salen los pedidos que se cargan acá.</p>
            <div className="panel-aparato-opciones" role="radiogroup" aria-label="Este aparato">
                {OPCIONES_APARATO.map((o) => (
                    <button
                        key={o.id ?? 'comun'}
                        type="button"
                        role="radio"
                        aria-checked={elegida === o.id}
                        className={`panel-aparato-opcion ${elegida === o.id ? 'activa' : ''}`}
                        onClick={() => setElegida(o.id)}
                    >
                        <strong>{o.titulo}{actual === o.id ? ' · ahora' : ''}</strong>
                        <small>{o.ayuda}</small>
                    </button>
                ))}
            </div>
            <div className="panel-acciones-fila">
                <button type="button" className="panel-btn-sec" onClick={onCerrar}>Volver</button>
                <button type="button" className="builder-add-btn" disabled={elegida === actual} onClick={() => configurarAparato(elegida)}>
                    Cambiar
                </button>
            </div>
        </div>
    );
}

function FormPin({ hayPin, onListo, onCerrar }) {
    const [actual, setActual] = useState('');
    const [nuevo, setNuevo] = useState('');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    const guardar = async (e) => {
        e.preventDefault();
        if (nuevo.length !== 4) { setError('El PIN son 4 números'); return; }
        setError('');
        setGuardando(true);
        const { error } = await supabase.rpc('establecer_pin_panel', {
            p_pin: nuevo,
            p_pin_actual: hayPin ? actual : null,
        });
        setGuardando(false);
        if (error) { setError(error.message); return; }
        onListo();
    };

    return (
        <form className="panel-caja panel-form-pin" onSubmit={guardar}>
            <h3>{hayPin ? 'Cambiar el PIN' : 'Definí un PIN para cancelar'}</h3>
            <p className="panel-ayuda">
                {hayPin
                    ? 'Cuatro números. Hace falta el PIN actual.'
                    : 'Cuatro números. Se va a pedir cada vez que alguien cancele un pedido, para que no pase por accidente.'}
            </p>
            {hayPin && <CampoPin label="PIN actual" valor={actual} onChange={setActual} autoFocus />}
            <CampoPin label={hayPin ? 'PIN nuevo' : 'PIN'} valor={nuevo} onChange={setNuevo} autoFocus={!hayPin} />
            {error && <p className="field-error">{error}</p>}
            <div className="panel-acciones-fila">
                {hayPin && <button type="button" className="panel-btn-sec" onClick={onCerrar}>Volver</button>}
                <button type="submit" className="builder-add-btn" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar PIN'}
                </button>
            </div>
        </form>
    );
}

/** Confirmación de cancelación: motivo opcional + PIN. */
function ModalCancelar({ pedido, onCerrar, onCancelado }) {
    const [motivo, setMotivo] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);

    const confirmar = async (e) => {
        e.preventDefault();
        if (pin.length !== 4) { setError('Ingresá el PIN de 4 números'); return; }
        setError('');
        setEnviando(true);
        const { error } = await supabase.rpc('cancelar_pedido', {
            p_id: pedido.id,
            p_pin: pin,
            p_motivo: motivo.trim() || null,
        });
        setEnviando(false);
        if (error) { setError(error.message); setPin(''); return; }
        onCancelado();
    };

    return (
        <div className="admin-overlay" onClick={onCerrar}>
            <form className="admin-panel panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={confirmar}>
                <div className="admin-header">
                    <h3>Cancelar pedido</h3>
                    <button className="cart-close-btn" type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>
                <p className="panel-modal-resumen">
                    <strong>{hora(pedido.creado_en)}</strong> · {formatPrice(pedido.total)}
                    <br />
                    {resumenItems(pedido)}
                </p>
                <p className="panel-ayuda">El pedido no se borra: queda marcado y deja de contar como venta. Se puede deshacer.</p>
                <label className="checkout-field">
                    <span>Motivo (opcional)</span>
                    <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="No lo retiró, se cargó mal…" maxLength={120} />
                </label>
                <CampoPin label="PIN" valor={pin} onChange={setPin} autoFocus />
                {error && <p className="field-error">{error}</p>}
                <div className="panel-acciones-fila">
                    <button type="button" className="panel-btn-sec" onClick={onCerrar}>Volver</button>
                    <button type="submit" className="panel-btn-peligro" disabled={enviando}>
                        {enviando ? 'Cancelando…' : 'Cancelar pedido'}
                    </button>
                </div>
            </form>
        </div>
    );
}

/**
 * Cambiar el día o la hora de un pedido. Caso típico: un pedido del domingo
 * que se cargó pasada la medianoche y quedó el lunes. La hora original no
 * se pierde (queda guardada en la base).
 */
function ModalHora({ pedido, onCerrar, onListo }) {
    const [dia, setDia] = useState(() => diaAR(pedido.creado_en));
    const [hhmm, setHhmm] = useState(() => horaAR(pedido.creado_en));
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const hoy = diaAR(new Date().toISOString());
    const cambio = dia !== diaAR(pedido.creado_en) || hhmm !== horaAR(pedido.creado_en);

    const guardar = async (e) => {
        e.preventDefault();
        if (!dia || !/^\d{2}:\d{2}$/.test(hhmm)) { setError('Elegí el día y la hora'); return; }
        setEnviando(true);
        const { error } = await supabase.rpc('cambiar_fecha_pedido', { p_id: pedido.id, p_creado_en: isoAR(dia, hhmm) });
        setEnviando(false);
        if (error) { setError(error.message); return; }
        onListo(dia);
    };

    return (
        <div className="admin-overlay" onClick={onCerrar}>
            <form className="admin-panel panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
                <div className="admin-header">
                    <h3>Cambiar día u hora</h3>
                    <button className="cart-close-btn" type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>
                <p className="panel-modal-resumen">
                    <strong>{hora(pedido.creado_en)}</strong> · {formatPrice(pedido.total)}
                    <br />
                    {resumenItems(pedido)}
                </p>
                <div className="panel-hora-campos">
                    <label className="checkout-field">
                        <span>Día</span>
                        <input type="date" value={dia} max={hoy} onChange={(e) => { setDia(e.target.value); setError(''); }} required />
                    </label>
                    <label className="checkout-field">
                        <span>Hora</span>
                        <input type="time" value={hhmm} onChange={(e) => { setHhmm(e.target.value); setError(''); }} required />
                    </label>
                </div>
                <div className="panel-hora-rapido">
                    <button type="button" className="panel-chip" onClick={() => {
                        const d = new Date(`${diaAR(pedido.creado_en)}T12:00:00-03:00`); d.setDate(d.getDate() - 1);
                        setDia(diaAR(d.toISOString())); setHhmm('23:30'); setError('');
                    }}>Día anterior, 23:30</button>
                </div>
                {dia !== diaAR(pedido.creado_en) && (
                    <p className="panel-ayuda">Pasa al {diaLindo(dia)}: cuenta en el cierre de ese día.</p>
                )}
                {error && <p className="field-error">{error}</p>}
                <div className="panel-acciones-fila">
                    <button type="button" className="panel-btn-sec" onClick={onCerrar}>Volver</button>
                    <button type="submit" className="builder-add-btn" disabled={enviando || !cambio}>
                        {enviando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    );
}

/**
 * Pasar un pedido a la otra unidad (se cargó en el iPad equivocado). Los
 * precios no cambian: queda lo que se cobró. Cuenta en el cierre de la otra
 * unidad, así que si ese día ya hay un cierre cargado se avisa.
 */
const OTRA_UNIDAD = (u) => (u === 'food_truck' ? 'local' : 'food_truck');

/** ¿Se puede pasar este pedido a la otra unidad? El truck no hace delivery ni PeYa. */
const puedeMoverse = (pedido) => OTRA_UNIDAD(pedido.unidad) !== 'food_truck' || !(pedido.envio > 0 || pedido.peya_efectivo);

function ModalUnidad({ pedido, onCerrar, onListo }) {
    const destino = OTRA_UNIDAD(pedido.unidad);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');

    const mover = async () => {
        setEnviando(true);
        const { data, error } = await supabase.rpc('mover_pedido_unidad', { p_id: pedido.id, p_unidad: destino });
        setEnviando(false);
        if (error) { setError(error.message); return; }
        onListo(destino, Boolean(data));
    };

    return (
        <div className="admin-overlay" onClick={onCerrar}>
            <div className="admin-panel panel-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className="admin-header">
                    <h3>Pasar al {UNIDAD_LABEL[destino]}</h3>
                    <button className="cart-close-btn" type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>
                <p className="panel-modal-resumen">
                    <strong>{hora(pedido.creado_en)}</strong> · {formatPrice(pedido.total)}
                    <br />
                    {resumenItems(pedido)}
                </p>
                <p className="panel-ayuda">
                    Se cargó en {UNIDAD_LABEL[pedido.unidad]} y va a pasar a {UNIDAD_LABEL[destino]}: cuenta en el cierre y en las ventas de esa unidad.
                    El precio no cambia: queda lo que se cobró.
                </p>
                {error && <p className="field-error">{error}</p>}
                <div className="panel-acciones-fila">
                    <button type="button" className="panel-btn-sec" onClick={onCerrar}>Volver</button>
                    <button type="button" className="builder-add-btn" disabled={enviando} onClick={mover}>
                        {enviando ? 'Pasando…' : `Pasar al ${UNIDAD_LABEL[destino]}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

function resumenItems(pedido) {
    // Las líneas que se sacaron al editar quedan con cantidad 0: no se muestran.
    const items = (pedido.pedido_items || []).filter((it) => it.cantidad > 0);
    return items
        .map((it) => (it.cantidad > 1 ? `${it.cantidad}× ${it.nombre}` : it.nombre))
        .join(' · ');
}

/* ------------------------------------------------------------------ */

function TarjetaPedido({ pedido, ocupado, onCobro, onCancelar, onReactivar, onCambiarHora, onEditar, onMover }) {
    const cancelado = pedido.estado === 'cancelado';
    const medio = medioEfectivo(pedido);
    return (
        <article className={`panel-pedido ${cancelado ? 'cancelado' : ''} ${medio === 'uber' ? 'es-uber' : ''}`}>
            <div className="panel-pedido-cab">
                <button
                    type="button"
                    className="panel-pedido-hora panel-pedido-hora-btn"
                    onClick={() => onCambiarHora(pedido)}
                    disabled={ocupado}
                    title="Cambiar día u hora"
                >
                    {hora(pedido.creado_en)} <span aria-hidden="true">✎</span>
                    <span className="solo-lector"> — cambiar día u hora</span>
                </button>
                <span className="panel-pedido-canal">
                    {medio === 'uber' ? '🛵 Uber Eats' : pedido.peya_efectivo ? '🛵 PeYa en efectivo' : pedido.canal === 'mostrador' ? '🧾 Mostrador' : pedido.canal === 'qr' ? '📱 QR' : '—'}
                </span>
                <span className="panel-pedido-total">{formatPrice(pedido.total)}</span>
            </div>

            <p className="panel-pedido-items">{resumenItems(pedido) || 'Sin detalle'}</p>
            {pedido.posnet_tipo && medio === 'posnet' && (
                <p className="panel-pedido-envio">{pedido.posnet_tipo === 'qr' ? '📱 Se cobró con QR' : '💳 Se cobró con tarjeta'}</p>
            )}
            {textoDescuento(pedido, formatPrice) && (
                <p className="panel-pedido-envio">{textoDescuento(pedido, formatPrice)}</p>
            )}
            {pedido.envio > 0 && (
                <p className="panel-pedido-envio">🛵 Delivery · incluye envío {formatPrice(pedido.envio)}</p>
            )}

            {cancelado ? (
                <div className="panel-pedido-pie">
                    <span className="panel-pedido-estado">
                        Cancelado{pedido.motivo_cancelacion ? ` · ${pedido.motivo_cancelacion}` : ''}
                    </span>
                    <button
                        type="button"
                        className="panel-btn-sec"
                        onClick={() => onReactivar(pedido)}
                        disabled={ocupado}
                    >
                        {ocupado ? '…' : 'Deshacer'}
                    </button>
                </div>
            ) : (
                <div className="panel-pedido-pie">
                    <div className="panel-cobro">
                        <span className="panel-cobro-label">Cobrado con</span>
                        <div className="panel-cobro-chips" role="group" aria-label="Medio de cobro">
                            {MEDIOS.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    className={`panel-chip panel-chip-${m.id} ${medio === m.id ? 'activo' : ''}`}
                                    onClick={() => onCobro(pedido, m.id)}
                                    disabled={ocupado}
                                    aria-pressed={medio === m.id}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="panel-btn-sec"
                        onClick={() => onEditar(pedido)}
                        disabled={ocupado}
                    >
                        ✏️ Editar
                    </button>
                    {puedeMoverse(pedido) && (
                        <button
                            type="button"
                            className="panel-btn-sec"
                            onClick={() => onMover(pedido)}
                            disabled={ocupado}
                        >
                            {OTRA_UNIDAD(pedido.unidad) === 'food_truck' ? '🚐 Pasar al Truck' : '🏠 Pasar al Local'}
                        </button>
                    )}
                    <button
                        type="button"
                        className="panel-btn-cancelar"
                        onClick={() => onCancelar(pedido)}
                        disabled={ocupado}
                    >
                        Cancelar
                    </button>
                </div>
            )}
        </article>
    );
}

/* ------------------------------------------------------------------ */

function PanelPedidos() {
    const [sesion, setSesion] = useState(null);
    const [listo, setListo] = useState(false);          // ya se consultó la sesión guardada
    const [dia, setDia] = useState(() => new Date());
    const [pedidos, setPedidos] = useState(null);       // null = todavía no cargó
    const [filtro, setFiltro] = useState('todos');     // medio de pago (FILTROS)
    const [vista, setVista] = useState(vistaInicial);   // de qué unidad se ven los pedidos
    const [hayPin, setHayPin] = useState(null);         // null = no se sabe todavía
    const [modal, setModal] = useState(null);           // { tipo: 'cancelar', pedido } | { tipo: 'pin' }
    const [ocupado, setOcupado] = useState(null);       // id del pedido con una acción en curso
    const [error, setError] = useState('');
    const [avisoPanel, setAvisoPanel] = useState('');   // "Pedido movido al …"
    const [version, setVersion] = useState(0);          // se incrementa para volver a cargar

    const recargar = useCallback(() => setVersion((v) => v + 1), []);

    // Sesión guardada en el aparato (persistSession) — igual que AdminPanel.
    useEffect(() => {
        if (!hayBase) return;
        supabase.auth.getSession().then(({ data }) => { setSesion(data.session); setListo(true); });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    // La lista del día. Se vuelve a pedir cuando cambia el día, la sesión o
    // `version` (después de cada acción, al tocar Actualizar, al volver a la
    // pestaña). Si la respuesta llega tarde y ya se cambió de día, se ignora.
    useEffect(() => {
        if (!sesion) return;
        let vigente = true;
        const { ini, fin } = limitesDelDia(dia);
        supabase
            .from('pedidos')
            .select('id, creado_en, total, envio, peya_efectivo, descuento, descuento_tipo, descuento_valor, descuento_nota, posnet_tipo, medio_pago, medio_pago_cobro, canal, unidad, estado, motivo_cancelacion, pedido_items(id, categoria_id, producto_id, variante, nombre, cantidad, precio_unitario, detalle)')
            .eq('unidad', vista)            // la tablet del truck no ve (ni cancela) los del local: ver vistaInicial
            .is('plataforma', null)         // las ventas de Uber importadas del reporte no se tocan desde acá
            .gte('creado_en', ini)
            .lt('creado_en', fin)
            .order('creado_en', { ascending: false })
            .then(({ data, error }) => {
                if (!vigente) return;
                if (error) { setError('No se pudo cargar la lista: ' + error.message); return; }
                setError('');
                setPedidos(data || []);
            });
        return () => { vigente = false; };
    }, [sesion, dia, version, vista]);

    // Al entrar con sesión: ¿hay PIN?
    useEffect(() => {
        if (!sesion) return;
        supabase.rpc('hay_pin_panel').then(({ data, error }) => {
            if (error) { setError(error.message); return; }
            setHayPin(Boolean(data));
        });
    }, [sesion]);

    // Volver a la pestaña / prender el iPad = refrescar.
    useEffect(() => {
        const alVolver = () => { if (document.visibilityState === 'visible') recargar(); };
        document.addEventListener('visibilitychange', alVolver);
        return () => document.removeEventListener('visibilitychange', alVolver);
    }, [recargar]);

    const salir = async () => { await supabase.auth.signOut(); volverAlMenu(); };

    const moverDia = (delta) => {
        setDia((d) => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; });
    };

    const accion = async (pedido, fn, nombre) => {
        setOcupado(pedido.id);
        const { error } = await fn();
        setOcupado(null);
        if (error) { setError(`${nombre}: ${error.message}`); return; }
        setError('');
        recargar();
    };

    const cobro = (pedido, medio) => {
        // El marcado ya viene del checkout: tocarlo de nuevo no cambia nada.
        // Tocar otro lo corrige (queda anotado como cobrado con ese).
        if (medioEfectivo(pedido) === medio) return undefined;
        return accion(pedido, () => supabase.rpc('registrar_cobro', { p_id: pedido.id, p_medio: medio }), 'No se pudo anotar el cobro');
    };

    const reactivar = (pedido) =>
        accion(pedido, () => supabase.rpc('reactivar_pedido', { p_id: pedido.id }), 'No se pudo deshacer');

    const pedirCancelar = (pedido) => {
        if (hayPin === false) { setModal({ tipo: 'pin' }); return; }
        setModal({ tipo: 'cancelar', pedido });
    };

    /* ---------- render ---------- */

    if (!hayBase) {
        return (
            <main className="panel">
                <Cabecera />
                <p className="panel-ayuda">La base de datos no está configurada.</p>
            </main>
        );
    }

    if (!listo) {
        return (
            <main className="panel">
                <Cabecera />
                <p className="panel-ayuda">Cargando…</p>
            </main>
        );
    }

    if (!sesion) {
        return (
            <main className="panel">
                <Cabecera />
                <Login onEntro={() => setDia(new Date())} />
            </main>
        );
    }

    const confirmados = (pedidos || []).filter((p) => p.estado !== 'cancelado');
    const cancelados = (pedidos || []).length - confirmados.length;
    const filtrados = filtro === 'todos' ? (pedidos || []) : (pedidos || []).filter((p) => pilaDe(p) === filtro);

    const cambiarVista = (u) => {
        if (u === vista) return;
        guardarVista(u);
        setPedidos(null);
        setVista(u);
    };

    return (
        <main className={`panel ${vista === 'food_truck' ? 'panel-vista-truck' : ''}`}>
            <Cabecera conDelivery={vista === 'local'} onAnotado={recargar} />

            {puedeCambiarVista() && <SwitchUnidad vista={vista} onCambiar={cambiarVista} />}

            <nav className="panel-dia" aria-label="Día">
                <button type="button" className="panel-btn-sec" onClick={() => moverDia(-1)} aria-label="Día anterior">‹</button>
                <span className="panel-dia-nombre">{etiquetaDia(dia)}</span>
                <button type="button" className="panel-btn-sec" onClick={() => moverDia(1)} disabled={esHoy(dia)} aria-label="Día siguiente">›</button>
            </nav>

            <div className="panel-resumen">
                <span><strong>{confirmados.length}</strong> {confirmados.length === 1 ? 'pedido' : 'pedidos'}</span>
                {cancelados > 0 && <span className="panel-resumen-cancelados">+ {cancelados} cancelado{cancelados > 1 ? 's' : ''}</span>}
                <button type="button" className="panel-btn-sec" onClick={recargar}>Actualizar</button>
            </div>

            {hayPin === false && <FormPin hayPin={false} onListo={() => setHayPin(true)} />}

            {error && <p className="field-error panel-error">{error}</p>}
            {avisoPanel && (
                <p className="panel-aviso" role="status">
                    {avisoPanel} <button type="button" className="panel-link" onClick={() => setAvisoPanel('')}>OK</button>
                </p>
            )}

            {pedidos === null ? (
                <p className="panel-ayuda">Cargando pedidos…</p>
            ) : pedidos.length === 0 ? (
                <p className="panel-ayuda panel-vacio">No hay pedidos ese día.</p>
            ) : (
                <>
                <AvisoSinMedio pedidos={pedidos} onVer={() => setFiltro('sin')} />
                <ParaElCierre pedidos={pedidos} unidad={vista} dia={dia} />
                <FiltroMedios pedidos={pedidos} filtro={filtro} onFiltro={setFiltro} />
                {filtrados.length === 0 && (
                    <p className="panel-ayuda panel-vacio">
                        No hay pedidos con ese medio este día.{' '}
                        <button type="button" className="panel-link" onClick={() => setFiltro('todos')}>Ver todos</button>
                    </p>
                )}
                <div className="panel-lista">
                    {filtrados.map((p) => (
                        <TarjetaPedido
                            key={p.id}
                            pedido={p}
                            ocupado={ocupado === p.id}
                            onCobro={cobro}
                            onCancelar={pedirCancelar}
                            onReactivar={reactivar}
                            onCambiarHora={(pedido) => setModal({ tipo: 'hora', pedido })}
                            onEditar={(pedido) => setModal({ tipo: 'editar', pedido })}
                            onMover={(pedido) => setModal({ tipo: 'unidad', pedido })}
                        />
                    ))}
                </div>
                </>
            )}

            <footer className="panel-pie">
                <button type="button" className="panel-link" onClick={() => setModal({ tipo: 'aparato' })}>Este aparato</button>
                {hayPin && <button type="button" className="panel-link" onClick={() => setModal({ tipo: 'pin' })}>Cambiar PIN</button>}
                <button type="button" className="panel-link" onClick={salir}>Cerrar sesión</button>
            </footer>

            {modal?.tipo === 'editar' && (
                <EditarPedido
                    pedido={modal.pedido}
                    hayPin={hayPin}
                    onCerrar={() => setModal(null)}
                    onListo={() => { setModal(null); setAvisoPanel('Pedido actualizado.'); recargar(); }}
                />
            )}
            {modal?.tipo === 'cancelar' && (
                <ModalCancelar
                    pedido={modal.pedido}
                    onCerrar={() => setModal(null)}
                    onCancelado={() => { setModal(null); recargar(); }}
                />
            )}
            {modal?.tipo === 'hora' && (
                <ModalHora
                    pedido={modal.pedido}
                    onCerrar={() => setModal(null)}
                    onListo={(diaNuevo) => {
                        setModal(null);
                        const antes = diaAR(modal.pedido.creado_en);
                        setAvisoPanel(diaNuevo !== antes ? `Pedido movido al ${diaLindo(diaNuevo)}.` : 'Hora cambiada.');
                        recargar();
                    }}
                />
            )}
            {modal?.tipo === 'unidad' && (
                <ModalUnidad
                    pedido={modal.pedido}
                    onCerrar={() => setModal(null)}
                    onListo={(destino, hayCierre) => {
                        setModal(null);
                        setAvisoPanel(`Pedido pasado al ${UNIDAD_LABEL[destino]}.${hayCierre ? ' Ese día ya tiene un cierre cargado: revisalo en Gestión.' : ''}`);
                        recargar();
                    }}
                />
            )}
            {modal?.tipo === 'aparato' && (
                <div className="admin-overlay" onClick={() => setModal(null)}>
                    <div className="admin-panel panel-modal" onClick={(e) => e.stopPropagation()}>
                        <EsteAparato onCerrar={() => setModal(null)} />
                    </div>
                </div>
            )}
            {modal?.tipo === 'pin' && hayPin && (
                <div className="admin-overlay" onClick={() => setModal(null)}>
                    <div className="admin-panel panel-modal" onClick={(e) => e.stopPropagation()}>
                        <FormPin hayPin onListo={() => setModal(null)} onCerrar={() => setModal(null)} />
                    </div>
                </div>
            )}
        </main>
    );
}

function Cabecera({ conDelivery = false, onAnotado }) {
    return (
        <header className="panel-cab">
            <button type="button" className="panel-link panel-volver" onClick={volverAlMenu}>← Menú</button>
            <h2 className="panel-titulo">Pedidos</h2>
            <span className="panel-unidad">
                {esMostrador() ? `${UNIDAD_LABEL[getUnidad()]} · Mostrador` : ''}
                {/* PedidosYa pagado en efectivo (parte 45): escondido acá, se usa poco. */}
                {conDelivery && esMostrador() && getUnidad() === 'local' && <DeliveryPeya onAnotado={onAnotado} />}
            </span>
        </header>
    );
}

export default PanelPedidos;
