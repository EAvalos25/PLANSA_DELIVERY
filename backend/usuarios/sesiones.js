import { randomBytes } from 'node:crypto';

/**
 * Sesiones de logística, en memoria y sin tabla en la base a propósito, igual
 * que el freno de intentos de middleware/limites.js: si el servidor se
 * reinicia, todos vuelven a entrar con su usuario y clave. Es una molestia
 * menor en una app que corre en una PC que se queda prendida, y evita atar un
 * token a una fila que hay que revisar cada vez que cambia la clave o se
 * desactiva a alguien.
 */
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas de jornada, de sobra para un turno

const sesiones = new Map(); // token -> { usuarioId, usuario, rol, expira }

function purgar(ahora) {
  for (const [token, s] of sesiones) if (s.expira <= ahora) sesiones.delete(token);
}

export function crear(usuarioRow) {
  if (sesiones.size > 500) purgar(Date.now());
  const token = randomBytes(24).toString('hex');
  sesiones.set(token, {
    usuarioId: usuarioRow.id,
    usuario: usuarioRow.usuario,
    rol: usuarioRow.rol,
    expira: Date.now() + DURACION_MS
  });
  return token;
}

export function verificar(token) {
  if (!token) return null;
  const s = sesiones.get(token);
  if (!s) return null;
  if (s.expira <= Date.now()) { sesiones.delete(token); return null; }
  return s;
}

export function revocar(token) {
  if (token) sesiones.delete(token);
}

/** Cierra de golpe todas las sesiones de un usuario: al desactivarlo o resetear su clave. */
export function revocarDeUsuario(usuarioId) {
  for (const [token, s] of sesiones) if (s.usuarioId === usuarioId) sesiones.delete(token);
}

/** Para las pruebas: deja el mapa como recién arrancado. */
export const olvidarSesiones = () => sesiones.clear();
