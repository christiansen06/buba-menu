import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { parsePrice } from '../data/menu';
import { getProductImage } from '../utils/productImages.js';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';
import ExtrasPicker from './ExtrasPicker.jsx';
import { resumenExtras, precioConExtras } from '../utils/extras.js';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function ProductCard({ item, category }) {
    const { addItem } = useCart();
    const [justAdded, setJustAdded] = useState(false);

    // Agotado si lo marcaste desde el panel, o si el producto dice
    // disponible: false en menu.js. Si no dice nada, hay stock.
    const { estaAgotado } = useDisponibilidad();
    const agotado = estaAgotado(category.id, item.id, item);

    const sizes = [
        { key: 'medium', label: 'Mediano', raw: item.sizes?.medium },
        { key: 'large', label: 'Grande', raw: item.sizes?.large },
    ]
        .filter((s) => s.raw && s.raw !== 'N/A')
        .map((s) => ({ ...s, price: parsePrice(s.raw) }));

    const multiSize = sizes.length > 1;
    const [selectedKey, setSelectedKey] = useState(sizes[0]?.key || 'medium');
    const selected = sizes.find((s) => s.key === selectedKey) || sizes[0];

    const [extrasElegidos, setExtrasElegidos] = useState([]);
    const extras = resumenExtras(category.extras, extrasElegidos);

    const toggleExtra = (id) =>
        setExtrasElegidos((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    const handleAdd = () => {
        if (!selected || agotado) return;
        const sizeLabel = multiSize ? ` (${selected.label})` : '';
        addItem({
            categoryId: category.id,
            categoryName: category.name,
            builderType: null,
            // productId y variante son los que se guardan en la base:
            // sin ellos el pedido queda sólo como texto y no se puede contar.
            productId: item.id,
            variante: selected.key,
            label: `${item.name}${sizeLabel}${extras.sufijoLabel}`,
            unitPrice: precioConExtras(selected.price, extras.precioExtra),
            mergeKey: `${category.id}:${item.id}:${selected.key}${extras.sufijoMerge}`,
            config: extras.config,
        });
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1400);
    };

    const photo = getProductImage(item, category.id);

    return (
        <article className={`product-card ${agotado ? 'agotado' : ''}`}>
            <div className="product-badge-wrapper">
                {photo ? (
                    <img className="product-image product-photo" src={photo} alt={item.name} loading="lazy" />
                ) : (
                    <div className={`product-image product-image-${category.accent}`} />
                )}
                {agotado && <span className="agotado-tag">Sin stock</span>}
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

                {!agotado && (
                    <ExtrasPicker
                        extras={category.extras}
                        seleccionados={extrasElegidos}
                        onToggle={toggleExtra}
                    />
                )}

                <button
                    className={`product-add-btn ${justAdded ? 'added' : ''}`}
                    onClick={handleAdd}
                    type="button"
                    disabled={agotado}
                >
                    {agotado ? 'Sin stock' : justAdded ? 'Agregado ✓' : 'Agregar 🛒'}
                </button>
            </div>
        </article>
    );
}

export default ProductCard;