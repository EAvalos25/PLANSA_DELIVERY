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
 *        revision()         -> string | null   (testigo que cambia con cada
 *                                               escritura; permite al sondeo
 *                                               saber si hay novedades sin
 *                                               leer la base entera)
 *
 * Para cambiar a Firebase / Supabase / una API propia: crea un archivo hermano
 * (p. ej. `firebaseAdapter.js`) que exporte esas mismas funciones y cambia el
 * único import de `js/db/index.js`. Ningún otro archivo del proyecto se toca.
 * ---------------------------------------------------------------------------
 */

const CLAVE_REV = KEY + ':rev';
const _mem = {};

export async function leer() {
  return leerSincrono();
}

export async function escribir(texto) {
  // El testigo se escribe aparte y es diminuto: el sondeo entre pestañas lo lee
  // a él en vez de arrastrar la base completa (cientos de KB) cada pocos
  // segundos. Se guarda DESPUÉS de los datos, para que una pestaña no vea un
  // testigo nuevo apuntando a datos viejos.
  const rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  try {
    localStorage.setItem(KEY, texto);
    localStorage.setItem(CLAVE_REV, rev);
  } catch (e) {
    _mem[KEY] = texto;
    _mem[CLAVE_REV] = rev;
  }
}

export function leerSincrono() {
  return leerClave(KEY);
}

export function revision() {
  return leerClave(CLAVE_REV);
}

function leerClave(k) {
  try {
    const v = localStorage.getItem(k);
    return v != null ? v : (k in _mem ? _mem[k] : null);
  } catch (e) {
    return k in _mem ? _mem[k] : null;
  }
}
