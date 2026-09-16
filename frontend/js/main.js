/**
 * Punto de entrada de la aplicación.
 *
 * 1) Carga el estado inicial desde el servidor (una sola llamada a la API).
 * 2) Expone en `window` las funciones que el HTML invoca mediante atributos
 *    inline (onclick/onchange/oninput), ya que los módulos ES no son
 *    globales por defecto. Es un puente deliberado y acotado a esta lista;
 *    ver README para el detalle de por qué se mantiene y cómo migrar a
 *    delegación de eventos en el futuro.
 * 3) Registra los listeners que sí viven en JS (no en atributos inline).
 * 4) Arranca el reloj de la app: sincronización entre pestañas y refresco
 *    periódico de la ventana horaria del formulario.
 */
import { $, esc } from './utils/dom.js';
import { hoyISO } from './utils/format.js';
import { cargar } from './api/estado.js';
import { DESTINOS_FRECUENTES } from '#data/destinos.js';
import { sesion } from './state/sessionState.js';
import { iniciarSincronizacion } from './render.js';
import { alternarTema, actualizarBoton } from './ui/theme.js';

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
import { subirGuia, abrirAdjunto, eliminarAdjunto } from './views/attachments.js';

// Módulo payback: análisis de contratar motorizado propio frente al courier.
// Vive fuera de js/ a propósito, con su propia data, backend y frontend.
import {
  renderPayback, setMotoPayback, setBonoPayback, setInicioPayback,
  pbAgregarParada, pbQuitarParada, pbZonaParada, pbCuantasParadas, pbHoraSalida,
  pbDiaSimulado, pbMinutosParada, pbTiempoZona, pbOrdenarMejor, pbReiniciarSimulador
} from './views/payback/vista.js';

// ---- Puente hacia los atributos inline del HTML (estático y generado) ----
Object.assign(window, {
  alternarTema,
  pedirAutorizacion, entrarSolicitante, entrarAdmin, salir,
  setAccion, toggleOrigen, refrescarHoras, validarHoraViva, enviarSolicitud,
  tabUser, tabAdmin,
  consultarTicket, renderMis,
  renderBandeja, setFiltroBandeja, setVehiculo, setCosto, avanzar, verDetalle, cerrarModal,
  renderHistorico, exportarCSV,
  setFiltroKpi,
  renderPadron, agregarPersona, quitarPersona, formAlta, rechazarAut, cambiarPin,
  subirGuia, abrirAdjunto, eliminarAdjunto,
  renderPayback, setMotoPayback, setBonoPayback, setInicioPayback,
  pbAgregarParada, pbQuitarParada, pbZonaParada, pbCuantasParadas, pbHoraSalida,
  pbDiaSimulado, pbMinutosParada, pbTiempoZona, pbOrdenarMejor, pbReiniciarSimulador
});

// ---- Listeners que no van como atributos inline ----
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });
$('dniInput').addEventListener('keydown', e => { if (e.key === 'Enter') entrarSolicitante(); });
$('dniInput').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
$('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') entrarAdmin(); });
$('qTicket').addEventListener('keydown', e => { if (e.key === 'Enter') consultarTicket(); });
$('qTicket').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });
$('pDni').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });
$('fTel').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });

// ---- Arranque ----
// El estado completo viene del servidor en una sola llamada: padrón,
// solicitudes, autorizaciones, adjuntos y destinos. Si el servidor no responde,
// no hay nada que pintar y hay que decirlo, no fallar en silencio.
try {
  await cargar();
} catch (e) {
  document.body.innerHTML = '<div class="empty" style="padding:80px 20px">'
    + '<strong>No se puede conectar con el servidor</strong>'
    + esc(e.message) + '<br><br>Arráncalo con <code>npm start</code> y recarga la página.</div>';
  throw e;
}

actualizarBoton();

// Destinos frecuentes del histórico real: se ofrecen como sugerencia, el
// campo sigue aceptando cualquier dirección escrita a mano.
$('dlDestinos').innerHTML = DESTINOS_FRECUENTES
  .map(d => '<option value="' + d.replace(/"/g, '&quot;') + '"></option>').join('');

$('fFecha').min = hoyISO();
$('fFecha').value = hoyISO();
refrescarHoras();

iniciarSincronizacion(2500);
setInterval(() => { if (sesion && sesion.tipo === 'user' && $('uNueva').classList.contains('on')) refrescarHoras(); }, 60000);
