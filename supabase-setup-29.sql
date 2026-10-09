-- =====================================================================
-- PARTE 29 — Tarjeta y QR separados en los cobros con posnet
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Hasta ahora el mostrador anotaba "Tarjeta o QR" como un solo medio
-- ('posnet'). Sigue siendo un solo medio para la plata (llega otro día, lo
-- liquida el posnet), pero ahora se anota CÓMO pagó el cliente:
--
--   · pedidos.posnet_tipo        'tarjeta' o 'qr'. Sólo con medio posnet. Los
--                                pedidos viejos quedan en null (sin separar).
--   · registrar_pedido_completo  igual que registrar_pedido más el envío del
--                                delivery (parte 28) y el tipo de posnet.
--                                registrar_pedido y registrar_pedido_con_envio
--                                quedan como estaban (un menú viejo en caché
--                                sigue andando).
--   · vistas: ventas gana posnet_tipo; cierre_vs_sistema gana el total de QR y
--     el de tarjeta (el total de posnet no cambia: es la suma de los dos más
--     lo que no se separó).
--
-- No se tocan medio_pago ni las restricciones existentes.
-- =====================================================================

alter table public.pedidos add column if not exists posnet_tipo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_posnet_tipo_valido') then
    alter table public.pedidos add constraint pedidos_posnet_tipo_valido
      check (posnet_tipo is null or (posnet_tipo in ('tarjeta', 'qr') and medio_pago = 'posnet'));
  end if;
end $$;


create or replace function public.registrar_pedido_completo(
  p_total integer, p_items jsonb, p_medio_pago text, p_unidad text, p_canal text,
  p_id uuid, p_creado_en timestamptz, p_envio integer default 0, p_posnet_tipo text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_envio is null or p_envio < 0 or p_envio > 100000 then
    raise exception 'Envío inválido';
  end if;
  -- El pedido se anota como siempre (idempotente por p_id)...
  v_id := public.registrar_pedido(p_total, p_items, p_medio_pago, p_unidad, p_canal, p_id, p_creado_en);
  -- ...y lo extra sólo lo acepta el mostrador. Reintentar el mismo pedido no
  -- lo cambia: queda como la primera vez.
  if p_canal = 'mostrador' then
    if p_envio > 0 and coalesce(p_unidad, 'local') = 'local' then
      update public.pedidos set envio = least(p_envio, total) where id = v_id and envio = 0;
    end if;
    if p_medio_pago = 'posnet' and p_posnet_tipo in ('tarjeta', 'qr') then
      update public.pedidos set posnet_tipo = p_posnet_tipo where id = v_id and posnet_tipo is null and medio_pago = 'posnet';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamptz, integer, text) from public;
grant execute on function public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamptz, integer, text) to anon, authenticated;


create or replace view public.ventas
with (security_invoker = on) as
select id, creado_en, total, medio_pago, unidad, canal, estado, cancelado_en, motivo_cancelacion,
       medio_pago_cobro, comprobante_id, punto_venta, numero_comprobante, cae, cae_vencimiento,
       plataforma, id_externo, envio, posnet_tipo
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
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet' and posnet_tipo = 'tarjeta'), 0) as tarjeta
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
  coalesce(c.uber_liquidacion, 0) as uber_liquidacion,
  coalesce(s.envios, 0)         as total_sistema_envios,
  coalesce(s.delivery, 0)       as pedidos_delivery,
  c.envios_pagados,
  coalesce(s.qr, 0)             as total_sistema_qr,
  coalesce(s.tarjeta, 0)        as total_sistema_tarjeta
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
order by 1 desc, 2;

-- Verificación:
--   select dia, total_sistema_posnet, total_sistema_qr, total_sistema_tarjeta from cierre_vs_sistema where total_sistema_posnet > 0 order by dia desc limit 10;
