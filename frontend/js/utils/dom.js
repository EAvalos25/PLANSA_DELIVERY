/**
 * Utilidades de acceso al DOM y escape de texto.
 */
export const $ = id => document.getElementById(id);

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/**
 * Marca (o desmarca) un campo y su mensaje de error asociado.
 * Devuelve true si el campo es válido (no "mal").
 */
export function marcar(idCampo, idError, mal, msg) {
  const c = $(idCampo), e = $(idError);
  c.classList.toggle('bad', mal);
  e.classList.toggle('on', mal);
  if (msg) e.textContent = msg;
  return !mal;
}
