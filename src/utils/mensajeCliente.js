// =============================================
// src/utils/mensajeCliente.js
//
// El resumen de un pedido para mandarle al cliente por WhatsApp, con el
// total que corresponde (envío y descuento incluidos) y, si paga por
// transferencia, el alias de la unidad del pedido.
//
// No se guarda el teléfono del cliente: el mensaje se abre en WhatsApp y
// se elige el chat, o se copia y se pega.
// =============================================

import { formatPrice } from './format.js';
import { aliasDe, PAYMENT_CONFIG } from '../config/payment.js';

/**
 * pedido: { pedido_items: [{ nombre, cantidad, precio_unitario }], envio,
 *           descuento, total, unidad, medio_pago, medio_pago_cobro }
 */
export function mensajeParaCliente(pedido) {
    const items = (pedido.pedido_items || []).filter((it) => it.cantidad > 0);
    const subtotal = items.reduce((s, it) => s + it.cantidad * (it.precio_unitario || 0), 0);
    const envio = pedido.envio || 0;
    const descuento = pedido.descuento || 0;
    const medio = pedido.medio_pago_cobro || pedido.medio_pago || null;

    const lineas = ['¡Hola! 👋 Te paso el detalle de tu pedido en *BüBa* 🧋', ''];
    for (const it of items) {
        const precio = it.precio_unitario == null ? 'a consultar' : formatPrice(it.cantidad * it.precio_unitario);
        lineas.push(`• ${it.cantidad > 1 ? `${it.cantidad}× ` : ''}${it.nombre} — ${precio}`);
    }
    lineas.push('');
    if (envio > 0 || descuento > 0) lineas.push(`Subtotal: ${formatPrice(subtotal)}`);
    if (descuento > 0) lineas.push(`Descuento: −${formatPrice(descuento)}`);
    if (envio > 0) lineas.push(`🛵 Envío: ${formatPrice(envio)}`);
    lineas.push(`*Total: ${formatPrice(pedido.total)}*`);

    if (!medio || medio === 'transferencia') {
        lineas.push('', '💸 Para transferir:', `Alias: *${aliasDe(pedido.unidad)}*`, `Titular: ${PAYMENT_CONFIG.aliasHolder}`, 'Mandanos el comprobante por acá 🙌');
    } else if (medio === 'efectivo' && envio > 0) {
        lineas.push('', '💵 Lo pagás en efectivo cuando te llega.');
    }
    lineas.push('', '¡Gracias! 💙');
    return lineas.join('\n');
}

/** Abre WhatsApp con el mensaje listo; se elige el chat del cliente. */
export const linkWhatsAppCliente = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
