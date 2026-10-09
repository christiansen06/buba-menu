// =============================================
// src/utils/catalogoRapido.js
//
// Lista plana de lo que se puede sumar a un pedido ya tomado desde el panel:
// cada producto con su tamaño y su precio, tal cual figura en el menú. Los
// armables a medida (waffle armado, helados, licuados) no están: para eso va
// la línea "Otro" (nombre y precio a mano).
// =============================================

import { menuCategories, parsePrice } from '../data/menu.js';
import { buildPresetCartItem } from './waffle.js';

const TAMANOS = { medium: 'Mediano', large: 'Grande' };

/** [{ id, nombre, icono, opciones: [{ clave, label, unitPrice, item }] }] */
export function catalogoRapido() {
    const out = [];
    for (const cat of menuCategories) {
        const opciones = [];

        if (cat.presets?.length && cat.builderType === 'waffle') {
            for (const preset of cat.presets) {
                const it = buildPresetCartItem(cat, preset);
                opciones.push({ clave: `${cat.id}:${preset.id}`, label: preset.name, unitPrice: it.unitPrice, item: it });
            }
        } else if (cat.items?.length) {
            const presentaciones = cat.presentaciones?.length ? cat.presentaciones : [null];
            for (const prod of cat.items) {
                for (const pres of presentaciones) {
                    const tamanos = ['medium', 'large']
                        .map((k) => ({ k, precio: parsePrice(prod.sizes?.[k]) }))
                        .filter((t) => t.precio != null);
                    for (const t of tamanos) {
                        const sufijo = pres?.sufijoNombre ? ` ${pres.sufijoNombre}` : '';
                        const tam = tamanos.length > 1 ? ` (${TAMANOS[t.k]})` : '';
                        const label = `${prod.name}${sufijo}${tam}`;
                        opciones.push({
                            clave: `${cat.id}:${prod.id}:${t.k}:${pres?.id || ''}`,
                            label,
                            unitPrice: t.precio + (pres?.priceDelta || 0),
                            item: {
                                categoryId: cat.id, productId: prod.id, variante: t.k, label,
                                unitPrice: t.precio + (pres?.priceDelta || 0),
                                config: pres ? { presentacion: pres.id } : null,
                            },
                        });
                    }
                }
            }
        } else if (cat.products?.length) {
            for (const prod of cat.products) {
                if (!prod.pricePerUnit) continue;
                opciones.push({
                    clave: `${cat.id}:${prod.id}`,
                    label: prod.label,
                    unitPrice: prod.pricePerUnit,
                    item: { categoryId: cat.id, productId: prod.id, variante: null, label: prod.label, unitPrice: prod.pricePerUnit, config: null },
                });
            }
        }

        if (opciones.length) out.push({ id: cat.id, nombre: cat.name, icono: cat.icon, opciones });
    }
    return out;
}
