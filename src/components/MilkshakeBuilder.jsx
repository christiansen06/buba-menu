import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';
import StepProgress from './StepProgress';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const TOTAL_STEPS = 3;

/**
 * Milkshake (sólo food truck): batido con UN helado y UNA salsa, los dos a
 * elección del cliente, en tamaño mediano o grande. Los sabores y las salsas
 * son los del helado y gastan el mismo stock (ver USOS.milkshakes).
 */
function MilkshakeBuilder({ category }) {
    const { addItem, updateItem, editingItem, clearEdit } = useCart();
    const { opcionAgotada } = useDisponibilidad();

    const [step, setStep] = useState(1);
    const [size, setSize] = useState(null);
    const [flavor, setFlavor] = useState(null);
    const [sauce, setSauce] = useState(null);
    const [toast, setToast] = useState(null);

    const isEditing = editingItem?.builderType === 'milkshake';

    // Cargar el armador con el item que se edita: sincroniza con un cambio de afuera.
    useEffect(() => {
        if (isEditing && editingItem.config) {
            const cfg = editingItem.config;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSize(category.sizes.find((z) => z.id === cfg.sizeId) || null);
            setFlavor(category.flavors.find((f) => f.id === cfg.flavorId) || null);
            setSauce(category.sauces.find((x) => x.id === cfg.sauceId) || null);
            setStep(3);
        }
    }, [editingItem]); // eslint-disable-line

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    };

    const reset = () => {
        setStep(1);
        setSize(null);
        setFlavor(null);
        setSauce(null);
    };

    const handleSave = () => {
        const label = `Milkshake ${size.label} · Helado ${flavor.label} · Salsa ${sauce.label}`;
        const config = { sizeId: size.id, flavorId: flavor.id, sauceId: sauce.id };
        if (isEditing) {
            updateItem(editingItem.id, { label, unitPrice: size.price, config });
            clearEdit();
            showToast('¡Pedido actualizado! 🥛');
        } else {
            addItem({
                categoryId: category.id,
                categoryName: category.name,
                builderType: 'milkshake',
                productId: 'armado',
                variante: size.id,
                label,
                unitPrice: size.price,
                config,
            });
            showToast('¡Agregado al pedido! 🥛');
        }
        reset();
    };

    const handleCancelEdit = () => {
        clearEdit();
        reset();
    };

    const isStepComplete = (s) => {
        if (s === 1) return size !== null;
        if (s === 2) return flavor !== null;
        if (s === 3) return sauce !== null;
        return false;
    };

    const canProceedTo = (s) => {
        for (let i = 1; i < s; i++) if (!isStepComplete(i)) return false;
        return true;
    };

    const cabecera = (n, titulo, resumen) => (
        <div className="builder-step-header" onClick={() => canProceedTo(n) && setStep(n)}>
            <div className="builder-step-title">
                <span className="builder-step-number">{isStepComplete(n) && step !== n ? '✓' : n}</span>
                <span>{titulo}</span>
            </div>
            {isStepComplete(n) && step !== n && <span className="builder-step-summary">{resumen}</span>}
        </div>
    );

    return (
        <div className="builder-wrapper">
            {toast && <div className="builder-toast">{toast}</div>}

            <StepProgress current={step} total={TOTAL_STEPS} />

            {isEditing && (
                <div className="builder-edit-banner">
                    <span>✏️ Editando tu milkshake</span>
                    <button className="builder-edit-cancel" onClick={handleCancelEdit}>Cancelar</button>
                </div>
            )}

            {/* PASO 1 — Tamaño */}
            <div className={`builder-step ${step === 1 ? 'active' : ''} ${isStepComplete(1) && step !== 1 ? 'done' : ''}`}>
                {cabecera(1, 'Tamaño', size && `${size.label} · ${formatPrice(size.price)}`)}
                {step === 1 && (
                    <div className="builder-step-body">
                        <div className="licuado-type-chips">
                            {category.sizes.map((z) => (
                                <button key={z.id}
                                        className={`licuado-type-chip ${size?.id === z.id ? 'selected' : ''}`}
                                        onClick={() => { setSize(z); setStep(2); }}>
                                    <span className="licuado-type-name">{z.label}</span>
                                    <span className="licuado-type-price">{formatPrice(z.price)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* PASO 2 — Helado */}
            <div className={`builder-step ${step === 2 ? 'active' : ''} ${isStepComplete(2) && step > 2 ? 'done' : ''} ${!canProceedTo(2) ? 'disabled' : ''}`}>
                {cabecera(2, 'Helado', flavor?.label)}
                {step === 2 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {category.flavors.map((f) => {
                                const sinStock = opcionAgotada(category.id, 'flavors', f.id);
                                return (
                                    <button key={f.id}
                                            className={`builder-chip builder-chip-cyan ${flavor?.id === f.id ? 'selected' : ''} ${sinStock ? 'chip-sin-stock' : ''}`}
                                            disabled={sinStock}
                                            onClick={() => { setFlavor(f); setStep(3); }}>
                                        {f.label}{sinStock ? ' · sin stock' : ''}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* PASO 3 — Salsa */}
            <div className={`builder-step ${step === 3 ? 'active' : ''} ${!canProceedTo(3) ? 'disabled' : ''}`}>
                {cabecera(3, 'Salsa', sauce?.label)}
                {step === 3 && (
                    <div className="builder-step-body">
                        <div className="builder-chips">
                            {category.sauces.map((x) => {
                                const sinStock = opcionAgotada(category.id, 'sauces', x.id);
                                return (
                                    <button key={x.id}
                                            className={`builder-chip builder-chip-cyan ${sauce?.id === x.id ? 'selected' : ''} ${sinStock ? 'chip-sin-stock' : ''}`}
                                            disabled={sinStock}
                                            onClick={() => setSauce(x)}>
                                        {x.label}{sinStock ? ' · sin stock' : ''}
                                    </button>
                                );
                            })}
                        </div>
                        {sauce && (
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

export default MilkshakeBuilder;
