import * as adaptador from './adapters/localStorageAdapter.js';
import { esValida, migrar } from './schema.js';
import { semilla } from './seed.js';

/**
 * Capa de base de datos.
 *
 * Es el único punto del proyecto que sabe DÓNDE viven los datos. El resto de
 * la app solo usa `DB`, `guardar()` y `cargar()`. Para mover la base a una
 * nube real, ver el contrato en `adapters/localStorageAdapter.js` y cambiar
 * el import de arriba: nada más del proyecto cambia.
 *
 * `cargar()` es asíncrona a propósito, aunque el adaptador local no lo
 * necesite: así un adaptador de nube (que sí lo será) entra sin tocar a
 * quienes la llaman.
 */

/** Base de datos en memoria de la sesión actual. Se reasigna en cargar()/sincronizar(). */
export let DB = null;

// Última copia serializada conocida, para detectar cambios hechos en otra pestaña.
let ultimaCopia = '';

/** Persiste DB y actualiza el testigo de sincronización. */
export function guardar() {
  const texto = JSON.stringify(DB);
  ultimaCopia = texto;
  adaptador.escribir(texto);
}

/** Carga DB desde el almacenamiento, o genera la semilla de demostración. */
export async function cargar() {
  const crudo = await adaptador.leer();
  if (crudo) {
    try {
      const datos = JSON.parse(crudo);
      if (esValida(datos)) { DB = migrar(datos); ultimaCopia = crudo; return; }
    } catch (e) { /* datos ilegibles: se regenera la semilla */ }
  }
  DB = migrar(semilla());
  guardar();
}

/**
 * Revisa si otra pestaña actualizó el almacenamiento y, de ser así, recarga
 * DB y ejecuta el callback para refrescar la vista actual.
 *
 * Con un adaptador de nube esto se reemplaza por una suscripción en vivo
 * (onSnapshot / realtime) en lugar de sondeo.
 */
export function sincronizar(onCambio) {
  const crudo = adaptador.leerSincrono();
  if (crudo && crudo !== ultimaCopia) {
    try {
      const datos = JSON.parse(crudo);
      if (!esValida(datos)) return;
      DB = migrar(datos);
      ultimaCopia = crudo;
      onCambio();
    } catch (e) { /* se ignora un guardado parcial */ }
  }
}
