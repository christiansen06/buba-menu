// =============================================
// src/data/preciosTruck.js
//
// Precios del FOOD TRUCK (cartel del truck, 08/11/2026). Sólo lo que cambia
// respecto del local: todo lo que no está acá (cafés calientes, waffles
// —básico incluido—, tostados, pastelería, bebidas y promos) sale al mismo
// precio que en el local.
//
// Se aplica una sola vez al cargar la página, si el aparato es del truck
// (QR del truck o tablet del truck): ver getUnidad() en config/unidad.js.
// Cambiar un precio del truck = cambiarlo acá.
// =============================================

const tam = (medium, large) => ({ medium, large });

/** categoria → producto → { medium, large } (mismo formato que menu.js). */
export const SIZES_TRUCK = {
    'bubble-tea': {
        'brown-sugar': tam('$9.000', '$10.000'),
        matcha: tam('$9.000', '$10.000'),
        frutilla: tam('$9.000', '$10.000'),
        thai: tam('$9.000', '$10.000'),
        oreo: tam('$9.000', '$10.000'),
        taro: tam('$9.000', '$10.000'),
        flan: tam('$9.000', '$10.000'),
        chocolate: tam('$9.000', '$10.000'),
    },
    frappuccinos: {
        'chocolate-moca': tam('$7.500', '$8.000'),
        'oreo-frappe': tam('$7.500', '$8.000'),
        ddl: tam('$7.500', '$8.000'),
        'frutilla-frappe': tam('$7.500', '$8.000'),
        'matcha-frappe': tam('$7.500', '$8.000'),
    },
    'iced-coffee': {
        americano: tam('$7.000', '$7.500'),
        latte: tam('$7.000', '$7.500'),
        'dark-moca': tam('$7.000', '$7.500'),
        'caramel-latte': tam('$7.000', '$7.500'),
        'matcha-latte': tam('$7.000', '$7.500'),
    },
    postres: {
        chocotorta: tam('$6.000', 'N/A'),
        'postre-oreo': tam('$6.000', 'N/A'),
    },
};

/** Otros precios del truck, por categoría (se mezclan sobre los del local). */
export const PRECIOS_TRUCK = {
    // En el truck hay menos perlas: la porción extra sale más.
    'bubble-tea': { extras: [{ id: 'perlas', label: 'Perlas extra', emoji: '🧋', price: 1500, insumo: 'perlas', max: 3 }] },
    // En el truck: 1 bocha $3.000, 2 bochas $4.000. No hay de 3.
    // 1 a $1.500; 6 a $8.000 (en el local, 6 a $8.500).
    medialunas: {
        products: [
            { id: 'manteca', label: 'Medialuna de Manteca', pricePerUnit: 1500, discountAt: 6, discountAmount: 1000 },
            { id: 'jyq', label: 'Medialuna de Jamón y Queso', pricePerUnit: 2000 },
        ],
    },
    helados: { sizes: [{ id: '1', label: '1 bocha', price: 3000 }, { id: '2', label: '2 bochas', price: 4000 }] },
};

/** Pisa en el lugar los precios del menú con los del truck. */
export function aplicarPreciosTruck(categorias) {
    categorias.forEach((cat) => {
        const sizes = SIZES_TRUCK[cat.id];
        if (sizes) {
            (cat.items || []).forEach((item) => {
                if (sizes[item.id]) item.sizes = { ...item.sizes, ...sizes[item.id] };
            });
        }
        const otros = PRECIOS_TRUCK[cat.id];
        if (otros) Object.assign(cat, otros);
    });
}
