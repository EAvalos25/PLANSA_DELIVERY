import { OPERACION, JORNADA } from '#data/payback/parametros.js';
import { zonaPorId } from '#data/payback/zonas.js';
import { minutosEntre, MINUTOS_MISMA_ZONA } from '#data/payback/tiempos.js';

/**
 * Simula UNA salida del motorizado: planta → zonas en orden → planta.
 *
 * Es el detalle que el modelo de capacidad resume. capacidad.js responde
 * "¿cuántos encargos aguanta la semana?" con promedios por zona; esto responde
 * "¿esta salida concreta, con estas paradas, en este orden, entra antes de que
 * termine la jornada?". Sirve para armar la ruta del día y para discutir con
 * un área por qué su envío entra mañana y no hoy.
 *
 * El tiempo de una salida se compone de:
 *
 *   planta → primera zona          minutosDesdePlanta
 *   por cada parada                minutosPorParada
 *   entre paradas de la misma zona MINUTOS_MISMA_ZONA
 *   entre zonas distintas          minutosEntre (matriz de ../data/tiempos.js)
 *   última zona → planta           minutosDesdePlanta
 *
 * Cálculo puro: no toca el DOM.
 */

const enMinutos = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + b; };
const enReloj = m => {
  const t = Math.round(m);
  return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};

/**
 * @param {Array} paradas   [{ zonaId, paradas }] en el orden en que se visitan
 * @param {object} [op]
 * @param {string} [op.salida]          hora de salida, 'HH:MM'
 * @param {boolean} [op.sabado]         medir contra la jornada del sábado
 * @param {object} [op.desdePlanta]     { zonaId: minutos } para sobrescribir
 * @param {object} [op.entreZonas]      { 'a|b': minutos } para sobrescribir
 * @param {number} [op.minutosPorParada]
 */
export function simularSalida(paradas, op = {}) {
  const limpias = (paradas || [])
    .map(p => ({ zona: zonaPorId(p.zonaId), paradas: Math.max(1, Math.round(p.paradas || 1)) }))
    .filter(p => p.zona);

  const minParada = op.minutosPorParada != null ? op.minutosPorParada : OPERACION.minutosPorParada;
  const desdePlanta = z => {
    const v = op.desdePlanta && op.desdePlanta[z.id];
    return v != null ? v : z.minutosDesdePlanta;
  };

  const inicio = enMinutos(op.salida || JORNADA.entreSemana.desde);
  const finJornada = enMinutos(op.sabado ? JORNADA.sabado.hasta : JORNADA.entreSemana.hasta);

  const tramos = [];
  let reloj = inicio;

  const anotar = (tipo, texto, minutos, zona) => {
    tramos.push({ tipo, texto, minutos, zona, desde: enReloj(reloj), hasta: enReloj(reloj + minutos) });
    reloj += minutos;
  };

  if (!limpias.length) {
    return {
      tramos: [], paradas: 0, zonas: 0,
      minutosViaje: 0, minutosParadas: 0, total: 0,
      salida: enReloj(inicio), retorno: enReloj(inicio),
      finJornada: enReloj(finJornada), entra: true, minutosSobrantes: finJornada - inicio,
      vacia: true
    };
  }

  limpias.forEach((p, i) => {
    if (i === 0) {
      anotar('viaje', 'Planta → ' + p.zona.nombre, desdePlanta(p.zona), p.zona);
    } else {
      const previa = limpias[i - 1].zona;
      anotar('viaje', previa.nombre + ' → ' + p.zona.nombre,
        minutosEntre(previa.id, p.zona.id, op.entreZonas), p.zona);
    }
    // Las paradas dentro de una zona no son consecutivas: hay que moverse
    // entre un punto y el siguiente.
    const traslados = (p.paradas - 1) * MINUTOS_MISMA_ZONA;
    anotar('paradas',
      p.paradas + (p.paradas === 1 ? ' entrega o recojo en ' : ' entregas o recojos en ') + p.zona.nombre,
      p.paradas * minParada + traslados, p.zona);
  });

  const ultima = limpias[limpias.length - 1].zona;
  anotar('viaje', ultima.nombre + ' → Planta', desdePlanta(ultima), ultima);

  const minutosViaje = tramos.filter(t => t.tipo === 'viaje').reduce((a, t) => a + t.minutos, 0);
  const minutosParadas = tramos.filter(t => t.tipo === 'paradas').reduce((a, t) => a + t.minutos, 0);
  const total = minutosViaje + minutosParadas;

  return {
    tramos,
    paradas: limpias.reduce((a, p) => a + p.paradas, 0),
    zonas: new Set(limpias.map(p => p.zona.id)).size,
    minutosViaje,
    minutosParadas,
    total,
    salida: enReloj(inicio),
    retorno: enReloj(reloj),
    finJornada: enReloj(finJornada),
    entra: reloj <= finJornada,
    minutosSobrantes: finJornada - reloj,
    vacia: false
  };
}

/**
 * Prueba todos los órdenes posibles de las zonas y devuelve el mejor.
 *
 * El orden importa mucho: las mismas paradas encadenadas al revés pueden costar
 * media hora más. Con hasta 6 zonas son 720 combinaciones, que se recorren sin
 * problema; por encima de eso se devuelve el orden tal como vino, porque la
 * fuerza bruta deja de ser razonable y la ruta ya es demasiado larga para un
 * día de todos modos.
 */
export function mejorOrden(paradas, op = {}) {
  const lista = (paradas || []).filter(p => p && p.zonaId);
  if (lista.length < 2 || lista.length > 6) return { orden: lista, mejora: 0 };

  const actual = simularSalida(lista, op).total;
  let mejor = lista, mejorTotal = actual;

  permutaciones(lista).forEach(orden => {
    const t = simularSalida(orden, op).total;
    if (t < mejorTotal) { mejorTotal = t; mejor = orden; }
  });

  return { orden: mejor, mejora: actual - mejorTotal };
}

function permutaciones(xs) {
  if (xs.length <= 1) return [xs];
  const salida = [];
  xs.forEach((x, i) => {
    const resto = xs.slice(0, i).concat(xs.slice(i + 1));
    permutaciones(resto).forEach(p => salida.push([x, ...p]));
  });
  return salida;
}
