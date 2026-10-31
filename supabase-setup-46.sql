-- =====================================================================
-- PARTE 46 — El conteo de la plata compara con lo que había al contar
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Hasta ahora el conteo se comparaba con el saldo "al cierre de ese día".
-- Si contabas al mediodía y a la noche se cargaba el cierre, el conteo
-- pasaba a dar faltante por las ventas de esa tarde (el 29/10: −101.500).
--
-- Ahora el saldo de un conteo es todo lo cargado hasta su día, menos lo que
-- generó el cierre de caja de ESE día (ventas, Uber, PedidosYa, envíos,
-- pagado con la caja) si se cargó después de contar y contaste ese mismo día. Los gastos y ajustes
-- cargados después sí cuentan: suelen ser cosas que pasaron antes de contar.
-- =====================================================================

create or replace function public.saldo_conteo(p_id bigint)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select public.saldo_al(c.fecha) - coalesce((
           select sum(case mv.tipo when 'ingreso' then mv.monto else -mv.monto end)
             from public.fin_movimientos mv
             join public.fin_categorias cat on cat.id = mv.categoria_id
            where cat.grupo <> 'saldo'
              and mv.origen = 'cierre'
              and mv.fecha = c.fecha
              and mv.creado_en > c.creado_en
              -- Sólo si contaste ese mismo día: un conteo cargado días después
              -- (como los primeros, del arranque) se compara con el día completo.
              and (c.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = c.fecha), 0)
    from public.fin_conteos c
   where c.id = p_id;
$$;

revoke all on function public.saldo_conteo(bigint) from public, anon;
grant execute on function public.saldo_conteo(bigint) to authenticated;
