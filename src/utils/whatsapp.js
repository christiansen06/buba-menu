// =============================================
// src/utils/whatsapp.js
// =============================================

import { formatPrice } from './format.js';
import { PAYMENT_CONFIG } from '../config/payment.js';

export const BUBA_WHATSAPP = '5492236833119';

const CATEGORY_ORDER = [
    'promociones',
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
    'pasteleria',
];

const CATEGORY_EMOJI = {
    'promociones':  '🎉',
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
    'pasteleria':   '🧁',
};

const CATEGORY_LABEL = {
    'promociones':  'Promociones',
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
    'pasteleria':   'Pastelería',
};

/**
 * 🔥 o ❄️ al lado de cada bubble tea, para no tener que leer si dice
 * "Caliente" en medio del nombre. Es sólo visual: no cambia el precio ni
 * lo que se guarda en la base.
 *
 * Los pedidos viejos no traen presentación — eran todos fríos.
 */
function emojiPresentacion(item) {
    if (item.categoryId !== 'bubble-tea') return '';
    return item.config?.presentacion === 'caliente' ? ' 🔥' : ' ❄️';
}

function splitLabel(label) {
    const parts = label.split(' · ');
    if (parts.length <= 1) return { title: label, detail: [] };
    return { title: parts[0], detail: parts.slice(1) };
}

export function buildOrderMessage({ items, total, name, note, hasConsultarItems, paymentMethod }) {
    const L = [];

    L.push('🧋 *NUEVO PEDIDO — BüBa*');
    L.push('');
    L.push(`👤 *Nombre:* ${name}`);
    L.push('');

    const groups = {};
    items.forEach((item) => {
        const cat = item.categoryId || 'otros';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
    });

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
            const pres = emojiPresentacion(item);

            if (detail.length > 0) {
                L.push(`  • ${qty}${title}${pres}`);
                detail.forEach((d) => L.push(`      ◦ ${d}`));
                L.push(`      💵 ${price}`);
            } else {
                L.push(`  • ${qty}${title}${pres}  —  ${price}`);
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

    // Los datos de pago viajan DENTRO del mensaje a propósito.
    // Al tocar "enviar" el cliente sale de la app y queda parado en este
    // chat: si el alias no está acá, tiene que ir a buscarlo a un cartel.
    // De paso, al local le queda claro si esperar una transferencia.
    if (paymentMethod === 'transferencia') {
        L.push('');
        L.push('💳 *Pago:* Transferencia');
        L.push(`*Alias:* ${PAYMENT_CONFIG.alias}`);
        L.push(`*Titular:* ${PAYMENT_CONFIG.aliasHolder}`);
        L.push(`*Monto:* ${formatPrice(total)}`);
        if (hasConsultarItems) {
            L.push('_Ojo: hay ítems a cotizar, esperá el monto final antes de transferir_');
        }
        L.push('_Verificar la transferencia antes de entregar_');
    } else if (paymentMethod === 'efectivo') {
        L.push('');
        L.push('💵 *Pago:* Efectivo en el local');
    }

    L.push('');
    L.push('——————————');
    L.push('_Enviado desde el menú digital BüBa_ 🧋');

    return L.join('\n');
}

// Cuánto esperamos, en el celular, antes de dar por hecho que la app no abrió.
const ESPERA_APP_MS = 1500;

/** true en celular/tablet táctil. En escritorio la pestaña nueva es lo esperado. */
function esTactil() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/**
 * Abre WhatsApp con el pedido ya escrito.
 *
 * POR QUÉ NO USA window.open EN EL CELULAR
 *
 * Antes hacía window.open(wa.me, '_blank'). En iPhone/iPad eso abre una
 * pestaña nueva, wa.me redirige al esquema whatsapp:// y iOS salta a la app
 * — y la pestaña recién abierta queda SIN DOCUMENTO. Cuando el cliente
 * vuelve al navegador aterriza en esa pestaña vacía, no en el menú: es la
 * "pantalla en blanco" que venía reportándose. El menú seguía vivo en la
 * pestaña de al lado, pero nadie lo sabía.
 *
 * Llamando al esquema de la app directamente no se crea ninguna pestaña: los
 * esquemas propios no reemplazan el documento, así que el menú se queda tal
 * cual, mostrando "¡Pedido enviado!" con el alias. Al volver, el cliente cae
 * justo ahí.
 *
 * El respaldo a wa.me es para el que no tiene WhatsApp instalado: si a los
 * 1,5 s la página sigue a la vista, es que la app no abrió. Va en la MISMA
 * pestaña, así que tampoco queda nada colgado.
 */
export function sendOrderToWhatsApp(payload) {
    const texto = encodeURIComponent(buildOrderMessage(payload));
    const web = `https://wa.me/${BUBA_WHATSAPP}?text=${texto}`;

    if (!esTactil()) {
        window.open(web, '_blank');
        return;
    }

    let resuelto = false;

    const soltar = () => {
        document.removeEventListener('visibilitychange', alIrse);
        window.removeEventListener('pagehide', alIrse);
        window.removeEventListener('blur', alIrse);
    };

    // Que la página se oculte es la señal de que WhatsApp tomó el control.
    function alIrse() {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(timer);
        soltar();
    }

    const timer = setTimeout(() => {
        if (resuelto) return;
        resuelto = true;
        soltar();
        // Seguimos a la vista: la app no abrió. Respaldo, sin pestaña nueva.
        window.location.href = web;
    }, ESPERA_APP_MS);

    document.addEventListener('visibilitychange', alIrse);
    window.addEventListener('pagehide', alIrse);
    window.addEventListener('blur', alIrse);

    window.location.href = `whatsapp://send?phone=${BUBA_WHATSAPP}&text=${texto}`;
}