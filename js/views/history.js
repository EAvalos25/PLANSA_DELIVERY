import { $, esc } from '../utils/dom.js';
import { fechaCorta, horasEntre, corta, hoyISO } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { DB } from '../db/index.js';
import { chipEstado, origenCorto } from './presenters.js';

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

export function renderHistorico() {
  $('cntHist').textContent = DB.solicitudes.length;
  const q = ($('qHist').value || '').toLowerCase().trim();
  let lista = DB.solicitudes.slice().sort((a, b) => b.creado.localeCompare(a.creado));
  if (q) lista = lista.filter(s => (s.id + ' ' + s.nombre + ' ' + s.dni + ' ' + s.destino + ' ' + s.motivo + ' ' + s.area + ' ' + (s.servicio || '')).toLowerCase().includes(q));

  if (!lista.length) {
    $('tHist').innerHTML = '<div class="empty"><strong>Sin coincidencias</strong>Prueba con otro ticket, solicitante o destino.</div>';
    return;
  }
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
  $('tHist').innerHTML = '<table><thead><tr>'
    + '<th>Ticket</th><th>Registro</th><th>Solicitante</th><th>Servicio</th><th>Origen</th><th>Destino</th>'
    + '<th>Transporte</th><th class="num">Costo S/</th><th class="num">Espera h</th><th class="num">Tránsito h</th><th>Estado</th><th></th>'
    + '</tr></thead><tbody>' + filas + '</tbody></table>';
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
