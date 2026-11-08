// =============================================
// src/config/payment.js
// DATOS DE PAGO — EDITÁ ESTE ARCHIVO
//
// Cada unidad tiene su alias (mismo titular). El del food truck se usa en
// el QR del truck y en la tablet del truck: ver getUnidad().
// =============================================

import { getUnidad } from './unidad.js';

const ALIAS = {
    local: 'buba.co',
    food_truck: 'buba.fud',
};

export const PAYMENT_CONFIG = {
    alias: ALIAS[getUnidad()] || ALIAS.local,
    aliasHolder: 'Agustín Christiansen',
};
