/**
 * Punto de entrada de la aplicación.
 *
 * 1) Carga el estado inicial (o la semilla de demostración).
 * 2) Expone en `window` las funciones que el HTML invoca mediante atributos
 *    inline (onclick/onchange/oninput), ya que los módulos ES no son
 *    globales por defecto. Es un puente deliberado y acotado a esta lista;
 *    ver README para el detalle de por qué se mantiene y cómo migrar a
 *    delegación de eventos en el futuro.
 * 3) Registra los listeners que sí viven en JS (no en atributos inline).
 * 4) Arranca el reloj de la app: sincronización entre pestañas y refresco
 *    periódico de la ventana horaria del formulario.
 */
import { $ } from './utils/dom.js';
import { hoyISO } from './utils/format.js';
import { cargar } from './store.js';
import { sesion } from './state/sessionState.js';
import { iniciarSincronizacion } from './render.js';

import { entrarSolicitante, pedirAutorizacion, entrarAdmin, salir } from './auth.js';
import { tabUser, tabAdmin } from './views/tabs.js';
import { setAccion, toggleOrigen, refrescarHoras, validarHoraViva, enviarSolicitud } from './views/requestForm.js';
import { consultarTicket, renderMis } from './views/tickets.js';
import {
  renderBandeja, setFiltroBandeja, setVehiculo, setCosto, avanzar, verDetalle, cerrarModal
} from './views/dispatch.js';
import { renderHistorico, exportarCSV } from './views/history.js';
import { setFiltroKpi } from './views/kpi.js';
import { renderPadron, agregarPersona, quitarPersona, formAlta, rechazarAut, cambiarPin } from './views/roster.js';

// ---- Puente hacia los atributos inline del HTML (estático y generado) ----
Object.assign(window, {
  pedirAutorizacion, entrarSolicitante, entrarAdmin, salir,
  setAccion, toggleOrigen, refrescarHoras, validarHoraViva, enviarSolicitud,
  tabUser, tabAdmin,
  consultarTicket, renderMis,
  renderBandeja, setFiltroBandeja, setVehiculo, setCosto, avanzar, verDetalle, cerrarModal,
  renderHistorico, exportarCSV,
  setFiltroKpi,
  renderPadron, agregarPersona, quitarPersona, formAlta, rechazarAut, cambiarPin
});

// ---- Listeners que no van como atributos inline ----
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });
$('dniInput').addEventListener('keydown', e => { if (e.key === 'Enter') entrarSolicitante(); });
$('dniInput').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
$('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') entrarAdmin(); });
$('qTicket').addEventListener('keydown', e => { if (e.key === 'Enter') consultarTicket(); });
$('fTel').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });

// ---- Arranque ----
cargar();
$('fFecha').min = hoyISO();
$('fFecha').value = hoyISO();
refrescarHoras();

iniciarSincronizacion(2500);
setInterval(() => { if (sesion && sesion.tipo === 'user' && $('uNueva').classList.contains('on')) refrescarHoras(); }, 60000);
