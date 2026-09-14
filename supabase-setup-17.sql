-- =====================================================================
-- PARTE 17 — ENTREGA 2 (primera parte): lo que el panel puede hacer
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
-- El panel de pedidos vive en el iPad, logueado UNA vez con el usuario del
-- dueño. Los empleados lo usan así, ya logueado. Eso plantea la pregunta
-- de fondo: ¿qué puede hacer un iPad logueado?
--
-- Respuesta: SÓLO lo que hacen estas cuatro funciones. La parte 16 le había
-- dado al dueño una política de UPDATE genérica sobre pedidos; acá se saca.
-- Una sesión del dueño en el iPad ya no puede cambiar totales ni fechas ni
-- nada: puede cancelar (con PIN), deshacer, y anotar con qué se cobró.
--
-- Las funciones son SECURITY DEFINER (corren como el dueño de la base, sin
-- RLS) y por eso cada una empieza verificando que quien llama sea el dueño.
-- Y como las funciones definer son ejecutables por PUBLIC por defecto, se
-- revoca explícitamente: anon no puede ni intentarlo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. El PIN
-- ---------------------------------------------------------------------
-- Cuatro dígitos, guardado como hash bcrypt (pgcrypto ya está en el
-- proyecto, en el schema extensions). Ninguna política: nadie lee esta
-- tabla por la API. Sólo las funciones de abajo, que corren como definer.
--
-- Para qué sirve el PIN, y para qué no: frena que alguien que agarra el
-- iPad del mostrador cancele un pedido por accidente o por gracia. No es
-- una defensa contra alguien que se roba la sesión — para eso ya está el
-- login, y las funciones sólo aceptan al dueño.

create table if not exists public.panel_pin (
  id             smallint primary key default 1 check (id = 1),
  hash           text not null,
  actualizado_en timestamptz not null default now()
);

alter table public.panel_pin enable row level security;
-- (sin políticas a propósito)


-- ---------------------------------------------------------------------
-- 2. Las funciones
-- ---------------------------------------------------------------------

-- ¿Hay PIN definido? El panel lo pregunta al entrar: si no hay, pide
-- definirlo antes de dejar cancelar nada.
create or replace function public.hay_pin_panel()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return exists (select 1 from public.panel_pin where id = 1);
end;
$$;

-- Definir o cambiar el PIN. Si ya hay uno, hay que mandar el actual:
-- así un empleado con el iPad no puede cambiarlo sin saberlo.
create or replace function public.establecer_pin_panel(p_pin text, p_pin_actual text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN son 4 números';
  end if;

  select hash into v_hash from public.panel_pin where id = 1;
  if v_hash is not null
     and (p_pin_actual is null or extensions.crypt(p_pin_actual, v_hash) <> v_hash) then
    raise exception 'El PIN actual no es correcto';
  end if;

  insert into public.panel_pin (id, hash)
  values (1, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (id) do update
    set hash = excluded.hash, actualizado_en = now();
end;
$$;

-- Cancelar. Es la única transición manual del estado (parte 16) y la única
-- acción del panel que pide PIN. El trigger de la parte 16 sella
-- cancelado_en solo. Nada se borra.
create or replace function public.cancelar_pedido(p_id uuid, p_pin text, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select hash into v_hash from public.panel_pin where id = 1;
  if v_hash is null then
    raise exception 'Todavía no hay un PIN definido';
  end if;
  if p_pin is null or extensions.crypt(p_pin, v_hash) <> v_hash then
    raise exception 'PIN incorrecto';
  end if;

  update public.pedidos
  set estado = 'cancelado',
      motivo_cancelacion = nullif(btrim(p_motivo), '')
  where id = p_id;

  if not found then
    raise exception 'No existe ese pedido';
  end if;
end;
$$;

-- Deshacer una cancelación. Sin PIN: deshacer tiene que ser sin fricción,
-- porque el caso típico es "me equivoqué de pedido" y hay que arreglarlo ya.
-- El trigger limpia cancelado_en y el motivo.
create or replace function public.reactivar_pedido(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.pedidos set estado = 'confirmado' where id = p_id;

  if not found then
    raise exception 'No existe ese pedido';
  end if;
end;
$$;

-- Con qué se cobró de verdad (parte 16, 1b). NULL borra la marca.
create or replace function public.registrar_cobro(p_id uuid, p_medio text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_medio is not null and p_medio not in ('efectivo', 'transferencia', 'debito') then
    raise exception 'Medio de pago inválido';
  end if;

  update public.pedidos set medio_pago_cobro = p_medio where id = p_id;

  if not found then
    raise exception 'No existe ese pedido';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Quién puede llamarlas
-- ---------------------------------------------------------------------
-- SECURITY DEFINER + EXECUTE para PUBLIC por defecto = cualquiera con la
-- clave publishable podría invocarlas (fallarían en el chequeo del dueño,
-- pero no tienen por qué llegar hasta ahí). Se revoca y se da sólo a
-- authenticated.

revoke execute on function public.hay_pin_panel()                       from public, anon;
revoke execute on function public.establecer_pin_panel(text, text)      from public, anon;
revoke execute on function public.cancelar_pedido(uuid, text, text)     from public, anon;
revoke execute on function public.reactivar_pedido(uuid)                from public, anon;
revoke execute on function public.registrar_cobro(uuid, text)           from public, anon;

grant execute on function public.hay_pin_panel()                        to authenticated;
grant execute on function public.establecer_pin_panel(text, text)       to authenticated;
grant execute on function public.cancelar_pedido(uuid, text, text)      to authenticated;
grant execute on function public.reactivar_pedido(uuid)                 to authenticated;
grant execute on function public.registrar_cobro(uuid, text)            to authenticated;


-- ---------------------------------------------------------------------
-- 4. Se va la política genérica de UPDATE de la parte 16
-- ---------------------------------------------------------------------
-- Con las funciones de arriba, una sesión del dueño en el iPad no necesita
-- —y no debe— poder modificar pedidos a mano. Lo que el panel puede hacer
-- está enumerado en este archivo y en ningún otro lado.

drop policy if exists "el dueño modifica pedidos" on public.pedidos;


-- =====================================================================
-- VERIFICACIÓN
--
-- Todo en transacciones que se revierten, simulando la sesión del dueño
-- con  set local role authenticated  +  request.jwt.claims:
--
-- 1. Sin PIN: cancelar_pedido → "Todavía no hay un PIN definido".
-- 2. establecer_pin_panel('12ab') → "El PIN son 4 números".
-- 3. establecer_pin_panel('1234') → ok; hay_pin_panel() → true.
-- 4. cancelar_pedido(id, '0000') → "PIN incorrecto"; el pedido sigue
--    confirmado.
-- 5. cancelar_pedido(id, '1234', 'prueba') → cancelado, con cancelado_en
--    y motivo; desaparece de ventas.
-- 6. reactivar_pedido(id) → confirmado, cancelado_en y motivo en NULL.
-- 7. registrar_cobro(id, 'debito') → medio_pago_cobro = 'debito';
--    registrar_cobro(id, 'cheque') → "Medio de pago inválido".
-- 8. establecer_pin_panel('5678') sin el actual → "El PIN actual no es
--    correcto"; con '1234' → ok.
-- 9. Como anon: cada función → permission denied (ni llega al chequeo).
-- 10. Como authenticated con OTRO uid → "No autorizado".
-- 11. Un update directo a pedidos como el dueño → 0 filas (ya no hay
--     política).
-- =====================================================================


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
drop function if exists public.registrar_cobro(uuid, text);
drop function if exists public.reactivar_pedido(uuid);
drop function if exists public.cancelar_pedido(uuid, text, text);
drop function if exists public.establecer_pin_panel(text, text);
drop function if exists public.hay_pin_panel();
drop table if exists public.panel_pin;

-- y, si se quiere volver al modelo de la parte 16:
create policy "el dueño modifica pedidos"
  on public.pedidos for update
  to authenticated
  using      (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid)
  with check (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);
*/
