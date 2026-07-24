// =============================================
// src/utils/productImages.js
//
// FOTOS DE PRODUCTOS — cómo funciona:
// Soltá las imágenes en la carpeta  src/assets/productos/
// con el nombre del producto como nombre de archivo.
//
// Sirve el id, el nombre o el campo "image" del producto
// (mayúsculas, tildes y espacios no importan). Ejemplos:
//   brown-sugar.png          → BüBa Brown Sugar
//   BüBa Matcha.jpg          → BüBa Matcha
//   waffle clasico.webp      → Waffle Clásico
//
// Formatos aceptados: png, jpg, jpeg, webp, avif.
// Si un producto no tiene foto, la tarjeta muestra el
// placeholder de color de siempre.
// =============================================

const files = import.meta.glob(
    '../assets/productos/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG,WEBP,AVIF}',
    { eager: true, query: '?url', import: 'default' }
);

// 'BüBa Brown Sugar!' → 'buba-brown-sugar'
const normalize = (s) =>
    String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-+|-+$)/g, '');

const imageMap = {};
Object.entries(files).forEach(([path, url]) => {
    const base = path.split('/').pop().replace(/\.[^.]+$/, '');
    imageMap[normalize(base)] = url;
});

export function getProductImage(item, categoryId) {
    const keys = [
        categoryId && item.id ? `${categoryId}-${item.id}` : null,
        item.id,
        item.image,
        item.name,
    ].filter(Boolean);

    for (const key of keys) {
        const url = imageMap[normalize(key)];
        if (url) return url;
    }
    return null;
}
