import { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { sendOrderToWhatsApp } from '../utils/whatsapp.js';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function Cart() {
    const { items, total, count, hasConsultarItems, setQuantity, removeItem, clearCart, startEdit, theme, toggleTheme } = useCart();
    const [open, setOpen] = useState(false);
    const [checkout, setCheckout] = useState(false);
    const [sent, setSent] = useState(false);
    const [name, setName] = useState('');
    const [note, setNote] = useState('');
    const [nameError, setNameError] = useState(false);
    const [bump, setBump] = useState(false);
    const prevCount = useRef(count);

    useEffect(() => {
        if (count > prevCount.current) {
            setBump(true);
            const t = setTimeout(() => setBump(false), 400);
            prevCount.current = count;
            return () => clearTimeout(t);
        }
        prevCount.current = count;
    }, [count]);

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

    const handleSend = () => {
        if (!name.trim()) {
            setNameError(true);
            return;
        }
        setNameError(false);
        sendOrderToWhatsApp({ items, total, name: name.trim(), note, hasConsultarItems });
        setSent(true);
    };

    const handleNewOrder = () => {
        clearCart();
        setName('');
        setNote('');
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
            <button className={`cart-fab ${bump ? 'cart-fab-bump' : ''}`} onClick={handleOpen}>
                🛒
                {items.length > 0 && <span className="cart-fab-count">{count}</span>}
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
                                    Si no se abrió solo, revisá que WhatsApp esté instalado.
                                </p>
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