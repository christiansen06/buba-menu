-- =====================================================================
-- PARTE 24 — La liquidación semanal de Uber, aparte dentro del cierre
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- Cómo llega la plata de Uber: una vez por semana, junto con el resto de lo
-- que se pasa a Brubank. En el cierre de ese día va dentro de
-- "Transferencias", como siempre. Lo nuevo es un campo opcional para decir
-- CUÁNTO de eso fue Uber:
--
--   uber_liquidacion  (incluido en transferencias, nunca mayor)
--
-- y el libro (fin_movimientos) lo anota separado:
--   'cierre:DIA:UNIDAD'  Cierre de Caja            total_declarado − uber_liquidacion
--   'uber:DIA:UNIDAD'    Liquidación Uber Eats     uber_liquidacion
--
-- La suma es la misma de siempre: la plata no se cuenta dos veces. Sólo
-- queda a la vista cuánto entra por Uber, y la diferencia contra el menú
-- de ese día no se infla con una semana entera de Uber.
-- =====================================================================

alter table public.cierres_caja
  add column if not exists uber_liquidacion integer not null default 0;

alter table public.cierres_caja drop constraint if exists cierres_caja_uber_liquidacion_valida;
alter table public.cierres_caja add constraint cierres_caja_uber_liquidacion_valida
  check (uber_liquidacion >= 0 and uber_liquidacion <= coalesce(transferencias, 0));

comment on column public.cierres_caja.uber_liquidacion is
  'Parte de "transferencias" que fue la liquidación semanal de Uber Eats (parte 24).';


create or replace function public.fin_cierre_a_movimiento()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uber integer := coalesce(new.uber_liquidacion, 0);
  v_ref_uber text := 'uber:' || new.dia || ':' || new.unidad;
begin
  insert into public.fin_movimientos
    (fecha, tipo, categoria_id, descripcion, monto, unidad, origen, origen_ref, revisar)
  values (
    new.dia, 'ingreso', 'ventas',
    case when new.unidad = 'food_truck' then 'Cierre de Caja · Food Truck' else 'Cierre de Caja' end,
    coalesce(new.total_declarado, 0) - v_uber,
    new.unidad,
    'cierre',
    'cierre:' || new.dia || ':' || new.unidad,
    false
  )
  on conflict (origen_ref) do update
    set monto          = excluded.monto,
        fecha          = excluded.fecha,
        unidad         = excluded.unidad,
        origen         = 'cierre',
        actualizado_en = now();

  if v_uber > 0 then
    insert into public.fin_movimientos
      (fecha, tipo, categoria_id, descripcion, contraparte, monto, unidad, origen, origen_ref, revisar)
    values (new.dia, 'ingreso', 'ventas', 'Liquidación Uber Eats', 'Uber Eats', v_uber, new.unidad, 'cierre', v_ref_uber, false)
    on conflict (origen_ref) do update
      set monto = excluded.monto, fecha = excluded.fecha, actualizado_en = now();
  else
    -- Se sacó la liquidación de este cierre: la fila derivada se va (la
    -- plata vuelve a quedar dentro del "Cierre de Caja" de arriba).
    delete from public.fin_movimientos where origen_ref = v_ref_uber;
  end if;
  return new;
end;
$$;


-- cierre_vs_sistema + uber_liquidacion (al final)
create or replace view public.cierre_vs_sistema
with (security_invoker = on) as
with sistema as (
  select
    (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
    coalesce(unidad, 'local')                                       as unidad,
    count(*)                                                        as pedidos,
    sum(total)                                                      as facturado,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'), 0) as posnet,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'uber'), 0)   as uber
  from public.ventas
  group by 1, 2
)
select
  coalesce(c.dia, s.dia)        as dia,
  coalesce(c.unidad, s.unidad)  as unidad,
  c.caja_inicio,
  c.efectivo_final,
  c.transferencias,
  c.debito,
  c.total_declarado,
  c.caja_siguiente,
  coalesce(s.pedidos, 0)        as pedidos_sistema,
  coalesce(s.facturado, 0)      as total_sistema,
  c.total_declarado - coalesce(s.facturado, 0)                                    as diferencia,
  round(100.0 * coalesce(s.facturado, 0) / nullif(c.total_declarado, 0))          as sistema_sobre_caja_pct,
  case when c.dia is null then 'sin cierre' else 'cerrado' end                    as estado_cierre,
  c.notas,
  coalesce(s.posnet, 0)         as total_sistema_posnet,
  coalesce(s.uber, 0)           as total_sistema_uber,
  coalesce(c.uber_liquidacion, 0) as uber_liquidacion
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
order by 1 desc, 2;


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
-- 1. Volver a juntar lo de Uber en el Cierre de Caja:
update public.cierres_caja set uber_liquidacion = 0 where uber_liquidacion > 0;   -- el trigger borra las filas 'uber:'
-- 2. Trigger de la parte 20 y vista de la parte 22 (drop view antes: se saca una columna).
alter table public.cierres_caja drop constraint if exists cierres_caja_uber_liquidacion_valida;
alter table public.cierres_caja drop column if exists uber_liquidacion;
*/
