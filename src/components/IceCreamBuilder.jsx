import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';
import StepProgress from './StepProgress';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const TOTAL_STEPS = 4;

function IceCreamBuilder({ category }) {
    const { addItem, updateItem, editingItem, clearEdit } = useCart();
    const { opcionAgotada } = useDisponibilidad();

    const [step, setStep] = useState(1);
    const [selectedSize, setSelectedSize] = useState(null);
    const [selectedFlavors, setSelectedFlavors] = useState([]);
    const [selectedSauces, setSelectedSauces] = useState([]);
    const [selectedCup, setSelectedCup] = useState(null);
    const [toast, setToast] = useState(null);

    const isEditing = editingItem?.builderType === 'icecream';
    const maxFlavors = selectedSize ? parseInt(selectedSize.id) : 0;
    const is3Bochas = selectedSize?.id === '3';

    // Si son 3 bochas, vasito ecológico automático (variable derivada, sin setState)
    const effectiveCup = is3Bochas
        ? category.cupTypes.find((c) => c.id === 'papel') || selectedCup
        : selectedCup;

    useEffect(() => {
        if (isEditing && editingItem.config) {
            const cfg = editingItem.config;
            setSelectedSize(category.sizes.find((s) => s.id === cfg.sizeId) || null);
            // Ojo: acá antes había un filter sobre el catálogo, que colapsaba los
            // repetidos: un helado de 3 chocolates volvía de la edición con 1.
            setSelectedFlavors(
                (cfg.flavorIds || [])
                    .map((id, i) => {
                        const f = category.flavors.find((x) => x.id === id);
                        return f ? { uid: `${id}-${i}`, id: f.id, label: f.label } : null;
                    })
                    .filter(Boolean)
            );
            setSelectedSauces(category.sauces.filter((s) => cfg.sauceIds.includes(s.id)));
            setSelectedCup(category.cupTypes.find((c) => c.id === cfg.cupId) || null);
            setStep(4);
        }
    }, [editingItem]); // eslint-disable-line

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    };

    const reset = () => {
        setStep(1);
        setSelectedSize(null);
        setSelectedFlavors([]);
        setSelectedSauces([]);
        setSelectedCup(null);
    };

    const handleSizeSelect = (size) => {
        setSelectedSize(size);
        setSelectedFlavors([]);
        setStep(2);
    };

    /**
     * Cada toque SUMA una bocha de ese sabor.
     *
     * Antes esto era un interruptor: tocar un sabor ya elegido lo sacaba, así
     * que pedir tres bochas de chocolate era imposible y en el mostrador había
     * que inventar sabores para completar el pedido. Ahora se repite sin
     * problema y se saca desde las píldoras de abajo.
     *
     * uid es sólo para distinguir bochas del mismo sabor entre sí (React las
     * necesita para la key, y hace falta para poder borrar una sola).
     */
    const addFlavor = (flavor) => {
        setSelectedFlavors((prev) => {
            if (prev.length >= maxFlavors) return prev;
            return [...prev, { uid: `${flavor.id}-${prev.length}-${Date.now()}`, id: flavor.id, label: flavor.label }];
        });
    };

    const removeFlavor = (uid) =>
        setSelectedFlavors((prev) => prev.filter((f) => f.uid !== uid));

    /** "Chocolate x3, Frutilla" — más corto y claro que repetir el nombre. */
    const resumenSabores = (lista) => {
        const cuenta = [];
        lista.forEach((f) => {
            const y = cuenta.find((c) => c.id === f.id);
            if (y) y.n += 1;
            else cuenta.push({ id: f.id, label: f.label, n: 1 });
        });
        return cuenta.map((c) => (c.n > 1 ? `${c.label} x${c.n}` : c.label)).join(', ');
    };

    const handleSauceToggle = (sauce) => {
        setSelectedSauces((prev) => (prev.find((s) => s.id === sauce.id) ? [] : [sauce]));
    };

    const handleSave = () => {
        const saucesLabel = selectedSauces.length > 0 ? selectedSauces.map((s) => s.label).join(', ') : 'Sin salsa';
        const cupLabel = is3Bochas ? 'Vasito ecológico (incluido)' : effectiveCup?.label;
        const label = `Helado · ${selectedSize.label} · ${resumenSabores(selectedFlavors)} · ${saucesLabel} · ${cupLabel}`;
        const config = {
            sizeId: selectedSize.id,
            flavorIds: selectedFlavors.map((f) => f.id),
            sauceIds: selectedSauces.map((s) => s.id),
            cupId: effectiveCup?.id,
        };

        if (isEditing) {
            updateItem(editingItem.id, { label, unitPrice: selectedSize.price, config });
            clearEdit();
            showToast('¡Pedido actualizado! 🍦');
        } else {
            addItem({
                categoryId: category.id,
                categoryName: category.name,
                builderType: 'icecream',
                productId: 'armado',
                variante: `${selectedSize.id} bochas`,
                label,
                unitPrice: selectedSize.price,
                config,
            });
            showToast('¡Agregado al pedido! 🍦');
        }
        reset();
    };

    const handleCancelEdit = () => {
        clearEdit();
        reset();
    };

    const isStepComplete = (s) => {
        if (s === 1) return selectedSize !== null;
        if (s === 2) return selectedFlavors.length === maxFlavors;
        if (s === 3) return true;
        if (s === 4) return effectiveCup !== null;
        return false;
    };

    const canProceedTo = (s) => {
        for (let i = 1; i < s; i++) if (!isStepComplete(i)) return false;
        return true;
    };

    const effectiveSteps = is3Bochas ? 3 : TOTAL_STEPS;

    return (
        <div className="builder-wrapper">
            {toast && <div className="builder-toast">{toast}</div>}

            <StepProgress current={Math.min(step, effectiveSteps)} total={effectiveSteps} />

            {isEditing && (
                <div className="builder-edit-banner">
                    <span>✏️ Editando tu helado</span>
                    <button className="builder-edit-cancel" onClick={handleCancelEdit}>Cancelar</button>
                </div>
            )}

            {/* PASO 1 — Tamaño */}
            <div className={`builder-step ${step === 1 ? 'active' : ''} ${isStepComplete(1) && step !== 1 ? 'done' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(1) && setStep(1)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">{isStepComplete(1) && step !== 1 ? '✓' : '1'}</span>
                        <span>Tamaño</span>
                    </div>
                    {isStepComplete(1) && step !== 1 && (
                        <span className="builder-step-summary">{selectedSize.label} · {formatPrice(selectedSize.price)}</span>
                    )}
                </div>
                {step === 1 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {category.sizes.map((size) => (
                                <button key={size.id}
                                        className={`builder-chip builder-chip-pink ${selectedSize?.id === size.id ? 'selected' : ''}`}
                                        onClick={() => handleSizeSelect(size)}>
                                    <span className="chip-label">{size.label}</span>
                                    <span className="chip-price">{formatPrice(size.price)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* PASO 2 — Sabores */}
            <div className={`builder-step ${step === 2 ? 'active' : ''} ${isStepComplete(2) && step > 2 ? 'done' : ''} ${!canProceedTo(2) ? 'disabled' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(2) && setStep(2)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">{isStepComplete(2) && step > 2 ? '✓' : '2'}</span>
                        <span>Sabores</span>
                    </div>
                    {isStepComplete(2) && step > 2 && (
                        <span className="builder-step-summary">{resumenSabores(selectedFlavors)}</span>
                    )}
                </div>
                {step === 2 && (
                    <div className="builder-step-body">
                        {/* Las bochas elegidas, en orden. Se quita de a una con la ✕:
                            es la forma de sacar una sola cuando el sabor se repite. */}
                        {selectedFlavors.length > 0 && (
                            <div className="relleno-pills">
                                {selectedFlavors.map((f) => (
                                    <span className="relleno-pill" key={f.uid}>
                                        {f.label}
                                        <button className="relleno-pill-remove"
                                                onClick={() => removeFlavor(f.uid)}
                                                aria-label={`Quitar una bocha de ${f.label}`}>✕</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="builder-chips">
                            {category.flavors.map((flavor) => {
                                const veces = selectedFlavors.filter((f) => f.id === flavor.id).length;
                                const sinStock = opcionAgotada(category.id, 'flavors', flavor.id);
                                const isDisabled = sinStock || selectedFlavors.length >= maxFlavors;
                                return (
                                    <button key={flavor.id}
                                            className={`builder-chip builder-chip-pink ${veces > 0 ? 'selected' : ''} ${sinStock ? 'chip-sin-stock' : ''} ${isDisabled && !sinStock ? 'chip-disabled' : ''}`}
                                            onClick={() => !isDisabled && addFlavor(flavor)} disabled={isDisabled}>
                                        {flavor.label}{veces > 1 ? ` x${veces}` : ''}{sinStock ? ' · sin stock' : ''}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="builder-counter">
                            {selectedFlavors.length}/{maxFlavors} bochas elegidas
                            {selectedFlavors.length < maxFlavors && ' · podés repetir el mismo sabor'}
                        </p>
                        {selectedFlavors.length === maxFlavors && (
                            <button className="builder-next-btn" onClick={() => setStep(3)}>Continuar →</button>
                        )}
                    </div>
                )}
            </div>

            {/* PASO 3 — Salsas */}
            <div className={`builder-step ${step === 3 ? 'active' : ''} ${step > 3 ? 'done' : ''} ${!canProceedTo(3) ? 'disabled' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(3) && setStep(3)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">{step > 3 ? '✓' : '3'}</span>
                        <span>Salsas</span>
                    </div>
                    {step > 3 && (
                        <span className="builder-step-summary">{selectedSauces.length > 0 ? selectedSauces.map((s) => s.label).join(', ') : 'Sin salsa'}</span>
                    )}
                </div>
                {step === 3 && (
                    <div className="builder-step-body">
                        <p className="builder-included-label">Incluidas en el precio ✓ · Elegí 1 salsa</p>
                        <div className="builder-chips">
                            {category.sauces.map((sauce) => {
                                const sinStock = opcionAgotada(category.id, 'sauces', sauce.id);
                                return (
                                    <button key={sauce.id}
                                            className={`builder-chip builder-chip-pink ${selectedSauces.find((s) => s.id === sauce.id) ? 'selected' : ''} ${sinStock ? 'chip-sin-stock' : ''}`}
                                            onClick={() => !sinStock && handleSauceToggle(sauce)}
                                            disabled={sinStock}>
                                        {sauce.label}{sinStock ? ' · sin stock' : ''}
                                    </button>
                                );
                            })}
                        </div>
                        <button className="builder-skip-btn" onClick={() => setSelectedSauces([])}>Sin salsa</button>

                        {is3Bochas ? (
                            <div>
                                <div className="waffle-tier-banner mixto" style={{marginBottom: '0.5rem'}}>
                                    🥤 3 bochas incluyen vasito ecológico automáticamente
                                </div>
                                <button className="builder-add-btn" onClick={handleSave}>
                                    {isEditing ? 'Guardar cambios ✓' : 'Agregar al pedido 🛒'}
                                </button>
                            </div>
                        ) : (
                            <button className="builder-next-btn" onClick={() => setStep(4)}>Continuar →</button>
                        )}
                    </div>
                )}
            </div>

            {/* PASO 4 — Vasito (solo si NO son 3 bochas) */}
            {!is3Bochas && (
                <div className={`builder-step ${step === 4 ? 'active' : ''} ${!canProceedTo(4) ? 'disabled' : ''}`}>
                    <div className="builder-step-header" onClick={() => canProceedTo(4) && setStep(4)}>
                        <div className="builder-step-title">
                            <span className="builder-step-number">4</span>
                            <span>Vasito</span>
                        </div>
                    </div>
                    {step === 4 && (
                        <div className="builder-step-body">
                            <div className="builder-cup-options">
                                {category.cupTypes.map((cup) => {
                                    const sinStock = opcionAgotada(category.id, 'cupTypes', cup.id);
                                    return (
                                        <button key={cup.id}
                                                className={`builder-cup-card ${selectedCup?.id === cup.id ? 'selected' : ''} ${sinStock ? 'chip-sin-stock' : ''}`}
                                                onClick={() => !sinStock && setSelectedCup(cup)}
                                                disabled={sinStock}>
                                            <span className="cup-icon">{cup.id === 'barquillo' ? '🍦' : '🥤'}</span>
                                            <span className="cup-label">{cup.label}</span>
                                            <span className="cup-desc">{sinStock ? 'Sin stock' : cup.description}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedCup && (
                                <button className="builder-add-btn" onClick={handleSave}>
                                    {isEditing ? 'Guardar cambios ✓' : 'Agregar al pedido 🛒'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default IceCreamBuilder;