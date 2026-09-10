import { $, esc } from '../utils/dom.js';
import { fechaHora } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { DB, guardar } from '../db/index.js';

/**
 * Padrón de personal habilitado y autorizaciones pendientes de acceso.
 */
export function buscarPersona(dni) { return DB.personal.find(p => p.dni === dni) || null; }

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

  $('tbPadron').innerHTML = DB.personal.map(p =>
    '<tr><td class="tk" style="color:var(--text)">' + esc(p.dni) + '</td><td>' + esc(p.nombre) + '</td>'
    + '<td class="muted">' + esc(p.area) + '</td><td class="muted small">' + esc(p.sede.replace('Plásticos Nacionales - ', '')) + '</td>'
    + '<td><button class="btn btn-sm btn-ghost" onclick="quitarPersona(\'' + p.dni + '\')">Quitar</button></td></tr>'
  ).join('');
}

export function agregarPersona() {
  const dni = ($('pDni').value || '').replace(/\D/g, '');
  const nom = $('pNom').value.trim();
  if (dni.length !== 8 || nom.length < 3) { $('ePadron').classList.add('on'); return; }
  $('ePadron').classList.remove('on');
  if (buscarPersona(dni)) { toast('Ya está en el padrón', 'El DNI ' + dni + ' ya figura habilitado.', 'warn'); return; }
  DB.personal.push({ dni, nombre: nom, area: $('pArea').value.trim() || 'Sin área', sede: $('pSede').value });
  DB.autorizaciones.filter(a => a.dni === dni).forEach(a => a.estado = 'Aprobada');
  guardar();
  ['pDni', 'pNom', 'pArea'].forEach(id => $(id).value = '');
  renderPadron();
  toast('Persona habilitada', nom + ' ya puede registrar servicios.');
}

export function quitarPersona(dni) {
  DB.personal = DB.personal.filter(p => p.dni !== dni);
  guardar(); renderPadron();
  toast('Retirado del padrón', 'El DNI ' + dni + ' ya no puede solicitar servicios.', 'warn');
}

export function formAlta(dni) {
  $('pDni').value = dni; $('pNom').focus();
  toast('Completa los datos', 'Escribe nombre y área para habilitar el DNI ' + dni + '.');
}

export function rechazarAut(dni) {
  DB.autorizaciones.filter(a => a.dni === dni).forEach(a => a.estado = 'Rechazada');
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
