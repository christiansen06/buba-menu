// =============================================
// src/utils/extras.js
//
// Adicionales que se le suman a un producto de la carta (hoy: perlas
// extra en los bubble teas). Se declaran en la categoría, dentro de
// menu.js, con { id, label, emoji, price, insumo, max }. "max" es cuántas
// porciones se pueden pedir (por defecto 1: se prende o se apaga).
//
// Esta función centraliza CÓMO un extra modifica el item del carrito,
// para que las tarjetas del menú y las de Destacados agreguen exactamente
// lo mismo. Si cada una lo armara por su cuenta, un mismo bubble tea con
// perlas entraría distinto según dónde tocó el cliente.
// =============================================

export function resumenExtras(extrasDisponibles, idsElegidos) {
    // Ojo: un parámetro por defecto NO cubre el null (sólo el undefined), y
    // acá llega null desde las tarjetas que no admiten extras (los presets).
    const lista = extrasDisponibles || [];
    const ids = idsElegidos || [];
    // Un id repetido es una porción más: ['perlas', 'perlas'] = perlas extra ×2.
    const elegidos = lista
        .map((e) => ({ ...e, cantidad: cantidadExtra(ids, e.id) }))
        .filter((e) => e.cantidad > 0);

    if (elegidos.length === 0) {
        return { elegidos, precioExtra: 0, sufijoLabel: '', sufijoMerge: '', config: null };
    }

    const porciones = elegidos.flatMap((e) => Array(e.cantidad).fill(e.id));

    return {
        elegidos,
        precioExtra: elegidos.reduce((suma, e) => suma + (e.price || 0) * e.cantidad, 0),

        // El separador " · " no es decorativo: es el que usa splitLabel en
        // utils/whatsapp.js para partir el título de los detalles, así el
        // extra sale como línea aparte en el pedido sin tocar el mensaje.
        // Con una sola porción queda igual que antes ("Perlas extra").
        sufijoLabel: ` · ${elegidos.map((e) => (e.cantidad > 1 ? `${e.label} ×${e.cantidad}` : e.label)).join(', ')}`,

        // Va al mergeKey para que el mismo producto con y sin extra queden
        // como dos líneas distintas del carrito, no como uno con cantidad 2.
        // Ordenado para que "perlas+crema" y "crema+perlas" sean lo mismo; y
        // con las porciones repetidas, ×1 y ×2 también son líneas distintas.
        sufijoMerge: `:${[...porciones].sort().join('+')}`,

        // Lo guarda pedidos.js dentro de "detalle": permite contar después
        // cuántos extras se vendieron. Una porción por elemento, así la
        // métrica de la base (metrica_opciones_armables) cuenta ×2 como 2.
        config: { extras: porciones },
    };
}

/** Cuántas porciones de un extra hay elegidas. */
export function cantidadExtra(idsElegidos, id) {
    return (idsElegidos || []).filter((x) => x === id).length;
}

/** La lista de elegidos con `cantidad` porciones de ese extra (0 lo saca). */
export function conCantidad(idsElegidos, id, cantidad) {
    const resto = (idsElegidos || []).filter((x) => x !== id);
    return [...resto, ...Array(Math.max(0, cantidad)).fill(id)];
}

/** Precio final del producto con sus extras. Respeta los "a consultar". */
export function precioConExtras(precioBase, precioExtra) {
    if (precioBase == null) return null;
    return precioBase + precioExtra;
}
