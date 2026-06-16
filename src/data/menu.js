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
    items: [
      {
        id: 'brown-sugar',
        name: 'BüBa Brown Sugar',
        description: 'Té negro, leche y brown sugar.',
        image: 'Brown Sugar',
        badge: 'Recomendado',
        featured: true,
        sizes: {
          medium: '$5.500',
          large: 'Consultar',
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
          medium: 'Consultar',
          large: 'Consultar',
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
          medium: 'Consultar',
          large: 'Consultar',
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
          medium: 'Consultar',
          large: 'Consultar',
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
          medium: 'Consultar',
          large: 'Consultar',
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
          medium: 'Consultar',
          large: 'Consultar',
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
          medium: 'Consultar',
          large: 'Consultar',
        },
      },
    ],
  },

  // ===== CAFÉ CALIENTE =====
  {
    id: 'cafe',
    name: 'Café',
    icon: '☕',
    accent: 'pink',
    description: 'Café recién preparado. Espresso, lattes y especialidades',
    items: [
      {
        id: 'espresso-doble',
        name: 'Espresso Doble',
        description: 'Espresso puro y intenso. 2 shots.',
        image: 'Espresso',
        badge: null,
        featured: false,
        sizes: {
          medium: '$2.800',
          large: '$3.000',
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
          medium: '$3.500',
          large: '$4.000',
        },
      },{
        id: 'lagrima',
        name: 'Lagrima',
        description: 'Lágrima, leche vaporizada y espuma',
        image: 'Lágrima',
        badge: null,
        featured: false,
        sizes: {
          medium: '$3.500',
          large: '$4.000',
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
          medium: '$4.000',
          large: '$4.800',
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
          medium: '$4.000',
          large: '$4.800',
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
          medium: '$3.500',
          large: '$4.000',
        },
      },
      {
        id: 'latte',
        name: 'Latte Frío',
        description: 'Café frío con leche.',
        image: 'Latte',
        badge: 'Más vendido',
        featured: true,
        sizes: {
          medium: '$4.000',
          large: '$4.800',
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
          medium: '$4.200',
          large: '$5.000',
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
          medium: '$4.500',
          large: '$5.200',
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
          medium: '$4.500',
          large: '$5.200',
        },
      },
    ],
  },

  // ===== FRAPPUCCINOS =====
  {
    id: 'frappuccinos',
    name: 'Frappuccinos',
    icon: '🥤',
    accent: 'pink',
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
          medium: '$5.000',
          large: '$5.800',
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
          medium: '$6.200',
          large: '$7.000',
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
          medium: '$5.800',
          large: '$6.500',
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
          medium: '$5.300',
          large: '$6.000',
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
          medium: '$5.500',
          large: '$6.200',
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
    price: { simple: 3800, mixto: 4500 },
    fruits: [
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'banana', label: 'Banana' },
      { id: 'durazno', label: 'Durazno' },
      { id: 'mango', label: 'Mango' },
      { id: 'naranja', label: 'Naranja' },
      { id: 'anana', label: 'Ananá' },
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
    description: 'Elegí uno listo o armá el tuyo. Simple o mixto según lo que elijas',
    type: 'builder',
    builderType: 'waffle',
    price: { simple: 7000, mixto: 8000 },
    nutellaSaucePrice: 500,
    presets: [
      {
        id: 'frutilla',
        name: 'Waffle Frutilla',
        description: 'Crema chantilly, frutillas y salsa de chocolate',
        image: 'Frutilla',
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
        image: 'Oreo',
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
        image: 'Nutella',
        config: {
          rellenos: [{ id: 'nutella', type: 'nutella', label: 'Nutella' }],
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
    ],
    heladoFlavors: [
      { id: 'chocolate', label: 'Chocolate' },
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'americana', label: 'Americana' },
      { id: 'menta', label: 'Menta Granizada' },
      { id: 'ddl', label: 'Dulce de Leche' },
      { id: 'vainilla', label: 'Vainilla' },
    ],
    toppings: [
      { id: 'banana', label: 'Banana', group: 'Frutas' },
      { id: 'frutilla', label: 'Frutilla', group: 'Frutas' },
      { id: 'durazno', label: 'Durazno', group: 'Frutas' },
      { id: 'oreo', label: 'Oreo', group: 'Galletitas' },
      { id: 'chocolinas', label: 'Chocolinas', group: 'Galletitas' },
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
    accent: 'cyan',
    description: 'Postres artesanales. Caseros y deliciosos',
    items: [
      {
        id: 'chocotorta',
        name: 'Chocotorta',
        description: 'Chocotorta clásica con dulce de leche y crema',
        image: 'Chocotorta',
        badge: 'Más vendido',
        featured: true,
        sizes: {
          medium: '$5.500',
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
          medium: '$5.500',
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
      { id: '1', label: '1 bocha', price: 2500 },
      { id: '2', label: '2 bochas', price: 4500 },
      { id: '3', label: '3 bochas', price: 6000 },
    ],
    flavors: [
      { id: 'chocolate', label: 'Chocolate' },
      { id: 'frutilla', label: 'Frutilla' },
      { id: 'americana', label: 'Americana' },
      { id: 'menta', label: 'Menta Granizada' },
      { id: 'ddl', label: 'Dulce de Leche' },
      { id: 'vainilla', label: 'Vainilla' },
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
    accent: 'cyan',
    description: 'Medialunas recién horneadas. Crujientes y deliciosas',
    type: 'builder',
    builderType: 'medialunas',
    products: [
      { id: 'manteca', label: 'Medialuna de Manteca', pricePerUnit: 1000, discountAt: 6, discountAmount: 500 },
      { id: 'jyq', label: 'Medialuna de Jamón y Queso', pricePerUnit: 1500 },
    ],
  },

  // ===== TOSTADOS =====
  {
    id: 'tostados',
    name: 'Tostados',
    icon: '🥪',
    accent: 'pink',
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
          medium: '$3.000',
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
          medium: '$1.700',
          large: 'N/A',
        },
      },
    ],
  },
];

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
    // Solo procesar categorías con items (no builders)
    if (category.items && Array.isArray(category.items)) {
      const categoryFeatured = category.items
        .filter((item) => item.featured)
        .map((item) => ({ ...item, categoryId: category.id, categoryName: category.name }));
      featured.push(...categoryFeatured);
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

