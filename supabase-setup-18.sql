-- =====================================================================
-- PARTE 18 — Food truck: stock por unidad y pedidos que se pueden reintentar
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
-- Evento del 8 al 12 de octubre: el food truck vende EN SIMULTÁNEO con el
-- local, con una tablet propia y un QR propio (?unidad=food_truck). La
-- columna pedidos.unidad existe desde la parte 9. Lo que faltaba:
--
--   1. El stock era GLOBAL. Marcar "sin perlas" en el truck apagaba las
--      perlas en Bolívar. Ahora disponibilidad e insumos son por unidad.
--
--   2. Sin señal, un pedido que no llegaba a la base se perdía. La tablet va
--      a guardar los pedidos que no pudo subir y reintentarlos. Para que
--      reintentar sea inofensivo, el id del pedido lo genera el aparato y la
--      función ignora un id que ya existe.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Stock por unidad
-- ---------------------------------------------------------------------
-- Las filas actuales pasan a ser del local: para el local no cambia nada.
-- Las políticas de RLS no se tocan (no dependen de la clave).

alter table public.disponibilidad
  add column if not exists unidad text not null default 'local';
alter table public.disponibilidad
  drop constraint if exists disponibilidad_unidad_valida;
alter table public.disponibilidad
  add constraint disponibilidad_unidad_valida check (unidad in ('local', 'food_truck'));
alter table public.disponibilidad drop constraint disponibilidad_pkey;
alter table public.disponibilidad add primary key (unidad, categoria_id, producto_id);

alter table public.insumos
  add column if not exists unidad text not null default 'local';
alter table public.insumos
  drop constraint if exists insumos_unidad_valida;
alter table public.insumos
  add constraint insumos_unidad_valida check (unidad in ('local', 'food_truck'));
alter table public.insumos drop constraint insumos_pkey;
alter table public.insumos add primary key (unidad, id);

-- insumos_agotados mezclaría las dos unidades: se le agrega la columna
-- (create or replace sólo permite agregar al final).
create or replace view public.insumos_agotados
with (security_invoker = on) as
select id, actualizado_en, unidad
from public.insumos
where disponible = false
order by actualizado_en desc;


-- ---------------------------------------------------------------------
-- 2. registrar_pedido con id generado en el aparato
-- ---------------------------------------------------------------------
-- MISMO CUIDADO QUE EN LAS PARTES 8 Y 9: agregar un parámetro con default
-- vía "create or replace" NO reemplaza la función, crea una segunda, y
-- después toda llamada falla con "function is not unique" — el menú deja
-- de registrar pedidos. Hay que borrar la versión de 5 parámetros primero.
--
-- p_id es opcional. Sin p_id se comporta EXACTAMENTE como antes (un menú
-- viejo que quedó abierto en un celular sigue andando).
--
-- Con p_id, si ese pedido ya existe no hace nada y devuelve el mismo id:
-- el reintento de un pedido que sí había llegado no lo duplica.
--
-- POR QUÉ PASA A SECURITY DEFINER. Hasta ahora corría como quien la llama
-- (anon), y anon puede insertar pedidos pero NO leerlos (RLS). ON CONFLICT
-- necesita leer la fila en conflicto para saber que existe, así que como
-- anon falla con "new row violates row-level security policy" — probado el
-- 26/09 antes de publicar. Si se hubiera publicado así, el menú habría
-- dejado de registrar pedidos.
--
-- Corriendo como definer el cliente no gana ningún poder: la función hace
-- exactamente lo mismo que ya podía hacer (insertar un pedido), con los
-- mismos filtros de valores válidos. No devuelve ni lee nada de otros
-- pedidos: la respuesta es la misma haya existido el id o no.

drop function if exists public.registrar_pedido(integer, jsonb, text, text, text);

create or replace function public.registrar_pedido(
  p_total      integer,
  p_items      jsonb,
  p_medio_pago text default null,
  p_unidad     text default null,
  p_canal      text default null,
  p_id         uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid := coalesce(p_id, gen_random_uuid());
  v_nuevo integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items';
  end if;

  insert into public.pedidos (id, total, medio_pago, unidad, canal)
  values (
    v_id,
    p_total,
    case when p_medio_pago in ('transferencia', 'efectivo')  then p_medio_pago end,
    case when p_unidad     in ('local', 'food_truck')        then p_unidad     end,
    case when p_canal      in ('mostrador', 'qr')            then p_canal      end
  )
  on conflict (id) do nothing;

  get diagnostics v_nuevo = row_count;

  -- Ya existía: es un reintento. Las líneas ya están; no se tocan.
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

-- Las funciones definer son ejecutables por PUBLIC por defecto: se acota.
revoke execute on function public.registrar_pedido(integer, jsonb, text, text, text, uuid) from public;
grant  execute on function public.registrar_pedido(integer, jsonb, text, text, text, uuid) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. La hora real del pedido, para los que suben tarde
-- ---------------------------------------------------------------------
-- Si la tablet del truck se queda sin señal el 8/10 a la noche y el pedido
-- sube recién el 9/10 a la mañana, con creado_en = now() quedaría en el día
-- equivocado y el cierre de caja de los dos días saldría mal.
--
-- Por eso el aparato manda la hora en que se hizo el pedido. Como quien
-- llama es anónimo, esa hora se acota: sólo se acepta si cae en los últimos
-- 7 días y no en el futuro (5 minutos de margen por relojes desfasados).
-- Fuera de ese rango se usa now(), igual que siempre.
--
-- Mismo cuidado de siempre: se borra la versión de 6 parámetros antes.

drop function if exists public.registrar_pedido(integer, jsonb, text, text, text, uuid);

create or replace function public.registrar_pedido(
  p_total      integer,
  p_items      jsonb,
  p_medio_pago text default null,
  p_unidad     text default null,
  p_canal      text default null,
  p_id         uuid default null,
  p_creado_en  timestamptz default null
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
    case when p_medio_pago in ('transferencia', 'efectivo')  then p_medio_pago end,
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

revoke execute on function public.registrar_pedido(integer, jsonb, text, text, text, uuid, timestamptz) from public;
grant  execute on function public.registrar_pedido(integer, jsonb, text, text, text, uuid, timestamptz) to anon, authenticated;


-- =====================================================================
-- VERIFICACIÓN (hecha el 26/09, todo en transacciones revertidas)
--
-- 1. Conteos iguales antes y después: 512 pedidos, 851 líneas, $7.958.500.
-- 2. disponibilidad (8) e insumos (15): mismas filas, todas unidad='local'.
-- 3. Como anon: registrar_pedido con 5 argumentos (menú viejo) → entra.
-- 4. Como anon: el mismo p_id dos veces → 1 pedido, sus líneas una sola vez,
--    y la segunda llamada devuelve el mismo id sin error.
-- 5. Como el dueño: insumo 'perlas' agotado en food_truck no cambia el del
--    local. anon no puede escribir stock (RLS).
-- 6. p_creado_en de hace 1 día → se respeta; de hace 30 días o del futuro
--    → now().
-- =====================================================================


-- =====================================================================
-- PARA VOLVER ATRÁS
-- (Si ya hay filas de food_truck en disponibilidad/insumos, borrarlas antes
--  de restaurar las claves viejas.)
-- =====================================================================
/*
drop function if exists public.registrar_pedido(integer, jsonb, text, text, text, uuid, timestamptz);
-- volver a crear la versión de 5 parámetros de supabase-setup-9.sql

delete from public.insumos where unidad <> 'local';
delete from public.disponibilidad where unidad <> 'local';

create or replace view public.insumos_agotados with (security_invoker = on) as
select id, actualizado_en, unidad from public.insumos where disponible = false order by actualizado_en desc;

alter table public.insumos drop constraint insumos_pkey;
alter table public.insumos add primary key (id);
alter table public.insumos drop constraint if exists insumos_unidad_valida;
alter table public.insumos drop column unidad;   -- falla por la vista: drop view + recrear la de la parte 7

alter table public.disponibilidad drop constraint disponibilidad_pkey;
alter table public.disponibilidad add primary key (categoria_id, producto_id);
alter table public.disponibilidad drop constraint if exists disponibilidad_unidad_valida;
alter table public.disponibilidad drop column unidad;
*/
