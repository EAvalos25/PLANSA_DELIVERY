import { zonaDe, ZONAS } from '#data/payback/zonas.js';

/**
 * Lo que realmente pasa hoy, leído del histórico de servicios.
 *
 * Cálculo puro: recibe la lista de solicitudes y devuelve números. No importa
 * la base de datos a propósito, para que el mismo código sirva con el
 * histórico cargado, con lo que se registre de aquí en adelante, o con una
 * muestra de prueba.
 *
 * Sin esta capa el análisis sería opinión. Con ella, la pregunta "¿alcanza una
 * moto?" se responde contra los viajes que de verdad se hicieron.
 */

const percentil = (ordenados, p) =>
  ordenados.length ? ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * p))] : 0;

/**
 * @param {Array} solicitudes  servicios con {fechaProg, costo, destino}
 * @param {number} mesesRecientes  cuántos meses completos promediar
 */
export function analizarDemanda(solicitudes, mesesRecientes = 3) {
  const conFecha = solicitudes.filter(s => s.fechaProg && s.costo != null);
  if (!conFecha.length) return vacio();

  // ---- viajes y gasto por día ----
  const porDia = new Map();
  conFecha.forEach(s => {
    const o = porDia.get(s.fechaProg) || { n: 0, c: 0 };
    o.n++; o.c += s.costo;
    porDia.set(s.fechaProg, o);
  });

  // ---- por mes ----
  const porMes = new Map();
  conFecha.forEach(s => {
    const k = s.fechaProg.slice(0, 7);
    const o = porMes.get(k) || { n: 0, c: 0, dias: new Set() };
    o.n++; o.c += s.costo; o.dias.add(s.fechaProg);
    porMes.set(k, o);
  });
  const mesesOrdenados = [...porMes.keys()].sort();

  // El último mes casi siempre está a medias (el histórico corta el 19), así
  // que se descarta para promediar: si no, el gasto mensual sale bajo.
  const completos = mesesOrdenados.slice(0, -1).slice(-mesesRecientes);
  const ultimoParcial = mesesOrdenados[mesesOrdenados.length - 1];

  const gastoRecientes = completos.reduce((a, k) => a + porMes.get(k).c, 0);
  const viajesRecientes = completos.reduce((a, k) => a + porMes.get(k).n, 0);

  // ---- distribución de viajes al día ----
  const cuentas = [...porDia.values()].map(o => o.n).sort((a, b) => a - b);
  const promedio = cuentas.reduce((a, b) => a + b, 0) / cuentas.length;

  // ---- entre semana contra sábado ----
  const semana = { dias: 0, viajes: 0 }, sabado = { dias: 0, viajes: 0 };
  porDia.forEach((o, iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    const dow = new Date(a, m - 1, d).getDay();
    const destino = dow === 6 ? sabado : semana;
    destino.dias++; destino.viajes += o.n;
  });

  // ---- mezcla por zona ----
  const zonas = new Map(ZONAS.map(z => [z.id, { zona: z, viajes: 0, costo: 0 }]));
  conFecha.forEach(s => {
    const o = zonas.get(zonaDe(s.destino));
    o.viajes++; o.costo += s.costo;
  });
  const mezcla = [...zonas.values()]
    .map(o => ({ ...o, participacion: o.viajes / conFecha.length }))
    .sort((a, b) => b.viajes - a.viajes);

  return {
    hay: true,
    totalViajes: conFecha.length,
    desde: mesesOrdenados[0],
    hasta: ultimoParcial,

    meses: mesesOrdenados.map(k => ({
      mes: k,
      viajes: porMes.get(k).n,
      gasto: porMes.get(k).c,
      dias: porMes.get(k).dias.size,
      parcial: k === ultimoParcial
    })),

    /** Promedio de los últimos meses COMPLETOS: la base para comparar. */
    recientes: {
      meses: completos,
      gastoMensual: completos.length ? gastoRecientes / completos.length : 0,
      viajesMensual: completos.length ? viajesRecientes / completos.length : 0,
      costoPorViaje: viajesRecientes ? gastoRecientes / viajesRecientes : 0
    },

    viajesPorDia: {
      promedio,
      mediana: percentil(cuentas, 0.5),
      p90: percentil(cuentas, 0.9),
      maximo: cuentas[cuentas.length - 1],
      diasMedidos: cuentas.length,
      entreSemana: semana.dias ? semana.viajes / semana.dias : 0,
      sabado: sabado.dias ? sabado.viajes / sabado.dias : 0,
      /** Días en que se superaron los N viajes, para dimensionar el pico. */
      sobre: n => cuentas.filter(c => c > n).length / cuentas.length,

      /**
       * Encargos al día que quedarían fuera si la capacidad propia se corta en
       * `techo`. Se calcula sobre la distribución real de días, no sobre el
       * promedio: un día de 20 viajes deja 11 fuera aunque el promedio sea 8.
       */
      excedenteSobre: techo =>
        cuentas.reduce((a, c) => a + Math.max(0, c - techo), 0) / cuentas.length
    },

    mezcla
  };
}

function vacio() {
  return {
    hay: false, totalViajes: 0, meses: [],
    recientes: { meses: [], gastoMensual: 0, viajesMensual: 0, costoPorViaje: 0 },
    viajesPorDia: { promedio: 0, mediana: 0, p90: 0, maximo: 0, diasMedidos: 0, entreSemana: 0, sabado: 0, sobre: () => 0, excedenteSobre: () => 0 },
    mezcla: []
  };
}
