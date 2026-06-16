import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { parsePrice } from '../data/menu';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function ProductCard({ item, category }) {
    const { addItem } = useCart();
    const [justAdded, setJustAdded] = useState(false);

    const sizes = [
        { key: 'medium', label: 'Mediano', raw: item.sizes?.medium },
        { key: 'large', label: 'Grande', raw: item.sizes?.large },
    ]
        .filter((s) => s.raw && s.raw !== 'N/A')
        .map((s) => ({ ...s, price: parsePrice(s.raw) }));

    const multiSize = sizes.length > 1;
    const [selectedKey, setSelectedKey] = useState(sizes[0]?.key || 'medium');
    const selected = sizes.find((s) => s.key === selectedKey) || sizes[0];

    const handleAdd = () => {
        if (!selected) return;
        const sizeLabel = multiSize ? ` (${selected.label})` : '';
        addItem({
            categoryId: category.id,
            categoryName: category.name,
            builderType: null,
            label: `${item.name}${sizeLabel}`,
            unitPrice: selected.price,
            mergeKey: `${category.id}:${item.id}:${selected.key}`,
        });
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1400);
    };

    return (
        <article className="product-card">
            <div className="product-badge-wrapper">
                <div className={`product-image product-image-${category.accent}`} />
            </div>

            <div className="product-content">
                <div>
                    <h4>{item.name}</h4>
                    <p>{item.description}</p>
                </div>

                {multiSize && (
                    <div className="size-options">
                        {sizes.map((s) => (
                            <button
                                key={s.key}
                                className={`size-option ${selectedKey === s.key ? 'selected' : ''}`}
                                onClick={() => setSelectedKey(s.key)}
                                type="button"
                            >
                                <span>{s.label}</span>
                                <strong>{s.price == null ? 'Consultar' : formatPrice(s.price)}</strong>
                            </button>
                        ))}
                    </div>
                )}

                {!multiSize && selected && (
                    <div className="single-price">
                        <strong>{selected.price == null ? 'Consultar' : formatPrice(selected.price)}</strong>
                    </div>
                )}

                <button className={`product-add-btn ${justAdded ? 'added' : ''}`} onClick={handleAdd} type="button">
                    {justAdded ? 'Agregado ✓' : 'Agregar 🛒'}
                </button>
            </div>
        </article>
    );
}

export default ProductCard;