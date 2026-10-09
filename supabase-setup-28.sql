-- =====================================================================
-- PARTE 28 — Delivery con moto en el mostrador
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Cuando un pedido sale con una moto de Uber, el cliente paga los productos
-- MÁS el envío que se cotizó en la app. Hasta ahora ese envío quedaba
-- afuera del menú (la caja daba de más) y las motos pagadas se anotaban
-- aparte, sin relación con ningún pedido.
--
--   · pedidos.envio            la parte de envío de un pedido. `total` la
--                              INCLUYE (es lo que se cobra, así la caja
--                              cuadra); los productos suman total − envio.
--   · registrar_pedido_con_envio   igual que registrar_pedido más el envío.
--                              Sólo lo acepta el mostrador del local.
--                              registrar_pedido queda como estaba (los
--                              pedidos sin delivery no cambian).
--   · cierres_caja.envios_pagados  lo que se pagó de motos ese día. Gestión
--                              lo pide sólo si hubo pedidos con delivery.
--   · categoría "Envíos (motos)"   el gasto de las motos, aparte de transporte,
--                              para compararlo con lo cobrado de envíos.
--   · vistas: ventas y cierre_vs_sistema ganan las columnas de envío.
--
-- No hay borrados: lo que se saca de un cierre queda en $0.
-- =====================================================================

alter table public.pedidos add column if not exists envio integer not null default 0;
alter table public.cierres_caja add column if not exists envios_pagados integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_envio_valido') then
    alter table public.pedidos add constraint pedidos_envio_valido check (envio >= 0 and envio <= total);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cierres_envios_pagados_valido') then
    alter table public.cierres_caja add constraint cierres_envios_pagados_valido check (envios_pagados is null or envios_pagados >= 0);
  end if;
end $$;

insert into public.fin_categorias (id, tipo, nombre, grupo, orden)
values ('envios', 'egreso', 'Envíos (motos)', 'operativo', 82)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- Pedido con envío (lo llama el menú sólo cuando hay delivery)
-- ---------------------------------------------------------------------
create or replace function public.registrar_pedido_con_envio(
  p_total integer, p_items jsonb, p_medio_pago text, p_unidad text, p_canal text,
  p_id uuid, p_creado_en timestamptz, p_envio integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_envio is null or p_envio < 0 or p_envio > 100000 then
    raise exception 'Envío inválido';
  end if;
  -- El pedido se anota como siempre (idempotente por p_id)...
  v_id := public.registrar_pedido(p_total, p_items, p_medio_pago, p_unidad, p_canal, p_id, p_creado_en);
  -- ...y la parte de envío sólo la acepta el mostrador del local. Reintentar el
  -- mismo pedido no la cambia: queda como la primera vez.
  if p_canal = 'mostrador' and coalesce(p_unidad, 'local') = 'local' and p_envio > 0 then
    update public.pedidos set envio = least(p_envio, total) where id = v_id and envio = 0;
  end if;
  return v_id;
end;
$$;

revoke all on function public.registrar_pedido_con_envio(integer, jsonb, text, text, text, uuid, timestamptz, integer) from public;
grant execute on function public.registrar_pedido_con_envio(integer, jsonb, text, text, text, uuid, timestamptz, integer) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Motos pagadas del cierre → gasto "Envíos (motos)"
-- ---------------------------------------------------------------------
create or replace function public.fin_cierre_envios()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_envios integer := coalesce(new.envios_pagados, 0);
  v_ref text := 'envios:' || new.dia || ':' || new.unidad;
  v_excel integer;
begin
  -- Si ese día ya hay "Uber Envio" cargados (del Excel), son estas mismas motos:
  -- no se anotan dos veces.
  select count(*) into v_excel from public.fin_movimientos
   where fecha = new.dia and tipo = 'egreso' and descripcion ilike 'uber env%' and origen_ref not like 'envios:%';
  if v_excel > 0 then v_envios := 0; end if;

  if v_envios > 0 then
    insert into public.fin_movimientos (fecha, tipo, categoria_id, descripcion, contraparte, monto, unidad, origen, origen_ref, revisar)
    values (new.dia, 'egreso', 'envios', 'Motos de delivery (Uber)', 'Uber', v_envios, new.unidad, 'cierre', v_ref, false)
    on conflict (origen_ref) do update set monto = excluded.monto, fecha = excluded.fecha, actualizado_en = now();
  else
    -- Sin motos ese día: si había una fila de este cierre, queda en $0.
    update public.fin_movimientos set monto = 0, actualizado_en = now() where origen_ref = v_ref and monto <> 0;
  end if;
  return new;
end;
$$;

revoke all on function public.fin_cierre_envios() from public, anon;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'fin_cierre_envios') then
    create trigger fin_cierre_envios after insert or update on public.cierres_caja
      for each row execute function public.fin_cierre_envios();
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Vistas (sólo se agregan columnas al final)
-- ---------------------------------------------------------------------
create or replace view public.ventas
with (security_invoker = on) as
select id, creado_en, total, medio_pago, unidad, canal, estado, cancelado_en, motivo_cancelacion,
       medio_pago_cobro, comprobante_id, punto_venta, numero_comprobante, cae, cae_vencimiento,
       plataforma, id_externo, envio
  from public.pedidos
 where estado <> 'cancelado';

create or replace view public.cierre_vs_sistema
with (security_invoker = on) as
with sistema as (
  select
    (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
    coalesce(unidad, 'local')                                       as unidad,
    count(*)                                                        as pedidos,
    sum(total)                                                      as facturado,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'), 0) as posnet,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'uber'), 0)   as uber,
    coalesce(sum(envio), 0)                                         as envios,
    count(*) filter (where envio > 0)                               as delivery
  from public.ventas
  group by 1, 2
)
select
  coalesce(c.dia, s.dia)        as dia,
  coalesce(c.unidad, s.unidad)  as unidad,
  c.caja_inicio,
  c.efectivo_final,
  c.transferencias,
  c.debito,
  c.total_declarado,
  c.caja_siguiente,
  coalesce(s.pedidos, 0)        as pedidos_sistema,
  coalesce(s.facturado, 0)      as total_sistema,
  c.total_declarado - coalesce(s.facturado, 0)                                    as diferencia,
  round(100.0 * coalesce(s.facturado, 0) / nullif(c.total_declarado, 0))          as sistema_sobre_caja_pct,
  case when c.dia is null then 'sin cierre' else 'cerrado' end                    as estado_cierre,
  c.notas,
  coalesce(s.posnet, 0)         as total_sistema_posnet,
  coalesce(s.uber, 0)           as total_sistema_uber,
  coalesce(c.uber_liquidacion, 0) as uber_liquidacion,
  coalesce(s.envios, 0)         as total_sistema_envios,
  coalesce(s.delivery, 0)       as pedidos_delivery,
  c.envios_pagados
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
order by 1 desc, 2;


-- Los "Uber Envio" que ya estaban en el libro (las motos del Excel) pasan a la
-- categoría nueva, para ver todo el costo de delivery junto.
update public.fin_movimientos
   set categoria_id = 'envios', contraparte = 'Uber', revisar = false, actualizado_en = now()
 where tipo = 'egreso' and descripcion ilike 'uber env%' and categoria_id = 'transporte';


-- Verificación:
--   select * from cierre_vs_sistema where pedidos_delivery > 0;
--   select sum(monto) from fin_movimientos where categoria_id = 'envios';

/* Para volver atrás (sin tocar pedidos ya tomados):
update public.fin_movimientos set categoria_id = 'transporte', revisar = true where categoria_id = 'envios' and origen = 'excel';
-- las columnas nuevas pueden quedar: no estorban.
*/
