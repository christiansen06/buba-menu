// =============================================
// src/utils/pedidos.js
//
// Anota cada pedido en la base para poder analizarlo después.
//
// DOS REGLAS QUE NO SE NEGOCIAN:
//
// 1. Acá NO viaja el nombre del cliente ni la aclaración que escribió.
//    Sólo qué productos salieron, cuántos, a qué precio y cuándo. La
//    aclaración se excluye a propósito: la gente escribe cosas como
//    "para Agustín, el de siempre" y eso ya es un dato personal.
//
// 2. Si la base falla, el pedido se manda igual. Registrar la venta es
//    para vos; mandar el pedido es para el cliente. Nunca al revés.
// =============================================

import { supabase, hayBase } from './supabase.js';

/**
 * Traduce el carrito al formato que espera la función registrar_pedido.
 *
 * "detalle" se guarda tal cual viene del armable. Ahí adentro puede venir
 * "componentes": el desglose de qué productos reales salieron (las partes
 * de una promo, o cada medialuna de la docena). Eso es lo que después
 * permite contar un cappuccino vendido dentro de un combo.
 */
export function itemsParaBase(items) {
    return items.map((it) => ({
        categoria_id: it.categoryId || 'otros',
        producto_id: it.productId || null,
        nombre: it.label,
        variante: it.variante || null,
        cantidad: it.quantity || 1,
        precio_unitario: it.unitPrice ?? null,
        detalle: it.config || null,
    }));
}

/**
 * Guarda el pedido. Devuelve { ok } — nunca tira error hacia afuera,
 * porque quien la llama está en el medio de mandar un WhatsApp.
 */
export async function registrarPedido({ items, total }) {
    if (!hayBase) return { ok: false, motivo: 'sin-base' };
    if (!items || items.length === 0) return { ok: false, motivo: 'vacio' };

    try {
        // Una sola llamada: la función de Postgres mete la cabecera y las
        // líneas dentro de la misma transacción. O entran las dos o ninguna.
        const { data, error } = await supabase.rpc('registrar_pedido', {
            p_total: Math.round(total || 0),
            p_items: itemsParaBase(items),
        });
        if (error) throw error;
        return { ok: true, id: data };
    } catch (e) {
        console.warn('No se pudo registrar el pedido:', e?.message || e);
        return { ok: false, motivo: e?.message || 'error' };
    }
}
