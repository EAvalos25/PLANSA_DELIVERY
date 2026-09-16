/**
 * Prueba de arranque del navegador. Se corre con:
 *
 *     node tests/frontend.mjs
 *
 * Levanta el servidor de verdad y ejecuta el grafo completo de módulos del
 * frontend contra un DOM simulado, apuntando `fetch` a ese servidor. Es la
 * prueba que atrapa lo que ninguna otra ve: una importación rota tras mover
 * carpetas, un id que ya no existe en el HTML, o una vista que quedó llamando
 * a la base local en vez de a la API.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// En Windows, import() con ruta absoluta necesita una URL file://.
const mod = p => import(pathToFileURL(path.join(RAIZ, p)).href);
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'plansa-front-'));
process.env.PLANSA_DB = path.join(temporal, 'prueba.sqlite');
process.env.PLANSA_UPLOADS = path.join(temporal, 'uploads');

let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FALLA') + ' ' + msg); if (!cond) fallos++; };

const { iniciar } = await import('../backend/servidor.js');
const servidor = iniciar({ puerto: 0, silencioso: true });
await new Promise(r => servidor.once('listening', r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

// --- fetch del navegador, apuntado al servidor de prueba ---
const fetchReal = globalThis.fetch;
globalThis.fetch = (ruta, init) =>
  fetchReal(String(ruta).startsWith('http') ? ruta : BASE + ruta, init);

// ----------------------------------------------------------- DOM simulado
const html = fs.readFileSync(path.join(RAIZ, 'frontend/index.html'), 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);

function nuevoElemento(id = '') {
  const clases = new Set();
  const el = {
    id, value: '', textContent: '', innerHTML: '', min: '', max: '', step: '', disabled: false,
    dataset: {}, style: {}, children: [],
    classList: {
      add: (...c) => c.forEach(x => clases.add(x)),
      remove: (...c) => c.forEach(x => clases.delete(x)),
      toggle: (c, on) => { if (on === undefined) clases.has(c) ? clases.delete(c) : clases.add(c); else on ? clases.add(c) : clases.delete(c); },
      contains: c => clases.has(c)
    },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, click() {}, focus() {}, blur() {},
    appendChild(h) { el.children.push(h); return h; }, removeChild() {}, remove() {},
    querySelectorAll: () => [], querySelector: () => null, closest: () => null, scrollIntoView() {}
  };
  return el;
}

const registro = new Map(ids.map(i => [i, nuevoElemento(i)]));
globalThis.document = {
  documentElement: nuevoElemento('html'),
  body: nuevoElemento('body'),
  getElementById: id => registro.get(id) || null,
  createElement: () => nuevoElemento(),
  querySelectorAll: () => [], querySelector: () => null, addEventListener() {}
};
globalThis.window = globalThis;
globalThis.scrollTo = () => {};
globalThis.open = () => null;
const almacen = new Map();
globalThis.localStorage = {
  getItem: k => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: k => almacen.delete(k)
};
const intervalos = [];
globalThis.setInterval = (fn, ms) => { intervalos.push(ms); return intervalos.length; };

const $ = id => registro.get(id);
const esperar = ms => new Promise(r => setTimeout(r, ms));

try {
  // -------------------------------------------------------------- arranque
  console.log('\n-- arranque --');
  try {
    await mod('frontend/js/main.js');
    ok(true, 'main.js carga el grafo completo de módulos sin errores');
  } catch (e) {
    ok(false, 'main.js falló al arrancar -> ' + e.message);
    console.log(e.stack);
    throw e;
  }
  await esperar(150);

  ok(typeof globalThis.entrarSolicitante === 'function', 'el puente window expone las funciones del HTML');
  ok($('dlDestinos').innerHTML.includes('<option'), 'los destinos frecuentes llegaron del servidor');
  ok(intervalos.includes(2500) && intervalos.includes(60000), 'quedan armados los dos relojes de la app');

  const bd = await mod('frontend/js/api/estado.js');
  ok(bd.DB.personal.length === 212, `el padrón vino del servidor (${bd.DB.personal.length})`);
  ok(bd.DB.solicitudes.length === 1386, `y el histórico 2026 (${bd.DB.solicitudes.length})`);
  ok(!('pin' in bd.DB), 'la clave de logística no está en la copia del navegador');

  // ------------------------------------------------------- ingreso y flujo
  console.log('\n-- ingreso --');
  $('dniInput').value = '73012556';
  await globalThis.entrarSolicitante();
  ok($('miNombre').textContent.includes('AVALOS'), 'un DNI del padrón entra: ' + $('miNombre').textContent);

  $('fServicio').value = 'Envío de documentos';
  $('fOrigen').value = 'Plásticos Nacionales - Talleres';
  $('fMotivo').value = 'Entrega de facturas del mes';
  $('fDestino').value = bd.DB.destinos[0].nombre;
  $('fContacto').value = 'Mesa de partes';
  $('fTel').value = '987654321';
  $('fFecha').value = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  $('fHora').value = '10:00';
  globalThis.setAccion('Entregar');
  await globalThis.enviarSolicitud();
  ok($('okTitle').textContent === 'Ticket REQ-1387 registrado',
     'la solicitud se guarda en SQLite y vuelve con su correlativo: ' + $('okTitle').textContent);

  const guardada = await (await fetch('/api/solicitudes/REQ-1387')).json();
  ok(guardada.motivo === 'Entrega de facturas del mes', 'y está de verdad en la base, no solo en pantalla');

  $('qTicket').value = '1387';
  globalThis.consultarTicket();
  ok($('resTicket').innerHTML.includes('REQ-1387'), 'el seguimiento por número la encuentra');
  globalThis.salir();

  // ------------------------------------------------------------- logística
  console.log('\n-- logística --');
  $('pinInput').value = 'noesla';
  await globalThis.entrarAdmin();
  ok(!$('viewAdmin').classList.contains('on'), 'una clave incorrecta no abre la vista');

  $('pinInput').value = 'logistica';
  await globalThis.entrarAdmin();
  ok($('viewAdmin').classList.contains('on'), 'la clave correcta sí, y se comprueba en el servidor');
  ok(Number($('cntBandeja').textContent) === 1, 'la bandeja muestra el ticket recién registrado');

  await globalThis.setVehiculo('REQ-1387', 'Motorizado');
  await globalThis.setCosto('REQ-1387', '25');
  await globalThis.avanzar('REQ-1387');
  const enRuta = await (await fetch('/api/solicitudes/REQ-1387')).json();
  ok(enRuta.estado === 'En tránsito' && enRuta.vehiculo === 'Motorizado',
     'asignar transporte y avanzar quedó guardado en la base');

  $('qPadron').value = 'avalos';
  globalThis.renderPadron();
  ok($('tbPadron').innerHTML.includes('AVALOS VALDIVIA'), 'el padrón se busca por apellido');
  $('qPadron').value = '';
  globalThis.renderPadron();
  ok(!$('tbPadron').innerHTML.includes('AVALOS'), 'y sin búsqueda no lista a nadie');

  // --------------------------------------------------------------- payback
  console.log('\n-- payback --');
  globalThis.tabAdmin('payback');
  const pb = $('pbCuerpo').innerHTML;
  ok(pb.length > 2000, 'el módulo payback se pinta');
  ok(/Escenario recomendado/.test(pb) && /Simulador de una salida/.test(pb),
     'con el escenario recomendado y el simulador');
  ok(!/undefined|NaN|\[object/.test(pb), 'sin valores rotos');

} finally {
  servidor.close();
  const { cerrar } = await import('../backend/db/conexion.js');
  cerrar();
  fs.rmSync(temporal, { recursive: true, force: true });
}

console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
