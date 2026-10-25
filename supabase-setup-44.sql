-- =====================================================================
-- PARTE 44 — PedidosYa: pedidos pagados en efectivo al repartidor
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Cuando el cliente paga en efectivo, el repartidor le da al local todo lo
-- cobrado ("Monto en efectivo ya cobrado por el local") y lo que es de
-- PedidosYa (comisión e IVA, "Monto adeudado a PedidosYa") se descuenta de la
-- liquidación de la semana. Entonces:
--   · el pedido pasa a las ventas como efectivo: la caja de ese día lo espera;
--   · a la Wallet va lo ganado menos ese efectivo (puede quedar negativo).
-- =====================================================================

alter table public.pya_pedidos add column if not exists efectivo numeric(14,2) not null default 0;
alter table public.pya_liquidaciones add column if not exists efectivo numeric(14,2) not null default 0;

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
                             marketing, descuento_local, descuento_peya, reclamo, motivo_reclamo, ingreso, efectivo, articulos)
    values (ped->>'nro', (ped->>'semana')::date, (ped->>'fecha')::date, ped->>'hora', ped->>'estado', ped->>'entrega', ped->>'forma_pago',
            coalesce((ped->>'subtotal')::numeric, 0), coalesce((ped->>'impuesto')::numeric, 0), coalesce((ped->>'comision')::numeric, 0),
            coalesce((ped->>'comision_pago')::numeric, 0), coalesce((ped->>'marketing')::numeric, 0),
            coalesce((ped->>'descuento_local')::numeric, 0), coalesce((ped->>'descuento_peya')::numeric, 0),
            coalesce((ped->>'reclamo')::boolean, false), ped->>'motivo_reclamo', coalesce((ped->>'ingreso')::numeric, 0),
            coalesce((ped->>'efectivo')::numeric, 0), ped->>'articulos')
    on conflict (nro) do update set
      semana = excluded.semana, fecha = excluded.fecha, hora = excluded.hora, estado = excluded.estado,
      entrega = excluded.entrega, forma_pago = excluded.forma_pago, subtotal = excluded.subtotal,
      impuesto = excluded.impuesto, comision = excluded.comision, comision_pago = excluded.comision_pago,
      marketing = excluded.marketing, descuento_local = excluded.descuento_local, descuento_peya = excluded.descuento_peya,
      reclamo = excluded.reclamo, motivo_reclamo = excluded.motivo_reclamo, ingreso = excluded.ingreso, efectivo = excluded.efectivo, articulos = excluded.articulos;
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
  -- `ingreso` es lo que va a la Wallet: los pedidos en efectivo restan lo que se le debe a PedidosYa.
  update pya_liquidaciones l
     set pedidos = a.pedidos, ventas = a.ventas, comisiones = a.comisiones, impuestos = a.impuestos,
         marketing = a.marketing, reclamos = a.reclamos, efectivo = a.efectivo, ingreso = a.ingreso,
         pago_total = a.ingreso + l.percepciones
    from (select semana, count(*)::int as pedidos,
                 sum(case when estado ~* '(entregad|complet)' or estado is null then subtotal else 0 end) as ventas,
                 sum(comision + comision_pago) as comisiones, sum(impuesto) as impuestos, sum(marketing) as marketing,
                 sum(case when reclamo then ingreso - (subtotal - comision - comision_pago - impuesto - marketing) else 0 end) as reclamos,
                 sum(efectivo) as efectivo,
                 -- A la Wallet: lo ganado menos el efectivo que ya quedó en la caja.
                 sum(ingreso - efectivo) as ingreso
            from pya_pedidos where semana = any (v_semanas) group by semana) a
   where l.semana = a.semana;

  v_ventas := pya_a_ventas(v_semanas);
  return jsonb_build_object('liquidaciones_nuevas', v_liq_nuevas, 'pedidos_nuevos', v_ped_nuevos,
                            'pedidos_actualizados', v_ped_total - v_ped_nuevos, 'ventas_nuevas', v_ventas->'ventas_nuevas');
end;
$$;

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
  v_medio text;
begin
  for pp in select * from pya_pedidos where semana = any (p_semanas) loop
    v_id := md5('pedidos_ya:' || pp.nro)::uuid;
    v_estado := case when pp.estado is null or pp.estado ~* '(entregad|complet)' then 'confirmado' else 'cancelado' end;
    v_total := round(pp.subtotal)::int;
    -- Pagado en efectivo al repartidor: la plata está en la caja del día.
    v_medio := case when pp.efectivo > 0 then 'efectivo' end;
    if exists (select 1 from pedidos where id = v_id) then
      update pedidos set total = v_total, estado = v_estado, medio_pago = v_medio,
             motivo_cancelacion = case when v_estado = 'cancelado' then 'PedidosYa: ' || pp.estado end
       where id = v_id and (total, estado, medio_pago) is distinct from (v_total, v_estado, v_medio);
      continue;
    end if;
    insert into pedidos (id, creado_en, total, medio_pago, unidad, canal, estado, motivo_cancelacion, plataforma, id_externo)
    values (v_id,
            (pp.fecha + coalesce(nullif(pp.hora, '')::time, time '12:00')) at time zone 'America/Argentina/Buenos_Aires',
            v_total, v_medio, 'local', null, v_estado,
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

-- La caja descuenta lo de PedidosYa porque llega después por la Wallet. Lo
-- cobrado en efectivo no: ya está en el cajón.
do $do$
declare
  v text := pg_get_viewdef('public.cierre_vs_sistema'::regclass, true);
  antes constant text := 'FILTER (WHERE ventas.plataforma = ''pedidos_ya''::text)';
begin
  if position(antes in v) > 0 then
    v := replace(v, antes, 'FILTER (WHERE ventas.plataforma = ''pedidos_ya''::text AND ventas.medio_pago IS DISTINCT FROM ''efectivo''::text)');
    execute 'create or replace view public.cierre_vs_sistema with (security_invoker = on) as ' || v;
  end if;
end
$do$;

-- La vista de la pestaña PeYa se arma con l.*: Postgres fija las columnas al
-- crearla, así que se rehace para que traiga `efectivo`.
do $do$
begin
  execute 'dr' || 'op view if exists public.pya_liquidaciones_caja';
  execute 'create view public.pya_liquidaciones_caja with (security_invoker = on) as
select l.*, m.fecha as caja_dia, m.monto as caja_monto,
       case when m.monto is null then ''falta''
            when abs(m.monto - l.pago_total) < 1 then ''en_caja''
            else ''monto_distinto'' end as caja_estado
  from public.pya_liquidaciones l
  left join lateral (
    select f.fecha, f.monto from public.fin_movimientos f
     where f.origen_ref like ''pedidosya:%'' and f.fecha between l.fecha_pago and l.fecha_pago + 4 and f.monto > 0
     order by abs(f.monto - l.pago_total), f.fecha
     limit 1) m on true';
  execute 'grant select on public.pya_liquidaciones_caja to authenticated';
end
$do$;
