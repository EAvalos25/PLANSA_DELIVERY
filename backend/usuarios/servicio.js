import * as repo from './repositorio.js';
import { hashClave, verificarHash, generarClaveTemporal } from './claves.js';
import * as sesiones from './sesiones.js';

/**
 * Reglas de negocio de las cuentas de logística. `rutas.js` solo traduce
 * HTTP <-> estas funciones; aquí vive lo que hay que cuidar (nadie entra con
 * un usuario desactivado, la clave nunca se guarda en claro, etc.).
 */

const error = (msg, status = 400) => Object.assign(new Error(msg), { status });

export function ingresar(usuario, clave) {
  const u = repo.porUsuario(usuario);
  if (!u || !u.activo || !verificarHash(clave, u.claveHash)) {
    throw error('Usuario o clave incorrectos.', 401);
  }
  return {
    token: sesiones.crear(u),
    usuario: u.usuario,
    rol: u.rol,
    debeCambiarClave: !!u.debeCambiarClave
  };
}

export function crearUsuario({ usuario, rol, creadoPor }) {
  const claveTemporal = generarClaveTemporal();
  const creado = repo.crear({ usuario, claveHash: hashClave(claveTemporal), rol, creadoPor });
  // La clave temporal sale UNA sola vez, en la respuesta de creación: no se
  // guarda en ningún lado en claro y no se puede volver a consultar después,
  // solo generar una nueva con restablecerClave.
  return { ...creado, claveTemporal };
}

export function restablecerClave(id) {
  const u = repo.porId(id);
  if (!u) throw error('No existe ese usuario.', 404);
  const claveTemporal = generarClaveTemporal();
  repo.cambiarClave(id, hashClave(claveTemporal), { debeCambiar: true });
  sesiones.revocarDeUsuario(id);
  return { id, usuario: u.usuario, claveTemporal };
}

export function cambiarClavePropia(sesion, actual, nueva) {
  const u = repo.porUsuario(sesion.usuario);
  if (!u || !verificarHash(actual, u.claveHash)) throw error('La clave actual no es correcta.', 401);
  if (String(nueva || '').length < 6) throw error('La clave nueva debe tener al menos 6 caracteres.');
  if (verificarHash(nueva, u.claveHash)) throw error('La clave nueva debe ser distinta de la actual.');
  repo.cambiarClave(u.id, hashClave(nueva), { debeCambiar: false });
}

/**
 * Solo admin llama a esto (requiereRol('admin') en rutas.js), y quien llama
 * siempre queda activo: por eso basta con impedir que alguien se desactive a
 * sí mismo para que nunca se pueda dejar el sistema sin ningún admin activo.
 */
export function cambiarEstado(id, activo, sesion) {
  const u = repo.porId(id);
  if (!u) throw error('No existe ese usuario.', 404);
  if (!activo && u.usuario === sesion.usuario) throw error('No puedes desactivar tu propio usuario.');
  const actualizado = repo.cambiarEstado(id, activo);
  if (!activo) sesiones.revocarDeUsuario(id);
  return actualizado;
}
