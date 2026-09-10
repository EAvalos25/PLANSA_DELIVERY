import { $ } from '../utils/dom.js';
import { renderMis, consultarTicket } from './tickets.js';
import { renderKpi } from './kpi.js';
import { renderHistorico } from './history.js';
import { renderPadron } from './roster.js';

/** Pestañas de la vista de solicitante: nueva solicitud / seguimiento / mis servicios. */
export function tabUser(k) {
  document.querySelectorAll('[data-utab]').forEach(b => b.classList.toggle('on', b.dataset.utab === k));
  $('uNueva').classList.toggle('on', k === 'nueva');
  $('uSeguimiento').classList.toggle('on', k === 'seguimiento');
  $('uMis').classList.toggle('on', k === 'mis');
  if (k === 'mis') renderMis();
  if (k === 'seguimiento' && $('qTicket').value) consultarTicket();
}

/** Pestañas de la vista de logística: bandeja / histórico / indicadores / padrón. */
export function tabAdmin(k) {
  document.querySelectorAll('[data-atab]').forEach(b => b.classList.toggle('on', b.dataset.atab === k));
  $('aBandeja').classList.toggle('on', k === 'bandeja');
  $('aHistorico').classList.toggle('on', k === 'historico');
  $('aKpi').classList.toggle('on', k === 'kpi');
  $('aPadron').classList.toggle('on', k === 'padron');
  if (k === 'kpi') renderKpi();
  if (k === 'historico') renderHistorico();
  if (k === 'padron') renderPadron();
}
