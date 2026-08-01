/**
 * MENU SISTEMA DE BUBA
 *
 * Estructura base para todas las categorías y productos.
 * Preparado para soportar futuras expansiones:
 * - Galerías de fotos
 * - Promociones y combos
 * - Productos temporales/estacionales
 * - Productos agotados
 * - Filtros y búsqueda
 */

export const menuCategories = [
  // ===== BUBBLE TEA =====
  {
    id: 'bubble-tea',
    name: 'Bubble Tea',
    icon: '🧋',
    accent: 'cyan',
    description: 'Nuestros clásicos: té con leche, frutas y tapioca. El original de BüBa',
    // Adicionales que se le pueden sumar a cualquier producto de la categoría.
    // Están acá y no en el componente para poder agregar otros (o habilitarlos
    // en otra categoría) tocando sólo datos.
    // "insumo" los conecta con el stock: si se acaba, el extra deja de ofrecerse.
    extras: [
      { id: 'perlas', label: 'Perlas extra', emoji: '🧋', price: 1000, insumo: 'perlas' },
    ],
    items: [
      {
        id: 'brown-sugar',
        name: 'BüBa Brown Sugar',
        description: 'Té negro, leche y brown sugar.',
        image: 'Brown Sugar',
        badge: 'Recomendado',
        featured: true,
        sizes: {
          medium: '$9.000',
          large: '$10.000',
        },
      },
      {
        id: 'matcha',
        name: 'BüBa Matcha',
        description: 'Matcha cremoso con tapioca.',
        image: 'Matcha',
        badge: 'Nuevo',
        featured: false,
        sizes: {
          medium: '$9.500',
          large: '$10.500',
        },
      },
      {
        id: 'frutilla',
        name: 'BüBa Frutilla',
        description: 'Bubble tea sabor frutilla.',
        image: 'Frutilla',
        badge: null,
        featured: false,
        sizes: {
          medium: '$9.000',
          large: '$10.000',
        },
      },
      {
        id: 'thai',
        name: 'BüBa Thai',
        description: 'Inspirado en el clásico té tailandés.',
        image: 'Thai',
        badge: null,
        featured: false,
        sizes: {
          medium: '$9.000',
          large: '$10.000',
        },
      },
      {
        id: 'oreo',
        name: 'BüBa Oreo',
        description: 'Bubble tea dulce con notas de Oreo.',
        image: 'Oreo',
        badge: 'Más vendido',
        featured: true,
        sizes: {
          medium: '$9.000',
          large: '$10.000',
        },
      },
      {
        id: 'taro',
        name: 'BüBa Taro',
        description: 'Taro suave y cremoso.',
        image: 'Taro',
        badge: null,
        featured: false,
        sizes: {
          medium: '$9.000',
          large: '$10.000',
        },
      },
      {
        id: 'chocolate',
        name: 'BüBa Chocolate',
        description: 'Chocolate y tapioca.',
        image: 'Chocolate',
        badge: null,
        featured: false,
        sizes: {
          medium: '$9.000',
          large: '$10.000',
        },
      },
    ],
  },

  // ===== CAFÉ CALIENTE =====
  {
    id: 'cafe',
    name: 'Café',
    icon: '☕',
    accent: 'cyan',
    description: 'Café recién preparado. Espresso, lattes y especialidades',
    items: [
      {
        id: 'cafe-negro',
        name: 'Cafe Negro',
        description: 'Espresso puro y intenso. 2 shots.',
        image: 'Espresso',
        badge: null,
        featured: false,
        sizes: {
          medium: '$3.000',
          large: '$3.500',
        },
      },
      {
        id: 'cafe-cortado',
        name: 'Cortado',
        description: 'Café cortado con leche caliente',
        image: 'Cortado',
        badge: 'Recomendado',
        featured: false,
        sizes: {
          medium: '$4.000',
          large: '$4.500',
        },
      },{
        id: 'lagrima',
        name: 'Lagrima',
        description: 'Lágrima, leche vaporizada y espuma',
        image: 'Lágrima',
        badge: null,
        featured: false,
        sizes: {
          medium: '$4.000',
          large: '$4.500',
        },
      },
      {
        id: 'cappuccino',
        name: 'Cappuccino',
        description: 'Espresso, leche vaporizada y espuma',
        image: 'Cappuccino',
        badge: null,
        featured: false,
        sizes: {
          medium: '$4.500',
          large: '$5.000',
        },
      },
      {
        id: 'cafe-leche',
        name: 'Café con Leche',
        description: 'Café con leche caliente',
        image: 'Café con Leche',
        badge: null,
        featured: false,
        sizes: {
          medium: '$4.500',
          large: '$5.000',
        },
      },
      {
        id: 'submarino',
        name: 'Submarino',
        description: 'Leche caliente con una barra de chocolate para derretir. Tamaño grande.',
        image: 'Submarino',
        badge: null,
        featured: false,
        sizes: {
          medium: 'N/A',
          large: '$5.000',
        },
      },
    ],
  },

  // ===== ICED COFFEE =====
  {
    id: 'iced-coffee',
    name: 'Iced Coffee',
    icon: '❄️',
    accent: 'cyan',
    description: 'Café frío refrescante. Perfecto para días calurosos',
    items: [
      {
        id: 'americano',
        name: 'Americano Frío',
        description: 'Café frío clásico.',
        image: 'Americano',
        badge: null,
        featured: false,
        sizes: {
          medium: '$7.000',
          large: '$7.500',
        },
      },
      {
        id: 'latte',
        name: 'Latte Frío',
        description: 'Café frío con leche.',
        image: 'Latte',
        badge: 'Más vendido',
        featured: false,
        sizes: {
          medium: '$7.500',
          large: '$8.000',
        },
      },
      {
        id: 'dark-moca',
        name: 'Dark Moca',
        description: 'Café frío con cacao intenso.',
        image: 'Moca',
        badge: null,
        featured: false,
        sizes: {
          medium: '$7.500',
          large: '$8.000',
        },
      },
      {
        id: 'caramel-latte',
        name: 'Caramel Latte Frío',
        description: 'Latte frío con caramelo.',
        image: 'Caramel',
        badge: null,
        featured: false,
        sizes: {
          medium: '$7.500',
          large: '$8.000',
        },
      },
      {
        id: 'matcha-latte',
        name: 'Matcha Latte Frío',
        description: 'Matcha frío con leche.',
        image: 'Matcha',
        badge: 'Nuevo',
        featured: false,
        sizes: {
          medium: '$8.000',
          large: '$9.000',
        },
      },
    ],
  },

  // ===== FRAPPUCCINOS =====
  {
    id: 'frappuccinos',
    name: 'Frappuccinos',
    icon: '🥤',
    accent: 'cyan',
    description: 'Bebidas cremosas congeladas. Ideales para refrescarse',
    items: [
      {
        id: 'chocolate-moca',
        name: 'Chocolate Moca',
        description: 'Frappuccino de chocolate, café y crema.',
        image: 'Moca',
        badge: null,
        featured: false,
        sizes: {
          medium: '$8.000',
          large: '$9.000',
        },
      },
      {
        id: 'oreo-frappe',
        name: 'Frappé Oreo',
        description: 'Frappé cremoso con Oreo y crema.',
        image: 'Oreo',
        badge: 'Más vendido',
        featured: true,
        sizes: {
          medium: '$8.000',
          large: '$9.000',
        },
      },
      {
        id: 'ddl',
        name: 'Frappé Dulce de Leche',
        description: 'Frappé cremoso con Dulce de Leche y crema.',
        image: 'DDL',
        badge: 'Recomendado',
        featured: false,
        sizes: {
          medium: '$8.000',
          large: '$9.000',
        },
      },
      {
        id: 'frutilla-frappe',
        name: 'Frappé Frutilla',
        description: 'Frappe cremoso con Frutilla y crema.',
        image: 'Frutilla',
        badge: null,
        featured: false,
        sizes: {
          medium: '$8.000',
          large: '$9.000',
        },
      },
      {
        id: 'matcha-frappe',
        name: 'Frappé Matcha',
        description: 'Frappe de Matcha con crema.',
        image: 'Matcha',
        badge: null,
        featured: false,
        sizes: {
          medium: '$8.000',
          large: '$9.000',
        },
      },
    ],
  },

  // ===== LICUADOS =====
  {
    id: 'licuados',
    name: 'Licuados',
    icon: '🍓',
    accent: 'cyan',
    description: 'Licuados frescos. Elegís vos cómo los querés',
    type: 'builder',
    builderType: 'licuado',
    price: { simple: 7500, mixto: 8000 },
    fruits: [
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'banana', label: 'Banana' },
      { id: 'durazno', label: 'Durazno' },
      { id: 'mango', label: 'Mango' },
    ],
    bases: [
      { id: 'leche', label: 'Leche' },
      { id: 'jugo', label: 'Jugo de Naranja' },
      { id: 'agua', label: 'Agua' },
    ],
  },

  // ===== WAFFLES =====
  // ===== REEMPLAZAR LA CATEGORÍA WAFFLES EN src/data/menu.js =====
// Buscá el bloque que empieza con  id: 'waffles'  y reemplazalo ENTERO por esto:

  // ===== WAFFLES =====
  {
    id: 'waffles',
    name: 'Waffles',
    icon: '🧇',
    accent: 'pink',
    description: 'Elegí uno listo o armá el tuyo. Desde $8.000 con un solo relleno',
    type: 'builder',
    builderType: 'waffle',
    // basico: 1 relleno solo (sin toppings ni salsas). Nutella no aplica: fuerza Mixto.
    price: { basico: 8000, simple: 9000, mixto: 10000 },
    nutellaSaucePrice: 500,
    presets: [
      {
        id: 'frutilla',
        name: 'Waffle Frutilla',
        description: 'Crema chantilly, frutillas y salsa de chocolate',
        featured: true,
        config: {
          rellenos: [{ id: 'crema', type: 'crema', label: 'Crema' }],
          toppings: ['frutilla'],
          salsas: ['chocolate'],
          extraNutella: false,
        },
      },
      {
        id: 'oreo',
        name: 'Waffle Oreo',
        description: 'Helado americana, Oreos y salsa de chocolate',
        config: {
          rellenos: [{ id: 'helado-americana-p', type: 'helado', flavor: 'americana', label: 'Helado Americana' }],
          toppings: ['oreo'],
          salsas: ['chocolate'],
          extraNutella: false,
        },
      },
      {
        id: 'nutella',
        name: 'Waffle Nutella',
        description: 'Nutella, banana y salsa de chocolate',
        config: {
          rellenos: [{ id: 'nutella', type: 'nutella', label: 'Nutella' }],
          toppings: ['banana'],
          salsas: ['chocolate'],
          extraNutella: true,
        },
      },
      {
        id: 'argentina',
        name: 'Waffle Argentina',
        description: 'Helado Crema del cielo, Crema Chantilly, Ferrero Rocher y salsa de caramelo',
        config: {
          rellenos: [
            { id: 'helado-cielo-p', type: 'helado', flavor: 'cielo', label: 'Helado Crema del Cielo' },
            { id: 'crema', type: 'crema', label: 'Crema Chantilly' },
          ],
          toppings: ['ferrero'],
          salsas: ['caramelo'],
          extraNutella: false,
        },
      },
      {
        id: 'fit',
        name: 'Waffle Fit',
        description: 'Mantequilla de Mani, Banana y salsa de chocolate',
        config: {
          rellenos: [{ id: 'mani', type: 'mani', label: 'Mantequilla de mani' }],
          toppings: ['banana'],
          salsas: ['chocolate'],
          extraNutella: false,
        },
      },
    ],
    rellenos: [
      { id: 'helado', label: 'Helado', hasFlavors: true },
      { id: 'ddl', label: 'Dulce de Leche' },
      { id: 'crema', label: 'Crema' },
      { id: 'nutella', label: 'Nutella', forcesMixto: true },
      { id: 'mani', label: 'Mantequilla de mani' },
    ],
    heladoFlavors: [
      { id: 'chocolate', label: 'Chocolate' },
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'americana', label: 'Americana' },
      { id: 'menta', label: 'Menta Granizada' },
      { id: 'ddl', label: 'Dulce de Leche' },
      { id: 'cielo', label: 'Crema del Cielo' },
    ],
    toppings: [
      { id: 'banana', label: 'Banana', group: 'Frutas' },
      { id: 'frutilla', label: 'Frutilla', group: 'Frutas' },
      { id: 'durazno', label: 'Durazno', group: 'Frutas' },
      { id: 'oreo', label: 'Oreo', group: 'Galletitas' },
      { id: 'chocolinas', label: 'Chocolinas', group: 'Galletitas' },
      { id: 'pepito', label: 'Pepito', group: 'Galletitas' },
      { id: 'coffler', label: 'Cofler', group: 'Galletitas' },
      { id: 'ferrero', label: 'Ferrero Rocher', group: 'Galletitas' },
    ],
    salsas: [
      { id: 'chocolate', label: 'Chocolate' },
      { id: 'caramelo', label: 'Caramelo' },
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'pistacho', label: 'Pistacho' },
      { id: 'ddl', label: 'Dulce de Leche' },
      { id: 'nutella', label: 'Nutella', forcesMixto: true },
    ],
  },

  // ===== POSTRES =====
  {
    id: 'postres',
    name: 'Postres',
    icon: '🍰',
    accent: 'pink',
    description: 'Postres artesanales. Caseros y deliciosos',
    items: [
      {
        id: 'chocotorta',
        name: 'Chocotorta',
        description: 'Chocotorta clásica con Dulce de Leche y Queso Crema',
        image: 'Chocotorta',
        badge: 'Más vendido',
        featured: true,
        sizes: {
          medium: '$7.000',
          large: 'N/A',
        },
      },
      {
        id: 'postre-oreo',
        name: 'Postre Oreo',
        description: 'Oreo en su base, Dulce de Leche y Crema',
        image: 'Oreo',
        badge: null,
        featured: false,
        sizes: {
          medium: '$7.000',
          large: 'N/A',
        },
      },
    ],
  },

  // ===== HELADOS =====
  {
    id: 'helados',
    name: 'Helados',
    icon: '🍦',
    accent: 'pink',
    description: 'Helados artesanales. Sabores intensos y cremosos',
    type: 'builder',
    builderType: 'icecream',
    sizes: [
      { id: '1', label: '1 bocha', price: 3000 },
      { id: '2', label: '2 bochas', price: 3500 },
      { id: '3', label: '3 bochas', price: 4000 },
    ],
    flavors: [
      { id: 'chocolate', label: 'Chocolate' },
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'americana', label: 'Americana' },
      { id: 'menta', label: 'Menta Granizada' },
      { id: 'ddl', label: 'Dulce de Leche' },
      { id: 'cielo', label: 'Crema del Cielo' },
    ],
    sauces: [
      { id: 'chocolate', label: 'Chocolate' },
      { id: 'caramelo', label: 'Caramelo' },
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'pistacho', label: 'Pistacho' },
      { id: 'ddl', label: 'Dulce de Leche' },
    ],
    cupTypes: [
      { id: 'barquillo', label: 'Vasito de Barquillo', description: 'Comestible y crujiente' },
      { id: 'papel', label: 'Vasito Ecológico', description: 'De papel reciclable' },
    ],
  },

  // ===== MEDIALUNAS =====
  {
    id: 'medialunas',
    name: 'Medialunas',
    icon: '🥐',
    accent: 'lilac',
    description: 'Medialunas recién horneadas. Crujientes y deliciosas',
    type: 'builder',
    builderType: 'medialunas',
    products: [
      { id: 'manteca', label: 'Medialuna de Manteca', pricePerUnit: 1500, discountAt: 6, discountAmount: 500 },
      { id: 'jyq', label: 'Medialuna de Jamón y Queso', pricePerUnit: 2000 },
    ],
  },

  // ===== TOSTADOS =====
  {
    id: 'tostados',
    name: 'Tostados',
    icon: '🥪',
    accent: 'lilac',
    description: 'Tostados de pan de miga con jamón y queso. Recién hechos',
    items: [
      {
        id: 'tostado-entero',
        name: 'Tostado',
        description: 'Pan de miga con jamón y queso, cortado en 4 triangulitos',
        image: 'Tostado',
        badge: null,
        featured: false,
        sizes: {
          medium: '$8.000',
          large: 'N/A',
        },
      },
      {
        id: 'tostado-medio',
        name: 'Medio Tostado',
        description: 'Pan de miga con jamón y queso, cortado en 2 triangulitos',
        image: 'Medio Tostado',
        badge: null,
        featured: false,
        sizes: {
          medium: '$4.000',
          large: 'N/A',
        },
      },
    ],
  },

  // ===== PASTELERÍA =====
  {
    id: 'pasteleria',
    name: 'Pastelería',
    icon: '🧁',
    accent: 'pink',
    type: 'builder',
    builderType: 'medialunas',
    description: 'Cookies, budines y scones de Zizu Pastelería',
    products: [
      {
        id: 'cookie-doble-choco',
        label: 'Cookie Doble Chocolate',
        pricePerUnit: 5000,
      },
      {
        id: 'cookie-red-velvet',
        label: 'Cookie Red Velvet',
        pricePerUnit: 5000,
      },
      {
        id: 'cookie-chips',
        label: 'Cookie Chips de Chocolate',
        pricePerUnit: 5000,
      },
      {
        id: 'budin-chips',
        label: 'Budín de Chips (porción)',
        pricePerUnit: 3000,
      },
      {
        id: 'budin-limon',
        label: 'Budín de Limón (porción)',
        pricePerUnit: 3000,
      },
      {
        id: 'scones-bolsa',
        label: 'Bolsita de Scones de Queso (x4)',
        pricePerUnit: 4000,
      },
    ],
  },
];

// =====================================================================
// PROMOCIONES
// =====================================================================
// Antes cada opción era texto suelto ('Negro', 'Oreo'). Eso hacía dos
// daños: la promo no se enteraba de que un producto estaba agotado, y
// al vender no quedaba registro de QUÉ se llevó realmente el cliente.
//
// Ahora cada opción apunta al producto de verdad (categoría + id), así:
//   - si falta el stock, la opción se tacha sola;
//   - si falta un componente fijo, la promo entera se apaga;
//   - cada venta deja anotado el desglose, así un cappuccino vendido
//     dentro de un combo cuenta igual que uno vendido suelto.
//
// Formato de un slot (lo que elige el cliente):
//   label     → título que se ve ("Café")
//   cat       → categoría de donde salen las opciones
//   opciones  → ids de producto. Con { producto, label } se acorta el
//               texto del chip sin perder el vínculo con el producto.
//   combos    → opciones que son más de un producto a la vez
//               (ej: "1 de cada una" = manteca + jamón y queso)
//
// fijos → lo que la promo incluye siempre y el cliente no elige.
// =====================================================================

const CAFE_CHICO = {
  label: 'Café',
  cat: 'cafe',
  opciones: [
    { producto: 'cafe-negro', label: 'Negro' },
    { producto: 'cafe-cortado', label: 'Cortado' },
    { producto: 'lagrima', label: 'Lágrima' },
  ],
};

const BUBBLE_GRANDE = {
  label: 'Bubble Tea',
  cat: 'bubble-tea',
  opciones: [
    { producto: 'brown-sugar', label: 'Brown Sugar' },
    { producto: 'matcha', label: 'Matcha' },
    { producto: 'frutilla', label: 'Frutilla' },
    { producto: 'thai', label: 'Thai' },
    { producto: 'oreo', label: 'Oreo' },
    { producto: 'taro', label: 'Taro' },
    { producto: 'chocolate', label: 'Chocolate' },
  ],
};

const WAFFLE_SIMPLE = {
  label: 'Waffle',
  cat: 'waffles',
  opciones: [
    { producto: 'frutilla', label: 'Frutilla' },
    { producto: 'oreo', label: 'Oreo' },
    { producto: 'nutella', label: 'Nutella' },
  ],
};

export const promociones = [
  {
    id: 'promo-cafe-medialunas',
    name: 'Café + 2 Medialunas',
    description: 'Café grande + 2 medialunas a elección',
    price: 6500,
    slots: [
      CAFE_CHICO,
      {
        label: 'Medialunas',
        cat: 'medialunas',
        opciones: [
          { producto: 'manteca', label: 'Manteca' },
          { producto: 'jyq', label: 'Jamón y Queso' },
        ],
        combos: [
          { id: 'mixta', label: '1 de cada una', productos: ['manteca', 'jyq'] },
        ],
      },
    ],
  },
  {
    id: 'promo-cafe-tostado',
    name: 'Café + Tostado',
    description: 'Café grande + 1 tostado completo',
    price: 11000,
    slots: [CAFE_CHICO],
    fijos: [{ cat: 'tostados', producto: 'tostado-entero' }],
  },
  {
    id: 'promo-cafe-waffle',
    name: 'Café + Waffle',
    description: 'Café grande + 1 waffle simple',
    price: 12000,
    slots: [CAFE_CHICO, WAFFLE_SIMPLE],
  },
  {
    id: 'promo-bubble-waffle',
    name: 'Bubble Tea + Waffle',
    description: 'Bubble Tea grande + 1 waffle simple',
    price: 18000,
    slots: [BUBBLE_GRANDE, WAFFLE_SIMPLE],
  },
  {
    id: 'promo-cafe-cookie-medialuna',
    name: 'Café + Cookie + Medialuna',
    description: 'Café grande + 1 cookie + 1 medialuna',
    price: 11000,
    slots: [
      CAFE_CHICO,
      {
        label: 'Cookie',
        cat: 'pasteleria',
        opciones: [
          { producto: 'cookie-doble-choco', label: 'Doble Chocolate' },
          { producto: 'cookie-red-velvet', label: 'Red Velvet' },
          { producto: 'cookie-chips', label: 'Chips de Chocolate' },
        ],
      },
      {
        label: 'Medialuna',
        cat: 'medialunas',
        opciones: [
          { producto: 'manteca', label: 'Manteca' },
          { producto: 'jyq', label: 'Jamón y Queso' },
        ],
      },
    ],
  },
  {
    id: 'promo-bubble-postre',
    name: 'Bubble Tea + Postre',
    description: 'Bubble Tea grande + 1 postre',
    price: 16000,
    slots: [
      BUBBLE_GRANDE,
      {
        label: 'Postre',
        cat: 'postres',
        opciones: [
          { producto: 'chocotorta', label: 'Chocotorta' },
          { producto: 'postre-oreo', label: 'Postre Oreo' },
        ],
      },
    ],
  },
  {
    id: 'promo-capuccino-budin',
    name: 'Capuccino + Budín',
    description: 'Capuccino + 1 porción de budín',
    price: 6500,
    slots: [
      {
        label: 'Budín',
        cat: 'pasteleria',
        opciones: [
          { producto: 'budin-chips', label: 'Chips de Chocolate' },
          { producto: 'budin-limon', label: 'Limón' },
        ],
      },
    ],
    fijos: [{ cat: 'cafe', producto: 'cappuccino' }],
  },
];

/**
 * Busca un producto por categoría e id, sin importar si la categoría lo
 * guarda en items, presets o products. Devuelve null si no existe, lo que
 * sirve para detectar promos que quedaron apuntando a algo borrado.
 */
export const buscarProducto = (categoriaId, productoId) => {
  const cat = menuCategories.find((c) => c.id === categoriaId);
  if (!cat) return null;
  const lista = cat.items?.length
    ? cat.items
    : cat.presets?.length
      ? cat.presets
      : (cat.products || []);
  const p = lista.find((x) => x.id === productoId);
  if (!p) return null;
  return { ...p, nombre: p.name || p.label, categoriaId, categoriaNombre: cat.name };
};

/** Normaliza las opciones de un slot a una forma única y fácil de recorrer. */
export const opcionesDeSlot = (slot) => {
  const armar = (productoId) => {
    const p = buscarProducto(slot.cat, productoId);
    return { cat: slot.cat, producto: productoId, nombre: p?.nombre || productoId };
  };

  const simples = (slot.opciones || []).map((o) => {
    const id = typeof o === 'string' ? o : o.producto;
    const p = buscarProducto(slot.cat, id);
    return {
      id,
      label: (typeof o === 'object' && o.label) || p?.nombre || id,
      productos: [armar(id)],
    };
  });

  const combos = (slot.combos || []).map((c) => ({
    id: c.id,
    label: c.label,
    productos: c.productos.map(armar),
  }));

  return [...simples, ...combos];
};

/** Los componentes fijos de una promo, ya resueltos con su nombre. */
export const fijosDePromo = (promo) =>
  (promo.fijos || []).map((f) => ({
    cat: f.cat,
    producto: f.producto,
    nombre: buscarProducto(f.cat, f.producto)?.nombre || f.producto,
  }));

/**
 * UTILIDADES PARA MENÚ
 * Funciones helper para filtrar y ordenar productos
 */

export const getProductsByCategory = (categoryId) => {
  const category = menuCategories.find((cat) => cat.id === categoryId);
  return category?.items || [];
};

export const getFeaturedProducts = () => {
  const featured = [];
  menuCategories.forEach((category) => {
    if (category.items && Array.isArray(category.items)) {
      const categoryFeatured = category.items
        .filter((item) => item.featured)
        .map((item) => ({ ...item, categoryId: category.id, categoryName: category.name }));
      featured.push(...categoryFeatured);
    }

    // Los armables (waffles) no tienen "items" sino "presets": combinaciones
    // ya listas. Van marcadas con isPreset porque la tarjeta las trata
    // distinto — el precio se calcula según la combinación, no viene fijo.
    if (category.presets && Array.isArray(category.presets)) {
      const presetsFeatured = category.presets
        .filter((preset) => preset.featured)
        .map((preset) => ({
          ...preset,
          categoryId: category.id,
          categoryName: category.name,
          isPreset: true,
        }));
      featured.push(...presetsFeatured);
    }
  });
  return featured;
};

export const getProductsByBadge = (badge) => {
  const products = [];
  menuCategories.forEach((category) => {
    // Solo procesar categorías con items (no builders)
    if (category.items && Array.isArray(category.items)) {
      const filtered = category.items
        .filter((item) => item.badge === badge)
        .map((item) => ({ ...item, categoryId: category.id }));
      products.push(...filtered);
    }
  });
  return products;
};

export const getCategoriesWithProducts = () => {
  return menuCategories.filter((cat) => cat.items && cat.items.length > 0);
};

export const getCategoriesEmpty = () => {
  return menuCategories.filter((cat) => !cat.items || cat.items.length === 0);
};

export const getTotalProducts = () => {
  return menuCategories.reduce((total, cat) => {
    if (cat.items && Array.isArray(cat.items)) {
      return total + cat.items.length;
    }
    return total;
  }, 0);
};

export const getTotalCategories = () => {
  return menuCategories.length;
};

/**
 * BUILDER CATEGORIES
 * Categorías con flujo interactivo personalizado
 */

export const getBuilderCategories = () => {
  return menuCategories.filter((cat) => cat.type === 'builder');
};
/**
 * Convierte un precio en texto ("$5.500") a número (5500).
 * Devuelve null si no se puede parsear ("Consultar", "N/A", etc.)
 */
export const parsePrice = (str) => {
  if (!str || typeof str !== 'string') return null;
  const digits = str.replace(/[^\d]/g, '');
  if (!digits) return null;
  return parseInt(digits, 10);
};

