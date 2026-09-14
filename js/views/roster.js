import { $, esc } from '../utils/dom.js';
import { fechaHora } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { DB, guardar } from '../db/index.js';
import { normalizarDoc, DOC_VALIDO } from '../db/padron.js';

/**
 * Padrón de personal habilitado y autorizaciones pendientes de acceso.
 */

/**
 * Busca en el padrón por documento. Compara en forma canónica (ver
 * `normalizarDoc`), así encuentra igual a quien tiene el DNI registrado con el
 * cero inicial recortado o a quien lo escribe sin él.
 */
export function buscarPersona(doc) {
  const buscado = normalizarDoc(doc);
  if (!buscado) return null;
  return DB.personal.find(p => normalizarDoc(p.dni) === buscado) || null;
}

/** Texto sobre el que busca el padrón, sin tildes para que 'nunez' encuentre a 'NÚÑEZ'. */
function textoBuscable(p) {
  return [p.dni, normalizarDoc(p.dni), p.nombre, p.cargo, p.area]
    .join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Personas que coinciden con lo buscado. Cada palabra escrita debe aparecer
 * en la ficha, sin importar el orden: así 'lopez deyna' encuentra a
 * 'DEYNA LOPEZ ABARRANCA' igual que 'deyna lopez'.
 *
 * Devuelve null cuando no hay búsqueda: el padrón completo no se muestra.
 */
function filtrarPadron(texto) {
  const q = String(texto || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (q.length < 2) return null;
  const palabras = q.split(/\s+/);
  return DB.personal.filter(p => {
    const t = textoBuscable(p);
    return palabras.every(w => t.includes(w));
  });
}

export function renderPadron() {
  const pend = DB.autorizaciones.filter(a => a.estado === 'Pendiente');
  $('cntAut').textContent = pend.length;
  $('cntPadron').textContent = DB.personal.length;

  $('listaAut').innerHTML = pend.length ? pend.map(a =>
    '<div class="aut"><div><div class="aut-dni">' + esc(a.dni) + '</div>'
    + '<div class="small muted">Solicitado el ' + fechaHora(a.solicitado) + '</div></div>'
    + '<div class="tools"><button class="btn btn-sm" onclick="formAlta(\'' + a.dni + '\')">Habilitar</button>'
    + '<button class="btn btn-sm btn-ghost" onclick="rechazarAut(\'' + a.dni + '\')">Rechazar</button></div></div>'
  ).join('') : '<div class="muted small">Sin pedidos pendientes.</div>';

  // El padrón no se lista entero: son datos personales de 212 colaboradores y
  // solo se muestran las fichas que logística busca expresamente.
  const filas = filtrarPadron($('qPadron').value);
  const vacio = m => '<tr><td colspan="5" class="muted small" style="padding:18px 12px">' + m + '</td></tr>';
  if (filas === null) {
    $('cntPadronVista').textContent = '—';
    $('tbPadron').innerHTML = vacio('Escribe un documento, un nombre o un apellido para ver su ficha.');
    return;
  }
  $('cntPadronVista').textContent = filas.length;
  $('tbPadron').innerHTML = filas.length ? filas.map(p =>
    '<tr><td class="tk" style="color:var(--text)">' + esc(p.dni) + '</td><td>' + esc(p.nombre) + '</td>'
    + '<td class="muted small">' + esc(p.cargo || '—') + '</td>'
    + '<td class="muted">' + esc(p.area) + '</td>'
    + '<td><button class="btn btn-sm btn-ghost" onclick="quitarPersona(\'' + p.dni + '\')">Quitar</button></td></tr>'
  ).join('') : vacio('Sin coincidencias para esa búsqueda.');
}

export function agregarPersona() {
  const dni = normalizarDoc($('pDni').value);
  const nom = $('pNom').value.trim();
  if (!DOC_VALIDO.test(dni) || nom.length < 3) { $('ePadron').classList.add('on'); return; }
  $('ePadron').classList.remove('on');
  if (buscarPersona(dni)) { toast('Ya está en el padrón', 'El documento ' + dni + ' ya figura habilitado.', 'warn'); return; }
  DB.personal.push({
    dni,
    nombre: nom,
    cargo: $('pCargo').value.trim() || 'Sin cargo',
    area: $('pArea').value.trim() || 'Sin área',
    origen: 'manual'            // sobrevive a las actualizaciones del padrón oficial
  });
  DB.autorizaciones.filter(a => normalizarDoc(a.dni) === dni).forEach(a => a.estado = 'Aprobada');
  guardar();
  ['pDni', 'pNom', 'pCargo', 'pArea'].forEach(id => $(id).value = '');
  $('qPadron').value = dni;      // deja a la vista la ficha recién creada
  renderPadron();
  toast('Persona habilitada', nom + ' ya puede registrar servicios.');
}

export function quitarPersona(dni) {
  DB.personal = DB.personal.filter(p => normalizarDoc(p.dni) !== normalizarDoc(dni));
  guardar(); renderPadron();
  toast('Retirado del padrón', 'El DNI ' + dni + ' ya no puede solicitar servicios.', 'warn');
}

export function formAlta(dni) {
  $('pDni').value = dni; $('pNom').focus();
  toast('Completa los datos', 'Escribe nombre, cargo y área para habilitar el documento ' + dni + '.');
}

export function rechazarAut(dni) {
  DB.autorizaciones.filter(a => normalizarDoc(a.dni) === normalizarDoc(dni)).forEach(a => a.estado = 'Rechazada');
  guardar(); renderPadron();
  toast('Pedido rechazado', 'El DNI ' + dni + ' sigue bloqueado.', 'warn');
}

export function cambiarPin() {
  const v = $('nuevoPin').value || '';
  if (v.length < 6) { $('ePin').classList.add('on'); return; }
  $('ePin').classList.remove('on');
  DB.pin = v; guardar(); $('nuevoPin').value = '';
  toast('Clave guardada', 'Se usará en el próximo ingreso de logística.');
}
