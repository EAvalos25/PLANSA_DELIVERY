import { sesion } from './state/sessionState.js';
import { renderBandeja } from './views/dispatch.js';
import { renderHistorico } from './views/history.js';
import { renderPadron } from './views/roster.js';
import { renderKpiSiVisible } from './views/kpi.js';
import { renderMis } from './views/tickets.js';
import { sincronizar as sincronizarStore } from './store.js';

/**
 * Orquestador de render: vuelve a pintar todo lo que corresponde a la
 * sesión activa (admin o solicitante).
 */
export function renderTodo() {
  if (!sesion) return;
  if (sesion.tipo === 'admin') {
    renderBandeja();
    renderHistorico();
    renderPadron();
    renderKpiSiVisible();
  } else {
    renderMis();
  }
}

/** Inicia el sondeo periódico que detecta cambios guardados desde otra pestaña. */
export function iniciarSincronizacion(intervaloMs) {
  setInterval(() => sincronizarStore(renderTodo), intervaloMs);
}
