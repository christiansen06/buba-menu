-- =====================================================================
-- PARTE 15 — Banana confirmada
--
-- Correr en el editor SQL de Supabase, como las partes anteriores.
-- No toca ninguna venta. Bloque de reversa al final.
--
-- Un UPDATE. 60 g (media banana) era un supuesto mío y Agustín lo confirmó,
-- así que deja de estar marcado como estimado. El costo ($2,90/g) ya venía
-- de Materia_Prima y estaba bien.
--
-- Con esto cierra el topping estimado que más pesaba: 73 ventas, el tercero
-- más usado después de frutilla y Oreo.
-- =====================================================================

update public.costos_componente_waffle
set es_estimado = false,
    fuente      = 'Materia_Prima → Banana',
    nota        = '60 g (media banana) confirmado por Agustín.',
    actualizado_en = now()
where tipo = 'topping' and componente = 'banana';


-- =====================================================================
-- DÓNDE QUEDÓ EL COSTEO DEL WAFFLE
--
-- De los 22 componentes, 16 tienen costo y gramaje confirmados. Los 6 que
-- siguen estimados pesan $15.446 sobre $572.339 de costo total de waffles:
-- el 2,7%.
--
--   nutella_extra  20 g  — el plus de $500 de la carta. El único estimado
--                          que importa de verdad: a 20 g ya cuesta $433, o
--                          sea que se vende casi sin margen. Si en la
--                          práctica va más chorro, da pérdida.
--   mani           $0    — stock del fondo de comercio. El número es
--                          correcto para lo vendido; falta el costo de
--                          REPOSICIÓN (ver parte 13).
--   pepito         30 g  ┐
--   chocolinas     30 g  │  19 ventas entre los cuatro. Ruido.
--   durazno        40 g  │
--   coffler        25 g  ┘
--
-- O sea: el costeo del waffle ya se puede mirar para tomar decisiones. Lo
-- único que conviene medir de verdad es cuánta salsa de Nutella se pone en
-- el extra, porque ahí puede haber una venta que da pérdida.
-- =====================================================================


-- =====================================================================
-- PARA VOLVER ATRÁS
-- =====================================================================
/*
update public.costos_componente_waffle
set es_estimado = true,
    fuente = 'Materia_Prima → Banana (costo OK) / gramaje asumido',
    nota   = 'No hay ficha con banana. 60 g ≈ media banana. Impacto $174.'
where tipo = 'topping' and componente = 'banana';
*/
