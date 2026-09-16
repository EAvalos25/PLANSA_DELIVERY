import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

import * as personal from '../db/repos/personal.js';
import * as solicitudes from '../db/repos/solicitudes.js';
import * as autorizaciones from '../db/repos/autorizaciones.js';
import * as adjuntos from '../db/repos/adjuntos.js';
import * as ajustes from '../db/repos/ajustes.js';
import { conSubida } from '../middleware/subida.js';
import { CONFIG } from '../config.js';

import { DESTINOS } from '#data/destinos.js';
import { analizarDemanda } from '#shared/payback/demanda.js';
import { construir } from '#shared/payback/escenarios.js';
import { comparar } from '#shared/payback/payback.js';

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

const error = (msg, status) => Object.assign(new Error(msg), { status });

// ------------------------------------------------------------------ estado
// Una sola llamada con todo lo que la pantalla necesita para pintarse. Es lo
// que el navegador pide al arrancar y cada vez que la revisión cambia.
api.get('/estado', (req, res) => {
  res.json({
    revision: ajustes.revision(),
    versionDatos: ajustes.leer('version_datos', ''),
    personal: personal.listar(),
    solicitudes: solicitudes.listar(),
    autorizaciones: autorizaciones.listar(),
    adjuntos: adjuntos.listar(),
    destinos: DESTINOS
  });
});

// El testigo, para el sondeo entre pestañas: unos bytes en vez de la base.
api.get('/revision', (req, res) => res.json({ revision: ajustes.revision() }));

// -------------------------------------------------------------------- auth
// La clave se compara en el servidor. Nunca se envía al navegador.
api.post('/auth/logistica', (req, res) => {
  if (!ajustes.verificarClave(req.body?.clave)) throw error('Clave incorrecta.', 401);
  res.json({ ok: true });
});

api.get('/auth/solicitante/:doc', (req, res) => {
  const p = personal.porDocumento(req.params.doc);
  if (!p) throw error('El documento no figura en el padrón de personal.', 404);
  res.json(p);
});

// ---------------------------------------------------------------- personal
api.get('/personal', (req, res) => {
  // Sin búsqueda no se devuelve el padrón completo: son datos personales de
  // todo el personal y no hay motivo para volcarlos por pedir la ruta.
  const q = req.query.q;
  res.json(q ? personal.buscar(q) : { total: personal.total(), resultados: [] });
});

api.post('/personal', (req, res) => res.status(201).json(personal.agregar(req.body || {})));
api.delete('/personal/:dni', (req, res) => res.json(personal.quitar(req.params.dni)));

// ------------------------------------------------------------- solicitudes
api.get('/solicitudes', (req, res) => res.json(solicitudes.listar()));

api.get('/solicitudes/:id', (req, res) => {
  const s = solicitudes.porId(req.params.id);
  if (!s) throw error('No existe el ticket ' + req.params.id + '.', 404);
  res.json(s);
});

api.post('/solicitudes', (req, res) => res.status(201).json(solicitudes.crear(req.body || {})));
api.patch('/solicitudes/:id', (req, res) => res.json(solicitudes.actualizar(req.params.id, req.body || {})));
api.post('/solicitudes/:id/avanzar', (req, res) => res.json(solicitudes.avanzar(req.params.id)));

// ---------------------------------------------------------- autorizaciones
api.get('/autorizaciones', (req, res) => res.json(autorizaciones.listar()));
api.post('/autorizaciones', (req, res) => res.status(201).json(autorizaciones.pedir(req.body?.dni)));
api.patch('/autorizaciones/:dni', (req, res) =>
  res.json(autorizaciones.resolver(req.params.dni, req.body?.estado)));

// ---------------------------------------------------------------- adjuntos
api.get('/adjuntos', (req, res) =>
  res.json(req.query.ticket ? adjuntos.deTicket(req.query.ticket) : adjuntos.listar()));

/**
 * Subida de una guía. multer deja el archivo en uploads/ con un nombre único y
 * aquí solo se registra dónde quedó. Si el registro falla, se borra el archivo:
 * sin esto, cada error dejaría basura en la carpeta.
 */
api.post('/adjuntos', conSubida, (req, res) => {
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

api.delete('/adjuntos/:id', (req, res) => res.json(adjuntos.eliminar(req.params.id)));

// ----------------------------------------------------------------- ajustes
api.put('/ajustes/clave', (req, res) => {
  if (!ajustes.verificarClave(req.body?.actual)) throw error('La clave actual no es correcta.', 401);
  ajustes.cambiarClave(req.body?.nueva);
  res.json({ ok: true });
});

// ----------------------------------------------------------------- payback
/**
 * El análisis completo, calculado en el servidor.
 *
 * La pantalla también sabe calcularlo —el código de shared/ lo usan los dos—,
 * pero tenerlo en la API permite consultarlo desde Power BI, un script o una
 * hoja de cálculo sin abrir el navegador.
 */
api.get('/payback', (req, res) => {
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
