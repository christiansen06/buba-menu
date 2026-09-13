-- =====================================================================
-- PARTE 13 — Correcciones de costeo confirmadas por Agustín
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
-- Son tres UPDATE sobre costos_componente_waffle. Nada de schema: la parte
-- 12 dejó la tabla justamente para que corregir un dato sea una fila, no
-- una migración.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Ferrero Rocher — 1 bombón por waffle, confirmado
-- ---------------------------------------------------------------------
-- El costo ($962,78 = caja de 3 a $2.888,34) ya venía de Materia_Prima y
-- estaba bien. Lo único estimado era la cantidad. Deja de estarlo.

update public.costos_componente_waffle
set es_estimado = false,
    fuente      = 'Materia_Prima → BomBon F. Rocher 3 Uni ($2.888,34 / 3)',
    nota        = '1 bombón por waffle, confirmado por Agustín. Es el componente '
                  'más caro de la carta: pesa más que la masa, la crema y la '
                  'salsa juntas en cualquier waffle que lo lleve.',
    actualizado_en = now()
where tipo = 'topping' and componente = 'ferrero';


-- ---------------------------------------------------------------------
-- 2. Salsa de frutilla — en waffles va la Gourmet, no la casera
-- ---------------------------------------------------------------------
-- REGLA: la Salsa Frutilla Casera se usa SÓLO en bubble tea. Todo lo que
-- lleva salsa de frutilla en un waffle lleva Salsa Gourmet Frutilla.
--
-- $8,8564/g → $16,1986/g. Casi el doble.

update public.costos_componente_waffle
set costo_unitario = 16.1986,
    es_estimado    = false,
    fuente         = 'Materia_Prima → Salsa Gourmet Frutilla',
    nota           = 'En waffles va la Gourmet. La Salsa Frutilla Casera de '
                     'Preparaciones_Base ($8,86/g) se usa únicamente en bubble tea.',
    actualizado_en = now()
where tipo = 'salsa' and componente = 'frutilla';


-- ---------------------------------------------------------------------
-- 3. Mantequilla de maní — sigue en $0, pero ahora se sabe por qué
-- ---------------------------------------------------------------------
-- No estaba en el Excel porque no se compró: Agustín la hace con el maní
-- que quedó en el fondo de comercio cuando compró el local. El costo de
-- adquisición de esas ventas es efectivamente $0, así que $0 es el número
-- correcto para el margen histórico.
--
-- Queda es_estimado = true a propósito, y no porque el número esté mal.
-- Lo que falta es el COSTO DE REPOSICIÓN: el día que se termine ese maní
-- hay que comprarlo, y el Waffle Fit deja de tener el margen que muestra
-- hoy. Mientras no haya un precio de compra cargado, ese 11% de food cost
-- no se puede usar para decidir precios ni promociones.

update public.costos_componente_waffle
set costo_unitario = 0,
    es_estimado    = true,
    fuente         = 'Stock del fondo de comercio — sin costo de adquisición',
    nota           = 'Se hace con el maní que quedó del dueño anterior, así que '
                     'estas ventas costaron $0 de verdad. FALTA el costo de '
                     'reposición: cuando haya que comprar maní, cargar el precio '
                     'acá y el margen del Waffle Fit cambia. Hasta entonces su '
                     'food cost está subestimado y no sirve para fijar precios.',
    actualizado_en = now()
where tipo = 'relleno' and componente = 'mani';


-- =====================================================================
-- SOBRE LOS NOMBRES DEL EXCEL
--
-- Las fichas "Bubble Waffle Nutella" y "Bubble Waffle Mixto (receta cara)"
-- NO son productos de la carta: son simulaciones del waffle más caro que
-- se puede armar en el local. La ficha Nutella lleva frutilla, Oreo y salsa
-- de pistacho; el Waffle Nutella de la carta lleva banana y salsa de
-- chocolate y sale bastante menos.
--
-- La parte 12 ya había detectado esto comparando ingredientes y por eso
-- borró los costos por tier y calcula cada waffle desde su `detalle`. Queda
-- anotado acá como regla, no como pendiente:
--
--   EL COSTO SE EMPAREJA POR INGREDIENTES, NUNCA POR NOMBRE.
--
-- Pendiente del lado del Excel: renombrar esas dos fichas a algo que diga
-- que son ejemplos (p. ej. "EJEMPLO — Waffle máximo") para que nadie las
-- vuelva a cruzar con un producto de la carta.
-- =====================================================================


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
update public.costos_componente_waffle
set es_estimado = true,
    fuente = 'Materia_Prima → BomBon F. Rocher 3 Uni ($2.888,34 / 3) / cantidad asumida',
    nota = 'Asumo 1 bombón por waffle.'
where tipo = 'topping' and componente = 'ferrero';

update public.costos_componente_waffle
set costo_unitario = 8.8564, es_estimado = true,
    fuente = 'Preparaciones_Base → Salsa Frutilla Casera (rinde 425 g)',
    nota = 'A CONFIRMAR: hay dos, la casera y la Gourmet. Asumo la casera.'
where tipo = 'salsa' and componente = 'frutilla';

update public.costos_componente_waffle
set fuente = 'SIN DATO', nota = 'FALTA: la mantequilla de maní no está en el Excel.'
where tipo = 'relleno' and componente = 'mani';
*/
