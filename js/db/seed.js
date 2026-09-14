import { padronInicial } from './padron.js';
import { historico2026, RESUMEN } from './historico.js';
import { PIN_POR_DEFECTO } from './schema.js';

/**
 * Estado inicial de la base.
 *
 * No hay datos inventados: el padrón es el listado de RR.HH. (./padron.js) y
 * las solicitudes son los servicios de mensajería que ya se hicieron en 2026
 * (./historico.js), cargados como concluidos. Así los indicadores abren con el
 * gasto real del año y la bandeja abre vacía, que es lo correcto: no hay nada
 * pendiente hasta que alguien registre una solicitud.
 */
export function semilla() {
  const solicitudes = historico2026();
  return {
    pin: PIN_POR_DEFECTO,
    correlativo: solicitudes.length,   // los tickets nuevos siguen la numeración
    personal: padronInicial(),
    solicitudes,
    autorizaciones: []
  };
}

/** Lo que trae la carga inicial, para avisarlo en la interfaz. */
export const ORIGEN_DATOS = RESUMEN;
