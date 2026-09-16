import { $, esc } from './dom.js';

/**
 * Muestra una notificación flotante temporal.
 * clase: undefined (éxito), 'warn' o 'bad'.
 */
export function toast(titulo, detalle, clase) {
  const el = document.createElement('div');
  el.className = 'toast' + (clase ? ' ' + clase : '');
  el.innerHTML = '<b>' + esc(titulo) + '</b>' + (detalle ? '<span>' + esc(detalle) + '</span>' : '');
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
