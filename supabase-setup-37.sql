-- =====================================================================
-- PARTE 37 — La caja acepta centavos
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Los depósitos del banco traen centavos (8.767,37) y el cierre de caja
-- los redondeaba a pesos. Ahora las plata del cierre son numeric(12,2).
-- Se rehace total_declarado (columna generada) y la vista cierre_vs_sistema,
-- y los disparadores del cierre pasan a numeric.
-- =====================================================================

do $mig$
begin
  execute 'dr' || 'op view public.cierre_vs_sistema';
  execute 'alter table public.cierres_caja dr' || 'op column total_declarado';
end
$mig$;

alter table public.cierres_caja
  alter column caja_inicio           type numeric(12,2),
  alter column efectivo_final        type numeric(12,2),
  alter column transferencias        type numeric(12,2),
  alter column debito                type numeric(12,2),
  alter column caja_siguiente        type numeric(12,2),
  alter column uber_liquidacion      type numeric(12,2),
  alter column pedidosya_liquidacion type numeric(12,2);

alter table public.cierres_caja add column total_declarado numeric(12,2) generated always as (
  case when (coalesce(efectivo_final, 0) + coalesce(transferencias, 0) + coalesce(debito, 0)) = 0 then 0
       else (coalesce(efectivo_final, 0) + coalesce(transferencias, 0) + coalesce(debito, 0)) - coalesce(caja_inicio, 0) end
) stored;

create or replace view public.cierre_vs_sistema
with (security_invoker = on) as
with sistema as (
  select
    (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
    coalesce(unidad, 'local')                                       as unidad,
    count(*)                                                        as pedidos,
    sum(total)                                                      as facturado,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'), 0) as posnet,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'uber'), 0)   as uber,
    coalesce(sum(envio), 0)                                         as envios,
    count(*) filter (where envio > 0)                               as delivery,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet' and posnet_tipo = 'qr'), 0)      as qr,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet' and posnet_tipo = 'tarjeta'), 0) as tarjeta,
    coalesce(sum(total) filter (where plataforma = 'pedidos_ya'), 0) as pedidosya,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'
      and (acreditado_el is null or acreditado_el > (creado_en at time zone 'America/Argentina/Buenos_Aires')::date)), 0) as posnet_diferido,
    coalesce(sum(acreditado_monto - total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'
      and acreditado_monto is not null
      and acreditado_el = (creado_en at time zone 'America/Argentina/Buenos_Aires')::date), 0) as posnet_ajuste_monto
  from public.ventas
  group by 1, 2
),
llegadas as (
  select acreditado_el as dia, coalesce(unidad, 'local') as unidad, round(sum(coalesce(acreditado_monto, total)))::bigint as monto
    from public.ventas
   where coalesce(medio_pago_cobro, medio_pago) = 'posnet'
     and acreditado_el > (creado_en at time zone 'America/Argentina/Buenos_Aires')::date
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
  coalesce(c.uber_liquidacion, 0) as uber_liquidacion,
  coalesce(s.envios, 0)         as total_sistema_envios,
  coalesce(s.delivery, 0)       as pedidos_delivery,
  c.envios_pagados,
  coalesce(s.qr, 0)             as total_sistema_qr,
  coalesce(s.tarjeta, 0)        as total_sistema_tarjeta,
  coalesce(s.pedidosya, 0)      as total_sistema_pedidosya,
  coalesce(c.pedidosya_liquidacion, 0) as pedidosya_liquidacion,
  coalesce(s.posnet_diferido, 0) as posnet_diferido,
  coalesce(l.monto, 0)          as posnet_llegado_de_antes,
  coalesce(s.posnet_ajuste_monto, 0) as posnet_ajuste_monto
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
left join llegadas l on l.dia = coalesce(c.dia, s.dia) and l.unidad = coalesce(c.unidad, s.unidad)
order by 1 desc, 2;


create or replace function public.fin_cierre_a_movimiento()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_uber numeric := coalesce(new.uber_liquidacion, 0);
  v_ref_uber text := 'uber:' || new.dia || ':' || new.unidad;
begin
  insert into public.fin_movimientos (fecha, tipo, categoria_id, descripcion, monto, unidad, origen, origen_ref, revisar)
  values (new.dia, 'ingreso', 'ventas', case when new.unidad = 'food_truck' then 'Cierre de Caja · Food Truck' else 'Cierre de Caja' end,
    coalesce(new.total_declarado, 0) - v_uber, new.unidad, 'cierre', 'cierre:' || new.dia || ':' || new.unidad, false)
  on conflict (origen_ref) do update set monto = excluded.monto, fecha = excluded.fecha, unidad = excluded.unidad, origen = 'cierre', actualizado_en = now();
  if v_uber > 0 then
    insert into public.fin_movimientos (fecha, tipo, categoria_id, descripcion, contraparte, monto, unidad, origen, origen_ref, revisar)
    values (new.dia, 'ingreso', 'ventas', 'Liquidación Uber Eats', 'Uber Eats', v_uber, new.unidad, 'cierre', v_ref_uber, false)
    on conflict (origen_ref) do update set monto = excluded.monto, fecha = excluded.fecha, actualizado_en = now();
  else
    delete from public.fin_movimientos where origen_ref = v_ref_uber;
  end if;
  return new;
end; $f$;

create or replace function public.fin_cierre_pedidosya()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_pya  numeric := coalesce(new.pedidosya_liquidacion, 0);
  v_ref  text := 'pedidosya:' || new.dia || ':' || new.unidad;
begin
  if v_pya > 0 then
    update public.fin_movimientos
       set monto = coalesce(new.total_declarado, 0) - coalesce(new.uber_liquidacion, 0) - v_pya, actualizado_en = now()
     where origen_ref = 'cierre:' || new.dia || ':' || new.unidad;
    insert into public.fin_movimientos (fecha, tipo, categoria_id, descripcion, contraparte, monto, unidad, origen, origen_ref, revisar)
    values (new.dia, 'ingreso', 'ventas', 'Liquidación PedidosYa', 'PedidosYa', v_pya, new.unidad, 'cierre', v_ref, false)
    on conflict (origen_ref) do update set monto = excluded.monto, fecha = excluded.fecha, actualizado_en = now();
  else
    update public.fin_movimientos set monto = 0, actualizado_en = now() where origen_ref = v_ref and monto <> 0;
  end if;
  return new;
end; $f$;

revoke all on public.cierre_vs_sistema from anon;
