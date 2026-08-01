import { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { sendOrderToWhatsApp } from '../utils/whatsapp.js';
import { registrarPedido } from '../utils/pedidos.js';
import { formatPrice } from '../utils/format.js';
import { getEstadoLocal, getTextoEstado } from '../utils/horarios.js';
import PaymentInfo from './PaymentInfo.jsx';

function Cart() {
    const { items, total, count, hasConsultarItems, setQuantity, removeItem, clearCart, startEdit, theme, toggleTheme } = useCart();
    const [open, setOpen] = useState(false);
    const [checkout, setCheckout] = useState(false);
    const [sent, setSent] = useState(false);
    // El nombre queda guardado en el teléfono para no reescribirlo en cada pedido
    const [name, setName] = useState(() => {
        try {
            return localStorage.getItem('buba-name') || '';
        } catch {
            return '';
        }
    });
    const [note, setNote] = useState('');
    const [nameError, setNameError] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(null); // 'transferencia' | 'efectivo'
    const [paymentError, setPaymentError] = useState(false);
    const pagoRef = useRef(null);
    const [bump, setBump] = useState(false);
    const prevCount = useRef(count);

    // Al agregar algo, el carrito late y se expande mostrando "Agregado ✓".
    // Antes duraba 400 ms: medio parpadeo que nadie llegaba a ver, menos
    // alguien con las manos ocupadas. 1,5 s alcanza para registrarlo sin molestar.
    useEffect(() => {
        if (count > prevCount.current) {
            setBump(true);
            const t = setTimeout(() => setBump(false), 1500);
            prevCount.current = count;
            return () => clearTimeout(t);
        }
        prevCount.current = count;
    }, [count]);

    // El alias aparece más abajo del pliegue, y el botón de enviar está fijo
    // al pie: sin esto el cliente podía mandar el pedido sin haberlo visto.
    useEffect(() => {
        if (paymentMethod === 'transferencia' && pagoRef.current) {
            pagoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [paymentMethod]);

    const handleEdit = (item) => {
        startEdit(item);
        setOpen(false);
        setTimeout(() => {
            const el = document.getElementById(item.categoryId);
            if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY - 68;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        }, 120);
    };

    const handleOpen = () => {
        setCheckout(false);
        setSent(false);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setCheckout(false);
        setSent(false);
    };

    const goToCheckout = () => setCheckout(true);

    // Estado del local al momento de pagar. Si está cerrado no bloqueamos el
    // envío (el cliente puede querer dejarlo pedido igual), pero avisamos
    // para que no se quede esperando una respuesta que no va a llegar.
    const estado = getEstadoLocal();

    const handleSend = () => {
        // Los dos errores se marcan juntos: si no, el cliente corrige uno,
        // vuelve a tocar enviar y recién ahí se entera del otro.
        const faltaNombre = !name.trim();
        const faltaPago = !paymentMethod;
        setNameError(faltaNombre);
        setPaymentError(faltaPago);
        if (faltaNombre || faltaPago) return;

        try {
            localStorage.setItem('buba-name', name.trim());
        } catch {
            // ignore
        }
        // Primero WhatsApp: window.open tiene que salir dentro del mismo clic
        // del usuario o el navegador lo bloquea como si fuera un popup.
        sendOrderToWhatsApp({ items, total, name: name.trim(), note, hasConsultarItems, paymentMethod });

        // Después anotamos la venta, sin esperar la respuesta. Si la base
        // está caída el cliente ni se entera: su pedido ya salió.
        // Ojo: no van ni el nombre ni la aclaración, sólo los productos.
        void registrarPedido({ items, total });

        setSent(true);
    };

    const handleNewOrder = () => {
        clearCart();
        setNote('');
        setPaymentMethod(null);
        setPaymentError(false);
        setCheckout(false);
        setSent(false);
        setOpen(false);
    };

    return (
        <>
            {/* Toggle de tema — flotante arriba del carrito */}
            <button className="theme-toggle theme-toggle-fab" onClick={toggleTheme} aria-label="Cambiar tema">
                {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Botón del carrito */}
            <button
                className={`cart-fab ${bump ? 'cart-fab-bump' : ''} ${items.length > 0 ? 'cart-fab-lleno' : ''}`}
                onClick={handleOpen}
                aria-label={
                    items.length > 0
                        ? `Ver mi pedido: ${count} ${count === 1 ? 'producto' : 'productos'}, ${formatPrice(total)}`
                        : 'Ver mi pedido'
                }
            >
                <span className="cart-fab-icono" aria-hidden="true">🛒</span>

                {items.length > 0 && (
                    bump ? (
                        <span className="cart-fab-aviso">Agregado ✓ · Ver pedido</span>
                    ) : (
                        <span className="cart-fab-info">
                            <span className="cart-fab-count">{count}</span>
                            <span className="cart-fab-total">{formatPrice(total)}</span>
                        </span>
                    )
                )}
            </button>

            {open && (
                <>
                    <div className="cart-overlay" onClick={handleClose} />
                    <div className="cart-panel">

                        {/* PEDIDO ENVIADO */}
                        {sent ? (
                            <div className="cart-confirm">
                                <div className="cart-confirm-icon">✅</div>
                                <h3>¡Pedido enviado!</h3>
                                <p>
                                    Tu pedido a nombre de <strong>{name}</strong> ya viaja por WhatsApp.
                                    {paymentMethod === 'efectivo'
                                        ? ' Lo pagás en el mostrador 💵'
                                        : ' Acá tenés de nuevo los datos para transferir 👇'}
                                </p>
                                {/* Respaldo para quien sí vuelve al menú: los datos ya los vio
                                    en el checkout y también le quedaron en el chat de WhatsApp. */}
                                {paymentMethod !== 'efectivo' && (
                                    <PaymentInfo total={total} hasConsultarItems={hasConsultarItems} />
                                )}
                                <button className="builder-add-btn" onClick={handleNewOrder}>Hacer un nuevo pedido</button>
                                <button className="cart-clear-btn" onClick={handleClose}>Cerrar</button>
                            </div>

                            /* CHECKOUT: nombre + nota */
                        ) : checkout ? (
                            <>
                                <div className="cart-panel-header">
                                    <h3>Últimos datos</h3>
                                    <button className="cart-close-btn" onClick={() => setCheckout(false)}>←</button>
                                </div>

                                <div className="cart-checkout-body">
                                    {!estado.abierto && (
                                        <div className="aviso-cerrado" role="status">
                                            <span className="aviso-cerrado-icono" aria-hidden="true">🌙</span>
                                            <div>
                                                <strong>Ahora estamos cerrados</strong>
                                                <p>{getTextoEstado(estado)}. Podés mandarlo igual, pero te vamos a responder cuando abramos.</p>
                                            </div>
                                        </div>
                                    )}

                                    <label className="checkout-field">
                                        <span>¿A nombre de quién? <em className="req">*</em></span>
                                        <input
                                            type="text"
                                            value={name}
                                            placeholder="Tu nombre"
                                            maxLength={40}
                                            className={nameError ? 'input-error' : ''}
                                            onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
                                            autoFocus
                                        />
                                        {nameError && <span className="field-error">Necesitamos tu nombre para preparar el pedido</span>}
                                    </label>

                                    <label className="checkout-field">
                                        <span>Aclaración <span className="opcional-tag">opcional</span></span>
                                        <textarea
                                            value={note}
                                            placeholder="Ej: sin azúcar, para llevar, sin maní…"
                                            maxLength={200}
                                            rows={3}
                                            onChange={(e) => setNote(e.target.value)}
                                        />
                                    </label>

                                    {/*
                                      El método de pago se elige ACÁ, antes de enviar. Al tocar
                                      "Enviar" se abre WhatsApp y el cliente sale del menú: si el
                                      alias apareciera recién después, no lo ve nunca.
                                    */}
                                    <div className="checkout-field">
                                        <span>¿Cómo vas a pagar? <em className="req">*</em></span>
                                        <div className="payment-method-group">
                                            {[
                                                { id: 'transferencia', icono: '💳', label: 'Transferencia' },
                                                { id: 'efectivo', icono: '💵', label: 'Efectivo en el local' },
                                            ].map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    className={`payment-method-option ${paymentMethod === m.id ? 'selected' : ''}`}
                                                    aria-pressed={paymentMethod === m.id}
                                                    onClick={() => { setPaymentMethod(m.id); setPaymentError(false); }}
                                                >
                                                    <span className="payment-method-icon" aria-hidden="true">{m.icono}</span>
                                                    <span>{m.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        {paymentError && <span className="field-error">Elegí cómo vas a pagar</span>}
                                    </div>

                                    {paymentMethod === 'transferencia' && (
                                        <div ref={pagoRef}>
                                            <PaymentInfo
                                                total={total}
                                                hasConsultarItems={hasConsultarItems}
                                                variant="checkout"
                                            />
                                        </div>
                                    )}

                                    <div className="checkout-summary">
                                        <div className="cart-total-row">
                                            <span className="cart-total-label">Total del pedido</span>
                                            <span className="cart-total-price">{formatPrice(total)}</span>
                                        </div>
                                        {hasConsultarItems && (
                                            <p className="cart-consultar-note">Algunos ítems se cotizan en el mostrador</p>
                                        )}
                                    </div>
                                </div>

                                <div className="cart-panel-footer">
                                    <button className="builder-add-btn" onClick={handleSend}>
                                        Enviar pedido por WhatsApp 📲
                                    </button>
                                    <p className="cart-hint">Se abrirá WhatsApp con tu pedido ya escrito — solo tenés que enviarlo</p>
                                </div>
                            </>

                            /* CARRITO VACÍO */
                        ) : items.length === 0 ? (
                            <div className="cart-empty">
                                <div className="cart-empty-icon">🧋</div>
                                <h3>Todavía no agregaste nada</h3>
                                <p>Explorá el menú y armá tu pedido — vas a poder revisarlo acá antes de enviarlo.</p>
                                <button className="builder-add-btn" onClick={handleClose}>Explorar el menú 👆</button>
                            </div>

                            /* LISTA NORMAL */
                        ) : (
                            <>
                                <div className="cart-panel-header">
                                    <h3>Tu pedido</h3>
                                    <button className="cart-close-btn" onClick={handleClose}>✕</button>
                                </div>

                                <div className="cart-items-list">
                                    {items.map((item) => {
                                        const lineTotal = (item.unitPrice || 0) * item.quantity;
                                        const isBuilder = !!item.builderType;
                                        return (
                                            <div className="cart-item" key={item.id}>
                                                <div className="cart-item-info">
                                                    <span className="cart-item-label">{item.label}</span>
                                                    <span className={`cart-item-price ${item.unitPrice == null ? 'consultar' : ''}`}>
                            {item.unitPrice == null ? 'A consultar' : formatPrice(lineTotal)}
                          </span>
                                                    <div className="cart-item-controls">
                                                        <div className="cart-qty">
                                                            <button onClick={() => setQuantity(item.id, item.quantity - 1)} aria-label="Restar">−</button>
                                                            <span>{item.quantity}</span>
                                                            <button onClick={() => setQuantity(item.id, item.quantity + 1)} aria-label="Sumar">+</button>
                                                        </div>
                                                        {isBuilder && (
                                                            <button className="cart-edit-btn" onClick={() => handleEdit(item)}>✏️ Editar</button>
                                                        )}
                                                    </div>
                                                </div>
                                                <button className="cart-item-remove" onClick={() => removeItem(item.id)} aria-label="Eliminar">✕</button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="cart-panel-footer">
                                    <div className="cart-total-row">
                                        <span className="cart-total-label">Total</span>
                                        <span className="cart-total-price">{formatPrice(total)}</span>
                                    </div>
                                    {hasConsultarItems && (
                                        <p className="cart-consultar-note">Algunos ítems se cotizan en el mostrador</p>
                                    )}
                                    <button className="builder-add-btn" onClick={goToCheckout}>Continuar →</button>
                                    <button className="cart-clear-btn" onClick={clearCart}>Limpiar pedido</button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </>
    );
}

export default Cart;