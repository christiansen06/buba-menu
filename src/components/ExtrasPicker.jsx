import { useEffect, useRef } from 'react';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';
import { formatPrice } from '../utils/format.js';
import { cantidadExtra, conCantidad } from '../utils/extras.js';

/**
 * Adicionales de un producto (hoy: perlas extra en los bubble teas).
 *
 * Los extras que dependen de un insumo agotado directamente no se muestran:
 * ofrecer algo que no hay genera un pedido que después no se puede cumplir.
 *
 * Un extra con "max" mayor a 1 se puede pedir varias veces (perlas ×2, ×3):
 * el primer toque lo agrega y después aparecen − y + para la cantidad.
 * `seleccionados` repite el id por cada porción; `onChange` recibe la lista nueva.
 */
function ExtrasPicker({ extras, seleccionados, onChange }) {
    const { insumoFalta } = useDisponibilidad();
    // Al pasar de chip a − / + (o al revés) el botón tocado desaparece:
    // el foco se lleva al control nuevo para no perderlo con el teclado.
    // Se anota en un ref (no en estado): el cambio de cantidad ya hace que la
    // tarjeta se vuelva a dibujar, y después de eso el efecto mueve el foco.
    const controles = useRef({});
    const focoPendiente = useRef(null);
    useEffect(() => {
        if (!focoPendiente.current) return;
        controles.current[focoPendiente.current]?.focus();
        focoPendiente.current = null;
    });

    // Igual que en resumenExtras: puede llegar null, no sólo undefined.
    const disponibles = (extras || []).filter((e) => !e.insumo || !insumoFalta(e.insumo));
    const elegidos = seleccionados || [];
    if (disponibles.length === 0) return null;

    const ref = (clave) => (el) => { controles.current[clave] = el; };

    return (
        <div className="extras-row">
            {disponibles.map((extra) => {
                const cantidad = cantidadExtra(elegidos, extra.id);
                const max = extra.max || 1;
                const poner = (n, siguienteFoco) => {
                    onChange(conCantidad(elegidos, extra.id, Math.min(max, Math.max(0, n))));
                    if (siguienteFoco) focoPendiente.current = `${extra.id}:${siguienteFoco}`;
                };

                if (max === 1 || cantidad === 0) {
                    const activo = cantidad > 0;
                    return (
                        <button
                            key={extra.id}
                            ref={ref(`${extra.id}:chip`)}
                            type="button"
                            className={`extra-chip ${activo ? 'selected' : ''}`}
                            aria-pressed={activo}
                            onClick={() => (activo ? poner(0) : poner(1, max > 1 ? 'mas' : null))}
                        >
                            <span aria-hidden="true">{extra.emoji}</span>
                            <span>{extra.label}</span>
                            <span className="extra-chip-price">+{formatPrice(extra.price)}</span>
                        </button>
                    );
                }

                return (
                    <div key={extra.id} className="extra-chip selected extra-cantidad" role="group" aria-label={extra.label}>
                        <button
                            ref={ref(`${extra.id}:menos`)}
                            type="button"
                            className="extra-cantidad-btn"
                            aria-label={cantidad === 1 ? `Sacar ${extra.label.toLowerCase()}` : `Una porción menos de ${extra.label.toLowerCase()}`}
                            onClick={() => poner(cantidad - 1, cantidad === 1 ? 'chip' : null)}
                        >
                            −
                        </button>
                        <span className="extra-cantidad-texto" aria-live="polite">
                            <span className="extra-cantidad-nombre">
                                {extra.label} <strong>×{cantidad}</strong>
                            </span>
                            <span className="extra-chip-price">+{formatPrice(extra.price * cantidad)}</span>
                        </span>
                        <button
                            ref={ref(`${extra.id}:mas`)}
                            type="button"
                            className="extra-cantidad-btn"
                            aria-label={`Una porción más de ${extra.label.toLowerCase()}`}
                            // aria-disabled y no disabled: un botón deshabilitado
                            // pierde el foco justo cuando se llega al máximo.
                            aria-disabled={cantidad >= max}
                            title={cantidad >= max ? `Hasta ${max} porciones` : undefined}
                            onClick={() => { if (cantidad < max) poner(cantidad + 1); }}
                        >
                            +
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export default ExtrasPicker;
