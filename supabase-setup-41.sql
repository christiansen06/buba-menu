-- =====================================================================
-- PARTE 41 — Uber: los cargos de publicidad del reporte entran solos
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- El reporte semanal trae, además de los pedidos, filas sueltas por día con
-- "Gastos de publicidad" (Otros pagos, negativo) que Uber descuenta del pago.
-- Hasta ahora había que cargar esa diferencia a mano (parte 35). Ahora Gestión
-- las suma por pago y las manda como descuentos_extra; importar_uber las guarda.
-- Si el archivo no trae esas filas, se conserva lo que ya estaba.
-- =====================================================================

create or replace function public.importar_uber(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_liq_nuevas  integer := 0;
  v_ped_nuevos  integer := 0;
  v_ped_total   integer := 0;
  v_en_otro     integer := 0;
  v_ref_previo  text;
  v_refs        text[] := '{}';
  v_ventas      jsonb;
  l jsonb;
  ped jsonb;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'Sólo el dueño puede importar liquidaciones de Uber';
  end if;

  insert into uber_productos (nombre_uber, categoria_id, producto_id, variante, nombre, presentacion)
  select v->>'nombre_uber', v->>'categoria_id', nullif(v->>'producto_id', ''), nullif(v->>'variante', ''),
         v->>'nombre', nullif(v->>'presentacion', '')
    from jsonb_array_elements(coalesce(p->'vinculos', '[]'::jsonb)) v
   where coalesce(v->>'nombre_uber', '') <> '' and coalesce(v->>'categoria_id', '') <> '' and coalesce(v->>'nombre', '') <> ''
  on conflict (nombre_uber) do nothing;

  for l in select * from jsonb_array_elements(coalesce(p->'liquidaciones', '[]'::jsonb)) loop
    v_refs := v_refs || (l->>'ref_pago');
    if not exists (select 1 from uber_liquidaciones where ref_pago = l->>'ref_pago') then
      v_liq_nuevas := v_liq_nuevas + 1;
      insert into uber_liquidaciones
        (ref_pago, fecha_pago, desde, hasta, pedidos, ventas, promociones, tasa_mercado,
         red_entregas, impuestos, otros, cargos, pago_total, archivo, descuentos_extra)
      values (l->>'ref_pago', (l->>'fecha_pago')::date, (l->>'desde')::date, (l->>'hasta')::date,
              (l->>'pedidos')::int, (l->>'ventas')::numeric, coalesce((l->>'promociones')::numeric, 0),
              coalesce((l->>'tasa_mercado')::numeric, 0), coalesce((l->>'red_entregas')::numeric, 0),
              coalesce((l->>'impuestos')::numeric, 0), coalesce((l->>'otros')::numeric, 0),
              (l->>'cargos')::numeric, (l->>'pago_total')::numeric, p->>'archivo',
              coalesce((l->>'descuentos_extra')::numeric, 0));
    else
      update uber_liquidaciones
         set fecha_pago = coalesce((l->>'fecha_pago')::date, fecha_pago),
             archivo = p->>'archivo', importado_en = now(),
             -- Los cargos de publicidad del reporte (parte 41) pisan lo ajustado a mano; si el archivo
             -- no los trae (clave ausente), se deja lo que había.
             descuentos_extra = case when l ? 'descuentos_extra' then (l->>'descuentos_extra')::numeric else descuentos_extra end
       where ref_pago = l->>'ref_pago';
    end if;
  end loop;

  for ped in select * from jsonb_array_elements(coalesce(p->'pedidos', '[]'::jsonb)) loop
    v_ref_previo := null;
    select ref_pago into v_ref_previo from uber_pedidos where id_pedido = ped->>'id_pedido';
    if v_ref_previo is not null and v_ref_previo <> ped->>'ref_pago' then
      v_en_otro := v_en_otro + 1;
      continue;
    end if;
    v_ped_total := v_ped_total + 1;
    if v_ref_previo is null then
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
      flujo = excluded.flujo, fecha = excluded.fecha, hora = excluded.hora,
      estado = excluded.estado, medio_pago = excluded.medio_pago, entrega = excluded.entrega,
      ventas = excluded.ventas, iva = excluded.iva, promociones = excluded.promociones,
      total_ajustado = excluded.total_ajustado, tasa_mercado = excluded.tasa_mercado,
      red_entregas = excluded.red_entregas, impuesto_red = excluded.impuesto_red, otros = excluded.otros,
      cobrado_efectivo = excluded.cobrado_efectivo, pago_total = excluded.pago_total,
      fecha_pago = excluded.fecha_pago;

    insert into uber_items (id_pedido, orden, nombre, cantidad, precio_unitario, ventas)
    select ped->>'id_pedido', (i->>'orden')::smallint, i->>'nombre',
           coalesce((i->>'cantidad')::numeric, 1), coalesce((i->>'precio_unitario')::numeric, 0),
           coalesce((i->>'ventas')::numeric, 0)
      from jsonb_array_elements(coalesce(ped->'items', '[]'::jsonb)) i
    on conflict (id_pedido, orden) do update set
      nombre = excluded.nombre, cantidad = excluded.cantidad,
      precio_unitario = excluded.precio_unitario, ventas = excluded.ventas;
  end loop;

  -- descuentos_extra (parte 35): marketing y otros cargos que Uber descuenta del
  -- pago y no vienen en el archivo. Se suman a los totales de cada pago.
  update uber_liquidaciones l
     set pedidos = a.pedidos, ventas = a.ventas, promociones = a.promociones,
         tasa_mercado = a.tasa_mercado, red_entregas = a.red_entregas, impuestos = a.impuestos,
         otros = a.otros + l.descuentos_extra, cargos = a.cargos + l.descuentos_extra,
         pago_total = a.pago_total + l.descuentos_extra,
         desde = a.desde, hasta = a.hasta
    from (select ref_pago, count(*)::int as pedidos, sum(ventas) as ventas, sum(promociones) as promociones,
                 sum(tasa_mercado) as tasa_mercado, sum(red_entregas) as red_entregas,
                 sum(impuesto_red) as impuestos, sum(otros) as otros,
                 sum(pago_total - total_ajustado) as cargos, sum(pago_total) as pago_total,
                 min(fecha) as desde, max(fecha) as hasta
            from uber_pedidos where ref_pago = any (v_refs) group by ref_pago) a
   where l.ref_pago = a.ref_pago;

  v_ventas := uber_a_ventas(v_refs);

  return jsonb_build_object(
    'liquidaciones_nuevas', v_liq_nuevas,
    'pedidos_nuevos', v_ped_nuevos,
    'pedidos_actualizados', v_ped_total - v_ped_nuevos,
    'pedidos_en_otro_pago', v_en_otro,
    'ventas_nuevas', v_ventas->'ventas_nuevas',
    'reemplazados', v_ventas->'reemplazados');
end;
$function$;
