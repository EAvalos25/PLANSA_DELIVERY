import { $ } from './utils/dom.js';
import { hoyISO } from './utils/format.js';
import { toast } from './utils/toast.js';
import { pedirAutorizacion as apiPedirAutorizacion, ingresarLogistica, salirLogistica,
         cambiarMiClave, buscarEnPadron } from './api/estado.js';
import { setSesion, sesion } from './state/sessionState.js';
import { normalizarDoc, DOC_VALIDO } from '#shared/documento.js';
import { tabUser, tabAdmin, aplicarPermisosAdmin } from './views/tabs.js';
import { toggleOrigen, refrescarHoras, resetAccion } from './views/requestForm.js';
import { renderMis } from './views/tickets.js';
import { abrirModal, cerrarModal } from './views/dispatch.js';
import { cerrarAccesoLogistica } from './ui/logisticaPopover.js';
import { renderTodo } from './render.js';

/**
 * Inicio de sesión (solicitante por DNI / logística por PIN), pedidos de
 * autorización y apertura/cierre de las vistas principales.
 */
export async function entrarSolicitante() {
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
  // La ficha la busca el servidor: el navegador no tiene el padrón.
  let p;
  try {
    p = await buscarEnPadron(dni);
  } catch (e) {
    if (e.status !== 404) {
      $('loginAlertTitle').textContent = 'No se pudo verificar el documento';
      $('loginAlertMsg').textContent = e.message;
      box.classList.add('on');
      return;
    }
    $('loginAlertTitle').textContent = 'Acceso denegado. Solicitar autorización a Logística';
    $('loginAlertMsg').textContent = 'El documento ' + dni + ' no figura en la base de personal de Plásticos Nacionales, así que no es posible registrar solicitudes con este DNI.';
    $('loginAlertActions').style.display = 'block';
    box.classList.add('on');
    return;
  }
  setSesion({ tipo: 'user', dni: p.dni, nombre: p.nombre, cargo: p.cargo, area: p.area });
  abrirVista('user');
}

export async function pedirAutorizacion() {
  const dni = normalizarDoc($('dniInput').value);
  if (!DOC_VALIDO.test(dni)) return;

  let r;
  try {
    r = await apiPedirAutorizacion(dni);
  } catch (e) {
    toast('No se pudo registrar el pedido', e.message, 'bad');
    return;
  }
  if (r.repetido) {
    toast('Ya hay un pedido en curso', 'Logística revisará el DNI ' + dni + '.', 'warn');
    return;
  }
  $('loginAlertTitle').textContent = 'Pedido enviado a logística';
  $('loginAlertMsg').textContent = 'Registramos el DNI ' + dni + ' para revisión. Vuelve a intentar el ingreso cuando logística confirme tu alta en el padrón.';
  $('loginAlert').classList.add('ok');
  $('loginAlertActions').style.display = 'none';
  toast('Autorización solicitada', 'DNI ' + dni + ' en cola de revisión.');
}

export async function entrarAdmin() {
  // El usuario y la clave se comprueban en el servidor: el navegador nunca
  // conoce la clave de nadie, solo recibe un token si acierta.
  let r;
  try {
    r = await ingresarLogistica($('userInput').value || '', $('pinInput').value || '');
  } catch (e) {
    $('pinErr').textContent = e.status === 401 ? 'Usuario o clave incorrectos.' : e.message;
    $('pinErr').classList.add('on');
    $('pinInput').classList.add('bad');
    return;
  }
  $('pinErr').classList.remove('on');
  $('pinInput').classList.remove('bad');
  setSesion({
    tipo: 'admin', usuario: r.usuario, rol: r.rol, token: r.token,
    nombre: r.usuario, area: r.rol === 'admin' ? 'Administración' : 'Seguimiento'
  });
  abrirVista('admin');
  // Con clave temporal no se deja trabajar hasta que la cambie por una propia.
  if (r.debeCambiarClave) abrirCambioClave(true);
}

export function salir() {
  // Se avisa al servidor para cerrar el token ya mismo; si la llamada falla
  // (sin red, servidor caído) igual se sale localmente, que es lo que importa.
  if (sesion && sesion.tipo === 'admin') salirLogistica().catch(() => {});
  setSesion(null);
  $('viewUser').classList.remove('on');
  $('viewAdmin').classList.remove('on');
  $('session').style.display = 'none';
  $('loginStage').style.display = 'grid';
  $('btnLogisticaToggle').style.display = '';
  $('dniInput').value = '';
  $('userInput').value = '';
  $('pinInput').value = '';
  $('loginAlert').classList.remove('on', 'ok');
}

/**
 * Cambio de la clave propia. `obligatorio` solo cambia el aviso: justo
 * después de entrar con una clave temporal conviene cambiarla ya, porque esa
 * clave la vio también quien la generó y quien la recibió por teléfono o
 * anexo. No se bloquea el modal ni se impide seguir trabajando con ella: si
 * no la cambia ahora, se le recuerda de nuevo en el siguiente ingreso.
 */
export function abrirCambioClave(obligatorio = false) {
  const html = '<div class="field"><label for="claveActual">Clave actual</label>'
    + '<input class="input" id="claveActual" type="password" autocomplete="off"></div>'
    + '<div class="field"><label for="claveNueva">Clave nueva</label>'
    + '<input class="input" id="claveNueva" type="password" placeholder="Mínimo 6 caracteres" autocomplete="off"></div>'
    + '<div class="err" id="eClave"></div>'
    + (obligatorio ? '<div class="banner" style="margin-bottom:12px"><div>Ingresaste con una clave temporal: te conviene elegir una propia.</div></div>' : '')
    + '<button class="btn btn-sm" onclick="guardarCambioClave()">Guardar clave</button>';
  abrirModal('Cambiar mi clave', html);
}

export async function guardarCambioClave() {
  const actual = $('claveActual').value || '';
  const nueva = $('claveNueva').value || '';
  try {
    await cambiarMiClave(actual, nueva);
  } catch (e) {
    $('eClave').textContent = e.message;
    $('eClave').classList.add('on');
    return;
  }
  cerrarModal();
  toast('Clave actualizada', 'Úsala la próxima vez que ingreses.');
}

const ROL_ETIQUETA = { admin: 'Logística · administrador', seguimiento: 'Logística · seguimiento' };

function abrirVista(tipo) {
  $('loginStage').style.display = 'none';
  $('btnLogisticaToggle').style.display = 'none';
  cerrarAccesoLogistica();
  $('session').style.display = 'flex';
  $('sessName').textContent = sesion.nombre;
  $('sessRole').textContent = tipo === 'admin' ? ROL_ETIQUETA[sesion.rol] : sesion.area;
  $('btnMiClave').style.display = tipo === 'admin' ? 'inline-block' : 'none';
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
    aplicarPermisosAdmin();
    tabAdmin('bandeja');
    renderTodo();
  }
}
