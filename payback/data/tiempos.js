/**
 * Cuánto toma ir de una zona a otra sin pasar por la planta.
 *
 * Hace falta para simular una salida con varias paradas: si el motorizado va a
 * Lima centro y de ahí sigue a Lima moderna, el trayecto entre ambas no es
 * "volver a planta y salir de nuevo", es bastante menos. Sin esta matriz el
 * simulador sobreestimaría cualquier ruta encadenada, que es justo lo que se
 * quiere medir.
 *
 * SON ESTIMACIONES de tráfico de día laborable, en moto, en un sentido. Están
 * puestas para ordenar la discusión y se editan aquí mismo; el primer mes de
 * operación real las corrige. La pantalla del simulador también deja cambiarlas
 * sobre la marcha para probar hipótesis.
 *
 * La matriz es simétrica: se declara solo la mitad y `minutosEntre()` busca el
 * par en cualquier orden. Los trayectos desde y hacia la planta no están aquí:
 * viven en `minutosDesdePlanta` de ./zonas.js.
 */

/** Clave de un par de zonas, en orden alfabético para que A-B sea igual a B-A. */
const par = (a, b) => [a, b].sort().join('|');

const MATRIZ = {
  [par('norte', 'centro')]: 30,
  [par('norte', 'moderna')]: 45,
  [par('norte', 'este')]: 50,
  [par('norte', 'callao')]: 35,
  [par('norte', 'sur')]: 65,
  [par('norte', 'lejos')]: 110,

  [par('centro', 'moderna')]: 30,
  [par('centro', 'este')]: 35,
  [par('centro', 'callao')]: 30,
  [par('centro', 'sur')]: 45,
  [par('centro', 'lejos')]: 90,

  [par('moderna', 'este')]: 40,
  [par('moderna', 'callao')]: 45,
  [par('moderna', 'sur')]: 30,
  [par('moderna', 'lejos')]: 70,

  [par('este', 'callao')]: 60,
  [par('este', 'sur')]: 55,
  [par('este', 'lejos')]: 90,

  [par('callao', 'sur')]: 55,
  [par('callao', 'lejos')]: 90,

  [par('sur', 'lejos')]: 45
};

/**
 * Minutos entre dos zonas cualesquiera, en un sentido.
 *
 * Dentro de la misma zona no es cero: moverse entre dos puntos de Ate o de San
 * Isidro toma tiempo igual, y ese traslado no está incluido en el tiempo de
 * parada. 'Sin clasificar' no tiene par propio porque agrupa direcciones de
 * media ciudad; se le asigna un trayecto promedio.
 */
export const MINUTOS_MISMA_ZONA = 12;
const PROMEDIO_SIN_CLASIFICAR = 45;

export function minutosEntre(a, b, ajustes) {
  if (a === b) return MINUTOS_MISMA_ZONA;
  if (a === 'otros' || b === 'otros') return PROMEDIO_SIN_CLASIFICAR;
  const k = par(a, b);
  if (ajustes && ajustes[k] != null) return ajustes[k];
  return MATRIZ[k] != null ? MATRIZ[k] : PROMEDIO_SIN_CLASIFICAR;
}

/** Los pares declarados, para listarlos y dejarlos editar en pantalla. */
export function paresDeZonas() {
  return Object.keys(MATRIZ).map(k => {
    const [a, b] = k.split('|');
    return { clave: k, a, b, minutos: MATRIZ[k] };
  });
}

export { par as claveDePar };
