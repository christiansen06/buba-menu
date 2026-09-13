-- =====================================================================
-- PARTE 14 — La crema depende de si es el único relleno
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
--
-- LO QUE DIJO AGUSTÍN
--
-- "La crema puede cambiar. En el waffle de frutilla (crema + frutilla +
--  chocolate) lleva más, porque la crema es el único relleno. Pero en un
--  mixto, por ejemplo crema y helado, el helado es una bocha y se rellena
--  con lo que se pueda de crema, calculo que será entre 40 y 60 g."
--
-- O sea que la cantidad de crema no depende de si el cliente la eligió,
-- sino de CUÁNTO ESPACIO LE QUEDA en el waffle:
--
--   · crema como único relleno .......... 60 g (llena todo el cono)
--   · crema junto a otro relleno ........ ~50 g (rellena alrededor de la bocha)
--   · crema que el cliente no eligió .... 50 g (guarnición de la casa)
--
-- Los dos últimos casos dan lo mismo, así que la regla real es corta:
-- 50 g siempre, y 60 g sólo cuando la crema es el único relleno.
--
-- La parte 12 le sumaba los 10 g extra cada vez que el cliente elegía crema,
-- incluidos los mixtos. Eso sobreestimaba 41 waffles en 10 g cada uno
-- ($2.562 en total). Poco, pero la regla importa para lo que se venda de acá
-- en adelante.
--
--
-- POR QUÉ UNA COLUMNA Y NO UN IF EN LA VISTA
--
-- Porque la regla es del negocio, no del reporte. Si mañana otro componente
-- se comporta igual (un relleno que también se usa de guarnición), se marca
-- la fila y listo, sin tocar SQL.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La columna
-- ---------------------------------------------------------------------
alter table public.costos_componente_waffle
  add column if not exists solo_si_unico_relleno boolean not null default false;

comment on column public.costos_componente_waffle.solo_si_unico_relleno is
  'Si es true, cantidad_extra_si_elegido se suma únicamente cuando este '
  'componente es el ÚNICO relleno del waffle. Para la crema: llena el cono '
  'entero si va sola, pero sólo rellena alrededor si comparte con una bocha.';

update public.costos_componente_waffle
set solo_si_unico_relleno = true,
    nota = '50 g siempre (guarnición de la casa y relleno de un mixto son la '
           'misma cantidad); 60 g sólo cuando es el único relleno y llena el '
           'cono entero. Agustín estimó 40-60 g para el caso mixto: se toma 50, '
           'que además es lo que dicen tres de las cuatro fichas del Excel.',
    actualizado_en = now()
where tipo = 'relleno' and componente = 'crema';


-- ---------------------------------------------------------------------
-- 2. Las dos vistas que aplican el extra
-- ---------------------------------------------------------------------
-- Van con `create or replace`: cambia el cuerpo, no las columnas.

create or replace view public.costo_waffle
with (security_invoker = on) as
with linea as (
  select
    i.id,
    coalesce((select array_agg(distinct r->>'type')
                from jsonb_array_elements(i.detalle->'rellenos') r), '{}'::text[]) as rellenos,
    coalesce((select array_agg(distinct t #>> '{}')
                from jsonb_array_elements(i.detalle->'toppings') t), '{}'::text[]) as toppings,
    coalesce((select array_agg(distinct s #>> '{}')
                from jsonb_array_elements(i.detalle->'salsas') s), '{}'::text[]) as salsas,
    coalesce((i.detalle->>'extraNutella')::boolean, false) as extra_nutella
  from public.pedido_items i
  where i.categoria_id = 'waffles'
),
aplicado as (
  select
    l.id,
    c.tipo,
    c.componente,
    c.es_estimado,
    c.costo_unitario * (
      c.cantidad
      + case when (c.tipo = 'relleno' and c.componente = any(l.rellenos)
                   and (not c.solo_si_unico_relleno
                        or coalesce(array_length(l.rellenos, 1), 0) = 1))
                or (c.tipo = 'topping' and c.componente = any(l.toppings))
                or (c.tipo = 'salsa'   and c.componente = any(l.salsas))
             then c.cantidad_extra_si_elegido
             else 0 end
    ) as costo
  from linea l
  join public.costos_componente_waffle c
    on  c.siempre
    or (c.tipo = 'relleno' and c.componente = any(l.rellenos))
    or (c.tipo = 'topping' and c.componente = any(l.toppings))
    or (c.tipo = 'salsa'   and c.componente = any(l.salsas))
    or (c.tipo = 'extra'   and c.componente = 'nutella_extra' and l.extra_nutella)
)
select
  id as pedido_item_id,
  round(sum(costo) filter (where not (tipo = 'base' and componente = 'packaging')), 2) as costo_insumos,
  round(coalesce(sum(costo) filter (where tipo = 'base' and componente = 'packaging'), 0), 2) as costo_packaging,
  round(sum(costo), 2)   as costo_total,
  bool_or(es_estimado)   as tiene_estimados,
  count(*) filter (where es_estimado) as componentes_estimados
from aplicado
group by id;


create or replace view public.costo_componentes_waffle_uso
with (security_invoker = on) as
with linea as (
  select
    i.id, i.cantidad,
    coalesce((select array_agg(distinct r->>'type')
                from jsonb_array_elements(i.detalle->'rellenos') r), '{}'::text[]) as rellenos,
    coalesce((select array_agg(distinct t #>> '{}')
                from jsonb_array_elements(i.detalle->'toppings') t), '{}'::text[]) as toppings,
    coalesce((select array_agg(distinct s #>> '{}')
                from jsonb_array_elements(i.detalle->'salsas') s), '{}'::text[]) as salsas,
    coalesce((i.detalle->>'extraNutella')::boolean, false) as extra_nutella
  from public.pedido_items i
  where i.categoria_id = 'waffles'
)
select
  c.tipo,
  c.componente,
  c.etiqueta,
  c.es_estimado,
  sum(l.cantidad)                                as veces,
  round(sum(l.cantidad * c.costo_unitario * (
    c.cantidad
    + case when (c.tipo = 'relleno' and c.componente = any(l.rellenos)
                 and (not c.solo_si_unico_relleno
                      or coalesce(array_length(l.rellenos, 1), 0) = 1))
              or (c.tipo = 'topping' and c.componente = any(l.toppings))
              or (c.tipo = 'salsa'   and c.componente = any(l.salsas))
           then c.cantidad_extra_si_elegido else 0 end))) as costo_acumulado
from linea l
join public.costos_componente_waffle c
  on  c.siempre
  or (c.tipo = 'relleno' and c.componente = any(l.rellenos))
  or (c.tipo = 'topping' and c.componente = any(l.toppings))
  or (c.tipo = 'salsa'   and c.componente = any(l.salsas))
  or (c.tipo = 'extra'   and c.componente = 'nutella_extra' and l.extra_nutella)
group by 1, 2, 3, 4
order by costo_acumulado desc;


-- =====================================================================
-- VERIFICACIÓN — sigue dando exacto donde tiene que dar
--
-- Ficha Simple del Excel (crema único relleno + frutilla + salsa chocolate):
-- la crema sigue en 60 g, así que el modelo sigue dando $1.155,13 contra
-- $1.155,13 de la ficha. Es el Waffle Frutilla, el más vendido.
--
-- Ficha "con helado" (helado + crema de guarnición): la crema sigue en 50 g,
-- $1.407,64 contra $1.407,63.
--
-- Lo que cambia son los 41 waffles donde el cliente eligió crema JUNTO a otro
-- relleno: bajan 10 g cada uno.
-- =====================================================================


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
update public.costos_componente_waffle
set solo_si_unico_relleno = false
where tipo = 'relleno' and componente = 'crema';

alter table public.costos_componente_waffle drop column if exists solo_si_unico_relleno;

-- y volver a crear costo_waffle y costo_componentes_waffle_uso como están
-- en supabase-setup-12.sql
*/
