-- =====================================================================
-- PARTE 34 — Conteo de la plata, ajustes y lo que BüBa le debe a Agustín
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
--
--   · fin_conteos     cada vez que Agustín cuenta toda la plata del negocio
--                     (fecha, monto, nota). Gestión lo compara con el saldo
--                     calculado a esa fecha y muestra la diferencia.
--   · saldo_al(fecha) el saldo calculado al cierre de un día (mismo criterio
--                     que el saldo acumulado del Resumen).
--   · categorías "Ajuste por conteo" (sobrante y faltante): llevan el saldo a lo
--     contado sin tocar la ganancia del negocio (grupo financiero, como los
--     préstamos: no es venta ni gasto).
--   · fin_capital     lo que Agustín puso de su bolsillo en BüBa (aportes) y lo
--                     que BüBa le devolvió (devoluciones). Es un registro aparte:
--                     NO mueve el saldo del negocio. "BüBa te debe" = aportes −
--                     devoluciones.
--
-- Además se recategorizan como ajustes el "Ajuste Conciliacion Caja" del 23/07
-- y el "Dinero faltante" del 30/09 (no eran venta ni mercadería).
-- =====================================================================

insert into public.fin_categorias (id, tipo, nombre, grupo, orden) values
  ('ajuste_mas', 'ingreso', 'Ajuste por conteo (sobrante)', 'financiero', 95),
  ('ajuste_menos', 'egreso', 'Ajuste por conteo (faltante)', 'financiero', 95)
on conflict (id) do nothing;

update public.fin_movimientos set categoria_id = 'ajuste_mas', revisar = false, actualizado_en = now()
 where descripcion ilike 'ajuste concilia%' and tipo = 'ingreso' and categoria_id <> 'ajuste_mas';
update public.fin_movimientos set categoria_id = 'ajuste_menos', revisar = false, actualizado_en = now()
 where descripcion ilike 'dinero faltante%' and tipo = 'egreso' and categoria_id <> 'ajuste_menos';


create table if not exists public.fin_conteos (
  id         bigserial primary key,
  fecha      date not null,
  monto      numeric(14, 2) not null check (monto >= 0),
  notas      text,
  creado_en  timestamptz not null default now()
);
alter table public.fin_conteos enable row level security;

create table if not exists public.fin_capital (
  id          bigserial primary key,
  fecha       date not null,
  tipo        text not null check (tipo in ('aporte', 'devolucion')),
  descripcion text not null,
  monto       numeric(14, 2) not null check (monto > 0),
  monto_usd   numeric(12, 2),
  notas       text,
  creado_en   timestamptz not null default now()
);
alter table public.fin_capital enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'fin_conteos' and policyname = 'el dueño') then
    create policy "el dueño" on public.fin_conteos for all to authenticated
      using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
      with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'fin_capital' and policyname = 'el dueño') then
    create policy "el dueño" on public.fin_capital for all to authenticated
      using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
      with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
  end if;
end $$;

revoke all on public.fin_conteos, public.fin_capital from anon;
revoke all on sequence public.fin_conteos_id_seq, public.fin_capital_id_seq from anon;
grant select, insert, update on public.fin_conteos, public.fin_capital to authenticated;
grant usage on sequence public.fin_conteos_id_seq, public.fin_capital_id_seq to authenticated;


-- Saldo calculado al cierre de un día. security invoker: respeta el RLS (sólo el dueño ve algo).
create or replace function public.saldo_al(p_fecha date)
returns numeric
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(sum(case mv.tipo when 'ingreso' then mv.monto else -mv.monto end), 0)
    from public.fin_movimientos mv
    join public.fin_categorias c on c.id = mv.categoria_id
   where c.grupo <> 'saldo' and mv.fecha <= p_fecha;
$$;
revoke all on function public.saldo_al(date) from public, anon;
grant execute on function public.saldo_al(date) to authenticated;


-- Lo que Agustín puso en BüBa (del Excel: columna "Inversión" que no suma al saldo).
insert into public.fin_capital (fecha, tipo, descripcion, monto, monto_usd, notas)
select * from (values
  (date '2024-10-26', 'aporte', 'Inversión inicial 2024 (food truck y armado)', 7403457.55, null::numeric, 'Del Excel: "Inversión Inicial 2024"'),
  (date '2026-05-04', 'aporte', 'Inversión local: fondo de comercio', 14300000.00, 10000.00, 'Del Excel: "Inversión Local" (USD 10.000)')
) v(fecha, tipo, descripcion, monto, monto_usd, notas)
where not exists (select 1 from public.fin_capital);
