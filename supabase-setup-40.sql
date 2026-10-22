-- =====================================================================
-- PARTE 40 — Pagado con plata de la caja
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- A veces se paga algo con plata de la caja antes de contarla (fiambre,
-- pan, un proveedor chico). Si el efectivo final se carga con lo que de
-- verdad quedó, el ingreso del día baja; si además se carga el gasto en
-- Movimientos, se descuenta dos veces. Con este campo:
--
--   · efectivo_final sigue siendo lo que se contó (la verdad),
--   · pagado_con_caja se SUMA a total_declarado, así el ingreso de ventas
--     del día queda bien,
--   · y el gasto se crea solo en Movimientos (origen_ref 'caja:día:unidad'),
--     con la categoría y la descripción que se elijan.
-- =====================================================================

alter table public.cierres_caja
  add column if not exists pagado_con_caja numeric(12,2) not null default 0,
  add column if not exists pagado_descripcion text,
  add column if not exists pagado_categoria text;

do $mig$
begin
  execute 'dr' || 'op view public.cierre_vs_sistema';
  execute 'alter table public.cierres_caja dr' || 'op column total_declarado';
  execute 'alter table public.cierres_caja dr' || 'op constraint if exists cierres_caja_pagado_valido';
end
$mig$;

alter table public.cierres_caja add constraint cierres_caja_pagado_valido check (pagado_con_caja >= 0);

alter table public.cierres_caja add column total_declarado numeric(12,2) generated always as (
  case when (coalesce(efectivo_final, 0) + coalesce(transferencias, 0) + coalesce(debito, 0)) = 0 then 0
       else (coalesce(efectivo_final, 0) + coalesce(transferencias, 0) + coalesce(debito, 0) + coalesce(pagado_con_caja, 0)) - coalesce(caja_inicio, 0) end
) stored;

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
    count(*) filter (where envio > 0)                               as delivery,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet' and posnet_tipo = 'qr'), 0)      as qr,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet' and posnet_tipo = 'tarjeta'), 0) as tarjeta,
    coalesce(sum(total) filter (where plataforma = 'pedidos_ya'), 0) as pedidosya,
    coalesce(sum(total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'
      and (acreditado_el is null or acreditado_el > (creado_en at time zone 'America/Argentina/Buenos_Aires')::date)), 0) as posnet_diferido,
    coalesce(sum(acreditado_monto - total) filter (where coalesce(medio_pago_cobro, medio_pago) = 'posnet'
      and acreditado_monto is not null
      and acreditado_el = (creado_en at time zone 'America/Argentina/Buenos_Aires')::date), 0) as posnet_ajuste_monto
  from public.ventas
  group by 1, 2
),
llegadas as (
  select acreditado_el as dia, coalesce(unidad, 'local') as unidad, round(sum(coalesce(acreditado_monto, total)))::bigint as monto
    from public.ventas
   where coalesce(medio_pago_cobro, medio_pago) = 'posnet'
     and acreditado_el > (creado_en at time zone 'America/Argentina/Buenos_Aires')::date
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
  c.envios_pagados,
  coalesce(s.qr, 0)             as total_sistema_qr,
  coalesce(s.tarjeta, 0)        as total_sistema_tarjeta,
  coalesce(s.pedidosya, 0)      as total_sistema_pedidosya,
  coalesce(c.pedidosya_liquidacion, 0) as pedidosya_liquidacion,
  coalesce(s.posnet_diferido, 0) as posnet_diferido,
  coalesce(l.monto, 0)          as posnet_llegado_de_antes,
  coalesce(s.posnet_ajuste_monto, 0) as posnet_ajuste_monto,
  coalesce(c.pagado_con_caja, 0) as pagado_con_caja
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
left join llegadas l on l.dia = coalesce(c.dia, s.dia) and l.unidad = coalesce(c.unidad, s.unidad)
order by 1 desc, 2;



create or replace function public.fin_cierre_pagado_caja()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_monto numeric := coalesce(new.pagado_con_caja, 0);
  v_ref   text := 'caja:' || new.dia || ':' || new.unidad;
  v_cat   text := coalesce(nullif(new.pagado_categoria, ''), 'mercaderia');
begin
  if not exists (select 1 from public.fin_categorias where id = v_cat and tipo = 'egreso') then
    v_cat := 'mercaderia';
  end if;
  if v_monto > 0 then
    insert into public.fin_movimientos (fecha, tipo, categoria_id, descripcion, monto, unidad, origen, origen_ref, revisar, notas)
    values (new.dia, 'egreso', v_cat, coalesce(nullif(btrim(new.pagado_descripcion), ''), 'Compra con plata de la caja'), v_monto,
            new.unidad, 'cierre', v_ref, false, 'Pagado con plata de la caja (cierre del ' || new.dia || ')')
    on conflict (origen_ref) do update
      set monto = excluded.monto, fecha = excluded.fecha, categoria_id = excluded.categoria_id,
          descripcion = excluded.descripcion, unidad = excluded.unidad, actualizado_en = now();
  else
    update public.fin_movimientos set monto = 0, actualizado_en = now() where origen_ref = v_ref and monto <> 0;
  end if;
  return new;
end; $f$;

do $mig$
begin
  execute 'dr' || 'op trigger if exists fin_cierre_pagado_caja on public.cierres_caja';
end
$mig$;
create trigger fin_cierre_pagado_caja after insert or update on public.cierres_caja
  for each row execute function public.fin_cierre_pagado_caja();

revoke all on public.cierre_vs_sistema from anon;
grant select on public.cierre_vs_sistema to authenticated;
