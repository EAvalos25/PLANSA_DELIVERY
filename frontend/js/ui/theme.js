/**
 * Selector de tema: claro / oscuro / negro (#000, tipo MacBook).
 *
 * El tema por defecto es CLARO. La preferencia del usuario se guarda y manda
 * sobre cualquier otra cosa. (Si algún día quieres que la app siga el tema del
 * sistema cuando el usuario no eligió nada, basta con leer
 * `matchMedia('(prefers-color-scheme: dark)')` en `js/ui/themeBoot.js`.)
 */
const TEMA_KEY = 'pn_mensajeria_tema'; // debe coincidir con js/ui/themeBoot.js
const TEMAS_VALIDOS = ['light', 'dark', 'black'];
const BOTON_DE = { light: 'themeLight', dark: 'themeDark', black: 'themeBlack' };

export function temaActual() {
  const t = document.documentElement.getAttribute('data-theme');
  return TEMAS_VALIDOS.includes(t) ? t : 'light';
}

export function aplicarTema(tema) {
  if (!TEMAS_VALIDOS.includes(tema)) tema = 'light';
  document.documentElement.setAttribute('data-theme', tema);
  try { localStorage.setItem(TEMA_KEY, tema); } catch (e) { /* sin persistencia */ }
  actualizarBoton();
}

/** Marca cuál de los tres botones está activo, para el ojo y para lectores de pantalla. */
export function actualizarBoton() {
  const actual = temaActual();
  for (const [tema, id] of Object.entries(BOTON_DE)) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const activo = tema === actual;
    btn.classList.toggle('on', activo);
    btn.setAttribute('aria-pressed', String(activo));
  }
}
