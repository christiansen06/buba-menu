-- =====================================================================
-- PARTE 20 — El cierre de caja anota solo el ingreso del día
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- Bloque de reversa al final.
--
-- Hasta ahora había que cargar dos veces lo mismo: el cierre en la hoja
-- "Caja Diaria" y después "Cierre de Caja" como ingreso en la hoja diaria.
-- Con esto, guardar (o corregir) un cierre en cierres_caja deja en
-- fin_movimientos un único ingreso de ventas por día y unidad:
--
--     origen_ref = 'cierre:AAAA-MM-DD:local'  (o ':food_truck')
--     monto      = total_declarado  (efectivo + transferencias + débito − caja inicio)
--
-- Es el mismo origen_ref que usó la importación del Excel, así que cerrar en
-- BüBa Gestión un día que ya vino del Excel ACTUALIZA ese ingreso: nunca hay
-- dos "Cierre de Caja" el mismo día.
--
-- Es un trigger y no código de la app a propósito: da igual quién escriba el
-- cierre, el libro queda igual. Corre con los permisos de quien guarda el
-- cierre (el dueño, por RLS), no con más.
-- =====================================================================

create or replace function public.fin_cierre_a_movimiento()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.fin_movimientos
    (fecha, tipo, categoria_id, descripcion, monto, unidad, origen, origen_ref, revisar)
  values (
    new.dia, 'ingreso', 'ventas',
    case when new.unidad = 'food_truck' then 'Cierre de Caja · Food Truck' else 'Cierre de Caja' end,
    coalesce(new.total_declarado, 0),
    new.unidad,
    'cierre',
    'cierre:' || new.dia || ':' || new.unidad,
    false
  )
  on conflict (origen_ref) do update
    set monto          = excluded.monto,
        fecha          = excluded.fecha,
        unidad         = excluded.unidad,
        origen         = 'cierre',
        actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists fin_cierre_a_movimiento on public.cierres_caja;
create trigger fin_cierre_a_movimiento
  after insert or update on public.cierres_caja
  for each row execute function public.fin_cierre_a_movimiento();


-- =====================================================================
-- VERIFICACIÓN (en una transacción que se revierte)
-- =====================================================================
-- begin;
--   insert into cierres_caja (dia, unidad, caja_inicio, efectivo_final, transferencias, caja_siguiente)
--   values ('2030-01-01', 'food_truck', 10000, 60000, 50000, 10000);
--   -- → 1 fila 'cierre:2030-01-01:food_truck' por 100000
--   update cierres_caja set transferencias = 70000 where dia = '2030-01-01' and unidad = 'food_truck';
--   -- → la MISMA fila, ahora por 120000
--   select origen_ref, monto, unidad, origen from fin_movimientos where origen_ref like 'cierre:2030-01-01:%';
-- rollback;


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
drop trigger if exists fin_cierre_a_movimiento on public.cierres_caja;
drop function if exists public.fin_cierre_a_movimiento();
*/
