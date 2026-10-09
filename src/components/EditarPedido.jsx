import { useMemo, useState } from 'react';
import { supabase } from '../utils/supabase.js';
import { formatPrice } from '../utils/format.js';
import { catalogoRapido } from '../utils/catalogoRapido.js';
import { itemsParaBase } from '../utils/pedidos.js';

/**
 * Editar un pedido ya tomado: cambiar cantidades, sacar o sumar productos.
 * El total lo calcula la base (editar_pedido, parte 30); acá se muestra el
 * mismo cálculo para ver cómo queda antes de guardar. Sumar no pide PIN;
 * si el total baja sí, igual que para cancelar.
 */
export default function EditarPedido({ pedido, hayPin, onCerrar, onListo }) {
    const [lineas, setLineas] = useState(() => (pedido.pedido_items || []).map((it) => ({
        clave: `id:${it.id}`, id: it.id, nombre: it.nombre, cantidad: it.cantidad, precio: it.precio_unitario, antes: it.cantidad,
    })));
    const [agregando, setAgregando] = useState(false);
    const [catId, setCatId] = useState(null);
    const [otro, setOtro] = useState({ nombre: '', precio: '' });
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    const catalogo = useMemo(() => catalogoRapido(), []);

    const envio = pedido.envio || 0;
    const total = lineas.reduce((s, l) => s + l.cantidad * (l.precio || 0), 0) + envio;
    const baja = total < pedido.total;
    const vivas = lineas.filter((l) => l.cantidad > 0).length;
    const cambio = lineas.some((l) => l.cantidad !== l.antes || !l.id);

    const cambiarCantidad = (clave, delta) => setLineas((ls) => ls.map((l) => (
        l.clave === clave ? { ...l, cantidad: Math.max(0, Math.min(99, l.cantidad + delta)) } : l
    )));

    const sumar = (linea) => {
        setLineas((ls) => {
            const existente = ls.find((l) => l.clave === linea.clave);
            if (existente) return ls.map((l) => (l.clave === linea.clave ? { ...l, cantidad: Math.min(99, l.cantidad + 1) } : l));
            return [...ls, { ...linea, cantidad: 1, antes: 0 }];
        });
        setAgregando(false);
    };

    const sumarOtro = () => {
        const precio = parseInt(otro.precio.replace(/\D/g, ''), 10);
        if (!otro.nombre.trim() || !precio) { setError('Poné el nombre y el precio'); return; }
        setError('');
        sumar({ clave: `otro:${otro.nombre.trim()}:${precio}`, nombre: otro.nombre.trim(), precio, nuevo: { categoryId: 'otros', productId: null, variante: null, label: otro.nombre.trim(), unitPrice: precio, config: null } });
        setOtro({ nombre: '', precio: '' });
    };

    const guardar = async (e) => {
        e.preventDefault();
        if (vivas === 0) { setError('El pedido quedaría vacío: cancelalo en su lugar.'); return; }
        if (baja && pin.length !== 4) { setError('Para bajar el total ingresá el PIN de 4 números'); return; }
        setError('');
        setEnviando(true);
        const items = lineas.map((l) => (l.id
            ? { id: l.id, cantidad: l.cantidad }
            : { ...itemsParaBase([{ ...l.nuevo, quantity: l.cantidad }])[0], cantidad: l.cantidad }));
        const { error: err } = await supabase.rpc('editar_pedido', { p_id: pedido.id, p_items: items, p_pin: baja ? pin : null });
        setEnviando(false);
        if (err) { setError(err.message); if (baja) setPin(''); return; }
        onListo();
    };

    const cat = catalogo.find((c) => c.id === catId);

    return (
        <div className="admin-overlay" onClick={onCerrar}>
            <form className="admin-panel panel-modal editar-pedido" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
                <div className="admin-header">
                    <h3>Editar pedido</h3>
                    <button className="cart-close-btn" type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <ul className="editar-lineas">
                    {lineas.map((l) => (
                        <li key={l.clave} className={l.cantidad === 0 ? 'quitada' : ''}>
                            <span className="editar-nombre">{l.nombre}</span>
                            <span className="editar-precio">{l.precio == null ? 'a consultar' : formatPrice(l.cantidad * l.precio)}</span>
                            <div className="cart-qty">
                                <button type="button" onClick={() => cambiarCantidad(l.clave, -1)} aria-label={`Restar ${l.nombre}`}>−</button>
                                <span>{l.cantidad}</span>
                                <button type="button" onClick={() => cambiarCantidad(l.clave, 1)} aria-label={`Sumar ${l.nombre}`}>+</button>
                            </div>
                        </li>
                    ))}
                </ul>
                {envio > 0 && <p className="panel-ayuda">🛵 Incluye el envío de {formatPrice(envio)}.</p>}

                {!agregando ? (
                    <button type="button" className="panel-btn-sec editar-agregar" onClick={() => setAgregando(true)}>+ Agregar algo</button>
                ) : (
                    <div className="editar-picker">
                        <div className="editar-cats" role="group" aria-label="Categoría">
                            {catalogo.map((c) => (
                                <button key={c.id} type="button" className={`panel-chip ${catId === c.id ? 'activo' : ''}`} onClick={() => setCatId(c.id)}>
                                    {c.icono} {c.nombre}
                                </button>
                            ))}
                            <button type="button" className={`panel-chip ${catId === 'otro' ? 'activo' : ''}`} onClick={() => setCatId('otro')}>✍️ Otro</button>
                        </div>
                        {cat && (
                            <ul className="editar-opciones">
                                {cat.opciones.map((o) => (
                                    <li key={o.clave}>
                                        <button type="button" onClick={() => sumar({ clave: o.clave, nombre: o.label, precio: o.unitPrice, nuevo: o.item })}>
                                            <span>{o.label}</span><strong>{formatPrice(o.unitPrice)}</strong>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {catId === 'otro' && (
                            <div className="editar-otro">
                                <input type="text" placeholder="Qué es" maxLength={60} value={otro.nombre} onChange={(e) => setOtro({ ...otro, nombre: e.target.value })} />
                                <input type="text" inputMode="numeric" placeholder="Precio" value={otro.precio} onChange={(e) => setOtro({ ...otro, precio: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                                <button type="button" className="panel-btn-sec" onClick={sumarOtro}>Sumar</button>
                            </div>
                        )}
                        <button type="button" className="panel-link" onClick={() => setAgregando(false)}>Listo, cerrar</button>
                    </div>
                )}

                <p className="editar-total">
                    <span>Total</span>
                    <span>{total !== pedido.total && <s>{formatPrice(pedido.total)}</s>} <strong>{formatPrice(total)}</strong></span>
                </p>

                {baja && (hayPin === false
                    ? <p className="field-error">Para bajar un total hace falta un PIN: definilo abajo en "Cambiar PIN".</p>
                    : (
                        <label className="checkout-field panel-pin-campo">
                            <span>PIN (el total baja)</span>
                            <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} autoComplete="off"
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                        </label>
                    ))}
                {error && <p className="field-error">{error}</p>}
                <p className="panel-ayuda">Queda anotado cómo estaba antes. El WhatsApp ya enviado no se modifica: avisale a la cocina lo que cambió.</p>
                <div className="panel-acciones-fila">
                    <button type="button" className="panel-btn-sec" onClick={onCerrar}>Volver</button>
                    <button type="submit" className="builder-add-btn" disabled={enviando || !cambio}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
                </div>
            </form>
        </div>
    );
}
