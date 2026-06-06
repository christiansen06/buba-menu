import { useState } from 'react';
import { useCart } from '../context/CartContext';

function Cart() {
    const { items, total, removeItem, clearCart } = useCart();
    const [open, setOpen] = useState(false);

    const formatPrice = (price) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
        }).format(price);

    if (items.length === 0) return null;

    return (
        <>
            {/* BOTÓN FLOTANTE */}
            <button className="cart-fab" onClick={() => setOpen(true)}>
                🛒
                <span className="cart-fab-count">{items.length}</span>
            </button>

            {/* PANEL */}
            {open && (
                <>
                    <div className="cart-overlay" onClick={() => setOpen(false)} />

                    <div className="cart-panel">
                        <div className="cart-panel-header">
                            <h3>Tu pedido</h3>
                            <button className="cart-close-btn" onClick={() => setOpen(false)}>✕</button>
                        </div>

                        <div className="cart-items-list">
                            {items.map((item) => (
                                <div className="cart-item" key={item.id}>
                                    <div className="cart-item-info">
                                        <span className="cart-item-label">{item.label}</span>
                                        <span className="cart-item-price">{formatPrice(item.price)}</span>
                                    </div>
                                    <button
                                        className="cart-item-remove"
                                        onClick={() => removeItem(item.id)}
                                        aria-label="Eliminar item"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="cart-panel-footer">
                            <div className="cart-total-row">
                                <span className="cart-total-label">Total</span>
                                <span className="cart-total-price">{formatPrice(total)}</span>
                            </div>

                            <button className="cart-clear-btn" onClick={clearCart}>
                                Limpiar pedido
                            </button>

                            <p className="cart-hint">Mostrá este resumen en caja al momento de pagar 💜</p>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

export default Cart;