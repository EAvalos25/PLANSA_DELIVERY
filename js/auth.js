import { $ } from './utils/dom.js';
import { hoyISO } from './utils/format.js';
import { toast } from './utils/toast.js';
import { DB, guardar } from './db/index.js';
import { setSesion, sesion } from './state/sessionState.js';
import { buscarPersona } from './views/roster.js';
import { normalizarDoc, DOC_VALIDO } from './db/padron.js';
import { tabUser, tabAdmin } from './views/tabs.js';
import { toggleOrigen, refrescarHoras, resetAccion } from './views/requestForm.js';
import { renderMis } from './views/tickets.js';
import { renderTodo } from './render.js';

/**
 * Inicio de sesión (solicitante por DNI / logística por PIN), pedidos de
 * autorización y apertura/cierre de las vistas principales.
 */
export function entrarSolicitante() {
  // El documento se normaliza antes de validar: quien tenga el DNI con 7
  // dígitos (porque el sistema de RR.HH. recortó el cero inicial) entra
  // igual, lo escriba con cero o sin él.
  const dni = normalizarDoc($('dniInput').value);
  const box = $('loginAlert');
  box.classList.remove('on', 'ok');
  $('loginAlertActions').style.display = 'none';

  if (!DOC_VALIDO.test(dni)) {
    $('loginAlertTitle').textContent = 'Documento incompleto';
    $('loginAlertMsg').textContent = 'Escribe los 8 dígitos de tu DNI (9 si usas carné de extranjería).';
    box.classList.add('on');
    return;
  }
  const p = buscarPersona(dni);
  if (!p) {
    $('loginAlertTitle').textContent = 'Acceso denegado. Solicitar autorización a Logística';
    $('loginAlertMsg').textContent = 'El documento ' + dni + ' no figura en la base de personal de Plásticos Nacionales, así que no es posible registrar solicitudes con este DNI.';
    $('loginAlertActions').style.display = 'block';
    box.classList.add('on');
    return;
  }
  setSesion({ tipo: 'user', dni: p.dni, nombre: p.nombre, cargo: p.cargo, area: p.area });
  abrirVista('user');
}

export function pedirAutorizacion() {
  const dni = normalizarDoc($('dniInput').value);
  if (!DOC_VALIDO.test(dni)) return;
  if (DB.autorizaciones.some(a => normalizarDoc(a.dni) === dni && a.estado === 'Pendiente')) {
    toast('Ya hay un pedido en curso', 'Logística revisará el DNI ' + dni + '.', 'warn');
    return;
  }
  DB.autorizaciones.push({ dni, solicitado: new Date().toISOString(), estado: 'Pendiente' });
  guardar();
  $('loginAlertTitle').textContent = 'Pedido enviado a logística';
  $('loginAlertMsg').textContent = 'Registramos el DNI ' + dni + ' para revisión. Vuelve a intentar el ingreso cuando logística confirme tu alta en el padrón.';
  $('loginAlert').classList.add('ok');
  $('loginAlertActions').style.display = 'none';
  toast('Autorización solicitada', 'DNI ' + dni + ' en cola de revisión.');
}

export function entrarAdmin() {
  const v = $('pinInput').value || '';
  if (v !== DB.pin) {
    $('pinErr').classList.add('on');
    $('pinInput').classList.add('bad');
    return;
  }
  $('pinErr').classList.remove('on');
  $('pinInput').classList.remove('bad');
  setSesion({ tipo: 'admin', nombre: 'Logística', area: 'Despacho' });
  abrirVista('admin');
}

export function salir() {
  setSesion(null);
  $('viewUser').classList.remove('on');
  $('viewAdmin').classList.remove('on');
  $('session').style.display = 'none';
  $('loginStage').style.display = 'grid';
  $('dniInput').value = '';
  $('pinInput').value = '';
  $('loginAlert').classList.remove('on', 'ok');
}

function abrirVista(tipo) {
  $('loginStage').style.display = 'none';
  $('session').style.display = 'flex';
  $('sessName').textContent = sesion.nombre;
  $('sessRole').textContent = tipo === 'admin' ? 'Logística · despacho' : sesion.area;
  if (tipo === 'user') {
    $('viewUser').classList.add('on');
    $('viewAdmin').classList.remove('on');
    $('miNombre').textContent = sesion.nombre;
    $('miDni').textContent = sesion.dni;
    $('miArea').textContent = sesion.area;
    $('miCargo').textContent = sesion.cargo || '—';
    $('fOrigen').value = '';
    toggleOrigen();
    resetAccion();
    $('resTicket').innerHTML = ''; $('qTicket').value = ''; $('eTicket').classList.remove('on');
    $('fFecha').min = hoyISO();
    if (!$('fFecha').value) $('fFecha').value = hoyISO();
    refrescarHoras();
    tabUser('nueva');
    renderMis();
  } else {
    $('viewAdmin').classList.add('on');
    $('viewUser').classList.remove('on');
    tabAdmin('bandeja');
    renderTodo();
  }
}
