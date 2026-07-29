import { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

/**
 * Selector por unidades (contador +/-). Lo usan Medialunas y Pastelería,
 * así que TODOS los textos salen de la categoría — nada de "Medialuna"
 * escrito a mano, porque si no la Pastelería sale rotulada como medialunas.
 */
function MedialunasSelector({ category }) {
    const { addItem, updateItem, editingItem, clearEdit } = useCart();
    const { estaAgotado } = useDisponibilidad();

    const categoryLabel = category.name;
    const categoryIcon = category.icon || '🛒';
    // "Medialuna de Manteca" → "Manteca" (solo si el producto repite el nombre
    // de la categoría en singular). En Pastelería no aplica y queda igual.
    const shortLabel = (label) =>
        label.replace(new RegExp(`^${categoryLabel.replace(/s$/i, '')} de `, 'i'), '');

    const initialCounts = useMemo(
        () => Object.fromEntries(category.products.map((p) => [p.id, 0])),
        [category]
    );

    const [counts, setCounts] = useState(initialCounts);
    const [toast, setToast] = useState(null);

    // Ojo: Medialunas y Pastelería comparten builderType, así que hay que
    // comparar también la categoría o al editar se abrirían las dos a la vez.
    const isEditing =
        editingItem?.builderType === 'medialunas' && editingItem?.categoryId === category.id;

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

    const sinStock = (product) => estaAgotado(category.id, product.id, product);

    const getSubtotal = (product) => {
        // Si se agotó mientras el cliente elegía, no se cobra ni se suma.
        if (sinStock(product)) return 0;
        const qty = counts[product.id];
        if (qty === 0) return 0;
        let subtotal = product.pricePerUnit * qty;
        if (product.discountAt && product.discountAmount && qty >= product.discountAt) {
            subtotal -= product.discountAmount;
        }
        return subtotal;
    };

    const total = category.products.reduce((sum, p) => sum + getSubtotal(p), 0);
    const totalUnits = category.products.reduce(
        (sum, p) => sum + (sinStock(p) ? 0 : counts[p.id] || 0),
        0
    );

    const handleSave = () => {
        const parts = category.products
            .filter((p) => counts[p.id] > 0 && !sinStock(p))
            .map((p) => `${shortLabel(p.label)} ×${counts[p.id]}`);
        const label = `${categoryLabel}: ${parts.join(', ')}`;

        // Esta línea del carrito puede tener varios productos distintos
        // (3 de manteca + 2 de jamón y queso). "componentes" los separa
        // para que cada uno cuente por su cuenta en las métricas.
        const componentes = category.products
            .filter((p) => !sinStock(p) && counts[p.id] > 0)
            .map((p) => ({
                cat: category.id,
                producto: p.id,
                nombre: p.label,
                cantidad: counts[p.id],
            }));

        const config = {
            counts: Object.fromEntries(
                category.products.map((p) => [p.id, sinStock(p) ? 0 : counts[p.id] || 0])
            ),
            componentes,
        };

        if (isEditing) {
            updateItem(editingItem.id, { label, unitPrice: total, config });
            clearEdit();
            showToast(`¡Pedido actualizado! ${categoryIcon}`);
        } else {
            addItem({
                categoryId: category.id,
                categoryName: category.name,
                builderType: 'medialunas',
                // Sin producto único: el desglose real va en config.componentes.
                productId: null,
                label,
                unitPrice: total,
                config,
            });
            showToast(`¡Agregado al pedido! ${categoryIcon}`);
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
                    <span>✏️ Editando tu pedido de {categoryLabel}</span>
                    <button className="builder-edit-cancel" onClick={handleCancelEdit}>Cancelar</button>
                </div>
            )}

            <div className="medialunas-table">
                {category.products.map((product) => {
                    const agotado = sinStock(product);
                    const qty = agotado ? 0 : counts[product.id];
                    const subtotal = getSubtotal(product);
                    const hasDiscount = !agotado && product.discountAt && product.discountAmount && qty >= product.discountAt;
                    return (
                        <div key={product.id}>
                            <div className={`medialuna-row ${agotado ? 'agotado' : ''}`}>
                                <div className="medialuna-info">
                                    <strong>{product.label}</strong>
                                    <span>{agotado ? 'Sin stock por hoy' : `${formatPrice(product.pricePerUnit)} c/u`}</span>
                                </div>
                                <div className="medialuna-counter">
                                    <button className="counter-btn" onClick={() => decrement(product.id)} disabled={agotado || qty === 0}>−</button>
                                    <input
                                        type="number"
                                        className="counter-input"
                                        value={qty}
                                        min="0"
                                        inputMode="numeric"
                                        disabled={agotado}
                                        onChange={(e) => handleInputChange(product.id, e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <button className="counter-btn" onClick={() => increment(product.id)} disabled={agotado}>+</button>
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

            {/* Total y botón siempre a la vista: la lista es larga y el
                total quedaba enterrado al final. */}
            <div className="builder-sticky-action">
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
        </div>
    );
}

export default MedialunasSelector;