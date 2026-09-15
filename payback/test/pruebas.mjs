/**
 * Pruebas del módulo payback. Se corren con:
 *
 *     node payback/test/pruebas.mjs
 *
 * Cubren solo este módulo. El backend se prueba directo, porque es cálculo
 * puro; la vista se prueba contra un DOM simulado mínimo, lo justo para
 * comprobar que arma la pantalla sin reventar y con los números adentro.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const mod = p => import(pathToFileURL(path.join(RAIZ, p)).href);

let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FALLA') + ' ' + msg); if (!cond) fallos++; };
const cerca = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const { LEY, JORNADA, ESCENARIOS } = await mod('payback/data/parametros.js');
const { MOTOS } = await mod('payback/data/motos.js');
const { zonaDe, ZONAS } = await mod('payback/data/zonas.js');
const { costoPersona, horasSemanales } = await mod('payback/backend/planilla.js');
const { inversion, gastoMensual } = await mod('payback/backend/flota.js');
const { analizarDemanda } = await mod('payback/backend/demanda.js');
const { minutosRequeridos, minutosDisponibles } = await mod('payback/backend/capacidad.js');
const { construir } = await mod('payback/backend/escenarios.js');
const { comparar } = await mod('payback/backend/payback.js');
const { historico2026 } = await mod('js/db/historico.js');

// ---------------------------------------------------------------- jornada
console.log('\n-- jornada --');
const h = horasSemanales();
ok(cerca(h.porDiaSemana, 8.5), `lun-vie 8.5 h efectivas con refrigerio de ${JORNADA.refrigerioMin} min (${h.porDiaSemana})`);
ok(cerca(h.sabado, 4.5), `sábado 4.5 h (${h.sabado})`);
ok(cerca(h.total, 47), `47 h a la semana (${h.total})`);
ok(h.total <= JORNADA.topeLegalSemanalHoras, 'la jornada pedida cabe en el tope legal de 48 h');

// --------------------------------------------------------------- planilla
console.log('\n-- costo laboral --');
const tc = costoPersona({ sueldoBase: 1800, bono: 300, bonoRemunerativo: true, jornadaCompleta: true });
ok(cerca(tc.base, 2100), `base computable 2100 (${tc.base})`);
ok(cerca(tc.gratificaciones, 350), `gratificaciones 350/mes (${tc.gratificaciones.toFixed(2)})`);
ok(cerca(tc.bonificacionExtraordinaria, 31.5), `bonificación extraordinaria 31.50 (${tc.bonificacionExtraordinaria.toFixed(2)})`);
ok(cerca(tc.cts, 2100 * (7 / 6) / 12), `CTS sobre 7/6 de sueldo al año (${tc.cts.toFixed(2)})`);
ok(cerca(tc.essalud, 189), `EsSalud 9% (${tc.essalud.toFixed(2)})`);
ok(tc.factor > 1.35 && tc.factor < 1.5, `el factor de costo empresa cae en el rango peruano (${tc.factor.toFixed(3)})`);
ok(tc.diasVacaciones === 30, 'jornada completa: 30 días de vacaciones');

const pt = costoPersona({ sueldoBase: 800, bono: 250, bonoRemunerativo: true, jornadaCompleta: false, fraccionJornada: 0.5 });
ok(pt.cts === 0, 'el part time por debajo de 4 h no genera CTS');
ok(pt.diasVacaciones === LEY.vacacionesDiasPartTime, `part time: ${LEY.vacacionesDiasPartTime} días de vacaciones`);
ok(pt.factor < tc.factor, `el part time cuesta proporcionalmente menos (${pt.factor.toFixed(3)} contra ${tc.factor.toFixed(3)})`);

const sinBono = costoPersona({ sueldoBase: 1800, bono: 300, bonoRemunerativo: false, jornadaCompleta: true });
ok(sinBono.total < tc.total, 'tratar el bono como condición de trabajo abarata el escenario');
ok(cerca(sinBono.bonoFueraDePlanilla, 300), 'el bono no remunerativo se paga igual, pero fuera de la base');

console.log('\n-- avisos legales --');
const bajoMinimo = costoPersona({ sueldoBase: 900, bono: 0, bonoRemunerativo: true, jornadaCompleta: true });
ok(bajoMinimo.avisos.some(a => a.nivel === 'alto' && /mínima vital/.test(a.texto)),
   'avisa si el básico de jornada completa queda debajo de la RMV');
const partTimeLargo = costoPersona({ sueldoBase: 800, bono: 250, bonoRemunerativo: true, jornadaCompleta: false, fraccionJornada: 1 });
ok(partTimeLargo.avisos.some(a => a.nivel === 'alto' && /ya no es part time/.test(a.texto)),
   'avisa si el "part time" llega o pasa las 4 h diarias');
ok(pt.avisos.every(a => a.nivel !== 'alto'), 'el part time a media jornada no dispara ningún aviso grave');

// ------------------------------------------------------------------ flota
console.log('\n-- moto propia --');
const inv = inversion(MOTOS[0].id);
ok(inv.total > inv.precioSoles, 'la inversión suma placa y equipamiento, no solo el precio de lista');
const gm = gastoMensual(MOTOS[0].id, 26);
ok(gm.depreciacion > 0 && cerca(gm.salidaDeCaja, gm.total - gm.depreciacion),
   'la depreciación es costo del período pero no salida de caja');
ok(gm.combustible > 0 && gm.kmAlMes > 0, 'el combustible sale de los km recorridos');

// ----------------------------------------------------------------- zonas
console.log('\n-- clasificación de destinos --');
ok(zonaDe('PLUS COSMÉTICA, AV. VÍCTOR ANDRÉS BELAÚNDE 280, SAN ISIDRO') === 'moderna', 'San Isidro cae en Lima moderna');
ok(zonaDe('PROCHILCA, AV. LOS ÁLAMOS MZ. D, CHILCA') === 'lejos', 'Chilca no se confunde con Lima norte por la sílaba PRO');
ok(zonaDe('BOHLER, CASTRO RONCEROS 777, CERCADO DE LIMA') === 'centro', 'Cercado de Lima cae en Lima centro');
ok(zonaDe('INDUSTRIAL CENTER, LOS ROBLES 161, BELLAVISTA - CALLAO') === 'callao', 'Bellavista cae en Callao');
ok(zonaDe('Una dirección sin distrito') === 'otros', 'lo que no se reconoce va a sin clasificar');

// --------------------------------------------------------------- demanda
console.log('\n-- demanda real --');
const d = analizarDemanda(historico2026());
ok(d.hay && d.totalViajes === 1386, `lee los 1386 servicios del histórico (${d.totalViajes})`);
ok(d.recientes.meses.length === 3, `promedia 3 meses completos: ${d.recientes.meses.join(', ')}`);
ok(!d.recientes.meses.includes(d.hasta), 'descarta el último mes, que está incompleto');
ok(d.recientes.gastoMensual > 4000 && d.recientes.gastoMensual < 6000,
   `gasto mensual en courier S/ ${d.recientes.gastoMensual.toFixed(2)}`);
ok(d.viajesPorDia.entreSemana > d.viajesPorDia.sabado,
   `entre semana se mueve más que el sábado (${d.viajesPorDia.entreSemana.toFixed(1)} contra ${d.viajesPorDia.sabado.toFixed(1)})`);
ok(d.viajesPorDia.p90 > d.viajesPorDia.promedio, `el día cargado (p90=${d.viajesPorDia.p90}) supera al promedio (${d.viajesPorDia.promedio.toFixed(1)})`);
ok(cerca(d.mezcla.reduce((a, m) => a + m.participacion, 0), 1), 'el reparto por zona suma 100%');
ok(d.viajesPorDia.excedenteSobre(1000) === 0, 'con un techo altísimo no queda excedente');
ok(d.viajesPorDia.excedenteSobre(0) > 0, 'con techo cero, todo el volumen es excedente');

ok(analizarDemanda([]).hay === false, 'sin servicios devuelve un análisis vacío en vez de romperse');

// ------------------------------------------------------------- capacidad
console.log('\n-- capacidad --');
const disp = minutosDisponibles(1, 1);
ok(disp.neto < disp.bruto, 'el tiempo neto descuenta la holgura reservada para imprevistos');
ok(cerca(minutosDisponibles(2, 0.5).bruto, disp.bruto),
   'dos personas a media jornada suman las mismas horas que una completa');

const agrupado = minutosRequeridos(9, d.mezcla, { respetarDiasDeRuta: true });
const suelto = minutosRequeridos(9, d.mezcla, { respetarDiasDeRuta: false });
ok(agrupado.total < suelto.total,
   `agrupar por zona ahorra tiempo (${(agrupado.total / 60).toFixed(1)} h contra ${(suelto.total / 60).toFixed(1)} h)`);
ok(suelto.total > disp.neto, 'atendiendo cada urgencia por separado no entra en la jornada');
ok(minutosRequeridos(20, d.mezcla, { respetarDiasDeRuta: true }).total
   > minutosRequeridos(8, d.mezcla, { respetarDiasDeRuta: true }).total, 'más encargos exigen más tiempo');
ok(minutosRequeridos(0, d.mezcla).total === 0, 'sin encargos no hay ruta que pagar');

// ------------------------------------------------------------ escenarios
console.log('\n-- escenarios --');
const esc = construir(d);
ok(esc.length === 3, `los tres escenarios pedidos (${esc.length})`);
ok(esc.map(e => e.id).join(',') === Object.keys(ESCENARIOS).join(','), 'salen en el orden en que se plantearon');

const [propia, flota, dos] = esc;
ok(propia.cfg.personas === 1 && propia.cfg.sueldoBase === 1800 && propia.cfg.bono === 300,
   'escenario 1: una persona, S/1800 + S/300, moto suya');
ok(flota.moto && flota.cfg.bono === 0, 'escenario 2: moto de la empresa, S/1800 sin bono');
ok(dos.cfg.personas === 2 && dos.cfg.sueldoBase === 800 && dos.cfg.bono === 250 && !dos.cfg.jornadaCompleta,
   'escenario 3: dos part time, S/800 + S/250');
ok(!propia.moto && !dos.moto, 'solo el escenario 2 compra moto');

ok(cerca(propia.capacidad.techoDiario, dos.capacidad.techoDiario),
   'los tres tienen la misma capacidad: dos medias jornadas son una jornada');
ok(propia.riesgos.some(r => r.nivel === 'alto'), 'depender de una sola persona se marca como riesgo alto');
ok(!dos.riesgos.some(r => r.nivel === 'alto'), 'con dos personas ese riesgo desaparece');

// --------------------------------------------------------------- payback
console.log('\n-- comparación y retorno --');
const cmp = comparar(esc, d);
ok(cerca(cmp.gastoActual, d.recientes.gastoMensual), 'compara contra el gasto real de los últimos meses');
cmp.filas.forEach(f => {
  const suma = f.planilla + f.gastoMoto + f.coberturaVacaciones + f.courierResidual;
  ok(cerca(suma, f.costoMensual), `[${f.escenario.id}] el costo mensual es la suma de sus partes`);
  ok(cerca(f.ahorroMensual, cmp.gastoActual - f.costoMensual), `[${f.escenario.id}] el ahorro es gasto actual menos costo`);
});
const fFlota = cmp.filas.find(f => f.escenario.id === 'flota');
ok(fFlota.inversion > 0 && fFlota.mesesRetorno > 0, `solo el de flota tiene retorno que calcular (${fFlota.mesesRetorno.toFixed(1)} meses)`);
ok(cerca(fFlota.mesesRetorno, fFlota.inversion / fFlota.ahorroMensual), 'el retorno es inversión entre ahorro mensual');
ok(cmp.filas.filter(f => f.inversion === 0).every(f => f.mesesRetorno === 0),
   'los escenarios sin inversión no muestran plazo de retorno inventado');
ok(cmp.filas.every(f => f.coberturaVacaciones > 0),
   'todos provisionan los días de vacaciones en que no hay motorizado');
ok(cmp.recomendacion.mejor, 'hay un escenario recomendado');
ok(cmp.condiciones.length >= 3, 'se listan las condiciones que valen para cualquier escenario');
ok(cmp.condiciones.some(c => /agrupan por zona/.test(c.titulo)), 'la primera condición es programar por zona');

// ------------------------------------------------------------ la pantalla
console.log('\n-- pantalla --');
const ids = ['pbCuerpo'];
const registro = new Map(ids.map(i => [i, { id: i, innerHTML: '', textContent: '', value: '', style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }]));
globalThis.document = {
  getElementById: id => registro.get(id) || null,
  documentElement: { setAttribute() {}, getAttribute: () => null },
  querySelectorAll: () => [], addEventListener() {}
};
globalThis.window = globalThis;
const almacen = new Map();
globalThis.localStorage = {
  getItem: k => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: k => almacen.delete(k)
};

const bd = await mod('js/db/index.js');
await bd.cargar();
const vista = await mod('payback/frontend/vista.js');
vista.renderPayback();
const html = registro.get('pbCuerpo').innerHTML;

ok(html.length > 2000, `la pantalla se arma (${html.length} caracteres)`);
ok(/Escenario recomendado/.test(html), 'muestra el escenario recomendado arriba');
esc.forEach(e => ok(html.includes(e.nombre), `aparece el escenario "${e.nombre}"`));
ok(/S\/\s/.test(html), 'muestra importes en soles');
ok(/¿Alcanza una sola moto\?/.test(html), 'responde si alcanza una sola moto');
ok(/Cómo se dejan de tener urgencias/.test(html), 'incluye las medidas contra las urgencias');
ok(/Hora de corte diaria/.test(html), 'la primera medida es la hora de corte');
MOTOS.forEach(m => ok(html.includes(m.modelo), `ofrece cotizar la ${m.modelo}`));
ok(!/undefined|NaN|\[object/.test(html), 'no se cuela ningún undefined, NaN ni [object Object]');

vista.setMotoPayback(MOTOS[2].id);
ok(registro.get('pbCuerpo').innerHTML.includes(MOTOS[2].modelo), 'cambiar de moto vuelve a pintar con la elegida');
vista.setBonoPayback('no');
ok(/Condición de trabajo/.test(registro.get('pbCuerpo').innerHTML),
   'cambiar el tratamiento del bono se refleja en el desglose');

console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
