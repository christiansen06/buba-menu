import { useState } from 'react';
import { supabase } from '../utils/supabase.js';
import { formatPrice } from '../utils/format.js';
import { itemsParaBase } from '../utils/pedidos.js';
import { TIPOS_DESCUENTO, calcularDescuento } from '../utils/descuento.js';
import { menuCategories } from '../data/menu.js';
import { CartContext } from '../context/CartContext.jsx';
import { DisponibilidadProvider } from '../context/DisponibilidadContext.jsx';
import IceCreamBuilder from './IceCreamBuilder.jsx';
import MedialunasSelector from './MedialunasSelector.jsx';
import LicuadoBuilder from './LicuadoBuilder.jsx';
import WaffleBuilder from './WaffleBuilder.jsx';
import ProductosDeCategoria from './ProductosDeCategoria.jsx';
import PromoSection from './PromoSection.jsx';

/**
 * Editar un pedido ya tomado (parte 30): cambiar cantidades, sacar, sumar o
 * rehacer un producto. Para sumar y para rehacer se usan los MISMOS armables
 * del menú (waffles, medialunas, bubble tea con perlas extra…), dentro de un
 * carrito de mentira que en vez de llenar el carrito agrega líneas a este
 * pedido. Así no hay una segunda versión de cada armable para mantener.
 *
 * El total lo calcula la base (editar_pedido); acá se muestra el mismo
 * cálculo. Sumar no pide PIN; si el total baja sí, igual que cancelar.
 */

const CATEGORIAS = menuCategories.filter((c) => c.items?.length || c.builderType);

function Armable({ category, linea }) {
    if (category.builderType === 'icecream') return <IceCreamBuilder category={category} />;
    if (category.builderType === 'medialunas') return <MedialunasSelector category={category} />;
    if (category.builderType === 'licuado') return <LicuadoBuilder category={category} />;
    if (category.builderType === 'waffle') return <WaffleBuilder category={category} />;
    if (category.items?.length) {
        const det = linea?.detalle || {};
        return (
            <ProductosDeCategoria
                category={category}
                soloProducto={linea?.producto_id || null}
                inicial={linea ? { variante: linea.variante, extras: det.extras || [], presentacion: det.presentacion || null } : null}
            />
        );
    }
    return null;
}

/** El item de carrito que corresponde a una línea ya guardada (para que el armable la cargue). */
function itemDeLinea(l) {
    const cat = menuCategories.find((c) => c.id === l.categoria_id);
    return {
        id: l.clave,
        categoryId: l.categoria_id,
        categoryName: cat?.name || l.categoria_id,
        builderType: cat?.builderType || null,
        productId: l.producto_id,
        variante: l.variante,
        label: l.nombre,
        unitPrice: l.precio,
        config: l.detalle || null,
    };
}

export default function EditarPedido({ pedido, hayPin, onCerrar, onListo }) {
    const [lineas, setLineas] = useState(() => (pedido.pedido_items || []).map((it) => ({
        clave: `id:${it.id}`, id: it.id, nombre: it.nombre, cantidad: it.cantidad, precio: it.precio_unitario, antes: it.cantidad,
        categoria_id: it.categoria_id, producto_id: it.producto_id, variante: it.variante, detalle: it.detalle,
    })));
    const [picker, setPicker] = useState(null);   // { catId, linea? } · linea = la que se está rehaciendo
    const [aviso, setAviso] = useState('');
    const [otro, setOtro] = useState({ nombre: '', precio: '' });
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    // Descuento (parte 38): cupón en pesos, cupón de % o tarjeta de fidelidad completa (un producto gratis).
    const [desc, setDesc] = useState(() => ({
        tipo: pedido.descuento_tipo || '',
        valor: pedido.descuento_tipo === 'porcentaje' || pedido.descuento_tipo === 'monto' ? String(Number(pedido.descuento_valor || '')) : '',
        linea: '',                                   // tarjeta: la línea que va gratis
        nota: pedido.descuento_nota || '',
        monto: pedido.descuento_tipo === 'tarjeta' ? pedido.descuento : 0,   // tarjeta ya guardada: lo que se regaló
    }));

    const envio = pedido.envio || 0;
    const subtotal = lineas.reduce((s, l) => s + l.cantidad * (l.precio || 0), 0);
    const lineaGratis = desc.tipo === 'tarjeta' ? lineas.find((l) => l.clave === desc.linea && l.cantidad > 0) : null;
    const valorDescuento = desc.tipo === 'tarjeta' ? (lineaGratis ? lineaGratis.precio : desc.monto) : desc.valor;
    const descuento = calcularDescuento(subtotal, { tipo: desc.tipo, valor: valorDescuento });
    const total = subtotal - descuento + envio;
    const baja = total < pedido.total;
    const descuentoCambio = (desc.tipo || '') !== (pedido.descuento_tipo || '') || descuento !== (pedido.descuento || 0)
        || (desc.nota || '') !== (pedido.descuento_nota || '');
    const vivas = lineas.filter((l) => l.cantidad > 0).length;
    const cambio = lineas.some((l) => l.cantidad !== l.antes || !l.id) || descuentoCambio;

    const cambiarCantidad = (clave, delta) => setLineas((ls) => ls.map((l) => (
        l.clave === clave ? { ...l, cantidad: Math.max(0, Math.min(99, l.cantidad + delta)) } : l
    )));

    /** Una línea nueva (o rehecha) a partir de un item de carrito. */
    const aplicarItem = (item, reemplaza) => {
        const base = itemsParaBase([{ ...item, quantity: 1 }])[0];
        const nueva = {
            clave: item.mergeKey || `nueva:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
            nombre: item.label, precio: item.unitPrice, cantidad: item.quantity || 1, antes: 0,
            categoria_id: base.categoria_id, producto_id: base.producto_id, variante: base.variante, detalle: base.detalle,
        };
        setLineas((ls) => {
            let resto = ls;
            if (reemplaza) {
                // La línea vieja se saca (queda con cantidad 0 si ya estaba guardada) y la nueva hereda la cantidad.
                nueva.cantidad = Math.max(1, reemplaza.cantidad);
                resto = ls.flatMap((l) => (l.clave !== reemplaza.clave ? [l] : (l.id ? [{ ...l, cantidad: 0 }] : [])));
            }
            const igual = resto.find((l) => !l.id && l.clave === nueva.clave);
            if (igual) return resto.map((l) => (l === igual ? { ...l, cantidad: Math.min(99, l.cantidad + nueva.cantidad) } : l));
            return [...resto, nueva];
        });
        if (reemplaza) setPicker(null);
        else { setAviso(`Agregado: ${item.label}`); setTimeout(() => setAviso(''), 2200); }
    };

    const sumarOtro = () => {
        const precio = parseInt(otro.precio.replace(/\D/g, ''), 10);
        if (!otro.nombre.trim() || !precio) { setError('Poné el nombre y el precio'); return; }
        setError('');
        aplicarItem({ categoryId: 'otros', productId: null, variante: null, label: otro.nombre.trim(), unitPrice: precio, config: null, mergeKey: `otro:${otro.nombre.trim()}:${precio}` }, null);
        setOtro({ nombre: '', precio: '' });
    };

    // El carrito de mentira que ven los armables.
    const reemplaza = picker?.linea || null;
    const carritoFalso = {
        items: [], total: 0, count: 0, hasConsultarItems: false,
        addItem: (item) => aplicarItem(item, reemplaza),
        updateItem: (_id, campos) => aplicarItem({ ...itemDeLinea(reemplaza), ...campos }, reemplaza),
        setQuantity: () => {}, removeItem: () => {}, clearCart: () => {},
        editingItem: reemplaza && CATEGORIAS.find((c) => c.id === reemplaza.categoria_id)?.builderType ? itemDeLinea(reemplaza) : null,
        startEdit: () => {},
        clearEdit: () => { if (reemplaza) setPicker(null); },
        theme: 'light', toggleTheme: () => {},
    };

    const guardar = async (e) => {
        e.preventDefault();
        if (vivas === 0) { setError('El pedido quedaría vacío: cancelalo en su lugar.'); return; }
        if (baja && pin.length !== 4) { setError('Para bajar el total ingresá el PIN de 4 números'); return; }
        setError('');
        setEnviando(true);
        const items = lineas.map((l) => (l.id
            ? { id: l.id, cantidad: l.cantidad }
            : { categoria_id: l.categoria_id, producto_id: l.producto_id, nombre: l.nombre, variante: l.variante, cantidad: l.cantidad, precio_unitario: l.precio, detalle: l.detalle }));
        if (desc.tipo && !descuento) { setEnviando(false); setError(desc.tipo === 'tarjeta' ? 'Elegí qué producto va gratis' : 'Poné cuánto es el descuento'); return; }
        // null = no tocar el descuento; {} = sacarlo; con tipo = aplicarlo.
        const p_descuento = !descuentoCambio ? null
            : !desc.tipo ? {}
                : { tipo: desc.tipo, valor: desc.tipo === 'tarjeta' ? valorDescuento : Number(desc.valor), nota: desc.nota.trim() };
        const { error: err } = await supabase.rpc('editar_pedido', { p_id: pedido.id, p_items: items, p_pin: baja ? pin : null, p_descuento });
        setEnviando(false);
        if (err) { setError(err.message); if (baja) setPin(''); return; }
        onListo();
    };

    const categoria = picker && CATEGORIAS.find((c) => c.id === picker.catId);

    // ---- Elegir / armar un producto ----
    if (picker) {
        return (
            <div className="admin-overlay" onClick={onCerrar}>
                <div className="admin-panel panel-modal editar-pedido editar-ancho" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-header">
                        <h3>{reemplaza ? `Rehacer: ${reemplaza.nombre}` : 'Agregar al pedido'}</h3>
                        <button className="cart-close-btn" type="button" onClick={() => setPicker(null)} aria-label="Volver al pedido">✕</button>
                    </div>
                    {!reemplaza && (
                        <div className="editar-cats" role="group" aria-label="Categoría">
                            {CATEGORIAS.map((c) => (
                                <button key={c.id} type="button" className={`panel-chip ${picker.catId === c.id ? 'activo' : ''}`} onClick={() => setPicker({ catId: c.id })}>
                                    {c.icon} {c.name}
                                </button>
                            ))}
                            <button type="button" className={`panel-chip ${picker.catId === 'promos' ? 'activo' : ''}`} onClick={() => setPicker({ catId: 'promos' })}>🎉 Promos</button>
                            <button type="button" className={`panel-chip ${picker.catId === 'otro' ? 'activo' : ''}`} onClick={() => setPicker({ catId: 'otro' })}>✍️ Otro</button>
                        </div>
                    )}
                    {aviso && <p className="panel-aviso" role="status">{aviso}</p>}
                    <div className="editar-armable">
                        <DisponibilidadProvider>
                            <CartContext.Provider value={carritoFalso}>
                                {categoria && <Armable category={categoria} linea={reemplaza} />}
                                {picker.catId === 'promos' && <PromoSection />}
                            </CartContext.Provider>
                        </DisponibilidadProvider>
                        {picker.catId === 'otro' && (
                            <div className="editar-otro">
                                <input type="text" placeholder="Qué es" maxLength={60} value={otro.nombre} onChange={(e) => setOtro({ ...otro, nombre: e.target.value })} />
                                <input type="text" inputMode="numeric" placeholder="Precio" value={otro.precio} onChange={(e) => setOtro({ ...otro, precio: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                                <button type="button" className="panel-btn-sec" onClick={sumarOtro}>Sumar</button>
                            </div>
                        )}
                    </div>
                    {error && <p className="field-error">{error}</p>}
                    <button type="button" className="builder-add-btn" onClick={() => setPicker(null)}>Listo, volver al pedido</button>
                </div>
            </div>
        );
    }

    // ---- El pedido ----
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
                            <span className="editar-precio">
                                {l.precio == null ? 'a consultar' : formatPrice(l.cantidad * l.precio)}
                                {l.cantidad > 0 && l.categoria_id && l.categoria_id !== 'otros' && (
                                    <button type="button" className="editar-rehacer" onClick={() => setPicker({ catId: l.categoria_id, linea: l })}>✏️ Editar producto</button>
                                )}
                            </span>
                            <div className="cart-qty">
                                <button type="button" onClick={() => cambiarCantidad(l.clave, -1)} aria-label={`Restar ${l.nombre}`}>−</button>
                                <span>{l.cantidad}</span>
                                <button type="button" onClick={() => cambiarCantidad(l.clave, 1)} aria-label={`Sumar ${l.nombre}`}>+</button>
                            </div>
                        </li>
                    ))}
                </ul>
                {envio > 0 && <p className="panel-ayuda">🛵 Incluye el envío de {formatPrice(envio)}.</p>}

                <button type="button" className="panel-btn-sec editar-agregar" onClick={() => setPicker({ catId: CATEGORIAS[0].id })}>+ Agregar algo</button>

                <fieldset className="editar-descuento">
                    <legend>Descuento</legend>
                    <div className="editar-cats" role="group" aria-label="Tipo de descuento">
                        <button type="button" className={`panel-chip ${desc.tipo === '' ? 'activo' : ''}`} onClick={() => setDesc({ ...desc, tipo: '' })}>Sin descuento</button>
                        {TIPOS_DESCUENTO.map((t) => (
                            <button key={t.id} type="button" className={`panel-chip ${desc.tipo === t.id ? 'activo' : ''}`}
                                onClick={() => setDesc({ ...desc, tipo: t.id, valor: t.id === desc.tipo ? desc.valor : '' })}>{t.etiqueta}</button>
                        ))}
                    </div>
                    {desc.tipo === 'monto' && (
                        <label className="checkout-field">
                            <span>Cuánto se descuenta ($)</span>
                            <input type="text" inputMode="numeric" placeholder="3000" value={desc.valor}
                                onChange={(e) => setDesc({ ...desc, valor: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                        </label>
                    )}
                    {desc.tipo === 'porcentaje' && (
                        <label className="checkout-field">
                            <span>Porcentaje (%)</span>
                            <input type="text" inputMode="numeric" placeholder="10" value={desc.valor}
                                onChange={(e) => { const n = e.target.value.replace(/\D/g, '').slice(0, 3); setDesc({ ...desc, valor: n === '' ? '' : String(Math.min(100, Number(n))) }); }} />
                        </label>
                    )}
                    {desc.tipo === 'tarjeta' && (
                        <label className="checkout-field">
                            <span>Qué producto va gratis (uno)</span>
                            <select value={desc.linea} onChange={(e) => setDesc({ ...desc, linea: e.target.value })}>
                                <option value="">{desc.monto > 0 && !lineaGratis ? `Sin cambios (regala ${formatPrice(desc.monto)})` : 'Elegí…'}</option>
                                {lineas.filter((l) => l.cantidad > 0 && l.precio > 0).map((l) => (
                                    <option key={l.clave} value={l.clave}>{l.nombre} · {formatPrice(l.precio)}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    {desc.tipo && (
                        <label className="checkout-field">
                            <span>Nota <small>opcional</small></span>
                            <input type="text" maxLength={120} placeholder="Cupón Instagram, cliente frecuente…" value={desc.nota} onChange={(e) => setDesc({ ...desc, nota: e.target.value })} />
                        </label>
                    )}
                    {descuento > 0 && <p className="panel-ayuda">Descuento: −{formatPrice(descuento)}</p>}
                </fieldset>

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
