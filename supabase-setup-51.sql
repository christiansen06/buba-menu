-- =====================================================================
-- PARTE 51 — Agregar, cambiar o sacar el envío al editar un pedido
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- El cliente que pide por el QR no puede elegir delivery: lo pide por
-- WhatsApp y el envío había que sumarlo borrando y recargando el pedido.
-- Ahora editar_pedido recibe p_envio:
--   · null  → el envío queda como estaba (lo que mandan las pantallas viejas)
--   · 0     → se saca el envío (el total baja: pide PIN, como siempre)
--   · > 0   → ese es el envío (hasta $100.000)
-- Vale para cualquier pedido, del local o del truck, del QR o del mostrador.
-- pedido_ediciones guarda también el envío de antes y el de después.
-- =====================================================================

alter table public.pedido_ediciones add column if not exists envio_antes integer;
alter table public.pedido_ediciones add column if not exists envio_despues integer;

-- Se borra la versión de 4 parámetros para que no queden dos con el mismo nombre.
drop function if exists public.editar_pedido(uuid, jsonb, text, jsonb);

create or replace function public.editar_pedido(p_id uuid, p_items jsonb, p_pin text DEFAULT NULL::text, p_descuento jsonb DEFAULT NULL::jsonb, p_envio integer DEFAULT NULL::integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_ped    public.pedidos%rowtype;
  v_hash   text;
  v_item   jsonb;
  v_cant   integer;
  v_antes  jsonb;
  v_total  integer;
  v_vivas  integer;
  v_sub    integer;
  v_desc   integer := 0;
  v_tipo   text;
  v_valor  numeric;
  v_nota   text;
  v_envio  integer;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Faltan las líneas del pedido';
  end if;
  if p_envio is not null and (p_envio < 0 or p_envio > 100000) then
    raise exception 'Envío inválido';
  end if;

  select * into v_ped from public.pedidos where id = p_id for update;
  if not found then raise exception 'No existe ese pedido'; end if;
  if v_ped.estado = 'cancelado' then raise exception 'El pedido está cancelado'; end if;
  if v_ped.plataforma is not null then raise exception 'Los pedidos de Uber y PedidosYa vienen del reporte: no se editan acá'; end if;
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

  select count(*) filter (where cantidad > 0), coalesce(sum(cantidad * coalesce(precio_unitario, 0)), 0)
    into v_vivas, v_sub from public.pedido_items where pedido_id = p_id;
  if v_vivas = 0 then raise exception 'El pedido quedaría vacío: cancelalo en su lugar'; end if;

  if p_descuento is null then
    v_tipo := v_ped.descuento_tipo; v_valor := v_ped.descuento_valor; v_nota := v_ped.descuento_nota;
    if v_tipo is not null then v_desc := v_ped.descuento; end if;
  elsif p_descuento = '{}'::jsonb then
    v_tipo := null; v_valor := null; v_nota := null;
  else
    v_tipo := p_descuento->>'tipo';
    v_valor := (p_descuento->>'valor')::numeric;
    v_nota := nullif(btrim(coalesce(p_descuento->>'nota', '')), '');
    if v_tipo not in ('monto', 'porcentaje', 'tarjeta') then raise exception 'Tipo de descuento inválido'; end if;
    if v_valor is null or v_valor <= 0 then raise exception 'Falta el valor del descuento'; end if;
    if v_nota is not null and length(v_nota) > 120 then raise exception 'La nota del descuento es muy larga'; end if;
  end if;
  if v_tipo = 'porcentaje' then
    if v_valor > 100 then raise exception 'El porcentaje no puede pasar de 100'; end if;
    v_desc := round(v_sub * v_valor / 100.0);
  elsif v_tipo in ('monto', 'tarjeta') and (p_descuento is not null and p_descuento <> '{}'::jsonb) then
    v_desc := round(v_valor);
  elsif v_tipo is null then
    v_desc := 0;
  end if;
  if v_desc > v_sub then v_desc := v_sub; end if;

  v_envio := coalesce(p_envio, v_ped.envio);
  v_total := v_sub - v_desc + v_envio;
  if v_total > 2000000 then raise exception 'Total inválido'; end if;

  if v_total < v_ped.total then
    select hash into v_hash from public.panel_pin where id = 1;
    if v_hash is null then raise exception 'Todavía no hay un PIN definido'; end if;
    if p_pin is null or extensions.crypt(p_pin, v_hash) <> v_hash then raise exception 'PIN incorrecto'; end if;
  end if;

  insert into public.pedido_ediciones (pedido_id, total_antes, total_despues, items_antes, descuento_antes, descuento_despues, envio_antes, envio_despues)
  values (p_id, v_ped.total, v_total, v_antes, v_ped.descuento, v_desc, v_ped.envio, v_envio);
  update public.pedidos
     set total = v_total, envio = v_envio, descuento = v_desc, descuento_tipo = v_tipo, descuento_valor = v_valor, descuento_nota = v_nota
   where id = p_id;
  return v_total;
end;
$$;

revoke all on function public.editar_pedido(uuid, jsonb, text, jsonb, integer) from public, anon;
grant execute on function public.editar_pedido(uuid, jsonb, text, jsonb, integer) to authenticated;


-- =====================================================================
-- PARA VOLVER ATRÁS: borrar esta versión y volver a correr la de la parte 38
-- =====================================================================
/*
drop function if exists public.editar_pedido(uuid, jsonb, text, jsonb, integer);
-- (pegar acá editar_pedido de supabase-setup-38.sql y su grant a authenticated)
*/
