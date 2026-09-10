import { KEY } from './config.js';
import { semilla } from './data/seed.js';

/**
 * Persistencia de la aplicación: localStorage con respaldo en memoria
 * (por si el navegador bloquea el almacenamiento, p. ej. en modo privado).
 */
const _mem = {};
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return k in _mem ? _mem[k] : null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { _mem[k] = v; } }
};

/** Base de datos en memoria de la sesión actual. Se reasigna en cargar()/sincronizar(). */
export let DB = null;

// Última copia serializada conocida, usada para detectar cambios de otra pestaña.
let lastRaw = '';

/** Guarda DB en el almacenamiento y actualiza el testigo de sincronización. */
export function guardar() {
  storage.set(KEY, JSON.stringify(DB));
  lastRaw = storage.get(KEY) || '';
}

/** Carga DB desde el almacenamiento, o genera la semilla de demostración. */
export function cargar() {
  const raw = storage.get(KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.solicitudes)) { DB = d; lastRaw = raw; return; }
    } catch (e) { /* datos ilegibles: se regenera la semilla */ }
  }
  DB = semilla();
  guardar();
}

/**
 * Revisa si otra pestaña actualizó el almacenamiento y, de ser así,
 * recarga DB y ejecuta el callback para refrescar la vista actual.
 */
export function sincronizar(onCambio) {
  const raw = storage.get(KEY);
  if (raw && raw !== lastRaw) {
    try {
      DB = JSON.parse(raw);
      lastRaw = raw;
      onCambio();
    } catch (e) { /* se ignora un guardado parcial */ }
  }
}
