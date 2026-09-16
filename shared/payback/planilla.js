import { JORNADA, LEY } from '#data/payback/parametros.js';

/**
 * Costo laboral de un motorizado en planilla.
 *
 * Cálculo puro: entra una configuración, sale un desglose. No toca el DOM ni
 * lee la base de datos, así que se puede correr y verificar en Node.
 *
 * Lo que se paga en Perú sobre un sueldo, régimen laboral común:
 *
 *   - Gratificaciones de julio y diciembre, una remuneración cada una.
 *   - Bonificación extraordinaria (Ley 30334): el 9% de EsSalud que no se paga
 *     sobre la gratificación va al bolsillo del trabajador. Para la empresa es
 *     costo igual.
 *   - CTS: dos depósitos al año. La remuneración computable incluye un sexto
 *     de la gratificación, así que el año equivale a 7/6 de sueldo.
 *   - EsSalud 9%, solo sobre las doce remuneraciones mensuales: las
 *     gratificaciones están inafectas, por eso existe la bonificación de
 *     arriba.
 *   - Vida Ley y SCTR, primas referenciales.
 *
 * Las VACACIONES no aparecen como costo en efectivo, y es a propósito: los 30
 * días se pagan dentro de los doce sueldos del año, no encima de ellos.
 * Sumarlas otra vez sería contar dos veces. Lo que sí cuesta es quedarse sin
 * motorizado ese mes; eso se valoriza en payback.js, que sí conoce la demanda.
 */

/** Horas efectivas de trabajo a la semana con la jornada pedida. */
export function horasSemanales() {
  const enMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const semana = enMin(JORNADA.entreSemana.hasta) - enMin(JORNADA.entreSemana.desde) - JORNADA.refrigerioMin;
  const sabado = enMin(JORNADA.sabado.hasta) - enMin(JORNADA.sabado.desde);
  return {
    porDiaSemana: semana / 60,
    sabado: sabado / 60,
    total: (semana * 5 + sabado) / 60,
    minutosDiaSemana: semana,
    minutosSabado: sabado
  };
}

/**
 * @param {object} cfg
 * @param {number} cfg.sueldoBase          básico mensual en soles
 * @param {number} cfg.bono                bono mensual en soles
 * @param {boolean} cfg.bonoRemunerativo   si entra a la base de beneficios
 * @param {boolean} cfg.jornadaCompleta    false = part time (menos de 4 h/día)
 * @param {number} [cfg.asignacionFamiliar] soles; 0 si no tiene hijos menores
 * @param {number} [cfg.fraccionJornada]   part time: parte de la jornada que cubre (0 a 1)
 */
export function costoPersona(cfg) {
  const asignacion = cfg.asignacionFamiliar || 0;
  const bonoEnBase = cfg.bonoRemunerativo ? cfg.bono : 0;
  const bonoFuera = cfg.bonoRemunerativo ? 0 : cfg.bono;

  // Base sobre la que se calculan todos los beneficios.
  const base = cfg.sueldoBase + bonoEnBase + asignacion;

  const gratificaciones = base * LEY.gratificacionesAlAnio / 12;
  const bonificacionExtraordinaria = gratificaciones * LEY.bonificacionExtraordinaria;

  // El part time por debajo de 4 h/día no genera CTS (D.S. 001-97-TR art. 4).
  const cts = cfg.jornadaCompleta
    ? base * (1 + LEY.ctsSextoGratificacion) / 12
    : 0;

  const essalud = base * LEY.essalud;
  const vidaLey = base * LEY.vidaLey;
  const sctr = base * LEY.sctr;

  const total = base + bonoFuera + gratificaciones + bonificacionExtraordinaria
    + cts + essalud + vidaLey + sctr;

  return {
    base,
    bonoFueraDePlanilla: bonoFuera,
    gratificaciones,
    bonificacionExtraordinaria,
    cts,
    essalud,
    vidaLey,
    sctr,
    total,
    /** Cuánto cuesta cada sol de sueldo, ya con todo lo de ley encima. */
    factor: total / (cfg.sueldoBase + cfg.bono),
    diasVacaciones: cfg.jornadaCompleta ? LEY.vacacionesDiasCompleto : LEY.vacacionesDiasPartTime,
    avisos: avisosLegales(cfg)
  };
}

/**
 * Revisa los topes de ley que el planteamiento podría rozar. No bloquea el
 * cálculo: lo muestra, porque son cosas que decide RR.HH., no un programa.
 */
function avisosLegales(cfg) {
  const avisos = [];
  const horas = horasSemanales();
  const remuneracion = cfg.sueldoBase + (cfg.bonoRemunerativo ? cfg.bono : 0);

  if (cfg.jornadaCompleta) {
    if (horas.total > JORNADA.topeLegalSemanalHoras) {
      avisos.push({
        nivel: 'alto',
        texto: 'La jornada pedida suma ' + horas.total.toFixed(2) + ' h a la semana y el tope legal es '
          + JORNADA.topeLegalSemanalHoras + ' h. Con ' + JORNADA.refrigerioMin
          + ' min de refrigerio no alcanza: habría que pagar sobretiempo o recortar el horario.'
      });
    } else {
      avisos.push({
        nivel: 'ok',
        texto: 'La jornada suma ' + horas.total.toFixed(2) + ' h a la semana, debajo del tope de '
          + JORNADA.topeLegalSemanalHoras + ' h, siempre que el refrigerio de ' + JORNADA.refrigerioMin
          + ' min no se compute como trabajo. Con 45 min se pasaría del tope.'
      });
    }
    if (cfg.sueldoBase < LEY.rmv) {
      avisos.push({
        nivel: 'alto',
        texto: 'El básico de S/ ' + cfg.sueldoBase + ' está por debajo de la remuneración mínima vital (S/ '
          + LEY.rmv + ') para jornada completa.'
      });
    }
  } else {
    // Part time: la ley lo define por debajo de 4 h/día en promedio semanal.
    const horasDia = horas.total * (cfg.fraccionJornada || 0.5) / 6;
    if (horasDia >= LEY.umbralPartTimeHoras) {
      avisos.push({
        nivel: 'alto',
        texto: 'Cada persona quedaría en ' + horasDia.toFixed(2)
          + ' h al día. A partir de 4 h ya no es part time: corresponde CTS, 30 días de vacaciones y la'
          + ' remuneración mínima completa, con lo que el sueldo planteado sería inviable.'
      });
    } else {
      avisos.push({
        nivel: 'ok',
        texto: 'Cada persona queda en ' + horasDia.toFixed(2) + ' h al día, debajo de las 4 h: es part time'
          + ' legal, sin CTS y con 6 días de vacaciones al año.'
      });
      const rmvProporcional = LEY.rmv * horasDia / 8;
      if (remuneracion < rmvProporcional) {
        avisos.push({
          nivel: 'alto',
          texto: 'S/ ' + remuneracion.toFixed(0) + ' queda debajo de la mínima proporcional (S/ '
            + rmvProporcional.toFixed(0) + ' para ' + horasDia.toFixed(2) + ' h al día).'
        });
      } else {
        avisos.push({
          nivel: 'ok',
          texto: 'S/ ' + remuneracion.toFixed(0) + ' supera la mínima proporcional de S/ '
            + rmvProporcional.toFixed(0) + ' que corresponde a esa jornada.'
        });
      }
    }
  }

  if (cfg.bono > 0 && cfg.bonoRemunerativo) {
    avisos.push({
      nivel: 'aviso',
      texto: 'El bono de S/ ' + cfg.bono + ' se está tratando como remunerativo, así que paga gratificaciones,'
        + ' CTS y EsSalud. Si se estructura como condición de trabajo (combustible y mantenimiento contra'
        + ' comprobante), el costo baja; eso lo define RR.HH., no la hoja de cálculo.'
    });
  }
  return avisos;
}
