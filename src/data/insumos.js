// =============================================
// src/data/insumos.js
//
// MATERIA PRIMA — el stock real del local.
//
// La idea: no se agota "el Waffle Oreo", se agotan LAS OREOS. Y cuando
// eso pasa, se tiene que apagar solo en todos lados donde se usen.
//
// Acá abajo hay tres cosas:
//   1. INSUMOS   → la lista de materia prima, con el nombre que ves vos.
//   2. USOS      → dónde se usa cada una dentro de los armables.
//   3. EN_CARTA  → qué productos terminados dependen de un insumo.
//
// ---------------------------------------------------------------------
// REGLA QUE COSTÓ ENTENDER: un mismo sabor NO es un mismo insumo.
//
//   Dulce de leche → el RELLENO sale de un pote comprado, y la SALSA la
//   hacen ustedes artesanalmente. Son dos stocks distintos: se puede
//   acabar uno y seguir teniendo el otro. El helado de DDL es un tercero.
//
//   Frutilla → son CUATRO cosas: la fresca (topping del waffle), la pulpa
//   casera hecha con frutilla congelada (salsa y BüBa Frutilla), la
//   frutilla congelada (licuados y Frappé Frutilla), y el balde de helado.
//
// Por eso están separadas. Agruparlas por nombre apagaría productos que
// en realidad se pueden seguir vendiendo.
// ---------------------------------------------------------------------

import { menuCategories } from './menu.js';

export const INSUMOS = [
    // --- Untables y cremas ---
    { id: 'ddl-pote', label: 'Dulce de leche (pote)', grupo: 'Untables' },
    { id: 'crema', label: 'Crema chantilly', grupo: 'Untables' },
    { id: 'nutella', label: 'Nutella', grupo: 'Untables' },
    { id: 'mani', label: 'Mantequilla de maní', grupo: 'Untables' },

    // --- Helados (mismos baldes para waffles y para la categoría Helados) ---
    { id: 'helado-chocolate', label: 'Helado de chocolate', grupo: 'Helados' },
    { id: 'helado-frutilla', label: 'Helado de frutilla', grupo: 'Helados' },
    { id: 'helado-americana', label: 'Helado americana', grupo: 'Helados' },
    { id: 'helado-menta', label: 'Helado menta granizada', grupo: 'Helados' },
    { id: 'helado-ddl', label: 'Helado de dulce de leche', grupo: 'Helados' },
    { id: 'helado-cielo', label: 'Helado crema del cielo', grupo: 'Helados' },

    // --- Salsas ---
    { id: 'salsa-chocolate', label: 'Salsa de chocolate', grupo: 'Salsas' },
    { id: 'salsa-caramelo', label: 'Salsa de caramelo', grupo: 'Salsas' },
    { id: 'salsa-pistacho', label: 'Salsa de pistacho', grupo: 'Salsas' },
    { id: 'ddl-salsa', label: 'Salsa de dulce de leche (casera)', grupo: 'Salsas' },
    { id: 'pulpa-frutilla', label: 'Pulpa de frutilla (casera)', grupo: 'Salsas' },

    // --- Frutas ---
    { id: 'frutilla-fresca', label: 'Frutilla fresca', grupo: 'Frutas' },
    { id: 'frutilla-congelada', label: 'Frutilla congelada', grupo: 'Frutas' },
    { id: 'banana', label: 'Banana', grupo: 'Frutas' },
    { id: 'durazno', label: 'Durazno', grupo: 'Frutas' },
    { id: 'mango', label: 'Mango', grupo: 'Frutas' },

    // --- Galletitas y bombones ---
    { id: 'oreo', label: 'Oreo', grupo: 'Galletitas' },
    { id: 'chocolinas', label: 'Chocolinas', grupo: 'Galletitas' },
    { id: 'pepito', label: 'Pepito', grupo: 'Galletitas' },
    { id: 'coffler', label: 'Cofler', grupo: 'Galletitas' },
    { id: 'ferrero', label: 'Ferrero Rocher', grupo: 'Galletitas' },

    // --- Bases líquidas ---
    // Ojo con la leche: no es sólo la base del licuado. Es la misma leche
    // de los bubble teas, los cafés con leche, los lattes y los frappés.
    // Si se acaba, se cae media carta (todo menos el café negro y el
    // americano frío). Está bien que sea así: es lo que pasa en el local.
    { id: 'leche', label: 'Leche', grupo: 'Bases' },
    { id: 'jugo', label: 'Jugo de naranja', grupo: 'Bases' },

    // --- Otros ---
    { id: 'barquillo', label: 'Barquillo', grupo: 'Otros' },
];

/**
 * Qué insumo usa cada opción de cada armable.
 * Estructura: categoría → campo → { idDeLaOpción: idDelInsumo }
 * Si una opción no figura acá, se considera que nunca se agota
 * (por ejemplo el agua, o el vaso de papel).
 */
export const USOS = {
    waffles: {
        rellenos: {
            ddl: 'ddl-pote',      // del pote, no la salsa casera
            crema: 'crema',
            nutella: 'nutella',
            mani: 'mani',
            // "helado" abre el submenú de sabores: cada sabor tiene su insumo
        },
        heladoFlavors: {
            chocolate: 'helado-chocolate',
            frutilla: 'helado-frutilla',
            americana: 'helado-americana',
            menta: 'helado-menta',
            ddl: 'helado-ddl',
            cielo: 'helado-cielo',
        },
        toppings: {
            banana: 'banana',
            frutilla: 'frutilla-fresca',   // fresca, no la congelada
            durazno: 'durazno',
            oreo: 'oreo',
            chocolinas: 'chocolinas',
            pepito: 'pepito',
            coffler: 'coffler',
            ferrero: 'ferrero',
        },
        salsas: {
            chocolate: 'salsa-chocolate',
            caramelo: 'salsa-caramelo',
            frutilla: 'pulpa-frutilla',    // pulpa casera
            pistacho: 'salsa-pistacho',
            ddl: 'ddl-salsa',              // casera, distinta del pote
            nutella: 'nutella',
        },
    },

    helados: {
        flavors: {
            chocolate: 'helado-chocolate',
            frutilla: 'helado-frutilla',
            americana: 'helado-americana',
            menta: 'helado-menta',
            ddl: 'helado-ddl',
            cielo: 'helado-cielo',
        },
        sauces: {
            chocolate: 'salsa-chocolate',
            caramelo: 'salsa-caramelo',
            frutilla: 'pulpa-frutilla',
            pistacho: 'salsa-pistacho',
            ddl: 'ddl-salsa',
        },
        cupTypes: {
            barquillo: 'barquillo',
        },
    },

    licuados: {
        fruits: {
            frutilla: 'frutilla-congelada',   // congelada, no la fresca
            banana: 'banana',
            durazno: 'durazno',
            mango: 'mango',
        },
        bases: {
            leche: 'leche',
            jugo: 'jugo',
        },
    },
};

/**
 * Productos TERMINADOS de la carta que dependen de un insumo.
 * Si falta cualquiera de los que se listan, el producto sale sin stock.
 * Estructura: categoría → { idDelProducto: [insumos] }
 *
 * Ojo con el Postre Oreo: NO está acá a propósito. Viene hecho de antes,
 * así que tiene su propio stock y no se cae si se acaban las Oreos del día.
 */
export const EN_CARTA = {
    // Los siete bubble teas son con leche, así que todos dependen de ella.
    'bubble-tea': {
        'brown-sugar': ['leche'],
        matcha: ['leche'],
        frutilla: ['leche', 'pulpa-frutilla'],   // el BüBa Frutilla lleva la pulpa
        thai: ['leche'],
        oreo: ['leche', 'oreo'],                 // lleva galletitas molidas
        taro: ['leche'],
        chocolate: ['leche', 'salsa-chocolate'],
    },

    // El café negro es lo único que sobrevive sin leche.
    cafe: {
        'cafe-cortado': ['leche'],
        lagrima: ['leche'],
        cappuccino: ['leche'],
        'cafe-leche': ['leche'],
        submarino: ['leche'],
    },

    // El americano es agua y espresso; el resto lleva leche.
    'iced-coffee': {
        latte: ['leche'],
        'dark-moca': ['leche'],
        'caramel-latte': ['leche'],
        'matcha-latte': ['leche'],
    },

    // Todos los frappés se licúan con leche.
    frappuccinos: {
        'chocolate-moca': ['leche'],
        ddl: ['leche', 'ddl-pote'],
        'frutilla-frappe': ['leche', 'frutilla-congelada'],
        'oreo-frappe': ['leche', 'oreo'],
        'matcha-frappe': ['leche'],
    },
};

/** Devuelve el id del insumo de una opción, o null si no depende de ninguno. */
export function insumoDe(categoriaId, campo, opcionId) {
    return USOS[categoriaId]?.[campo]?.[opcionId] || null;
}

/**
 * Los waffles ya armados (Oreo, Frutilla, Nutella, Argentina, Fit) no hace
 * falta listarlos a mano: cada uno ya declara en menu.js sus rellenos,
 * toppings y salsas. Leemos esa receta y sacamos los insumos de ahí.
 *
 * La ventaja es que si mañana cambiás la receta de un waffle, el stock se
 * acomoda solo — no hay una segunda lista que se pueda quedar vieja.
 */
function insumosDePresetWaffle(presetId) {
    const waffles = menuCategories.find((c) => c.id === 'waffles');
    const preset = waffles?.presets?.find((p) => p.id === presetId);
    if (!preset?.config) return [];

    const U = USOS.waffles;
    const out = new Set();
    const sumar = (id) => { if (id) out.add(id); };

    (preset.config.rellenos || []).forEach((r) => {
        // El relleno "helado" no tiene insumo propio: lo tiene cada sabor.
        if (r.type === 'helado') sumar(U.heladoFlavors[r.flavor]);
        else sumar(U.rellenos[r.type]);
    });
    (preset.config.toppings || []).forEach((t) => sumar(U.toppings[t]));
    (preset.config.salsas || []).forEach((s) => sumar(U.salsas[s]));
    if (preset.config.extraNutella) sumar('nutella');

    return [...out];
}

/** Insumos que necesita un producto de la carta (array, puede estar vacío). */
export function insumosDeProducto(categoriaId, productoId) {
    const explicitos = EN_CARTA[categoriaId]?.[productoId] || [];
    if (categoriaId !== 'waffles') return explicitos;
    return [...new Set([...explicitos, ...insumosDePresetWaffle(productoId)])];
}

export const INSUMOS_POR_GRUPO = INSUMOS.reduce((acc, i) => {
    (acc[i.grupo] = acc[i.grupo] || []).push(i);
    return acc;
}, {});
