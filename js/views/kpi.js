import { $, esc } from '../utils/dom.js';
import { pad, isoDia, fechaCorta, soles, solesK, horasEntre, corta } from '../utils/format.js';
import { DB } from '../store.js';
import { origenCorto } from './presenters.js';

/**
 * Panel de indicadores: tarjetas KPI y gráficos (barras horizontales y
 * columnas SVG) sobre el rango de fechas seleccionado.
 */
let filtroKpi = 30;

export function setFiltroKpi(d) { filtroKpi = d; renderKpi(); }
export function renderKpiSiVisible() { if ($('aKpi').classList.contains('on')) renderKpi(); }

function barras(items, total, clase) {
  if (!items.length) return '<div class="empty" style="padding:26px 0"><strong>Sin datos todavía</strong>Los gráficos se llenan cuando haya servicios registrados.</div>';
  const max = Math.max.apply(null, items.map(i => i.v)) || 1;
  return '<div class="bars">' + items.map(i =>
    '<div class="bar-row ' + (clase || '') + '">'
    + '<div class="bar-lbl">' + esc(i.k) + '</div>'
    + '<div class="bar-val">' + esc(i.t) + '</div>'
    + '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(2, (i.v / max) * 100).toFixed(1) + '%"></div></div>'
    + '</div>').join('') + '</div>';
}

function columnas(dias) {
  if (!dias.length) return '<div class="empty" style="padding:26px 0"><strong>Sin movimiento en el rango</strong>Amplía el filtro de fechas.</div>';
  const W = 520, H = 180, pb = 26, pl = 4;
  const max = Math.max.apply(null, dias.map(d => d.v)) || 1;
  const ancho = (W - pl * 2) / dias.length;
  const barra = Math.min(ancho - 4, 22);
  let g = '';
  // guías horizontales
  for (let i = 0; i <= 2; i++) {
    const y = (H - pb) - ((H - pb) * i / 2);
    g += '<line x1="0" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) + '" stroke="#223142" stroke-width="1"/>';
  }
  dias.forEach((d, i) => {
    const h = Math.max(2, (d.v / max) * (H - pb - 14));
    const x = pl + i * ancho + (ancho - barra) / 2;
    const y = (H - pb) - h;
    g += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barra.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="#F2A93B" opacity="' + (d.v ? 1 : .3) + '"><title>' + d.k + ': ' + d.v + ' servicios</title></rect>';
    if (d.v) g += '<text x="' + (x + barra / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" fill="#8FA3B8" font-size="10" font-family="ui-monospace,monospace" text-anchor="middle">' + d.v + '</text>';
    if (i % 3 === 0 || i === dias.length - 1)
      g += '<text x="' + (x + barra / 2).toFixed(1) + '" y="' + (H - 8) + '" fill="#647d96" font-size="10" font-family="ui-monospace,monospace" text-anchor="middle">' + d.k.slice(0, 5) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Servicios por día">' + g + '</svg>';
}

export function renderKpi() {
  const corte = new Date(); corte.setHours(0, 0, 0, 0); corte.setDate(corte.getDate() - (filtroKpi - 1));
  const todo = filtroKpi === 0;
  const lista = DB.solicitudes.filter(s => todo || new Date(s.creado) >= corte);

  $('fKpi').innerHTML = [[7, '7 días'], [30, '30 días'], [90, '90 días'], [0, 'Todo']]
    .map(([d, l]) => '<button class="fchip' + (filtroKpi === d ? ' on' : '') + '" onclick="setFiltroKpi(' + d + ')">' + l + '</button>').join('');

  const conCosto = lista.filter(s => s.costo != null);
  const costoTotal = conCosto.reduce((a, s) => a + s.costo, 0);
  const concluidos = lista.filter(s => s.estado === 'Concluido');
  const enCurso = lista.filter(s => s.estado !== 'Concluido');

  const diasSet = new Set(lista.map(s => s.creado.slice(0, 10)));
  const diasHabiles = Math.max(1, diasSet.size);
  const promDia = lista.length / diasHabiles;

  const tiempos = concluidos.map(s => horasEntre(s.tsEspera, s.tsConcluido)).filter(h => h != null);
  const promAtencion = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;

  $('kpiRango').textContent = todo
    ? 'Todo el histórico · ' + lista.length + ' servicios'
    : 'Últimos ' + filtroKpi + ' días · ' + fechaCorta(corte) + ' al ' + fechaCorta(new Date());

  $('kpiCards').innerHTML = [
    { c: 'amber', v: lista.length, k: 'Viajes totales', d: diasSet.size + ' días con movimiento' },
    { c: 'green', v: solesK(costoTotal), k: 'Costo valorizado', d: conCosto.length + ' de ' + lista.length + ' con tarifa cargada' },
    { c: '', v: promDia.toFixed(1), k: 'Promedio de viajes al día', d: 'Sobre días con actividad' },
    { c: '', v: conCosto.length ? soles(costoTotal / conCosto.length) : 'N/D', k: 'Costo promedio por viaje', d: 'Solo servicios tarifados' },
    { c: 'cyan', v: enCurso.length, k: 'En curso', d: lista.filter(s => s.estado === 'En espera').length + ' en espera · ' + lista.filter(s => s.estado === 'En tránsito').length + ' en tránsito' },
    { c: '', v: promAtencion != null ? promAtencion.toFixed(1) + ' h' : 'N/D', k: 'Atención de punta a punta', d: 'Del registro al cierre' }
  ].map(x => '<div class="kpi ' + x.c + '"><div class="v">' + x.v + '</div><div class="k">' + x.k + '</div><div class="d">' + x.d + '</div></div>').join('');

  // servicios por día (últimos 21 días del rango)
  const dias = [];
  const n = Math.min(21, todo ? 21 : filtroKpi);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const iso = isoDia(d);
    dias.push({ k: pad(d.getDate(), 2) + '/' + pad(d.getMonth() + 1, 2), v: lista.filter(s => s.creado.slice(0, 10) === iso).length });
  }
  $('chDias').innerHTML = columnas(dias);

  // costo por sede de origen
  const sedes = {};
  lista.forEach(s => { const k = origenCorto(s); sedes[k] = sedes[k] || { n: 0, c: 0 }; sedes[k].n++; sedes[k].c += (s.costo || 0); });
  $('chSedes').innerHTML = barras(
    Object.entries(sedes).sort((a, b) => b[1].c - a[1].c)
      .map(([k, o]) => ({ k, v: o.c, t: soles(o.c) + ' · ' + o.n + ' viajes' })), null, 'c3');

  // ranking de solicitantes
  const users = {};
  lista.forEach(s => {
    users[s.dni] = users[s.dni] || { n: 0, c: 0, nombre: s.nombre };
    users[s.dni].n++; users[s.dni].c += (s.costo || 0);
  });
  $('chUsuarios').innerHTML = barras(
    Object.entries(users).sort((a, b) => b[1].n - a[1].n).slice(0, 8)
      .map(([dni, o]) => ({ k: o.nombre + ' · DNI ' + dni, v: o.n, t: o.n + ' viajes · ' + soles(o.c) })));

  // ranking de destinos
  const dest = {};
  lista.forEach(s => { const k = s.destino.split(' - ')[0]; dest[k] = dest[k] || { n: 0, c: 0 }; dest[k].n++; dest[k].c += (s.costo || 0); });
  $('chDestinos').innerHTML = barras(
    Object.entries(dest).sort((a, b) => b[1].n - a[1].n).slice(0, 8)
      .map(([k, o]) => ({ k: corta(k, 40), v: o.n, t: o.n + ' visitas' })), null, 'c2');

  // vehículos
  const veh = {};
  lista.filter(s => s.vehiculo).forEach(s => { veh[s.vehiculo] = veh[s.vehiculo] || { n: 0, c: 0 }; veh[s.vehiculo].n++; veh[s.vehiculo].c += (s.costo || 0); });
  $('chVehiculo').innerHTML = barras(
    Object.entries(veh).sort((a, b) => b[1].n - a[1].n)
      .map(([k, o]) => ({ k, v: o.n, t: o.n + ' viajes · ' + soles(o.c) + ' · ' + soles(o.n ? o.c / o.n : 0) + '/viaje' })), null, 'c4');

  // tiempos del flujo
  const prom = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const tEspera = prom(lista.map(s => horasEntre(s.tsEspera, s.tsTransito)).filter(h => h != null));
  const tRuta = prom(lista.map(s => horasEntre(s.tsTransito, s.tsConcluido)).filter(h => h != null));
  const filasT = [];
  if (tEspera != null) filasT.push({ k: 'Registro → salida', v: tEspera, t: tEspera.toFixed(1) + ' h' });
  if (tRuta != null) filasT.push({ k: 'Salida → cierre', v: tRuta, t: tRuta.toFixed(1) + ' h' });
  if (promAtencion != null) filasT.push({ k: 'Ciclo completo', v: promAtencion, t: promAtencion.toFixed(1) + ' h' });
  $('chTiempos').innerHTML = barras(filasT, null, 'c2');
}
