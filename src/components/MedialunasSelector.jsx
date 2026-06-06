import { useState } from 'react';
import { useCart } from '../context/CartContext';

function MedialunasSelector({ category }) {
    const { addItem } = useCart();

    const initialCounts = Object.fromEntries(category.products.map((p) => [p.id, 0]));
    const [counts, setCounts] = useState(initialCounts);
    const [toast, setToast] = useState(false);

    const showToast = () => {
        setToast(true);
        setTimeout(() => setToast(false), 2000);
    };

    const increment = (id) => setCounts((prev) => ({ ...prev, [id]: prev[id] + 1 }));
    const decrement = (id) => setCounts((prev) => ({ ...prev, [id]: Math.max(0, prev[id] - 1) }));

    const getSubtotal = (product) => {
        const qty = counts[product.id];
        if (qty === 0) return 0;
        let subtotal = product.pricePerUnit * qty;
        if (product.discountAt && product.discountAmount && qty >= product.discountAt) {
            subtotal -= product.discountAmount;
        }
        return subtotal;
    };

    const total = category.products.reduce((sum, p) => sum + getSubtotal(p), 0);
    const totalUnits = Object.values(counts).reduce((sum, v) => sum + v, 0);

    const formatPrice = (price) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
        }).format(price);

    const handleAddToCart = () => {
        category.products.forEach((product) => {
            const qty = counts[product.id];
            if (qty === 0) return;
            addItem({
                id: `${product.id}-${Date.now()}`,
                categoryId: category.id,
                categoryName: category.name,
                label: `${product.label} × ${qty}`,
                price: getSubtotal(product),
            });
        });
        showToast();
        setCounts(initialCounts);
    };

    return (
        <div className="builder-wrapper">
            {toast && <div className="builder-toast">¡Agregado al pedido! 🥐</div>}

            <div className="medialunas-table">
                {category.products.map((product) => {
                    const qty = counts[product.id];
                    const subtotal = getSubtotal(product);
                    const hasDiscount = product.discountAt && product.discountAmount && qty >= product.discountAt;

                    return (
                        <div key={product.id}>
                            <div className="medialuna-row">
                                <div className="medialuna-info">
                                    <strong>{product.label}</strong>
                                    <span>{formatPrice(product.pricePerUnit)} c/u</span>
                                </div>

                                <div className="medialuna-counter">
                                    <button
                                        className="counter-btn"
                                        onClick={() => decrement(product.id)}
                                        disabled={qty === 0}
                                    >
                                        −
                                    </button>
                                    <span className="counter-value">{qty}</span>
                                    <button
                                        className="counter-btn"
                                        onClick={() => increment(product.id)}
                                    >
                                        +
                                    </button>
                                </div>

                                <span className="medialuna-subtotal">
                  {qty > 0 ? formatPrice(subtotal) : '—'}
                </span>
                            </div>

                            {hasDiscount && (
                                <div className="discount-banner">
                                    🎉 ¡Descuento aplicado! −{formatPrice(product.discountAmount)} por llevar {product.discountAt} o más
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="medialunas-total-row">
                <span className="medialunas-total-label">Total</span>
                <span className="medialunas-total-price">{formatPrice(total)}</span>
            </div>

            <button
                className="builder-add-btn"
                onClick={handleAddToCart}
                disabled={totalUnits === 0}
                style={{ opacity: totalUnits === 0 ? 0.4 : 1, cursor: totalUnits === 0 ? 'not-allowed' : 'pointer' }}
            >
                Agregar al pedido 🛒
            </button>
        </div>
    );
}

export default MedialunasSelector;