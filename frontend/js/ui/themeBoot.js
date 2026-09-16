/*
 * Script clásico (NO módulo) cargado de forma bloqueante en el <head>.
 *
 * Aplica el tema guardado antes del primer pintado; si esto se hiciera desde
 * un módulo (que se ejecuta diferido) la página parpadearía en claro antes de
 * pasar a oscuro.
 *
 * La clave se repite aquí a propósito: un script clásico no puede importar
 * js/config.js. Si cambias TEMA_KEY, cámbiala también en js/ui/theme.js.
 */
(function () {
  var TEMA_KEY = 'pn_mensajeria_tema';
  var tema = 'light';
  try {
    var guardado = localStorage.getItem(TEMA_KEY);
    if (guardado === 'dark' || guardado === 'light') tema = guardado;
  } catch (e) { /* almacenamiento bloqueado: se queda en claro */ }
  document.documentElement.setAttribute('data-theme', tema);
})();
