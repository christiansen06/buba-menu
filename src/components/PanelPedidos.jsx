import { useCallback, useEffect, useState } from 'react';
import { supabase, hayBase } from '../utils/supabase.js';
import { formatPrice } from '../utils/format.js';
import { esMostrador, getUnidad, UNIDAD_LABEL } from '../config/unidad.js';

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
    { id: 'debito', label: 'Débito' },
];

const DECLARADO = { efectivo: 'efectivo', transferencia: 'transferencia' };

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

function resumenItems(pedido) {
    const items = pedido.pedido_items || [];
    return items
        .map((it) => (it.cantidad > 1 ? `${it.cantidad}× ${it.nombre}` : it.nombre))
        .join(' · ');
}

/* ------------------------------------------------------------------ */

function TarjetaPedido({ pedido, ocupado, onCobro, onCancelar, onReactivar }) {
    const cancelado = pedido.estado === 'cancelado';
    return (
        <article className={`panel-pedido ${cancelado ? 'cancelado' : ''}`}>
            <div className="panel-pedido-cab">
                <span className="panel-pedido-hora">{hora(pedido.creado_en)}</span>
                <span className="panel-pedido-canal">
                    {pedido.canal === 'mostrador' ? '🏠 Mostrador' : pedido.canal === 'qr' ? '📱 QR' : '—'}
                </span>
                <span className="panel-pedido-total">{formatPrice(pedido.total)}</span>
            </div>

            <p className="panel-pedido-items">{resumenItems(pedido) || 'Sin detalle'}</p>

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
                        <span className="panel-cobro-label">
                            Cobrado con
                            {pedido.medio_pago && (
                                <small> (dijo {DECLARADO[pedido.medio_pago] || pedido.medio_pago})</small>
                            )}
                        </span>
                        <div className="panel-cobro-chips" role="group" aria-label="Medio de cobro">
                            {MEDIOS.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    className={`panel-chip ${pedido.medio_pago_cobro === m.id ? 'activo' : ''}`}
                                    onClick={() => onCobro(pedido, m.id)}
                                    disabled={ocupado}
                                    aria-pressed={pedido.medio_pago_cobro === m.id}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
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
            .select('id, creado_en, total, medio_pago, medio_pago_cobro, canal, unidad, estado, motivo_cancelacion, pedido_items(nombre, cantidad, precio_unitario)')
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
        // Tocar el chip activo lo apaga (borra la marca).
        const nuevo = pedido.medio_pago_cobro === medio ? null : medio;
        return accion(pedido, () => supabase.rpc('registrar_cobro', { p_id: pedido.id, p_medio: nuevo }), 'No se pudo anotar el cobro');
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
    const total = confirmados.reduce((s, p) => s + (p.total || 0), 0);

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
                <span className="panel-resumen-total">{formatPrice(total)}</span>
                {cancelados > 0 && <span className="panel-resumen-cancelados">+ {cancelados} cancelado{cancelados > 1 ? 's' : ''}</span>}
                <button type="button" className="panel-btn-sec" onClick={recargar}>Actualizar</button>
            </div>

            {hayPin === false && <FormPin hayPin={false} onListo={() => setHayPin(true)} />}

            {error && <p className="field-error panel-error">{error}</p>}

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
                        />
                    ))}
                </div>
            )}

            <footer className="panel-pie">
                {hayPin && <button type="button" className="panel-link" onClick={() => setModal({ tipo: 'pin' })}>Cambiar PIN</button>}
                <button type="button" className="panel-link" onClick={salir}>Cerrar sesión</button>
            </footer>

            {modal?.tipo === 'cancelar' && (
                <ModalCancelar
                    pedido={modal.pedido}
                    onCerrar={() => setModal(null)}
                    onCancelado={() => { setModal(null); recargar(); }}
                />
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
