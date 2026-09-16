import { $, esc } from '../utils/dom.js';
import { fechaHora } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import * as api from '../api/estado.js';
import { DB } from '../api/estado.js';
import { normalizarDoc, DOC_VALIDO } from '#data/padron.js';

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

export async function cambiarPin() {
  const actual = $('pinActual').value || '';
  const nueva = $('nuevoPin').value || '';
  if (nueva.length < 6) { $('ePin').textContent = 'La clave debe tener al menos 6 caracteres.'; $('ePin').classList.add('on'); return; }

  try {
    // Hay que probar que se conoce la clave vigente: sin eso, cualquiera con la
    // pantalla abierta podría dejar fuera al resto del área.
    await api.cambiarClave(actual, nueva);
  } catch (e) {
    $('ePin').textContent = e.message;
    $('ePin').classList.add('on');
    return;
  }
  $('ePin').classList.remove('on');
  $('pinActual').value = ''; $('nuevoPin').value = '';
  toast('Clave guardada', 'Se usará en el próximo ingreso de logística.');
}
