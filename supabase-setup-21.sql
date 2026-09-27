-- =====================================================================
-- PARTE 21 — Cobros con posnet (tarjeta o QR) en el mostrador
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- Cómo cobra BüBa (Agustín, 28/09):
--   · efectivo y transferencia al alias → la plata está ese día
--   · posnet (débito, crédito o QR): en el local el de Banco Provincia, en el
--     truck el de Mercado Pago → la plata llega días después, con comisión
--   · el cierre de caja cuenta la plata el día que LLEGA (cuando se pasa a
--     Brubank), no el día de la venta. Así es el Excel y así sigue.
--
-- Qué cambia:
--   1. Un pedido cargado en el MOSTRADOR puede ser 'posnet'. El cliente del
--      QR no ve esa opción (la comisión la paga el negocio): la base tampoco
--      la acepta si el pedido no viene del mostrador.
--   2. "Cobrado con" del panel: 'debito' pasa a 'posnet' (tarjeta o QR).
--   3. cierre_vs_sistema suma al final la columna total_sistema_posnet: lo
--      que se vendió ese día con posnet y NO está en la caja de ese día.
--      BüBa Gestión lo muestra aparte y no lo cuenta en la diferencia.
-- =====================================================================


-- 1. Valores permitidos ------------------------------------------------

alter table public.pedidos drop constraint if exists pedidos_medio_pago_valido;
alter table public.pedidos add constraint pedidos_medio_pago_valido
  check (medio_pago is null or medio_pago in ('transferencia', 'efectivo', 'posnet'));

alter table public.pedidos drop constraint if exists pedidos_medio_pago_cobro_check;
-- Primero sin la regla vieja, después el dato, después la regla nueva.
update public.pedidos set medio_pago_cobro = 'posnet' where medio_pago_cobro = 'debito';
alter table public.pedidos add constraint pedidos_medio_pago_cobro_check
  check (medio_pago_cobro is null or medio_pago_cobro in ('efectivo', 'transferencia', 'posnet'));


-- 2. registrar_pedido: misma firma (sin sobrecarga), acepta 'posnet' sólo
--    desde el mostrador ----------------------------------------------------

create or replace function public.registrar_pedido(
  p_total integer,
  p_items jsonb,
  p_medio_pago text default null,
  p_unidad text default null,
  p_canal text default null,
  p_id uuid default null,
  p_creado_en timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid := coalesce(p_id, gen_random_uuid());
  v_cuando timestamptz := case
    when p_creado_en between now() - interval '7 days' and now() + interval '5 minutes'
      then p_creado_en
    else now()
  end;
  v_nuevo  integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items';
  end if;
  insert into public.pedidos (id, creado_en, total, medio_pago, unidad, canal)
  values (
    v_id,
    v_cuando,
    p_total,
    case
      when p_medio_pago in ('transferencia', 'efectivo')        then p_medio_pago
      when p_medio_pago = 'posnet' and p_canal = 'mostrador'    then 'posnet'
    end,
    case when p_unidad     in ('local', 'food_truck')        then p_unidad     end,
    case when p_canal      in ('mostrador', 'qr')            then p_canal      end
  )
  on conflict (id) do nothing;
  get diagnostics v_nuevo = row_count;
  if v_nuevo = 0 then
    return v_id;
  end if;
  insert into public.pedido_items
    (pedido_id, categoria_id, producto_id, nombre, variante, cantidad, precio_unitario, detalle)
  select
    v_id,
    coalesce(item->>'categoria_id', 'otros'),
    item->>'producto_id',
    coalesce(item->>'nombre', 'sin nombre'),
    item->>'variante',
    coalesce((item->>'cantidad')::integer, 1),
    (item->>'precio_unitario')::integer,
    case when jsonb_typeof(item->'detalle') = 'object' then item->'detalle' end
  from jsonb_array_elements(p_items) as item;
  return v_id;
end;
$$;

revoke all on function public.registrar_pedido(integer, jsonb, text, text, text, uuid, timestamptz) from public;
grant execute on function public.registrar_pedido(integer, jsonb, text, text, text, uuid, timestamptz) to anon, authenticated;


-- 3. registrar_cobro: 'posnet'; 'debito' (un panel viejo en caché) se
--    guarda como 'posnet' --------------------------------------------------

create or replace function public.registrar_cobro(p_id uuid, p_medio text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_medio text := case when p_medio = 'debito' then 'posnet' else p_medio end;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_medio is not null and v_medio not in ('efectivo', 'transferencia', 'posnet') then
    raise exception 'Medio de pago inválido';
  end if;
  update public.pedidos set medio_pago_cobro = v_medio where id = p_id;
  if not found then
    raise exception 'No existe ese pedido';
  end if;
end;
$$;


-- 4. cierre_vs_sistema + total_sistema_posnet (columna nueva AL FINAL:
--    create or replace view sólo permite agregar al final) ----------------
--
-- El medio que cuenta es el que se anotó al cobrar (panel) y, si no se
-- anotó, el que se eligió al hacer el pedido.

create or replace view public.cierre_vs_sistema
with (security_invoker = on) as
with sistema as (
  select
    (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
    coalesce(unidad, 'local')                                       as unidad,
    count(*)                                                        as pedidos,
    sum(total)                                                      as facturado,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'), 0) as posnet
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
  coalesce(s.posnet, 0)         as total_sistema_posnet
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
order by 1 desc, 2;


-- =====================================================================
-- VERIFICACIÓN (en una transacción que se revierte)
-- =====================================================================
-- begin;
--   set local role anon;
--   select registrar_pedido(1000, '[{"nombre":"x"}]', 'posnet', 'local', 'mostrador');  -- medio_pago = 'posnet'
--   select registrar_pedido(1000, '[{"nombre":"x"}]', 'posnet', 'local', 'qr');         -- medio_pago = null
-- rollback;


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
-- La vista vuelve a la definición de la parte 16 (sin total_sistema_posnet):
-- drop view public.cierre_vs_sistema; y recrearla desde supabase-setup-16.sql.
alter table public.pedidos drop constraint pedidos_medio_pago_valido;
alter table public.pedidos drop constraint pedidos_medio_pago_cobro_check;
update public.pedidos set medio_pago_cobro = 'debito' where medio_pago_cobro = 'posnet';
update public.pedidos set medio_pago = null where medio_pago = 'posnet';
alter table public.pedidos add constraint pedidos_medio_pago_valido
  check (medio_pago is null or medio_pago in ('transferencia', 'efectivo'));
alter table public.pedidos add constraint pedidos_medio_pago_cobro_check
  check (medio_pago_cobro is null or medio_pago_cobro in ('efectivo', 'transferencia', 'debito'));
-- y registrar_pedido / registrar_cobro desde las partes 18 y 17.
*/
