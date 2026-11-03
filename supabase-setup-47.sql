-- =====================================================================
-- PARTE 47 — Gastos que pagó otra persona y se le devolvieron después
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Liliana hace compras para BüBa con su plata y trae los tickets; Agustín
-- se los devuelve todos juntos (en efectivo, después de contar). Cada ticket
-- se carga con su fecha (para la ganancia y la mercadería del mes) y:
--   · pagado_por   quién lo pagó ('Liliana'); null = lo pagó BüBa.
--   · devuelto_el  el día que BüBa se lo devolvió; null = se le debe.
--   · devuelto_en  cuándo se marcó la devolución (para los conteos del día).
--
-- Para la PLATA (saldo_al, conteos, saldo acumulado) esos gastos cuentan el
-- día de la devolución; mientras no se devuelven, no restan. Para la
-- GANANCIA siguen contando el día del ticket.
-- =====================================================================

alter table public.fin_movimientos
  add column if not exists pagado_por  text,
  add column if not exists devuelto_el date,
  add column if not exists devuelto_en timestamptz;

create or replace function public.saldo_al(p_fecha date)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(case mv.tipo when 'ingreso' then mv.monto else -mv.monto end), 0)
    from public.fin_movimientos mv
    join public.fin_categorias c on c.id = mv.categoria_id
   where c.grupo <> 'saldo'
     -- Lo que pagó otra persona sale de BüBa el día que se le devuelve.
     and (case when mv.pagado_por is null then mv.fecha else mv.devuelto_el end) <= p_fecha;
$$;

-- El conteo compara con lo que había al contar (parte 46): además del cierre
-- de ese día cargado después, deja afuera las devoluciones de ese mismo día
-- marcadas después de contar (se cuenta, da bien, y recién ahí se paga).
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
              and (c.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = c.fecha
              and (   (mv.origen = 'cierre' and mv.pagado_por is null and mv.fecha = c.fecha and mv.creado_en > c.creado_en)
                   or (mv.pagado_por is not null and mv.devuelto_el = c.fecha and mv.devuelto_en > c.creado_en))), 0)
    from public.fin_conteos c
   where c.id = p_id;
$$;

-- Resumen: la ganancia sigue por la fecha del ticket; el flujo y el saldo
-- acumulado (la plata), por la fecha en que salió de BüBa.
create or replace view public.fin_resultado_mensual with (security_invoker = on) as
 WITH m AS (
         SELECT date_trunc('month'::text, mv.fecha::timestamp with time zone)::date AS mes,
            sum(mv.monto) FILTER (WHERE mv.tipo = 'ingreso'::text AND c.id = 'ventas'::text) AS ventas,
            sum(mv.monto) FILTER (WHERE mv.tipo = 'ingreso'::text AND c.grupo = 'operativo'::text) AS ingresos_operativos,
            sum(mv.monto) FILTER (WHERE mv.tipo = 'egreso'::text AND c.grupo = 'operativo'::text) AS egresos_operativos,
            sum(mv.monto) FILTER (WHERE mv.tipo = 'egreso'::text AND c.grupo = 'personal'::text) AS retiros,
            sum(mv.monto) FILTER (WHERE mv.tipo = 'egreso'::text AND c.grupo = 'inversion'::text) AS inversiones,
            sum(CASE WHEN c.grupo = 'financiero'::text THEN CASE mv.tipo WHEN 'ingreso'::text THEN mv.monto ELSE - mv.monto END ELSE NULL::numeric END) AS financiero_neto,
            count(*) FILTER (WHERE mv.revisar) AS a_revisar
           FROM fin_movimientos mv
             JOIN fin_categorias c ON c.id = mv.categoria_id
          GROUP BY (date_trunc('month'::text, mv.fecha::timestamp with time zone)::date)
        ), f AS (
         SELECT date_trunc('month'::text, (CASE WHEN mv.pagado_por IS NULL THEN mv.fecha ELSE mv.devuelto_el END)::timestamp with time zone)::date AS mes,
            sum(CASE mv.tipo WHEN 'ingreso'::text THEN mv.monto ELSE - mv.monto END) AS flujo
           FROM fin_movimientos mv
             JOIN fin_categorias c ON c.id = mv.categoria_id
          WHERE c.grupo <> 'saldo'::text AND (mv.pagado_por IS NULL OR mv.devuelto_el IS NOT NULL)
          GROUP BY 1
        ), meses AS (
         SELECT m.mes FROM m UNION SELECT f.mes FROM f
        )
 SELECT meses.mes,
    COALESCE(m.ventas, 0::numeric) AS ventas,
    COALESCE(m.ingresos_operativos, 0::numeric) AS ingresos_operativos,
    COALESCE(m.egresos_operativos, 0::numeric) AS egresos_operativos,
    COALESCE(m.ingresos_operativos, 0::numeric) - COALESCE(m.egresos_operativos, 0::numeric) AS resultado_operativo,
    COALESCE(m.retiros, 0::numeric) AS retiros,
    COALESCE(m.inversiones, 0::numeric) AS inversiones,
    COALESCE(m.financiero_neto, 0::numeric) AS financiero_neto,
    COALESCE(f.flujo, 0::numeric) AS flujo,
    sum(COALESCE(f.flujo, 0::numeric)) OVER (ORDER BY meses.mes) AS saldo_acumulado,
    COALESCE(m.a_revisar, 0::bigint) AS a_revisar
   FROM meses
     LEFT JOIN m ON m.mes = meses.mes
     LEFT JOIN f ON f.mes = meses.mes
  ORDER BY meses.mes;
