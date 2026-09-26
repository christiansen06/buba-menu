-- =====================================================================
-- PARTE 19 — BüBa Gestión: el libro de ingresos y egresos
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta ni ninguna tabla existente. Bloque de reversa al final.
--
-- BüBa Gestión es una app APARTE del menú (otro repositorio, otra dirección)
-- que reemplaza el Excel "Control de ingresos y egresos". Comparte esta base
-- porque los cierres de caja y los pedidos ya viven acá; las tablas nuevas
-- llevan el prefijo fin_ para que se vea de un vistazo qué es de finanzas.
--
-- Qué cambia respecto del Excel:
--
--   · Cada movimiento tiene CATEGORÍA. El Excel sólo tenía descripción libre
--     y en tres años juntó 333 descripciones distintas, muchas repetidas con
--     otra ortografía ("Pago Luz" / "Pago de Luz" / "Pago de luz").
--
--   · Cada categoría tiene GRUPO, y el resultado del negocio sólo suma el
--     grupo 'operativo'. Lo demás se ve aparte:
--        personal    retiros del dueño (UTN, dentista, auto…)
--        inversion   compras de capital (el food truck)
--        financiero  préstamos y cambio de divisas
--        saldo       el "Cierre Año" que el Excel cargaba como ingreso de
--                    enero y que inflaba el resultado de ese mes
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Categorías
-- ---------------------------------------------------------------------

create table if not exists public.fin_categorias (
  id      text primary key,
  tipo    text not null check (tipo in ('ingreso', 'egreso')),
  nombre  text not null,
  grupo   text not null check (grupo in ('operativo', 'financiero', 'inversion', 'personal', 'saldo')),
  orden   integer not null default 0,
  unique (id, tipo)            -- para que el movimiento no mezcle tipo y categoría
);

insert into public.fin_categorias (id, tipo, nombre, grupo, orden) values
  ('ventas',         'ingreso', 'Ventas',                            'operativo',  10),
  ('intereses',      'ingreso', 'Intereses',                         'operativo',  20),
  ('reintegros',     'ingreso', 'Reintegros y devoluciones',         'operativo',  30),
  ('venta_equipos',  'ingreso', 'Venta de equipamiento',             'operativo',  40),
  ('otros_ingresos', 'ingreso', 'Otros ingresos',                    'operativo',  50),
  ('prestamo_recib', 'ingreso', 'Préstamos recibidos',               'financiero', 60),
  ('aportes',        'ingreso', 'Aportes y cambio de divisas',       'financiero', 70),
  ('saldo_inicial',  'ingreso', 'Saldo inicial del año',             'saldo',      80),
  ('sueldos',        'egreso',  'Sueldos',                           'operativo',  10),
  ('mercaderia',     'egreso',  'Mercadería e insumos',              'operativo',  20),
  ('packaging',      'egreso',  'Packaging',                         'operativo',  30),
  ('alquiler_serv',  'egreso',  'Alquiler y servicios',              'operativo',  40),
  ('impuestos',      'egreso',  'Impuestos',                         'operativo',  50),
  ('marketing',      'egreso',  'Marketing',                         'operativo',  60),
  ('mantenimiento',  'egreso',  'Mantenimiento, equipos y limpieza', 'operativo',  70),
  ('transporte',     'egreso',  'Transporte y combustible',          'operativo',  80),
  ('inversiones',    'egreso',  'Inversiones',                       'inversion',  90),
  ('prestamo_pago',  'egreso',  'Préstamos (pagos y adelantos)',     'financiero', 100),
  ('retiros',        'egreso',  'Retiros del dueño (personal)',      'personal',   110)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 2. Movimientos
-- ---------------------------------------------------------------------
-- origen_ref hace que importar dos veces el mismo Excel no duplique nada
-- (la lección del 17/09, otra vez, pero por construcción):
--   'cierre:2026-09-25:local'   el ingreso de un cierre de caja. El mismo
--                               ref lo usa la app al guardar un cierre, así
--                               que cerrar un día ya importado lo ACTUALIZA.
--   'excel:<hash>'              cualquier otra fila del Excel: fecha + tipo +
--                               descripción + monto + nº de ocurrencia (hay
--                               dos compras idénticas el mismo día que son
--                               dos compras de verdad).
--   null                        carga manual desde la app.

create table if not exists public.fin_movimientos (
  id             bigint generated always as identity primary key,
  fecha          date    not null,
  tipo           text    not null check (tipo in ('ingreso', 'egreso')),
  categoria_id   text    not null,
  descripcion    text    not null,
  contraparte    text,                 -- proveedor o persona, normalizado
  monto          numeric(14, 2) not null check (monto >= 0),
  unidad         text check (unidad is null or unidad in ('local', 'food_truck')),
  origen         text    not null default 'manual' check (origen in ('excel', 'manual', 'cierre')),
  origen_ref     text unique,
  revisar        boolean not null default false,   -- categoría dudosa, a confirmar
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  foreign key (categoria_id, tipo) references public.fin_categorias (id, tipo)
);

create index if not exists fin_movimientos_fecha on public.fin_movimientos (fecha);
create index if not exists fin_movimientos_categoria on public.fin_movimientos (categoria_id);


-- ---------------------------------------------------------------------
-- 3. RLS: sólo el dueño, en esta misma migración (regla desde la parte 10)
-- ---------------------------------------------------------------------

alter table public.fin_categorias  enable row level security;
alter table public.fin_movimientos enable row level security;

drop policy if exists "el dueño lee categorias" on public.fin_categorias;
create policy "el dueño lee categorias" on public.fin_categorias for select to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "el dueño modifica categorias" on public.fin_categorias;
create policy "el dueño modifica categorias" on public.fin_categorias for all to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "el dueño lee movimientos" on public.fin_movimientos;
create policy "el dueño lee movimientos" on public.fin_movimientos for select to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

drop policy if exists "el dueño modifica movimientos" on public.fin_movimientos;
create policy "el dueño modifica movimientos" on public.fin_movimientos for all to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);


-- ---------------------------------------------------------------------
-- 4. Reportes
-- ---------------------------------------------------------------------

-- Mes a mes, con el resultado del negocio separado de todo lo demás.
-- flujo = todo lo que entró menos todo lo que salió (salvo el saldo inicial,
-- que no es plata nueva sino la de antes). saldo_acumulado es el flujo sumado
-- desde el primer mes del libro.
create or replace view public.fin_resultado_mensual
with (security_invoker = on) as
with m as (
  select
    date_trunc('month', mv.fecha)::date as mes,
    sum(mv.monto) filter (where mv.tipo = 'ingreso' and c.id = 'ventas')                    as ventas,
    sum(mv.monto) filter (where mv.tipo = 'ingreso' and c.grupo = 'operativo')              as ingresos_operativos,
    sum(mv.monto) filter (where mv.tipo = 'egreso'  and c.grupo = 'operativo')              as egresos_operativos,
    sum(mv.monto) filter (where mv.tipo = 'egreso'  and c.grupo = 'personal')               as retiros,
    sum(mv.monto) filter (where mv.tipo = 'egreso'  and c.grupo = 'inversion')              as inversiones,
    sum(case when c.grupo = 'financiero' then (case mv.tipo when 'ingreso' then mv.monto else -mv.monto end) end) as financiero_neto,
    sum(case when c.grupo <> 'saldo'     then (case mv.tipo when 'ingreso' then mv.monto else -mv.monto end) end) as flujo,
    count(*) filter (where mv.revisar)                                                       as a_revisar
  from public.fin_movimientos mv
  join public.fin_categorias c on c.id = mv.categoria_id
  group by 1
)
select
  mes,
  coalesce(ventas, 0)                                          as ventas,
  coalesce(ingresos_operativos, 0)                             as ingresos_operativos,
  coalesce(egresos_operativos, 0)                              as egresos_operativos,
  coalesce(ingresos_operativos, 0) - coalesce(egresos_operativos, 0) as resultado_operativo,
  coalesce(retiros, 0)                                         as retiros,
  coalesce(inversiones, 0)                                     as inversiones,
  coalesce(financiero_neto, 0)                                 as financiero_neto,
  coalesce(flujo, 0)                                           as flujo,
  sum(coalesce(flujo, 0)) over (order by mes)                  as saldo_acumulado,
  a_revisar
from m
order by mes;

-- Por categoría y mes: el gráfico de "en qué se va la plata".
create or replace view public.fin_categoria_mensual
with (security_invoker = on) as
select
  date_trunc('month', mv.fecha)::date as mes,
  mv.tipo,
  c.id    as categoria_id,
  c.nombre as categoria,
  c.grupo,
  sum(mv.monto) as total,
  count(*)      as movimientos
from public.fin_movimientos mv
join public.fin_categorias c on c.id = mv.categoria_id
group by 1, 2, 3, 4, 5
order by 1, 2, total desc;

-- Proveedores y personas: a quién se le paga más.
create or replace view public.fin_contrapartes
with (security_invoker = on) as
select
  coalesce(mv.contraparte, mv.descripcion) as contraparte,
  mv.tipo,
  mode() within group (order by mv.categoria_id) as categoria_id,
  sum(mv.monto)  as total,
  count(*)       as movimientos,
  max(mv.fecha)  as ultimo
from public.fin_movimientos mv
group by 1, 2
order by total desc;


-- =====================================================================
-- PARA VOLVER ATRÁS (no toca nada fuera de fin_*)
-- =====================================================================
/*
drop view if exists public.fin_contrapartes;
drop view if exists public.fin_categoria_mensual;
drop view if exists public.fin_resultado_mensual;
drop table if exists public.fin_movimientos;
drop table if exists public.fin_categorias;
*/
