-- =====================================================================
-- BüBa — Parte 3: promos, ventas desglosadas y seguridad de las vistas
-- Pegar en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================
--
-- Esta parte es la que hace posible el análisis del que hablamos: mirar
-- los datos y decidir promos con fundamento en vez de a ojo.
--
-- El problema que resuelve: cuando alguien compra el combo "Café +
-- Waffle", en la base queda UNA línea que dice "promo-cafe-waffle". El
-- café y el waffle que salieron por la ventana no aparecen en ningún
-- ranking. Si el 40% de los cafés se van dentro de promos, el ranking de
-- productos te está mintiendo.
--
-- Ahora cada promo guarda su desglose, y estas vistas lo abren.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. SEGURIDAD DE LAS VISTAS (importante)
-- ---------------------------------------------------------------------
-- Por defecto una vista de Postgres corre con los permisos de quien la
-- creó, no de quien la consulta. Eso quiere decir que las vistas de la
-- parte 1 podían dejar ver tus ventas sin estar logueado, aunque la
-- tabla de abajo estuviera protegida. Con security_invoker la vista
-- respeta el permiso del que pregunta, que es lo que queremos.
alter view public.metrica_productos set (security_invoker = on);
alter view public.metrica_por_hora  set (security_invoker = on);
alter view public.metrica_por_dia   set (security_invoker = on);
alter view public.insumos_agotados  set (security_invoker = on);


-- ---------------------------------------------------------------------
-- 1. VENTAS DESGLOSADAS  (la vista base de todo lo demás)
-- ---------------------------------------------------------------------
-- Una fila por producto realmente entregado, haya salido suelto o dentro
-- de una promo. Es la única tabla que hay que mirar para preguntar
-- "cuántos cappuccinos hicimos".
-- Una línea del carrito puede ser una sola cosa (un cappuccino) o varias
-- (un combo, o "3 de manteca + 2 de jamón y queso"). Cuando son varias,
-- la app las deja anotadas en detalle->componentes. Acá se abren.
create or replace view public.ventas_desglosadas
with (security_invoker = on) as

-- (a) líneas que son un solo producto
select
  i.pedido_id,
  p.creado_en,
  i.categoria_id,
  i.producto_id,
  i.nombre,
  i.cantidad,
  false           as en_promo,
  null::text      as promo_id
from public.pedido_items i
join public.pedidos p on p.id = i.pedido_id
where jsonb_typeof(i.detalle->'componentes') is distinct from 'array'

union all

-- (b) líneas con desglose, abiertas en sus partes.
-- La cantidad se multiplica: 2 combos que llevan 1 café cada uno = 2 cafés.
select
  i.pedido_id,
  p.creado_en,
  comp->>'cat'      as categoria_id,
  comp->>'producto' as producto_id,
  comp->>'nombre'   as nombre,
  i.cantidad * coalesce((comp->>'cantidad')::integer, 1) as cantidad,
  (i.categoria_id = 'promociones')                       as en_promo,
  case when i.categoria_id = 'promociones' then i.producto_id end as promo_id
from public.pedido_items i
join public.pedidos p on p.id = i.pedido_id
cross join lateral jsonb_array_elements(i.detalle->'componentes') as comp
where jsonb_typeof(i.detalle->'componentes') = 'array';


-- ---------------------------------------------------------------------
-- 2. RANKING REAL DE PRODUCTOS
-- ---------------------------------------------------------------------
-- Igual que metrica_productos, pero contando lo que salió en promos.
-- La columna "dentro_de_promo" te dice qué parte de las ventas de ese
-- producto depende del combo: si es alta, sacar la promo lo hunde.
create or replace view public.metrica_productos_real
with (security_invoker = on) as
select
  categoria_id,
  producto_id,
  nombre,
  sum(cantidad)                                        as unidades,
  sum(cantidad) filter (where en_promo)                as dentro_de_promo,
  sum(cantidad) filter (where not en_promo)            as vendido_suelto,
  count(distinct pedido_id)                            as pedidos
from public.ventas_desglosadas
group by categoria_id, producto_id, nombre
order by unidades desc;


-- ---------------------------------------------------------------------
-- 3. QUÉ PROMOS FUNCIONAN
-- ---------------------------------------------------------------------
create or replace view public.metrica_promos
with (security_invoker = on) as
-- Ojo: NO se agrupa por nombre. El nombre de una promo incluye lo que
-- eligió el cliente ("Café + Waffle · Negro + Oreo"), así que agrupar por
-- ahí partiría la misma promo en veinte filas distintas.
select
  i.producto_id                                    as promo_id,
  sum(i.cantidad)                                  as vendidas,
  sum(i.cantidad * coalesce(i.precio_unitario, 0)) as facturado,
  min(p.creado_en)                                 as primera_venta,
  max(p.creado_en)                                 as ultima_venta
from public.pedido_items i
join public.pedidos p on p.id = i.pedido_id
where i.categoria_id = 'promociones'
group by i.producto_id
order by vendidas desc;


-- ---------------------------------------------------------------------
-- 4. QUÉ ELIGE LA GENTE DENTRO DE CADA PROMO
-- ---------------------------------------------------------------------
-- Sirve para podar: si en "Café + Waffle" nadie elige nunca el waffle de
-- Nutella, esa opción está ocupando lugar al pedo.
create or replace view public.metrica_opciones_promo
with (security_invoker = on) as
select
  promo_id,
  categoria_id,
  producto_id,
  nombre,
  sum(cantidad) as veces_elegido
from public.ventas_desglosadas
where en_promo
group by promo_id, categoria_id, producto_id, nombre
order by promo_id, veces_elegido desc;


-- ---------------------------------------------------------------------
-- 5. QUÉ SE COMPRA JUNTO  (para inventar promos nuevas)
-- ---------------------------------------------------------------------
-- Pares de productos que aparecen en el mismo pedido. Ordenado de mayor
-- a menor, las primeras filas son candidatas naturales a combo.
--
-- Truco para leerlo bien: filtrá por promo_id is null en la vista de
-- arriba si querés ver sólo las duplas que la gente arma SOLA, sin que
-- vos se las hayas ofrecido. Esas son las que valen oro.
create or replace view public.duplas_frecuentes
with (security_invoker = on) as
select
  a.categoria_id as cat_a,
  a.producto_id  as prod_a,
  a.nombre       as nombre_a,
  b.categoria_id as cat_b,
  b.producto_id  as prod_b,
  b.nombre       as nombre_b,
  count(distinct a.pedido_id) as veces_juntos
from public.ventas_desglosadas a
join public.ventas_desglosadas b
  on a.pedido_id = b.pedido_id
 and (a.categoria_id, coalesce(a.producto_id, '')) < (b.categoria_id, coalesce(b.producto_id, ''))
group by 1, 2, 3, 4, 5, 6
having count(distinct a.pedido_id) >= 2
order by veces_juntos desc;


-- ---------------------------------------------------------------------
-- 6. TRÍOS FRECUENTES  (los combos de a tres)
-- ---------------------------------------------------------------------
-- Lo mismo que las duplas pero de a tres. Es donde suelen aparecer los
-- patrones que no se ven a simple vista: no que el café va con la
-- medialuna (eso ya lo sabés), sino que cuando alguien pide café Y
-- medialuna, sorprendentemente también se lleva un budín.
--
-- Pide 3 pedidos como mínimo para no llenarse de casualidades: con dos
-- pedidos cualquier trío parece un patrón y no lo es.
create or replace view public.trios_frecuentes
with (security_invoker = on) as
select
  a.nombre as nombre_a,
  b.nombre as nombre_b,
  c.nombre as nombre_c,
  count(distinct a.pedido_id) as veces_juntos
from public.ventas_desglosadas a
join public.ventas_desglosadas b
  on a.pedido_id = b.pedido_id
 and (a.categoria_id, coalesce(a.producto_id, '')) < (b.categoria_id, coalesce(b.producto_id, ''))
join public.ventas_desglosadas c
  on a.pedido_id = c.pedido_id
 and (b.categoria_id, coalesce(b.producto_id, '')) < (c.categoria_id, coalesce(c.producto_id, ''))
group by 1, 2, 3
having count(distinct a.pedido_id) >= 3
order by veces_juntos desc;


-- ---------------------------------------------------------------------
-- 7. CÓMO SE ARMAN LOS PEDIDOS  (la forma de la canasta)
-- ---------------------------------------------------------------------
-- Qué categorías conviven en un mismo pedido, y de qué tamaño son los
-- pedidos. Sirve para leer el negocio de arriba: si la mayoría de los
-- pedidos son de una sola categoría y de un solo ítem, el problema no es
-- qué promo poner, es que nadie está sumando un segundo producto.
create or replace view public.forma_del_pedido
with (security_invoker = on) as
with canasta as (
  select
    pedido_id,
    count(distinct categoria_id) as categorias_distintas,
    sum(cantidad)                as unidades
  from public.ventas_desglosadas
  group by pedido_id
)
select
  categorias_distintas,
  unidades,
  count(*) as pedidos_asi
from canasta
group by 1, 2
order by pedidos_asi desc;

-- Pares de CATEGORÍAS (no de productos). Más grueso, pero con pocos
-- datos es lo primero que se vuelve legible: "bubble tea + waffle" va a
-- tener señal mucho antes que "BüBa Taro + Waffle Fit".
create or replace view public.duplas_de_categoria
with (security_invoker = on) as
select
  a.categoria_id as cat_a,
  b.categoria_id as cat_b,
  count(distinct a.pedido_id) as veces_juntas
from public.ventas_desglosadas a
join public.ventas_desglosadas b
  on a.pedido_id = b.pedido_id
 and a.categoria_id < b.categoria_id
group by 1, 2
order by veces_juntas desc;


-- ---------------------------------------------------------------------
-- 8. LO MÁS PEDIDO DE LOS ÚLTIMOS 30 DÍAS
-- ---------------------------------------------------------------------
-- Pensada para el cartelito de "Más pedido" en la carta: en vez de
-- ponerlo a mano, que lo diga la caja. Todavía no está enchufada a la
-- app; queda lista para cuando la conectemos.
create or replace view public.top_productos_30d
with (security_invoker = on) as
select
  categoria_id,
  producto_id,
  nombre,
  sum(cantidad) as unidades
from public.ventas_desglosadas
where creado_en >= now() - interval '30 days'
group by categoria_id, producto_id, nombre
order by unidades desc;
