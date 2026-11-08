-- =====================================================================
-- PARTE 48 — Mover un pedido entre el local y el food truck
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- Caso real (08/11): 4 medialunas del food truck se cargaron en el iPad del
-- local. Mover un pedido de unidad cambia el cierre de los dos, así que:
--   · sólo el dueño (misma regla que cancelar y cambiar la hora)
--   · no se mueven cancelados, ni pedidos de Uber / PedidosYa (vienen del
--     reporte), ni pedidos con comprobante emitido
--   · el food truck no hace delivery: un pedido con envío, o el efectivo de
--     PeYa del mostrador, no se puede pasar al truck
--   · los precios NO se tocan: queda lo que se cobró
--   · la unidad con la que se registró NO se pierde: queda en
--     unidad_original la primera vez que se mueve
--
-- Devuelve true si ese día ya hay un cierre de caja cargado en alguna de
-- las dos unidades: el panel avisa para que se revise en Gestión.
-- =====================================================================

alter table public.pedidos add column if not exists unidad_original text;

comment on column public.pedidos.unidad_original is
  'Unidad con la que se registró el pedido, si después se lo pasó a la otra desde el panel (parte 48).';

create or replace function public.mover_pedido_unidad(p_id uuid, p_unidad text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ped public.pedidos%rowtype;
  v_dia date;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_unidad is null or p_unidad not in ('local', 'food_truck') then
    raise exception 'Unidad inválida';
  end if;

  select * into v_ped from public.pedidos where id = p_id for update;
  if not found then raise exception 'No existe ese pedido'; end if;
  if v_ped.estado = 'cancelado' then raise exception 'El pedido está cancelado'; end if;
  if v_ped.plataforma is not null then raise exception 'Los pedidos de Uber y PedidosYa vienen del reporte: no se mueven acá'; end if;
  if v_ped.cae is not null then raise exception 'Este pedido ya tiene comprobante'; end if;
  if coalesce(v_ped.unidad, 'local') = p_unidad then raise exception 'El pedido ya está en esa unidad'; end if;
  if p_unidad = 'food_truck' and (v_ped.envio > 0 or v_ped.peya_efectivo) then
    raise exception 'El food truck no hace delivery ni PeYa: ese pedido no puede pasar al truck';
  end if;

  update public.pedidos
     set unidad_original = coalesce(unidad_original, coalesce(unidad, 'local')),
         unidad = p_unidad
   where id = p_id;

  v_dia := (v_ped.creado_en at time zone 'America/Argentina/Buenos_Aires')::date;
  return exists (select 1 from public.cierres_caja where dia = v_dia);
end;
$$;

revoke all on function public.mover_pedido_unidad(uuid, text) from public, anon;
grant execute on function public.mover_pedido_unidad(uuid, text) to authenticated;


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
-- Devolver cada pedido movido a su unidad original:
update public.pedidos set unidad = unidad_original where unidad_original is not null;
drop function if exists public.mover_pedido_unidad(uuid, text);
alter table public.pedidos drop column if exists unidad_original;
*/
