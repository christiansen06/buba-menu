-- =====================================================================
-- PARTE 12 — El costo real de cada waffle, calculado desde lo que eligió
--            el cliente
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
--
-- POR QUÉ
--
-- La parte 11 le puso a cada waffle un costo por tier: $1.155 para simple,
-- $2.014 para mixto. Eso es una referencia, no una medición, y quedó marcado
-- con es_estimado = true. El problema real es que un waffle no tiene UN costo:
-- el waffle con Ferrero y el waffle con banana cuestan distinto, y los dos se
-- venden al mismo precio de tier.
--
-- Pero el dato para calcularlo bien ya lo estamos guardando. Cada línea de
-- waffle tiene en `detalle` exactamente qué eligió el cliente:
--
--     {"rellenos":[{"type":"helado","flavor":"americana"}],
--      "toppings":["frutilla","ferrero"],
--      "salsas":["chocolate"]}
--
-- Esta parte carga el costo por componente y arma la suma. El costo de cada
-- waffle vendido pasa a ser el de SU receta, no el promedio de su tier.
--
-- De paso arregla dos cosas que la parte 11 dejaba rotas:
--
--   1. Los presets frutilla, oreo, argentina y fit no tenían costo cargado.
--      Son $1.085.000 de facturación, el 17% del total, y eran la mayor
--      parte del agujero de cobertura.
--
--   2. El costo que la parte 11 le cargó al preset "nutella" venía de la
--      ficha "Bubble Waffle Nutella" del Excel, que es OTRA receta: la del
--      Excel lleva frutilla, Oreo y salsa de pistacho; la de la carta lleva
--      banana y salsa de chocolate. El costo estaba mal, no estimado.
--
--
-- DE DÓNDE SALEN LOS NÚMEROS
--
-- Costos: Mercaderia_Actual, Materia_Prima, Preparaciones_Base y Packaging
-- del Excel "BuBa 2.0" — las hojas que Agustín confirmó que están al día.
--
-- Gramajes: Recetario_Waffles y Fichas_Waffles del mismo Excel, para los
-- componentes que aparecen ahí. Para los que no aparecen en ninguna ficha
-- (banana, durazno, chocolinas, pepito, Cofler, Ferrero) el gramaje va
-- asumido y marcado con es_estimado = true. Están todos en la tabla, así
-- que corregir uno es un UPDATE de una fila, no una migración.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La tabla de componentes
-- ---------------------------------------------------------------------
-- Misma regla que la parte 11, por lo que pasó en la parte 9: RLS activado
-- y política restrictiva EN ESTA MISMA MIGRACIÓN, sin lectura pública en
-- ningún momento.

create table if not exists public.costos_componente_waffle (
  -- 'crema', 'helado', 'oreo', 'ferrero'... Son los mismos ids que usa
  -- src/data/menu.js, que son los que terminan guardados en `detalle`.
  componente     text not null,

  -- 'base'    → va en todo waffle (la masa, el packaging)
  -- 'relleno' → detalle->'rellenos'[].type
  -- 'topping' → detalle->'toppings'[]
  -- 'salsa'   → detalle->'salsas'[]
  -- 'extra'   → el plus de salsa de Nutella (detalle->>'extraNutella')
  tipo           text not null check (tipo in ('base','relleno','topping','salsa','extra')),
  etiqueta       text not null,

  unidad         text not null default 'g' check (unidad in ('g','unidad')),
  costo_unitario numeric(12,4) not null check (costo_unitario >= 0),

  -- Cuánto lleva un waffle de este componente.
  cantidad       numeric(10,2) not null check (cantidad >= 0),

  -- `siempre` = va en todo waffle aunque el cliente no lo haya elegido.
  -- Es el caso de la masa, el packaging y la crema chantilly: la crema es
  -- guarnición fija de la casa (50 g) Y además es un relleno elegible. Cuando
  -- el cliente la elige como relleno se le suma `cantidad_extra_si_elegido`.
  siempre        boolean not null default false,
  cantidad_extra_si_elegido numeric(10,2) not null default 0,

  -- true cuando el costo o el gramaje no salen de una ficha, sino de un
  -- supuesto mío. Sirve para que las vistas puedan decir "este número mirálo
  -- con pinzas" en vez de presentarlo como medido.
  es_estimado    boolean not null default false,

  fuente         text,
  nota           text,
  actualizado_en timestamptz not null default now(),

  primary key (tipo, componente)
);

alter table public.costos_componente_waffle enable row level security;

drop policy if exists "el dueño lee componentes" on public.costos_componente_waffle;
create policy "el dueño lee componentes"
  on public.costos_componente_waffle for select
  to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "el dueño modifica componentes" on public.costos_componente_waffle;
create policy "el dueño modifica componentes"
  on public.costos_componente_waffle for all
  to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);


-- ---------------------------------------------------------------------
-- 2. Los componentes
-- ---------------------------------------------------------------------

delete from public.costos_componente_waffle;

insert into public.costos_componente_waffle
  (tipo, componente, etiqueta, unidad, costo_unitario, cantidad,
   siempre, cantidad_extra_si_elegido, es_estimado, fuente, nota)
values

-- ---- BASE: va en todos ----------------------------------------------
('base','masa','Masa de waffle','g',2.5487,160,true,0,false,
 'Preparaciones_Base (rinde 860 g) + Recetario_Waffles',null),

('base','packaging','Packaging waffle','unidad',129.0943,1,true,0,false,
 'Packaging → "Packaging Waffle"',
 'Vaso 8oz + 2 servilletas + tenedor + cuchara sundae'),

-- ---- RELLENOS --------------------------------------------------------
-- La crema es el único componente que juega doble: la casa le pone 50 g a
-- todo waffle como guarnición, y además es un relleno elegible. Las cuatro
-- fichas del Excel usan 50 g cuando NO es el relleno elegido y 60 g cuando
-- sí lo es (salvo la ficha Mixta ddl+crema, que usa 90 g — ver VERIFICACIÓN).
('relleno','crema','Crema chantilly','g',6.2495,50,true,10,false,
 'Preparaciones_Base (rinde 730 g) + Fichas_Waffles',
 '50 g de guarnición en todo waffle, 60 g si el cliente la elige de relleno'),

('relleno','helado','Helado','g',4.5000,70,false,0,false,
 'Mercaderia_Actual → Helados Matilda x10Lt + Recetario_Waffles',
 'Mismo costo para los seis gustos'),

('relleno','ddl','Dulce de leche','g',4.2954,60,false,0,false,
 'Mercaderia_Actual → Dulce de Leche Tradi + Recetario_Waffles',null),

('relleno','nutella','Nutella','g',21.6374,60,false,0,false,
 'Mercaderia_Actual → Nutella 650 g + Recetario_Waffles',null),

('relleno','mani','Mantequilla de maní','g',0.0000,60,false,0,true,
 'SIN DATO',
 'FALTA: la mantequilla de maní no está en el Excel, ni en Materia_Prima ni '
 'en Mercaderia_Actual. Va en $0, o sea que el Waffle Fit sale más barato de '
 'lo que realmente cuesta. 9 ventas del armable + el preset fit.'),

-- ---- TOPPINGS --------------------------------------------------------
('topping','frutilla','Frutilla','g',10.0000,35,false,0,false,
 'Materia_Prima → Frutilla + Fichas_Waffles','Las cuatro fichas usan 35 g'),

('topping','oreo','Oreo','g',12.9390,33,false,0,false,
 'Materia_Prima → Oreo 182 G + Recetario_Waffles','3 unidades ≈ 33 g'),

('topping','banana','Banana','g',2.9000,60,false,0,true,
 'Materia_Prima → Banana (costo OK) / gramaje asumido',
 'No hay ficha con banana. 60 g ≈ media banana. Impacto $174.'),

('topping','durazno','Durazno','g',3.0488,40,false,0,true,
 'Materia_Prima → Durazno (costo OK) / gramaje asumido',
 'No hay ficha con durazno. 40 g ≈ una mitad de lata. Impacto $122.'),

('topping','chocolinas','Chocolinas','g',7.3800,30,false,0,true,
 'Materia_Prima → Chocolinas x 40 (costo OK) / gramaje asumido',
 'No hay ficha. 30 g ≈ 2 galletitas. Impacto $221.'),

('topping','pepito','Pepito','g',10.7500,30,false,0,true,
 'Materia_Prima → Pepitos (costo OK) / gramaje asumido',
 'No hay ficha. 30 g ≈ 2 galletitas. Impacto $323.'),

('topping','coffler','Cofler','g',27.2727,25,false,0,true,
 'Materia_Prima → Cofler choco bañadas (costo OK) / gramaje asumido',
 'No hay ficha. Impacto $682.'),

('topping','ferrero','Ferrero Rocher','unidad',962.7800,1,false,0,true,
 'Materia_Prima → BomBon F. Rocher 3 Uni ($2.888,34 / 3) / cantidad asumida',
 'El más caro de todos y el más usado después de frutilla, Oreo y banana '
 '(47 ventas). Asumo 1 bombón por waffle. Si van 2, el Waffle Argentina '
 'cuesta $963 más de lo que dice acá.'),

-- ---- SALSAS ----------------------------------------------------------
-- El Recetario usa 7 g de salsa en todas las recetas. Se toma eso como
-- estándar único.
('salsa','chocolate','Salsa de chocolate','g',3.1957,7,false,0,false,
 'Preparaciones_Base → Salsa Chocolate (casera, rinde 380 g)',null),

('salsa','caramelo','Salsa de caramelo','g',2.8575,7,false,0,false,
 'Preparaciones_Base → Salsa Caramelo (casera, rinde 320 g)',
 'Se usa la casera. La "Salsa Caramelo" comprada figura en Materia_Prima '
 'como PENDIENTE: cargar cantidad y precio.'),

('salsa','frutilla','Salsa de frutilla','g',8.8564,7,false,0,true,
 'Preparaciones_Base → Salsa Frutilla Casera (rinde 425 g)',
 'A CONFIRMAR: hay dos. La casera sale $8,86/g y la Salsa Gourmet Frutilla '
 '$16,20/g. Asumo la casera. Si es la Gourmet, cada waffle con esta salsa '
 'cuesta $51 más.'),

('salsa','pistacho','Salsa de pistacho','g',40.1961,7,false,0,false,
 'Materia_Prima → Salsa Gourmet Pistacho','Es la única, no hay casera'),

('salsa','ddl','Salsa de dulce de leche','g',4.2954,7,false,0,false,
 'Mercaderia_Actual → Dulce de Leche Tradi',null),

('salsa','nutella','Salsa de Nutella','g',21.6374,7,false,0,false,
 'Mercaderia_Actual → Nutella 650 g',null),

-- ---- EXTRA -----------------------------------------------------------
('extra','nutella_extra','Extra de salsa de Nutella','g',21.6374,20,false,0,true,
 'Mercaderia_Actual → Nutella 650 g (costo OK) / gramaje asumido',
 'Es el nutellaSaucePrice de $500 de la carta. 20 g asumidos → costo $433, '
 'o sea que el extra se está vendiendo por debajo del costo.');


-- ---------------------------------------------------------------------
-- 3. El costo real de cada línea de waffle
-- ---------------------------------------------------------------------
-- Una fila por línea de pedido de la categoría waffles.
--
-- Detalle de implementación que importa: los rellenos de helado se guardan
-- con un id único por click ("helado-americana-1786740248307"), así que el
-- join va por `type` + `flavor`, nunca por `id`. Se usa distinct porque
-- verifiqué que ningún waffle vendido (271 líneas) tiene dos rellenos del
-- mismo tipo: los mixtos son siempre dos tipos distintos.

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
      + case when (c.tipo = 'relleno' and c.componente = any(l.rellenos))
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


-- ---------------------------------------------------------------------
-- 4. Los costos por tier de la parte 11 se van
-- ---------------------------------------------------------------------
-- Quedaron obsoletos: el modelo por componente cubre TODOS los waffles, no
-- sólo armado/simple, armado/mixto y nutella. Dejarlos sería tener dos
-- verdades sobre el mismo producto. Y el de nutella, además, era la receta
-- equivocada.

delete from public.costos_producto where categoria_id = 'waffles';


-- ---------------------------------------------------------------------
-- 5. Las vistas de la parte 11, ahora con el costo real del waffle
-- ---------------------------------------------------------------------
-- Van con drop: `create or replace view` sólo permite AGREGAR columnas al
-- final, y acá cambia el FROM.

drop view if exists public.margen_por_producto;

create view public.margen_por_producto
with (security_invoker = on) as
with linea as (
  select
    i.categoria_id,
    i.producto_id,
    coalesce(i.detalle->>'tier', i.variante) as variante,
    i.nombre,
    i.cantidad,
    i.precio_unitario,
    -- El waffle manda: si la línea es un waffle, su costo es el de SU receta.
    -- Para todo lo demás sigue valiendo el costo por producto de la parte 11.
    coalesce(w.costo_total, c.costo_total)              as costo_unidad,
    coalesce(w.tiene_estimados, c.es_estimado)          as estimado
  from public.pedido_items i
  join public.pedidos p on p.id = i.pedido_id
  left join public.costo_waffle w
    on w.pedido_item_id = i.id
  left join public.costos_producto c
    on  c.categoria_id = i.categoria_id
    and coalesce(c.producto_id, '') = coalesce(i.producto_id, '')
    and (c.variante is null
         or c.variante = coalesce(i.detalle->>'tier', i.variante))
    and (c.presentacion is null
         or c.presentacion = coalesce(i.detalle->>'presentacion', 'frio'))
    and (p.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
          between c.vigente_desde and coalesce(c.vigente_hasta, date '9999-12-31')
  where i.precio_unitario is not null
)
select
  categoria_id,
  producto_id,
  variante,
  min(nombre)                                                  as nombre,
  sum(cantidad)                                                as unidades,
  sum(cantidad * precio_unitario)                              as facturado,
  round(sum(cantidad * costo_unidad))                          as costo,
  round(sum(cantidad * (precio_unitario - costo_unidad)))      as margen,
  round(100.0 * sum(cantidad * costo_unidad)
              / nullif(sum(cantidad * precio_unitario), 0), 1) as food_cost_pct,
  bool_or(estimado)                                            as tiene_estimados
from linea
where costo_unidad is not null
group by 1, 2, 3
order by margen desc;


drop view if exists public.cobertura_costos;

create view public.cobertura_costos
with (security_invoker = on) as
with medido as (
  select
    i.cantidad * i.precio_unitario as facturado,
    (w.pedido_item_id is not null) or exists (
      select 1 from public.costos_producto c
      where c.categoria_id = i.categoria_id
        and coalesce(c.producto_id,'') = coalesce(i.producto_id,'')
        and (c.variante is null or c.variante = coalesce(i.detalle->>'tier', i.variante))
        and (c.presentacion is null or c.presentacion = coalesce(i.detalle->>'presentacion','frio'))
    ) as tiene_costo
  from public.pedido_items i
  left join public.costo_waffle w on w.pedido_item_id = i.id
  where i.precio_unitario is not null
)
select
  sum(facturado)                                            as facturado_total,
  sum(facturado) filter (where tiene_costo)                 as facturado_con_costo,
  round(100.0 * sum(facturado) filter (where tiene_costo)
              / nullif(sum(facturado), 0), 1)               as cobertura_pct
from medido;


-- Qué componente aporta cuánto: sirve para saber dónde conviene negociar
-- precio con el proveedor y para ver el peso real de lo estimado.
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
    + case when (c.tipo = 'relleno' and c.componente = any(l.rellenos))
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
-- VERIFICACIÓN — el modelo contra las cuatro fichas del Excel
--
-- Reconstruyendo a mano cada ficha con los componentes de esta tabla:
--
--   Simple (crema + frutilla + salsa choco)
--       modelo 1.155,13   ficha 1.155,13   →  exacto
--   Con helado (helado + crema guarnición + frutilla + salsa choco)
--       modelo 1.407,64   ficha 1.407,63   →  exacto
--   Mixta (ddl + crema + frutilla + Oreo + salsa choco)
--       modelo 1.839,84   ficha 2.014,38   →  −8,7%
--   Nutella del Excel (nutella + crema + frutilla + Oreo + salsa pistacho)
--       modelo 3.076,87   ficha 3.197,45   →  −3,8%
--
-- Las dos diferencias son gramajes donde el Excel se contradice a sí mismo:
--
--   · Crema. Esa ficha usa 90 g; las otras tres usan 50 g cuando la crema
--     acompaña y 60 g cuando es el relleno elegido. No hay una regla que dé
--     los cuatro valores a la vez, así que tomé 50/60, que acierta en tres
--     de cuatro fichas y en particular en el Waffle Frutilla, que es el
--     waffle más vendido ($562.000). Toda la diferencia de esa ficha son
--     30 g de crema = $187.
--
--   · Pistacho. Fichas_Waffles pone 10 g, Recetario_Waffles pone 7 g para
--     la misma receta. Tomé 7 g, que es el estándar de todas las salsas en
--     el recetario. Toda la diferencia son 3 g = $121.
--
-- Los dos son números que Agustín puede corregir con un UPDATE de una fila.
-- =====================================================================


-- =====================================================================
-- PARA VOLVER ATRÁS
--
-- Deja la base como la dejó la parte 11, incluidos los tres costos por tier
-- que esta parte borra.
-- =====================================================================
/*
drop view if exists public.costo_componentes_waffle_uso;
drop view if exists public.cobertura_costos;
drop view if exists public.margen_por_producto;
drop view if exists public.costo_waffle;
drop table if exists public.costos_componente_waffle;

insert into public.costos_producto
  (categoria_id, producto_id, variante, costo_insumos, costo_packaging,
   es_estimado, vigente_desde, ficha_excel)
values
  ('waffles','armado','simple',1155.13,129.09,true,date '2026-07-29','Bubble Waffle Simple · 1 Unidad'),
  ('waffles','armado','mixto', 2014.38,129.09,true,date '2026-07-29','Bubble Waffle Mixto · 1 Unidad (receta cara)'),
  ('waffles','nutella',null,   3197.45,129.09,true,date '2026-07-29','Bubble Waffle Nutella · 1 Unidad');

-- y volver a crear margen_por_producto y cobertura_costos como están en
-- supabase-setup-11.sql
*/
