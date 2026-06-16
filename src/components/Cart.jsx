import { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function Cart() {
    const { items, total, count, hasConsultarItems, setQuantity, removeItem, clearCart, startEdit } = useCart();
    const [open, setOpen] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [bump, setBump] = useState(false);
    const prevCount = useRef(count);

    // Dispara el salto cada vez que se agrega un ítem
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
        setConfirmed(false);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setConfirmed(false);
    };

    const handleConfirm = () => setConfirmed(true);

    const handleNewOrder = () => {
        clearCart();
        setConfirmed(false);
        setOpen(false);
    };

    return (
        <>
            <button
                className={`cart-fab ${bump ? 'cart-fab-bump' : ''}`}
                onClick={handleOpen}
            >
                🛒
                {items.length > 0 && <span className="cart-fab-count">{count}</span>}
            </button>

            {open && (
                <>
                    <div className="cart-overlay" onClick={handleClose} />
                    <div className="cart-panel">

                        {confirmed ? (
                            <div className="cart-confirm">
                                <div className="cart-confirm-icon">✅</div>
                                <h3>¡Pedido listo!</h3>
                                <p>Mostrá esta pantalla en caja para pagar y retirar tu pedido.</p>
                                <div className="cart-confirm-summary">
                                    {items.map((item) => (
                                        <div className="cart-confirm-item" key={item.id}>
                                            <span>{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.label}</span>
                                            <span>{item.unitPrice == null ? 'A consultar' : formatPrice(item.unitPrice * item.quantity)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="cart-confirm-total">
                                    <span>Total</span>
                                    <strong>{formatPrice(total)}</strong>
                                </div>
                                {hasConsultarItems && (
                                    <p className="cart-consultar-note">Algunos ítems se cotizan en el mostrador</p>
                                )}
                                <button className="builder-add-btn" onClick={handleNewOrder}>Hacer un nuevo pedido</button>
                                <button className="cart-clear-btn" onClick={() => setConfirmed(false)}>Volver y seguir editando</button>
                            </div>

                        ) : items.length === 0 ? (
                            <div className="cart-empty">
                                <div className="cart-empty-icon">🧋</div>
                                <h3>Todavía no agregaste nada</h3>
                                <p>Explorá el menú y armá tu pedido — vas a poder revisarlo acá antes de pagar.</p>
                                <button className="builder-add-btn" onClick={handleClose}>Explorar el menú 👆</button>
                            </div>

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
                                    <button className="builder-add-btn" onClick={handleConfirm}>Finalizar pedido ✓</button>
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