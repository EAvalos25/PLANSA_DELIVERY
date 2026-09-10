/**
 * Conmutador de tema claro / oscuro.
 *
 * El tema por defecto es CLARO. La preferencia del usuario se guarda y manda
 * sobre cualquier otra cosa. (Si algún día quieres que la app siga el tema del
 * sistema cuando el usuario no eligió nada, basta con leer
 * `matchMedia('(prefers-color-scheme: dark)')` en `js/ui/themeBoot.js`.)
 */
const TEMA_KEY = 'pn_mensajeria_tema'; // debe coincidir con js/ui/themeBoot.js

export function temaActual() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  try { localStorage.setItem(TEMA_KEY, tema); } catch (e) { /* sin persistencia */ }
  actualizarBoton();
}

export function alternarTema() {
  aplicarTema(temaActual() === 'dark' ? 'light' : 'dark');
}

/** Deja el botón anunciando correctamente su acción para lectores de pantalla. */
export function actualizarBoton() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const oscuro = temaActual() === 'dark';
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  btn.setAttribute('aria-label', etiqueta);
  btn.setAttribute('title', etiqueta);
  btn.setAttribute('aria-pressed', String(oscuro));
}
