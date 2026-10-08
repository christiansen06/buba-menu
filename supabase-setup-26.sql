-- =====================================================================
-- PARTE 26 — Liquidaciones de Uber Eats, con sus pedidos y productos
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- BüBa Gestión importa el CSV "Detalles del pago (nivel de artículo)" de
-- Uber Eats Manager. Tres tablas, sólo para el dueño:
--   · uber_liquidaciones  un pago de Uber (ID de referencia de pago)
--   · uber_pedidos        cada pedido de ese pago (ID del pedido de Uber)
--   · uber_items          los productos de cada pedido
--
-- Sin duplicados: los ID de Uber son las claves. Importar el mismo archivo
-- dos veces actualiza lo que ya estaba (por si Uber corrigió algo).
--
-- La PLATA no entra por acá: la liquidación ya cuenta como ingreso desde el
-- cierre de caja del día que llega ("De eso, liquidación de Uber", parte
-- 24). Esto es el detalle: qué se vendió y cuánto se quedó Uber. La vista
-- uber_liquidaciones_caja dice si cada pago ya está anotado en un cierre.
--
-- No guarda nombres de clientes (el reporte tampoco los trae).
-- =====================================================================

create table if not exists public.uber_liquidaciones (
  ref_pago      text primary key,               -- "ID de referencia de pago"
  fecha_pago    date not null,
  desde         date,                           -- primer y último pedido
  hasta         date,
  pedidos       integer not null,
  ventas        numeric(12,2) not null,         -- IVA incluido
  promociones   numeric(12,2) not null default 0,
  tasa_mercado  numeric(12,2) not null default 0,   -- negativos: lo que descuenta Uber
  red_entregas  numeric(12,2) not null default 0,
  impuestos     numeric(12,2) not null default 0,
  otros         numeric(12,2) not null default 0,
  cargos        numeric(12,2) not null,         -- pago − ventas después de ajustes (incluye el IVA de la tasa)
  pago_total    numeric(12,2) not null,
  archivo       text,
  importado_en  timestamptz not null default now()
);

create table if not exists public.uber_pedidos (
  id_pedido        text primary key,            -- "ID del pedido" sin el "#"
  ref_pago         text not null references public.uber_liquidaciones (ref_pago) on delete cascade,
  flujo            text,
  fecha            date,
  hora             text,
  estado           text,
  medio_pago       text,
  entrega          text,
  ventas           numeric(12,2) not null,
  iva              numeric(12,2) not null default 0,
  promociones      numeric(12,2) not null default 0,
  total_ajustado   numeric(12,2) not null default 0,
  tasa_mercado     numeric(12,2) not null default 0,
  red_entregas     numeric(12,2) not null default 0,
  impuesto_red     numeric(12,2) not null default 0,
  otros            numeric(12,2) not null default 0,
  cobrado_efectivo numeric(12,2) not null default 0,
  pago_total       numeric(12,2) not null,
  fecha_pago       date
);
create index if not exists uber_pedidos_ref_pago on public.uber_pedidos (ref_pago);
create index if not exists uber_pedidos_fecha on public.uber_pedidos (fecha);

create table if not exists public.uber_items (
  id_pedido        text not null references public.uber_pedidos (id_pedido) on delete cascade,
  orden            smallint not null,
  nombre           text not null,               -- nombre en Uber ("Waffle Listo - Frutilla")
  cantidad         numeric(10,2) not null default 1,
  precio_unitario  numeric(12,2) not null default 0,
  ventas           numeric(12,2) not null default 0,   -- la línea, con extras
  primary key (id_pedido, orden)
);

-- RLS: sólo la cuenta del dueño, como fin_*.
alter table public.uber_liquidaciones enable row level security;
alter table public.uber_pedidos enable row level security;
alter table public.uber_items enable row level security;

create policy "el dueño lee" on public.uber_liquidaciones for select to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
create policy "el dueño modifica" on public.uber_liquidaciones for all to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid) with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
create policy "el dueño lee" on public.uber_pedidos for select to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
create policy "el dueño modifica" on public.uber_pedidos for all to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid) with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
create policy "el dueño lee" on public.uber_items for select to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
create policy "el dueño modifica" on public.uber_items for all to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid) with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
revoke all on public.uber_liquidaciones, public.uber_pedidos, public.uber_items from anon;


-- Un solo camino de escritura: todo el archivo entra junto o no entra nada.
-- p = { archivo, liquidaciones: [...], pedidos: [{ ..., items: [...] }] }
create or replace function public.importar_uber(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_liq_nuevas  integer := 0;
  v_ped_nuevos  integer := 0;
  v_ped_total   integer := 0;
  l jsonb;
  ped jsonb;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'Sólo el dueño puede importar liquidaciones de Uber';
  end if;

  for l in select * from jsonb_array_elements(coalesce(p->'liquidaciones', '[]'::jsonb)) loop
    if not exists (select 1 from uber_liquidaciones where ref_pago = l->>'ref_pago') then
      v_liq_nuevas := v_liq_nuevas + 1;
    end if;
    insert into uber_liquidaciones
      (ref_pago, fecha_pago, desde, hasta, pedidos, ventas, promociones, tasa_mercado,
       red_entregas, impuestos, otros, cargos, pago_total, archivo)
    values (l->>'ref_pago', (l->>'fecha_pago')::date, (l->>'desde')::date, (l->>'hasta')::date,
            (l->>'pedidos')::int, (l->>'ventas')::numeric, coalesce((l->>'promociones')::numeric, 0),
            coalesce((l->>'tasa_mercado')::numeric, 0), coalesce((l->>'red_entregas')::numeric, 0),
            coalesce((l->>'impuestos')::numeric, 0), coalesce((l->>'otros')::numeric, 0),
            (l->>'cargos')::numeric, (l->>'pago_total')::numeric, p->>'archivo')
    on conflict (ref_pago) do update set
      fecha_pago = excluded.fecha_pago, desde = excluded.desde, hasta = excluded.hasta,
      pedidos = excluded.pedidos, ventas = excluded.ventas, promociones = excluded.promociones,
      tasa_mercado = excluded.tasa_mercado, red_entregas = excluded.red_entregas,
      impuestos = excluded.impuestos, otros = excluded.otros, cargos = excluded.cargos,
      pago_total = excluded.pago_total, archivo = excluded.archivo, importado_en = now();
  end loop;

  for ped in select * from jsonb_array_elements(coalesce(p->'pedidos', '[]'::jsonb)) loop
    v_ped_total := v_ped_total + 1;
    if not exists (select 1 from uber_pedidos where id_pedido = ped->>'id_pedido') then
      v_ped_nuevos := v_ped_nuevos + 1;
    end if;
    insert into uber_pedidos
      (id_pedido, ref_pago, flujo, fecha, hora, estado, medio_pago, entrega, ventas, iva,
       promociones, total_ajustado, tasa_mercado, red_entregas, impuesto_red, otros,
       cobrado_efectivo, pago_total, fecha_pago)
    values (ped->>'id_pedido', ped->>'ref_pago', ped->>'flujo', (ped->>'fecha')::date, ped->>'hora',
            ped->>'estado', ped->>'medio_pago', ped->>'entrega', (ped->>'ventas')::numeric,
            coalesce((ped->>'iva')::numeric, 0), coalesce((ped->>'promociones')::numeric, 0),
            coalesce((ped->>'total_ajustado')::numeric, 0), coalesce((ped->>'tasa_mercado')::numeric, 0),
            coalesce((ped->>'red_entregas')::numeric, 0), coalesce((ped->>'impuesto_red')::numeric, 0),
            coalesce((ped->>'otros')::numeric, 0), coalesce((ped->>'cobrado_efectivo')::numeric, 0),
            (ped->>'pago_total')::numeric, (ped->>'fecha_pago')::date)
    on conflict (id_pedido) do update set
      ref_pago = excluded.ref_pago, flujo = excluded.flujo, fecha = excluded.fecha, hora = excluded.hora,
      estado = excluded.estado, medio_pago = excluded.medio_pago, entrega = excluded.entrega,
      ventas = excluded.ventas, iva = excluded.iva, promociones = excluded.promociones,
      total_ajustado = excluded.total_ajustado, tasa_mercado = excluded.tasa_mercado,
      red_entregas = excluded.red_entregas, impuesto_red = excluded.impuesto_red, otros = excluded.otros,
      cobrado_efectivo = excluded.cobrado_efectivo, pago_total = excluded.pago_total,
      fecha_pago = excluded.fecha_pago;

    -- Productos por (pedido, orden): reimportar el mismo archivo los
    -- actualiza, no los duplica. Uber no cambia los productos de un pedido
    -- ya pagado, así que no hace falta borrar sobrantes.
    insert into uber_items (id_pedido, orden, nombre, cantidad, precio_unitario, ventas)
    select ped->>'id_pedido', (i->>'orden')::smallint, i->>'nombre',
           coalesce((i->>'cantidad')::numeric, 1), coalesce((i->>'precio_unitario')::numeric, 0),
           coalesce((i->>'ventas')::numeric, 0)
      from jsonb_array_elements(coalesce(ped->'items', '[]'::jsonb)) i
    on conflict (id_pedido, orden) do update set
      nombre = excluded.nombre, cantidad = excluded.cantidad,
      precio_unitario = excluded.precio_unitario, ventas = excluded.ventas;
  end loop;

  return jsonb_build_object(
    'liquidaciones_nuevas', v_liq_nuevas,
    'pedidos_nuevos', v_ped_nuevos,
    'pedidos_actualizados', v_ped_total - v_ped_nuevos);
end;
$$;

revoke all on function public.importar_uber(jsonb) from public, anon;
grant execute on function public.importar_uber(jsonb) to authenticated;


-- Cada liquidación y si ya está en la caja. La parte 24 anota la de cada
-- cierre como 'uber:DIA:UNIDAD'; se busca la del día del pago o de los dos
-- siguientes (Uber deposita de madrugada y a veces se anota al otro día).
create or replace view public.uber_liquidaciones_caja
with (security_invoker = on) as
select
  l.*,
  m.fecha  as caja_dia,
  m.monto  as caja_monto,
  case
    when m.monto is null then 'falta'
    when abs(m.monto - l.pago_total) < 1 then 'en_caja'
    else 'monto_distinto'
  end as caja_estado
from public.uber_liquidaciones l
left join lateral (
  select f.fecha, f.monto
    from public.fin_movimientos f
   where f.origen_ref like 'uber:%'
     and f.fecha between l.fecha_pago and l.fecha_pago + 2
   order by abs(f.monto - l.pago_total), f.fecha
   limit 1
) m on true;
revoke all on public.uber_liquidaciones_caja from anon;


-- Verificación (después de correr):
--   select * from uber_liquidaciones_caja;            -- vacía hasta el primer import
--   select has_function_privilege('anon', 'public.importar_uber(jsonb)', 'execute');   -- false

/* Reversa:
drop view if exists public.uber_liquidaciones_caja;
drop function if exists public.importar_uber(jsonb);
drop table if exists public.uber_items;
drop table if exists public.uber_pedidos;
drop table if exists public.uber_liquidaciones;
*/
