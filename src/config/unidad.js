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
// ahí la unidad sí se guarda, porque se configura una vez y no cambia, y
// manda sobre el ?unidad= de un QR que se abra en ese aparato.
//
// CÓMO SE CONFIGURA
//
//   iPad del local        →  /?mostrador=1      (o /?unidad=local&mostrador=1)
//   Tablet del food truck →  /?unidad=food_truck&mostrador=1
//   QR del food truck     →  /?unidad=food_truck
//   QR del local          →  /            (los valores por defecto)
//   Apagar el modo        →  /?mostrador=0
//
// Un link con mostrador=1 configura el aparato ENTERO: si no dice unidad, es
// el local. Antes "/?mostrador=1" respetaba la unidad guardada, y un aparato
// que alguna vez abrió el link del truck quedaba en el truck aunque después
// se abriera el del local (27/09).
//
// También se puede cambiar sin links, desde el panel de pedidos con la
// sesión iniciada: configurarAparato().
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
    const enURL = params.get('unidad');
    const deURL = UNIDADES.includes(enURL) ? enURL : null;
    if (flag === '1') {
        guardar(CANAL_KEY, 'mostrador');
        guardar(UNIDAD_KEY, deURL || 'local');
    } else if (flag === '0') {
        // Apagar el modo también olvida la unidad: el aparato vuelve a ser
        // uno cualquiera y no tiene por qué seguir diciendo "food truck".
        borrar(CANAL_KEY);
        borrar(UNIDAD_KEY);
    }
    const canal = leer(CANAL_KEY) === 'mostrador' ? 'mostrador' : 'qr';

    // --- unidad ---
    let unidad;
    if (canal === 'mostrador') {
        // El aparato del personal sólo cambia de unidad con un link de
        // mostrador (arriba) o desde el panel: abrir el QR del truck en el
        // iPad del local no lo convierte en el truck.
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

/**
 * Cambiar qué es este aparato sin tocar links (panel de pedidos, con la
 * sesión del dueño). unidad = 'local' | 'food_truck' lo deja como mostrador
 * de esa unidad; null lo vuelve un aparato cualquiera (cuenta como QR).
 * Recarga en "/" sin parámetros: si recargara la URL actual, un
 * ?unidad=...&mostrador=1 viejo volvería a pisar lo elegido.
 */
export function configurarAparato(unidad) {
    if (unidad && UNIDADES.includes(unidad)) {
        guardar(CANAL_KEY, 'mostrador');
        guardar(UNIDAD_KEY, unidad);
    } else {
        borrar(CANAL_KEY);
        borrar(UNIDAD_KEY);
    }
    window.location.replace(window.location.pathname);
}
export const getCanal = () => actual.canal;
export const esMostrador = () => actual.canal === 'mostrador';
