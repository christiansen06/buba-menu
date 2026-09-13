-- =====================================================================
-- PARTE 10 — Cerrar la lectura pública de parametros_negocio
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
-- =====================================================================


-- ---------------------------------------------------------------------
-- EL PROBLEMA
-- ---------------------------------------------------------------------
-- La parte 9 creó parametros_negocio con esta política:
--
--     create policy "leer parametros"
--       on public.parametros_negocio for select
--       to anon, authenticated
--       using (true);
--
-- Le copié el criterio a disponibilidad e insumos, que SÍ tienen que ser
-- públicas porque el menú necesita mostrar qué está agotado sin login.
-- parametros_negocio no: guarda datos de gestión y ningún componente del
-- front la lee (verificado con grep sobre src/).
--
-- Resultado: cualquiera con la clave publishable —que viaja dentro de la
-- app, o sea en el celular de cada cliente que escanea el QR— podía leer
--
--     sueldo_encargado_mercado = 900000
--
-- No es una fuga de ventas ni de datos de clientes, pero es exactamente el
-- modo de falla que importa: una tabla nueva creada sin pensar quién tiene
-- que poder leerla. Y esta tabla es justo donde van a vivir los parámetros
-- de rentabilidad.
--
-- REGLA PARA LO QUE VIENE: toda tabla nueva se crea con RLS activado y con
-- la política restrictiva en la MISMA migración. Lectura pública sólo para
-- lo que el menú necesita mostrarle a un cliente sin login: hoy, nada más
-- que disponibilidad e insumos.

drop policy if exists "leer parametros" on public.parametros_negocio;

create policy "el dueño lee parametros"
  on public.parametros_negocio for select
  to authenticated
  using (auth.uid() = 'ed9986b4-4135-4da3-9fc2-0eb46a7e1e11'::uuid);

-- La política de escritura de la parte 9 ya era correcta y no se toca:
--   "el dueño modifica parametros"  for all  to authenticated
--   using/with check (auth.uid() = 'ed9986b4-...')


-- =====================================================================
-- PARA VOLVER ATRÁS
--
-- (No hay motivo para hacerlo: nada del menú lee esta tabla.)
-- =====================================================================
/*
drop policy if exists "el dueño lee parametros" on public.parametros_negocio;
create policy "leer parametros"
  on public.parametros_negocio for select
  to anon, authenticated
  using (true);
*/
