import { esc } from '../../utils/dom.js';
import { ZONAS, zonaPorId } from '#data/payback/zonas.js';
import { OPERACION, JORNADA } from '#data/payback/parametros.js';
import { simularSalida, mejorOrden } from '#shared/payback/ruta.js';

/**
 * Simulador de una salida: el usuario arma la ruta y ve si entra en la jornada.
 *
 * Responde la pregunta concreta que tiene logística delante cada mañana: "con
 * estos encargos, ¿me da el tiempo?". El modelo de capacidad razona en
 * promedios semanales; esto razona en una salida real, con su orden, su hora y
 * su retorno a planta.
 *
 * Todo lo editable vive en `estado`: las paradas, la hora de salida, los
 * minutos por parada y los tiempos de viaje. Nada de esto se guarda; es un
 * tablero para probar hipótesis.
 */

const estado = {
  paradas: [
    { zonaId: 'norte', paradas: 3 },
    { zonaId: 'centro', paradas: 2 },
    { zonaId: 'moderna', paradas: 3 }
  ],
  salida: JORNADA.entreSemana.desde,
  sabado: false,
  minutosPorParada: OPERACION.minutosPorParada,
  /** Sobrescrituras de los tiempos de ../data/zonas.js, solo en pantalla. */
  desdePlanta: {}
};

/** El repintado lo inyecta vista.js, para no acoplar el simulador a la pantalla. */
let repintar = () => {};
export function alCambiar(fn) { repintar = fn; }

// ------------------------------------------------------------ manejadores
export function pbAgregarParada() {
  const usadas = estado.paradas.map(p => p.zonaId);
  const libre = ZONAS.find(z => !usadas.includes(z.id)) || ZONAS[0];
  estado.paradas.push({ zonaId: libre.id, paradas: 2 });
  repintar();
}

export function pbQuitarParada(i) {
  estado.paradas.splice(i, 1);
  repintar();
}

export function pbZonaParada(i, zonaId) {
  if (estado.paradas[i]) estado.paradas[i].zonaId = zonaId;
  repintar();
}

export function pbCuantasParadas(i, n) {
  const v = Math.max(1, Math.min(20, Math.round(Number(n) || 1)));
  if (estado.paradas[i]) estado.paradas[i].paradas = v;
  repintar();
}

export function pbHoraSalida(v) {
  if (/^\d{2}:\d{2}$/.test(v)) estado.salida = v;
  repintar();
}

export function pbDiaSimulado(v) {
  estado.sabado = v === 'sabado';
  // El sábado la jornada arranca igual, pero termina mucho antes.
  repintar();
}

export function pbMinutosParada(v) {
  estado.minutosPorParada = Math.max(1, Math.min(90, Math.round(Number(v) || 1)));
  repintar();
}

export function pbTiempoZona(zonaId, v) {
  const n = Math.max(1, Math.min(300, Math.round(Number(v) || 1)));
  estado.desdePlanta[zonaId] = n;
  repintar();
}

export function pbOrdenarMejor() {
  const { orden } = mejorOrden(estado.paradas, opciones());
  estado.paradas = orden;
  repintar();
}

export function pbReiniciarSimulador() {
  estado.paradas = [{ zonaId: 'norte', paradas: 3 }, { zonaId: 'centro', paradas: 2 }, { zonaId: 'moderna', paradas: 3 }];
  estado.salida = JORNADA.entreSemana.desde;
  estado.sabado = false;
  estado.minutosPorParada = OPERACION.minutosPorParada;
  estado.desdePlanta = {};
  repintar();
}

const opciones = () => ({
  salida: estado.salida,
  sabado: estado.sabado,
  minutosPorParada: estado.minutosPorParada,
  desdePlanta: estado.desdePlanta
});

const minutosDeZona = z => estado.desdePlanta[z.id] != null ? estado.desdePlanta[z.id] : z.minutosDesdePlanta;

const enHoras = m => {
  const h = Math.floor(Math.abs(m) / 60), min = Math.round(Math.abs(m) % 60);
  return (m < 0 ? '-' : '') + (h ? h + ' h ' : '') + min + ' min';
};

// ----------------------------------------------------------------- render
export function simuladorHTML() {
  const r = simularSalida(estado.paradas, opciones());
  const { mejora } = mejorOrden(estado.paradas, opciones());

  return '<div class="panel" style="margin-top:22px">'
    + '<h3>Simulador de una salida</h3>'
    + '<p class="sub">Arma la ruta como la armarías mañana: qué zonas, en qué orden, cuántas entregas en'
    + ' cada una. El simulador suma los trayectos, las paradas y el retorno a planta, y dice si entra'
    + ' antes de que termine la jornada.</p>'
    + cabecera()
    + listaDeParadas()
    + resultado(r, mejora)
    + cronologia(r)
    + tiemposEditables()
    + '</div>';
}

function cabecera() {
  return '<div class="pb-sim-cabecera">'
    + campo('Hora de salida',
        '<input class="input" type="time" step="900" value="' + estado.salida
        + '" onchange="pbHoraSalida(this.value)">')
    + campo('Día',
        '<select class="select" onchange="pbDiaSimulado(this.value)">'
        + '<option value="semana"' + (estado.sabado ? '' : ' selected') + '>Lunes a viernes (hasta '
        + JORNADA.entreSemana.hasta + ')</option>'
        + '<option value="sabado"' + (estado.sabado ? ' selected' : '') + '>Sábado (hasta '
        + JORNADA.sabado.hasta + ')</option></select>')
    + campo('Minutos por entrega',
        '<input class="input" type="number" min="1" max="90" value="' + estado.minutosPorParada
        + '" onchange="pbMinutosParada(this.value)">')
    + '</div>';
}

const campo = (etiqueta, control) =>
  '<div class="field" style="margin:0"><label>' + esc(etiqueta) + '</label>' + control + '</div>';

function listaDeParadas() {
  const filas = estado.paradas.map((p, i) => {
    const z = zonaPorId(p.zonaId);
    return '<div class="pb-sim-fila">'
      + '<div class="pb-sim-n">' + (i + 1) + '</div>'
      + '<select class="select" onchange="pbZonaParada(' + i + ',this.value)">'
      + ZONAS.map(o => '<option value="' + o.id + '"' + (o.id === p.zonaId ? ' selected' : '') + '>'
          + esc(o.nombre) + ' · ' + minutosDeZona(o) + ' min desde planta</option>').join('')
      + '</select>'
      + '<input class="input pb-sim-cant" type="number" min="1" max="20" value="' + p.paradas
      + '" onchange="pbCuantasParadas(' + i + ',this.value)" title="Entregas o recojos en esta zona">'
      + '<button class="btn btn-sm btn-ghost" onclick="pbQuitarParada(' + i + ')" title="Quitar">Quitar</button>'
      + '</div>';
  }).join('');

  return '<div class="pb-sim-lista">'
    + (filas || '<div class="muted small" style="padding:10px 0">La salida está vacía: agrega una zona.</div>')
    + '</div>'
    + '<div class="tools" style="margin:12px 0 4px">'
    + '<button class="btn btn-sm" onclick="pbAgregarParada()">Agregar zona</button>'
    + '<button class="btn btn-sm btn-ghost" onclick="pbOrdenarMejor()">Ordenar por el camino más corto</button>'
    + '<button class="btn btn-sm btn-ghost" onclick="pbReiniciarSimulador()">Reiniciar</button>'
    + '</div>';
}

function resultado(r, mejora) {
  if (r.vacia) return '';
  const clase = r.entra ? 'bien' : 'mal';
  return '<div class="pb-sim-resultado ' + clase + '">'
    + '<div class="pb-sim-veredicto">'
    + (r.entra
      ? 'Entra: retorna a planta ' + esc(r.retorno) + ', con ' + esc(enHoras(r.minutosSobrantes))
        + ' de margen antes de las ' + esc(r.finJornada) + '.'
      : 'No entra: retornaría ' + esc(r.retorno) + ', ' + esc(enHoras(-r.minutosSobrantes))
        + ' después de las ' + esc(r.finJornada) + '.')
    + '</div>'
    + '<div class="pb-sim-cifras">'
    + cifra(enHoras(r.total), 'Duración de la salida')
    + cifra(enHoras(r.minutosViaje), 'En tránsito')
    + cifra(enHoras(r.minutosParadas), 'En los puntos')
    + cifra(r.paradas + ' en ' + r.zonas + (r.zonas === 1 ? ' zona' : ' zonas'), 'Entregas o recojos')
    + '</div>'
    + (mejora > 0
      ? '<div class="pb-sim-tip">Cambiando el orden de las zonas se ahorran ' + esc(enHoras(mejora))
        + '. Prueba el botón de ordenar.</div>'
      : '')
    + '</div>';
}

const cifra = (v, k) => '<div><b>' + esc(v) + '</b><span>' + esc(k) + '</span></div>';

function cronologia(r) {
  if (r.vacia) return '';
  return '<div class="pb-crono">'
    + '<div class="pb-crono-hito"><span class="pb-crono-hora">' + esc(r.salida) + '</span>'
    + '<span class="pb-crono-punto salida"></span><span>Sale de planta</span></div>'
    + r.tramos.map(t =>
      '<div class="pb-crono-hito' + (t.tipo === 'viaje' ? ' viaje' : '') + '">'
      + '<span class="pb-crono-hora">' + esc(t.desde) + '</span>'
      + '<span class="pb-crono-punto"></span>'
      + '<span>' + esc(t.texto) + '<i>' + t.minutos + ' min</i></span></div>').join('')
    + '<div class="pb-crono-hito"><span class="pb-crono-hora">' + esc(r.retorno) + '</span>'
    + '<span class="pb-crono-punto ' + (r.entra ? 'fin' : 'tarde') + '"></span>'
    + '<span>Vuelve a planta</span></div>'
    + '</div>';
}

function tiemposEditables() {
  return '<details class="pb-tiempos"><summary>Ajustar los tiempos de viaje</summary>'
    + '<p class="hint" style="margin:10px 0 12px">Minutos de planta a cada zona, en un sentido. Son'
    + ' estimaciones de tráfico de día laborable, calibradas para una planta en Lima norte. Cámbialos con'
    + ' lo que midas en la calle: es el supuesto que más mueve el resultado.</p>'
    + '<div class="pb-tiempos-grid">'
    + ZONAS.map(z => '<label class="pb-tiempo"><span>' + esc(z.nombre) + '</span>'
        + '<input class="input" type="number" min="1" max="300" value="' + minutosDeZona(z)
        + '" onchange="pbTiempoZona(\'' + z.id + '\',this.value)"></label>').join('')
    + '</div>'
    + '<p class="hint" style="margin-top:12px">Los trayectos de una zona a otra sin pasar por planta salen'
    + ' de la matriz de <span class="mono">payback/data/tiempos.js</span>.</p>'
    + '</details>';
}
