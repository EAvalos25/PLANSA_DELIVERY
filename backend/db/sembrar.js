import { abrir, cerrar, db } from './conexion.js';
import * as personal from './repos/personal.js';
import * as solicitudes from './repos/solicitudes.js';
import * as ajustes from './repos/ajustes.js';
import { padronInicial } from '#data/padron.js';
import { historico2026, RESUMEN } from '#data/historico.js';

/**
 * Carga inicial de la base.
 *
 * No hay datos inventados: el padrón es el listado de RR.HH. y las solicitudes
 * son los servicios de mensajería que de verdad se hicieron en 2026, cargados
 * como concluidos. Así los indicadores abren con el gasto real del año y la
 * bandeja abre vacía, que es lo correcto: no hay nada pendiente hasta que
 * alguien registre una solicitud.
 *
 * Es idempotente: si la base ya tiene datos no hace nada, salvo que se pase
 * --forzar, que la vacía y la vuelve a llenar.
 *
 *     node backend/db/sembrar.js            carga solo si está vacía
 *     node backend/db/sembrar.js --forzar   borra y recarga
 */

export const VERSION_DATOS = '2026.1';

export function sembrar({ forzar = false, silencioso = false } = {}) {
  const decir = (...a) => { if (!silencioso) console.log(...a); };

  if (forzar) {
    db().exec('DELETE FROM adjuntos; DELETE FROM solicitudes; DELETE FROM autorizaciones; DELETE FROM personal;');
    decir('Base vaciada.');
  }

  const yaHay = personal.total() > 0 || solicitudes.total() > 0;
  if (yaHay) {
    decir('La base ya tiene datos (' + personal.total() + ' personas, '
      + solicitudes.total() + ' servicios). Nada que sembrar.');
    return { sembrado: false };
  }

  const personas = personal.cargarPadronOficial(padronInicial());
  decir('Padrón cargado: ' + personas + ' personas.');

  const servicios = solicitudes.cargarHistorico(historico2026());
  decir('Histórico cargado: ' + servicios + ' servicios de 2026 (S/ ' + RESUMEN.gasto.toFixed(2)
    + ', del ' + RESUMEN.desde + ' al ' + RESUMEN.hasta + ').');

  ajustes.escribir('version_datos', VERSION_DATOS);
  if (!ajustes.leer('pin')) ajustes.escribir('pin', ajustes.CLAVE_POR_DEFECTO);
  ajustes.tocar();

  return { sembrado: true, personas, servicios };
}

// Ejecutable directo: node backend/db/sembrar.js [--forzar]
if (import.meta.filename === process.argv[1]) {
  abrir();
  sembrar({ forzar: process.argv.includes('--forzar') });
  cerrar();
}
