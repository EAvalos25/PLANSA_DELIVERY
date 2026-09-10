import { $, esc } from '../utils/dom.js';
import { pad } from '../utils/format.js';
import { DB } from '../store.js';
import { sesion } from '../state/sessionState.js';
import { ticketHTML } from './presenters.js';

/**
 * Vista del solicitante: consulta de un ticket puntual y listado de "mis servicios".
 */
export function consultarTicket() {
  const v = ($('qTicket').value || '').trim().toUpperCase();
  const id = /^\d+$/.test(v) ? 'REQ-' + pad(parseInt(v, 10)) : v;
  const s = DB.solicitudes.find(x => x.id === id && x.dni === sesion.dni);
  if (!s) {
    $('eTicket').textContent = v ? 'No encontramos el correlativo ' + esc(id) + ' entre tus servicios.' : 'Escribe el número correlativo de tu ticket.';
    $('eTicket').classList.add('on');
    $('resTicket').innerHTML = '';
    return;
  }
  $('eTicket').classList.remove('on');
  $('qTicket').value = s.id;
  $('resTicket').innerHTML = ticketHTML(s);
}

export function renderMis() {
  if (!sesion || sesion.tipo !== 'user') return;
  const mias = DB.solicitudes.filter(s => s.dni === sesion.dni).sort((a, b) => b.creado.localeCompare(a.creado));
  $('cntMis').textContent = mias.length;
  const cont = $('misTickets');
  if (!mias.length) {
    cont.innerHTML = '<div class="card empty"><strong>Todavía no tienes servicios</strong>Registra tu primera solicitud en la pestaña anterior.</div>';
  } else {
    cont.innerHTML = mias.map(ticketHTML).join('');
  }
  if ($('uSeguimiento').classList.contains('on') && $('qTicket').value) consultarTicket();
}
