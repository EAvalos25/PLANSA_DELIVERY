import { $, esc, marcar } from '../utils/dom.js';
import { pad, hoyISO, isoDia, numeroTicket } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { MARGEN_HORAS, SLOT_INI, SLOT_FIN } from '../config.js';
import { crearSolicitud } from '../api/estado.js';
import { sesion } from '../state/sessionState.js';
import { renderMis } from './tickets.js';

/**
 * Formulario de nueva solicitud del solicitante: acción, origen, programación
 * horaria, paradas adicionales y validación/registro del ticket.
 */
let accionSel = '';

// --------------------------------------------------------- paradas extra
// Un servicio con dos o más rutas en la misma programación: el primer
// destino sigue siendo el campo de siempre (fDestino); esto es solo lo que se
// agrega de más. Un array simple en memoria alcanza: se arma de nuevo cada
// vez que se pinta, y se vacía al enviar o al abrir la vista.
let paradasExtra = [];

function renderParadas() {
  $('listaParadas').innerHTML = paradasExtra.map((p, i) => (
    '<div class="row" style="align-items:flex-end;margin-bottom:10px">'
    + '<div class="field" style="margin:0"><label>Destino ' + (i + 2) + '</label>'
    + '<input class="input" list="dlDestinos" autocomplete="off" placeholder="Dirección de la parada"'
    + ' value="' + esc(p.destino) + '" oninput="editarParada(' + i + ',\'destino\',this.value)"></div>'
    + '<div class="field" style="margin:0"><label>Contacto</label>'
    + '<input class="input" placeholder="Quién recibe (opcional)"'
    + ' value="' + esc(p.contacto) + '" oninput="editarParada(' + i + ',\'contacto\',this.value)"></div>'
    + '<div class="field" style="margin:0;max-width:140px"><label>Teléfono</label>'
    + '<input class="input" inputmode="numeric" maxlength="12" placeholder="Opcional"'
    + ' value="' + esc(p.telefono) + '" oninput="editarParada(' + i + ',\'telefono\',this.value.replace(/\\D/g,\'\'))"></div>'
    + '<button type="button" class="btn btn-sm btn-ghost" onclick="quitarParada(' + i + ')" title="Quitar esta parada">✕</button>'
    + '</div>'
  )).join('');
}

export function agregarParada() {
  paradasExtra.push({ destino: '', contacto: '', telefono: '' });
  renderParadas();
}

export function editarParada(i, campo, valor) {
  if (paradasExtra[i]) paradasExtra[i][campo] = valor;
}

export function quitarParada(i) {
  paradasExtra.splice(i, 1);
  renderParadas();
}

export function limpiarParadas() {
  paradasExtra = [];
  renderParadas();
}

export function setAccion(v) {
  accionSel = v;
  document.querySelectorAll('#fAccion .tg').forEach(b => b.classList.toggle('on', b.dataset.val === v));
  $('fAccion').classList.remove('bad');
  $('eAccion').classList.remove('on');
}

/** Limpia la acción seleccionada (usado al abrir la vista de solicitante). */
export function resetAccion() {
  accionSel = '';
  document.querySelectorAll('#fAccion .tg').forEach(b => b.classList.remove('on'));
}

export function toggleOrigen() {
  const otro = $('fOrigen').value === 'Otros';
  $('wrapOtro').style.display = otro ? 'block' : 'none';
  if (!otro) $('fOrigenOtro').value = '';
}

function horaMinimaHoy() {
  const t = new Date(Date.now() + MARGEN_HORAS * 3600000);
  // se redondea al siguiente bloque de 30 minutos
  const m = t.getMinutes();
  if (m === 0 || m === 30) { t.setSeconds(0, 0); }
  else if (m < 30) t.setMinutes(30, 0, 0);
  else { t.setHours(t.getHours() + 1); t.setMinutes(0, 0, 0); }
  return t;
}

export function refrescarHoras() {
  const fecha = $('fFecha').value;
  const esHoy = fecha === hoyISO();
  const limite = horaMinimaHoy();
  const inp = $('fHora');
  const nota = $('minHoraNota');
  const hh = pad(limite.getHours(), 2) + ':' + pad(limite.getMinutes(), 2);

  if (esHoy && isoDia(limite) === fecha) inp.min = hh; else inp.removeAttribute('min');

  if (!fecha) {
    nota.textContent = 'Elige primero la fecha del servicio.';
  } else if (esHoy && isoDia(limite) !== fecha) {
    nota.innerHTML = 'Con el margen de ' + MARGEN_HORAS + ' horas la salida ya cae en el día siguiente. Programa el servicio para mañana.';
  } else if (esHoy) {
    nota.innerHTML = 'Son las ' + pad(new Date().getHours(), 2) + ':' + pad(new Date().getMinutes(), 2) + '. Para hoy la primera hora que puedes pedir es las <b style="color:var(--primary)">' + hh + '</b>.';
  } else {
    nota.textContent = 'Ventana operativa de mensajería: ' + pad(SLOT_INI, 2) + ':00 a ' + pad(SLOT_FIN, 2) + ':00.';
  }
  validarHoraViva();
}

// Devuelve '' si la hora es válida, o el texto del error.
function errorHora(fecha, hora) {
  if (!hora) return 'Indica la hora del servicio.';
  if (!fecha) return '';
  if (fecha === hoyISO()) {
    const prog = new Date(fecha + 'T' + hora + ':00');
    if ((prog - new Date()) / 3600000 < MARGEN_HORAS)
      return 'El margen de solicitud para el mismo día debe ser mayor a 4 horas.';
  }
  const h = parseInt(hora.slice(0, 2), 10);
  if (h < SLOT_INI || h >= SLOT_FIN)
    return 'La mensajería opera de ' + pad(SLOT_INI, 2) + ':00 a ' + pad(SLOT_FIN, 2) + ':00.';
  return '';
}

export function validarHoraViva() {
  const hora = $('fHora').value;
  if (!hora) { $('fHora').classList.remove('bad'); $('eHora').classList.remove('on'); return; }
  const e = errorHora($('fFecha').value, hora);
  marcar('fHora', 'eHora', !!e, e || undefined);
}

export async function enviarSolicitud() {
  $('okBox').classList.remove('on');
  const servicio = $('fServicio').value.trim();
  const origen = $('fOrigen').value;
  const otro = $('fOrigenOtro').value.trim();
  const motivo = $('fMotivo').value.trim();
  const dest = $('fDestino').value.trim();
  const cont = $('fContacto').value.trim();
  const tel = $('fTel').value.replace(/\D/g, '');
  const fecha = $('fFecha').value;
  const hora = $('fHora').value;

  let ok = true;
  if (!accionSel) { $('fAccion').classList.add('bad'); $('eAccion').classList.add('on'); ok = false; }
  ok = marcar('fServicio', 'eServicio', servicio.length < 3, 'Indica qué se va a mover.') && ok;
  ok = marcar('fOrigen', 'eOrigen', !origen) && ok;
  if (origen === 'Otros') ok = marcar('fOrigenOtro', 'eOrigenOtro', !otro) && ok;
  ok = marcar('fMotivo', 'eMotivo', motivo.length < 5, 'Describe el motivo con al menos 5 caracteres.') && ok;
  ok = marcar('fDestino', 'eDestino', dest.length < 6, 'Escribe la dirección exacta de destino.') && ok;
  ok = marcar('fContacto', 'eContacto', cont.length < 3) && ok;
  ok = marcar('fTel', 'eTel', tel.length < 9 || tel.length > 11, 'Ingresa un teléfono válido de 9 dígitos.') && ok;
  ok = marcar('fFecha', 'eFecha', !fecha || fecha < hoyISO(), 'Elige una fecha desde hoy en adelante.') && ok;

  // el margen se vuelve a verificar al enviar, por si el formulario quedó abierto
  const msgHora = errorHora(fecha, hora);
  ok = marcar('fHora', 'eHora', !!msgHora, msgHora || undefined) && ok;

  // Las paradas vacías (se le dio a "+ Agregar" y no se llenó) se descartan
  // solas; las que sí tienen algo escrito deben cumplir la misma regla que el
  // destino principal.
  const paradas = paradasExtra
    .filter(p => p.destino.trim())
    .map(p => ({ destino: p.destino.trim(), contacto: p.contacto.trim(), telefono: p.telefono.replace(/\D/g, '') }));
  const paradaCorta = paradas.find(p => p.destino.length < 6);

  if (!ok || paradaCorta) {
    refrescarHoras();
    toast('Revisa el formulario', paradaCorta
      ? 'Cada parada adicional necesita una dirección de al menos 6 caracteres.'
      : 'Hay campos pendientes o fuera de rango.', 'bad');
    return;
  }

  // El correlativo lo asigna el servidor dentro de la misma transacción que
  // inserta: con dos personas registrando a la vez, proponerlo desde aquí
  // garantizaría números repetidos.
  let s;
  try {
    s = await crearSolicitud({
      dni: sesion.dni, nombre: sesion.nombre, cargo: sesion.cargo, area: sesion.area,
      tipo: accionSel, servicio, motivo, origen, origenDetalle: origen === 'Otros' ? otro : '',
      destino: dest, contacto: cont, telefono: tel,
      fechaProg: fecha, horaProg: hora, paradas
    });
  } catch (e) {
    toast('No se pudo registrar', e.message, 'bad');
    return;
  }

  $('okTitle').textContent = 'Ticket ' + s.id + ' registrado';
  $('okMsg').textContent = 'Logística lo verá en su bandeja y asignará transporte y tarifa. Consulta el avance con este correlativo en la pestaña Seguimiento.';
  $('okBox').classList.add('on');
  toast('Solicitud registrada', s.id + ' quedó en espera de asignación.');

  ['fServicio', 'fMotivo', 'fDestino', 'fContacto', 'fTel', 'fOrigenOtro', 'fHora'].forEach(id => { $(id).value = ''; $(id).classList.remove('bad'); });
  limpiarParadas();
  resetAccion();
  $('fAccion').classList.remove('bad');
  document.querySelectorAll('.err').forEach(e => e.classList.remove('on'));
  $('qTicket').value = numeroTicket(s.id);
  $('fOrigen').value = ''; toggleOrigen();
  refrescarHoras();
  renderMis();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
