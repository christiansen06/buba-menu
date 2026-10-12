-- =====================================================================
-- PARTE 32 — Cobros con posnet: cuándo se acreditó cada uno
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- El QR casi siempre se acredita al instante, pero no siempre: si el cliente
-- paga el QR con una tarjeta de crédito, tarda días. La tarjeta tarda días.
-- En el mostrador no se sabe; al cerrar la caja, con el banco a mano, sí.
--
--   · pedidos.acreditado_el   día en que esa plata llegó a la cuenta.
--                             null = todavía no llegó (o es anterior al
--                             seguimiento, 11/10, y no se sabe).
--   · marcar_acreditados      lo llama el cierre de caja de Gestión: marca los
--                             cobros que llegaron ese día (y desmarca los que se
--                             destildaron). Sólo el dueño.
--   · cierre_vs_sistema       + posnet_diferido (lo vendido ese día con posnet
--                             que NO llegó ese día) y posnet_llegado_de_antes (lo
--                             de días anteriores que llegó ese día).
--
-- Los QR anteriores al 11/10 se dan por llegados el mismo día (así se
-- confirmó el 10/10).
-- =====================================================================

alter table public.pedidos add column if not exists acreditado_el date;

update public.pedidos
   set acreditado_el = (creado_en at time zone 'America/Argentina/Buenos_Aires')::date
 where posnet_tipo = 'qr' and acreditado_el is null
   and (creado_en at time zone 'America/Argentina/Buenos_Aires')::date < date '2026-10-11';


create or replace function public.marcar_acreditados(p_dia date, p_unidad text, p_llegaron uuid[], p_vistos uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  -- Los que se destildaron (y estaban marcados para este día) vuelven a pendientes.
  update public.pedidos set acreditado_el = null
   where id = any(coalesce(p_vistos, '{}')) and not (id = any(coalesce(p_llegaron, '{}')))
     and acreditado_el = p_dia;
  -- Los tildados: llegaron este día. Sólo cobros con posnet de esa unidad y
  -- vendidos ese día o antes.
  update public.pedidos set acreditado_el = p_dia
   where id = any(coalesce(p_llegaron, '{}'))
     and coalesce(medio_pago_cobro, medio_pago) = 'posnet'
     and coalesce(unidad, 'local') = p_unidad
     and (creado_en at time zone 'America/Argentina/Buenos_Aires')::date <= p_dia;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.marcar_acreditados(date, text, uuid[], uuid[]) from public, anon;
grant execute on function public.marcar_acreditados(date, text, uuid[], uuid[]) to authenticated;


create or replace view public.ventas
with (security_invoker = on) as
select id, creado_en, total, medio_pago, unidad, canal, estado, cancelado_en, motivo_cancelacion,
       medio_pago_cobro, comprobante_id, punto_venta, numero_comprobante, cae, cae_vencimiento,
       plataforma, id_externo, envio, posnet_tipo, acreditado_el
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
      and (acreditado_el is null or acreditado_el > (creado_en at time zone 'America/Argentina/Buenos_Aires')::date)), 0) as posnet_diferido
  from public.ventas
  group by 1, 2
),
llegadas as (
  select acreditado_el as dia, coalesce(unidad, 'local') as unidad, sum(total) as monto
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
  coalesce(l.monto, 0)          as posnet_llegado_de_antes
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
left join llegadas l on l.dia = coalesce(c.dia, s.dia) and l.unidad = coalesce(c.unidad, s.unidad)
order by 1 desc, 2;
