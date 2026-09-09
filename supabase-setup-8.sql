-- =====================================================================
-- PARTE 8 — La facturación que no se veía, y el medio de pago
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- NO borra ni modifica ninguna venta. Al final está el bloque de reversa.
--
-- Salió de revisar los datos para proponer mejoras: aparecieron $268.000
-- de facturación (4,5% del total) que no figuraban en ninguna métrica por
-- producto ni por categoría.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Dos vistas para la plata
-- ---------------------------------------------------------------------
-- EL PROBLEMA
--
-- ventas_desglosadas —la vista de la que cuelgan casi todas las métricas—
-- hace dos cosas con los pedidos agrupados (promos, medialunas, pastelería):
--
--   · deja afuera la línea "madre"
--       where jsonb_typeof(detalle->'componentes') is distinct from 'array'
--   · y a los componentes les pone  NULL::integer as precio_unitario
--
-- La línea madre es la ÚNICA que tiene el precio. O sea que la plata de
-- todo pedido agrupado desaparece del desglose:
--
--     promociones   11 líneas   $175.000
--     pastelería    15 líneas    $77.000
--     medialunas     8 líneas    $16.000
--                              ──────────
--                                $268.000   ← 4,5% de la facturación
--
-- El total general nunca estuvo mal (pedidos.total suma bien). Lo que
-- fallaba era preguntar "¿cuánto facturé en pastelería?": daba $0.
--
-- POR QUÉ NO SE TOCA ventas_desglosadas
--
-- Para lo que fue hecha —contar UNIDADES de cada producto real, abriendo
-- los combos— está bien, y hay siete vistas colgando de ella. Repartir el
-- precio de una promo entre sus componentes obligaría a inventar números:
-- en "Café + 2 Medialunas" a $6.500, un reparto por cantidad daría $3.250
-- y $3.250, cuando el café vale $4.000 y la medialuna $1.500. El reparto
-- correcto necesita una tabla de precios de lista, que todavía no existe.
--
-- Así que se agregan dos vistas que leen pedido_items directo, donde cada
-- línea sí tiene su precio real. Sin inventar nada.
--
--   REGLA PARA ACORDARSE:
--   ventas_desglosadas cuenta UNIDADES. Estas dos cuentan PLATA.

create or replace view public.facturacion_por_categoria
with (security_invoker = on) as
select
  categoria_id,
  sum(cantidad)                                as unidades,
  sum(cantidad * coalesce(precio_unitario, 0)) as facturado,
  count(distinct pedido_id)                    as pedidos
from public.pedido_items
group by categoria_id
order by facturado desc;

-- Facturación día por día, en hora argentina. Además de cerrar la caja,
-- es la base del análisis por turno que viene después.
create or replace view public.facturacion_por_dia
with (security_invoker = on) as
select
  (creado_en at time zone 'America/Argentina/Buenos_Aires')::date        as dia,
  trim(to_char(creado_en at time zone 'America/Argentina/Buenos_Aires', 'Day')) as nombre_dia,
  count(*)                                                              as pedidos,
  sum(total)                                                            as facturado,
  round(avg(total))                                                     as ticket_promedio
from public.pedidos
group by 1, 2
order by dia desc;


-- ---------------------------------------------------------------------
-- 2. Guardar el medio de pago
-- ---------------------------------------------------------------------
-- El menú ya le pregunta al cliente si paga por transferencia o en
-- efectivo, lo escribe en el WhatsApp… y ahí moría: registrarPedido()
-- mandaba sólo items y total. Es el dato que falta para cruzar las ventas
-- contra el conteo de caja.

-- 2.a La columna. Nullable a propósito: los 365 pedidos anteriores no lo
--     tienen y no hay forma de reconstruirlo.
alter table public.pedidos
  add column if not exists medio_pago text;

alter table public.pedidos
  drop constraint if exists pedidos_medio_pago_valido;

alter table public.pedidos
  add constraint pedidos_medio_pago_valido
  check (medio_pago is null or medio_pago in ('transferencia', 'efectivo'));

-- 2.b La función pasa a tener tres parámetros.
--
--     OJO CON ESTO: un "create or replace" agregando un tercer parámetro
--     con default NO reemplaza la función de dos — crea una segunda. Y
--     después una llamada de dos argumentos falla con "function is not
--     unique", o sea que el menú deja de registrar pedidos.
--     Hay que borrar la vieja primero.
--
--     Con el default en NULL, un front que todavía mande dos parámetros
--     sigue andando igual.
drop function if exists public.registrar_pedido(integer, jsonb);

create or replace function public.registrar_pedido(
  p_total      integer,
  p_items      jsonb,
  p_medio_pago text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items';
  end if;

  insert into public.pedidos (id, total, medio_pago)
  values (
    v_id,
    p_total,
    -- Cualquier cosa que no sea uno de los dos válidos entra como NULL,
    -- así un valor raro del front nunca voltea el pedido por el CHECK.
    case when p_medio_pago in ('transferencia', 'efectivo') then p_medio_pago end
  );

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
    -- Un JSON null escalar entra como NULL de verdad (ver parte 7).
    case when jsonb_typeof(item->'detalle') = 'object' then item->'detalle' end
  from jsonb_array_elements(p_items) as item;

  return v_id;
end;
$$;

grant execute on function public.registrar_pedido(integer, jsonb, text) to anon, authenticated;

-- 2.c La columna nueva en la vista de siempre. Va AL FINAL: "create or
--     replace view" puede agregar columnas al final, nunca sacarlas ni
--     reordenarlas.
create or replace view public.pedidos_local
with (security_invoker = on) as
select
  id,
  (creado_en at time zone 'America/Argentina/Buenos_Aires')::timestamp(0) as fecha_hora,
  to_char(creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
  total,
  (select count(*) from public.pedido_items i where i.pedido_id = p.id)                as lineas,
  (select coalesce(sum(i.cantidad),0) from public.pedido_items i where i.pedido_id = p.id) as unidades,
  creado_en as guardado_utc,
  medio_pago
from public.pedidos p
order by creado_en desc;


-- =====================================================================
-- PARA VOLVER ATRÁS
--
-- Descomentar y correr. Deja todo como estaba antes de esta parte 8.
-- Lo único que se pierde es el medio de pago de los pedidos cargados
-- desde que se aplicó — no se puede reconstruir.
-- =====================================================================
/*
drop view if exists public.facturacion_por_categoria;
drop view if exists public.facturacion_por_dia;

drop view if exists public.pedidos_local;
create view public.pedidos_local
with (security_invoker = on) as
select id,
       (creado_en at time zone 'America/Argentina/Buenos_Aires')::timestamp(0) as fecha_hora,
       to_char(creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
       total,
       (select count(*) from public.pedido_items i where i.pedido_id = p.id) as lineas,
       (select coalesce(sum(i.cantidad),0) from public.pedido_items i where i.pedido_id = p.id) as unidades,
       creado_en as guardado_utc
from public.pedidos p
order by creado_en desc;

drop function if exists public.registrar_pedido(integer, jsonb, text);

create or replace function public.registrar_pedido(p_total integer, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid := gen_random_uuid();
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items';
  end if;
  insert into public.pedidos (id, total) values (v_id, p_total);
  insert into public.pedido_items
    (pedido_id, categoria_id, producto_id, nombre, variante, cantidad, precio_unitario, detalle)
  select v_id,
         coalesce(item->>'categoria_id','otros'), item->>'producto_id',
         coalesce(item->>'nombre','sin nombre'), item->>'variante',
         coalesce((item->>'cantidad')::integer,1), (item->>'precio_unitario')::integer,
         case when jsonb_typeof(item->'detalle') = 'object' then item->'detalle' end
  from jsonb_array_elements(p_items) as item;
  return v_id;
end; $$;

grant execute on function public.registrar_pedido(integer, jsonb) to anon, authenticated;

alter table public.pedidos drop constraint if exists pedidos_medio_pago_valido;
alter table public.pedidos drop column if exists medio_pago;
*/
