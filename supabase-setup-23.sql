-- =====================================================================
-- PARTE 23 — Cambiar el día y la hora de un pedido desde el panel
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- Caso real (28/09): un pedido de Uber del domingo se cargó pasada la
-- medianoche y quedó el lunes. Mover un pedido de día cambia el cierre de
-- los dos días, así que:
--   · sólo el dueño (misma regla que cancelar y registrar el cobro)
--   · no al futuro, y no más de 60 días para atrás
--   · la hora con la que se registró NO se pierde: queda en
--     creado_en_original la primera vez que se cambia.
-- =====================================================================

alter table public.pedidos add column if not exists creado_en_original timestamptz;

comment on column public.pedidos.creado_en_original is
  'Hora con la que se registró el pedido, si después se le cambió el día u hora desde el panel (parte 23).';

drop function if exists public.cambiar_fecha_pedido(uuid, timestamptz);
create function public.cambiar_fecha_pedido(p_id uuid, p_creado_en timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_creado_en is null or p_creado_en > now() + interval '5 minutes' then
    raise exception 'La fecha no puede ser futura';
  end if;
  if p_creado_en < now() - interval '60 days' then
    raise exception 'Sólo se pueden mover pedidos de los últimos 60 días';
  end if;
  update public.pedidos
     set creado_en_original = coalesce(creado_en_original, creado_en),
         creado_en = p_creado_en
   where id = p_id;
  if not found then
    raise exception 'No existe ese pedido';
  end if;
end;
$$;

revoke all on function public.cambiar_fecha_pedido(uuid, timestamptz) from public, anon;
grant execute on function public.cambiar_fecha_pedido(uuid, timestamptz) to authenticated;


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
-- Devolver cada pedido movido a su hora original:
update public.pedidos set creado_en = creado_en_original where creado_en_original is not null;
drop function if exists public.cambiar_fecha_pedido(uuid, timestamptz);
alter table public.pedidos drop column if exists creado_en_original;
*/
