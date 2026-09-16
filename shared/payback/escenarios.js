import { ESCENARIOS, JORNADA, OPERACION } from '#data/payback/parametros.js';
import { MOTO_POR_DEFECTO } from '#data/payback/motos.js';
import { costoPersona } from './planilla.js';
import { inversion, gastoMensual } from './flota.js';
import { evaluar } from './capacidad.js';

/**
 * Arma los tres escenarios completos: costo, capacidad y riesgos.
 *
 * Cada escenario responde tres preguntas distintas y conviene no mezclarlas:
 *   1. ¿Cuánto cuesta al mes?            -> planilla.js + flota.js
 *   2. ¿Aguanta los viajes del día?      -> capacidad.js
 *   3. ¿Qué se rompe si algo sale mal?   -> riesgos(), aquí abajo
 *
 * Un escenario puede ser el más barato y aun así no servir, si no cubre la
 * demanda o si deja a la operación colgada de una sola persona.
 */

const DIAS_LABORABLES_AL_MES = JORNADA.diasSemanaAlMes + JORNADA.sabadosAlMes;

/**
 * @param {object} demanda        salida de demanda.js
 * @param {object} [opciones]
 * @param {string} [opciones.idMoto]
 * @param {number} [opciones.asignacionFamiliar]
 * @param {boolean} [opciones.bonoRemunerativo]  fuerza el tratamiento del bono
 */
export function construir(demanda, opciones = {}) {
  const idMoto = opciones.idMoto || MOTO_POR_DEFECTO;
  // Se dimensiona contra el día laborable, que es el que aprieta: el sábado
  // mueve menos de la mitad de encargos.
  const viajesPorDia = demanda.viajesPorDia.entreSemana || demanda.viajesPorDia.promedio;

  return Object.values(ESCENARIOS).map(base => {
    const cfg = {
      ...base,
      bonoRemunerativo: opciones.bonoRemunerativo !== undefined
        ? opciones.bonoRemunerativo : base.bonoRemunerativo,
      asignacionFamiliar: opciones.asignacionFamiliar || 0,
      // Dos personas part time se reparten la jornada: media cada una.
      fraccionJornada: base.jornadaCompleta ? 1 : 1 / base.personas
    };

    const persona = costoPersona(cfg);
    const planilla = persona.total * cfg.personas;

    const moto = cfg.compraMoto
      ? { inversion: inversion(idMoto), gasto: gastoMensual(idMoto, DIAS_LABORABLES_AL_MES) }
      : null;

    const capacidad = evaluar({
      personas: cfg.personas,
      fraccionJornada: cfg.fraccionJornada,
      viajesPorDia,
      viajesPico: demanda.viajesPorDia.p90,
      mezcla: demanda.mezcla
    });

    // Días al año sin motorizado por vacaciones, en equivalente de día
    // completo. Con dos part time el hueco es menor: cada ausencia deja fuera
    // media jornada, no la jornada entera.
    const diasSinCoberturaAlAnio = persona.diasVacaciones * cfg.personas * cfg.fraccionJornada;

    return {
      id: cfg.id,
      nombre: cfg.nombre,
      detalle: cfg.detalle,
      cfg,
      persona,
      planilla,
      moto,
      capacidad,
      diasSinCoberturaAlAnio,
      riesgos: riesgos(cfg)
    };
  });
}

/**
 * Lo que no se ve en el costo mensual pero decide el asunto. Va aparte del
 * cálculo porque son juicios operativos, no aritmética.
 */
function riesgos(cfg) {
  const lista = [];

  if (cfg.personas === 1) {
    lista.push({
      nivel: 'alto',
      texto: 'Toda la mensajería queda en una sola persona. Si falta, se enferma o renuncia, no hay quien'
        + ' cubra y la operación vuelve al courier el mismo día, sin aviso.'
    });
  } else {
    lista.push({
      nivel: 'ok',
      texto: 'Con dos personas, la falta de una deja media jornada cubierta en vez de dejar el día entero'
        + ' sin servicio.'
    });
  }

  if (cfg.compraMoto) {
    lista.push({
      nivel: 'aviso',
      texto: 'La moto es un activo de la empresa: hay que asegurarla, mantenerla, guardarla y responder por'
        + ' ella ante un choque, un robo o una papeleta. Eso es trabajo de alguien, y ese alguien es logística.'
    });
    lista.push({
      nivel: 'aviso',
      texto: 'Si el motorizado se va, la moto se queda. Es lo único que protege la inversión frente a la rotación.'
    });
  } else {
    lista.push({
      nivel: 'aviso',
      texto: 'La moto es del trabajador. Si se le malogra, el problema de la empresa es el mismo: no hay reparto.'
        + ' Conviene dejar por escrito quién responde por la disponibilidad del vehículo y exigir SOAT vigente.'
    });
  }

  if (!cfg.jornadaCompleta) {
    lista.push({
      nivel: 'aviso',
      texto: 'Part time significa por debajo de 4 horas diarias. Si en la práctica se les pide quedarse más,'
        + ' el contrato se convierte en jornada completa con todos sus beneficios y el ahorro desaparece.'
    });
    lista.push({
      nivel: 'aviso',
      texto: 'Dos personas a media jornada cubren el mismo horario por turnos, no en paralelo: la capacidad'
        + ' total es la misma que con una a tiempo completo, no el doble.'
    });
  }

  lista.push({
    nivel: 'aviso',
    texto: 'El cálculo reserva un ' + (OPERACION.holgura * 100).toFixed(0) + '% del día para imprevistos y'
      + ' urgencias aceptadas. Si ese margen se usa para ruta, no queda colchón para nada.'
  });

  return lista;
}
