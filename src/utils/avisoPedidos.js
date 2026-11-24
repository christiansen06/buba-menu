// =============================================
// src/utils/avisoPedidos.js
//
// Aviso de pedidos nuevos en el aparato del mostrador.
//
// Cada 20 segundos se fija si entraron pedidos del QR de esta unidad desde
// la última vez que se abrió el panel. Si hay uno nuevo:
//   · suena un "ding-dong" (y vibra, si el aparato puede)
//   · el botón "Pedidos" muestra un círculo con cuántos hay sin mirar
//   · el título de la pestaña lleva el número: "(2) BüBa"
// Al abrir el panel de esa unidad quedan todos vistos.
//
// Los pedidos que carga el propio mostrador no avisan: los cargó quien está
// parado ahí. Sólo cuentan los del QR (los que "entran").
//
// Necesita la sesión del panel guardada en el aparato (la base no deja leer
// pedidos sin ella). Sin sesión, sin base o fuera del mostrador, no hace nada.
// =============================================

import { supabase, hayBase } from './supabase.js';
import { esMostrador, getUnidad } from '../config/unidad.js';

export const EVENTO_NUEVOS = 'buba-pedidos-nuevos';
const CADA_MS = 20000;
const DOCE_HORAS = 12 * 60 * 60 * 1000;
const claveVisto = () => `buba-pedidos-visto-${getUnidad()}`;

let sinVer = [];             // ids de pedidos del QR sin mirar
let primeraVuelta = true;    // al arrancar no suena: puede haber pedidos de antes
let consultando = false;
let armado = false;
let tituloBase = '';

function leerVisto() {
    try {
        const v = localStorage.getItem(claveVisto());
        if (v) return v;
        // Primera vez en este aparato: se empieza desde ahora, sin contar lo viejo.
        const ahora = new Date().toISOString();
        localStorage.setItem(claveVisto(), ahora);
        return ahora;
    } catch {
        return new Date(Date.now() - DOCE_HORAS).toISOString();
    }
}

/** Cuántos pedidos hay sin mirar (para pintar el círculo). */
export const pedidosSinVer = () => sinVer.length;

/**
 * Desde cuándo cuenta un pedido como "sin mirar". El panel lo lee al abrirse
 * para marcar como 🆕 los que entraron desde la última vez.
 */
export function vistoDesde() {
    if (typeof window === 'undefined') return null;
    return leerVisto();
}

function avisar(hayNuevos) {
    if (typeof document !== 'undefined') {
        if (!tituloBase) tituloBase = document.title.replace(/^\(\d+\)\s*/, '');
        document.title = sinVer.length ? `(${sinVer.length}) ${tituloBase}` : tituloBase;
    }
    window.dispatchEvent(new CustomEvent(EVENTO_NUEVOS, { detail: { n: sinVer.length, hayNuevos } }));
}

/** Al abrir el panel de la unidad del aparato: todo visto. */
export function marcarVistos() {
    try { localStorage.setItem(claveVisto(), new Date().toISOString()); } catch { /* sin memoria: igual se limpia */ }
    if (sinVer.length) {
        sinVer = [];
        avisar(false);
    }
}

/* ---------- el sonido ---------- */

let audio = null;

/**
 * Los navegadores no dejan sonar nada hasta que la persona toca la pantalla.
 * En el mostrador se toca todo el tiempo: con el primer toque queda habilitado.
 */
function desbloquearSonido() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!audio) audio = new AC();
        if (audio.state === 'suspended') void audio.resume();
    } catch { /* sin sonido */ }
}

/** "Ding-dong" corto, hecho a mano: no hace falta ningún archivo de audio. */
export function sonarAviso() {
    try {
        desbloquearSonido();
        if (audio && audio.state === 'running') {
            const t0 = audio.currentTime;
            [[988, 0], [784, 0.22]].forEach(([freq, demora]) => {
                const osc = audio.createOscillator();
                const vol = audio.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                vol.gain.setValueAtTime(0.0001, t0 + demora);
                vol.gain.exponentialRampToValueAtTime(0.5, t0 + demora + 0.02);
                vol.gain.exponentialRampToValueAtTime(0.0001, t0 + demora + 0.6);
                osc.connect(vol).connect(audio.destination);
                osc.start(t0 + demora);
                osc.stop(t0 + demora + 0.65);
            });
        }
        navigator.vibrate?.([200, 100, 200]);
    } catch { /* sin sonido */ }
}

/* ---------- la consulta ---------- */

async function consultar() {
    if (consultando) return;
    consultando = true;
    try {
        const { data: s } = await supabase.auth.getSession();
        if (!s?.session) return;
        // Nunca más de 12 horas para atrás: si el panel no se abre en días,
        // el círculo no junta pedidos de otras jornadas.
        const visto = leerVisto();
        const tope = new Date(Date.now() - DOCE_HORAS).toISOString();
        const desde = visto > tope ? visto : tope;
        const { data, error } = await supabase
            .from('pedidos')
            .select('id')
            .eq('unidad', getUnidad())
            .eq('canal', 'qr')
            .is('plataforma', null)
            .neq('estado', 'cancelado')
            .gt('creado_en', desde)
            .limit(50);
        if (error || !data) return;
        const antes = new Set(sinVer);
        const ids = data.map((p) => p.id);
        const hayNuevos = ids.some((id) => !antes.has(id));
        const cambio = hayNuevos || ids.length !== sinVer.length;
        sinVer = ids;
        if (hayNuevos && !primeraVuelta) sonarAviso();
        if (cambio || primeraVuelta) avisar(hayNuevos && !primeraVuelta);
        primeraVuelta = false;
    } catch {
        // sin señal: se reintenta en la próxima vuelta
    } finally {
        consultando = false;
    }
}

/** Fijarse ya (por ejemplo, después de que el panel cambió algo). */
export const revisarPedidosNuevos = () => (armado ? consultar() : undefined);

/** Arranca la revisión periódica. Se llama una vez al cargar la app. */
export function iniciarAvisoPedidos() {
    if (armado || !hayBase || typeof window === 'undefined' || !esMostrador()) return;
    armado = true;
    window.addEventListener('pointerdown', desbloquearSonido, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void consultar();
    });
    window.addEventListener('online', () => { void consultar(); });
    void consultar();
    setInterval(() => { void consultar(); }, CADA_MS);
}
