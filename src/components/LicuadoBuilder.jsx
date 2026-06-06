import { useState } from 'react';
import { useCart } from '../context/CartContext';

function LicuadoBuilder({ category }) {
    const { addItem } = useCart();

    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(null);
    const [selectedFruits, setSelectedFruits] = useState([]);
    const [selectedBase, setSelectedBase] = useState(null);
    const [selectedSugar, setSelectedSugar] = useState(null);
    const [toast, setToast] = useState(false);

    const maxFruits = selectedType?.id === 'simple' ? 1 : 2;

    const showToast = () => {
        setToast(true);
        setTimeout(() => setToast(false), 2000);
    };

    const handleTypeSelect = (type) => {
        setSelectedType(type);
        setSelectedFruits([]);
        setStep(2);
    };

    const handleFruitToggle = (fruit) => {
        setSelectedFruits((prev) => {
            if (prev.find((f) => f.id === fruit.id)) {
                return prev.filter((f) => f.id !== fruit.id);
            }
            if (prev.length >= maxFruits) return prev;
            return [...prev, fruit];
        });
    };

    const handleBaseSelect = (base) => {
        setSelectedBase(base);
        setStep(4);
    };

    const handleSugarSelect = (sugar) => {
        setSelectedSugar(sugar);
    };

    const handleAddToCart = () => {
        const label = `Licuado ${selectedType.label} · ${selectedFruits.map((f) => f.label).join(', ')} · ${selectedBase.label} · ${selectedSugar}`;

        addItem({
            id: `licuado-${Date.now()}`,
            categoryId: category.id,
            categoryName: category.name,
            label,
            price: category.price[selectedType.id],
        });

        showToast();
        setStep(1);
        setSelectedType(null);
        setSelectedFruits([]);
        setSelectedBase(null);
        setSelectedSugar(null);
    };

    const formatPrice = (price) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
        }).format(price);

    const isStepComplete = (s) => {
        if (s === 1) return selectedType !== null;
        if (s === 2) return selectedFruits.length === maxFruits;
        if (s === 3) return selectedBase !== null;
        if (s === 4) return selectedSugar !== null;
        return false;
    };

    const canProceedTo = (s) => {
        for (let i = 1; i < s; i++) {
            if (!isStepComplete(i)) return false;
        }
        return true;
    };

    const types = [
        { id: 'simple', label: 'Simple', frutas: '1 fruta' },
        { id: 'mixto', label: 'Mixto', frutas: '2 frutas' },
    ];

    return (
        <div className="builder-wrapper">
            {toast && <div className="builder-toast">¡Agregado al pedido! 🍓</div>}

            {/* PASO 1 — Tipo */}
            <div className={`builder-step ${step === 1 ? 'active' : ''} ${isStepComplete(1) && step !== 1 ? 'done' : ''}`}>
                <div className="builder-step-header" onClick={() => canProceedTo(1) && setStep(1)}>
                    <div className="builder-step-title">
                        <span className="builder-step-number">{isStepComplete(1) && step !== 1 ? '✓' : '1'}</span>
                        <span>Tipo</span>
                    </div>
                    {isStepComplete(1) && step !== 1 && (
                        <span className="builder-step-summary">
              {selectedType.label} · {formatPrice(category.price[selectedType.id])}
            </span>
                    )}
                </div>

                {step === 1 && (
                    <div className="builder-step-body">
                        <div className="licuado-type-chips">
                            {types.map((type) => (
                                <button
                                    key={type.id}
                                    className={`licuado-type-chip ${selectedType?.id === type.id ? 'selected' : ''}`}
                                    onClick={() => handleTypeSelect(type)}
                                >
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
                        <span className="builder-step-summary">
              {selectedFruits.map((f) => f.label).join(', ')}
            </span>
                    )}
                </div>

                {step === 2 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {category.fruits.map((fruit) => {
                                const isSelected = selectedFruits.find((f) => f.id === fruit.id);
                                const isDisabled = !isSelected && selectedFruits.length >= maxFruits;
                                return (
                                    <button
                                        key={fruit.id}
                                        className={`builder-chip builder-chip-cyan ${isSelected ? 'selected' : ''} ${isDisabled ? 'chip-disabled' : ''}`}
                                        onClick={() => !isDisabled && handleFruitToggle(fruit)}
                                        disabled={isDisabled}
                                    >
                                        {fruit.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="builder-counter">
                            {selectedFruits.length}/{maxFruits} frutas seleccionadas
                        </p>
                        {selectedFruits.length === maxFruits && (
                            <button className="builder-next-btn" onClick={() => setStep(3)}>
                                Continuar →
                            </button>
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
                                <button
                                    key={base.id}
                                    className={`builder-chip builder-chip-cyan ${selectedBase?.id === base.id ? 'selected' : ''}`}
                                    onClick={() => handleBaseSelect(base)}
                                >
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
                                <button
                                    key={option}
                                    className={`builder-chip builder-chip-cyan ${selectedSugar === option ? 'selected' : ''}`}
                                    onClick={() => handleSugarSelect(option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>

                        {selectedSugar && (
                            <button className="builder-add-btn" onClick={handleAddToCart}>
                                Agregar al pedido 🛒
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LicuadoBuilder;