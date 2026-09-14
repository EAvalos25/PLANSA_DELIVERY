import { $, esc } from '../utils/dom.js';
import { fechaHora, fechaCorta, horasEntre, corta, soles } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { DB, guardar } from '../db/index.js';
import { sesion } from '../state/sessionState.js';
import { chipEstado, origenTexto, origenCorto, railHTML, oGuion } from './presenters.js';
import { tarifaDe } from '../db/destinos.js';
import { adjuntosHTML, indicadorAdjuntos, refrescarAdjuntos } from './attachments.js';
import { renderKpiSiVisible } from './kpi.js';
// Import circular intencional: render.js también importa de este módulo.
// Es seguro porque renderTodo solo se invoca desde manejadores de eventos
// (avanzar), nunca durante la carga inicial de los módulos.
import { renderTodo } from '../render.js';

/**
 * Bandeja de despacho de logística: filtrado, asignación de transporte/tarifa,
 * avance de estado y modal de detalle/gestión de un ticket.
 */
let filtroBandeja = 'Activos';

export function buscar(id) { return DB.solicitudes.find(s => s.id === id); }

export function renderBandeja() {
  const activos = DB.solicitudes.filter(s => s.estado !== 'Concluido');
  $('cntBandeja').textContent = activos.length;

  const opciones = [
    ['Activos', 'En curso'],
    ['En espera', 'En espera'],
    ['En tránsito', 'En tránsito'],
    ['Concluido', 'Concluidos'],
    ['Todos', 'Todos']
  ];
  $('fBandeja').innerHTML = opciones.map(([k, l]) => {
    const n = k === 'Activos' ? activos.length
      : k === 'Todos' ? DB.solicitudes.length
      : DB.solicitudes.filter(s => s.estado === k).length;
    return '<button class="fchip' + (filtroBandeja === k ? ' on' : '') + '" onclick="setFiltroBandeja(\'' + k + '\')">' + l + ' (' + n + ')</button>';
  }).join('');

  let lista = DB.solicitudes.slice();
  if (filtroBandeja === 'Activos') lista = lista.filter(s => s.estado !== 'Concluido');
  else if (filtroBandeja !== 'Todos') lista = lista.filter(s => s.estado === filtroBandeja);
  const orden = { 'En espera': 0, 'En tránsito': 1, 'Concluido': 2 };
  lista.sort((a, b) => (orden[a.estado] - orden[b.estado]) || (a.fechaProg + a.horaProg).localeCompare(b.fechaProg + b.horaProg));

  if (!lista.length) {
    $('tBandeja').innerHTML = '<div class="empty"><strong>No hay servicios en este filtro</strong>Cambia el filtro o espera nuevas solicitudes.</div>';
    return;
  }

  const filas = lista.map(s => {
    const bloqueado = s.estado === 'Concluido';
    const ref = tarifaDe(s.destino);
    return '<tr>'
      + '<td><span class="tk">' + s.id + '</span>' + indicadorAdjuntos(s.id)
      + '<div class="small muted">' + fechaHora(s.creado).slice(0, 10) + '</div></td>'
      + '<td class="cell-2">' + esc(corta(s.nombre, 22)) + '<span>' + esc(s.area) + '</span></td>'
      + '<td class="cell-2">' + s.tipo + '<span>' + esc(corta(s.servicio || '—', 24)) + '</span></td>'
      + '<td class="cell-2">' + esc(corta(s.destino, 38)) + '<span>Desde ' + esc(origenCorto(s)) + ' · ' + esc(oGuion(s.contacto)) + ' · ' + esc(oGuion(s.telefono)) + '</span></td>'
      + '<td class="nowrap">' + fechaCorta(s.fechaProg) + '<div class="small muted">' + esc(oGuion(s.horaProg)) + '</div></td>'
      + '<td><select class="mini-select" ' + (bloqueado ? 'disabled' : '') + ' onchange="setVehiculo(\'' + s.id + '\',this.value)">'
      + '<option value=""' + (!s.vehiculo ? ' selected' : '') + '>Sin asignar</option>'
      + '<option' + (s.vehiculo === 'Motorizado' ? ' selected' : '') + '>Motorizado</option>'
      + '<option' + (s.vehiculo === 'Carro' ? ' selected' : '') + '>Carro</option></select></td>'
      + '<td><input class="mini-input" type="number" min="0" step="0.5"'
      + ' placeholder="' + (ref ? ref.tarifa.toFixed(2) : '0.00') + '"'
      + (ref ? ' title="Tarifa habitual de este destino: ' + soles(ref.tarifa) + ' en ' + ref.viajes + ' viajes de 2026"' : '')
      + (bloqueado ? ' disabled' : '')
      + ' value="' + (s.costo != null ? s.costo : '') + '" onchange="setCosto(\'' + s.id + '\',this.value)"></td>'
      + '<td>' + chipEstado(s.estado) + '</td>'
      + '<td class="nowrap">' + accionesHTML(s) + '</td>'
      + '</tr>';
  }).join('');

  $('tBandeja').innerHTML = '<table><thead><tr>'
    + '<th>Ticket</th><th>Solicitante</th><th>Servicio</th><th>Destino</th><th>Programado</th>'
    + '<th>Transporte</th><th>Tarifa S/</th><th>Estado</th><th>Acciones</th>'
    + '</tr></thead><tbody>' + filas + '</tbody></table>';
}

function accionesHTML(s) {
  let b = '';
  if (s.estado === 'En espera') b += '<button class="btn btn-sm btn-info" onclick="avanzar(\'' + s.id + '\')">Pasar a tránsito</button> ';
  if (s.estado === 'En tránsito') b += '<button class="btn btn-sm btn-ok" onclick="avanzar(\'' + s.id + '\')">Finalizar</button> ';
  b += '<button class="btn btn-sm btn-ghost" onclick="verDetalle(\'' + s.id + '\')">Gestionar</button>';
  return b;
}

export function setFiltroBandeja(k) { filtroBandeja = k; renderBandeja(); }

export function setVehiculo(id, v) {
  const s = buscar(id); if (!s) return;
  s.vehiculo = v || null; guardar();
  toast('Transporte actualizado', s.id + ': ' + (v || 'sin asignar'));
}

export function setCosto(id, v) {
  const s = buscar(id); if (!s) return;
  const n = parseFloat(v);
  s.costo = isNaN(n) || n < 0 ? null : Math.round(n * 100) / 100;
  guardar();
  toast('Tarifa actualizada', s.id + ': ' + (s.costo != null ? soles(s.costo) : 'sin tarifa'));
  renderKpiSiVisible();
}

export function avanzar(id) {
  const s = buscar(id); if (!s) return;
  if (s.estado === 'En espera') {
    if (!s.vehiculo) { toast('Falta el transporte', 'Asigna Carro o Motorizado antes de mover ' + s.id + ' a tránsito.', 'warn'); return; }
    s.estado = 'En tránsito'; s.tsTransito = new Date().toISOString();
    toast(s.id + ' en tránsito', 'El conductor está en ruta.');
  } else if (s.estado === 'En tránsito') {
    if (s.costo == null) { toast('Falta la tarifa', 'Ingresa el costo de ' + s.id + ' para cerrarlo.', 'warn'); return; }
    s.estado = 'Concluido'; s.tsConcluido = new Date().toISOString();
    toast(s.id + ' concluido', 'La data pasó al módulo de indicadores.');
  }
  guardar();
  renderTodo();
}

export function verDetalle(id) {
  const s = buscar(id); if (!s) return;
  const he = horasEntre(s.tsEspera, s.tsTransito);
  const ht = horasEntre(s.tsTransito, s.tsConcluido);
  const admin = sesion && sesion.tipo === 'admin';
  const ref = tarifaDe(s.destino);
  // Lo que se pagó históricamente por ir a ese destino, para no tarifar a ciegas.
  const referencia = ref
    ? '<div class="hint" style="margin-top:10px">Tarifa habitual de este destino: <b>' + soles(ref.tarifa) + '</b>'
      + ' · ' + ref.viajes + ' viajes en 2026, entre ' + soles(ref.min) + ' y ' + soles(ref.max) + '. '
      + '<button class="btn btn-sm btn-ghost" onclick="setCosto(\'' + s.id + '\',' + ref.tarifa + ');verDetalle(\'' + s.id + '\')">Aplicar</button></div>'
    : '<div class="hint" style="margin-top:10px">Destino sin historial de tarifas: no está entre los habituales de 2026.</div>';
  let gestion = '';
  if (admin && s.estado !== 'Concluido') {
    const sel = v => (s.vehiculo === v ? ' selected' : '');
    gestion = '<div class="card card-pad" style="background:var(--surface2);margin-bottom:18px">'
      + '<div class="row">'
      + '<div class="field" style="margin:0"><label>Tipo de transporte</label>'
      + '<select class="select" onchange="setVehiculo(\'' + s.id + '\',this.value);verDetalle(\'' + s.id + '\')">'
      + '<option value=""' + (s.vehiculo ? '' : ' selected') + '>Sin asignar</option>'
      + '<option' + sel('Motorizado') + '>Motorizado</option><option' + sel('Carro') + '>Carro</option></select></div>'
      + '<div class="field" style="margin:0"><label>Tarifa del servicio (S/)</label>'
      + '<input class="input" type="number" min="0" step="0.5" placeholder="0.00" value="' + (s.costo != null ? s.costo : '') + '"'
      + ' onchange="setCosto(\'' + s.id + '\',this.value);verDetalle(\'' + s.id + '\')"></div></div>'
      + referencia
      + '<div style="margin-top:14px">'
      + (s.estado === 'En espera'
        ? '<button class="btn btn-sm btn-info" onclick="avanzar(\'' + s.id + '\');verDetalle(\'' + s.id + '\')">Pasar a en tránsito</button>'
        : '<button class="btn btn-sm btn-ok" onclick="avanzar(\'' + s.id + '\');verDetalle(\'' + s.id + '\')">Marcar como concluido</button>')
      + '</div></div>';
  }
  const html = gestion + railHTML(s)
    + '<dl class="detail-grid">'
    + '<dt>Estado</dt><dd>' + chipEstado(s.estado) + '</dd>'
    + '<dt>Solicitante</dt><dd>' + esc(s.nombre) + (s.dni ? ' · DNI ' + esc(s.dni) : '') + '<br><span class="muted small">' + esc(oGuion(s.area)) + '</span></dd>'
    + '<dt>Acción</dt><dd>' + s.tipo + '</dd>'
    + '<dt>Tipo de servicio</dt><dd>' + esc(s.servicio || 'N/D') + '</dd>'
    + '<dt>Motivo</dt><dd>' + esc(oGuion(s.motivo)) + '</dd>'
    + '<dt>Origen</dt><dd>' + esc(origenTexto(s)) + '</dd>'
    + '<dt>Destino</dt><dd>' + esc(s.destino) + '</dd>'
    + '<dt>Recibe</dt><dd>' + esc(oGuion(s.contacto)) + ' · ' + esc(oGuion(s.telefono)) + '</dd>'
    + '<dt>Programado</dt><dd>' + fechaCorta(s.fechaProg) + (s.horaProg ? ' a las ' + s.horaProg : '') + '</dd>'
    + '<dt>Registrado</dt><dd>' + fechaHora(s.creado) + '</dd>'
    + '<dt>Salida</dt><dd>' + fechaHora(s.tsTransito) + '</dd>'
    + '<dt>Cierre</dt><dd>' + fechaHora(s.tsConcluido) + '</dd>'
    + '<dt>Transporte</dt><dd>' + (s.vehiculo || 'Sin asignar') + '</dd>'
    + '<dt>Costo</dt><dd>' + (s.costo != null ? soles(s.costo) : 'Sin tarifa') + '</dd>'
    + '<dt>Espera</dt><dd>' + (he != null ? he.toFixed(1) + ' h' : 'N/D') + '</dd>'
    + '<dt>Tránsito</dt><dd>' + (ht != null ? ht.toFixed(1) + ' h' : 'N/D') + '</dd>'
    + '<dt>Origen del dato</dt><dd>' + (s.fuente === 'historico'
        ? 'Planilla de logística 2026 <span class="muted small">(solo consta el día del servicio)</span>'
        : 'Registrado en la aplicación') + '</dd>'
    + '</dl>'
    + adjuntosHTML(s.id, admin);
  abrirModal('Ticket ' + s.id, html);
  // El índice de archivos puede haber cambiado en otra pestaña: se repinta
  // el bloque de adjuntos en cuanto termine la lectura del almacenamiento.
  refrescarAdjuntos(s.id, admin);
}

export function abrirModal(t, html) { $('modalTitle').textContent = t; $('modalBody').innerHTML = html; $('overlay').classList.add('on'); }
export function cerrarModal() { $('overlay').classList.remove('on'); }
