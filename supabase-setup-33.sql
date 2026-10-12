-- =====================================================================
-- PARTE 33 — Orden a mano de los movimientos de un mismo día
--
-- En Movimientos de BüBa Gestión, Agustín acomoda los movimientos de cada día
-- como le sirve para controlar (por ejemplo, todas las transferencias juntas
-- y todo lo pagado en efectivo junto). El orden se guarda acá.
--
--   · fin_movimientos.orden_dia   posición dentro del día (null = sin orden:
--                                 va al final, por fecha de carga).
--   · ordenar_movimientos(ids)    guarda el orden de un día: el primero de la
--                                 lista queda 1, el segundo 2… Sólo el dueño, y
--                                 sólo si todos son del mismo día.
-- =====================================================================

alter table public.fin_movimientos add column if not exists orden_dia integer;

create or replace function public.ordenar_movimientos(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dias integer;
  v_n integer;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select count(distinct fecha) into v_dias from public.fin_movimientos where id = any(p_ids);
  if v_dias > 1 then raise exception 'Sólo se ordenan movimientos del mismo día'; end if;
  update public.fin_movimientos m
     set orden_dia = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where m.id = o.id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.ordenar_movimientos(bigint[]) from public, anon;
grant execute on function public.ordenar_movimientos(bigint[]) to authenticated;
