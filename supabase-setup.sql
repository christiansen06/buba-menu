-- =====================================================================
-- BüBa — Estructura de la base de datos
-- Pegar TODO esto en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. DISPONIBILIDAD  (qué productos están sin stock)
-- ---------------------------------------------------------------------
-- Se guarda la CATEGORÍA junto al producto porque hay ids repetidos
-- entre categorías (el waffle "oreo" y el bubble tea "oreo" son
-- distintos). Sin la categoría se mezclarían.
create table if not exists public.disponibilidad (
  categoria_id   text not null,
  producto_id    text not null,
  disponible     boolean not null default true,
  actualizado_en timestamptz not null default now(),
  primary key (categoria_id, producto_id)
);

alter table public.disponibilidad enable row level security;

drop policy if exists "leer disponibilidad" on public.disponibilidad;
create policy "leer disponibilidad"
  on public.disponibilidad for select
  to anon, authenticated
  using (true);

-- Sólo un usuario logueado (vos) puede marcar sin stock.
drop policy if exists "modificar disponibilidad" on public.disponibilidad;
create policy "modificar disponibilidad"
  on public.disponibilidad for all
  to authenticated
  using (true)
  with check (true);


-- ---------------------------------------------------------------------
-- 2. PEDIDOS  (una fila por pedido enviado)
-- ---------------------------------------------------------------------
-- Sin nombre ni teléfono del cliente: sólo qué se pidió y cuándo.
create table if not exists public.pedidos (
  id             uuid primary key,
  creado_en      timestamptz not null default now(),
  total          integer not null,
  cantidad_items integer not null
);

alter table public.pedidos enable row level security;

-- La app puede ANOTAR pedidos...
drop policy if exists "anotar pedidos" on public.pedidos;
create policy "anotar pedidos"
  on public.pedidos for insert
  to anon, authenticated
  with check (true);

-- ...pero NADIE puede leerlos sin estar logueado. Tus ventas no son públicas.
drop policy if exists "leer pedidos" on public.pedidos;
create policy "leer pedidos"
  on public.pedidos for select
  to authenticated
  using (true);


-- ---------------------------------------------------------------------
-- 3. PEDIDO_ITEMS  (una fila por línea del pedido)
-- ---------------------------------------------------------------------
-- "detalle" guarda la configuración de los armables (rellenos, toppings,
-- salsas) para poder preguntar después cosas como "cuántas veces se
-- eligió el topping pepito".
create table if not exists public.pedido_items (
  id              bigint generated always as identity primary key,
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  categoria_id    text not null,
  producto_id     text,
  nombre          text not null,
  variante        text,
  cantidad        integer not null,
  precio_unitario integer,
  detalle         jsonb
);

alter table public.pedido_items enable row level security;

drop policy if exists "anotar items" on public.pedido_items;
create policy "anotar items"
  on public.pedido_items for insert
  to anon, authenticated
  with check (true);

drop policy if exists "leer items" on public.pedido_items;
create policy "leer items"
  on public.pedido_items for select
  to authenticated
  using (true);

create index if not exists idx_items_producto on public.pedido_items (categoria_id, producto_id);
create index if not exists idx_pedidos_fecha  on public.pedidos (creado_en);


-- ---------------------------------------------------------------------
-- 4. VISTAS PARA MIRAR LAS MÉTRICAS
-- ---------------------------------------------------------------------
-- Ranking de productos: qué se pide más.
create or replace view public.metrica_productos as
select
  categoria_id,
  producto_id,
  nombre,
  sum(cantidad)                        as unidades,
  count(distinct pedido_id)            as pedidos,
  sum(cantidad * coalesce(precio_unitario, 0)) as facturado
from public.pedido_items
group by categoria_id, producto_id, nombre
order by unidades desc;

-- Pedidos por hora del día: para saber cuándo hace falta gente en barra.
create or replace view public.metrica_por_hora as
select
  extract(hour from creado_en at time zone 'America/Argentina/Buenos_Aires') as hora,
  count(*)      as pedidos,
  round(avg(total)) as ticket_promedio
from public.pedidos
group by 1
order by 1;

-- Pedidos por día de la semana (0 = domingo).
create or replace view public.metrica_por_dia as
select
  extract(dow from creado_en at time zone 'America/Argentina/Buenos_Aires') as dia_semana,
  count(*)      as pedidos,
  round(avg(total)) as ticket_promedio
from public.pedidos
group by 1
order by 1;
