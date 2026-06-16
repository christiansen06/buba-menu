// =============================================
// src/utils/whatsapp.js
// Arma el mensaje de pedido y abre WhatsApp
// =============================================

// ⚠️ PONÉ ACÁ EL NÚMERO DE WHATSAPP DEL LOCAL
// Formato internacional sin + ni espacios ni guiones.
// Argentina: 54 + 9 + código de área sin 0 + número sin 15
// Ej: para 223 555-1234 (Mar del Plata) => '5492235551234'
export const BUBA_WHATSAPP = '5492236833119';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

/**
 * Toma el label de un ítem y, si tiene partes separadas por " · ",
 * devuelve la primera como título y el resto como líneas de detalle.
 * Ej: "Waffle Mixto · Crema + Helado frutilla · Banana, Frutilla · Chocolate"
 *  -> título: "Waffle Mixto"
 *  -> detalle: ["Crema + Helado frutilla", "Banana, Frutilla", "Chocolate"]
 */
function splitLabel(label) {
    const parts = label.split(' · ');
    if (parts.length <= 1) return { title: label, detail: [] };
    return { title: parts[0], detail: parts.slice(1) };
}

/**
 * Arma el texto completo del pedido.
 */
export function buildOrderMessage({ items, total, name, note, hasConsultarItems }) {
    const L = [];
    L.push('🧋 *NUEVO PEDIDO — BüBa*');
    L.push('');
    L.push(`👤 *Nombre:* ${name}`);
    L.push('');
    L.push('📋 *Detalle:*');

    items.forEach((item) => {
        const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
        const price = item.unitPrice == null ? 'A consultar' : formatPrice(item.unitPrice * item.quantity);
        const { title, detail } = splitLabel(item.label);
        L.push(`• ${qty}${title}  —  ${price}`);
        detail.forEach((d) => L.push(`   ◦ ${d}`));
    });

    L.push('');
    L.push(`💰 *Total:* ${formatPrice(total)}`);
    if (hasConsultarItems) {
        L.push('_(Algunos ítems se cotizan en el mostrador)_');
    }

    if (note && note.trim()) {
        L.push('');
        L.push(`📝 *Aclaración:* ${note.trim()}`);
    }

    L.push('');
    L.push('——————————');
    L.push('_Enviado desde el menú digital BüBa_');

    return L.join('\n');
}

/**
 * Abre WhatsApp con el mensaje pre-armado.
 */
export function sendOrderToWhatsApp(payload) {
    const message = buildOrderMessage(payload);
    const url = `https://wa.me/${BUBA_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}