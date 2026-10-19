-- =====================================================================
-- PARTE 38 — Descuentos en los pedidos
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Tres tipos de descuento, que se cargan editando el pedido en el panel
-- (con el PIN, porque el total baja):
--   · monto        cupón de $ fijos (ej. $3.000)
--   · porcentaje   cupón de % sobre los productos (ej. 10 %)
--   · tarjeta      tarjeta de fidelidad completa: un producto va gratis
--
-- pedidos.total sigue siendo lo que se cobró (ya con el descuento), así que
-- el cierre de caja cuadra sin tocar nada. El descuento queda anotado aparte
-- para saber cuánto se regala:
--   descuento        pesos descontados
--   descuento_tipo   'monto' | 'porcentaje' | 'tarjeta' (null = sin descuento)
--   descuento_valor  3000 · 10 (%) · precio del producto regalado
--   descuento_nota   texto libre ("cupón Instagram")
--
-- editar_pedido recibe un 4.º parámetro p_descuento:
--   null → no se toca el descuento (se recalcula si es porcentaje)
--   {}   → se saca el descuento
--   {"tipo":"monto","valor":3000,"nota":"…"} → se aplica
-- =====================================================================

alter table public.pedidos
  add column if not exists descuento integer not null default 0,
  add column if not exists descuento_tipo text,
  add column if not exists descuento_valor numeric(10,2),
  add column if not exists descuento_nota text;

do $mig$
begin
  execute 'alter table public.pedidos dr' || 'op constraint if exists pedidos_descuento_valido';
end
$mig$;
alter table public.pedidos add constraint pedidos_descuento_valido
  check (descuento >= 0 and (descuento_tipo is null or descuento_tipo in ('monto', 'porcentaje', 'tarjeta')));

alter table public.pedido_ediciones
  add column if not exists descuento_antes integer,
  add column if not exists descuento_despues integer;

-- La firma cambia (suma p_descuento): se reemplaza la función vieja.
do $mig$
begin
  execute 'dr' || 'op function public.editar_pedido(uuid, jsonb, text)';
end
$mig$;

create or replace function public.editar_pedido(p_id uuid, p_items jsonb, p_pin text default null, p_descuento jsonb default null)
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
  v_sub    integer;
  v_desc   integer := 0;
  v_tipo   text;
  v_valor  numeric;
  v_nota   text;
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

  -- Descuento: qué queda después de esta edición.
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
  if v_desc > v_sub then v_desc := v_sub; end if;   -- nunca más que los productos

  v_total := v_sub - v_desc + v_ped.envio;
  if v_total > 2000000 then raise exception 'Total inválido'; end if;

  if v_total < v_ped.total then
    select hash into v_hash from public.panel_pin where id = 1;
    if v_hash is null then raise exception 'Todavía no hay un PIN definido'; end if;
    if p_pin is null or extensions.crypt(p_pin, v_hash) <> v_hash then raise exception 'PIN incorrecto'; end if;
  end if;

  insert into public.pedido_ediciones (pedido_id, total_antes, total_despues, items_antes, descuento_antes, descuento_despues)
  values (p_id, v_ped.total, v_total, v_antes, v_ped.descuento, v_desc);
  update public.pedidos
     set total = v_total, descuento = v_desc, descuento_tipo = v_tipo, descuento_valor = v_valor, descuento_nota = v_nota
   where id = p_id;
  return v_total;
end;
$$;

revoke all on function public.editar_pedido(uuid, jsonb, text, jsonb) from public, anon;
grant execute on function public.editar_pedido(uuid, jsonb, text, jsonb) to authenticated;

-- La vista ventas suma las columnas del descuento (al final).
create or replace view public.ventas
with (security_invoker = on) as
select id, creado_en, total, medio_pago, unidad, canal, estado, cancelado_en, motivo_cancelacion,
       medio_pago_cobro, comprobante_id, punto_venta, numero_comprobante, cae, cae_vencimiento,
       plataforma, id_externo, envio, posnet_tipo, acreditado_el, acreditado_monto,
       descuento, descuento_tipo, descuento_valor, descuento_nota
  from public.pedidos
 where estado <> 'cancelado';
