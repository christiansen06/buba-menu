import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import StepProgress from './StepProgress';
import { getProductImage } from '../utils/productImages.js';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const OPTION_EMOJI = {
    helado: '🍦', ddl: '🍯', crema: '🥛', nutella: '🍫',
    banana: '🍌', frutilla: '🍓', durazno: '🍑', oreo: '🍪', chocolinas: '🍫',
    chocolate: '🍫', caramelo: '🍮', pistacho: '🥜',
};
const emojiFor = (id) => OPTION_EMOJI[id] || '🧇';

const MAX_RELLENOS = 2;
const MAX_TOPPINGS = 3; // hasta 3 toppings, mixto desde 2
const MAX_SALSAS = 2;

/** Mixto si hay 2+ en cualquier categoría, o Nutella (relleno o salsa). */
function computeIsMixto(rellenos, toppings, salsas) {
    const hasNutellaRelleno = rellenos.some((r) => r.type === 'nutella');
    const hasNutellaSalsa = salsas.includes('nutella');
    return (
        rellenos.length >= 2 ||
        toppings.length >= 2 ||
        salsas.length >= 2 ||
        hasNutellaRelleno ||
        hasNutellaSalsa
    );
}

/**
 * Básico: exactamente 1 relleno, sin toppings ni salsas.
 * Nutella queda afuera porque fuerza Mixto (es más cara).
 * Opción pensada para clientes con presupuesto más acotado.
 */
function computeIsBasico(rellenos, toppings, salsas) {
    if (computeIsMixto(rellenos, toppings, salsas)) return false;
    return rellenos.length === 1 && toppings.length === 0 && salsas.length === 0;
}

/** Nivel actual del waffle: 'basico' | 'simple' | 'mixto'. */
function computeTier(rellenos, toppings, salsas) {
    if (computeIsMixto(rellenos, toppings, salsas)) return 'mixto';
    if (computeIsBasico(rellenos, toppings, salsas)) return 'basico';
    return 'simple';
}

const TIER_LABEL = { basico: 'Básico', simple: 'Simple', mixto: 'Mixto' };

function computeWafflePrice(category, rellenos, toppings, salsas) {
    const hasNutellaRelleno = rellenos.some((r) => r.type === 'nutella');
    const hasNutellaSalsa = salsas.includes('nutella');
    const doubleNutella = hasNutellaRelleno && hasNutellaSalsa;
    const tier = computeTier(rellenos, toppings, salsas);

    // Si no hay precio de básico configurado, cae a simple (compatibilidad).
    let p = category.price[tier] ?? category.price.simple;
    if (doubleNutella) p += category.nutellaSaucePrice ?? 500;
    return p;
}

function OptionTile({ emoji, img, name, selected, disabled, onClick, tag }) {
    return (
        <button
            type="button"
            className={`option-tile ${selected ? 'selected' : ''} ${disabled ? 'option-disabled' : ''}`}
            onClick={() => !disabled && onClick()}
            disabled={disabled}
        >
      <span className="option-circle">
        {img ? <img src={img} alt={name} className="option-img" /> : emoji}
      </span>
            <span className="option-name">{name}{tag ? ` ${tag}` : ''}</span>
        </button>
    );
}

function WaffleBuilder({ category }) {
    const { addItem, updateItem, editingItem, clearEdit } = useCart();
    const { opcionAgotada } = useDisponibilidad();

    const [mode, setMode] = useState('preset');
    const [selectedRellenos, setSelectedRellenos] = useState([]);
    const [selectedToppings, setSelectedToppings] = useState([]);
    const [selectedSalsas, setSelectedSalsas] = useState([]);
    const [heladoPickerOpen, setHeladoPickerOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const isEditing = editingItem?.builderType === 'waffle';

    const hasNutellaRelleno = selectedRellenos.some((r) => r.type === 'nutella');
    const hasNutellaSalsa = selectedSalsas.includes('nutella');
    const doubleNutella = hasNutellaRelleno && hasNutellaSalsa;
    const isMixto = computeIsMixto(selectedRellenos, selectedToppings, selectedSalsas);
    const tier = computeTier(selectedRellenos, selectedToppings, selectedSalsas);
    const isBasico = tier === 'basico';
    const price = computeWafflePrice(category, selectedRellenos, selectedToppings, selectedSalsas);

    const showUpsell = !isMixto;

    const currentWaffleStep =
        selectedRellenos.length === 0 ? 1 :
            selectedToppings.length === 0 ? 2 : 3;

    useEffect(() => {
        if (isEditing && editingItem.config) {
            setMode('build');
            setSelectedRellenos(editingItem.config.rellenos || []);
            setSelectedToppings(editingItem.config.toppings || []);
            setSelectedSalsas(editingItem.config.salsas || []);
        }
    }, [editingItem]); // eslint-disable-line

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    };

    const reset = () => {
        setSelectedRellenos([]);
        setSelectedToppings([]);
        setSelectedSalsas([]);
        setHeladoPickerOpen(false);
    };

    const removeRelleno = (id) => setSelectedRellenos((prev) => prev.filter((r) => r.id !== id));

    const toggleSimpleRelleno = (opt) => {
        setHeladoPickerOpen(false);
        const existing = selectedRellenos.find((r) => r.type === opt.id);
        if (existing) return removeRelleno(existing.id);
        if (selectedRellenos.length >= MAX_RELLENOS) return;
        setSelectedRellenos((prev) => [...prev, { id: opt.id, type: opt.id, label: opt.label }]);
    };

    const addHeladoFlavor = (flavor) => {
        if (selectedRellenos.length >= MAX_RELLENOS) return;
        setSelectedRellenos((prev) => [
            ...prev,
            { id: `helado-${flavor.id}-${Date.now()}`, type: 'helado', flavor: flavor.id, label: `Helado ${flavor.label}` },
        ]);
        setHeladoPickerOpen(false);
    };

    // Toppings: siempre se puede elegir hasta 2, sin importar el tier actual
    const toggleTopping = (id) => {
        setSelectedToppings((prev) => {
            if (prev.includes(id)) return prev.filter((t) => t !== id);
            if (prev.length >= MAX_TOPPINGS) return prev;
            return [...prev, id];
        });
    };

    // Salsas: siempre se puede elegir hasta 2
    const toggleSalsa = (id) => {
        setSelectedSalsas((prev) => {
            if (prev.includes(id)) return prev.filter((s) => s !== id);
            if (prev.length >= MAX_SALSAS) return prev;
            return [...prev, id];
        });
    };

    const toppingLabel = (id) => category.toppings.find((t) => t.id === id)?.label || id;
    const salsaLabel = (id) => category.salsas.find((s) => s.id === id)?.label || id;

    const handleSave = () => {
        const rell = selectedRellenos.length ? selectedRellenos.map((r) => r.label).join(' + ') : 'sin relleno';
        const tops = selectedToppings.length ? selectedToppings.map(toppingLabel).join(', ') : 'sin topping';
        const sal = selectedSalsas.length
            ? selectedSalsas.map((id) => (id === 'nutella' && doubleNutella ? 'Nutella (doble)' : salsaLabel(id))).join(', ')
            : 'sin salsa';
        const label = `Waffle ${TIER_LABEL[tier]} · ${rell} · ${tops} · ${sal}`;
        const config = { rellenos: selectedRellenos, toppings: selectedToppings, salsas: selectedSalsas };

        if (isEditing) {
            updateItem(editingItem.id, { label, unitPrice: price, config });
            clearEdit();
            showToast('¡Pedido actualizado! 🧇');
        } else {
            addItem({
                categoryId: category.id,
                categoryName: category.name,
                builderType: 'waffle',
                // "armado" = lo armó el cliente desde cero. Los que salen de
                // un preset guardan el id del preset, así se pueden separar.
                productId: 'armado',
                variante: tier,
                label,
                unitPrice: price,
                config,
            });
            showToast('¡Agregado al pedido! 🧇');
        }
        reset();
    };

    const handleCancelEdit = () => {
        clearEdit();
        reset();
        setMode('preset');
    };

    const addPreset = (preset) => {
        const cfg = preset.config;
        const rell = cfg.rellenos.length ? cfg.rellenos.map((r) => r.label).join(' + ') : 'sin relleno';
        const tops = cfg.toppings.length ? cfg.toppings.map(toppingLabel).join(', ') : 'sin topping';
        const hasNR = cfg.rellenos.some((r) => r.type === 'nutella');
        const sal = cfg.salsas.length
            ? cfg.salsas.map((id) => (id === 'nutella' && hasNR ? 'Nutella (doble)' : salsaLabel(id))).join(', ')
            : 'sin salsa';
        const presetTier = computeTier(cfg.rellenos, cfg.toppings, cfg.salsas);
        const label = `${preset.name} (Waffle ${TIER_LABEL[presetTier]} · ${rell} · ${tops} · ${sal})`;

        addItem({
            categoryId: category.id,
            categoryName: category.name,
            builderType: 'waffle',
            productId: preset.id,
            variante: presetTier,
            label,
            unitPrice: computeWafflePrice(category, cfg.rellenos, cfg.toppings, cfg.salsas),
            config: cfg,
        });
        showToast('¡Agregado al pedido! 🧇');
    };

    const toppingGroups = category.toppings.reduce((acc, t) => {
        (acc[t.group] = acc[t.group] || []).push(t);
        return acc;
    }, {});

    const canSave = selectedRellenos.length >= 1;

    return (
        <div className="builder-wrapper">
            {toast && <div className="builder-toast">{toast}</div>}

            {isEditing && (
                <div className="builder-edit-banner">
                    <span>✏️ Editando tu waffle</span>
                    <button className="builder-edit-cancel" onClick={handleCancelEdit}>Cancelar</button>
                </div>
            )}

            {!isEditing && (
                <div className="waffle-tabs">
                    <button className={`waffle-tab ${mode === 'preset' ? 'active' : ''}`} onClick={() => setMode('preset')}>
                        🧇 Elegí uno listo
                    </button>
                    <button className={`waffle-tab ${mode === 'build' ? 'active' : ''}`} onClick={() => setMode('build')}>
                        ✨ Armá el tuyo
                    </button>
                </div>
            )}

            {/* PRESETS */}
            {mode === 'preset' && !isEditing && (
                <div className="preset-list">
                    {category.presets.map((preset) => {
                        // Ojo: los presets reusan ids de sabor ("frutilla", "oreo") que ya
                        // existen en Bubble Tea. Buscamos SOLO por nombre completo ("Waffle
                        // Oreo") para no terminar mostrando por error la foto del bubble tea.
                        const presetPhoto = getProductImage({ name: preset.name }, category.id);
                        return (
                        <article className="preset-card" key={preset.id}>
                            <div className="preset-top">
                                {presetPhoto ? (
                                    <img className="preset-image product-photo" src={presetPhoto} alt={preset.name} loading="lazy" />
                                ) : (
                                    <div className="preset-image product-image-pink" />
                                )}
                                <div className="preset-info">
                                    <h4>{preset.name}</h4>
                                    <p>{preset.description}</p>
                                    <span className="preset-price">
                    {formatPrice(computeWafflePrice(category, preset.config.rellenos, preset.config.toppings, preset.config.salsas))}
                  </span>
                                </div>
                            </div>
                            <button className="product-add-btn preset-add" onClick={() => addPreset(preset)}>
                                Agregar 🛒
                            </button>
                        </article>
                        );
                    })}
                </div>
            )}

            {/* ARMAR */}
            {(mode === 'build' || isEditing) && (
                <div className="waffle-build">
                    <StepProgress current={currentWaffleStep} total={3} />

                    {/* RELLENOS */}
                    <div className="builder-step active">
                        <div className="builder-step-header">
                            <div className="builder-step-title">
                                <span className="builder-step-number">1</span>
                                <span>Relleno {selectedRellenos.length}/{MAX_RELLENOS}</span>
                            </div>
                        </div>
                        <div className="builder-step-body">
                            {selectedRellenos.length > 0 && (
                                <div className="relleno-pills">
                                    {selectedRellenos.map((r) => (
                                        <span className="relleno-pill" key={r.id}>
                      {r.label}
                                            <button className="relleno-pill-remove" onClick={() => removeRelleno(r.id)}>✕</button>
                    </span>
                                    ))}
                                </div>
                            )}

                            <div className="option-tiles">
                                <OptionTile
                                    emoji={emojiFor('helado')}
                                    name="Helado"
                                    selected={heladoPickerOpen}
                                    disabled={selectedRellenos.length >= MAX_RELLENOS}
                                    onClick={() => setHeladoPickerOpen((o) => !o)}
                                />
                                {category.rellenos.filter((r) => r.id !== 'helado').map((opt) => {
                                    const selected = !!selectedRellenos.find((r) => r.type === opt.id);
                                    const sinStock = opcionAgotada(category.id, 'rellenos', opt.id);
                                    const disabled = sinStock || (!selected && selectedRellenos.length >= MAX_RELLENOS);
                                    return (
                                        <OptionTile
                                            key={opt.id}
                                            emoji={emojiFor(opt.id)}
                                            name={opt.label}
                                            tag={sinStock ? 'sin stock' : (opt.forcesMixto ? '✨' : '')}
                                            selected={selected}
                                            disabled={disabled}
                                            onClick={() => !sinStock && toggleSimpleRelleno(opt)}
                                        />
                                    );
                                })}
                            </div>

                            {heladoPickerOpen && (
                                <div className="helado-picker">
                                    <p className="builder-counter">Elegí el sabor del helado:</p>
                                    <div className="builder-chips">
                                        {category.heladoFlavors.map((flavor) => {
                                            const sinStock = opcionAgotada(category.id, 'heladoFlavors', flavor.id);
                                            return (
                                                <button
                                                    key={flavor.id}
                                                    className={`builder-chip builder-chip-pink ${sinStock ? 'chip-sin-stock' : ''}`}
                                                    onClick={() => !sinStock && addHeladoFlavor(flavor)}
                                                    disabled={sinStock}
                                                >
                                                    {flavor.label}{sinStock ? ' · sin stock' : ''}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* TOPPINGS — siempre hasta 2 disponibles */}
                    <div className={`builder-step ${!canSave ? 'disabled' : 'active'}`}>
                        <div className="builder-step-header">
                            <div className="builder-step-title">
                                <span className="builder-step-number">2</span>
                                <span>Toppings {selectedToppings.length}/{MAX_TOPPINGS} <span className="opcional-tag">opcional</span></span>
                            </div>
                        </div>
                        <div className="builder-step-body">
                            {Object.entries(toppingGroups).map(([group, items]) => (
                                <div key={group}>
                                    <p className="topping-group-label">{group}</p>
                                    <div className="option-tiles">
                                        {items.map((t) => {
                                            const selected = selectedToppings.includes(t.id);
                                            const sinStock = opcionAgotada(category.id, 'toppings', t.id);
                                            const disabled = sinStock || (!selected && selectedToppings.length >= MAX_TOPPINGS);
                                            return (
                                                <OptionTile
                                                    key={t.id}
                                                    emoji={emojiFor(t.id)}
                                                    name={t.label}
                                                    tag={sinStock ? 'sin stock' : ''}
                                                    selected={selected}
                                                    disabled={disabled}
                                                    onClick={() => !sinStock && toggleTopping(t.id)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SALSAS — siempre hasta 2 disponibles */}
                    <div className={`builder-step ${!canSave ? 'disabled' : 'active'}`}>
                        <div className="builder-step-header">
                            <div className="builder-step-title">
                                <span className="builder-step-number">3</span>
                                <span>Salsas {selectedSalsas.length}/{MAX_SALSAS} <span className="opcional-tag">opcional</span></span>
                            </div>
                        </div>
                        <div className="builder-step-body">
                            <div className="option-tiles">
                                {category.salsas.map((s) => {
                                    const selected = selectedSalsas.includes(s.id);
                                    const sinStock = opcionAgotada(category.id, 'salsas', s.id);
                                    const disabled = sinStock || (!selected && selectedSalsas.length >= MAX_SALSAS);
                                    const tag = sinStock
                                        ? 'sin stock'
                                        : (s.id === 'nutella' && selected && hasNutellaRelleno) ? '(doble)' : (s.forcesMixto ? '✨' : '');
                                    return (
                                        <OptionTile
                                            key={s.id}
                                            emoji={emojiFor(s.id)}
                                            name={s.label}
                                            tag={tag}
                                            selected={selected}
                                            disabled={disabled}
                                            onClick={() => !sinStock && toggleSalsa(s.id)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Banners de tier — debajo de todo, reflejan el estado actual */}
                    {isBasico && category.price.basico != null && (
                        <div className="waffle-tier-banner upsell">
                            💰 Tu waffle es <strong>Básico</strong> (solo relleno). Agregá un topping o una salsa y pasa a <strong>Simple</strong> por {formatPrice(category.price.simple - category.price.basico)} más
                        </div>
                    )}
                    {showUpsell && !isBasico && (
                        <div className="waffle-tier-banner upsell">
                            💡 Elegí un 2° relleno, topping o salsa y tu waffle pasa a ser <strong>Mixto</strong> automáticamente por solo {formatPrice(category.price.mixto - category.price.simple)} más
                        </div>
                    )}
                    {isMixto && (
                        <div className="waffle-tier-banner mixto">
                            ✨ Tu waffle es <strong>Mixto</strong>: podés elegir hasta 2 rellenos, 2 toppings y 2 salsas
                            {doubleNutella && <> · Doble Nutella (+{formatPrice(category.nutellaSaucePrice ?? 500)})</>}
                        </div>
                    )}

                    <div className="waffle-price-row">
                        <span>Total ({TIER_LABEL[tier]})</span>
                        <strong>{formatPrice(price)}</strong>
                    </div>

                    <button
                        className="builder-add-btn"
                        onClick={handleSave}
                        disabled={!canSave}
                        style={{ opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'not-allowed' }}
                    >
                        {!canSave ? 'Elegí al menos un relleno' : isEditing ? 'Guardar cambios ✓' : 'Agregar al pedido 🛒'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default WaffleBuilder;