import { useCallback, useEffect, useState } from 'react';
import { supabase, hayBase } from '../utils/supabase.js';
import { formatPrice } from '../utils/format.js';
import EditarPedido from './EditarPedido.jsx';
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
                    Cambiar y volver al menú
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

function resumenItems(pedido) {
    // Las líneas que se sacaron al editar quedan con cantidad 0: no se muestran.
    const items = (pedido.pedido_items || []).filter((it) => it.cantidad > 0);
    return items
        .map((it) => (it.cantidad > 1 ? `${it.cantidad}× ${it.nombre}` : it.nombre))
        .join(' · ');
}

/* ------------------------------------------------------------------ */

function TarjetaPedido({ pedido, ocupado, onCobro, onCancelar, onReactivar, onCambiarHora, onEditar }) {
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
                    {medio === 'uber' ? '🛵 Uber Eats' : pedido.canal === 'mostrador' ? '🏠 Mostrador' : pedido.canal === 'qr' ? '📱 QR' : '—'}
                </span>
                <span className="panel-pedido-total">{formatPrice(pedido.total)}</span>
            </div>

            <p className="panel-pedido-items">{resumenItems(pedido) || 'Sin detalle'}</p>
            {pedido.posnet_tipo && medio === 'posnet' && (
                <p className="panel-pedido-envio">{pedido.posnet_tipo === 'qr' ? '📱 Se cobró con QR' : '💳 Se cobró con tarjeta'}</p>
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
            .select('id, creado_en, total, envio, posnet_tipo, medio_pago, medio_pago_cobro, canal, unidad, estado, motivo_cancelacion, pedido_items(id, categoria_id, producto_id, variante, nombre, cantidad, precio_unitario, detalle)')
            .eq('unidad', getUnidad())      // la tablet del truck no ve (ni cancela) los del local
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
    }, [sesion, dia, version]);

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

    return (
        <main className="panel">
            <Cabecera />

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
                <div className="panel-lista">
                    {pedidos.map((p) => (
                        <TarjetaPedido
                            key={p.id}
                            pedido={p}
                            ocupado={ocupado === p.id}
                            onCobro={cobro}
                            onCancelar={pedirCancelar}
                            onReactivar={reactivar}
                            onCambiarHora={(pedido) => setModal({ tipo: 'hora', pedido })}
                            onEditar={(pedido) => setModal({ tipo: 'editar', pedido })}
                        />
                    ))}
                </div>
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

function Cabecera() {
    return (
        <header className="panel-cab">
            <button type="button" className="panel-link panel-volver" onClick={volverAlMenu}>← Menú</button>
            <h2 className="panel-titulo">Pedidos</h2>
            <span className="panel-unidad">{esMostrador() ? `${UNIDAD_LABEL[getUnidad()]} · Mostrador` : ''}</span>
        </header>
    );
}

export default PanelPedidos;
