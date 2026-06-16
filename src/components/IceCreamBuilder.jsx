import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import StepProgress from './StepProgress';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const TOTAL_STEPS = 4;

function IceCreamBuilder({ category }) {
    const { addItem, updateItem, editingItem, clearEdit } = useCart();

    const [step, setStep] = useState(1);
    const [selectedSize, setSelectedSize] = useState(null);
    const [selectedFlavors, setSelectedFlavors] = useState([]);
    const [selectedSauces, setSelectedSauces] = useState([]);
    const [selectedCup, setSelectedCup] = useState(null);
    const [toast, setToast] = useState(null);

    const isEditing = editingItem?.builderType === 'icecream';
    const maxFlavors = selectedSize ? parseInt(selectedSize.id) : 0;

    useEffect(() => {
        if (isEditing && editingItem.config) {
            const cfg = editingItem.config;
            setSelectedSize(category.sizes.find((s) => s.id === cfg.sizeId) || null);
            setSelectedFlavors(category.flavors.filter((f) => cfg.flavorIds.includes(f.id)));
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

    const handleFlavorToggle = (flavor) => {
        setSelectedFlavors((prev) => {
            if (prev.find((f) => f.id === flavor.id)) return prev.filter((f) => f.id !== flavor.id);
            if (prev.length >= maxFlavors) return prev;
            return [...prev, flavor];
        });
    };

    const handleSauceToggle = (sauce) => {
        setSelectedSauces((prev) => (prev.find((s) => s.id === sauce.id) ? [] : [sauce]));
    };

    const handleSave = () => {
        const saucesLabel = selectedSauces.length > 0 ? selectedSauces.map((s) => s.label).join(', ') : 'Sin salsa';
        const label = `Helado · ${selectedSize.label} · ${selectedFlavors.map((f) => f.label).join(', ')} · ${saucesLabel} · ${selectedCup.label}`;
        const config = {
            sizeId: selectedSize.id,
            flavorIds: selectedFlavors.map((f) => f.id),
            sauceIds: selectedSauces.map((s) => s.id),
            cupId: selectedCup.id,
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
        if (s === 4) return selectedCup !== null;
        return false;
    };

    const canProceedTo = (s) => {
        for (let i = 1; i < s; i++) if (!isStepComplete(i)) return false;
        return true;
    };

    return (
        <div className="builder-wrapper">
            {toast && <div className="builder-toast">{toast}</div>}

            <StepProgress current={step} total={TOTAL_STEPS} />

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
                        <span className="builder-step-summary">{selectedFlavors.map((f) => f.label).join(', ')}</span>
                    )}
                </div>
                {step === 2 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {category.flavors.map((flavor) => {
                                const isSelected = selectedFlavors.find((f) => f.id === flavor.id);
                                const isDisabled = !isSelected && selectedFlavors.length >= maxFlavors;
                                return (
                                    <button key={flavor.id}
                                            className={`builder-chip builder-chip-pink ${isSelected ? 'selected' : ''} ${isDisabled ? 'chip-disabled' : ''}`}
                                            onClick={() => !isDisabled && handleFlavorToggle(flavor)} disabled={isDisabled}>
                                        {flavor.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="builder-counter">{selectedFlavors.length}/{maxFlavors} sabores seleccionados</p>
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
                            {category.sauces.map((sauce) => (
                                <button key={sauce.id}
                                        className={`builder-chip builder-chip-pink ${selectedSauces.find((s) => s.id === sauce.id) ? 'selected' : ''}`}
                                        onClick={() => handleSauceToggle(sauce)}>
                                    {sauce.label}
                                </button>
                            ))}
                        </div>
                        <button className="builder-skip-btn" onClick={() => setSelectedSauces([])}>Sin salsa</button>
                        <button className="builder-next-btn" onClick={() => setStep(4)}>Continuar →</button>
                    </div>
                )}
            </div>

            {/* PASO 4 — Vasito */}
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
                            {category.cupTypes.map((cup) => (
                                <button key={cup.id}
                                        className={`builder-cup-card ${selectedCup?.id === cup.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedCup(cup)}>
                                    <span className="cup-icon">{cup.id === 'barquillo' ? '🍦' : '🥤'}</span>
                                    <span className="cup-label">{cup.label}</span>
                                    <span className="cup-desc">{cup.description}</span>
                                </button>
                            ))}
                        </div>
                        {selectedCup && (
                            <button className="builder-add-btn" onClick={handleSave}>
                                {isEditing ? 'Guardar cambios ✓' : 'Agregar al pedido 🛒'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default IceCreamBuilder;