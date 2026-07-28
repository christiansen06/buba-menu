-- =====================================================================
-- BüBa — Parte 2: insumos + pedido atómico
-- Pegar en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. INSUMOS (materia prima)
-- ---------------------------------------------------------------------
-- Sólo guarda si hay stock o no. El nombre y dónde se usa cada insumo
-- viven en el código (src/data/insumos.js), porque son la receta y casi
-- nunca cambian. Lo que cambia todos los días es esto.
create table if not exists public.insumos (
  id             text primary key,
  disponible     boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table public.insumos enable row level security;

drop policy if exists "leer insumos" on public.insumos;
create policy "leer insumos"
  on public.insumos for select
  to anon, authenticated
  using (true);

drop policy if exists "modificar insumos" on public.insumos;
create policy "modificar insumos"
  on public.insumos for all
  to authenticated
  using (true)
  with check (true);


-- ---------------------------------------------------------------------
-- 2. PEDIDO ATÓMICO
-- ---------------------------------------------------------------------
-- Antes el pedido se guardaba en dos pasos (primero la cabecera, después
-- los ítems). Si el segundo fallaba quedaba un pedido fantasma sin ítems
-- y las métricas salían mal.
--
-- Esta función hace las dos inserciones DENTRO DE UNA SOLA TRANSACCIÓN:
-- o entran las dos, o no entra ninguna. Devuelve el id del pedido.
create or replace function public.registrar_pedido(
  p_total          integer,
  p_items          jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items';
  end if;

  insert into public.pedidos (id, total, cantidad_items)
  values (v_id, p_total, jsonb_array_length(p_items));

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
    item->'detalle'
  from jsonb_array_elements(p_items) as item;

  return v_id;
end;
$$;

-- La app (anónima) puede llamar a la función, pero sigue sin poder leer
-- los pedidos: sólo puede agregarlos.
grant execute on function public.registrar_pedido(integer, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. VISTA DE INSUMOS AGOTADOS (para mirar de un vistazo)
-- ---------------------------------------------------------------------
create or replace view public.insumos_agotados as
select id, actualizado_en
from public.insumos
where disponible = false
order by actualizado_en desc;
