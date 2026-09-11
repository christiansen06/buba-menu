-- =====================================================================
-- PARTE 9 — Unidad, canal y el sueldo de mercado
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- NO borra ni modifica ninguna venta. Al final está el bloque de reversa.
--
-- Todo aditivo: columnas nuevas nullable y una tabla nueva. Nada de lo que
-- hay acá puede romper el menú en producción.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. De dónde salió el pedido
-- ---------------------------------------------------------------------
-- unidad → QUÉ negocio: el local o el food truck.
--
--   En diciembre las dos unidades operan en simultáneo. Hasta ahora se
--   distinguían por fecha porque nunca coincidieron; a partir de ahí, sin
--   esta columna, las ventas de las dos se mezclan y no se separan más.
--
-- canal  → QUIÉN lo cargó: el personal en el mostrador, o el cliente por QR.
--
--   Hoy se registran ~11 pedidos por día. La sospecha es que una parte de
--   las ventas se cobra en el mostrador sin pasar nunca por el QR — eso
--   explicaría el desfase contra la caja mucho mejor que un problema de
--   corte horario (medido: 0 pedidos después de las 22:00, 2 entre las 00
--   y las 06, y el local cierra 19:00/20:00).

alter table public.pedidos add column if not exists unidad text;
alter table public.pedidos add column if not exists canal  text;

alter table public.pedidos drop constraint if exists pedidos_unidad_valida;
alter table public.pedidos
  add constraint pedidos_unidad_valida
  check (unidad is null or unidad in ('local', 'food_truck'));

alter table public.pedidos drop constraint if exists pedidos_canal_valido;
alter table public.pedidos
  add constraint pedidos_canal_valido
  check (canal is null or canal in ('mostrador', 'qr'));

-- Los 375 pedidos que ya están son TODOS del local: el food truck no operó
-- en este período. El canal, en cambio, queda en NULL — no hay forma de
-- saber cuáles se cargaron desde el mostrador y cuáles los mandó el cliente.
update public.pedidos set unidad = 'local' where unidad is null;


-- ---------------------------------------------------------------------
-- 2. registrar_pedido pasa a cinco parámetros
-- ---------------------------------------------------------------------
-- MISMO CUIDADO QUE EN LA PARTE 8: un "create or replace" agregando
-- parámetros con default NO reemplaza la función anterior, crea una segunda.
-- Después una llamada con los parámetros viejos falla con "function is not
-- unique" y el menú deja de registrar pedidos. Hay que borrar la vieja.
--
-- Con los defaults en NULL, un front que todavía mande tres parámetros
-- sigue andando igual.
drop function if exists public.registrar_pedido(integer, jsonb, text);

create or replace function public.registrar_pedido(
  p_total      integer,
  p_items      jsonb,
  p_medio_pago text default null,
  p_unidad     text default null,
  p_canal      text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items';
  end if;

  insert into public.pedidos (id, total, medio_pago, unidad, canal)
  values (
    v_id,
    p_total,
    -- Cualquier valor que no sea de los válidos entra como NULL, así un
    -- dato raro del front nunca voltea el pedido por el CHECK.
    case when p_medio_pago in ('transferencia', 'efectivo')  then p_medio_pago end,
    case when p_unidad     in ('local', 'food_truck')        then p_unidad     end,
    case when p_canal      in ('mostrador', 'qr')            then p_canal      end
  );

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
    -- Un JSON null escalar entra como NULL de verdad (ver parte 7).
    case when jsonb_typeof(item->'detalle') = 'object' then item->'detalle' end
  from jsonb_array_elements(p_items) as item;

  return v_id;
end;
$$;

grant execute on function public.registrar_pedido(integer, jsonb, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Parámetros del negocio — el sueldo que hoy no se paga
-- ---------------------------------------------------------------------
-- El dueño cobra muy por debajo de lo que costaría contratar a alguien para
-- hacer lo que hace. Eso hace ver rentable una unidad que, con un encargado
-- pago a precio de mercado, capaz no lo es.
--
-- Esta tabla NO toca ningún sueldo real: es un parámetro para poder calcular
-- el resultado operativo "de verdad" cuando haga falta.
create table if not exists public.parametros_negocio (
  clave         text primary key,
  valor         numeric not null,
  vigente_desde timestamptz not null default now(),
  nota          text
);

insert into public.parametros_negocio (clave, valor, nota)
values (
  'sueldo_encargado_mercado',
  900000,
  'Lo que costaría pagar a un encargado a precio de mercado. Se usa para calcular el resultado real de la unidad; no modifica ningún sueldo registrado.'
)
on conflict (clave) do nothing;

alter table public.parametros_negocio enable row level security;

-- Misma política que insumos y disponibilidad (parte 7): lectura para todos,
-- escritura sólo del dueño.
drop policy if exists "leer parametros" on public.parametros_negocio;
create policy "leer parametros"
  on public.parametros_negocio for select
  to anon, authenticated
  using (true);

drop policy if exists "el dueño modifica parametros" on public.parametros_negocio;
create policy "el dueño modifica parametros"
  on public.parametros_negocio for all
  to authenticated
  using  (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);


-- ---------------------------------------------------------------------
-- 4. La vista que dice si todo esto sirvió
-- ---------------------------------------------------------------------
-- En dos semanas contesta la pregunta que importa: qué porcentaje de las
-- ventas pasa por el mostrador. De ahí sale si vale la pena medir por
-- persona, y si la hipótesis del desfase de caja se sostiene.
create or replace view public.facturacion_por_unidad_y_canal
with (security_invoker = on) as
select
  coalesce(unidad, '(sin dato)') as unidad,
  coalesce(canal,  '(sin dato)') as canal,
  count(*)                       as pedidos,
  sum(total)                     as facturado,
  round(avg(total))              as ticket_promedio
from public.pedidos
group by 1, 2
order by facturado desc;


-- =====================================================================
-- PARA VOLVER ATRÁS
--
-- Descomentar y correr. Se pierden la unidad y el canal de los pedidos
-- cargados desde que se aplicó — no se pueden reconstruir.
-- =====================================================================
/*
drop view if exists public.facturacion_por_unidad_y_canal;
drop table if exists public.parametros_negocio;

drop function if exists public.registrar_pedido(integer, jsonb, text, text, text);

create or replace function public.registrar_pedido(
  p_total integer, p_items jsonb, p_medio_pago text default null
)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid := gen_random_uuid();
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene items';
  end if;
  insert into public.pedidos (id, total, medio_pago)
  values (v_id, p_total,
          case when p_medio_pago in ('transferencia','efectivo') then p_medio_pago end);
  insert into public.pedido_items
    (pedido_id, categoria_id, producto_id, nombre, variante, cantidad, precio_unitario, detalle)
  select v_id,
         coalesce(item->>'categoria_id','otros'), item->>'producto_id',
         coalesce(item->>'nombre','sin nombre'), item->>'variante',
         coalesce((item->>'cantidad')::integer,1), (item->>'precio_unitario')::integer,
         case when jsonb_typeof(item->'detalle') = 'object' then item->'detalle' end
  from jsonb_array_elements(p_items) as item;
  return v_id;
end; $$;

grant execute on function public.registrar_pedido(integer, jsonb, text) to anon, authenticated;

alter table public.pedidos drop constraint if exists pedidos_unidad_valida;
alter table public.pedidos drop constraint if exists pedidos_canal_valido;
alter table public.pedidos drop column if exists unidad;
alter table public.pedidos drop column if exists canal;
*/
