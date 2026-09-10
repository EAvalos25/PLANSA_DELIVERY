import { KEY } from '../../config.js';

/**
 * Adaptador de persistencia: localStorage, con respaldo en memoria si el
 * navegador lo bloquea (modo privado, políticas del equipo).
 *
 * ---------------------------------------------------------------------------
 * CONTRATO DEL ADAPTADOR — para migrar a una nube real
 * ---------------------------------------------------------------------------
 * Cualquier adaptador debe exportar estas tres funciones:
 *
 *   async leer()            -> string | null   (el JSON crudo de la base)
 *   async escribir(texto)   -> void
 *        leerSincrono()     -> string | null   (usado solo por el sondeo
 *                                               entre pestañas; una nube real
 *                                               puede devolver null y usar
 *                                               suscripciones en su lugar)
 *
 * Para cambiar a Firebase / Supabase / una API propia: crea un archivo hermano
 * (p. ej. `firebaseAdapter.js`) que exporte esas mismas funciones y cambia el
 * único import de `js/db/index.js`. Ningún otro archivo del proyecto se toca.
 * ---------------------------------------------------------------------------
 */

const _mem = {};

export async function leer() {
  return leerSincrono();
}

export async function escribir(texto) {
  try { localStorage.setItem(KEY, texto); } catch (e) { _mem[KEY] = texto; }
}

export function leerSincrono() {
  try {
    return localStorage.getItem(KEY);
  } catch (e) {
    return KEY in _mem ? _mem[KEY] : null;
  }
}
