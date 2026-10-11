-- =====================================================================
-- PARTE 31 — PedidosYa
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Los pedidos de PedidosYa NO se cargan desde el mostrador: entran con el
-- reporte de la plataforma, como los de Uber (pedidos.plataforma =
-- 'pedidos_ya', valor que ya estaba permitido). Esta parte deja lista la caja:
--
--   · registrar_pedido_plataforma   quedó creada pero SIN permisos (11/10: se
--     decidió no cargar PedidosYa a mano). No la usa nadie.
--   · cierres_caja.pedidosya_liquidacion   la parte de "transferencias" que
--     fue un pago de PedidosYa (como uber_liquidacion). Queda anotada sola en
--     el libro como "Liquidación PedidosYa" y se descuenta del Cierre de Caja.
--   · editar_pedido: ni los de Uber ni los de PedidosYa se editan (vienen
--     del reporte).
--   · cierre_vs_sistema: total de PedidosYa y su liquidación, al final.
--
-- No se borra nada: si se saca la liquidación de un cierre, su fila del
-- libro queda en $0.
-- =====================================================================

alter table public.cierres_caja add column if not exists pedidosya_liquidacion integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cierres_caja_pedidosya_liquidacion_valida') then
    alter table public.cierres_caja add constraint cierres_caja_pedidosya_liquidacion_valida
      check (pedidosya_liquidacion >= 0
             and pedidosya_liquidacion + coalesce(uber_liquidacion, 0) <= coalesce(transferencias, 0));
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Pedido de PedidosYa desde el mostrador
-- ---------------------------------------------------------------------
create or replace function public.registrar_pedido_plataforma(
  p_total integer, p_items jsonb, p_unidad text, p_id uuid, p_creado_en timestamptz, p_plataforma text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_plataforma is distinct from 'pedidos_ya' then
    raise exception 'Plataforma inválida';
  end if;
  -- Se anota como un pedido del mostrador sin medio de pago...
  v_id := public.registrar_pedido(p_total, p_items, null, p_unidad, 'mostrador', p_id, p_creado_en);
  -- ...y se marca la plataforma (sólo si todavía no tenía).
  update public.pedidos set plataforma = p_plataforma where id = v_id and plataforma is null and medio_pago is null;
  return v_id;
end;
$$;

revoke all on function public.registrar_pedido_plataforma(integer, jsonb, text, uuid, timestamptz, text) from public;
-- Sin grant: no se carga PedidosYa a mano (ver arriba).
revoke execute on function public.registrar_pedido_plataforma(integer, jsonb, text, uuid, timestamptz, text) from anon, authenticated;


-- ---------------------------------------------------------------------
-- Liquidación de PedidosYa del cierre → libro
-- Corre DESPUÉS de fin_cierre_a_movimiento (los triggers van por nombre):
-- corrige el "Cierre de Caja" para no contar dos veces lo de PedidosYa.
-- ---------------------------------------------------------------------
create or replace function public.fin_cierre_pedidosya()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_pya  integer := coalesce(new.pedidosya_liquidacion, 0);
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
end;
$$;

revoke all on function public.fin_cierre_pedidosya() from public, anon;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'fin_cierre_pedidosya') then
    create trigger fin_cierre_pedidosya after insert or update on public.cierres_caja
      for each row execute function public.fin_cierre_pedidosya();
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Vista de la caja (sólo se agregan columnas al final)
-- ---------------------------------------------------------------------
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
    coalesce(sum(total) filter (where plataforma = 'pedidos_ya'), 0) as pedidosya
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
  coalesce(s.tarjeta, 0)        as total_sistema_tarjeta,
  coalesce(s.pedidosya, 0)      as total_sistema_pedidosya,
  coalesce(c.pedidosya_liquidacion, 0) as pedidosya_liquidacion
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
order by 1 desc, 2;


-- editar_pedido queda como en la parte 30 (no edita pedidos con plataforma).
