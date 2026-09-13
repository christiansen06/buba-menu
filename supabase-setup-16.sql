-- =====================================================================
-- PARTE 16 — ENTREGA 1: estado de pedido, cierre de caja y campos ARCA
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
-- Es la Entrega 1 de BUBA_SPEC_CLAUDE_CODE_v2.md, puntos 1a a 1d y 1f.
-- (1e, Web Analytics, va por el lado de Vercel y de src/main.jsx.)
--
-- registrar_pedido NO cambia de firma ni de cuerpo: el estado tiene default
-- y medio_pago_cobro no viaja desde el menú. El menú registra igual que ayer.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1a. Estado de pedido — versión mínima
-- ---------------------------------------------------------------------
-- Todo pedido nace 'confirmado' y cuenta como venta, igual que hoy.
-- 'cancelado' es la única transición manual. Un pedido cancelado NO se
-- borra y NO entra en ningún reporte.
--
-- Por qué no el ciclo de cuatro estados de la v1: con ~11 pedidos por día y
-- el 64% entre las 16 y las 18, exigir tres toques por pedido en hora pico
-- es pedir que el personal no lo haga. Y si "sólo cobrado cuenta", los
-- reportes muestran cero ventas. Medido, el problema que ese ciclo resolvía
-- (ventas infladas) no existe: el sistema está un 3% ABAJO de la caja.

alter table public.pedidos
  add column if not exists estado text not null default 'confirmado'
    check (estado in ('confirmado', 'cancelado')),
  add column if not exists cancelado_en        timestamptz,
  add column if not exists motivo_cancelacion  text;

-- Mantiene cancelado_en solo. Al cancelar se sella la hora; al deshacer se
-- limpia junto con el motivo. Es lo único que hace: no bloquea editar el
-- pedido, porque la Entrega 2 lo necesita y hoy ya se corrige a mano.
create or replace function public.pedidos_mantener_estado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.estado is distinct from old.estado then
    if new.estado = 'cancelado' then
      new.cancelado_en := coalesce(new.cancelado_en, now());
    else
      new.cancelado_en       := null;
      new.motivo_cancelacion := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_mantener_estado on public.pedidos;
create trigger pedidos_mantener_estado
  before update of estado on public.pedidos
  for each row execute function public.pedidos_mantener_estado();

-- Hasta hoy nadie podía modificar un pedido desde la API: sólo insertar
-- (anon) y leer (el dueño). Cancelar es una modificación, así que el dueño
-- pasa a poder actualizar. Mismo criterio que la lectura. anon sigue sin
-- poder tocar nada que ya exista.
drop policy if exists "el dueño modifica pedidos" on public.pedidos;
create policy "el dueño modifica pedidos"
  on public.pedidos for update
  to authenticated
  using      (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);


-- ---------------------------------------------------------------------
-- 1b. Medio de pago verificado
-- ---------------------------------------------------------------------
-- No reemplaza medio_pago (lo que el cliente DECLARÓ en el menú). Este es
-- con qué se COBRÓ de verdad, cargado desde el panel. Tener los dos deja
-- medir cuántos dicen "transferencia" y pagan de otra forma.
-- 'debito' es nuevo: el menú no lo ofrece, el mostrador sí lo cobra.

alter table public.pedidos
  add column if not exists medio_pago_cobro text
    check (medio_pago_cobro is null or medio_pago_cobro in ('efectivo', 'transferencia', 'debito'));


-- ---------------------------------------------------------------------
-- 1d. Campos reservados para ARCA
-- ---------------------------------------------------------------------
-- Nullables, sin lógica, sin dependencias. Están para que cuando llegue la
-- facturación electrónica no haya que migrar: sólo llenar.

alter table public.pedidos
  add column if not exists comprobante_id     text,
  add column if not exists punto_venta        integer,
  add column if not exists numero_comprobante bigint,
  add column if not exists cae                text,
  add column if not exists cae_vencimiento    date;


-- ---------------------------------------------------------------------
-- LAS DOS FUENTES DE TODO REPORTE: ventas y ventas_items
-- ---------------------------------------------------------------------
-- "Un pedido cancelado no entra en ningún reporte" no puede depender de
-- que cada vista se acuerde de poner un WHERE. Hay 22 vistas y van a ser
-- más. Si una sola se olvida, cuenta pedidos cancelados en silencio.
--
-- Entonces la regla es estructural:
--
--   · `ventas`        = pedidos que cuentan  (estado <> 'cancelado')
--   · `ventas_items`  = sus líneas
--   · NINGÚN reporte lee pedidos ni pedido_items directamente.
--     Leen ventas / ventas_items.
--
-- La única excepción es pedidos_local, que es la lista operativa del día:
-- esa tiene que mostrar los cancelados (para verlos y para deshacer), y por
-- eso ahora también muestra la columna estado.
--
-- Al final de esta parte hay una auditoría que FALLA si alguna otra vista
-- lee las tablas crudas. Correr esta parte de nuevo después de crear vistas
-- nuevas las repunta solas.
--
-- Ojo: ventas usa select *, así que si algún día se agrega una columna a
-- pedidos hay que volver a crear ventas para que la vea.

create or replace view public.ventas
with (security_invoker = on) as
select * from public.pedidos
where estado <> 'cancelado';

create or replace view public.ventas_items
with (security_invoker = on) as
select i.* from public.pedido_items i
join public.ventas v on v.id = i.pedido_id;


-- Repunte mecánico de las vistas existentes. No cambia ninguna columna ni
-- ningún cálculo: donde decía pedidos dice ventas, donde decía pedido_items
-- dice ventas_items. Como todavía no hay ningún pedido cancelado, todas las
-- vistas tienen que devolver EXACTAMENTE lo mismo que antes — y eso es lo
-- que se verifica (ver VERIFICACIÓN).
do $$
declare
  v record;
  def text;
begin
  for v in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and c.relname not in ('ventas', 'ventas_items', 'pedidos_local')
      and exists (
        select 1
        from pg_depend d
        join pg_rewrite r on r.oid = d.objid and r.ev_class = c.oid
        join pg_class src on src.oid = d.refobjid
        where src.relname in ('pedidos', 'pedido_items') and src.relkind = 'r'
      )
  loop
    def := pg_get_viewdef(('public.' || quote_ident(v.relname))::regclass, true);
    -- Sólo referencias a TABLAS (lo que viene después de FROM / JOIN). Un
    -- alias de columna como "count(*) AS pedidos" tiene que quedar igual:
    -- renombrar una columna de una vista con create or replace es un error.
    def := regexp_replace(def, '(\m(FROM|JOIN)\s+\(*)pedido_items\M', '\1ventas_items', 'g');
    def := regexp_replace(def, '(\m(FROM|JOIN)\s+\(*)pedidos\M',      '\1ventas',       'g');
    execute format(
      'create or replace view public.%I with (security_invoker = on) as %s',
      v.relname, def
    );
    raise notice 'repuntada: %', v.relname;
  end loop;
end $$;


-- pedidos_local: la lista operativa. Sigue leyendo pedidos crudos a
-- propósito, y ahora dice en qué estado está cada uno y con qué se cobró.
-- (create or replace sólo permite AGREGAR columnas al final: por eso van
-- las dos últimas.)
create or replace view public.pedidos_local
with (security_invoker = on) as
select
  p.id,
  (p.creado_en at time zone 'America/Argentina/Buenos_Aires')::timestamp(0) as fecha_hora,
  to_char(p.creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
  p.total,
  (select count(*)                   from public.pedido_items i where i.pedido_id = p.id) as lineas,
  (select coalesce(sum(i.cantidad),0) from public.pedido_items i where i.pedido_id = p.id) as unidades,
  p.creado_en as guardado_utc,
  p.medio_pago,
  p.estado,
  p.medio_pago_cobro
from public.pedidos p
order by p.creado_en desc;


-- ---------------------------------------------------------------------
-- 1c. Cierre de caja
-- ---------------------------------------------------------------------
-- Reemplaza la hoja "Caja Diaria 2026". La fórmula, verificada en el Excel:
--
--   FIN          = EF. FINAL + TRANSFERENCIAS         (0 si los dos son 0)
--   GANANCIA     = FIN − CAJA INICIO                   (0 si FIN es 0)
--   CAJA INICIO  = CAJA SIGUIENTE DÍA del día anterior
--
-- Acá GANANCIA se llama total_declarado (es lo que la caja dice que se
-- vendió) y se le suma débito, que el Excel no tenía.
--
-- Clave (dia, unidad) y no sólo dia: en diciembre cierran dos cajas por día.

create table if not exists public.cierres_caja (
  dia              date    not null,
  unidad           text    not null default 'local' check (unidad in ('local', 'food_truck')),

  caja_inicio      integer,             -- se autocompleta con caja_siguiente del cierre anterior
  efectivo_final   integer,             -- contado a mano
  transferencias   integer,             -- manual
  debito           integer not null default 0,   -- nuevo, manual
  caja_siguiente   integer,             -- lo que queda en la caja para mañana

  -- Misma regla que el Excel: si no se cargó nada, es 0 y no −caja_inicio.
  total_declarado  integer generated always as (
    case when coalesce(efectivo_final, 0) + coalesce(transferencias, 0) + coalesce(debito, 0) = 0
         then 0
         else coalesce(efectivo_final, 0) + coalesce(transferencias, 0) + coalesce(debito, 0)
              - coalesce(caja_inicio, 0)
    end
  ) stored,

  notas            text,
  cerrado_por      text,
  cerrado_en       timestamptz not null default now(),

  primary key (dia, unidad)
);

-- RLS ACTIVADO Y RESTRICTIVO EN LA MISMA MIGRACIÓN (regla desde la parte 10).
-- Es la caja: nada más sensible que esto.
alter table public.cierres_caja enable row level security;

drop policy if exists "el dueño lee cierres" on public.cierres_caja;
create policy "el dueño lee cierres"
  on public.cierres_caja for select
  to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "el dueño modifica cierres" on public.cierres_caja;
create policy "el dueño modifica cierres"
  on public.cierres_caja for all
  to authenticated
  using      (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

-- caja_inicio de hoy = caja_siguiente del último cierre anterior de la
-- misma unidad. Si se manda explícito, se respeta.
create or replace function public.cierres_caja_autocompletar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.caja_inicio is null then
    select c.caja_siguiente into new.caja_inicio
    from public.cierres_caja c
    where c.unidad = new.unidad and c.dia < new.dia
    order by c.dia desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists cierres_caja_autocompletar on public.cierres_caja;
create trigger cierres_caja_autocompletar
  before insert on public.cierres_caja
  for each row execute function public.cierres_caja_autocompletar();


-- Caja contra sistema, día por día. La diferencia va SIEMPRE visible: es la
-- métrica de salud del sistema (línea de base: 97% en 45 días).
--
-- full outer join a propósito: un día con ventas en el sistema y sin cierre
-- también tiene que aparecer — un cierre que falta es un dato, no un cero.
create or replace view public.cierre_vs_sistema
with (security_invoker = on) as
with sistema as (
  select
    (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
    coalesce(unidad, 'local')                                       as unidad,
    count(*)                                                        as pedidos,
    sum(total)                                                      as facturado
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
  -- NULL cuando no hay cierre: la diferencia no se conoce, no es cero.
  c.total_declarado - coalesce(s.facturado, 0)                                    as diferencia,
  round(100.0 * coalesce(s.facturado, 0) / nullif(c.total_declarado, 0))          as sistema_sobre_caja_pct,
  case when c.dia is null then 'sin cierre' else 'cerrado' end                    as estado_cierre,
  c.notas
from public.cierres_caja c
full outer join sistema s on s.dia = c.dia and s.unidad = c.unidad
order by 1 desc, 2;


-- ---------------------------------------------------------------------
-- Histórico: los 45 días de la hoja "Caja Diaria 2026" (29/07 → 12/09)
-- ---------------------------------------------------------------------
-- Es la misma conciliación de la sección 1.3 del spec, así el panel
-- arranca con contexto en vez de con una tabla vacía. Las transferencias
-- con centavos se redondean. cerrado_en se pone a las 20:00 de cada día,
-- que es la hora de cierre del local, para que no parezca que se cerraron
-- todos hoy.
--
-- El 13/09 (hoy) no se carga: en el Excel sólo tiene caja_inicio.

insert into public.cierres_caja
  (dia, unidad, caja_inicio, efectivo_final, transferencias, caja_siguiente, cerrado_por, cerrado_en)
select
  d.dia, 'local', d.ini, d.ef, d.tr, d.sig,
  'Excel · Caja Diaria 2026',
  (d.dia + time '20:00') at time zone 'America/Argentina/Buenos_Aires'
from (values
  (date '2026-07-29', 19200,  79200,  62000, 17700),
  (date '2026-07-30', 17700,  44300,  94138, 19300),
  (date '2026-07-31', 19300,  27500, 127894, 17500),
  (date '2026-08-01', 17500,  83500,  93500, 23500),
  (date '2026-08-02', 23500, 155000, 109500, 19000),
  (date '2026-08-03', 19000,  61500,  37500, 19500),
  (date '2026-08-04', 19500,  44000, 154000, 20000),
  (date '2026-08-05', 20000,  96000, 109500, 20000),
  (date '2026-08-06', 20000,  20000,      0, 20000),
  (date '2026-08-07', 20000,  82500, 121272, 20500),
  (date '2026-08-08', 20500,  81500, 106000, 19500),
  (date '2026-08-09', 19500,  71550,  58500, 19500),
  (date '2026-08-10', 19500,  61500,  39500, 19500),
  (date '2026-08-11', 19500,  53000,  46772, 19500),
  (date '2026-08-12', 19500,  47000,  47000, 20000),
  (date '2026-08-13', 20000, 145000,  32000, 20000),
  (date '2026-08-14', 20000, 101000, 124332, 19000),
  (date '2026-08-15', 19000,  61400,  85000, 19400),
  (date '2026-08-16', 19400, 162900, 139500, 19900),
  (date '2026-08-17', 19900,  35000, 117000, 19700),
  (date '2026-08-18', 19700, 151100, 147000, 20100),
  (date '2026-08-19', 20100,  79000, 147387, 20000),
  (date '2026-08-20', 20000,  57600,  70500, 19800),
  (date '2026-08-21', 19800,  64800,  44500, 19800),
  (date '2026-08-22', 19800, 125800,  69000, 19800),
  (date '2026-08-23', 19800, 138800, 126000, 18800),
  (date '2026-08-24', 18800,  65900,  16000, 18800),
  (date '2026-08-25', 18800,  63600,  44679, 19600),
  (date '2026-08-26', 19600,  39800,  78500, 19800),
  (date '2026-08-27', 19800, 140300,  63000, 19800),
  (date '2026-08-28', 19800,  67850,  90500, 19800),
  (date '2026-08-29', 19800, 110800, 128000, 19800),
  (date '2026-08-30', 19800, 168300, 202506, 18300),
  (date '2026-08-31', 18300,  83300,  47000, 20300),
  (date '2026-09-01', 20300,  31800, 105736, 11800),
  (date '2026-09-02', 11800,  16300,   8000, 16300),
  (date '2026-09-03', 16300,  32800, 111700, 16300),
  (date '2026-09-04', 16300,  44800,  18200, 19800),
  (date '2026-09-05', 19800,  39800,  77500, 19800),
  (date '2026-09-06', 19800, 113800,  66500, 19800),
  (date '2026-09-07', 19800,  19800,  54000, 19800),
  (date '2026-09-08', 19800,  86800, 145110, 19800),
  (date '2026-09-09', 19800,  34000,  50000, 19800),
  (date '2026-09-10', 19800,  20300, 130057, 20800),
  (date '2026-09-11', 20800,  80000,  77700, 20800),
  (date '2026-09-12', 20800,  83700,  16000, 19700)
) as d(dia, ini, ef, tr, sig)
on conflict (dia, unidad) do nothing;


-- ---------------------------------------------------------------------
-- AUDITORÍA — falla si algún reporte lee las tablas crudas
-- ---------------------------------------------------------------------
-- Es lo que convierte "ningún reporte cuenta cancelados" de una intención
-- en una garantía. Si esto explota, hay una vista que hay que repuntar.
do $$
declare
  ofensoras text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into ofensoras
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and c.relname not in ('ventas', 'ventas_items', 'pedidos_local')
    and exists (
      select 1
      from pg_depend d
      join pg_rewrite r on r.oid = d.objid and r.ev_class = c.oid
      join pg_class src on src.oid = d.refobjid
      where src.relname in ('pedidos', 'pedido_items') and src.relkind = 'r'
    );
  if ofensoras is not null then
    raise exception 'Estas vistas leen pedidos/pedido_items directamente y contarían cancelados: %', ofensoras;
  end if;
  raise notice 'OK: ningún reporte lee las tablas crudas.';
end $$;


-- =====================================================================
-- VERIFICACIÓN
--
-- 1. Conteos intactos: pedidos, pedido_items y sum(total) iguales que antes.
-- 2. Cada vista devuelve las mismas filas que antes de correr esto (no hay
--    cancelados todavía, así que repuntar no puede cambiar ningún número).
--    Hecho el 13/09 con md5 de query_to_xml por vista: 22 de 23 idénticas.
--    La que cambió (metrica_opciones_armables) se cotejó fila por fila con
--    EXCEPT en los dos sentidos: 39 = 39, cero diferencias. El md5 le cambió
--    sólo porque su ORDER BY tiene empates y el plan nuevo los devuelve en
--    otro orden. Moraleja: para comparar vistas usar EXCEPT, no md5.
--
-- 3. Cancelar un pedido dentro de una transacción y ver que desaparece de
--    ventas, facturacion_por_dia y ventas_desglosadas pero sigue en
--    pedidos_local con estado = 'cancelado'. Rollback.
-- 4. select * from cierre_vs_sistema: 45 días con cierre, más los días con
--    ventas y sin cierre marcados 'sin cierre'.
-- 5. anon lee 0 filas de cierres_caja, cierre_vs_sistema y ventas.
-- 6. registrar_pedido con 5 argumentos sigue andando, en una transacción
--    que se revierte.
-- =====================================================================


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
drop view if exists public.cierre_vs_sistema;
drop trigger if exists cierres_caja_autocompletar on public.cierres_caja;
drop function if exists public.cierres_caja_autocompletar();
drop table if exists public.cierres_caja;

-- repuntar las vistas a las tablas crudas
do $$
declare v record; def text;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and c.relname not in ('ventas', 'ventas_items', 'pedidos_local')
  loop
    def := pg_get_viewdef(('public.' || quote_ident(v.relname))::regclass, true);
    def := regexp_replace(def, '(\m(FROM|JOIN)\s+\(*)ventas_items\M', '\1pedido_items', 'g');
    def := regexp_replace(def, '(\m(FROM|JOIN)\s+\(*)ventas\M',       '\1pedidos',      'g');
    execute format('create or replace view public.%I with (security_invoker = on) as %s', v.relname, def);
  end loop;
end $$;

drop view if exists public.ventas_items;
drop view if exists public.ventas;

-- pedidos_local vuelve a su versión de la parte 8 (sin estado ni medio_pago_cobro):
-- hay que hacer drop + create con esa definición.

drop policy if exists "el dueño modifica pedidos" on public.pedidos;
drop trigger if exists pedidos_mantener_estado on public.pedidos;
drop function if exists public.pedidos_mantener_estado();

alter table public.pedidos
  drop column if exists cae_vencimiento,
  drop column if exists cae,
  drop column if exists numero_comprobante,
  drop column if exists punto_venta,
  drop column if exists comprobante_id,
  drop column if exists medio_pago_cobro,
  drop column if exists motivo_cancelacion,
  drop column if exists cancelado_en,
  drop column if exists estado;
*/
