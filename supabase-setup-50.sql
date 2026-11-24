-- =====================================================================
-- PARTE 50 — La aclaración del pedido se ve en el panel
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- Hasta ahora la aclaración ("sin azúcar", "para llevar"…) sólo viajaba por
-- WhatsApp y no se guardaba. Ahora se guarda con el pedido (hasta 300
-- letras) para que el panel la muestre bien visible. El nombre del cliente
-- sigue sin guardarse.
--
--   · pedidos.aclaracion
--   · registrar_pedido_completo suma p_aclaracion (opcional). Se borra la
--     versión anterior para que no queden dos con el mismo nombre; los
--     pedidos viejos en cola, que no la mandan, siguen entrando igual.
-- =====================================================================

alter table public.pedidos add column if not exists aclaracion text;
alter table public.pedidos drop constraint if exists pedidos_aclaracion_largo;
alter table public.pedidos add constraint pedidos_aclaracion_largo check (aclaracion is null or char_length(aclaracion) <= 300);

drop function if exists public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamp with time zone, integer, text, jsonb);

create or replace function public.registrar_pedido_completo(p_total integer, p_items jsonb, p_medio_pago text, p_unidad text, p_canal text, p_id uuid, p_creado_en timestamp with time zone, p_envio integer DEFAULT 0, p_posnet_tipo text DEFAULT NULL::text, p_descuento jsonb DEFAULT NULL::jsonb, p_aclaracion text DEFAULT NULL::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_id    uuid;
  v_tipo  text;
  v_valor numeric;
  v_nota  text;
  v_sub   integer;
  v_desc  integer;
  v_acl   text;
  v_peya  boolean := p_medio_pago = 'pedidosya_efectivo' and p_canal = 'mostrador' and coalesce(p_unidad, 'local') = 'local';
begin
  if p_envio is null or p_envio < 0 or p_envio > 100000 then
    raise exception 'Envío inválido';
  end if;
  -- PeYa en efectivo (parte 45): para la caja es efectivo; queda marcado
  -- para que el informe de PedidosYa lo reemplace por el pedido real.
  v_id := public.registrar_pedido(p_total, p_items, case when v_peya then 'efectivo' else p_medio_pago end, p_unidad, p_canal, p_id, p_creado_en);
  -- Aclaración del cliente (parte 50), de cualquier canal. Un reintento no la pisa.
  v_acl := left(nullif(btrim(coalesce(p_aclaracion, '')), ''), 300);
  if v_acl is not null then
    update public.pedidos set aclaracion = v_acl where id = v_id and aclaracion is null;
  end if;
  if v_peya then
    update public.pedidos set peya_efectivo = true where id = v_id and not peya_efectivo;
    return v_id;
  end if;
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

revoke all on function public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamp with time zone, integer, text, jsonb, text) from public;
grant execute on function public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamp with time zone, integer, text, jsonb, text) to anon, authenticated;


-- =====================================================================
-- PARA VOLVER ATRÁS: correr de nuevo la función de la parte 45 y después
-- =====================================================================
/*
drop function if exists public.registrar_pedido_completo(integer, jsonb, text, text, text, uuid, timestamp with time zone, integer, text, jsonb, text);
-- (pegar acá la función de supabase-setup-45.sql y sus grants a anon, authenticated)
alter table public.pedidos drop column if exists aclaracion;
*/
