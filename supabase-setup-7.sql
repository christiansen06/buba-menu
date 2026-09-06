-- =====================================================================
-- PARTE 7 — Integridad y seguridad
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- NO borra ni modifica ninguna venta. Al final está el bloque de reversa.
--
-- Salió de auditar la base con los datos en vivo (337 pedidos, 579 líneas,
-- 29/07 → 05/09/2026). Cuatro cosas, en este orden porque hay dependencias.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Se va cantidad_items
-- ---------------------------------------------------------------------
-- La columna nunca guardó lo que su nombre dice. registrar_pedido la
-- escribía como jsonb_array_length(p_items), o sea el número de LÍNEAS
-- del pedido, no la suma de unidades. En los 337 pedidos coincide con el
-- conteo de líneas; los 26 que "no cuadraban" son exactamente los que
-- tienen alguna línea con cantidad > 1.
--
-- No hay nada que recuperar: de pedido_items salen las dos cosas.
--   líneas   → count(*)
--   unidades → sum(cantidad)   ← la que realmente importa
--
-- El front no la lee (sólo la escribía la función), así que se puede ir.

-- 1.a La vista la exponía, y "create or replace view" no puede sacar una
--     columna: hay que borrarla y rehacerla. Nada depende de ella.
drop view if exists public.pedidos_local;

create view public.pedidos_local
with (security_invoker = on) as
select
  id,
  (creado_en at time zone 'America/Argentina/Buenos_Aires')::timestamp(0) as fecha_hora,
  to_char(creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
  total,
  -- Ahora las dos, calculadas de donde corresponde y sin poder desfasarse.
  (select count(*) from public.pedido_items i where i.pedido_id = p.id)                as lineas,
  (select coalesce(sum(i.cantidad),0) from public.pedido_items i where i.pedido_id = p.id) as unidades,
  creado_en as guardado_utc
from public.pedidos p
order by creado_en desc;

-- 1.b La función deja de escribirla. La firma (integer, jsonb) NO cambia,
--     así que src/utils/pedidos.js sigue funcionando sin tocar nada.
--     De paso se le fija el search_path, que el linter marcaba (punto 4).
create or replace function public.registrar_pedido(
  p_total          integer,
  p_items          jsonb
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

  insert into public.pedidos (id, total)
  values (v_id, p_total);

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
    -- Un JSON null escalar entra como NULL de verdad (ver punto 2).
    case when jsonb_typeof(item->'detalle') = 'object' then item->'detalle' end
  from jsonb_array_elements(p_items) as item;

  return v_id;
end;
$$;

grant execute on function public.registrar_pedido(integer, jsonb) to anon, authenticated;

-- 1.c Recién ahora se puede sacar la columna.
alter table public.pedidos drop column if exists cantidad_items;


-- ---------------------------------------------------------------------
-- 2. detalle: un solo criterio para "no hay detalle"
-- ---------------------------------------------------------------------
-- Convivían 119 filas con el JSON null escalar y 460 con un objeto (cero
-- con NULL de SQL). Mezclar los dos rompe queries: jsonb_object_keys()
-- falla con "cannot call jsonb_object_keys on a scalar".
--
-- Se unifica en NULL de SQL, que es lo que significa: no hay detalle.
-- Ninguna vista se rompe — todas preguntan por jsonb_typeof(...) = 'array'
-- o usan ->>, y las dos cosas toleran NULL.
update public.pedido_items
set detalle = null
where jsonb_typeof(detalle) = 'null';

-- Y que no vuelva a pasar: o es NULL, o es un objeto.
alter table public.pedido_items
  drop constraint if exists pedido_items_detalle_objeto;

alter table public.pedido_items
  add constraint pedido_items_detalle_objeto
  check (detalle is null or jsonb_typeof(detalle) = 'object');


-- ---------------------------------------------------------------------
-- 3. Seguridad: el stock y las ventas, sólo para el dueño
-- ---------------------------------------------------------------------
-- Estaba así:
--   disponibilidad / insumos → cmd=ALL, using=true, rol authenticated
--   pedidos / pedido_items   → SELECT para cualquier authenticated
--
-- "authenticated" es CUALQUIER usuario logueado. Hoy hay uno solo (el
-- dueño), así que no hubo exposición, pero si algún día se abre el
-- registro, un desconocido podría apagar toda la carta o leer la
-- facturación completa.
--
-- Aclaración sobre algo que decía la auditoría: NO había fuga por la
-- anon key. La lectura de pedidos nunca incluyó al rol anon.
--
-- Lo que NO se toca, porque el menú público lo necesita:
--   · leer disponibilidad e insumos sin login (para mostrar "sin stock")
--   · insertar pedidos de forma anónima (el cliente no se loguea)

-- 3.a Stock: leer todos, escribir sólo el dueño.
drop policy if exists "modificar disponibilidad" on public.disponibilidad;
create policy "el dueño modifica disponibilidad"
  on public.disponibilidad for all
  to authenticated
  using  (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "modificar insumos" on public.insumos;
create policy "el dueño modifica insumos"
  on public.insumos for all
  to authenticated
  using  (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

-- 3.b Ventas: las lee sólo el dueño. El alta anónima queda intacta.
drop policy if exists "leer pedidos" on public.pedidos;
create policy "el dueño lee pedidos"
  on public.pedidos for select
  to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "leer items" on public.pedido_items;
create policy "el dueño lee items"
  on public.pedido_items for select
  to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);


-- ---------------------------------------------------------------------
-- 4. search_path de registrar_pedido
-- ---------------------------------------------------------------------
-- Ya quedó fijado arriba, en el 1.b, junto con el resto de la función.


-- =====================================================================
-- PARA VOLVER ATRÁS
--
-- Descomentar y correr. Deja todo como estaba antes de esta parte 7,
-- salvo el valor de cantidad_items de los pedidos ya cargados: esa
-- columna vuelve, pero vacía. No es pérdida real — guardaba el número de
-- líneas, que se recalcula con count(*) sobre pedido_items.
-- =====================================================================
/*
alter table public.pedidos add column if not exists cantidad_items integer;
update public.pedidos p
set cantidad_items = (select count(*) from public.pedido_items i where i.pedido_id = p.id);
alter table public.pedidos alter column cantidad_items set not null;

drop view if exists public.pedidos_local;
create view public.pedidos_local
with (security_invoker = on) as
select id,
       (creado_en at time zone 'America/Argentina/Buenos_Aires')::timestamp(0) as fecha_hora,
       to_char(creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
       total, cantidad_items, creado_en as guardado_utc
from public.pedidos
order by creado_en desc;

alter table public.pedido_items drop constraint if exists pedido_items_detalle_objeto;

drop policy if exists "el dueño modifica disponibilidad" on public.disponibilidad;
create policy "modificar disponibilidad" on public.disponibilidad for all
  to authenticated using (true) with check (true);

drop policy if exists "el dueño modifica insumos" on public.insumos;
create policy "modificar insumos" on public.insumos for all
  to authenticated using (true) with check (true);

drop policy if exists "el dueño lee pedidos" on public.pedidos;
create policy "leer pedidos" on public.pedidos for select to authenticated using (true);

drop policy if exists "el dueño lee items" on public.pedido_items;
create policy "leer items" on public.pedido_items for select to authenticated using (true);
*/
