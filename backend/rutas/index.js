import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

import * as personal from '../db/repos/personal.js';
import * as solicitudes from '../db/repos/solicitudes.js';
import * as autorizaciones from '../db/repos/autorizaciones.js';
import * as adjuntos from '../db/repos/adjuntos.js';
import * as ajustes from '../db/repos/ajustes.js';
import { conSubida } from '../middleware/subida.js';
import { limitarIntentos } from '../middleware/limites.js';
import { asinc } from '../middleware/errores.js';
import { usuarios } from '../usuarios/rutas.js';
import { requiereSesion, requiereRol } from '../usuarios/middleware.js';
import { CONFIG } from '../config.js';

import { DESTINOS } from '#data/destinos.js';
import { analizarDemanda } from '#shared/payback/demanda.js';
import { construir } from '#shared/payback/escenarios.js';
import { comparar } from '#shared/payback/payback.js';
import { COLUMNAS_VIAJES, filtrarPorRango } from '#shared/exportarViajes.js';

/**
 * La API. Un archivo por ahora, porque son pocas rutas y tenerlas juntas deja
 * ver el contrato completo de un vistazo; si crece, se parte por recurso.
 *
 * Contrato general:
 *   - Todo responde JSON.
 *   - Los errores salen como { error: "mensaje" } con el código HTTP que toca.
 *   - Las escrituras devuelven el objeto ya guardado, para que el navegador
 *     actualice su copia sin tener que volver a preguntar.
 */

export const api = Router();

// Ingreso, cambio de clave propia y administración de usuarios de logística.
// Vive en su propio módulo (usuarios/) porque agrupa hashing de claves,
// sesiones y permisos: cosas que no tienen nada que ver con el resto de la API.
api.use(usuarios);

const error = (msg, status) => Object.assign(new Error(msg), { status });

// ------------------------------------------------------------------ estado
// Una sola llamada con todo lo que la pantalla necesita para pintarse. Es lo
// que el navegador pide al arrancar y cada vez que la revisión cambia.
api.get('/estado', (req, res) => {
  res.json({
    revision: ajustes.revision(),
    versionDatos: ajustes.leer('version_datos', ''),
    // Aquí va el CONTEO del padrón, no el padrón. Mandarlo entero ponía los
    // 212 nombres con su DNI en la memoria de cualquier navegador que abriera
    // la página, lo que dejaba sin efecto la decisión de no listarlo en
    // pantalla: bastaba con abrir la consola. Las fichas se piden de a una
    // por /api/personal?q= y por /api/auth/solicitante/:doc.
    totalPersonal: personal.total(),
    solicitudes: solicitudes.listar(),
    autorizaciones: autorizaciones.listar(),
    adjuntos: adjuntos.listar(),
    destinos: DESTINOS
  });
});

// El testigo, para el sondeo entre pestañas: unos bytes en vez de la base.
api.get('/revision', (req, res) => res.json({ revision: ajustes.revision() }));

// -------------------------------------------------------------------- auth
// El DNI del solicitante no requiere clave: solo comprueba que está en el
// padrón. El ingreso de logística (usuario + clave) vive en usuarios/rutas.js.
//
// Esta ruta lleva freno por IP: responde distinto según el DNI, así que
// sirve para probar documentos a ciegas uno tras otro.
const frenoIngreso = limitarIntentos();

api.get('/auth/solicitante/:doc', frenoIngreso, (req, res) => {
  const p = personal.porDocumento(req.params.doc);
  if (!p) throw error('El documento no figura en el padrón de personal.', 404);
  res.json(p);
});

// ---------------------------------------------------------------- personal
// La búsqueda es de uso interno de logística (ficha de alguien al armar un
// ticket o revisar el padrón): hace falta haber ingresado, cualquiera de los
// dos roles. Agregar o quitar del padrón es cosa de admin: quien encuentra a
// alguien no identificado pide autorización (ver /autorizaciones), no lo
// agrega directo.
api.get('/personal', requiereSesion, (req, res) => {
  // Sin búsqueda no se devuelve el padrón completo: son datos personales de
  // todo el personal y no hay motivo para volcarlos por pedir la ruta.
  const q = req.query.q;
  res.json(q ? personal.buscar(q) : { total: personal.total(), resultados: [] });
});

api.post('/personal', requiereSesion, requiereRol('admin'), (req, res) =>
  res.status(201).json(personal.agregar(req.body || {})));
api.delete('/personal/:dni', requiereSesion, requiereRol('admin'), (req, res) =>
  res.json(personal.quitar(req.params.dni)));

// ------------------------------------------------------------- solicitudes
api.get('/solicitudes', (req, res) => res.json(solicitudes.listar()));

/**
 * Reporte de viajes en Excel, con columnas tipadas (fecha, número) en vez del
 * texto plano del CSV: pensado para abrirse y trabajarse en la propia hoja de
 * cálculo, no para alimentar otro sistema. `desde`/`hasta` filtran por la
 * fecha PROGRAMADA del viaje; en blanco, ese lado del rango queda abierto.
 *
 * Va ANTES de `/solicitudes/:id`: si no, "exportar" caería en `:id` y el
 * servidor respondería "no existe el ticket exportar" en vez de exportar nada.
 */
api.get('/solicitudes/exportar', requiereSesion, asinc(async (req, res) => {
  const { desde, hasta } = req.query;
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw error('La fecha "desde" no es válida.', 400);
  if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) throw error('La fecha "hasta" no es válida.', 400);
  if (desde && hasta && desde > hasta) throw error('La fecha "desde" no puede ser posterior a "hasta".', 400);

  const filas = filtrarPorRango(solicitudes.listar(), desde, hasta);

  const libro = new ExcelJS.Workbook();
  libro.creator = 'PLANSA Delivery';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Viajes', { views: [{ state: 'frozen', ySplit: 1 }] });
  const formato = { numero: '#,##0.00', fecha: 'dd/mm/yyyy', fechahora: 'dd/mm/yyyy hh:mm' };
  hoja.columns = COLUMNAS_VIAJES.map(([etiqueta, tipo]) => ({
    header: etiqueta,
    width: Math.max(12, etiqueta.length + 2),
    style: formato[tipo] ? { numFmt: formato[tipo] } : {}
  }));
  hoja.getRow(1).font = { bold: true };
  filas.forEach(s => hoja.addRow(COLUMNAS_VIAJES.map(([, , valor]) => valor(s))));

  const rango = desde || hasta ? '_' + (desde || 'inicio') + '_a_' + (hasta || 'hoy') : '';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="viajes_plasticos_nacionales' + rango + '.xlsx"');
  await libro.xlsx.write(res);
  res.end();
}));

api.get('/solicitudes/:id', (req, res) => {
  const s = solicitudes.porId(req.params.id);
  if (!s) throw error('No existe el ticket ' + req.params.id + '.', 404);
  res.json(s);
});

// Crear un ticket y consultarlo son autoservicio del solicitante: no llevan
// sesión de logística. Asignar transporte/tarifa y mover el estado sí, porque
// es trabajo de despacho.
api.post('/solicitudes', (req, res) => res.status(201).json(solicitudes.crear(req.body || {})));
api.patch('/solicitudes/:id', requiereSesion, (req, res) =>
  res.json(solicitudes.actualizar(req.params.id, req.body || {})));
api.post('/solicitudes/:id/avanzar', requiereSesion, (req, res) =>
  res.json(solicitudes.avanzar(req.params.id)));

// ---------------------------------------------------------- autorizaciones
// Pedirla es autoservicio (el solicitante cuyo DNI no está en el padrón, o
// logística de seguimiento que encontró a alguien no identificado). Resolverla
// —darle acceso de verdad o rechazarlo— es cosa de admin.
api.get('/autorizaciones', requiereSesion, (req, res) => res.json(autorizaciones.listar()));
api.post('/autorizaciones', (req, res) => res.status(201).json(autorizaciones.pedir(req.body?.dni)));
api.patch('/autorizaciones/:dni', requiereSesion, requiereRol('admin'), (req, res) =>
  res.json(autorizaciones.resolver(req.params.dni, req.body?.estado)));

// ---------------------------------------------------------------- adjuntos
// Ver los adjuntos es autoservicio (el solicitante los ve en su tarjeta, sin
// poder tocarlos). Subir o borrar uno sí es trabajo de despacho.
api.get('/adjuntos', (req, res) =>
  res.json(req.query.ticket ? adjuntos.deTicket(req.query.ticket) : adjuntos.listar()));

/**
 * Subida de una guía. multer deja el archivo en uploads/ con un nombre único y
 * aquí solo se registra dónde quedó. Si el registro falla, se borra el archivo:
 * sin esto, cada error dejaría basura en la carpeta.
 */
api.post('/adjuntos', requiereSesion, conSubida, (req, res) => {
  if (!req.file) throw error('No llegó ningún archivo en el campo "archivo".', 400);
  try {
    res.status(201).json(adjuntos.registrar({
      ticketId: req.body.ticketId,
      archivo: req.file.filename,
      nombreOriginal: req.file.originalname,
      tipo: req.file.mimetype,
      tamano: req.file.size,
      subidoPor: req.body.subidoPor
    }));
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) { /* ya no estaba */ }
    throw e;
  }
});

/** Sirve el binario. El nombre en disco no se toma de la URL, sino de la base. */
api.get('/adjuntos/:id/archivo', (req, res) => {
  const a = adjuntos.porId(req.params.id);
  if (!a) throw error('No existe ese adjunto.', 404);
  const ruta = adjuntos.rutaDe(a.archivo);
  if (!fs.existsSync(ruta)) throw error('El archivo ya no está en el servidor.', 410);

  res.type(a.tipo || 'application/octet-stream');
  res.setHeader('Content-Disposition',
    'inline; filename*=UTF-8\'\'' + encodeURIComponent(a.nombreOriginal));
  res.sendFile(path.resolve(ruta));
});

api.delete('/adjuntos/:id', requiereSesion, (req, res) => res.json(adjuntos.eliminar(req.params.id)));

// ----------------------------------------------------------------- payback
/**
 * El análisis completo, calculado en el servidor.
 *
 * La pantalla también sabe calcularlo —el código de shared/ lo usan los dos,
 * directo contra el estado que ya tiene cargado— así que esta ruta no la pisa
 * la interfaz. Existe para consultarlo desde Power BI, un script o una hoja de
 * cálculo, y por eso es la única "vista" de datos que se reserva a admin: es
 * el análisis de costos completo, no un ticket suelto.
 */
api.get('/payback', requiereSesion, requiereRol('admin'), (req, res) => {
  const demanda = analizarDemanda(solicitudes.listar());
  if (!demanda.hay) throw error('Todavía no hay servicios registrados para analizar.', 409);

  const opciones = {
    idMoto: req.query.moto,
    bonoRemunerativo: req.query.bono !== 'no',
    inicio: req.query.inicio
  };
  const cmp = comparar(construir(demanda, opciones), demanda, opciones);

  res.json({
    gastoActual: cmp.gastoActual,
    viajesPorDia: cmp.viajesPorDia,
    condiciones: cmp.condiciones,
    recomendado: cmp.recomendacion.mejor ? cmp.recomendacion.mejor.escenario.id : null,
    escenarios: cmp.filas.map(f => ({
      id: f.escenario.id,
      nombre: f.escenario.nombre,
      costoMensual: f.costoMensual,
      ahorroMensual: f.ahorroMensual,
      ahorroAnual: f.ahorroAnual,
      inversion: f.inversion,
      mesesRetorno: f.mesesRetorno,
      costoPrimerAnio: f.flujo ? f.flujo.costoPrimerAnio : null,
      mesRecuperacion: f.flujo ? f.flujo.mesRecuperacion : null,
      capacidad: {
        techoDiario: f.escenario.capacidad.techoDiario,
        usoConPrograma: f.escenario.capacidad.usoConPrograma,
        usoSinPrograma: f.escenario.capacidad.usoSinPrograma
      }
    }))
  });
});

// ------------------------------------------------------------------- salud
api.get('/salud', (req, res) => res.json({
  ok: true,
  baseDatos: CONFIG.baseDatos,
  subidas: CONFIG.subidas,
  personal: personal.total(),
  solicitudes: solicitudes.total(),
  adjuntosHuerfanos: adjuntos.huerfanos().length
}));
