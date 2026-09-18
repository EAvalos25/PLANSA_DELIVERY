/**
 * Pruebas de la API. Se corren con:
 *
 *     node tests/api.mjs
 *
 * Levantan un servidor de verdad contra una base SQLite temporal y una carpeta
 * de subidas temporal, y lo golpean por HTTP igual que lo hace el navegador.
 * No se simula nada: la subida pasa por multer, el archivo termina en disco y
 * se vuelve a descargar para comprobar que es el mismo.
 *
 * Al terminar se borra todo lo temporal, así que correr las pruebas no toca la
 * base real ni ensucia uploads/.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'plansa-test-'));
process.env.PLANSA_DB = path.join(temporal, 'prueba.sqlite');
process.env.PLANSA_UPLOADS = path.join(temporal, 'uploads');
process.env.PLANSA_PUERTO = '0';                 // puerto libre que elija el sistema

const { iniciar } = await import('../backend/servidor.js');
const { nombreUnico, marcaDeTiempo } = await import('../backend/middleware/subida.js');
// Las cifras del histórico se leen de la propia fuente: al actualizar la
// planilla las pruebas siguen valiendo sin tocar un número a mano.
const { RESUMEN } = await import('#data/historico.js');
const SEMBRADOS = RESUMEN.servicios;
const SIGUIENTE = 'REQ-' + String(SEMBRADOS + 1).padStart(3, '0');

let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FALLA') + ' ' + msg); if (!cond) fallos++; };

const servidor = iniciar({ puerto: 0, silencioso: true });
await new Promise(r => servidor.once('listening', r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

const api = async (metodo, ruta, cuerpo) => {
  const init = { method: metodo };
  if (cuerpo instanceof FormData) init.body = cuerpo;
  else if (cuerpo !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(cuerpo);
  }
  const res = await fetch(BASE + ruta, init);
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch (e) { datos = texto; }
  return { status: res.status, datos, res };
};

try {
  // ------------------------------------------------------------ arranque
  console.log('\n-- arranque y siembra --');
  const salud = await api('GET', '/api/salud');
  ok(salud.status === 200 && salud.datos.ok, 'el servidor responde');
  ok(salud.datos.personal === 212, `la base se sembró con el padrón (${salud.datos.personal} personas)`);
  ok(salud.datos.solicitudes === SEMBRADOS, `y con el histórico 2026 (${salud.datos.solicitudes} servicios)`);
  ok(fs.existsSync(process.env.PLANSA_DB), 'el archivo SQLite existe en disco');

  const estado = await api('GET', '/api/estado');
  ok(estado.status === 200, 'GET /api/estado responde');
  ok(estado.datos.totalPersonal === 212 && estado.datos.solicitudes.length === SEMBRADOS,
     'el estado trae el histórico completo y el conteo del padrón');
  ok(estado.datos.personal === undefined,
     'y NO trae el padrón: son datos personales que la pantalla no necesita en bloque');
  ok(estado.datos.destinos.length > 0, 'y el catálogo de destinos con sus tarifas');
  ok(!('pin' in estado.datos) && !JSON.stringify(estado.datos).includes('logistica'),
     'la clave de logística NO viaja al navegador');

  // ---------------------------------------------------------------- auth
  console.log('\n-- ingreso --');
  ok((await api('POST', '/api/auth/logistica', { clave: 'logistica' })).status === 200,
     'la clave correcta abre la vista de logística');
  ok((await api('POST', '/api/auth/logistica', { clave: 'noesla' })).status === 401,
     'una clave incorrecta responde 401');
  ok((await api('POST', '/api/auth/logistica', {})).status === 401, 'sin clave, tampoco entra');

  const eddy = await api('GET', '/api/auth/solicitante/73012556');
  ok(eddy.status === 200 && eddy.datos.nombre.includes('AVALOS'), 'un DNI del padrón se encuentra');
  ok((await api('GET', '/api/auth/solicitante/8161848')).status === 200,
     'el DNI de 7 dígitos se encuentra escrito sin el cero inicial');
  ok((await api('GET', '/api/auth/solicitante/99999999')).status === 404,
     'un documento ajeno al padrón responde 404');

  // ------------------------------------------------------------ personal
  console.log('\n-- padrón --');
  const sinBuscar = await api('GET', '/api/personal');
  ok(Array.isArray(sinBuscar.datos.resultados) && sinBuscar.datos.resultados.length === 0,
     'sin búsqueda no se vuelca el padrón completo');
  ok(sinBuscar.datos.total === 212, 'pero sí dice cuántos hay');

  const busq = await api('GET', '/api/personal?q=avalos');
  ok(busq.datos.length === 1 && busq.datos[0].dni === '73012556', 'la búsqueda por apellido encuentra');
  ok((await api('GET', '/api/personal?q=nunez')).datos.length > 0, 'y encuentra NÚÑEZ escrito sin tildes');

  const alta = await api('POST', '/api/personal', { dni: '12345678', nombre: 'PERSONA DE PRUEBA', area: 'Logistica' });
  ok(alta.status === 201 && alta.datos.origen === 'manual', 'un alta manual se marca como manual');
  ok((await api('POST', '/api/personal', { dni: '12345678', nombre: 'OTRA' })).status === 409,
     'no deja dar de alta dos veces el mismo documento');
  ok((await api('POST', '/api/personal', { dni: '123', nombre: 'X' })).status === 400,
     'rechaza un documento inválido');
  ok((await api('DELETE', '/api/personal/12345678')).status === 200, 'se puede quitar del padrón');
  ok((await api('DELETE', '/api/personal/12345678')).status === 404, 'quitar dos veces responde 404');

  // --------------------------------------------------------- solicitudes
  console.log('\n-- solicitudes --');
  const nueva = {
    dni: '73012556', nombre: 'EDDY PERCY AVALOS VALDIVIA', cargo: 'COORDINADOR DE LOGISTICA', area: 'Logistica',
    tipo: 'Entregar', servicio: 'Envío de documentos', motivo: 'Entrega de facturas del mes',
    origen: 'Plásticos Nacionales - Talleres', destino: 'PLUS COSMÉTICA, AV. VÍCTOR ANDRÉS BELAÚNDE 280, SAN ISIDRO',
    contacto: 'Mesa de partes', telefono: '987654321', fechaProg: '2026-09-20', horaProg: '10:00'
  };
  const creada = await api('POST', '/api/solicitudes', nueva);
  ok(creada.status === 201, 'se registra una solicitud');
  ok(creada.datos.id === SIGUIENTE, `el correlativo sigue al histórico (${creada.datos.id})`);
  ok(creada.datos.estado === 'En espera' && creada.datos.fuente === 'app',
     'entra en espera y marcada como registrada en la app');

  const otra = await api('POST', '/api/solicitudes', nueva);
  ok(otra.datos.id === 'REQ-' + String(SEMBRADOS + 2).padStart(3, '0'),
     'dos registros seguidos no repiten correlativo');

  ok((await api('POST', '/api/solicitudes', { ...nueva, telefono: '12' })).status === 400,
     'el servidor valida el teléfono aunque la pantalla no lo haga');
  ok((await api('POST', '/api/solicitudes', { ...nueva, tipo: 'Volar' })).status === 400,
     'y rechaza una acción que no existe');

  const id = creada.datos.id;
  ok((await api('POST', '/api/solicitudes/' + id + '/avanzar')).status === 409,
     'no deja pasar a tránsito sin transporte asignado');
  ok((await api('PATCH', '/api/solicitudes/' + id, { vehiculo: 'Bicicleta' })).status === 400,
     'rechaza un transporte que no existe');
  ok((await api('PATCH', '/api/solicitudes/' + id, { vehiculo: 'Motorizado' })).datos.vehiculo === 'Motorizado',
     'asigna el transporte');
  ok((await api('POST', '/api/solicitudes/' + id + '/avanzar')).datos.estado === 'En tránsito',
     'con transporte, pasa a tránsito');
  ok((await api('POST', '/api/solicitudes/' + id + '/avanzar')).status === 409,
     'no deja cerrar sin tarifa');
  ok((await api('PATCH', '/api/solicitudes/' + id, { costo: 25 })).datos.costo === 25, 'asigna la tarifa');
  const cerrada = await api('POST', '/api/solicitudes/' + id + '/avanzar');
  ok(cerrada.datos.estado === 'Concluido' && cerrada.datos.tsConcluido, 'se cierra y queda la hora de cierre');
  ok((await api('PATCH', '/api/solicitudes/' + id, { costo: 99 })).status === 409,
     'un ticket concluido ya no se modifica');

  // ------------------------------------------------------- autorizaciones
  console.log('\n-- autorizaciones --');
  const pedido = await api('POST', '/api/autorizaciones', { dni: '99999999' });
  ok(pedido.status === 201 && pedido.datos.repetido === false, 'se registra un pedido de acceso');
  ok((await api('POST', '/api/autorizaciones', { dni: '99999999' })).datos.repetido === true,
     'pedirlo dos veces no duplica');
  ok((await api('PATCH', '/api/autorizaciones/99999999', { estado: 'Rechazada' })).status === 200,
     'logística puede rechazarlo');
  ok((await api('PATCH', '/api/autorizaciones/99999999', { estado: 'Rechazada' })).status === 404,
     'y ya no queda pendiente');

  // ------------------------------------------------- adjuntos con multer
  console.log('\n-- subida de archivos (multer) --');
  ok(/^\d{8}-\d{6}$/.test(marcaDeTiempo(new Date(2026, 8, 15, 14, 30, 12))),
     'la marca de tiempo tiene forma AAAAMMDD-HHMMSS');
  const n1 = nombreUnico('IMG_0001.jpg', 'image/jpeg');
  const n2 = nombreUnico('IMG_0001.jpg', 'image/jpeg');
  ok(n1 !== n2, 'dos archivos con el mismo nombre original reciben nombres distintos');
  ok(n1.endsWith('.jpg') && n1.includes('img-0001'), `conserva nombre y extensión: ${n1}`);
  ok(!nombreUnico('../../backend/servidor.js', 'application/pdf').includes('..'),
     'un nombre con ../ no puede escaparse de la carpeta');
  ok(nombreUnico('guía de entrega ñ.PDF', 'application/pdf').includes('guia-de-entrega'),
     'sanea tildes, eñes y espacios');

  const contenido = Buffer.from('%PDF-1.4 guía de prueba');
  const forma = new FormData();
  forma.append('ticketId', id);
  forma.append('subidoPor', 'Pruebas');
  forma.append('archivo', new Blob([contenido], { type: 'application/pdf' }), 'guía de entrega.pdf');

  const subido = await api('POST', '/api/adjuntos', forma);
  ok(subido.status === 201, 'se sube una guía de entrega');
  ok(subido.datos.nombreOriginal === 'guía de entrega.pdf', 'se conserva el nombre original en la base');
  ok(/^\d{8}-\d{6}-[0-9a-f]{6}-guia-de-entrega\.pdf$/.test(subido.datos.archivo),
     `en disco quedó renombrado: ${subido.datos.archivo}`);
  ok(fs.existsSync(path.join(process.env.PLANSA_UPLOADS, subido.datos.archivo)),
     'el archivo está en la carpeta de subidas');

  const bajado = await fetch(BASE + '/api/adjuntos/' + subido.datos.id + '/archivo');
  const bytes = Buffer.from(await bajado.arrayBuffer());
  ok(bajado.status === 200 && bytes.equals(contenido), 'al descargarlo vuelve byte por byte igual');
  ok(bajado.headers.get('content-type').includes('pdf'), 'y con su tipo declarado');

  const forma2 = new FormData();
  forma2.append('ticketId', id);
  forma2.append('archivo', new Blob([contenido], { type: 'application/pdf' }), 'guía de entrega.pdf');
  const subido2 = await api('POST', '/api/adjuntos', forma2);
  ok(subido2.datos.archivo !== subido.datos.archivo, 'subir el mismo archivo otra vez no pisa al primero');
  ok(fs.readdirSync(process.env.PLANSA_UPLOADS).filter(f => f.endsWith('.pdf')).length === 2,
     'quedan los dos archivos en la carpeta');

  const rechazado = new FormData();
  rechazado.append('ticketId', id);
  rechazado.append('archivo', new Blob([Buffer.from('MZ')], { type: 'application/x-msdownload' }), 'virus.exe');
  ok((await api('POST', '/api/adjuntos', rechazado)).status === 415, 'un ejecutable se rechaza con 415');

  const sinTicket = new FormData();
  sinTicket.append('ticketId', 'REQ-999999');
  sinTicket.append('archivo', new Blob([contenido], { type: 'application/pdf' }), 'x.pdf');
  const huerfano = await api('POST', '/api/adjuntos', sinTicket);
  ok(huerfano.status === 404, 'no deja adjuntar a un ticket que no existe');
  ok((await api('GET', '/api/salud')).datos.adjuntosHuerfanos === 0,
     'y no deja el archivo suelto en disco cuando el registro falla');

  const delTicket = await api('GET', '/api/adjuntos?ticket=' + id);
  ok(delTicket.datos.length === 2, 'se listan los adjuntos de un ticket');

  ok((await api('DELETE', '/api/adjuntos/' + subido.datos.id)).status === 200, 'se puede borrar un adjunto');
  ok(!fs.existsSync(path.join(process.env.PLANSA_UPLOADS, subido.datos.archivo)),
     'y el archivo desaparece del disco, no solo de la base');
  ok((await api('DELETE', '/api/adjuntos/' + subido.datos.id)).status === 404, 'borrarlo dos veces responde 404');

  // ------------------------------------------------------------- ajustes
  console.log('\n-- clave de logística --');
  ok((await api('PUT', '/api/ajustes/clave', { actual: 'noesla', nueva: 'claveNueva1' })).status === 401,
     'sin la clave actual no se puede cambiar');
  ok((await api('PUT', '/api/ajustes/clave', { actual: 'logistica', nueva: 'corta' })).status === 400,
     'una clave de menos de 6 caracteres se rechaza');
  ok((await api('PUT', '/api/ajustes/clave', { actual: 'logistica', nueva: 'claveNueva1' })).status === 200,
     'con la clave actual sí se cambia');
  ok((await api('POST', '/api/auth/logistica', { clave: 'claveNueva1' })).status === 200, 'la nueva clave funciona');
  ok((await api('POST', '/api/auth/logistica', { clave: 'logistica' })).status === 401, 'y la vieja deja de funcionar');

  // ----------------------------------------------------------- revisión
  console.log('\n-- sincronización --');
  const r1 = (await api('GET', '/api/revision')).datos.revision;
  ok(typeof r1 === 'string' && r1.length > 0, 'hay un testigo de revisión');
  ok((await api('GET', '/api/revision')).datos.revision === r1, 'sin cambios, el testigo no se mueve');
  await api('POST', '/api/solicitudes', nueva);
  ok((await api('GET', '/api/revision')).datos.revision !== r1, 'al escribir algo, el testigo cambia');

  // ------------------------------------------------------------ payback
  console.log('\n-- payback por API --');
  const pb = await api('GET', '/api/payback?inicio=2026-10-01');
  ok(pb.status === 200 && pb.datos.escenarios.length === 3, 'devuelve los tres escenarios');
  ok(pb.datos.gastoActual > 0 && pb.datos.recomendado, 'con el gasto actual y un recomendado');
  ok(pb.datos.escenarios.every(e => e.costoPrimerAnio > 0),
     'y el costo del primer año según la fecha de ingreso');

  // --------------------------------------------- exposición de data/
  // La carpeta data/ tiene el padrón y el histórico junto a los supuestos del
  // payback. Solo lo segundo puede salir del servidor.
  console.log('\n-- qué se publica de data/ --');
  const crudo = async ruta => {
    const res = await fetch(BASE + ruta);
    return { status: res.status, texto: await res.text() };
  };
  const padronWeb = await crudo('/data/padron.js');
  ok(padronWeb.status === 404, 'el padrón no se sirve al navegador');
  ok(!padronWeb.texto.includes('73012556'), 'y no se filtra ningún DNI en la respuesta');
  ok((await crudo('/data/historico.js')).status === 404, 'el histórico tampoco');
  ok((await crudo('/data/destinos.js')).status === 200, 'los destinos sí, que la pantalla los necesita');
  ok((await crudo('/data/payback/parametros.js')).status === 200, 'y los supuestos del payback');
  ok((await crudo('/backend/config.js')).status === 404, 'el código del servidor no se sirve');
  ok((await crudo('/shared/documento.js')).status === 200,
     'las reglas del documento viven en shared/, sin el padrón al lado');

  // --------------------------------------------------- red y cabeceras
  console.log('\n-- respuesta en red --');
  const comprimida = await fetch(BASE + '/api/estado', { headers: { 'Accept-Encoding': 'gzip' } });
  ok(comprimida.headers.get('content-encoding') === 'gzip', 'el estado viaja comprimido');
  ok((comprimida.headers.get('vary') || '').includes('Accept-Encoding'),
     'y avisa que la respuesta varía según la compresión');
  const cab = await fetch(BASE + '/index.html');
  ok(cab.headers.get('x-content-type-options') === 'nosniff', 'va la cabecera nosniff');
  ok(cab.headers.get('x-frame-options') === 'DENY', 'y la que impide meterlo en un iframe');
  ok((cab.headers.get('content-security-policy') || '').includes("default-src 'self'"),
     'y una CSP que ata los recursos a este servidor');
  ok(!cab.headers.get('x-powered-by'), 'no se anuncia el motor');

  // --------------------------------------------------- freno de intentos
  // La clave es una sola palabra: sin freno se prueba el diccionario entero.
  console.log('\n-- freno de fuerza bruta --');
  const { olvidarIntentos } = await import('../backend/middleware/limites.js');
  // A esta altura la clave ya se cambió en la sección anterior.
  const CLAVE_VIGENTE = 'claveNueva1';
  olvidarIntentos();
  let bloqueada = null;
  for (let i = 0; i < 14 && bloqueada === null; i++) {
    const r = await api('POST', '/api/auth/logistica', { clave: 'probando' + i });
    if (r.status === 429) bloqueada = i;
  }
  ok(bloqueada !== null, `tras varios intentos fallidos responde 429 (al intento ${bloqueada})`);
  ok(bloqueada === 10, 'y aguanta exactamente los 10 configurados antes de frenar');
  const frenada = await api('POST', '/api/auth/logistica', { clave: CLAVE_VIGENTE });
  ok(frenada.status === 429, 'mientras dura el freno ni la clave correcta pasa');
  olvidarIntentos();
  ok((await api('POST', '/api/auth/logistica', { clave: CLAVE_VIGENTE })).status === 200,
     'pasado el castigo, la clave correcta vuelve a entrar');
  olvidarIntentos();

  // ------------------------------------------------------------- errores
  console.log('\n-- errores --');
  const noExiste = await api('GET', '/api/no-existe');
  ok(noExiste.status === 404 && noExiste.datos.error, 'una ruta inexistente responde 404 con mensaje');
  ok((await api('GET', '/api/solicitudes/REQ-999999')).status === 404, 'un ticket inexistente responde 404');

} finally {
  servidor.close();
  const { cerrar } = await import('../backend/db/conexion.js');
  cerrar();
  fs.rmSync(temporal, { recursive: true, force: true });
}

console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
