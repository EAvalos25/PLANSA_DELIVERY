import { $ } from '../utils/dom.js';

/**
 * Panel de "Acceso de logística" en la barra superior.
 *
 * Vive oculto detrás de un icono a propósito: quien abre la aplicación casi
 * siempre es un solicitante con su DNI, no logística con usuario y clave.
 * Ponerlo aparte, y no en la pantalla de ingreso, deja esa pantalla con una
 * sola cosa que hacer.
 */
export const estaAbierto = () => $('logisticaPopover').classList.contains('on');

export function abrirAccesoLogistica() {
  $('logisticaPopover').classList.add('on');
  $('btnLogisticaToggle').setAttribute('aria-expanded', 'true');
}

export function cerrarAccesoLogistica() {
  $('logisticaPopover').classList.remove('on');
  $('btnLogisticaToggle').setAttribute('aria-expanded', 'false');
}

export function alternarAccesoLogistica() {
  if (estaAbierto()) cerrarAccesoLogistica(); else abrirAccesoLogistica();
}
