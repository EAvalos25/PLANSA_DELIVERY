import { $, esc } from '../utils/dom.js';
import { fechaCorta, horasEntre, corta, hoyISO } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { DB, exportarExcel } from '../api/estado.js';
import { chipEstado, origenCorto } from './presenters.js';
import { abrirModal, cerrarModal } from './dispatch.js';

/**
 * Histórico de servicios: tabla filtrable de una fila por servicio y
 * exportación a CSV (24 columnas planas, listo para Power BI / Looker Studio).
 */
const COLUMNAS = [
  ['ticket', s => s.id],
  ['fuente', s => s.fuente === 'historico' ? 'planilla_2026' : 'app'],
  ['fecha_registro', s => s.creado.slice(0, 10)],
  ['dni_solicitante', s => s.dni],
  ['solicitante', s => s.nombre],
  ['area', s => s.area],
  ['cargo', s => s.cargo || ''],
  ['accion', s => s.tipo],
  ['tipo_servicio', s => s.servicio || ''],
  ['motivo', s => s.motivo],
  ['origen', s => s.origen],
  ['origen_detalle', s => s.origenDetalle || ''],
  ['destino', s => s.destino],
  ['contacto_receptor', s => s.contacto],
  ['telefono_contacto', s => s.telefono],
  ['fecha_programada', s => s.fechaProg],
  ['hora_programada', s => s.horaProg],
  ['vehiculo', s => s.vehiculo || ''],
  ['costo_soles', s => s.costo != null ? s.costo.toFixed(2) : ''],
  ['estado', s => s.estado],
  ['fecha_transito', s => s.tsTransito ? s.tsTransito.slice(0, 16).replace('T', ' ') : ''],
  ['fecha_conclusion', s => s.tsConcluido ? s.tsConcluido.slice(0, 16).replace('T', ' ') : ''],
  ['horas_espera', s => { const h = horasEntre(s.tsEspera, s.tsTransito); return h != null ? h.toFixed(2) : ''; }],
  ['horas_transito', s => { const h = horasEntre(s.tsTransito, s.tsConcluido); return h != null ? h.toFixed(2) : ''; }]
];

/**
 * Cuántas filas se pintan como máximo.
 *
 * El histórico pasa de mil quinientos servicios y crece cada día. Volcarlos
 * todos son ~20 000 celdas en el DOM, y la tabla se repinta cada vez que
 * alguien cambia algo desde otra PC: el navegador se traba unos segundos para
 * mostrar filas que nadie va a leer. Se pintan las más recientes y el resto se
 * alcanza filtrando, que es como se usa de verdad. El CSV sí exporta todo.
 */
const MAX_FILAS = 300;

/** Repinta solo si la pestaña está a la vista, como hace el panel de indicadores. */
export function renderHistoricoSiVisible() {
  if ($('aHistorico').classList.contains('on')) renderHistorico();
}

export function renderHistorico() {
  $('cntHist').textContent = DB.solicitudes.length;
  const q = ($('qHist').value || '').toLowerCase().trim();
  let lista = DB.solicitudes.slice().sort((a, b) => b.creado.localeCompare(a.creado));
  if (q) lista = lista.filter(s => (s.id + ' ' + s.nombre + ' ' + s.dni + ' ' + s.destino + ' ' + s.motivo + ' ' + s.area + ' ' + (s.servicio || '')).toLowerCase().includes(q));

  if (!lista.length) {
    $('tHist').innerHTML = '<div class="empty"><strong>Sin coincidencias</strong>Prueba con otro ticket, solicitante o destino.</div>';
    return;
  }
  const coincidencias = lista.length;
  const recortada = coincidencias > MAX_FILAS;
  if (recortada) lista = lista.slice(0, MAX_FILAS);

  const filas = lista.map(s => {
    const he = horasEntre(s.tsEspera, s.tsTransito);
    const ht = horasEntre(s.tsTransito, s.tsConcluido);
    return '<tr>'
      + '<td><span class="tk">' + s.id + '</span></td>'
      + '<td class="nowrap">' + fechaCorta(s.creado) + '</td>'
      + '<td class="cell-2">' + esc(corta(s.nombre, 20)) + '<span>' + esc(s.area) + '</span></td>'
      + '<td class="cell-2">' + s.tipo + '<span>' + esc(corta(s.servicio || '—', 18)) + '</span></td>'
      + '<td>' + esc(origenCorto(s)) + '</td>'
      + '<td>' + esc(corta(s.destino, 34)) + '</td>'
      + '<td>' + (s.vehiculo || '<span class="muted">N/D</span>') + '</td>'
      + '<td class="num">' + (s.costo != null ? s.costo.toFixed(2) : '<span class="muted">N/D</span>') + '</td>'
      + '<td class="num">' + (he != null ? he.toFixed(1) : '<span class="muted">N/D</span>') + '</td>'
      + '<td class="num">' + (ht != null ? ht.toFixed(1) : '<span class="muted">N/D</span>') + '</td>'
      + '<td>' + chipEstado(s.estado) + '</td>'
      + '<td><button class="btn btn-sm btn-ghost" onclick="verDetalle(\'' + s.id + '\')">Ver</button></td>'
      + '</tr>';
  }).join('');
  const aviso = recortada
    ? '<div class="hint" style="padding:10px 12px">Se muestran los ' + MAX_FILAS
      + ' servicios más recientes de ' + coincidencias
      + ' que coinciden. Filtra por ticket, solicitante o destino para llegar al resto; '
      + 'el CSV los exporta todos.</div>'
    : '';

  $('tHist').innerHTML = '<table><thead><tr>'
    + '<th>Ticket</th><th>Registro</th><th>Solicitante</th><th>Servicio</th><th>Origen</th><th>Destino</th>'
    + '<th>Transporte</th><th class="num">Costo S/</th><th class="num">Espera h</th><th class="num">Tránsito h</th><th>Estado</th><th></th>'
    + '</tr></thead><tbody>' + filas + '</tbody></table>' + aviso;
}

export function exportarCSV() {
  const sep = ';';
  const limpia = v => { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const filas = [COLUMNAS.map(c => c[0]).join(sep)];
  DB.solicitudes.slice().sort((a, b) => a.id.localeCompare(b.id)).forEach(s => {
    filas.push(COLUMNAS.map(c => limpia(c[1](s))).join(sep));
  });
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mensajeria_plasticos_nacionales_' + hoyISO() + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast('CSV generado', DB.solicitudes.length + ' servicios exportados.');
}

/**
 * Reporte de viajes en Excel (columnas tipadas: fecha y número de verdad, no
 * texto) con rango de fechas a elección. Lo arma el servidor
 * (GET /api/solicitudes/exportar), así que hace falta pedir el rango antes de
 * descargar: por eso va en un modal y no es un botón directo como el CSV.
 */
export function abrirExportarExcel() {
  const html = '<p class="sub">Filtra por la fecha programada del viaje. Deja los campos vacíos para exportar todo el histórico.</p>'
    + '<div class="row">'
    + '<div class="field" style="margin:0"><label for="expDesde">Desde</label><input class="input" id="expDesde" type="date"></div>'
    + '<div class="field" style="margin:0"><label for="expHasta">Hasta</label><input class="input" id="expHasta" type="date"></div>'
    + '</div>'
    + '<div class="err" id="eExportar"></div>'
    + '<button class="btn btn-sm" style="margin-top:14px" onclick="confirmarExportarExcel()">Descargar Excel</button>';
  abrirModal('Exportar viajes a Excel', html);
}

export async function confirmarExportarExcel() {
  const desde = $('expDesde').value || '';
  const hasta = $('expHasta').value || '';
  if (desde && hasta && desde > hasta) {
    $('eExportar').textContent = 'La fecha "desde" no puede ser posterior a "hasta".';
    $('eExportar').classList.add('on');
    return;
  }
  $('eExportar').classList.remove('on');

  let r;
  try {
    r = await exportarExcel(desde, hasta);
  } catch (e) {
    $('eExportar').textContent = e.message;
    $('eExportar').classList.add('on');
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.blob);
  a.download = r.nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  cerrarModal();
  toast('Excel generado', 'Se descargó ' + r.nombre + '.');
}
