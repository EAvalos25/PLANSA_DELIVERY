import * as adaptador from './adapters/localStorageAdapter.js';
import { esValida, migrar, VERSION } from './schema.js';
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

// Revisión del último guardado propio, para distinguir lo que escribimos
// nosotros de lo que escribió otra pestaña.
let ultimaRevision = null;

/** Persiste DB y actualiza el testigo de sincronización. */
export function guardar() {
  adaptador.escribir(JSON.stringify(DB));
  ultimaRevision = adaptador.revision();
}

/** Carga DB desde el almacenamiento, o arma el estado inicial (ver seed.js). */
export async function cargar() {
  const crudo = await adaptador.leer();
  if (crudo) {
    try {
      const datos = JSON.parse(crudo);
      if (esValida(datos)) {
        const versionGuardada = datos.version;
        DB = migrar(datos);
        ultimaRevision = adaptador.revision();
        // Si la base venía de una versión anterior, se deja ya migrada en el
        // almacenamiento; si no, cada carga repetiría el mismo trabajo.
        if (versionGuardada !== VERSION) guardar();
        return;
      }
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
  // Primero el testigo: son unos bytes. La base entera (cientos de KB con el
  // histórico cargado) solo se lee y se parsea cuando de verdad cambió.
  const rev = adaptador.revision();
  if (rev == null || rev === ultimaRevision) return;

  const crudo = adaptador.leerSincrono();
  if (!crudo) return;
  try {
    const datos = JSON.parse(crudo);
    if (!esValida(datos)) return;
    DB = migrar(datos);
    ultimaRevision = rev;
    onCambio();
  } catch (e) { /* se ignora un guardado parcial */ }
}
