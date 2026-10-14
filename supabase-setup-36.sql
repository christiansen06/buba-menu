-- =====================================================================
-- PARTE 36 — Cobros con posnet: monto que llegó de verdad
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Al tildar "llegó" en el cierre de caja, el cobro puede haber llegado
-- completo o con descuentos (comisión, impuesto a los créditos). En vez de
-- cargar cada descuento como gasto, se anota lo que llegó:
--
--   · pedidos.acreditado_monto   lo que acreditó el banco por ese cobro.
--                                null = llegó lo mismo (el total del pedido).
--   · marcar_cobros              como marcar_acreditados, pero cada cobro
--                                tildado trae su monto (o null = lo mismo).
--   · cierre_vs_sistema          posnet_llegado_de_antes usa el monto real y
--                                se agrega posnet_ajuste_monto (lo que cambió,
--                                por cobros que llegaron el mismo día).
--
-- Además se dan por llegados el 14/10 los dos cobros del 7/10 que depositó
-- Visa ese día (anteriores al seguimiento, no se pueden tildar desde el cierre).
-- =====================================================================

alter table public.pedidos add column if not exists acreditado_monto numeric(12,2);

create or replace function public.marcar_cobros(p_dia date, p_unidad text, p_llegaron jsonb, p_vistos uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
  v_it jsonb;
  v_ids uuid[];
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_llegaron is null or jsonb_typeof(p_llegaron) <> 'array' then
    raise exception 'Faltan los cobros';
  end if;
  select coalesce(array_agg((e->>'id')::uuid), '{}') into v_ids from jsonb_array_elements(p_llegaron) e;

  -- Los que se destildaron (y estaban marcados para este día) vuelven a pendientes.
  update public.pedidos set acreditado_el = null, acreditado_monto = null
   where id = any(coalesce(p_vistos, '{}')) and not (id = any(v_ids))
     and acreditado_el = p_dia;

  for v_it in select * from jsonb_array_elements(p_llegaron) loop
    if (v_it->>'monto') is not null and ((v_it->>'monto')::numeric < 0 or (v_it->>'monto')::numeric > 2000000) then
      raise exception 'Monto inválido';
    end if;
    update public.pedidos
       set acreditado_el = p_dia,
           acreditado_monto = case when (v_it->>'monto') is null then null
                                   when (v_it->>'monto')::numeric = total then null
                                   else round((v_it->>'monto')::numeric, 2) end
     where id = (v_it->>'id')::uuid
       and coalesce(medio_pago_cobro, medio_pago) = 'posnet'
       and coalesce(unidad, 'local') = p_unidad
       and (creado_en at time zone 'America/Argentina/Buenos_Aires')::date <= p_dia;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.marcar_cobros(date, text, jsonb, uuid[]) from public, anon;
grant execute on function public.marcar_cobros(date, text, jsonb, uuid[]) to authenticated;


create or replace view public.ventas
with (security_invoker = on) as
select id, creado_en, total, medio_pago, unidad, canal, estado, cancelado_en, motivo_cancelacion,
       medio_pago_cobro, comprobante_id, punto_venta, numero_comprobante, cae, cae_vencimiento,
       plataforma, id_externo, envio, posnet_tipo, acreditado_el, acreditado_monto
  from public.pedidos
 where estado <> 'cancelado';

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

-- Lo que depositó Visa el 14/10 por los cobros del 7/10 (home banking).
update public.pedidos set acreditado_el = date '2026-10-14'
 where medio_pago = 'posnet' and acreditado_el is null and total = 10500
   and (creado_en at time zone 'America/Argentina/Buenos_Aires')::date = date '2026-10-07';
update public.pedidos set acreditado_el = date '2026-10-14', acreditado_monto = 8873.86
 where medio_pago = 'posnet' and acreditado_el is null and total = 9000
   and (creado_en at time zone 'America/Argentina/Buenos_Aires')::date = date '2026-10-07';
