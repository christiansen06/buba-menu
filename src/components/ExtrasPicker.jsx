import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';
import { formatPrice } from '../utils/format.js';

/**
 * Adicionales de un producto (hoy: perlas extra en los bubble teas).
 *
 * Los extras que dependen de un insumo agotado directamente no se muestran:
 * ofrecer algo que no hay genera un pedido que después no se puede cumplir.
 */
function ExtrasPicker({ extras, seleccionados, onToggle }) {
    const { insumoFalta } = useDisponibilidad();

    // Igual que en resumenExtras: puede llegar null, no sólo undefined.
    const disponibles = (extras || []).filter((e) => !e.insumo || !insumoFalta(e.insumo));
    const elegidos = seleccionados || [];
    if (disponibles.length === 0) return null;

    return (
        <div className="extras-row">
            {disponibles.map((extra) => {
                const activo = elegidos.includes(extra.id);
                return (
                    <button
                        key={extra.id}
                        type="button"
                        className={`extra-chip ${activo ? 'selected' : ''}`}
                        aria-pressed={activo}
                        onClick={() => onToggle(extra.id)}
                    >
                        <span aria-hidden="true">{extra.emoji}</span>
                        <span>{extra.label}</span>
                        <span className="extra-chip-price">+{formatPrice(extra.price)}</span>
                    </button>
                );
            })}
        </div>
    );
}

export default ExtrasPicker;
