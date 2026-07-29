// =============================================
// src/utils/supabase.js
//
// Conexión con la base de datos (Supabase).
//
// REGLA IMPORTANTE: el menú tiene que funcionar SIEMPRE, aunque
// Supabase esté caído o sin configurar. Nada de lo que hay acá
// puede romper la carta. Si algo falla, se ignora en silencio y
// la app sigue como antes.
// =============================================

import { createClient } from '@supabase/supabase-js';

// El ?. es a propósito: import.meta.env sólo existe cuando la app corre
// con Vite. Sin él, este archivo explota si se lo importa desde un script
// suelto de Node (por ejemplo para probar cosas fuera del navegador).
const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_KEY;

/** true si hay credenciales cargadas. Si no, la app anda igual, sin base. */
export const hayBase = Boolean(url && key);

export const supabase = hayBase
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true },
    })
    : null;

/** Clave única de un producto: la categoría evita chocar ids repetidos. */
export const claveProducto = (categoriaId, productoId) => `${categoriaId}:${productoId}`;
