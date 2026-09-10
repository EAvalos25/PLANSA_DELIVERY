import { esc } from '../utils/dom.js';
import { fechaHora, fechaCorta, soles, corta } from '../utils/format.js';
import { adjuntosResumenHTML } from './attachments.js';

/**
 * Helpers de presentación (generación de HTML) compartidos por las vistas
 * de seguimiento, bandeja, histórico e indicadores.
 */

export function chipEstado(e, paraUsuario) {
  const map = { 'En espera': 'st-espera', 'En tránsito': 'st-transito', 'Concluido': 'st-concluido' };
  const txt = (paraUsuario && e === 'Concluido') ? 'Terminado' : e;
  return '<span class="chip ' + map[e] + '"><i class="dot"></i>' + txt + '</span>';
}

export function origenTexto(s) { return s.origen === 'Otros' ? (s.origenDetalle || 'Otros') : s.origen; }

export function origenCorto(s) {
  if (s.origen === 'Otros') return 'Otros';
  return s.origen.replace('Plásticos Nacionales - ', '');
}

export function railHTML(s, paraUsuario) {
  const pasos = [
    { k: 'En espera', lbl: 'En espera', ts: s.tsEspera },
    { k: 'En tránsito', lbl: 'En tránsito', ts: s.tsTransito },
    { k: 'Concluido', lbl: (paraUsuario ? 'Terminado' : 'Concluido'), ts: s.tsConcluido }
  ];
  const idx = { 'En espera': 0, 'En tránsito': 1, 'Concluido': 2 }[s.estado];
  return '<div class="rail">' + pasos.map((p, i) => {
    let cls = 'rail-step';
    if (i < idx) cls += ' done';
    if (i === idx) cls += ' now' + (i === 1 ? ' transit' : '');
    if (i === 2 && idx === 2) cls = 'rail-step done';
    return '<div class="' + cls + '"><div class="bead"></div><div class="lbl">' + p.lbl + '</div><div class="tm">' + (p.ts ? fechaHora(p.ts).slice(-5) : '·') + '</div></div>';
  }).join('') + '</div>';
}

export function ticketHTML(s) {
  return '<article class="ticket">'
    + '<div class="ticket-top"><div><div class="ticket-code">' + s.id + '</div>'
    + '<div class="ticket-meta">' + s.tipo + ' · ' + esc(s.servicio || 'Servicio') + ' · registrado el ' + fechaHora(s.creado) + '</div></div>'
    + chipEstado(s.estado, true) + '</div>'
    + railHTML(s, true)
    + '<div class="route"><div class="route-rail"><div class="pt"></div><div class="ln"></div><div class="pt end"></div></div>'
    + '<div class="route-body"><div><span>Origen</span><b>' + esc(origenTexto(s)) + '</b></div>'
    + '<div><span>Destino</span><b>' + esc(s.destino) + '</b></div></div></div>'
    + '<div class="ticket-facts">'
    + '<div class="fact">Programado <b>' + fechaCorta(s.fechaProg) + ' · ' + s.horaProg + '</b></div>'
    + '<div class="fact">Motivo <b>' + esc(corta(s.motivo, 44)) + '</b></div>'
    + '<div class="fact">Recibe <b>' + esc(s.contacto) + '</b></div>'
    + '<div class="fact mono">Contacto <b>' + esc(s.telefono) + '</b></div>'
    + '<div class="fact">Transporte <b>' + (s.vehiculo || 'por asignar') + '</b></div>'
    + '<div class="fact mono">Costo <b>' + (s.costo != null ? soles(s.costo) : 'por asignar') + '</b></div>'
    + '</div>'
    + adjuntosResumenHTML(s.id)
    + '</article>';
}
