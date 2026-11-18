-- =====================================================================
-- PARTE 49 — Aclarar desde el panel si un cobro de posnet fue con tarjeta o QR
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- Hasta ahora posnet_tipo sólo se guardaba al registrar el pedido desde el
-- mostrador. Los pedidos del QR de clientes, y los que se corrigieron a
-- posnet desde el panel, quedaban "Posnet (sin aclarar)" para siempre, y en
-- Gestión no se separaban la tarjeta (llega otro día) del QR (al instante).
--
--   · el check deja guardar el tipo cuando el cobro FINAL es posnet, no sólo
--     cuando el pedido se registró como posnet
--   · registrar_cobro_posnet(id, 'tarjeta' | 'qr'): marca el cobro como
--     posnet y de qué tipo, en un solo paso. Sólo el dueño.
-- =====================================================================

alter table public.pedidos drop constraint if exists pedidos_posnet_tipo_valido;
alter table public.pedidos add constraint pedidos_posnet_tipo_valido check (
  posnet_tipo is null
  or (posnet_tipo in ('tarjeta', 'qr') and (medio_pago = 'posnet' or medio_pago_cobro = 'posnet'))
);

create or replace function public.registrar_cobro_posnet(p_id uuid, p_tipo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('tarjeta', 'qr') then
    raise exception 'Tipo de posnet inválido';
  end if;
  update public.pedidos
     set medio_pago_cobro = case when medio_pago = 'posnet' and medio_pago_cobro is null then null else 'posnet' end,
         posnet_tipo = p_tipo
   where id = p_id;
  if not found then raise exception 'No existe ese pedido'; end if;
end;
$$;

revoke all on function public.registrar_cobro_posnet(uuid, text) from public, anon;
grant execute on function public.registrar_cobro_posnet(uuid, text) to authenticated;


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
drop function if exists public.registrar_cobro_posnet(uuid, text);
update public.pedidos set posnet_tipo = null where medio_pago <> 'posnet';
alter table public.pedidos drop constraint if exists pedidos_posnet_tipo_valido;
alter table public.pedidos add constraint pedidos_posnet_tipo_valido check (
  posnet_tipo is null or (posnet_tipo in ('tarjeta', 'qr') and medio_pago = 'posnet'));
*/
