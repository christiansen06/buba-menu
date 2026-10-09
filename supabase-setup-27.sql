-- =====================================================================
-- PARTE 27 — Las ventas de Uber Eats entran solas desde el reporte
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
-- Hasta acá, un pedido de Uber se cargaba a mano en el mostrador (medio
-- "uber"), a precio de carta y cuando alguien se acordaba: en la semana del
-- 28/09 entraron 6 de 9, por $117.000 de los $203.000 reales.
--
-- Ahora el mostrador ya no los carga. Cuando BüBa Gestión importa el
-- reporte semanal de Uber (parte 26), cada pedido de Uber se agrega a
-- `pedidos` como una venta más:
--   · plataforma = 'uber_eats', id_externo = ID del pedido de Uber
--   · creado_en = día y hora reales del pedido
--   · medio_pago = 'uber' → como antes, nunca se espera en la caja del día
--   · total = lo que cobró Uber después de promociones (el precio real)
--   · un ítem por producto, vinculado al de la carta (uber_productos), con
--     su parte del total (si hubo promoción se reparte entre los productos)
-- Así cuentan en "lo más vendido" y en todos los reportes, que leen de
-- `ventas` / `ventas_items`, sin tocar ninguno.
--
-- Los pedidos de Uber cargados a mano de las semanas que trae el reporte
-- quedan "cancelado" con motivo "Reemplazado por el reporte de Uber": no
-- se borran, pero dejan de contar (si no, se contarían dos veces).
--
-- Nada de esto se borra: no hay DELETE ni DROP en esta parte.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. De qué plataforma vino un pedido
-- ---------------------------------------------------------------------
alter table public.pedidos
  add column if not exists plataforma text,
  add column if not exists id_externo text;

alter table public.pedidos add constraint pedidos_plataforma_valida
  check (plataforma is null or plataforma in ('uber_eats', 'pedidos_ya'));

create unique index if not exists pedidos_plataforma_id_externo
  on public.pedidos (plataforma, id_externo) where id_externo is not null;

-- `ventas` gana las dos columnas al final (una vista sólo admite agregar).
create or replace view public.ventas
with (security_invoker = on) as
select id, creado_en, total, medio_pago, unidad, canal, estado, cancelado_en, motivo_cancelacion,
       medio_pago_cobro, comprobante_id, punto_venta, numero_comprobante, cae, cae_vencimiento,
       plataforma, id_externo
  from public.pedidos
 where estado <> 'cancelado';


-- ---------------------------------------------------------------------
-- 2. Producto de Uber → producto de la carta
-- ---------------------------------------------------------------------
-- Gestión sugiere los que reconoce por el nombre ("Waffle Listo - Frutilla"
-- → waffles/frutilla) y el resto se elige a mano una vez.
create table if not exists public.uber_productos (
  nombre_uber    text primary key,
  categoria_id   text not null,
  producto_id    text,
  variante       text,
  nombre         text not null,       -- cómo se ve en las ventas
  presentacion   text,                -- bubble tea: 'frio' / 'caliente'
  a_mano         boolean not null default false,
  actualizado_en timestamptz not null default now()
);

alter table public.uber_productos enable row level security;
create policy "el dueño lee" on public.uber_productos for select to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
create policy "el dueño modifica" on public.uber_productos for all to authenticated using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid) with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
revoke all on public.uber_productos from anon;

-- Los productos de Uber que todavía no tienen su par en la carta.
create or replace view public.uber_sin_vincular
with (security_invoker = on) as
select i.nombre, sum(i.cantidad) as unidades, max(p.fecha) as ultima_vez
  from public.uber_items i
  join public.uber_pedidos p using (id_pedido)
  left join public.uber_productos m on m.nombre_uber = i.nombre
 where m.nombre_uber is null
 group by i.nombre;
revoke all on public.uber_sin_vincular from anon;


-- ---------------------------------------------------------------------
-- 3. Pedidos de Uber → ventas (interna: la llama importar_uber)
-- ---------------------------------------------------------------------
create or replace function public.uber_a_ventas(p_refs text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  up record;
  v_id uuid;
  v_factor numeric;
  v_estado text;
  v_resto integer;
  v_nuevas integer := 0;
  v_reemplazados integer := 0;
begin
  for up in select * from uber_pedidos where ref_pago = any (p_refs) loop
    -- Id fijo por pedido de Uber: reimportar nunca lo duplica.
    v_id := md5('uber_eats:' || up.id_pedido)::uuid;
    v_estado := case when up.estado is null or up.estado ilike 'complet%' then 'confirmado' else 'cancelado' end;

    if exists (select 1 from pedidos where id = v_id) then
      update pedidos
         set total = round(up.total_ajustado)::int,
             estado = v_estado,
             motivo_cancelacion = case when v_estado = 'cancelado' then 'Uber: ' || up.estado end
       where id = v_id
         and (total, estado) is distinct from (round(up.total_ajustado)::int, v_estado);
      continue;
    end if;

    insert into pedidos (id, creado_en, total, medio_pago, unidad, canal, estado, motivo_cancelacion, plataforma, id_externo)
    values (v_id,
            (up.fecha + coalesce(nullif(up.hora, '')::time, time '12:00')) at time zone 'America/Argentina/Buenos_Aires',
            round(up.total_ajustado)::int, 'uber', 'local', null, v_estado,
            case when v_estado = 'cancelado' then 'Uber: ' || up.estado end,
            'uber_eats', up.id_pedido);

    -- Con promoción, lo que se cobró de menos se reparte entre los productos.
    v_factor := case when up.ventas > 0 then up.total_ajustado / up.ventas else 1 end;

    insert into pedido_items (pedido_id, categoria_id, producto_id, nombre, variante, cantidad, precio_unitario, detalle)
    select v_id,
           coalesce(m.categoria_id, 'otros'),
           m.producto_id,
           coalesce(m.nombre, i.nombre),
           m.variante,
           greatest(1, round(i.cantidad))::int,
           round(i.ventas * v_factor / greatest(1, round(i.cantidad)))::int,
           jsonb_strip_nulls(jsonb_build_object(
             'presentacion', m.presentacion,
             'uber', jsonb_build_object('nombre', i.nombre, 'pedido', up.id_pedido, 'precio_lista', i.ventas)))
      from uber_items i
      left join uber_productos m on m.nombre_uber = i.nombre
     where i.id_pedido = up.id_pedido
     order by i.orden;

    -- El redondeo del reparto (algún peso) va al producto más caro de a uno,
    -- así los productos suman exactamente el total del pedido.
    select round(up.total_ajustado)::int - coalesce(sum(cantidad * precio_unitario), 0)::int into v_resto
      from pedido_items where pedido_id = v_id;
    if v_resto <> 0 then
      update pedido_items set precio_unitario = precio_unitario + v_resto
       where id = (select id from pedido_items where pedido_id = v_id and cantidad = 1
                    order by precio_unitario desc, id limit 1);
    end if;

    v_nuevas := v_nuevas + 1;
  end loop;

  -- Los cargados a mano en el mostrador de esas semanas (lunes a domingo).
  update pedidos p
     set estado = 'cancelado', motivo_cancelacion = 'Reemplazado por el reporte de Uber'
   where p.plataforma is null
     and p.estado = 'confirmado'
     and coalesce(p.medio_pago_cobro, p.medio_pago) = 'uber'
     and exists (
       select 1 from uber_liquidaciones l
        where l.ref_pago = any (p_refs)
          and (p.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
              between date_trunc('week', l.desde)::date and date_trunc('week', l.hasta)::date + 6);
  get diagnostics v_reemplazados = row_count;

  return jsonb_build_object('ventas_nuevas', v_nuevas, 'reemplazados', v_reemplazados);
end;
$$;

revoke all on function public.uber_a_ventas(text[]) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. importar_uber: guarda los vínculos sugeridos y pasa todo a ventas
-- ---------------------------------------------------------------------
-- Igual que en la parte 26, más:
--   · p.vinculos = [{ nombre_uber, categoria_id, producto_id, variante, nombre, presentacion }]
--     (los que Gestión reconoce; nunca pisa uno elegido a mano)
--   · al final, uber_a_ventas() con los pagos del archivo
-- (la función completa está más abajo, en "importar_uber completa")


-- ---------------------------------------------------------------------
-- 5. Vincular a mano un producto de Uber (y corregir lo ya cargado)
-- ---------------------------------------------------------------------
create or replace function public.vincular_producto_uber(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cambiados integer;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'Sólo el dueño puede vincular productos de Uber';
  end if;
  if coalesce(p->>'nombre_uber', '') = '' or coalesce(p->>'categoria_id', '') = '' or coalesce(p->>'nombre', '') = '' then
    raise exception 'Falta el producto de Uber o el de la carta';
  end if;

  insert into uber_productos (nombre_uber, categoria_id, producto_id, variante, nombre, presentacion, a_mano)
  values (p->>'nombre_uber', p->>'categoria_id', nullif(p->>'producto_id', ''), nullif(p->>'variante', ''),
          p->>'nombre', nullif(p->>'presentacion', ''), true)
  on conflict (nombre_uber) do update set
    categoria_id = excluded.categoria_id, producto_id = excluded.producto_id, variante = excluded.variante,
    nombre = excluded.nombre, presentacion = excluded.presentacion, a_mano = true, actualizado_en = now();

  -- Las ventas de Uber ya cargadas con ese producto pasan al de la carta.
  update pedido_items pi
     set categoria_id = p->>'categoria_id',
         producto_id  = nullif(p->>'producto_id', ''),
         variante     = nullif(p->>'variante', ''),
         nombre       = p->>'nombre',
         detalle      = case when nullif(p->>'presentacion', '') is null then pi.detalle - 'presentacion'
                             else jsonb_set(pi.detalle, '{presentacion}', to_jsonb(p->>'presentacion')) end
    from pedidos pe
   where pe.id = pi.pedido_id
     and pe.plataforma = 'uber_eats'
     and pi.detalle->'uber'->>'nombre' = p->>'nombre_uber';
  get diagnostics v_cambiados = row_count;
  return v_cambiados;
end;
$$;

revoke all on function public.vincular_producto_uber(jsonb) from public, anon;
grant execute on function public.vincular_producto_uber(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- importar_uber completa (reemplaza la de la parte 26)
-- ---------------------------------------------------------------------
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

  -- Vínculos que reconoce Gestión. Uno elegido a mano no se pisa.
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
      -- Valores del archivo sólo para crearla: los totales se recalculan abajo.
      insert into uber_liquidaciones
        (ref_pago, fecha_pago, desde, hasta, pedidos, ventas, promociones, tasa_mercado,
         red_entregas, impuestos, otros, cargos, pago_total, archivo)
      values (l->>'ref_pago', (l->>'fecha_pago')::date, (l->>'desde')::date, (l->>'hasta')::date,
              (l->>'pedidos')::int, (l->>'ventas')::numeric, coalesce((l->>'promociones')::numeric, 0),
              coalesce((l->>'tasa_mercado')::numeric, 0), coalesce((l->>'red_entregas')::numeric, 0),
              coalesce((l->>'impuestos')::numeric, 0), coalesce((l->>'otros')::numeric, 0),
              (l->>'cargos')::numeric, (l->>'pago_total')::numeric, p->>'archivo');
    else
      update uber_liquidaciones
         set fecha_pago = coalesce((l->>'fecha_pago')::date, fecha_pago),
             archivo = p->>'archivo', importado_en = now()
       where ref_pago = l->>'ref_pago';
    end if;
  end loop;

  for ped in select * from jsonb_array_elements(coalesce(p->'pedidos', '[]'::jsonb)) loop
    v_ref_previo := null;
    select ref_pago into v_ref_previo from uber_pedidos where id_pedido = ped->>'id_pedido';
    -- Un pedido que ya está en OTRO pago (un ajuste o reembolso posterior)
    -- no se mueve: se cuenta y se avisa, para no desarmar el pago anterior.
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

  -- Los totales de cada pago salen de TODOS sus pedidos cargados, no del
  -- archivo: un reporte que trae sólo una parte de la semana no lo achica.
  update uber_liquidaciones l
     set pedidos = a.pedidos, ventas = a.ventas, promociones = a.promociones,
         tasa_mercado = a.tasa_mercado, red_entregas = a.red_entregas, impuestos = a.impuestos,
         otros = a.otros, cargos = a.cargos, pago_total = a.pago_total,
         desde = a.desde, hasta = a.hasta
    from (select ref_pago, count(*)::int as pedidos, sum(ventas) as ventas, sum(promociones) as promociones,
                 sum(tasa_mercado) as tasa_mercado, sum(red_entregas) as red_entregas,
                 sum(impuesto_red) as impuestos, sum(otros) as otros,
                 sum(pago_total - total_ajustado) as cargos, sum(pago_total) as pago_total,
                 min(fecha) as desde, max(fecha) as hasta
            from uber_pedidos where ref_pago = any (v_refs) group by ref_pago) a
   where l.ref_pago = a.ref_pago;

  -- Y las ventas: cada pedido de Uber pasa a `pedidos` (parte 27).
  v_ventas := uber_a_ventas(v_refs);

  return jsonb_build_object(
    'liquidaciones_nuevas', v_liq_nuevas,
    'pedidos_nuevos', v_ped_nuevos,
    'pedidos_actualizados', v_ped_total - v_ped_nuevos,
    'pedidos_en_otro_pago', v_en_otro,
    'ventas_nuevas', v_ventas->'ventas_nuevas',
    'reemplazados', v_ventas->'reemplazados');
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Lo que ya estaba importado: vínculos y ventas
-- ---------------------------------------------------------------------
insert into public.uber_productos (nombre_uber, categoria_id, producto_id, variante, nombre, presentacion) values
  ('BüBa Flan (Grande 20 oz)',              'bubble-tea',   'flan',            'large',  'BüBa Flan (Grande)',          'frio'),
  ('BüBa Flan (Mediano 16 oz)',             'bubble-tea',   'flan',            'medium', 'BüBa Flan (Mediano)',         'frio'),
  ('BüBa Frutilla (Mediano 16 oz)',         'bubble-tea',   'frutilla',        'medium', 'BüBa Frutilla (Mediano)',     'frio'),
  ('BüBa Matcha (Grande 20 oz)',            'bubble-tea',   'matcha',          'large',  'BüBa Matcha (Grande)',        'frio'),
  ('BüBa Oreo (Grande 20 oz)',              'bubble-tea',   'oreo',            'large',  'BüBa Oreo (Grande)',          'frio'),
  ('BüBa Oreo (Mediano 16 oz)',             'bubble-tea',   'oreo',            'medium', 'BüBa Oreo (Mediano)',         'frio'),
  ('BüBa Taro (Grande 20 oz)',              'bubble-tea',   'taro',            'large',  'BüBa Taro (Grande)',          'frio'),
  ('Frappé Frutilla (Mediano 16 oz)',       'frappuccinos', 'frutilla-frappe', 'medium', 'Frappé Frutilla (Mediano)',   null),
  ('Frappé Frutilla (Grande 20 oz)',        'frappuccinos', 'frutilla-frappe', 'large',  'Frappé Frutilla (Grande)',    null),
  ('Frappé Oreo (Grande 20 oz)',            'frappuccinos', 'oreo-frappe',     'large',  'Frappé Oreo (Grande)',        null),
  ('Waffle Listo - Frutilla',               'waffles',      'frutilla',        'simple', 'Waffle Frutilla',             null),
  ('Waffle Listo - Nutella',                'waffles',      'nutella',         'mixto',  'Waffle Nutella',              null),
  ('Waffle Arma El Tuyo (Simple)',          'waffles',      'armado',          'simple', 'Waffle armado (Simple)',      null),
  ('Medio Tostado de Jamón y Queso',        'tostados',     'tostado-medio',   'medium', 'Medio Tostado',               null),
  ('Medialuna de Jamón y Queso',            'medialunas',   'jyq',             null,     'Medialuna de Jamón y Queso',  null),
  ('Cookie Chips de Chocolate',             'pasteleria',   'cookie-chips',    null,     'Cookie Chips de Chocolate',   null),
  ('Budín de Chips de Chocolate (Porción)', 'pasteleria',   'budin-chips',     null,     'Budín de Chips (porción)',    null),
  ('Budín de Limón (Porción)',              'pasteleria',   'budin-limon',     null,     'Budín de Limón (porción)',    null),
  ('Bolsita de Scones de Queso (x4)',       'pasteleria',   'scones-bolsa',    null,     'Bolsita de Scones de Queso (x4)', null)
on conflict (nombre_uber) do nothing;

select public.uber_a_ventas(array(select ref_pago from public.uber_liquidaciones));


-- Verificación:
--   select plataforma, count(*), sum(total) from ventas where medio_pago = 'uber' group by 1;
--   select * from uber_sin_vincular;                    -- vacía
--   select count(*) from pedidos where motivo_cancelacion = 'Reemplazado por el reporte de Uber';

/* Reversa (sin borrar ventas reales):
update public.pedidos set estado = 'confirmado' where motivo_cancelacion = 'Reemplazado por el reporte de Uber';
update public.pedidos set estado = 'cancelado', motivo_cancelacion = 'Reversa parte 27' where plataforma = 'uber_eats';
-- y volver importar_uber a la versión de la parte 26
*/
