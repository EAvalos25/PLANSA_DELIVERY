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

const api = async (metodo, ruta, cuerpo, token) => {
  const init = { method: metodo, headers: {} };
  if (token) init.headers.Authorization = 'Bearer ' + token;
  if (cuerpo instanceof FormData) init.body = cuerpo;
  else if (cuerpo !== undefined) {
    init.headers['Content-Type'] = 'application/json';
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
  ok(!('usuarios' in estado.datos) && !JSON.stringify(estado.datos).includes('claveHash'),
     'ninguna clave ni hash de usuario viaja al navegador');

  // ---------------------------------------------------------- ingreso
  console.log('\n-- ingreso --');
  const eddy = await api('GET', '/api/auth/solicitante/73012556');
  ok(eddy.status === 200 && eddy.datos.nombre.includes('AVALOS'), 'un DNI del padrón se encuentra');
  ok((await api('GET', '/api/auth/solicitante/8161848')).status === 200,
     'el DNI de 7 dígitos se encuentra escrito sin el cero inicial');
  ok((await api('GET', '/api/auth/solicitante/99999999')).status === 404,
     'un documento ajeno al padrón responde 404');

  const loginAdmin = await api('POST', '/api/auth/ingresar', { usuario: 'admin', clave: 'admin' });
  ok(loginAdmin.status === 200 && loginAdmin.datos.token, 'la siembra crea el usuario admin con clave temporal "admin"');
  ok(loginAdmin.datos.rol === 'admin' && loginAdmin.datos.debeCambiarClave === true,
     'entra como admin y con aviso de clave temporal pendiente de cambiar');
  let tokenAdmin = loginAdmin.datos.token;

  ok((await api('POST', '/api/auth/ingresar', { usuario: 'admin', clave: 'noesla' })).status === 401,
     'una clave incorrecta responde 401');
  ok((await api('POST', '/api/auth/ingresar', { usuario: 'noexiste', clave: 'admin' })).status === 401,
     'un usuario que no existe responde lo mismo, sin decir cuál de los dos falló');
  ok((await api('POST', '/api/auth/ingresar', {})).status === 401, 'sin nada, tampoco entra');

  ok((await api('GET', '/api/personal', undefined)).status === 401,
     'sin sesión, ni siquiera se puede buscar en el padrón');
  ok((await api('GET', '/api/auth/yo', undefined, tokenAdmin)).datos.usuario === 'admin',
     'con el token, el servidor sabe quién es');

  // ---------------------------------------------------------- usuarios
  console.log('\n-- cuentas de logística --');
  ok((await api('POST', '/api/usuarios', { usuario: 'jperez', rol: 'seguimiento' })).status === 401,
     'crear un usuario sin sesión no se puede');

  const creado = await api('POST', '/api/usuarios', { usuario: 'jperez', rol: 'seguimiento' }, tokenAdmin);
  ok(creado.status === 201 && creado.datos.claveTemporal && creado.datos.claveTemporal.length === 8,
     'admin crea una cuenta de seguimiento con clave temporal de 8 caracteres');
  ok(!('claveHash' in creado.datos), 'y el hash de la clave nunca sale en la respuesta');
  ok((await api('POST', '/api/usuarios', { usuario: 'jperez', rol: 'seguimiento' }, tokenAdmin)).status === 409,
     'no deja repetir el nombre de usuario');
  ok((await api('POST', '/api/usuarios', { usuario: 'x', rol: 'seguimiento' }, tokenAdmin)).status === 400,
     'rechaza un usuario demasiado corto');
  ok((await api('POST', '/api/usuarios', { usuario: 'jgarcia', rol: 'volador' }, tokenAdmin)).status === 400,
     'y un rol que no existe');

  const loginSeg = await api('POST', '/api/auth/ingresar', { usuario: 'jperez', clave: creado.datos.claveTemporal });
  ok(loginSeg.status === 200 && loginSeg.datos.rol === 'seguimiento', 'la cuenta de seguimiento entra con su clave temporal');
  let tokenSeg = loginSeg.datos.token;

  ok((await api('GET', '/api/usuarios', undefined, tokenSeg)).status === 403,
     'seguimiento no puede listar las cuentas de logística');
  ok((await api('POST', '/api/usuarios', { usuario: 'otro', rol: 'admin' }, tokenSeg)).status === 403,
     'ni crear una cuenta nueva');

  const lista = await api('GET', '/api/usuarios', undefined, tokenAdmin);
  ok(lista.status === 200 && lista.datos.some(u => u.usuario === 'jperez'), 'admin sí ve el listado completo');

  const idAdmin = lista.datos.find(u => u.usuario === 'admin').id;
  ok((await api('PATCH', '/api/usuarios/' + idAdmin, { activo: false }, tokenAdmin)).status === 400,
     'admin no puede desactivarse a sí mismo');

  const desactivado = await api('PATCH', '/api/usuarios/' + creado.datos.id, { activo: false }, tokenAdmin);
  ok(desactivado.status === 200 && desactivado.datos.activo === 0, 'admin desactiva la cuenta de seguimiento');
  ok((await api('POST', '/api/auth/ingresar', { usuario: 'jperez', clave: creado.datos.claveTemporal })).status === 401,
     'una vez desactivada, ya no puede entrar aunque la clave sea correcta');
  ok((await api('GET', '/api/auth/yo', undefined, tokenSeg)).status === 401,
     'y su sesión anterior queda cortada de inmediato, no solo el próximo ingreso');

  const restablecida = await api('POST', '/api/usuarios/' + creado.datos.id + '/restablecer', undefined, tokenAdmin);
  ok(restablecida.status === 200 && restablecida.datos.claveTemporal, 'se le puede generar una nueva clave temporal');
  ok((await api('PATCH', '/api/usuarios/' + creado.datos.id, { activo: true }, tokenAdmin)).datos.activo === 1,
     'y reactivarla');
  const reingreso = await api('POST', '/api/auth/ingresar', { usuario: 'jperez', clave: restablecida.datos.claveTemporal });
  ok(reingreso.status === 200, 'con la nueva clave temporal, vuelve a entrar');
  tokenSeg = reingreso.datos.token;

  // ------------------------------------------------------------ personal
  console.log('\n-- padrón --');
  const sinBuscar = await api('GET', '/api/personal', undefined, tokenAdmin);
  ok(Array.isArray(sinBuscar.datos.resultados) && sinBuscar.datos.resultados.length === 0,
     'sin búsqueda no se vuelca el padrón completo');
  ok(sinBuscar.datos.total === 212, 'pero sí dice cuántos hay');

  const busq = await api('GET', '/api/personal?q=avalos', undefined, tokenSeg);
  ok(busq.datos.length === 1 && busq.datos[0].dni === '73012556',
     'la búsqueda por apellido encuentra, también con la sesión de seguimiento');
  ok((await api('GET', '/api/personal?q=nunez', undefined, tokenAdmin)).datos.length > 0,
     'y encuentra NÚÑEZ escrito sin tildes');

  ok((await api('POST', '/api/personal', { dni: '12345678', nombre: 'PERSONA DE PRUEBA' }, tokenSeg)).status === 403,
     'seguimiento no puede agregar directo al padrón: solo admin');

  const alta = await api('POST', '/api/personal', { dni: '12345678', nombre: 'PERSONA DE PRUEBA', area: 'Logistica' }, tokenAdmin);
  ok(alta.status === 201 && alta.datos.origen === 'manual', 'un alta manual (de admin) se marca como manual');
  ok((await api('POST', '/api/personal', { dni: '12345678', nombre: 'OTRA' }, tokenAdmin)).status === 409,
     'no deja dar de alta dos veces el mismo documento');
  ok((await api('POST', '/api/personal', { dni: '123', nombre: 'X' }, tokenAdmin)).status === 400,
     'rechaza un documento inválido');
  ok((await api('DELETE', '/api/personal/12345678', undefined, tokenSeg)).status === 403,
     'seguimiento tampoco puede quitar del padrón');
  ok((await api('DELETE', '/api/personal/12345678', undefined, tokenAdmin)).status === 200, 'admin sí puede quitarlo');
  ok((await api('DELETE', '/api/personal/12345678', undefined, tokenAdmin)).status === 404, 'quitar dos veces responde 404');

  // --------------------------------------------------------- solicitudes
  console.log('\n-- solicitudes --');
  const nueva = {
    dni: '73012556', nombre: 'EDDY PERCY AVALOS VALDIVIA', cargo: 'COORDINADOR DE LOGISTICA', area: 'Logistica',
    tipo: 'Entregar', servicio: 'Envío de documentos', motivo: 'Entrega de facturas del mes',
    origen: 'Plásticos Nacionales - Talleres', destino: 'PLUS COSMÉTICA, AV. VÍCTOR ANDRÉS BELAÚNDE 280, SAN ISIDRO',
    contacto: 'Mesa de partes', telefono: '987654321', fechaProg: '2026-09-20', horaProg: '10:00'
  };
  // Registrar un ticket es autoservicio del solicitante: sin token.
  const creada = await api('POST', '/api/solicitudes', nueva);
  ok(creada.status === 201, 'se registra una solicitud sin sesión de logística');
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
  ok((await api('PATCH', '/api/solicitudes/' + id, { vehiculo: 'Motorizado' })).status === 401,
     'gestionar el ticket sí exige sesión de logística');
  ok((await api('POST', '/api/solicitudes/' + id + '/avanzar', undefined, tokenSeg)).status === 409,
     'no deja pasar a tránsito sin transporte asignado (seguimiento sí puede intentarlo)');
  ok((await api('PATCH', '/api/solicitudes/' + id, { vehiculo: 'Bicicleta' }, tokenSeg)).status === 400,
     'rechaza un transporte que no existe');
  ok((await api('PATCH', '/api/solicitudes/' + id, { vehiculo: 'Motorizado' }, tokenSeg)).datos.vehiculo === 'Motorizado',
     'seguimiento asigna el transporte: es trabajo de despacho, no de administración');
  ok((await api('POST', '/api/solicitudes/' + id + '/avanzar', undefined, tokenSeg)).datos.estado === 'En tránsito',
     'con transporte, pasa a tránsito');
  ok((await api('POST', '/api/solicitudes/' + id + '/avanzar', undefined, tokenSeg)).status === 409,
     'no deja cerrar sin tarifa');
  ok((await api('PATCH', '/api/solicitudes/' + id, { costo: 25 }, tokenSeg)).datos.costo === 25, 'asigna la tarifa');
  const cerrada = await api('POST', '/api/solicitudes/' + id + '/avanzar', undefined, tokenSeg);
  ok(cerrada.datos.estado === 'Concluido' && cerrada.datos.tsConcluido, 'se cierra y queda la hora de cierre');
  ok((await api('PATCH', '/api/solicitudes/' + id, { costo: 99 }, tokenSeg)).status === 409,
     'un ticket concluido ya no se modifica');

  // ---------------------------------------------------- exportar a Excel
  // Es un binario, no JSON: no pasa por el helper `api()`, que decodifica la
  // respuesta como texto y corrompería el archivo.
  console.log('\n-- exportar viajes a Excel --');
  ok((await fetch(BASE + '/api/solicitudes/exportar')).status === 401,
     'exportar también exige sesión de logística');
  ok((await fetch(BASE + '/api/solicitudes/exportar?desde=feo',
    { headers: { Authorization: 'Bearer ' + tokenAdmin } })).status === 400,
     'rechaza una fecha "desde" con forma inválida');
  ok((await fetch(BASE + '/api/solicitudes/exportar?desde=2026-09-01&hasta=2026-01-01',
    { headers: { Authorization: 'Bearer ' + tokenAdmin } })).status === 400,
     'y un rango con "desde" posterior a "hasta"');

  const excel = await fetch(BASE + '/api/solicitudes/exportar', { headers: { Authorization: 'Bearer ' + tokenSeg } });
  ok(excel.status === 200, 'seguimiento también puede exportar (mismo permiso que ver el histórico)');
  ok(excel.headers.get('content-type').includes('spreadsheetml'), 'con el tipo MIME de un .xlsx');
  ok((excel.headers.get('content-disposition') || '').includes('viajes_plasticos_nacionales.xlsx'),
     'sin rango, el nombre del archivo no lleva fechas');
  const bytesExcel = Buffer.from(await excel.arrayBuffer());
  ok(bytesExcel.length > 1000 && bytesExcel.slice(0, 2).toString('latin1') === 'PK',
     'el archivo pesa lo suyo y arranca con la firma ZIP de un .xlsx de verdad');

  const acotado = await fetch(BASE + '/api/solicitudes/exportar?desde=2026-02-01&hasta=2026-02-28',
    { headers: { Authorization: 'Bearer ' + tokenAdmin } });
  ok((acotado.headers.get('content-disposition') || '').includes('2026-02-01_a_2026-02-28'),
     'con rango, el nombre del archivo lo dice');
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await acotado.arrayBuffer());
  const hoja = libro.getWorksheet('Viajes');
  ok(hoja.getRow(1).getCell(1).value === 'Ticket' && hoja.getRow(1).getCell(19).value === 'Costo (S/)',
     'trae los encabezados de la plataforma, no nombres de columna de base de datos');
  ok(hoja.rowCount - 1 > 0 && hoja.rowCount - 1 < SEMBRADOS,
     `el rango de fechas filtra: menos filas (${hoja.rowCount - 1}) que el histórico completo`);
  const todasEnRango = [];
  for (let f = 2; f <= hoja.rowCount; f++) {
    const fp = hoja.getRow(f).getCell(16).value; // Fecha programada
    todasEnRango.push(fp >= new Date('2026-02-01') && fp <= new Date('2026-02-28T23:59:59'));
  }
  ok(todasEnRango.every(Boolean), 'y ninguna fila cae fuera del rango pedido');
  ok(hoja.getRow(2).getCell(3).type === 4, 'la fecha de registro es una fecha de Excel, no texto');
  const filaConCosto = Array.from({ length: hoja.rowCount - 1 }, (_, i) => hoja.getRow(i + 2))
    .find(r => r.getCell(19).value != null);
  ok(!filaConCosto || filaConCosto.getCell(19).type === 2, 'y el costo es un número de Excel, no texto');

  // ------------------------------------------------------- autorizaciones
  console.log('\n-- autorizaciones --');
  // Pedirla es autoservicio: la usa tanto el solicitante como logística de
  // seguimiento al toparse con alguien no identificado, sin distinción.
  const pedido = await api('POST', '/api/autorizaciones', { dni: '99999999' });
  ok(pedido.status === 201 && pedido.datos.repetido === false, 'se registra un pedido de acceso sin sesión');
  ok((await api('POST', '/api/autorizaciones', { dni: '99999999' })).datos.repetido === true,
     'pedirlo dos veces no duplica');
  ok((await api('GET', '/api/autorizaciones', undefined, tokenSeg)).status === 200,
     'seguimiento puede ver la lista de pedidos pendientes');
  ok((await api('PATCH', '/api/autorizaciones/99999999', { estado: 'Rechazada' }, tokenSeg)).status === 403,
     'pero resolverla —aprobar o rechazar— es cosa de admin');
  ok((await api('PATCH', '/api/autorizaciones/99999999', { estado: 'Rechazada' }, tokenAdmin)).status === 200,
     'admin sí puede rechazarlo');
  ok((await api('PATCH', '/api/autorizaciones/99999999', { estado: 'Rechazada' }, tokenAdmin)).status === 404,
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

  ok((await api('POST', '/api/adjuntos', forma)).status === 401, 'subir un adjunto también exige sesión de logística');
  const subido = await api('POST', '/api/adjuntos', forma, tokenAdmin);
  ok(subido.status === 201, 'se sube una guía de entrega');
  ok(subido.datos.nombreOriginal === 'guía de entrega.pdf', 'se conserva el nombre original en la base');
  ok(/^\d{8}-\d{6}-[0-9a-f]{6}-guia-de-entrega\.pdf$/.test(subido.datos.archivo),
     `en disco quedó renombrado: ${subido.datos.archivo}`);
  ok(fs.existsSync(path.join(process.env.PLANSA_UPLOADS, subido.datos.archivo)),
     'el archivo está en la carpeta de subidas');

  const bajado = await fetch(BASE + '/api/adjuntos/' + subido.datos.id + '/archivo');
  const bytes = Buffer.from(await bajado.arrayBuffer());
  ok(bajado.status === 200 && bytes.equals(contenido), 'al descargarlo vuelve byte por byte igual, sin sesión: el solicitante también lo ve');
  ok(bajado.headers.get('content-type').includes('pdf'), 'y con su tipo declarado');

  const forma2 = new FormData();
  forma2.append('ticketId', id);
  forma2.append('archivo', new Blob([contenido], { type: 'application/pdf' }), 'guía de entrega.pdf');
  const subido2 = await api('POST', '/api/adjuntos', forma2, tokenSeg);
  ok(subido2.datos.archivo !== subido.datos.archivo, 'subir el mismo archivo otra vez no pisa al primero');
  ok(fs.readdirSync(process.env.PLANSA_UPLOADS).filter(f => f.endsWith('.pdf')).length === 2,
     'quedan los dos archivos en la carpeta');

  const rechazado = new FormData();
  rechazado.append('ticketId', id);
  rechazado.append('archivo', new Blob([Buffer.from('MZ')], { type: 'application/x-msdownload' }), 'virus.exe');
  ok((await api('POST', '/api/adjuntos', rechazado, tokenAdmin)).status === 415, 'un ejecutable se rechaza con 415');

  const sinTicket = new FormData();
  sinTicket.append('ticketId', 'REQ-999999');
  sinTicket.append('archivo', new Blob([contenido], { type: 'application/pdf' }), 'x.pdf');
  const huerfano = await api('POST', '/api/adjuntos', sinTicket, tokenAdmin);
  ok(huerfano.status === 404, 'no deja adjuntar a un ticket que no existe');
  ok((await api('GET', '/api/salud')).datos.adjuntosHuerfanos === 0,
     'y no deja el archivo suelto en disco cuando el registro falla');

  const delTicket = await api('GET', '/api/adjuntos?ticket=' + id);
  ok(delTicket.datos.length === 2, 'se listan los adjuntos de un ticket, sin sesión');

  ok((await api('DELETE', '/api/adjuntos/' + subido.datos.id)).status === 401, 'borrar uno sí exige sesión');
  ok((await api('DELETE', '/api/adjuntos/' + subido.datos.id, undefined, tokenAdmin)).status === 200, 'se puede borrar un adjunto');
  ok(!fs.existsSync(path.join(process.env.PLANSA_UPLOADS, subido.datos.archivo)),
     'y el archivo desaparece del disco, no solo de la base');
  ok((await api('DELETE', '/api/adjuntos/' + subido.datos.id, undefined, tokenAdmin)).status === 404,
     'borrarlo dos veces responde 404');

  // ------------------------------------------------------------- payback
  console.log('\n-- payback por API --');
  ok((await api('GET', '/api/payback?inicio=2026-10-01')).status === 401, 'sin sesión no se puede consultar');
  ok((await api('GET', '/api/payback?inicio=2026-10-01', undefined, tokenSeg)).status === 403,
     'ni con sesión de seguimiento: es análisis de costos, cosa de admin');
  const pb = await api('GET', '/api/payback?inicio=2026-10-01', undefined, tokenAdmin);
  ok(pb.status === 200 && pb.datos.escenarios.length === 3, 'admin sí, y devuelve los tres escenarios');
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

  // ----------------------------------------------------------- revisión
  console.log('\n-- sincronización --');
  const r1 = (await api('GET', '/api/revision')).datos.revision;
  ok(typeof r1 === 'string' && r1.length > 0, 'hay un testigo de revisión');
  ok((await api('GET', '/api/revision')).datos.revision === r1, 'sin cambios, el testigo no se mueve');
  await api('POST', '/api/solicitudes', nueva);
  ok((await api('GET', '/api/revision')).datos.revision !== r1, 'al escribir algo, el testigo cambia');

  // --------------------------------------------------------- clave propia
  console.log('\n-- cambio de clave propia --');
  ok((await api('PUT', '/api/auth/clave', { actual: 'noesla', nueva: 'claveNueva1' }, tokenAdmin)).status === 401,
     'sin la clave actual no se puede cambiar');
  ok((await api('PUT', '/api/auth/clave', { actual: 'admin', nueva: 'corta' }, tokenAdmin)).status === 400,
     'una clave de menos de 6 caracteres se rechaza');
  ok((await api('PUT', '/api/auth/clave', { actual: 'admin', nueva: 'admin' }, tokenAdmin)).status === 400,
     'y una igual a la actual también');
  ok((await api('PUT', '/api/auth/clave', { actual: 'admin', nueva: 'claveNueva1' }, tokenAdmin)).status === 200,
     'con la clave actual sí se cambia');
  ok((await api('POST', '/api/auth/ingresar', { usuario: 'admin', clave: 'claveNueva1' })).datos.debeCambiarClave === false,
     'la nueva clave funciona y ya no pide cambiarla');
  ok((await api('POST', '/api/auth/ingresar', { usuario: 'admin', clave: 'admin' })).status === 401,
     'y la vieja deja de funcionar');

  // --------------------------------------------------- freno de intentos
  // Pocas cuentas y un usuario adivinable ('admin'): sin freno se prueba el
  // diccionario entero contra la clave.
  console.log('\n-- freno de fuerza bruta --');
  const { olvidarIntentos } = await import('../backend/middleware/limites.js');
  const CLAVE_VIGENTE = 'claveNueva1';
  olvidarIntentos();
  let bloqueada = null;
  for (let i = 0; i < 14 && bloqueada === null; i++) {
    const r = await api('POST', '/api/auth/ingresar', { usuario: 'admin', clave: 'probando' + i });
    if (r.status === 429) bloqueada = i;
  }
  ok(bloqueada !== null, `tras varios intentos fallidos responde 429 (al intento ${bloqueada})`);
  ok(bloqueada === 10, 'y aguanta exactamente los 10 configurados antes de frenar');
  const frenada = await api('POST', '/api/auth/ingresar', { usuario: 'admin', clave: CLAVE_VIGENTE });
  ok(frenada.status === 429, 'mientras dura el freno ni la clave correcta pasa');
  olvidarIntentos();
  ok((await api('POST', '/api/auth/ingresar', { usuario: 'admin', clave: CLAVE_VIGENTE })).status === 200,
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
