import { FLOTA } from '#data/payback/parametros.js';
import { motoPorId } from '#data/payback/motos.js';

/**
 * Costo de tener una moto de la empresa: la inversión inicial y lo que cuesta
 * mantenerla rodando cada mes.
 *
 * Cálculo puro, sin DOM. Se separa la INVERSIÓN (lo que sale de caja una vez,
 * y es lo que hay que recuperar) del GASTO MENSUAL (lo que se repite). Esa
 * distinción es la que hace que este escenario tenga payback y los otros dos
 * no: sin desembolso inicial no hay nada que recuperar.
 */

/** Lo que cuesta poner la moto en la calle el primer día. */
export function inversion(idMoto) {
  const moto = motoPorId(idMoto);
  const precio = moto.precioUsdReferencial * FLOTA.tipoCambio;
  const total = precio + FLOTA.inscripcionSoles + FLOTA.equipamientoSoles;
  return {
    moto,
    precioSoles: precio,
    inscripcion: FLOTA.inscripcionSoles,
    equipamiento: FLOTA.equipamientoSoles,
    total
  };
}

/**
 * Gasto mensual de operar la moto.
 * @param {string} idMoto
 * @param {number} diasDeRutaAlMes  días que la moto sale a la calle
 */
export function gastoMensual(idMoto, diasDeRutaAlMes) {
  const inv = inversion(idMoto);

  const galonesAlMes = (FLOTA.kmPorDia * diasDeRutaAlMes) / FLOTA.rendimientoKmPorGalon;
  const combustible = galonesAlMes * FLOTA.precioGalonSoles;

  const soat = FLOTA.soatAnualSoles / 12;
  const seguro = FLOTA.seguroVehicularAnualSoles / 12;
  const mantenimiento = FLOTA.mantenimientoAnualSoles / 12;

  // Depreciación lineal sobre el precio de la moto, descontando lo que se
  // recupera al venderla. No es salida de caja, pero es costo del período: sin
  // ella, comparar contra el courier saldría falsamente barato.
  const depreciacion = (inv.precioSoles * (1 - FLOTA.valorResidual)) / (FLOTA.vidaUtilAnios * 12);

  const total = combustible + soat + seguro + mantenimiento + depreciacion;

  return {
    combustible,
    galonesAlMes,
    kmAlMes: FLOTA.kmPorDia * diasDeRutaAlMes,
    soat,
    seguro,
    mantenimiento,
    depreciacion,
    total,
    /** Gasto que de verdad sale de caja cada mes (sin depreciación). */
    salidaDeCaja: total - depreciacion
  };
}
