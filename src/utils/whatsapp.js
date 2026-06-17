// =============================================
// src/utils/whatsapp.js
// Arma el mensaje de pedido y abre WhatsApp
// =============================================

// ⚠️ PONÉ ACÁ EL NÚMERO DE WHATSAPP DEL LOCAL
// Formato internacional sin + ni espacios ni guiones.
// Argentina: 54 + 9 + código de área sin 0 + número sin 15
// Ej: para 223 555-1234 (Mar del Plata) => '5492235551234'
export const BUBA_WHATSAPP = '5492236833119'; // ← reemplazá con el número real

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

// Orden visual de categorías en el mensaje
const CATEGORY_ORDER = [
    'bubble-tea',
    'frappuccinos',
    'cafe',
    'iced-coffee',
    'licuados',
    'waffles',
    'helados',
    'postres',
    'medialunas',
    'tostados',
];

const CATEGORY_EMOJI = {
    'bubble-tea':   '🧋',
    'frappuccinos': '🥤',
    'cafe':         '☕',
    'iced-coffee':  '🧊',
    'licuados':     '🍓',
    'waffles':      '🧇',
    'helados':      '🍦',
    'postres':      '🍰',
    'medialunas':   '🥐',
    'tostados':     '🥪',
};

const CATEGORY_LABEL = {
    'bubble-tea':   'Bubble Tea',
    'frappuccinos': 'Frappuccinos',
    'cafe':         'Café',
    'iced-coffee':  'Iced Coffee',
    'licuados':     'Licuados',
    'waffles':      'Waffles',
    'helados':      'Helados',
    'postres':      'Postres',
    'medialunas':   'Medialunas',
    'tostados':     'Tostados',
};

function splitLabel(label) {
    const parts = label.split(' · ');
    if (parts.length <= 1) return { title: label, detail: [] };
    return { title: parts[0], detail: parts.slice(1) };
}

export function buildOrderMessage({ items, total, name, note, hasConsultarItems }) {
    const L = [];

    L.push('🧋 *NUEVO PEDIDO — BüBa*');
    L.push('');
    L.push(`👤 *Nombre:* ${name}`);
    L.push('');

    // Agrupar items por categoría
    const groups = {};
    items.forEach((item) => {
        const cat = item.categoryId || 'otros';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
    });

    // Ordenar grupos según CATEGORY_ORDER
    const sortedCats = Object.keys(groups).sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a);
        const ib = CATEGORY_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    L.push('📋 *Detalle:*');
    L.push('');

    sortedCats.forEach((cat) => {
        const emoji = CATEGORY_EMOJI[cat] || '•';
        const label = CATEGORY_LABEL[cat] || cat;
        L.push(`${emoji} *${label.toUpperCase()}*`);

        groups[cat].forEach((item) => {
            const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
            const price = item.unitPrice == null
                ? 'A consultar'
                : formatPrice(item.unitPrice * item.quantity);
            const { title, detail } = splitLabel(item.label);

            if (detail.length > 0) {
                L.push(`  • ${qty}${title}`);
                detail.forEach((d) => L.push(`      ◦ ${d}`));
                L.push(`      💵 ${price}`);
            } else {
                L.push(`  • ${qty}${title}  —  ${price}`);
            }
        });

        L.push('');
    });

    L.push(`💰 *Total: ${formatPrice(total)}*`);

    if (hasConsultarItems) {
        L.push('_(Algunos ítems se cotizan en el mostrador)_');
    }

    if (note && note.trim()) {
        L.push('');
        L.push(`📝 *Aclaración:* ${note.trim()}`);
    }

    L.push('');
    L.push('——————————');
    L.push('_Enviado desde el menú digital BüBa_ 🧋');

    return L.join('\n');
}

export function sendOrderToWhatsApp(payload) {
    const message = buildOrderMessage(payload);
    const url = `https://wa.me/${BUBA_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}