import { JORNADA } from '../data/parametros.js';

/**
 * Compara cada escenario contra lo que se gasta hoy en courier y calcula en
 * cuánto tiempo se recupera la inversión.
 *
 * Una precisión sobre la palabra "payback": solo el escenario de flota propia
 * tiene algo que recuperar, porque es el único con desembolso inicial. Los
 * otros dos son gasto contra gasto: o cuestan menos que el courier desde el
 * primer mes, o no. Presentarlos con un "plazo de retorno" sería inventarse
 * una métrica que no aplica.
 */

const DIAS_LABORABLES_AL_MES = JORNADA.diasSemanaAlMes + JORNADA.sabadosAlMes;

/**
 * @param {Array} escenarios  salida de escenarios.js
 * @param {object} demanda    salida de demanda.js
 */
export function comparar(escenarios, demanda) {
  const gastoActual = demanda.recientes.gastoMensual;
  const costoPorViaje = demanda.recientes.costoPorViaje;
  const viajesPorDia = demanda.viajesPorDia.entreSemana || demanda.viajesPorDia.promedio;

  const filas = escenarios.map(e => {
    const gastoMoto = e.moto ? e.moto.gasto.total : 0;

    // Los días de vacaciones no se pagan dos veces en planilla, pero esos días
    // igual hay que mover la carga: vuelve el courier. Se provisiona al mes.
    const diasHabilesSinCobertura = e.diasSinCoberturaAlAnio * (DIAS_LABORABLES_AL_MES * 12 / 365);
    const coberturaVacaciones = diasHabilesSinCobertura * viajesPorDia * costoPorViaje / 12;

    // Lo que la moto propia no alcanza a cubrir sigue saliendo por courier. Se
    // mide sobre la distribución real de días, no sobre el promedio: el
    // promedio cabe, pero los días cargados se desbordan igual.
    const excedenteDiario = demanda.viajesPorDia.excedenteSobre(e.capacidad.techoDiario);
    const courierResidual = excedenteDiario * DIAS_LABORABLES_AL_MES * costoPorViaje;

    const costoMensual = e.planilla + gastoMoto + coberturaVacaciones + courierResidual;
    const ahorroMensual = gastoActual - costoMensual;

    const inversion = e.moto ? e.moto.inversion.total : 0;
    const mesesRetorno = inversion > 0
      ? (ahorroMensual > 0 ? inversion / ahorroMensual : null)
      : 0;

    return {
      escenario: e,
      excedenteDiario,
      planilla: e.planilla,
      gastoMoto,
      coberturaVacaciones,
      courierResidual,
      costoMensual,
      ahorroMensual,
      ahorroAnual: ahorroMensual * 12,
      inversion,
      /** Meses para recuperar la inversión. null = no se recupera; 0 = no hay. */
      mesesRetorno,
      /** Resultado acumulado al cabo de un año, ya descontada la inversión. */
      resultadoPrimerAnio: ahorroMensual * 12 - inversion
    };
  });

  return {
    gastoActual,
    costoPorViaje,
    viajesPorDia,
    filas,
    condiciones: condiciones(filas, demanda),
    recomendacion: recomendar(filas)
  };
}

/**
 * Lo que tiene que ser cierto para que CUALQUIERA de los tres escenarios
 * funcione. Va aparte de los riesgos de cada uno porque no depende de a quién
 * se contrate: depende de cómo se pidan los envíos.
 */
function condiciones(filas, demanda) {
  const lista = [];
  const uno = filas[0];
  if (!uno) return lista;
  const cap = uno.escenario.capacidad;
  const viajes = demanda.viajesPorDia.entreSemana;

  lista.push({
    nivel: cap.alcanza ? 'ok' : 'alto',
    titulo: 'Los envíos se agrupan por zona',
    texto: 'Agrupando, la carga de un día promedio (' + viajes.toFixed(1) + ' encargos) ocupa el '
      + (cap.usoConPrograma * 100).toFixed(0) + '% del tiempo útil. Atendiendo cada pedido por separado, en'
      + ' cuanto llega, haría falta el ' + (cap.usoSinPrograma * 100).toFixed(0)
      + '%: más del doble de la jornada. La programación no es una mejora, es la condición para que esto exista.'
  });

  const pico = cap.pico;
  if (pico) {
    lista.push({
      nivel: pico.alcanza ? 'ok' : 'aviso',
      titulo: 'El día cargado se desborda',
      texto: 'El promedio es ' + viajes.toFixed(1) + ' encargos, pero el 10% de los días pasa de '
        + demanda.viajesPorDia.p90 + ' y hubo días de ' + demanda.viajesPorDia.maximo + '. Con '
        + pico.viajesPorDia + ' encargos el uso sube a ' + (pico.uso * 100).toFixed(0) + '%. '
        + (pico.alcanza
          ? 'Aun así entra.'
          : 'No entra: esos días el excedente tiene que seguir saliendo por courier, y así está previsto en el costo.')
    });
  }

  lista.push({
    nivel: 'aviso',
    titulo: 'La capacidad es la misma en los tres escenarios',
    texto: 'Una persona a tiempo completo y dos a media jornada suman las mismas horas de reparto a la semana.'
      + ' Dos motos no rinden el doble si se turnan para cubrir el mismo horario; rinden el doble solo si salen'
      + ' a la vez, y entonces media jornada queda sin cubrir. Lo que cambia entre escenarios es el costo y el'
      + ' riesgo, no cuántos encargos se mueven.'
  });

  return lista;
}

/**
 * Ordena los escenarios por lo que importa, en este orden: primero que la
 * operación funcione, después que cueste menos. Un escenario que no cubre la
 * demanda no gana por ser barato.
 */
function recomendar(filas) {
  const viables = filas.filter(f => f.escenario.capacidad.alcanza);
  const sinRiesgoAlto = viables.filter(f =>
    !f.escenario.riesgos.some(r => r.nivel === 'alto') &&
    !f.escenario.persona.avisos.some(a => a.nivel === 'alto'));

  const candidatos = sinRiesgoAlto.length ? sinRiesgoAlto : viables;
  const mejor = candidatos.slice().sort((a, b) => b.ahorroMensual - a.ahorroMensual)[0] || null;

  return {
    mejor,
    viables: viables.map(f => f.escenario.id),
    conRiesgoAlto: filas
      .filter(f => f.escenario.riesgos.some(r => r.nivel === 'alto')
        || f.escenario.persona.avisos.some(a => a.nivel === 'alto'))
      .map(f => f.escenario.id),
    /** Ninguno conviene si el courier sale más barato que todos. */
    ningunoConviene: filas.every(f => f.ahorroMensual <= 0)
  };
}
