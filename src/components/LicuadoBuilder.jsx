import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import StepProgress from './StepProgress';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const types = [
    { id: 'simple', label: 'Simple', frutas: '1 fruta' },
    { id: 'mixto', label: 'Mixto', frutas: '2 frutas' },
];

const TOTAL_STEPS = 4;

function LicuadoBuilder({ category }) {
    const { addItem, updateItem, editingItem, clearEdit } = useCart();

    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(null);
    const [selectedFruits, setSelectedFruits] = useState([]);
    const [selectedBase, setSelectedBase] = useState(null);
    const [selectedSugar, setSelectedSugar] = useState(null);
    const [toast, setToast] = useState(null);

    const isEditing = editingItem?.builderType === 'licuado';
    const maxFruits = selectedType?.id === 'simple' ? 1 : 2;

    useEffect(() => {
        if (isEditing && editingItem.config) {
            const cfg = editingItem.config;
            setSelectedType(types.find((t) => t.id === cfg.typeId) || null);
            setSelectedFruits(category.fruits.filter((f) => cfg.fruitIds.includes(f.id)));
            setSelectedBase(category.bases.find((b) => b.id === cfg.baseId) || null);
            setSelectedSugar(cfg.sugar);
            setStep(4);
        }
    }, [editingItem]); // eslint-disable-line

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    };

    const reset = () => {
        setStep(1);
        setSelectedType(null);
        setSelectedFruits([]);
        setSelectedBase(null);
        setSelectedSugar(null);
    };

    const handleTypeSelect = (type) => {
        setSelectedType(type);
        setSelectedFruits([]);
        setStep(2);
    };

    const handleFruitToggle = (fruit) => {
        setSelectedFruits((prev) => {
            if (prev.find((f) => f.id === fruit.id)) return prev.filter((f) => f.id !== fruit.id);
            if (prev.length >= maxFruits) return prev;
            return [...prev, fruit];
        });
    };

    const handleBaseSelect = (base) => {
        setSelectedBase(base);
        setStep(4);
    };

    const handleSave = () => {
        const label = `Licuado ${selectedType.label} · ${selectedFruits.map((f) => f.label).join(', ')} · ${selectedBase.label} · ${selectedSugar}`;
        const config = {
            typeId: selectedType.id,
            fruitIds: selectedFruits.map((f) => f.id),
            baseId: selectedBase.id,
            sugar: selectedSugar,
        };

        if (isEditing) {
            updateItem(editingItem.id, { label, unitPrice: category.price[selectedType.id], config });
            clearEdit();
            showToast('¡Pedido actualizado! 🍓');
        } else {
            addItem({
                categoryId: category.id,
                categoryName: category.name,
                builderType: 'licuado',
                label,
                unitPrice: category.price[selectedType.id],
                config,
            });
            showToast('¡Agregado al pedido! 🍓');
        }
        reset();
    };

    const handleCancelEdit = () => {
        clearEdit();
        reset();
    };

    const isStepComplete = (s) => {
        if (s === 1) return selectedType !== null;
        if (s === 2) return selectedFruits.length === maxFruits;
        if (s === 3) return selectedBase !== null;
        if (s === 4) return selectedSugar !== null;
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
                    <span>✏️ Editando tu licuado</span>
                    <button className="builder-edit-cancel" onClick={handleCancelEdit}>Cancelar</button>
                </div>
            )}

            {/* PASO 1 — Tipo */}
            <div className={`builder-step ${step === 1 ? 'active' : ''} ${isStepComplete(1) && step !== 1 ? 'done' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(1) && setStep(1)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">{isStepComplete(1) && step !== 1 ? '✓' : '1'}</span>
                        <span>Tipo</span>
                    </div>
                    {isStepComplete(1) && step !== 1 && (
                        <span className="builder-step-summary">{selectedType.label} · {formatPrice(category.price[selectedType.id])}</span>
                    )}
                </div>
                {step === 1 && (
                    <div className="builder-step-body">
                        <div className="licuado-type-chips">
                            {types.map((type) => (
                                <button key={type.id}
                                        className={`licuado-type-chip ${selectedType?.id === type.id ? 'selected' : ''}`}
                                        onClick={() => handleTypeSelect(type)}>
                                    <span className="licuado-type-name">{type.label}</span>
                                    <span className="licuado-type-price">{type.frutas}</span>
                                    <span className="licuado-type-price">{formatPrice(category.price[type.id])}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* PASO 2 — Frutas */}
            <div className={`builder-step ${step === 2 ? 'active' : ''} ${isStepComplete(2) && step > 2 ? 'done' : ''} ${!canProceedTo(2) ? 'disabled' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(2) && setStep(2)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">{isStepComplete(2) && step > 2 ? '✓' : '2'}</span>
                        <span>Frutas</span>
                    </div>
                    {isStepComplete(2) && step > 2 && (
                        <span className="builder-step-summary">{selectedFruits.map((f) => f.label).join(', ')}</span>
                    )}
                </div>
                {step === 2 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {category.fruits.map((fruit) => {
                                const isSelected = selectedFruits.find((f) => f.id === fruit.id);
                                const isDisabled = !isSelected && selectedFruits.length >= maxFruits;
                                return (
                                    <button key={fruit.id}
                                            className={`builder-chip builder-chip-cyan ${isSelected ? 'selected' : ''} ${isDisabled ? 'chip-disabled' : ''}`}
                                            onClick={() => !isDisabled && handleFruitToggle(fruit)} disabled={isDisabled}>
                                        {fruit.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="builder-counter">{selectedFruits.length}/{maxFruits} frutas seleccionadas</p>
                        {selectedFruits.length === maxFruits && (
                            <button className="builder-next-btn" onClick={() => setStep(3)}>Continuar →</button>
                        )}
                    </div>
                )}
            </div>

            {/* PASO 3 — Base */}
            <div className={`builder-step ${step === 3 ? 'active' : ''} ${isStepComplete(3) && step > 3 ? 'done' : ''} ${!canProceedTo(3) ? 'disabled' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(3) && setStep(3)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">{isStepComplete(3) && step > 3 ? '✓' : '3'}</span>
                        <span>Base</span>
                    </div>
                    {isStepComplete(3) && step > 3 && (
                        <span className="builder-step-summary">{selectedBase.label}</span>
                    )}
                </div>
                {step === 3 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {category.bases.map((base) => (
                                <button key={base.id}
                                        className={`builder-chip builder-chip-cyan ${selectedBase?.id === base.id ? 'selected' : ''}`}
                                        onClick={() => handleBaseSelect(base)}>
                                    {base.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* PASO 4 — Azúcar */}
            <div className={`builder-step ${step === 4 ? 'active' : ''} ${!canProceedTo(4) ? 'disabled' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(4) && setStep(4)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">4</span>
                        <span>Azúcar</span>
                    </div>
                </div>
                {step === 4 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {['Con azúcar', 'Sin azúcar'].map((option) => (
                                <button key={option}
                                        className={`builder-chip builder-chip-cyan ${selectedSugar === option ? 'selected' : ''}`}
                                        onClick={() => setSelectedSugar(option)}>
                                    {option}
                                </button>
                            ))}
                        </div>
                        {selectedSugar && (
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

export default LicuadoBuilder;