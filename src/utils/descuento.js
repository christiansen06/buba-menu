// Descuentos de un pedido (parte 38). El cálculo es el mismo que hace la base
// en editar_pedido: la base es la que manda, esto sólo lo muestra antes de guardar.

export const TIPOS_DESCUENTO = [
    { id: 'monto', etiqueta: '$ Cupón en pesos' },
    { id: 'porcentaje', etiqueta: '% Cupón de porcentaje' },
    { id: 'tarjeta', etiqueta: '🎁 Tarjeta completa (va gratis)' },
];

/** Pesos que se descuentan sobre `subtotal` (los productos, sin envío). Nunca más que el subtotal. */
export function calcularDescuento(subtotal, { tipo, valor }) {
    const v = Number(valor);
    if (!tipo || !Number.isFinite(v) || v <= 0) return 0;
    const d = tipo === 'porcentaje' ? Math.round((subtotal * Math.min(v, 100)) / 100) : Math.round(v);
    return Math.max(0, Math.min(d, subtotal));
}

/** Texto corto para la tarjeta del pedido: "Cupón $3.000", "Cupón 10 %", "Tarjeta completa". */
export function textoDescuento(pedido, formatPrice) {
    if (!pedido.descuento || !pedido.descuento_tipo) return null;
    const base = pedido.descuento_tipo === 'tarjeta' ? '🎁 Tarjeta completa: producto gratis'
        : pedido.descuento_tipo === 'porcentaje' ? `🏷️ Cupón ${Number(pedido.descuento_valor)} %`
            : '🏷️ Cupón de descuento';
    return `${base}${pedido.descuento_nota ? ` · ${pedido.descuento_nota}` : ''} · −${formatPrice(pedido.descuento)}`;
}
