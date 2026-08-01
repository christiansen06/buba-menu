// =============================================
// src/utils/extras.js
//
// Adicionales que se le suman a un producto de la carta (hoy: perlas
// extra en los bubble teas). Se declaran en la categoría, dentro de
// menu.js, con { id, label, emoji, price, insumo }.
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
    const elegidos = lista.filter((e) => ids.includes(e.id));

    if (elegidos.length === 0) {
        return { elegidos, precioExtra: 0, sufijoLabel: '', sufijoMerge: '', config: null };
    }

    return {
        elegidos,
        precioExtra: elegidos.reduce((suma, e) => suma + (e.price || 0), 0),

        // El separador " · " no es decorativo: es el que usa splitLabel en
        // utils/whatsapp.js para partir el título de los detalles, así el
        // extra sale como línea aparte en el pedido sin tocar el mensaje.
        sufijoLabel: ` · ${elegidos.map((e) => e.label).join(', ')}`,

        // Va al mergeKey para que el mismo producto con y sin extra queden
        // como dos líneas distintas del carrito, no como uno con cantidad 2.
        // Ordenado para que "perlas+crema" y "crema+perlas" sean lo mismo.
        sufijoMerge: `:${elegidos.map((e) => e.id).sort().join('+')}`,

        // Lo guarda pedidos.js dentro de "detalle": permite contar después
        // cuántos extras se vendieron.
        config: { extras: elegidos.map((e) => e.id) },
    };
}

/** Precio final del producto con sus extras. Respeta los "a consultar". */
export function precioConExtras(precioBase, precioExtra) {
    if (precioBase == null) return null;
    return precioBase + precioExtra;
}
