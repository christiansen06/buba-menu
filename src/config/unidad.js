// =============================================
// src/config/unidad.js
//
// De dónde salió el pedido. Dos marcas independientes:
//
//   unidad → 'local' | 'food_truck'   ... QUÉ negocio
//   canal  → 'mostrador' | 'qr'       ... QUIÉN lo cargó (el personal o el cliente)
//
// POR QUÉ HACEN FALTA
//
// En diciembre el food truck vuelve a operar en simultáneo con el local.
// Hasta ahora las dos unidades se distinguían por fecha porque nunca
// coincidieron; a partir de ahí, sin "unidad", las ventas de las dos se
// mezclan y no se separan nunca más.
//
// "canal" es otra cosa: hoy se registran ~11 pedidos por día, y la sospecha
// es que una parte de las ventas se cobra en el mostrador sin pasar nunca
// por el QR. Sin esta marca no hay forma de confirmarlo ni descartarlo.
//
// POR QUÉ UNA SE GUARDA Y LA OTRA NO
//
// El flag de mostrador se configura UNA VEZ en el dispositivo del local y
// tiene que sobrevivir: va a localStorage.
//
// La unidad, en cambio, NO se guarda para el cliente. El QR del food truck
// lleva ?unidad=food_truck siempre, así que se lee de la URL en cada visita.
// Si se guardara, alguien que escaneó el QR del truck y después abre el menú
// en el local seguiría contando como food truck para siempre.
//
// La excepción es el dispositivo del personal (el que tiene mostrador=1):
// ahí la unidad sí se guarda, porque se configura una vez y no cambia.
//
// CÓMO SE CONFIGURA
//
//   iPad del local        →  /?mostrador=1
//   Tablet del food truck →  /?unidad=food_truck&mostrador=1
//   QR del food truck     →  /?unidad=food_truck
//   QR del local          →  /            (los valores por defecto)
//   Apagar el modo        →  /?mostrador=0
// =============================================

const CANAL_KEY = 'buba-canal';
const UNIDAD_KEY = 'buba-unidad';

const UNIDADES = ['local', 'food_truck'];

export const UNIDAD_LABEL = {
    local: '🏠 Local',
    food_truck: '🚚 Food Truck',
};

// localStorage puede tirar excepción en navegación privada o con las cookies
// bloqueadas. Mismo criterio que el resto de la app: si falla, se sigue.
function leer(clave) {
    try {
        return localStorage.getItem(clave);
    } catch {
        return null;
    }
}

function guardar(clave, valor) {
    try {
        localStorage.setItem(clave, valor);
    } catch {
        // ignore
    }
}

function borrar(clave) {
    try {
        localStorage.removeItem(clave);
    } catch {
        // ignore
    }
}

function resolver() {
    let params;
    try {
        params = new URLSearchParams(window.location.search);
    } catch {
        params = new URLSearchParams();
    }

    // --- canal ---
    const flag = params.get('mostrador');
    if (flag === '1') {
        guardar(CANAL_KEY, 'mostrador');
    } else if (flag === '0') {
        // Apagar el modo también olvida la unidad: el aparato vuelve a ser
        // uno cualquiera y no tiene por qué seguir diciendo "food truck".
        borrar(CANAL_KEY);
        borrar(UNIDAD_KEY);
    }
    const canal = leer(CANAL_KEY) === 'mostrador' ? 'mostrador' : 'qr';

    // --- unidad ---
    const enURL = params.get('unidad');
    const deURL = UNIDADES.includes(enURL) ? enURL : null;

    let unidad;
    if (canal === 'mostrador') {
        if (deURL) guardar(UNIDAD_KEY, deURL);
        const guardada = leer(UNIDAD_KEY);
        unidad = UNIDADES.includes(guardada) ? guardada : 'local';
    } else {
        unidad = deURL || 'local';
    }

    return { unidad, canal };
}

// Se resuelve una sola vez al cargar la página: ni la URL ni la marca del
// dispositivo cambian en el medio de una visita.
const actual = resolver();

export const getUnidad = () => actual.unidad;
export const getCanal = () => actual.canal;
export const esMostrador = () => actual.canal === 'mostrador';
