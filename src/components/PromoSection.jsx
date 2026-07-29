import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { promociones, buscarProducto, opcionesDeSlot, fijosDePromo } from '../data/menu';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function PromoCard({ promo }) {
    const { addItem } = useCart();
    const { estaAgotado } = useDisponibilidad();
    const [expanded, setExpanded] = useState(false);
    const [selections, setSelections] = useState({});
    const [justAdded, setJustAdded] = useState(false);

    // Un componente de promo está agotado si lo está el producto real
    // al que apunta. Si el producto no existe (id viejo o mal escrito),
    // lo tratamos como agotado en vez de vender algo que no está.
    const componenteAgotado = (c) => {
        const p = buscarProducto(c.cat, c.producto);
        if (!p) return true;
        return estaAgotado(c.cat, c.producto, p);
    };

    const fijos = fijosDePromo(promo);
    const fijosOk = fijos.every((f) => !componenteAgotado(f));

    // Cada slot resuelto, con sus opciones marcadas como disponibles o no.
    const slots = (promo.slots || []).map((slot) => {
        const opciones = opcionesDeSlot(slot).map((o) => ({
            ...o,
            agotada: o.productos.some(componenteAgotado),
        }));
        return { ...slot, opciones, hayAlguna: opciones.some((o) => !o.agotada) };
    });

    // La promo se cae si falta algo fijo o si un slot se quedó sin ninguna
    // opción posible: no tiene sentido ofrecer un combo que no se puede armar.
    const promoDisponible = fijosOk && slots.every((s) => s.hayAlguna);

    const elegidas = slots.map((s) => s.opciones.find((o) => o.id === selections[s.label]));
    const allSelected = elegidas.every((o) => o && !o.agotada);

    const handleToggle = () => {
        if (justAdded || !promoDisponible) return;
        setExpanded((prev) => !prev);
        setSelections({});
    };

    const handleSelect = (slotLabel, opcion) => {
        if (opcion.agotada) return;
        setSelections((prev) => ({ ...prev, [slotLabel]: opcion.id }));
    };

    const handleConfirm = () => {
        if (!allSelected || !promoDisponible) return;

        const detail = elegidas.map((o) => o.label).join(' + ');

        // Desglose real de la promo: qué productos salieron por la ventana.
        // Es lo que después permite contar un cappuccino vendido dentro de
        // un combo igual que uno vendido suelto.
        const componentes = [
            ...fijos,
            ...elegidas.flatMap((o) => o.productos),
        ].map((c) => ({ ...c, cantidad: 1 }));

        addItem({
            categoryId: 'promociones',
            categoryName: 'Promociones',
            builderType: null,
            productId: promo.id,
            label: `🎉 ${promo.name} · ${detail}`,
            unitPrice: promo.price,
            mergeKey: null,
            config: {
                promoId: promo.id,
                elecciones: Object.fromEntries(slots.map((s, i) => [s.label, elegidas[i].id])),
                componentes,
            },
        });

        setJustAdded(true);
        setExpanded(false);
        setSelections({});
        setTimeout(() => setJustAdded(false), 1800);
    };

    // Si falta algo fijo conviene decir qué, así sabés qué reponer.
    const faltante = fijos.find(componenteAgotado);

    return (
        <article className={`promo-card ${promoDisponible ? '' : 'promo-agotada'}`}>
            <div className="promo-badge">{promoDisponible ? 'PROMO' : 'SIN STOCK'}</div>
            <div className="promo-content">
                <h4>{promo.name}</h4>
                <p>{promo.description}</p>
                {!promoDisponible && (
                    <p className="promo-sin-stock-aviso">
                        {faltante
                            ? `Hoy no hay ${faltante.nombre}`
                            : 'Nos quedamos sin una de las opciones de este combo'}
                    </p>
                )}
                <div className="promo-footer">
          <span className="promo-price">
            {promo.price == null ? 'Consultar' : formatPrice(promo.price)}
          </span>
                    <button
                        className={`product-add-btn promo-add-btn ${justAdded ? 'added' : ''}`}
                        onClick={handleToggle}
                        disabled={!promoDisponible}
                    >
                        {!promoDisponible ? 'Sin stock' : justAdded ? 'Agregado ✓' : expanded ? 'Cancelar' : 'Agregar 🛒'}
                    </button>
                </div>

                {expanded && slots.length > 0 && (
                    <div className="promo-slots">
                        {slots.map((slot) => (
                            <div className="promo-slot" key={slot.label}>
                                <span className="promo-slot-label">{slot.label}:</span>
                                <div className="promo-slot-options">
                                    {slot.opciones.map((opt) => (
                                        <button
                                            key={opt.id}
                                            className={`promo-slot-chip ${selections[slot.label] === opt.id ? 'selected' : ''} ${opt.agotada ? 'chip-sin-stock' : ''}`}
                                            onClick={() => handleSelect(slot.label, opt)}
                                            disabled={opt.agotada}
                                        >
                                            {opt.label}
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
