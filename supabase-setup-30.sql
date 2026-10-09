-- =====================================================================
-- PARTE 30 — Editar un pedido ya tomado
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Hasta ahora un pedido ya enviado sólo se podía cancelar. Pasa seguido que
-- el cliente suma algo (o cambia de idea): esta parte permite corregir las
-- líneas de un pedido desde el panel del mostrador.
--
--   · editar_pedido(p_id, p_items, p_pin)
--       p_items es la lista completa de líneas:
--         { "id": 123, "cantidad": 2 }                 línea que ya existía
--         { "nombre": ..., "cantidad": 1, ... }         línea nueva
--       Una línea que ya existía y se saca queda con cantidad 0 (no se borra
--       nada: el historial sigue completo). El total lo calcula la base:
--       suma de cantidad × precio de las líneas + el envío del delivery.
--       Sólo el dueño (la sesión del panel). No edita pedidos cancelados,
--       los de Uber (vienen del reporte) ni los que ya tienen comprobante.
--       Si el total BAJA hace falta el PIN del panel, igual que para cancelar;
--       sumar algo no lo pide.
--   · pedido_ediciones: cada edición deja acá cómo estaba el pedido antes
--       (total y líneas). Sólo lectura para el dueño.
-- =====================================================================

create table if not exists public.pedido_ediciones (
  id            bigserial primary key,
  pedido_id     uuid not null references public.pedidos (id),
  editado_en    timestamptz not null default now(),
  total_antes   integer not null,
  total_despues integer not null,
  items_antes   jsonb not null
);

alter table public.pedido_ediciones enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'pedido_ediciones' and policyname = 'el dueño lee') then
    create policy "el dueño lee" on public.pedido_ediciones
      for select to authenticated
      using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
  end if;
end $$;

revoke all on public.pedido_ediciones from anon, authenticated;
grant select on public.pedido_ediciones to authenticated;


create or replace function public.editar_pedido(p_id uuid, p_items jsonb, p_pin text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ped    public.pedidos%rowtype;
  v_hash   text;
  v_item   jsonb;
  v_cant   integer;
  v_antes  jsonb;
  v_total  integer;
  v_vivas  integer;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Faltan las líneas del pedido';
  end if;

  select * into v_ped from public.pedidos where id = p_id for update;
  if not found then raise exception 'No existe ese pedido'; end if;
  if v_ped.estado = 'cancelado' then raise exception 'El pedido está cancelado'; end if;
  if v_ped.plataforma is not null then raise exception 'Los pedidos de Uber vienen del reporte: no se editan acá'; end if;
  if v_ped.cae is not null then raise exception 'Este pedido ya tiene comprobante'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'variante', variante,
           'cantidad', cantidad, 'precio_unitario', precio_unitario) order by id), '[]'::jsonb)
    into v_antes from public.pedido_items where pedido_id = p_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::integer;
    if v_cant is null or v_cant < 0 or v_cant > 99 then raise exception 'Cantidad inválida'; end if;
    if (v_item->>'id') is not null then
      update public.pedido_items set cantidad = v_cant
       where id = (v_item->>'id')::bigint and pedido_id = p_id;
      if not found then raise exception 'Una línea no es de este pedido'; end if;
    elsif v_cant > 0 then
      if coalesce(btrim(v_item->>'nombre'), '') = '' or length(v_item->>'nombre') > 160 then
        raise exception 'Falta el nombre del producto';
      end if;
      if (v_item->>'precio_unitario') is not null
         and ((v_item->>'precio_unitario')::integer < 0 or (v_item->>'precio_unitario')::integer > 500000) then
        raise exception 'Precio inválido';
      end if;
      insert into public.pedido_items (pedido_id, categoria_id, producto_id, nombre, variante, cantidad, precio_unitario, detalle)
      values (p_id, coalesce(v_item->>'categoria_id', 'otros'), v_item->>'producto_id', v_item->>'nombre',
              v_item->>'variante', v_cant, (v_item->>'precio_unitario')::integer,
              case when jsonb_typeof(v_item->'detalle') = 'object' then v_item->'detalle' end);
    end if;
  end loop;

  select count(*) filter (where cantidad > 0), coalesce(sum(cantidad * coalesce(precio_unitario, 0)), 0) + v_ped.envio
    into v_vivas, v_total from public.pedido_items where pedido_id = p_id;
  if v_vivas = 0 then raise exception 'El pedido quedaría vacío: cancelalo en su lugar'; end if;
  if v_total > 2000000 then raise exception 'Total inválido'; end if;

  -- Bajar el total (sacar algo) pide el PIN, como cancelar. Sumar no.
  if v_total < v_ped.total then
    select hash into v_hash from public.panel_pin where id = 1;
    if v_hash is null then raise exception 'Todavía no hay un PIN definido'; end if;
    if p_pin is null or extensions.crypt(p_pin, v_hash) <> v_hash then raise exception 'PIN incorrecto'; end if;
  end if;

  insert into public.pedido_ediciones (pedido_id, total_antes, total_despues, items_antes)
  values (p_id, v_ped.total, v_total, v_antes);
  update public.pedidos set total = v_total where id = p_id;
  return v_total;
end;
$$;

revoke all on function public.editar_pedido(uuid, jsonb, text) from public, anon;
grant execute on function public.editar_pedido(uuid, jsonb, text) to authenticated;

-- Verificación (con la sesión del dueño):
--   select * from pedido_ediciones order by id desc limit 5;
