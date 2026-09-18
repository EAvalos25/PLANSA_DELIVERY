import { $, esc } from '../utils/dom.js';
import { fechaHora } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import * as api from '../api/estado.js';
import { DB } from '../api/estado.js';
import { sesion } from '../state/sessionState.js';
import { normalizarDoc, DOC_VALIDO } from '#shared/documento.js';

/** El servidor es quien de verdad decide: esto solo evita ofrecer un botón
 *  que a seguimiento le va a responder 403. */
const esAdmin = () => !sesion || sesion.rol === 'admin';

/**
 * Padrón de personal habilitado y autorizaciones pendientes de acceso.
 *
 * La búsqueda la resuelve el servidor, no esta pantalla. Antes el navegador
 * tenía una copia del padrón completo y filtraba sobre ella, lo que dejaba los
 * 212 nombres con su DNI a la vista de cualquiera que abriera la consola: la
 * tabla no los listaba, pero los datos igual habían viajado. Ahora solo llega
 * lo que se busca, y el conteo total viene como número.
 */

/** Marca de la búsqueda en curso, para que una respuesta lenta no pise a otra. */
let ultimaBusqueda = 0;

/** Repinta solo si la pestaña está a la vista: si no, es una consulta de más. */
export function renderPadronSiVisible() {
  if ($('aPadron').classList.contains('on')) return renderPadron();
}

export async function renderPadron() {
  const admin = esAdmin();
  $('formAltaPersonal').style.display = admin ? '' : 'none';
  $('panelPedirAutSeg').style.display = admin ? 'none' : '';

  const pend = DB.autorizaciones.filter(a => a.estado === 'Pendiente');
  $('cntAut').textContent = pend.length;
  $('cntPadron').textContent = DB.totalPersonal;

  $('listaAut').innerHTML = pend.length ? pend.map(a =>
    '<div class="aut"><div><div class="aut-dni">' + esc(a.dni) + '</div>'
    + '<div class="small muted">Solicitado el ' + fechaHora(a.solicitado) + '</div></div>'
    + (admin
      ? '<div class="tools"><button class="btn btn-sm" onclick="formAlta(\'' + a.dni + '\')">Habilitar</button>'
        + '<button class="btn btn-sm btn-ghost" onclick="rechazarAut(\'' + a.dni + '\')">Rechazar</button></div>'
      : '<div class="small muted">A la espera de admin</div>')
    + '</div>'
  ).join('') : '<div class="muted small">Sin pedidos pendientes.</div>';

  const vacio = m => '<tr><td colspan="5" class="muted small" style="padding:18px 12px">' + m + '</td></tr>';
  const q = String($('qPadron').value || '').trim();
  const turno = ++ultimaBusqueda;

  // Sin búsqueda no se pide nada: el padrón completo no se muestra ni se trae.
  if (q.length < 2) {
    $('cntPadronVista').textContent = '—';
    $('tbPadron').innerHTML = vacio('Escribe un documento, un nombre o un apellido para ver su ficha.');
    return;
  }

  let filas;
  try {
    filas = await api.buscarPersonal(q);
  } catch (e) {
    if (turno !== ultimaBusqueda) return;
    $('cntPadronVista').textContent = '—';
    $('tbPadron').innerHTML = vacio('No se pudo buscar: ' + esc(e.message));
    return;
  }
  // Mientras llegaba la respuesta el usuario siguió escribiendo: la descartamos.
  if (turno !== ultimaBusqueda) return;

  $('cntPadronVista').textContent = filas.length;
  $('tbPadron').innerHTML = filas.length ? filas.map(p =>
    '<tr><td class="tk" style="color:var(--text)">' + esc(p.dni) + '</td><td>' + esc(p.nombre) + '</td>'
    + '<td class="muted small">' + esc(p.cargo || '—') + '</td>'
    + '<td class="muted">' + esc(p.area) + '</td>'
    + '<td>' + (admin ? '<button class="btn btn-sm btn-ghost" onclick="quitarPersona(\'' + p.dni + '\')">Quitar</button>' : '') + '</td></tr>'
  ).join('') : vacio('Sin coincidencias para esa búsqueda.');
}

/** Pedido de alta que hace logística de seguimiento al toparse con alguien
 *  fuera del padrón (mismo circuito que usa el solicitante para sí mismo). */
export async function pedirAutorizacionStaff() {
  const dni = normalizarDoc($('segDni').value);
  if (!DOC_VALIDO.test(dni)) { $('eSegDni').classList.add('on'); return; }
  $('eSegDni').classList.remove('on');

  let r;
  try {
    r = await api.pedirAutorizacion(dni);
  } catch (e) {
    toast('No se pudo registrar el pedido', e.message, 'bad');
    return;
  }
  $('segDni').value = '';
  renderPadron();
  toast(r.repetido ? 'Ya había un pedido en curso' : 'Autorización solicitada',
    'Admin revisará el DNI ' + dni + '.', r.repetido ? 'warn' : undefined);
}

export async function agregarPersona() {
  const dni = normalizarDoc($('pDni').value);
  const nom = $('pNom').value.trim();
  if (!DOC_VALIDO.test(dni) || nom.length < 3) { $('ePadron').classList.add('on'); return; }
  $('ePadron').classList.remove('on');

  try {
    await api.agregarPersona({
      dni,
      nombre: nom,
      cargo: $('pCargo').value.trim(),
      area: $('pArea').value.trim()
    });
  } catch (e) {
    toast('No se pudo habilitar', e.message, e.status === 409 ? 'warn' : 'bad');
    return;
  }
  ['pDni', 'pNom', 'pCargo', 'pArea'].forEach(id => $(id).value = '');
  $('qPadron').value = dni;      // deja a la vista la ficha recién creada
  renderPadron();
  toast('Persona habilitada', nom + ' ya puede registrar servicios.');
}

export async function quitarPersona(dni) {
  try {
    await api.quitarPersona(normalizarDoc(dni));
  } catch (e) {
    toast('No se pudo retirar', e.message, 'bad');
    return;
  }
  renderPadron();
  toast('Retirado del padrón', 'El DNI ' + dni + ' ya no puede solicitar servicios.', 'warn');
}

export function formAlta(dni) {
  $('pDni').value = dni; $('pNom').focus();
  toast('Completa los datos', 'Escribe nombre, cargo y área para habilitar el documento ' + dni + '.');
}

export async function rechazarAut(dni) {
  try {
    await api.resolverAutorizacion(normalizarDoc(dni), 'Rechazada');
  } catch (e) {
    toast('No se pudo rechazar', e.message, 'bad');
    return;
  }
  renderPadron();
  toast('Pedido rechazado', 'El DNI ' + dni + ' sigue bloqueado.', 'warn');
}
