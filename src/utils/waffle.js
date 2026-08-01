// =============================================
// src/utils/waffle.js
//
// Precios y armado de los waffles.
//
// Vive acá y no adentro de WaffleBuilder porque la sección de Destacados
// también necesita saber cuánto sale un preset y cómo entra al carrito.
// Duplicar la fórmula sería tener dos verdades sobre el precio de un
// waffle, y tarde o temprano una de las dos queda vieja.
// =============================================

export const MAX_RELLENOS = 2;
export const MAX_TOPPINGS = 3; // hasta 3 toppings, mixto desde 2
export const MAX_SALSAS = 2;

export const TIER_LABEL = { basico: 'Básico', simple: 'Simple', mixto: 'Mixto' };

/** Mixto si hay 2+ en cualquier categoría, o Nutella (relleno o salsa). */
export function computeIsMixto(rellenos, toppings, salsas) {
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
export function computeIsBasico(rellenos, toppings, salsas) {
    if (computeIsMixto(rellenos, toppings, salsas)) return false;
    return rellenos.length === 1 && toppings.length === 0 && salsas.length === 0;
}

/** Nivel actual del waffle: 'basico' | 'simple' | 'mixto'. */
export function computeTier(rellenos, toppings, salsas) {
    if (computeIsMixto(rellenos, toppings, salsas)) return 'mixto';
    if (computeIsBasico(rellenos, toppings, salsas)) return 'basico';
    return 'simple';
}

export function computeWafflePrice(category, rellenos, toppings, salsas) {
    const hasNutellaRelleno = rellenos.some((r) => r.type === 'nutella');
    const hasNutellaSalsa = salsas.includes('nutella');
    const doubleNutella = hasNutellaRelleno && hasNutellaSalsa;
    const tier = computeTier(rellenos, toppings, salsas);

    // Si no hay precio de básico configurado, cae a simple (compatibilidad).
    let p = category.price[tier] ?? category.price.simple;
    if (doubleNutella) p += category.nutellaSaucePrice ?? 500;
    return p;
}

/** Precio de un preset ya armado del menú. */
export function computePresetPrice(category, preset) {
    const { rellenos, toppings, salsas } = preset.config;
    return computeWafflePrice(category, rellenos, toppings, salsas);
}

/**
 * Traduce un preset del menú al item que entra al carrito.
 * Lo usan el armable de waffles y las tarjetas de Destacados, así los dos
 * caminos agregan exactamente lo mismo.
 */
export function buildPresetCartItem(category, preset) {
    const cfg = preset.config;
    const toppingLabel = (id) => category.toppings.find((t) => t.id === id)?.label || id;
    const salsaLabel = (id) => category.salsas.find((s) => s.id === id)?.label || id;

    const rell = cfg.rellenos.length ? cfg.rellenos.map((r) => r.label).join(' + ') : 'sin relleno';
    const tops = cfg.toppings.length ? cfg.toppings.map(toppingLabel).join(', ') : 'sin topping';
    const hasNR = cfg.rellenos.some((r) => r.type === 'nutella');
    const sal = cfg.salsas.length
        ? cfg.salsas.map((id) => (id === 'nutella' && hasNR ? 'Nutella (doble)' : salsaLabel(id))).join(', ')
        : 'sin salsa';

    const presetTier = computeTier(cfg.rellenos, cfg.toppings, cfg.salsas);

    return {
        categoryId: category.id,
        categoryName: category.name,
        builderType: 'waffle',
        productId: preset.id,
        variante: presetTier,
        label: `${preset.name} (Waffle ${TIER_LABEL[presetTier]} · ${rell} · ${tops} · ${sal})`,
        unitPrice: computeWafflePrice(category, cfg.rellenos, cfg.toppings, cfg.salsas),
        config: cfg,
    };
}
