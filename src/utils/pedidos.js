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
import { getUnidad, getCanal } from '../config/unidad.js';

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
 * Huella de un carrito: mismo contenido → misma firma.
 *
 * Sirve para no anotar dos veces la misma venta. Cuando WhatsApp falla (pasa
 * con señal floja: no puede resolver el número contra el servidor), lo normal
 * es tocar "enviar" de nuevo — y hasta ahora cada intento anotaba un pedido
 * nuevo. El 08/09 quedaron tres BüBa Oreo y dos Chocolate por dos ventas
 * reales: $29.000 de más.
 *
 * Se ordena a propósito: el mismo pedido armado en otro orden es el mismo
 * pedido. El precio entra en la firma para que un cambio de precio no se
 * confunda con un reintento.
 */
export function firmaPedido(items, total) {
    const partes = (items || [])
        .map((it) => `${it.id}·${it.quantity || 1}·${it.unitPrice ?? 'x'}`)
        .sort();
    return `${Math.round(total || 0)}|${partes.join(',')}`;
}

// ---------------------------------------------------------------------
// Cola de pedidos sin subir
//
// El 17/09 el iPad se quedó sin datos y hubo pedidos que llegaron por
// WhatsApp pero no a la base. En el evento del food truck (8 al 12/10) la
// señal puede fallar, así que ahora cada pedido se ANOTA PRIMERO EN EL
// APARATO y después se sube. Si la subida falla —o el navegador congela la
// pestaña al saltar a WhatsApp antes de que termine— queda en la cola y se
// reintenta solo: al volver a abrir el menú, cuando vuelve la conexión y
// cada 30 segundos.
//
// Reintentar nunca duplica: el id del pedido se genera acá y viaja en cada
// intento; la base ignora un id que ya tiene (parte 18). Y la hora que viaja
// es la del pedido, no la de la subida: un pedido de la noche del 8 que sube
// el 9 a la mañana queda en el día 8.
// ---------------------------------------------------------------------

const COLA_KEY = 'buba-cola-pedidos';
const COLA_MAX = 200;
const REINTENTO_MS = 30000;
export const EVENTO_COLA = 'buba-cola-pedidos';

function leerCola() {
    try {
        const crudo = localStorage.getItem(COLA_KEY);
        const cola = crudo ? JSON.parse(crudo) : [];
        return Array.isArray(cola) ? cola : [];
    } catch {
        return [];
    }
}

function guardarCola(cola) {
    try {
        localStorage.setItem(COLA_KEY, JSON.stringify(cola.slice(-COLA_MAX)));
    } catch {
        // Sin localStorage (navegación privada): se sigue sin cola, como antes.
    }
    try {
        window.dispatchEvent(new CustomEvent(EVENTO_COLA, { detail: cola.length }));
    } catch {
        // ignore
    }
}

/** Cuántos pedidos esperan subir en este aparato. */
export const pendientesEnCola = () => leerCola().length;

/** uuid v4. crypto.randomUUID no existe en iOS viejos; el respaldo sí. */
function nuevoId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function subir(pedido) {
    // Los pedidos con delivery usan la función que además anota el envío; los
    // demás siguen por la de siempre (así un pedido viejo en la cola no cambia).
    const funcion = 'p_plataforma' in pedido ? 'registrar_pedido_plataforma'
        : 'p_posnet_tipo' in pedido || 'p_envio' in pedido ? 'registrar_pedido_completo'
            : 'registrar_pedido';
    const { error } = await supabase.rpc(funcion, pedido);
    if (error) throw error;
}

let subiendo = false;

/**
 * Intenta subir todo lo que haya en la cola, en orden. Lo que sube se saca;
 * lo que falla se queda para el próximo intento. Nunca tira error.
 */
export async function vaciarCola() {
    if (!hayBase || subiendo) return;
    const cola = leerCola();
    if (cola.length === 0) return;

    subiendo = true;
    try {
        const subidos = new Set();
        for (const pedido of cola) {
            try {
                await subir(pedido);
                subidos.add(pedido.p_id);
            } catch (e) {
                // Sin conexión, lo más probable es que fallen todos: se corta
                // acá y se reintenta en el próximo turno.
                console.warn('Pedido en cola sin subir todavía:', e?.message || e);
                break;
            }
        }
        if (subidos.size > 0) {
            // Se relee: mientras se subía pudo entrar un pedido nuevo.
            guardarCola(leerCola().filter((p) => !subidos.has(p.p_id)));
        }
    } finally {
        subiendo = false;
    }
}

let reintentosArmados = false;

/** Engancha los reintentos automáticos. Se llama una vez al cargar la app. */
export function iniciarColaDePedidos() {
    if (reintentosArmados || typeof window === 'undefined') return;
    reintentosArmados = true;
    void vaciarCola();
    window.addEventListener('online', () => { void vaciarCola(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void vaciarCola();
    });
    setInterval(() => {
        if (leerCola().length > 0) void vaciarCola();
    }, REINTENTO_MS);
}

/**
 * Guarda el pedido. Devuelve { ok } — nunca tira error hacia afuera,
 * porque quien la llama está en el medio de mandar un WhatsApp.
 */
export async function registrarPedido({ items, total, medioPago = null, envio = 0 }) {
    if (!hayBase) return { ok: false, motivo: 'sin-base' };
    if (!items || items.length === 0) return { ok: false, motivo: 'vacio' };

    // unidad y canal no los decide quien llama: salen del dispositivo y de
    // la URL con la que se abrió el menú. Si se pasaran por parámetro habría
    // dos fuentes de verdad para lo mismo.
    //
    // medioPago es lo único "de la persona" que sí viaja, y no la identifica:
    // es transferencia o efectivo. Cualquier otro valor lo ignora la base.
    // Tarjeta y QR se cobran con el posnet: para la base el medio sigue siendo
    // 'posnet' y cómo pagó viaja aparte (parte 29).
    const esTarjetaOQr = medioPago === 'tarjeta' || medioPago === 'qr';
    const pedido = {
        p_id: nuevoId(),
        p_creado_en: new Date().toISOString(),
        p_total: Math.round(total || 0),
        p_items: itemsParaBase(items),
        p_medio_pago: esTarjetaOQr ? 'posnet' : medioPago,
        p_unidad: getUnidad(),
        p_canal: getCanal(),
    };
    // Delivery con moto (sólo mostrador del local): p_total INCLUYE el envío,
    // que viaja aparte para poder separar productos de envío en la caja.
    const envioEntero = Math.round(envio || 0);
    if (envioEntero > 0) pedido.p_envio = envioEntero;
    if (esTarjetaOQr) pedido.p_posnet_tipo = medioPago;

    // PedidosYa (parte 31): no es un medio de pago, es una plataforma que
    // liquida después. Va por su propia función, sin medio ni envío.
    if (medioPago === 'pedidosya') {
        for (const k of ['p_medio_pago', 'p_canal', 'p_envio', 'p_posnet_tipo']) delete pedido[k];
        pedido.p_plataforma = 'pedidos_ya';
    }

    // Primero al aparato, después a la base. Si se corta en el medio, la
    // cola lo tiene.
    guardarCola([...leerCola(), pedido]);

    await vaciarCola();
    const quedo = leerCola().some((p) => p.p_id === pedido.p_id);
    return quedo
        ? { ok: false, motivo: 'en-cola', id: pedido.p_id }
        : { ok: true, id: pedido.p_id };
}
