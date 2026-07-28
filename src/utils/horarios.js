// =============================================
// src/utils/horarios.js
//
// Horarios del local + estado abierto/cerrado.
//
// IMPORTANTE: el estado se calcula SIEMPRE en hora de Argentina,
// no en la hora del celular. Si alguien abre el menú desde otro
// huso (o tiene el teléfono mal configurado) igual ve el estado real.
//
// Para cambiar horarios, tocar solo HORARIOS de acá abajo.
// =============================================

const TZ = 'America/Argentina/Buenos_Aires';

// dias: 0 = domingo, 1 = lunes ... 6 = sábado
export const HORARIOS = [
    { dias: [1, 2, 3, 4, 5], abre: '09:00', cierra: '19:00', label: 'Lunes a viernes' },
    { dias: [0, 6], abre: '10:00', cierra: '20:00', label: 'Sábados y domingos' },
];

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const aMinutos = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

/** Devuelve { dia, minutos } en hora de Argentina. */
function ahoraEnArgentina(date = new Date()) {
    try {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone: TZ,
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(date);

        const get = (t) => partes.find((p) => p.type === t)?.value;
        const dia = WEEKDAY_INDEX[get('weekday')];
        const hora = Number(get('hour')) % 24;
        const min = Number(get('minute'));

        if (dia == null || Number.isNaN(hora) || Number.isNaN(min)) throw new Error('bad parts');
        return { dia, minutos: hora * 60 + min };
    } catch {
        // Si el navegador no soporta timeZone, caemos a la hora local.
        return { dia: date.getDay(), minutos: date.getHours() * 60 + date.getMinutes() };
    }
}

const tramoDe = (dia) => HORARIOS.find((h) => h.dias.includes(dia)) || null;

/**
 * Estado del local ahora mismo.
 * { abierto, cierraA, abreA, diaApertura, minutosParaCerrar }
 */
export function getEstadoLocal(date = new Date()) {
    const { dia, minutos } = ahoraEnArgentina(date);
    const hoy = tramoDe(dia);

    if (hoy) {
        const abre = aMinutos(hoy.abre);
        const cierra = aMinutos(hoy.cierra);

        if (minutos >= abre && minutos < cierra) {
            return {
                abierto: true,
                cierraA: hoy.cierra,
                minutosParaCerrar: cierra - minutos,
                abreA: null,
                diaApertura: null,
            };
        }
        // Todavía no abrió hoy
        if (minutos < abre) {
            return { abierto: false, abreA: hoy.abre, diaApertura: 'hoy', cierraA: null };
        }
    }

    // Ya cerró (o hoy no abre): buscamos el próximo día con horario
    for (let i = 1; i <= 7; i++) {
        const d = (dia + i) % 7;
        const tramo = tramoDe(d);
        if (tramo) {
            return {
                abierto: false,
                abreA: tramo.abre,
                diaApertura: i === 1 ? 'mañana' : DIAS_ES[d],
                cierraA: null,
            };
        }
    }

    return { abierto: false, abreA: null, diaApertura: null, cierraA: null };
}

/** Texto corto para mostrar al lado del indicador. */
export function getTextoEstado(estado) {
    if (estado.abierto) {
        if (estado.minutosParaCerrar <= 30) return `Cierra ${estado.cierraA}`;
        return `Abierto hasta ${estado.cierraA}`;
    }
    if (estado.abreA) {
        return estado.diaApertura === 'hoy'
            ? `Abre hoy ${estado.abreA}`
            : `Abre ${estado.diaApertura} ${estado.abreA}`;
    }
    return 'Cerrado';
}
