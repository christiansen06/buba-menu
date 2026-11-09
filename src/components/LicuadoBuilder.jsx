import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';
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
    const { opcionAgotada } = useDisponibilidad();

    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);
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
            // Los pedidos anteriores a los tamaños no lo traen: hay que elegirlo de nuevo.
            setSelectedSize(category.sizes.find((z) => z.id === cfg.sizeId) || null);
            setSelectedFruits(category.fruits.filter((f) => cfg.fruitIds.includes(f.id)));
            setSelectedBase(category.bases.find((b) => b.id === cfg.baseId) || null);
            setSelectedSugar(cfg.sugar);
            setStep(category.sizes.some((z) => z.id === cfg.sizeId) ? 4 : 1);
        }
    }, [editingItem]); // eslint-disable-line

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    };

    const reset = () => {
        setStep(1);
        setSelectedType(null);
        setSelectedSize(null);
        setSelectedFruits([]);
        setSelectedBase(null);
        setSelectedSugar(null);
    };

    const precio = selectedSize && selectedType ? selectedSize.price[selectedType.id] : null;

    const handleTypeSelect = (size, type) => {
        setSelectedSize(size);
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
        const label = `Licuado ${selectedType.label} ${selectedSize.label} · ${selectedFruits.map((f) => f.label).join(', ')} · ${selectedBase.label} · ${selectedSugar}`;
        const config = {
            typeId: selectedType.id,
            sizeId: selectedSize.id,
            fruitIds: selectedFruits.map((f) => f.id),
            baseId: selectedBase.id,
            sugar: selectedSugar,
        };

        if (isEditing) {
            updateItem(editingItem.id, { label, unitPrice: precio, config });
            clearEdit();
            showToast('¡Pedido actualizado! 🍓');
        } else {
            addItem({
                categoryId: category.id,
                categoryName: category.name,
                builderType: 'licuado',
                productId: 'armado',
                variante: `${selectedSize.id}-${selectedType.id}`,
                label,
                unitPrice: precio,
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
        if (s === 1) return selectedType !== null && selectedSize !== null;
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
                        <span>Tamaño y tipo</span>
                    </div>
                    {isStepComplete(1) && step !== 1 && (
                        <span className="builder-step-summary">{selectedSize.label} · {selectedType.label} · {formatPrice(precio)}</span>
                    )}
                </div>
                {step === 1 && (
                    <div className="builder-step-body">
                        {category.sizes.map((size) => (
                            <div key={size.id} className="licuado-size-grupo">
                                <p className="licuado-size-titulo">{size.label}</p>
                                <div className="licuado-type-chips">
                                    {types.map((type) => (
                                        <button key={type.id}
                                                className={`licuado-type-chip ${selectedSize?.id === size.id && selectedType?.id === type.id ? 'selected' : ''}`}
                                                onClick={() => handleTypeSelect(size, type)}>
                                            <span className="licuado-type-name">{type.label}</span>
                                            <span className="licuado-type-price">{type.frutas}</span>
                                            <span className="licuado-type-price">{formatPrice(size.price[type.id])}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
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
                                const sinStock = opcionAgotada(category.id, 'fruits', fruit.id);
                                const isDisabled = sinStock || (!isSelected && selectedFruits.length >= maxFruits);
                                return (
                                    <button key={fruit.id}
                                            className={`builder-chip builder-chip-cyan ${isSelected ? 'selected' : ''} ${sinStock ? 'chip-sin-stock' : ''} ${isDisabled && !sinStock ? 'chip-disabled' : ''}`}
                                            onClick={() => !isDisabled && handleFruitToggle(fruit)} disabled={isDisabled}>
                                        {fruit.label}{sinStock ? ' · sin stock' : ''}
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
                            {category.bases.map((base) => {
                                const sinStock = opcionAgotada(category.id, 'bases', base.id);
                                return (
                                    <button key={base.id}
                                            className={`builder-chip builder-chip-cyan ${selectedBase?.id === base.id ? 'selected' : ''} ${sinStock ? 'chip-sin-stock' : ''}`}
                                            onClick={() => !sinStock && handleBaseSelect(base)}
                                            disabled={sinStock}>
                                        {base.label}{sinStock ? ' · sin stock' : ''}
                                    </button>
                                );
                            })}
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