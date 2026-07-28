import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, hayBase, claveProducto } from '../utils/supabase.js';

const DisponibilidadContext = createContext(null);

/**
 * Qué productos están sin stock.
 *
 * Se lee de Supabase al abrir el menú. Si la base no responde o no está
 * configurada, se asume que HAY stock de todo y la carta funciona igual
 * que siempre: nunca dejamos el menú roto por un problema de conexión.
 *
 * También se puede marcar sin stock desde el código, poniendo
 * disponible: false en menu.js. Manda cualquiera de los dos.
 */
export function DisponibilidadProvider({ children }) {
    const [agotados, setAgotados] = useState(() => new Set());
    const [cargando, setCargando] = useState(hayBase);

    const cargar = useCallback(async () => {
        if (!hayBase) return;
        try {
            const { data, error } = await supabase
                .from('disponibilidad')
                .select('categoria_id, producto_id, disponible');

            if (error) throw error;

            const set = new Set();
            (data || []).forEach((fila) => {
                if (fila.disponible === false) set.add(claveProducto(fila.categoria_id, fila.producto_id));
            });
            setAgotados(set);
        } catch (e) {
            // Silencio a propósito: la carta sigue andando con todo disponible.
            console.warn('No se pudo leer la disponibilidad:', e?.message || e);
        } finally {
            setCargando(false);
        }
    }, []);

    // Pedirle datos a un servidor al abrir la app es justamente para lo que
    // sirven los efectos. El setState ocurre cuando responde la base, no
    // sincrónicamente, así que la regla no aplica acá.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { cargar(); }, [cargar]);

    /** Marca / desmarca sin stock. Requiere estar logueado (lo exige la base). */
    const marcar = useCallback(async (categoriaId, productoId, disponible) => {
        if (!hayBase) return { error: 'Sin conexión a la base' };

        const { error } = await supabase
            .from('disponibilidad')
            .upsert(
                {
                    categoria_id: categoriaId,
                    producto_id: productoId,
                    disponible,
                    actualizado_en: new Date().toISOString(),
                },
                { onConflict: 'categoria_id,producto_id' }
            );

        if (error) return { error: error.message };

        setAgotados((prev) => {
            const next = new Set(prev);
            const k = claveProducto(categoriaId, productoId);
            if (disponible) next.delete(k); else next.add(k);
            return next;
        });
        return {};
    }, []);

    const valor = useMemo(() => ({
        agotados,
        cargando,
        recargar: cargar,
        marcar,
        estaAgotado: (categoriaId, productoId, item) =>
            item?.disponible === false || agotados.has(claveProducto(categoriaId, productoId)),
    }), [agotados, cargando, cargar, marcar]);

    return (
        <DisponibilidadContext.Provider value={valor}>
            {children}
        </DisponibilidadContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDisponibilidad() {
    const ctx = useContext(DisponibilidadContext);
    // Si alguien usa el hook fuera del provider, devolvemos algo inofensivo.
    return ctx || { agotados: new Set(), cargando: false, estaAgotado: () => false, marcar: async () => ({}), recargar: () => {} };
}
