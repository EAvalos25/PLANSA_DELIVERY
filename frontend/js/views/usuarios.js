import { $, esc } from '../utils/dom.js';
import { toast } from '../utils/toast.js';
import { sesion } from '../state/sessionState.js';
import * as api from '../api/estado.js';
import { abrirModal } from './dispatch.js';

/**
 * Administración de cuentas de logística (admin/seguimiento). Solo la ve
 * quien entró como admin: la pestaña está oculta para seguimiento y el
 * servidor la rechaza igual si alguien la fuerza (ver aplicarPermisosAdmin
 * en tabs.js y requiereRol('admin') en backend/usuarios/rutas.js).
 */

const ROL_ETIQUETA = { admin: 'Admin', seguimiento: 'Seguimiento' };

/** Repinta solo si la pestaña está a la vista: si no, es una consulta de más. */
export function renderUsuariosSiVisible() {
  if ($('aUsuarios').classList.contains('on')) renderUsuarios();
}

export async function renderUsuarios() {
  let filas;
  try {
    filas = await api.listarUsuarios();
  } catch (e) {
    $('tbUsuarios').innerHTML = '<tr><td colspan="4" class="muted small" style="padding:18px 12px">'
      + 'No se pudo cargar: ' + esc(e.message) + '</td></tr>';
    return;
  }

  $('tbUsuarios').innerHTML = filas.map(u => {
    const soyYo = sesion && sesion.usuario === u.usuario;
    return '<tr><td class="tk" style="color:var(--text)">' + esc(u.usuario) + (soyYo ? ' <span class="muted small">(tú)</span>' : '') + '</td>'
      + '<td>' + (ROL_ETIQUETA[u.rol] || u.rol) + '</td>'
      + '<td>' + (u.activo ? '<span class="chip st-concluido"><i class="dot"></i>Activo</span>'
        : '<span class="chip st-espera"><i class="dot"></i>Desactivado</span>')
      + (u.debeCambiarClave ? ' <span class="small muted">clave temporal</span>' : '') + '</td>'
      + '<td class="nowrap">'
      + '<button class="btn btn-sm btn-ghost" onclick="restablecerClaveUsuarioVista(' + u.id + ')">Nueva clave temporal</button> '
      + (soyYo ? '' : '<button class="btn btn-sm btn-ghost" onclick="cambiarEstadoUsuarioVista(' + u.id + ',' + !u.activo + ')">'
        + (u.activo ? 'Desactivar' : 'Reactivar') + '</button>')
      + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted small" style="padding:18px 12px">Todavía no hay usuarios.</td></tr>';
}

export async function crearUsuarioLogistica() {
  const usuario = $('uNuevoUsuario').value.trim();
  const rol = $('uNuevoRol').value;
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(usuario)) { $('eUsuario').classList.add('on'); return; }
  $('eUsuario').classList.remove('on');

  let r;
  try {
    r = await api.crearUsuarioLogistica(usuario, rol);
  } catch (e) {
    toast('No se pudo crear el usuario', e.message, e.status === 409 ? 'warn' : 'bad');
    return;
  }
  $('uNuevoUsuario').value = '';
  renderUsuarios();
  mostrarClaveTemporal(r.usuario, r.claveTemporal, 'Usuario creado');
}

export async function restablecerClaveUsuarioVista(id) {
  let r;
  try {
    r = await api.restablecerClaveUsuario(id);
  } catch (e) {
    toast('No se pudo generar la clave', e.message, 'bad');
    return;
  }
  renderUsuarios();
  mostrarClaveTemporal(r.usuario, r.claveTemporal, 'Clave temporal generada');
}

export async function cambiarEstadoUsuarioVista(id, activo) {
  try {
    await api.cambiarEstadoUsuario(id, activo);
  } catch (e) {
    toast('No se pudo actualizar', e.message, 'bad');
    return;
  }
  renderUsuarios();
  toast(activo ? 'Usuario reactivado' : 'Usuario desactivado', '', activo ? undefined : 'warn');
}

/**
 * La clave temporal solo se muestra esta vez: el servidor no la vuelve a dar,
 * guarda el hash y nada más. Se pone en un modal en vez de un toast para que
 * dé tiempo a copiarla o dictarla antes de que se pierda de la pantalla.
 */
function mostrarClaveTemporal(usuario, clave, titulo) {
  const html = '<p>Usuario <b>' + esc(usuario) + '</b>, clave temporal:</p>'
    + '<p class="tk" style="font-size:22px;letter-spacing:2px;margin:10px 0">' + esc(clave) + '</p>'
    + '<div class="banner"><div>Se muestra una sola vez. Compártela por un canal seguro (de viva voz o por anexo); '
    + 'al ingresar, la aplicación le va a pedir que la cambie por una propia.</div></div>';
  abrirModal(titulo, html);
}
