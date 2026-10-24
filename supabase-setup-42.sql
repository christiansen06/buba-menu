-- =====================================================================
-- PARTE 42 — PedidosYa: el informe de pedidos entra como el de Uber
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Gestión lee el CSV del portal de PedidosYa (Pedidos → Descargar informe)
-- y llama a importar_pedidosya. Cada semana (lunes a domingo) es una
-- liquidación; PedidosYa la paga el viernes de 12 días después.
--
--   · pya_liquidaciones  una por semana. ingreso = lo que paga PedidosYa por los
--                        pedidos ("Ingreso estimado"); percepciones = lo que
--                        descuenta además (ARBA, no viene por pedido) y se ajusta
--                        con lo que de verdad acreditó; pago_total = ingreso + percepciones.
--   · pya_pedidos / pya_items  el detalle, para ver y para pasar a las ventas.
--   · pya_productos      nombre de PedidosYa → producto de la carta.
--   · pya_a_ventas       cada pedido pasa a las ventas del menú con plataforma
--                        'pedidos_ya' (así cuenta en "qué se vende" y el cierre
--                        lo descuenta como "lo liquida PedidosYa").
--   · pya_liquidaciones_caja  si el pago ya figura en un cierre ("Liquidación PedidosYa").
-- Sólo el dueño.
-- =====================================================================

create table if not exists public.pya_liquidaciones (
  semana        date primary key,          -- lunes
  desde         date not null,
  hasta         date not null,
  fecha_pago    date not null,
  pedidos       integer not null default 0,
  ventas        numeric(14,2) not null default 0,
  comisiones    numeric(14,2) not null default 0,
  impuestos     numeric(14,2) not null default 0,
  marketing     numeric(14,2) not null default 0,
  reclamos      numeric(14,2) not null default 0,
  ingreso       numeric(14,2) not null default 0,
  percepciones  numeric(14,2) not null default 0,
  pago_total    numeric(14,2) not null default 0,
  archivo       text,
  importado_en  timestamptz not null default now()
);

create table if not exists public.pya_pedidos (
  nro             text primary key,
  semana          date not null references public.pya_liquidaciones(semana),
  fecha           date not null,
  hora            text,
  estado          text,
  entrega         text,
  forma_pago      text,
  subtotal        numeric(14,2) not null default 0,
  impuesto        numeric(14,2) not null default 0,
  comision        numeric(14,2) not null default 0,
  comision_pago   numeric(14,2) not null default 0,
  marketing       numeric(14,2) not null default 0,
  descuento_local numeric(14,2) not null default 0,
  descuento_peya  numeric(14,2) not null default 0,
  reclamo         boolean not null default false,
  motivo_reclamo  text,
  ingreso         numeric(14,2) not null default 0,
  articulos       text
);

create table if not exists public.pya_items (
  nro             text not null references public.pya_pedidos(nro),
  orden           smallint not null,
  nombre          text not null,
  cantidad        integer not null default 1,
  precio_unitario integer not null default 0,
  opciones        jsonb,
  presentacion    text,
  perlas          integer not null default 0,
  primary key (nro, orden)
);

create table if not exists public.pya_productos (
  nombre_pya     text primary key,
  categoria_id   text not null,
  producto_id    text,
  variante       text,
  nombre         text not null,
  a_mano         boolean not null default false,
  actualizado_en timestamptz not null default now()
);

alter table public.pya_liquidaciones enable row level security;
alter table public.pya_pedidos enable row level security;
alter table public.pya_items enable row level security;
alter table public.pya_productos enable row level security;

do $mig$
declare t text;
begin
  foreach t in array array['pya_liquidaciones', 'pya_pedidos', 'pya_items', 'pya_productos'] loop
    execute format('dr' || 'op policy if exists "el dueño" on public.%I', t);
    execute format('create policy "el dueño" on public.%I for all using (auth.uid() = %L::uuid) with check (auth.uid() = %L::uuid)',
                   t, 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11', 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11');
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end
$mig$;

create or replace view public.pya_sin_vincular with (security_invoker = on) as
select i.nombre, sum(i.cantidad) as unidades, max(p.fecha) as ultima_vez
  from public.pya_items i
  join public.pya_pedidos p using (nro)
  left join public.pya_productos m on m.nombre_pya = i.nombre
 where m.nombre_pya is null
 group by i.nombre;

create or replace view public.pya_liquidaciones_caja with (security_invoker = on) as
select l.*, m.fecha as caja_dia, m.monto as caja_monto,
       case when m.monto is null then 'falta'
            when abs(m.monto - l.pago_total) < 1 then 'en_caja'
            else 'monto_distinto' end as caja_estado
  from public.pya_liquidaciones l
  left join lateral (
    select f.fecha, f.monto from public.fin_movimientos f
     where f.origen_ref like 'pedidosya:%' and f.fecha between l.fecha_pago and l.fecha_pago + 4 and f.monto > 0
     order by abs(f.monto - l.pago_total), f.fecha
     limit 1) m on true;

revoke all on public.pya_sin_vincular, public.pya_liquidaciones_caja from anon;
grant select on public.pya_sin_vincular, public.pya_liquidaciones_caja to authenticated;

-- Cada pedido de PedidosYa → una venta del menú (no duplica: id fijo por número de pedido).
create or replace function public.pya_a_ventas(p_semanas date[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pp record;
  v_id uuid;
  v_estado text;
  v_total integer;
  v_resto integer;
  v_nuevas integer := 0;
begin
  for pp in select * from pya_pedidos where semana = any (p_semanas) loop
    v_id := md5('pedidos_ya:' || pp.nro)::uuid;
    v_estado := case when pp.estado is null or pp.estado ~* '(entregad|complet)' then 'confirmado' else 'cancelado' end;
    v_total := round(pp.subtotal)::int;
    if exists (select 1 from pedidos where id = v_id) then
      update pedidos set total = v_total, estado = v_estado,
             motivo_cancelacion = case when v_estado = 'cancelado' then 'PedidosYa: ' || pp.estado end
       where id = v_id and (total, estado) is distinct from (v_total, v_estado);
      continue;
    end if;
    insert into pedidos (id, creado_en, total, medio_pago, unidad, canal, estado, motivo_cancelacion, plataforma, id_externo)
    values (v_id,
            (pp.fecha + coalesce(nullif(pp.hora, '')::time, time '12:00')) at time zone 'America/Argentina/Buenos_Aires',
            v_total, null, 'local', null, v_estado,
            case when v_estado = 'cancelado' then 'PedidosYa: ' || pp.estado end,
            'pedidos_ya', pp.nro);
    insert into pedido_items (pedido_id, categoria_id, producto_id, nombre, variante, cantidad, precio_unitario, detalle)
    select v_id, coalesce(m.categoria_id, 'otros'), m.producto_id, coalesce(m.nombre, i.nombre), m.variante,
           greatest(1, i.cantidad), i.precio_unitario,
           jsonb_strip_nulls(jsonb_build_object(
             'presentacion', i.presentacion,
             'extras', case when i.perlas > 0 then (select jsonb_agg('perlas'::text) from generate_series(1, i.perlas)) end,
             'pedidosya', jsonb_build_object('nombre', i.nombre, 'pedido', pp.nro, 'opciones', i.opciones)))
      from pya_items i
      left join pya_productos m on m.nombre_pya = i.nombre
     where i.nro = pp.nro
     order by i.orden;
    select v_total - coalesce(sum(cantidad * precio_unitario), 0)::int into v_resto from pedido_items where pedido_id = v_id;
    if v_resto <> 0 then
      update pedido_items set precio_unitario = precio_unitario + v_resto
       where id = (select id from pedido_items where pedido_id = v_id and cantidad = 1 order by precio_unitario desc, id limit 1);
    end if;
    v_nuevas := v_nuevas + 1;
  end loop;
  return jsonb_build_object('ventas_nuevas', v_nuevas);
end;
$$;

create or replace function public.importar_pedidosya(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s jsonb;
  ped jsonb;
  it jsonb;
  v_semanas date[] := '{}';
  v_liq_nuevas integer := 0;
  v_ped_nuevos integer := 0;
  v_ped_total integer := 0;
  v_ventas jsonb;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'Sólo el dueño puede importar pedidos de PedidosYa';
  end if;

  insert into pya_productos (nombre_pya, categoria_id, producto_id, variante, nombre)
  select v->>'nombre_pya', v->>'categoria_id', nullif(v->>'producto_id', ''), nullif(v->>'variante', ''), v->>'nombre'
    from jsonb_array_elements(coalesce(p->'vinculos', '[]'::jsonb)) v
   where coalesce(v->>'nombre_pya', '') <> '' and coalesce(v->>'categoria_id', '') <> '' and coalesce(v->>'nombre', '') <> ''
  on conflict (nombre_pya) do nothing;

  for s in select * from jsonb_array_elements(coalesce(p->'semanas', '[]'::jsonb)) loop
    v_semanas := v_semanas || (s->>'semana')::date;
    if not exists (select 1 from pya_liquidaciones where semana = (s->>'semana')::date) then
      v_liq_nuevas := v_liq_nuevas + 1;
      insert into pya_liquidaciones (semana, desde, hasta, fecha_pago, archivo)
      values ((s->>'semana')::date, (s->>'desde')::date, (s->>'hasta')::date, (s->>'fecha_pago')::date, p->>'archivo');
    else
      update pya_liquidaciones set archivo = p->>'archivo', importado_en = now() where semana = (s->>'semana')::date;
    end if;
  end loop;

  for ped in select * from jsonb_array_elements(coalesce(p->'pedidos', '[]'::jsonb)) loop
    v_ped_total := v_ped_total + 1;
    if not exists (select 1 from pya_pedidos where nro = ped->>'nro') then v_ped_nuevos := v_ped_nuevos + 1; end if;
    insert into pya_pedidos (nro, semana, fecha, hora, estado, entrega, forma_pago, subtotal, impuesto, comision, comision_pago,
                             marketing, descuento_local, descuento_peya, reclamo, motivo_reclamo, ingreso, articulos)
    values (ped->>'nro', (ped->>'semana')::date, (ped->>'fecha')::date, ped->>'hora', ped->>'estado', ped->>'entrega', ped->>'forma_pago',
            coalesce((ped->>'subtotal')::numeric, 0), coalesce((ped->>'impuesto')::numeric, 0), coalesce((ped->>'comision')::numeric, 0),
            coalesce((ped->>'comision_pago')::numeric, 0), coalesce((ped->>'marketing')::numeric, 0),
            coalesce((ped->>'descuento_local')::numeric, 0), coalesce((ped->>'descuento_peya')::numeric, 0),
            coalesce((ped->>'reclamo')::boolean, false), ped->>'motivo_reclamo', coalesce((ped->>'ingreso')::numeric, 0), ped->>'articulos')
    on conflict (nro) do update set
      semana = excluded.semana, fecha = excluded.fecha, hora = excluded.hora, estado = excluded.estado,
      entrega = excluded.entrega, forma_pago = excluded.forma_pago, subtotal = excluded.subtotal,
      impuesto = excluded.impuesto, comision = excluded.comision, comision_pago = excluded.comision_pago,
      marketing = excluded.marketing, descuento_local = excluded.descuento_local, descuento_peya = excluded.descuento_peya,
      reclamo = excluded.reclamo, motivo_reclamo = excluded.motivo_reclamo, ingreso = excluded.ingreso, articulos = excluded.articulos;
    for it in select * from jsonb_array_elements(coalesce(ped->'items', '[]'::jsonb)) loop
      insert into pya_items (nro, orden, nombre, cantidad, precio_unitario, opciones, presentacion, perlas)
      values (ped->>'nro', (it->>'orden')::smallint, it->>'nombre', coalesce((it->>'cantidad')::int, 1),
              coalesce((it->>'precio_unitario')::int, 0), it->'opciones', nullif(it->>'presentacion', ''), coalesce((it->>'perlas')::int, 0))
      on conflict (nro, orden) do update set
        nombre = excluded.nombre, cantidad = excluded.cantidad, precio_unitario = excluded.precio_unitario,
        opciones = excluded.opciones, presentacion = excluded.presentacion, perlas = excluded.perlas;
    end loop;
  end loop;

  -- Los totales de cada semana salen de sus pedidos; las percepciones ajustadas se conservan.
  update pya_liquidaciones l
     set pedidos = a.pedidos, ventas = a.ventas, comisiones = a.comisiones, impuestos = a.impuestos,
         marketing = a.marketing, reclamos = a.reclamos, ingreso = a.ingreso, pago_total = a.ingreso + l.percepciones
    from (select semana, count(*)::int as pedidos,
                 sum(case when estado ~* '(entregad|complet)' or estado is null then subtotal else 0 end) as ventas,
                 sum(comision + comision_pago) as comisiones, sum(impuesto) as impuestos, sum(marketing) as marketing,
                 sum(case when reclamo then ingreso - (subtotal - comision - comision_pago - impuesto - marketing) else 0 end) as reclamos,
                 sum(ingreso) as ingreso
            from pya_pedidos where semana = any (v_semanas) group by semana) a
   where l.semana = a.semana;

  v_ventas := pya_a_ventas(v_semanas);
  return jsonb_build_object('liquidaciones_nuevas', v_liq_nuevas, 'pedidos_nuevos', v_ped_nuevos,
                            'pedidos_actualizados', v_ped_total - v_ped_nuevos, 'ventas_nuevas', v_ventas->'ventas_nuevas');
end;
$$;

-- Lo que de verdad acreditó PedidosYa: la diferencia con el ingreso de los pedidos son percepciones (ARBA).
create or replace function public.ajustar_pago_pya(p_semana date, p_pago_real numeric)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v numeric;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_pago_real is null or p_pago_real < 0 then raise exception 'Monto inválido'; end if;
  update pya_liquidaciones set percepciones = round(p_pago_real - ingreso, 2), pago_total = round(p_pago_real, 2)
   where semana = p_semana returning pago_total into v;
  if v is null then raise exception 'No existe esa liquidación'; end if;
  return v;
end;
$$;

-- Vincular a mano un nombre de PedidosYa con un producto de la carta (y corregir lo ya cargado).
create or replace function public.vincular_producto_pya(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v integer;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'Sólo el dueño puede vincular productos de PedidosYa';
  end if;
  if coalesce(p->>'nombre_pya', '') = '' or coalesce(p->>'categoria_id', '') = '' or coalesce(p->>'nombre', '') = '' then
    raise exception 'Falta el producto de PedidosYa o el de la carta';
  end if;
  insert into pya_productos (nombre_pya, categoria_id, producto_id, variante, nombre, a_mano)
  values (p->>'nombre_pya', p->>'categoria_id', nullif(p->>'producto_id', ''), nullif(p->>'variante', ''), p->>'nombre', true)
  on conflict (nombre_pya) do update set categoria_id = excluded.categoria_id, producto_id = excluded.producto_id,
    variante = excluded.variante, nombre = excluded.nombre, a_mano = true, actualizado_en = now();
  update pedido_items pi
     set categoria_id = p->>'categoria_id', producto_id = nullif(p->>'producto_id', ''),
         variante = nullif(p->>'variante', ''), nombre = p->>'nombre'
    from pedidos pe
   where pe.id = pi.pedido_id and pe.plataforma = 'pedidos_ya' and pi.detalle->'pedidosya'->>'nombre' = p->>'nombre_pya';
  get diagnostics v = row_count;
  return v;
end;
$$;

revoke all on function public.pya_a_ventas(date[]) from public, anon, authenticated;
revoke all on function public.importar_pedidosya(jsonb) from public, anon;
revoke all on function public.ajustar_pago_pya(date, numeric) from public, anon;
revoke all on function public.vincular_producto_pya(jsonb) from public, anon;
grant execute on function public.importar_pedidosya(jsonb) to authenticated;
grant execute on function public.ajustar_pago_pya(date, numeric) to authenticated;
grant execute on function public.vincular_producto_pya(jsonb) to authenticated;
