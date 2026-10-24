// =============================================
// src/utils/opcionImages.js
//
// FOTOS DE LAS OPCIONES DEL WAFFLE (rellenos, toppings y salsas).
// Soltá la foto en  src/assets/opciones/  con el nombre
// <paso>-<id>, y aparece sola en el círculo de esa opción:
//   topping-kinder.webp      relleno-nutella.webp
//   relleno-helado.webp      salsa-caramelo.webp
//
// Va el paso adelante porque hay ids repetidos entre pasos: "frutilla" es
// topping y salsa; "ddl" y "nutella", relleno y salsa.
// Sin foto, se muestra el emoji de siempre.
// Formato: webp cuadrado de 160x160, menos de 10 KB.
// =============================================

const files = import.meta.glob(
    '../assets/opciones/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG,WEBP,AVIF}',
    { eager: true, query: '?url', import: 'default' }
);

const imageMap = {};
Object.entries(files).forEach(([path, url]) => {
    imageMap[path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase()] = url;
});

/** @param paso 'relleno' | 'topping' | 'salsa' */
export function getOpcionImage(paso, id) {
    return imageMap[`${paso}-${id}`] || null;
}
