-- =====================================================================
-- PARTE 39 — Conteo por lugar · descuento al armar el pedido
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
--   · fin_conteos.detalle   cuánto había en cada lugar: [{"lugar":"Brubank","monto":351747.24}, …]
--                           (el total sigue en monto).
--   · registrar_pedido_completo  suma p_descuento (jsonb, opcional), como en
--                           editar_pedido: {"tipo":"monto"|"porcentaje"|"tarjeta","valor":…,"nota":…}.
--                           Sólo para pedidos del mostrador. El total ya viene con el
--                           descuento aplicado; acá se anota cuánto fue (nunca más que los productos).
-- =====================================================================

alter table public.fin_conteos add column if not exists detalle jsonb;

do $mig$
begin
  execute 'dr' || 'op function if exists public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamptz, integer, text)';
end
$mig$;

create or replace function public.registrar_pedido_completo(
  p_total integer, p_items jsonb, p_medio_pago text, p_unidad text, p_canal text, p_id uuid,
  p_creado_en timestamptz, p_envio integer default 0, p_posnet_tipo text default null, p_descuento jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_tipo  text;
  v_valor numeric;
  v_nota  text;
  v_sub   integer;
  v_desc  integer;
begin
  if p_envio is null or p_envio < 0 or p_envio > 100000 then
    raise exception 'Envío inválido';
  end if;
  v_id := public.registrar_pedido(p_total, p_items, p_medio_pago, p_unidad, p_canal, p_id, p_creado_en);
  if p_canal = 'mostrador' then
    if p_envio > 0 and coalesce(p_unidad, 'local') = 'local' then
      update public.pedidos set envio = least(p_envio, total) where id = v_id and envio = 0;
    end if;
    if p_medio_pago = 'posnet' and p_posnet_tipo in ('tarjeta', 'qr') then
      update public.pedidos set posnet_tipo = p_posnet_tipo where id = v_id and posnet_tipo is null and medio_pago = 'posnet';
    end if;
    if p_descuento is not null and jsonb_typeof(p_descuento) = 'object' and (p_descuento->>'tipo') is not null then
      v_tipo := p_descuento->>'tipo';
      v_valor := (p_descuento->>'valor')::numeric;
      v_nota := left(nullif(btrim(coalesce(p_descuento->>'nota', '')), ''), 120);
      if v_tipo in ('monto', 'porcentaje', 'tarjeta') and v_valor > 0 then
        select coalesce(sum(cantidad * coalesce(precio_unitario, 0)), 0) into v_sub from public.pedido_items where pedido_id = v_id;
        v_desc := case when v_tipo = 'porcentaje' then round(v_sub * least(v_valor, 100) / 100.0) else round(v_valor) end;
        v_desc := greatest(0, least(v_desc, v_sub));
        update public.pedidos
           set descuento = v_desc, descuento_tipo = v_tipo, descuento_valor = v_valor, descuento_nota = v_nota
         where id = v_id and descuento = 0;
      end if;
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamptz, integer, text, jsonb) from public;
grant execute on function public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamptz, integer, text, jsonb) to anon, authenticated;
