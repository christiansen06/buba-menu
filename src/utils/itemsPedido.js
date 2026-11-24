import { menuDeUnidad } from '../data/menu.js';

/**
 * Cómo se muestran los productos de un pedido en el panel: cada uno en su recuadro y separado por
 * secciones (Relleno / Toppings / Salsa, Sabores / Vasito, Frutas / Base...),
 * para que en el panel se lean de un vistazo y no como una sola línea.
 *
 * Se arma con `detalle`, que guarda las elecciones de cada armable. Si un
 * producto no lo tiene (pedidos viejos, "otro"), se cae al nombre partido
 * por " · ", que es como se arma el texto.
 */

// Etiquetas de cada opción, sacadas de la carta de las dos unidades (los
// milkshakes sólo existen en la del truck).
const CATS = new Map();
for (const u of ['local', 'food_truck']) {
    for (const c of menuDeUnidad(u)) if (!CATS.has(c.id)) CATS.set(c.id, c);
}
const etiqueta = (catId, campo, id) =>
    CATS.get(catId)?.[campo]?.find((o) => o.id === id)?.label || id;

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** "Chocolate, Chocolate, Frutilla" → ["Chocolate ×2", "Frutilla"] */
function contar(lista) {
    const vistos = new Map();
    lista.forEach((x) => vistos.set(x, (vistos.get(x) || 0) + 1));
    return [...vistos].map(([x, n]) => (n > 1 ? `${x} ×${n}` : x));
}

/** "BüBa Matcha (Grande)" → { nombre: "BüBa Matcha", tam: "Grande" } */
function partirTamano(texto) {
    const m = /^(.*?)\s*\(([^()]*)\)$/.exec(texto || '');
    return m ? { nombre: m[1], tam: m[2] } : { nombre: texto, tam: null };
}

const sinEmoji = (t) => (t || '').replace(/^\p{Extended_Pictographic}\s*/u, '');

/**
 * Cómo se muestra un producto:
 * { titulo, sub, badges: [{ texto, tono }], secciones: [{ label, valores }] }
 */
export function bloqueDe(it) {
    const d = it.detalle || {};
    const partes = sinEmoji(it.nombre).split(' · ');
    const base = { titulo: partes[0], sub: null, badges: [], secciones: [] };

    switch (it.categoria_id) {
    case 'waffles': {
        if (!Array.isArray(d.rellenos)) break;
        const titulo = it.producto_id === 'armado' ? 'Waffle' : partirTamano(partes[0]).nombre.replace(/\s*\(.*$/, '');
        const toppings = (d.toppings || []).map((t) => etiqueta('waffles', 'toppings', t));
        const salsas = (d.salsas || []).map((s) => etiqueta('waffles', 'salsas', s));
        return {
            titulo,
            sub: cap(it.variante),
            badges: toppings.some((t) => /perla/i.test(t)) ? [{ texto: '🧋 Lleva perlas', tono: 'alerta' }] : [],
            secciones: [
                { label: 'Relleno', valores: d.rellenos.map((r) => r.label) },
                { label: 'Toppings', valores: toppings.length ? toppings : ['Sin topping'] },
                { label: 'Salsa', valores: salsas.length ? salsas : ['Sin salsa'] },
            ],
        };
    }
    case 'helados': {
        if (!Array.isArray(d.flavorIds)) break;
        const salsas = (d.sauceIds || []).map((s) => etiqueta('helados', 'sauces', s));
        return {
            titulo: 'Helado',
            sub: CATS.get('helados')?.sizes?.find((z) => z.id === d.sizeId)?.label || it.variante,
            badges: [],
            secciones: [
                { label: 'Sabores', valores: contar(d.flavorIds.map((f) => etiqueta('helados', 'flavors', f))) },
                { label: 'Salsa', valores: salsas.length ? salsas : ['Sin salsa'] },
                { label: 'Vasito', valores: [etiqueta('helados', 'cupTypes', d.cupId)] },
            ],
        };
    }
    case 'licuados': {
        if (!Array.isArray(d.fruitIds)) break;
        const tam = CATS.get('licuados')?.sizes?.find((z) => z.id === d.sizeId)?.label;
        return {
            titulo: 'Licuado',
            sub: [cap(d.typeId), tam].filter(Boolean).join(' · '),
            badges: d.sugar === 'Sin azúcar' ? [{ texto: 'Sin azúcar', tono: 'aviso' }] : [],
            secciones: [
                { label: 'Frutas', valores: d.fruitIds.map((f) => etiqueta('licuados', 'fruits', f)) },
                { label: 'Base', valores: [etiqueta('licuados', 'bases', d.baseId)] },
                { label: 'Azúcar', valores: [d.sugar || '—'] },
            ],
        };
    }
    case 'milkshakes': {
        if (!d.flavorId) break;
        return {
            titulo: 'Milkshake',
            sub: cap(d.sizeId),
            badges: [],
            secciones: [
                { label: 'Helado', valores: [etiqueta('helados', 'flavors', d.flavorId)] },
                { label: 'Salsa', valores: [etiqueta('helados', 'sauces', d.sauceId)] },
            ],
        };
    }
    case 'medialunas':
    case 'pasteleria':
    case 'promociones': {
        if (!Array.isArray(d.componentes)) break;
        const titulo = it.categoria_id === 'promociones' ? partes[0] : CATS.get(it.categoria_id)?.name || partes[0];
        return {
            titulo,
            sub: null,
            badges: [],
            secciones: [{ label: it.categoria_id === 'promociones' ? 'Incluye' : null, valores: d.componentes.map((c) => `${c.cantidad > 1 ? `${c.cantidad}× ` : ''}${c.nombre}`) }],
        };
    }
    default:
        break;
    }

    // Bubble tea, cafés, bebidas, la edición especial y cualquier otro.
    const { nombre, tam } = partirTamano((partes[0] || "").replace(/\s+(Caliente|Frío|Frio)$/i, ""));
    const badges = [];
    if (d.presentacion === 'caliente') badges.push({ texto: '🔥 Caliente', tono: 'caliente' });
    else if (d.presentacion === 'frio' || it.categoria_id === 'bubble-tea') badges.push({ texto: '❄️ Frío', tono: 'frio' });
    const perlas = (d.extras || []).filter((e) => e === 'perlas').length;
    if (perlas) badges.push({ texto: `🧋 Perlas extra${perlas > 1 ? ` ×${perlas}` : ''}`, tono: 'alerta' });
    // Lo que venga después del nombre y no sean las perlas (ya en el badge).
    const resto = partes.slice(1).filter((p) => !(perlas && /perlas extra/i.test(p)));
    return {
        ...base,
        titulo: nombre,
        sub: tam,
        badges,
        secciones: resto.length ? [{ label: null, valores: resto }] : [],
    };
}

/** Texto plano de los productos, para el buscador. */
export function textoBuscable(pedido) {
    return (pedido.pedido_items || [])
        .filter((it) => it.cantidad > 0)
        .map((it) => {
            const b = bloqueDe(it);
            return [it.nombre, b.titulo, b.sub, ...b.badges.map((x) => x.texto), ...b.secciones.flatMap((s) => s.valores)].join(' ');
        })
        .join(' ');
}
