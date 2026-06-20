import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { promociones } from '../data/menu';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function PromoCard({ promo }) {
    const { addItem } = useCart();
    const [expanded, setExpanded] = useState(false);
    const [selections, setSelections] = useState({});
    const [justAdded, setJustAdded] = useState(false);

    const slots = promo.slots || [];
    const allSelected = slots.every((slot) => selections[slot.label]);

    const handleToggle = () => {
        if (justAdded) return;
        setExpanded((prev) => !prev);
        setSelections({});
    };

    const handleSelect = (slotLabel, option) => {
        setSelections((prev) => ({ ...prev, [slotLabel]: option }));
    };

    const handleConfirm = () => {
        if (!allSelected) return;
        const detail = slots.map((s) => selections[s.label]).join(' + ');
        addItem({
            categoryId: 'promociones',
            categoryName: 'Promociones',
            builderType: null,
            label: `🎉 ${promo.name} · ${detail}`,
            unitPrice: promo.price,
            mergeKey: null,
        });
        setJustAdded(true);
        setExpanded(false);
        setSelections({});
        setTimeout(() => setJustAdded(false), 1800);
    };

    return (
        <article className="promo-card">
            <div className="promo-badge">PROMO</div>
            <div className="promo-content">
                <h4>{promo.name}</h4>
                <p>{promo.description}</p>
                <div className="promo-footer">
          <span className="promo-price">
            {promo.price == null ? 'Consultar' : formatPrice(promo.price)}
          </span>
                    <button
                        className={`product-add-btn promo-add-btn ${justAdded ? 'added' : ''}`}
                        onClick={handleToggle}
                    >
                        {justAdded ? 'Agregado ✓' : expanded ? 'Cancelar' : 'Agregar 🛒'}
                    </button>
                </div>

                {expanded && slots.length > 0 && (
                    <div className="promo-slots">
                        {slots.map((slot) => (
                            <div className="promo-slot" key={slot.label}>
                                <span className="promo-slot-label">{slot.label}:</span>
                                <div className="promo-slot-options">
                                    {slot.options.map((opt) => (
                                        <button
                                            key={opt}
                                            className={`promo-slot-chip ${selections[slot.label] === opt ? 'selected' : ''}`}
                                            onClick={() => handleSelect(slot.label, opt)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <button
                            className="builder-add-btn promo-confirm-btn"
                            onClick={handleConfirm}
                            disabled={!allSelected}
                            style={{ opacity: allSelected ? 1 : 0.4 }}
                        >
                            {allSelected ? 'Confirmar 🛒' : 'Elegí todas las opciones'}
                        </button>
                    </div>
                )}
            </div>
        </article>
    );
}

function PromoSection() {
    if (!promociones || promociones.length === 0) return null;

    return (
        <section id="promociones" className="promo-section">
            <div className="promo-header">
                <span className="section-kicker promo-kicker">🎉 Promos</span>
                <h3>Combos especiales</h3>
                <p>Aprovechá estas combinaciones a precio especial</p>
            </div>
            <div className="promo-grid">
                {promociones.map((promo) => (
                    <PromoCard key={promo.id} promo={promo} />
                ))}
            </div>
        </section>
    );
}

export default PromoSection;