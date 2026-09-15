import { LEY } from '../data/parametros.js';

/**
 * Qué se paga y cuándo, según la fecha en que entra el motorizado.
 *
 * El costo mensual "de régimen" que calcula planilla.js reparte los beneficios
 * en doce partes iguales, que es lo correcto para comparar escenarios. Pero la
 * plata no sale así: las gratificaciones caen en julio y diciembre, la CTS en
 * mayo y noviembre, y el primer año casi nunca se cobran completas.
 *
 * Reglas aplicadas:
 *
 *   GRATIFICACIÓN (Ley 27735). Dos al año, cada una de un sueldo completo por
 *   semestre íntegro. Si se trabajó menos, es proporcional a los meses
 *   completos: un sexto de sueldo por cada mes. Julio paga el semestre
 *   enero-junio; diciembre paga julio-diciembre. Encima va la bonificación
 *   extraordinaria de la Ley 30334, que es el 9% de la gratificación.
 *
 *   CTS (D.S. 001-97-TR). Dos depósitos al año. El de mayo cubre de noviembre a
 *   abril; el de noviembre cubre de mayo a octubre. Se calcula sobre la
 *   remuneración computable, que es el sueldo MÁS un sexto de la última
 *   gratificación recibida: por eso el primer depósito de quien acaba de entrar
 *   sale más bajo, todavía no hay gratificación que sumar. Hace falta como
 *   mínimo un mes de servicio para tener derecho.
 *
 * El tiempo se computa con el método de los 30 días que usa la planilla
 * peruana: todos los meses valen 30 y el año 360. Por eso quien entra un día 15
 * suma medio mes, no una fracción de calendario.
 *
 * Cálculo puro: no toca el DOM.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

/** Días entre dos fechas con el convenio de mes de 30 días, inclusive. */
function dias360(desde, hasta) {
  const d1 = Math.min(desde.dia, 30), d2 = Math.min(hasta.dia, 30);
  const total = (hasta.anio - desde.anio) * 360 + (hasta.mes - desde.mes) * 30 + (d2 - d1) + 1;
  return Math.max(0, total);
}

const fecha = (anio, mes, dia) => ({ anio, mes, dia });
const comparar = (a, b) => (a.anio - b.anio) || (a.mes - b.mes) || (a.dia - b.dia);

/** Convierte 'AAAA-MM-DD' a la fecha interna. Devuelve null si no es válida. */
export function leerFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const [, a, me, d] = m.map(Number);
  if (me < 1 || me > 12 || d < 1 || d > 31) return null;
  return fecha(a, me, d);
}

/** Tiempo de servicios acumulado dentro de un período, tope incluido. */
function tiempoEn(inicio, desde, hasta, topeDias) {
  const arranque = comparar(inicio, desde) > 0 ? inicio : desde;
  if (comparar(arranque, hasta) > 0) return { meses: 0, dias: 0, total: 0 };
  const total = Math.min(topeDias, dias360(arranque, hasta));
  return { meses: Math.floor(total / 30), dias: total % 30, total };
}


/**
 * Calendario mes a mes desde la fecha de ingreso.
 *
 * @param {string} inicioISO  'AAAA-MM-DD'
 * @param {object} cfg        { base, personas } base = remuneración computable de UNA persona
 * @param {number} meses      cuántos meses proyectar
 */
export function calendario(inicioISO, cfg, meses = 24) {
  const inicio = leerFecha(inicioISO);
  if (!inicio) return { valido: false, filas: [], primerAnio: null };

  const base = cfg.base;
  const personas = cfg.personas || 1;
  const conCts = cfg.conCts !== false;   // el part time bajo 4 h no genera CTS

  const filas = [];
  let ultimaGratificacion = 0;           // para la remuneración computable de la CTS

  for (let i = 0; i < meses; i++) {
    const anio = inicio.anio + Math.floor((inicio.mes - 1 + i) / 12);
    const mes = ((inicio.mes - 1 + i) % 12) + 1;
    const esPrimerMes = i === 0;

    // El primer mes se paga por los días efectivamente trabajados.
    const diasDelMes = esPrimerMes ? Math.max(0, 30 - Math.min(inicio.dia, 30) + 1) : 30;
    const sueldo = base * (diasDelMes / 30) * personas;

    const essalud = sueldo * LEY.essalud;
    const vidaLey = sueldo * LEY.vidaLey;
    const sctr = sueldo * LEY.sctr;

    let gratificacion = 0, bonificacion = 0, cts = 0;
    const notas = [];

    // ---- gratificaciones: julio y diciembre ----
    if (mes === 7 || mes === 12) {
      const semestre = mes === 7
        ? { desde: fecha(anio, 1, 1), hasta: fecha(anio, 6, 30) }
        : { desde: fecha(anio, 7, 1), hasta: fecha(anio, 12, 31) };
      const t = tiempoEn(inicio, semestre.desde, semestre.hasta, 180);
      const proporcion = Math.min(6, t.meses) / 6;
      gratificacion = base * proporcion * personas;
      bonificacion = gratificacion * LEY.bonificacionExtraordinaria;
      if (gratificacion > 0) ultimaGratificacion = base * proporcion;
      notas.push(proporcion === 1
        ? 'Gratificación completa: semestre entero trabajado.'
        : 'Gratificación proporcional: ' + t.meses + ' de 6 meses del semestre '
          + (mes === 7 ? 'enero-junio' : 'julio-diciembre') + '.');
    }

    // ---- CTS: mayo y noviembre ----
    if (conCts && (mes === 5 || mes === 11)) {
      const periodo = mes === 5
        ? { desde: fecha(anio - 1, 11, 1), hasta: fecha(anio, 4, 30) }
        : { desde: fecha(anio, 5, 1), hasta: fecha(anio, 10, 31) };
      const t = tiempoEn(inicio, periodo.desde, periodo.hasta, 180);
      if (t.total >= 30) {
        const computable = base + ultimaGratificacion * LEY.ctsSextoGratificacion;
        cts = (computable * t.meses / 12 + computable * t.dias / 360) * personas;
        notas.push('CTS por ' + t.meses + ' meses y ' + t.dias + ' días'
          + (ultimaGratificacion > 0
            ? ', sobre sueldo más un sexto de la última gratificación.'
            : '. Todavía sin gratificación previa que sumar a la base.'));
      } else {
        notas.push('Sin depósito de CTS: hace falta al menos un mes de servicio.');
      }
    }

    const total = sueldo + essalud + vidaLey + sctr + gratificacion + bonificacion + cts;
    filas.push({
      i, anio, mes, etiqueta: MESES[mes - 1] + ' ' + anio,
      diasDelMes, sueldo, essalud, vidaLey, sctr,
      gratificacion, bonificacion, cts, total,
      extraordinario: gratificacion + bonificacion + cts,
      notas
    });
  }

  const doce = filas.slice(0, 12);
  return {
    valido: true,
    inicio,
    filas,
    primerAnio: {
      total: doce.reduce((a, f) => a + f.total, 0),
      promedioMensual: doce.reduce((a, f) => a + f.total, 0) / 12,
      gratificaciones: doce.reduce((a, f) => a + f.gratificacion + f.bonificacion, 0),
      cts: doce.reduce((a, f) => a + f.cts, 0),
      mesMasCaro: doce.slice().sort((a, b) => b.total - a.total)[0]
    }
  };
}

/**
 * Compara el primer año con un año de régimen, ya con la persona instalada.
 * La diferencia es puro efecto del calendario: quien entra en enero paga las
 * dos gratificaciones completas ese año; quien entra en octubre, casi ninguna.
 */
export function ahorroDelPrimerAnio(cal, costoMensualRegimen) {
  if (!cal.valido) return null;
  const regimen = costoMensualRegimen * 12;
  return {
    primerAnio: cal.primerAnio.total,
    regimen,
    diferencia: regimen - cal.primerAnio.total
  };
}

export { MESES };
