import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, hayBase, claveProducto } from '../utils/supabase.js';
import { insumoDe, insumosDeProducto } from '../data/insumos.js';

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
    const [insumosAgotados, setInsumosAgotados] = useState(() => new Set());
    const [cargando, setCargando] = useState(hayBase);

    const cargar = useCallback(async () => {
        if (!hayBase) return;
        try {
            const [prod, ins] = await Promise.all([
                supabase.from('disponibilidad').select('categoria_id, producto_id, disponible'),
                supabase.from('insumos').select('id, disponible'),
            ]);

            if (prod.error) throw prod.error;

            const set = new Set();
            (prod.data || []).forEach((fila) => {
                if (fila.disponible === false) set.add(claveProducto(fila.categoria_id, fila.producto_id));
            });
            setAgotados(set);

            // Si la tabla de insumos todavía no existe, seguimos sin ella.
            if (!ins.error) {
                const si = new Set();
                (ins.data || []).forEach((f) => { if (f.disponible === false) si.add(f.id); });
                setInsumosAgotados(si);
            }
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

    /** Marca / desmarca un insumo (materia prima). Requiere estar logueado. */
    const marcarInsumo = useCallback(async (insumoId, disponible) => {
        if (!hayBase) return { error: 'Sin conexión a la base' };

        const { error } = await supabase
            .from('insumos')
            .upsert({ id: insumoId, disponible, actualizado_en: new Date().toISOString() }, { onConflict: 'id' });

        if (error) return { error: error.message };

        setInsumosAgotados((prev) => {
            const next = new Set(prev);
            if (disponible) next.delete(insumoId); else next.add(insumoId);
            return next;
        });
        return {};
    }, []);

    const valor = useMemo(() => {
        const insumoFalta = (id) => Boolean(id) && insumosAgotados.has(id);

        return {
            agotados,
            insumosAgotados,
            cargando,
            recargar: cargar,
            marcar,
            marcarInsumo,
            insumoFalta,

            /** Una opción de armable (relleno, topping, salsa, sabor...). */
            opcionAgotada: (categoriaId, campo, opcionId) =>
                insumoFalta(insumoDe(categoriaId, campo, opcionId)),

            /**
             * Un producto de la carta está agotado si lo marcaste a mano,
             * si lo dice menu.js, o si le falta alguno de sus insumos.
             */
            estaAgotado: (categoriaId, productoId, item) =>
                item?.disponible === false ||
                agotados.has(claveProducto(categoriaId, productoId)) ||
                insumosDeProducto(categoriaId, productoId).some(insumoFalta),
        };
    }, [agotados, insumosAgotados, cargando, cargar, marcar, marcarInsumo]);

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
    return ctx || {
        agotados: new Set(),
        insumosAgotados: new Set(),
        cargando: false,
        estaAgotado: () => false,
        opcionAgotada: () => false,
        insumoFalta: () => false,
        marcar: async () => ({}),
        marcarInsumo: async () => ({}),
        recargar: () => {},
    };
}
