import { OPERACION } from '../data/parametros.js';
import { horasSemanales } from './planilla.js';

/**
 * ¿Alcanza la moto para los viajes del día?
 *
 * El modelo no cuenta viajes sueltos de ida y vuelta, porque no es así como se
 * trabaja: el motorizado sale con varios encargos de la misma zona y los hace
 * en una salida. Por eso la unidad de cálculo es la RUTA, no el viaje.
 *
 *   minutos de una salida = ida y vuelta a la zona + (paradas x minutos por parada)
 *
 * De ahí sale la conclusión importante del análisis: lo que satura al
 * motorizado no es el número de encargos, es el número de SALIDAS. Diez
 * encargos a Lima norte en una salida caben; cuatro encargos a cuatro zonas
 * distintas, no. Agrupar por zona y por día es lo que hace viable una sola
 * moto, y es exactamente lo que las urgencias impiden hacer.
 */

/** Minutos de trabajo disponibles a la semana, ya descontada la holgura. */
export function minutosDisponibles(personas, fraccionJornadaPorPersona) {
  const h = horasSemanales();
  const porPersonaCompleta = h.minutosDiaSemana * 5 + h.minutosSabado;
  const bruto = porPersonaCompleta * personas * fraccionJornadaPorPersona;
  return {
    bruto,
    // La holgura es tiempo reservado: cargar, papeleo, imprevistos y las
    // urgencias que sí se aceptan. Sin ella el plan solo cierra en el papel.
    holgura: bruto * OPERACION.holgura,
    neto: bruto * (1 - OPERACION.holgura),
    porPersonaCompleta
  };
}

/**
 * Minutos de ruta que exige a la semana un nivel de demanda dado.
 *
 * Con programación, a una zona se sale las veces mínimas necesarias para
 * repartir sus encargos sin pasarse de `maxParadasPorRuta`, y nunca más veces
 * que los `diasDeRuta` fijados. Salir menos veces y más cargado es siempre más
 * barato en tiempo, porque el ida y vuelta se paga una sola vez; el precio es
 * que un encargo puede esperar al próximo día de esa zona.
 *
 * Sin programación se modela el otro extremo, que es lo que pasa hoy con las
 * urgencias: cada encargo se atiende en cuanto llega, en su propio viaje.
 *
 * @param {number} viajesPorDia   encargos por día laborable
 * @param {Array} mezcla          reparto por zona, de demanda.js
 * @param {object} [opciones]
 * @param {boolean} [opciones.respetarDiasDeRuta]  false = cada encargo, un viaje
 */
export function minutosRequeridos(viajesPorDia, mezcla, opciones = {}) {
  const agrupando = opciones.respetarDiasDeRuta !== false;
  const viajesSemana = viajesPorDia * 6;

  const porZona = mezcla.map(m => {
    const viajes = viajesSemana * m.participacion;
    if (viajes <= 0) {
      return { zona: m.zona, participacion: m.participacion, viajesSemana: 0,
               visitasSemana: 0, paradasPorVisita: 0, rutasPorVisita: 0, minutosSemana: 0 };
    }

    // Salidas mínimas para mover esa carga, acotadas por los días de ruta.
    const necesarias = Math.ceil(viajes / OPERACION.maxParadasPorRuta);
    const visitas = agrupando
      ? Math.max(1, Math.min(m.zona.diasDeRuta, necesarias))
      : Math.ceil(viajes);                       // un encargo, una salida

    const paradasPorVisita = viajes / visitas;
    const rutasPorVisita = Math.max(1, Math.ceil(paradasPorVisita / OPERACION.maxParadasPorRuta));

    const minutosSemana = visitas *
      (rutasPorVisita * m.zona.minutosIdaVuelta + paradasPorVisita * OPERACION.minutosPorParada);

    return {
      zona: m.zona,
      participacion: m.participacion,
      viajesSemana: viajes,
      visitasSemana: visitas,
      paradasPorVisita,
      rutasPorVisita,
      minutosSemana
    };
  });

  return {
    porZona,
    total: porZona.reduce((a, z) => a + z.minutosSemana, 0),
    salidasSemana: porZona.reduce((a, z) => a + z.visitasSemana * z.rutasPorVisita, 0)
  };
}

/**
 * Evalúa si una configuración de personal aguanta un nivel de demanda.
 *
 * @param {object} cfg
 * @param {number} cfg.personas
 * @param {number} cfg.fraccionJornada  parte de la jornada completa por persona
 * @param {number} cfg.viajesPorDia
 * @param {Array}  cfg.mezcla
 */
export function evaluar(cfg) {
  const disponible = minutosDisponibles(cfg.personas, cfg.fraccionJornada);
  const conPrograma = minutosRequeridos(cfg.viajesPorDia, cfg.mezcla, { respetarDiasDeRuta: true });
  const sinPrograma = minutosRequeridos(cfg.viajesPorDia, cfg.mezcla, { respetarDiasDeRuta: false });

  return {
    disponible,
    conPrograma,
    sinPrograma,
    usoConPrograma: disponible.neto ? conPrograma.total / disponible.neto : Infinity,
    usoSinPrograma: disponible.neto ? sinPrograma.total / disponible.neto : Infinity,
    alcanza: conPrograma.total <= disponible.neto,
    alcanzaSinProgramar: sinPrograma.total <= disponible.neto,
    /** Viajes al día que aguanta antes de saturarse, con programación. */
    techoDiario: techo(cfg, disponible.neto),
    /**
     * El promedio no dimensiona nada: hay que aguantar el día cargado. Se
     * evalúa también contra el pico que pidió logística (p90 del histórico).
     */
    pico: cfg.viajesPico ? (() => {
      const req = minutosRequeridos(cfg.viajesPico, cfg.mezcla, { respetarDiasDeRuta: true });
      return {
        viajesPorDia: cfg.viajesPico,
        minutos: req.total,
        uso: disponible.neto ? req.total / disponible.neto : Infinity,
        alcanza: req.total <= disponible.neto
      };
    })() : null
  };
}

/**
 * Busca el máximo de viajes diarios que la configuración soporta. Se tantea de
 * décima en décima porque el costo por ruta es escalonado (una parada más
 * puede obligar a una segunda salida), así que no hay fórmula que despejar.
 */
function techo(cfg, minutosNeto) {
  let ultimo = 0;
  for (let v = 0.5; v <= 40; v += 0.1) {
    if (minutosRequeridos(v, cfg.mezcla, { respetarDiasDeRuta: true }).total > minutosNeto) break;
    ultimo = v;
  }
  return ultimo;
}
