import { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function MedialunasSelector({ category }) {
    const { addItem, updateItem, editingItem, clearEdit } = useCart();

    const initialCounts = useMemo(
        () => Object.fromEntries(category.products.map((p) => [p.id, 0])),
        [category]
    );

    const [counts, setCounts] = useState(initialCounts);
    const [toast, setToast] = useState(null);

    const isEditing = editingItem?.builderType === 'medialunas';

    useEffect(() => {
        if (isEditing && editingItem.config) {
            setCounts({ ...initialCounts, ...editingItem.config.counts });
        }
    }, [editingItem]); // eslint-disable-line

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    };

    const increment = (id) => setCounts((p) => ({ ...p, [id]: p[id] + 1 }));
    const decrement = (id) => setCounts((p) => ({ ...p, [id]: Math.max(0, p[id] - 1) }));

    // Permite escribir la cantidad directamente
    const handleInputChange = (id, value) => {
        if (value === '') {
            setCounts((p) => ({ ...p, [id]: 0 }));
            return;
        }
        const num = parseInt(value, 10);
        if (Number.isNaN(num) || num < 0) return;
        setCounts((p) => ({ ...p, [id]: num }));
    };

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

    const handleSave = () => {
        const parts = category.products
            .filter((p) => counts[p.id] > 0)
            .map((p) => `${p.label.replace('Medialuna de ', '')} ×${counts[p.id]}`);
        const label = `Medialunas: ${parts.join(', ')}`;
        const config = { counts: { ...counts } };

        if (isEditing) {
            updateItem(editingItem.id, { label, unitPrice: total, config });
            clearEdit();
            showToast('¡Pedido actualizado! 🥐');
        } else {
            addItem({
                categoryId: category.id,
                categoryName: category.name,
                builderType: 'medialunas',
                label,
                unitPrice: total,
                config,
            });
            showToast('¡Agregado al pedido! 🥐');
        }
        setCounts(initialCounts);
    };

    const handleCancelEdit = () => {
        clearEdit();
        setCounts(initialCounts);
    };

    return (
        <div className="builder-wrapper">
            {toast && <div className="builder-toast">{toast}</div>}

            {isEditing && (
                <div className="builder-edit-banner">
                    <span>✏️ Editando tus medialunas</span>
                    <button className="builder-edit-cancel" onClick={handleCancelEdit}>Cancelar</button>
                </div>
            )}

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
                                    <button className="counter-btn" onClick={() => decrement(product.id)} disabled={qty === 0}>−</button>
                                    <input
                                        type="number"
                                        className="counter-input"
                                        value={qty}
                                        min="0"
                                        inputMode="numeric"
                                        onChange={(e) => handleInputChange(product.id, e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <button className="counter-btn" onClick={() => increment(product.id)}>+</button>
                                </div>
                                <span className="medialuna-subtotal">{qty > 0 ? formatPrice(subtotal) : '—'}</span>
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
                onClick={handleSave}
                disabled={totalUnits === 0}
                style={{ opacity: totalUnits === 0 ? 0.4 : 1, cursor: totalUnits === 0 ? 'not-allowed' : 'pointer' }}
            >
                {isEditing ? 'Guardar cambios ✓' : 'Agregar al pedido 🛒'}
            </button>
        </div>
    );
}

export default MedialunasSelector;