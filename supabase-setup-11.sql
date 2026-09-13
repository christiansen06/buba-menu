-- =====================================================================
-- PARTE 11 — Costos por producto y margen real
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
-- Los costos salen de las fichas técnicas del Excel "BuBa 2.0". Se cargan
-- SOLO las columnas de costo (insumos y packaging). Las columnas de precio,
-- multiplicador y margen del Excel se ignoran a propósito: sus precios de
-- carta están viejos. El precio real de cada venta ya lo tenemos en
-- pedido_items.precio_unitario, que es mejor dato que cualquier lista.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------
-- RLS ACTIVADO Y POLÍTICA RESTRICTIVA EN ESTA MISMA MIGRACIÓN.
-- Esto es lo que salió mal en la parte 9 con parametros_negocio: se creó la
-- tabla y la política pública quedó por copiar y pegar. Acá no hay lectura
-- pública en ningún momento, ni siquiera transitoriamente. Los costos y
-- márgenes son el dato más sensible del negocio.

create table if not exists public.costos_producto (
  id              bigint generated always as identity primary key,

  -- Se indexa por lo que YA existe en pedido_items. No hay tabla productos
  -- y no hace falta: producto_id es texto en las dos.
  categoria_id    text not null,
  producto_id     text,
  -- Para bubble teas / cafés: 'medium' | 'large'.
  -- Para waffles armables: el tier ('simple' | 'mixto' | 'basico').
  variante        text,
  -- Sólo bubble teas: 'frio' | 'caliente'. NULL = aplica a cualquiera.
  presentacion    text,

  costo_insumos   numeric(10,2) not null,
  costo_packaging numeric(10,2) not null default 0,
  costo_total     numeric(10,2) generated always as (costo_insumos + costo_packaging) stored,

  -- true cuando el costo no es exacto para esa venta puntual. Hoy pasa con
  -- los waffles: el costo depende de qué relleno y qué toppings eligió el
  -- cliente, así que un número por tier es una referencia, no una medición.
  es_estimado     boolean not null default false,

  vigente_desde   date not null,
  vigente_hasta   date,
  ficha_excel     text,
  nota            text,
  creado_en       timestamptz not null default now(),

  constraint costos_vigencia_coherente check (vigente_hasta is null or vigente_hasta > vigente_desde)
);

-- Un solo costo vigente por producto+variante+presentación y fecha de inicio.
create unique index if not exists costos_producto_clave
  on public.costos_producto (
    categoria_id,
    coalesce(producto_id, ''),
    coalesce(variante, ''),
    coalesce(presentacion, ''),
    vigente_desde
  );

alter table public.costos_producto enable row level security;

drop policy if exists "el dueño lee costos" on public.costos_producto;
create policy "el dueño lee costos"
  on public.costos_producto for select
  to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "el dueño modifica costos" on public.costos_producto;
create policy "el dueño modifica costos"
  on public.costos_producto for all
  to authenticated
  using      (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);


-- ---------------------------------------------------------------------
-- 2. Carga inicial desde las fichas del Excel BuBa 2.0
-- ---------------------------------------------------------------------
-- vigente_desde = 2026-07-29, el primer día con ventas registradas, para
-- que el margen se pueda calcular sobre todo el histórico.
--
-- EL MAPEO de nombre del Excel a producto de la carta se resolvió leyendo
-- los INGREDIENTES de cada ficha, no por parecido de nombre:
--   "Black Bubble Tea"   → Té Negro + Salsa Caramelo Negro  → brown-sugar
--   "Brown Sugar Matcha" → Té Matcha + Leche + Agua          → matcha
--   "BuBa Flan"          → Flan + Salsa Caramelo             → flan

insert into public.costos_producto
  (categoria_id, producto_id, variante, presentacion, costo_insumos, costo_packaging,
   es_estimado, vigente_desde, ficha_excel, nota)
values
  -- ===== BUBBLE TEA (500 cc = mediano / 16 oz · 600 cc = grande / 20 oz) =====
  ('bubble-tea','brown-sugar','medium','frio',      825.42, 861.13, false,'2026-07-29','Black Bubble Tea · 500 cc',null),
  ('bubble-tea','brown-sugar','large', 'frio',      994.85, 868.16, false,'2026-07-29','Black Bubble Tea · 600 cc',null),
  ('bubble-tea','brown-sugar','medium','caliente', 1036.82, 861.13, false,'2026-07-29','Black Bubble Tea · 500 cc (caliente)',null),
  ('bubble-tea','matcha',     'medium','frio',      970.42, 861.13, false,'2026-07-29','Brown Sugar Matcha · 500 cc',null),
  ('bubble-tea','matcha',     'large', 'frio',     1222.42, 868.16, false,'2026-07-29','Brown Sugar Matcha · 600 cc',null),
  ('bubble-tea','flan',       'medium','frio',     1327.00, 861.13, false,'2026-07-29','BuBa Flan · 500 cc',null),
  ('bubble-tea','flan',       'large', 'frio',     1875.00, 868.16, false,'2026-07-29','BuBa Flan · 600 cc',null),
  ('bubble-tea','chocolate',  'medium','frio',     1281.36, 861.13, false,'2026-07-29','Chocolate Bubba Milk · 500 cc',null),
  ('bubble-tea','chocolate',  'large', 'frio',     1527.09, 868.16, false,'2026-07-29','Chocolate Bubba Milk · 600 cc',null),
  ('bubble-tea','oreo',       'medium','frio',     1402.52, 861.13, false,'2026-07-29','Oreo Bubba Milk · 500 cc',null),
  ('bubble-tea','oreo',       'large', 'frio',     1747.63, 868.16, false,'2026-07-29','Oreo Bubba Milk · 600 cc',null),
  ('bubble-tea','frutilla',   'medium','frio',     1629.56, 861.13, false,'2026-07-29','Strawberry Bubble Tea · 500 cc',null),
  ('bubble-tea','frutilla',   'large', 'frio',     2063.93, 868.16, false,'2026-07-29','Strawberry Bubble Tea · 600 cc',null),
  ('bubble-tea','taro',       'medium','frio',     1412.68, 861.13, false,'2026-07-29','Taro Bubble Milk · 500 cc',null),
  ('bubble-tea','taro',       'large', 'frio',     1833.68, 868.16, false,'2026-07-29','Taro Bubble Milk · 600 cc',null),
  ('bubble-tea','thai',       'medium','frio',     1337.72, 861.13, false,'2026-07-29','Thai Bubble Tea · 500 cc',null),
  ('bubble-tea','thai',       'large', 'frio',     1663.76, 868.16, false,'2026-07-29','Thai Bubble Tea · 600 cc',null),

  -- ===== FRAPPUCCINOS =====
  ('frappuccinos','frutilla-frappe', 'medium',null,1280.00, 664.94, false,'2026-07-29','Frappuccino Frutilla · 500 cc',null),
  ('frappuccinos','frutilla-frappe', 'large', null,1660.00, 671.97, false,'2026-07-29','Frappuccino Frutilla · 600 cc',null),
  ('frappuccinos','chocolate-moca',  'medium',null, 937.71, 664.94, false,'2026-07-29','Frappuccino Mocha · 500 cc',null),
  ('frappuccinos','chocolate-moca',  'large', null,1234.18, 671.97, false,'2026-07-29','Frappuccino Mocha · 600 cc',null),
  ('frappuccinos','oreo-frappe',     'medium',null, 980.00, 664.94, false,'2026-07-29','Frappuccino Oreo · 500 cc',null),
  ('frappuccinos','oreo-frappe',     'large', null,1348.00, 671.97, false,'2026-07-29','Frappuccino Oreo · 600 cc',null),

  -- ===== ICED COFFEE =====
  ('iced-coffee','americano',   'medium',null, 654.19, 861.13, false,'2026-07-29','Americano · 500 cc',null),
  ('iced-coffee','americano',   'large', null, 654.19, 868.16, false,'2026-07-29','Americano · 600 cc',null),
  ('iced-coffee','latte',       'medium',null, 562.01, 861.13, false,'2026-07-29','Latte · 500 cc',null),
  ('iced-coffee','latte',       'large', null, 744.01, 868.16, false,'2026-07-29','Latte · 600 cc',null),
  ('iced-coffee','caramel-latte','medium',null, 562.01, 861.13, false,'2026-07-29','Caramel Latte · 500 cc',null),
  ('iced-coffee','caramel-latte','large', null, 844.47, 868.16, false,'2026-07-29','Caramel Latte · 600 cc',null),
  ('iced-coffee','dark-moca',   'medium',null, 905.47, 861.13, false,'2026-07-29','Dark Moca · 500 cc',null),
  ('iced-coffee','dark-moca',   'large', null,1248.09, 868.16, false,'2026-07-29','Dark Moca · 600 cc',null),
  ('iced-coffee','matcha-latte','medium',null, 870.70, 861.13, false,'2026-07-29','Matcha Latte · 500 cc',null),
  ('iced-coffee','matcha-latte','large', null,1473.77, 868.16, false,'2026-07-29','Matcha Latte · 600 cc',null),

  -- ===== POSTRES =====
  -- Los #REF! que mostraba la hoja Resumen_Margenes eran de esa hoja, no de
  -- las fichas: acá los costos existen y están completos.
  ('postres','chocotorta',  null,null,1914.52, 311.00, false,'2026-07-29','Chocotorta · 1 Unidad',null),
  ('postres','postre-oreo', null,null,1184.00, 311.00, false,'2026-07-29','Choco Oreo · 1 Unidad',null),

  -- ===== TOSTADOS =====
  ('tostados','tostado-entero',null,null,1365.65, 181.51, false,'2026-07-29','Tostado · 1 Unidad',null),
  ('tostados','tostado-medio', null,null, 682.83,   0.00, false,'2026-07-29','Tostado · 1/2 Unidad',null),

  -- ===== WAFFLES — ver la nota, son estimados =====
  -- El waffle es armable: el costo depende del relleno y los toppings que
  -- elige el cliente. El Excel trae DOS fichas de "Mixto" con recetas
  -- distintas ($1.537 con helado+crema y $2.143 con dulce de leche+crema+
  -- oreo). Se carga la MÁS CARA de las dos: para decidir precios conviene
  -- equivocarse por el lado conservador. Por eso es_estimado = true.
  ('waffles','armado','simple',null,1155.13, 129.09, true,'2026-07-29','Bubble Waffle Simple · 1 Unidad',
     'Receta de ejemplo: masa + crema + frutilla + salsa chocolate. El costo real varía con el relleno elegido.'),
  ('waffles','armado','mixto', null,2014.38, 129.09, true,'2026-07-29','Bubble Waffle Mixto · 1 Unidad (receta cara)',
     'El Excel trae dos recetas de mixto: $1.537 y $2.143. Se carga la cara. El costo real de cada venta varía con el relleno y los toppings.'),
  ('waffles','nutella',null,   null,3197.45, 129.09, true,'2026-07-29','Bubble Waffle Nutella · 1 Unidad',
     'Preset. El cliente puede agregar salsa Nutella extra, que no está en esta ficha.')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 3. La vista de margen
-- ---------------------------------------------------------------------
-- Precio = precio_unitario de la venta (snapshot real, ya existía).
-- Costo  = el vigente a la fecha de ese pedido.
--
-- El join del tier: en los waffles el tier vive en detalle->>'tier', y en
-- el resto de los productos la variante vive en la columna variante. El
-- coalesce cubre los dos casos con una sola regla.
create or replace view public.margen_por_producto
with (security_invoker = on) as
select
  i.categoria_id,
  i.producto_id,
  coalesce(i.detalle->>'tier', i.variante)                          as variante,
  min(i.nombre)                                                    as nombre,
  sum(i.cantidad)                                                  as unidades,
  sum(i.cantidad * i.precio_unitario)                              as facturado,
  round(sum(i.cantidad * c.costo_total))                           as costo,
  round(sum(i.cantidad * (i.precio_unitario - c.costo_total)))     as margen,
  round(100.0 * sum(i.cantidad * c.costo_total)
              / nullif(sum(i.cantidad * i.precio_unitario), 0), 1) as food_cost_pct,
  bool_or(c.es_estimado)                                           as tiene_estimados
from public.pedido_items i
join public.pedidos p on p.id = i.pedido_id
join public.costos_producto c
  on  c.categoria_id = i.categoria_id
  and coalesce(c.producto_id, '') = coalesce(i.producto_id, '')
  and (c.variante is null
       or c.variante = coalesce(i.detalle->>'tier', i.variante))
  and (c.presentacion is null
       or c.presentacion = coalesce(i.detalle->>'presentacion', 'frio'))
  and (p.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
        between c.vigente_desde and coalesce(c.vigente_hasta, date '9999-12-31')
where i.precio_unitario is not null
group by 1, 2, 3
order by margen desc;


-- Cobertura: cuánto de lo facturado tiene costo cargado y cuánto no.
-- Es el número honesto para saber si el reporte de margen se puede mirar.
create or replace view public.cobertura_costos
with (security_invoker = on) as
with medido as (
  select i.id,
         i.cantidad * i.precio_unitario as facturado,
         exists (
           select 1 from public.costos_producto c
           where c.categoria_id = i.categoria_id
             and coalesce(c.producto_id,'') = coalesce(i.producto_id,'')
             and (c.variante is null or c.variante = coalesce(i.detalle->>'tier', i.variante))
             and (c.presentacion is null or c.presentacion = coalesce(i.detalle->>'presentacion','frio'))
         ) as tiene_costo
  from public.pedido_items i
  where i.precio_unitario is not null
)
select
  sum(facturado)                                            as facturado_total,
  sum(facturado) filter (where tiene_costo)                 as facturado_con_costo,
  round(100.0 * sum(facturado) filter (where tiene_costo)
              / nullif(sum(facturado), 0), 1)               as cobertura_pct
from medido;


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
drop view if exists public.cobertura_costos;
drop view if exists public.margen_por_producto;
drop table if exists public.costos_producto;
*/
