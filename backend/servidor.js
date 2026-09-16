import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

import { CONFIG } from './config.js';
import { abrir, cerrar } from './db/conexion.js';
import { sembrar } from './db/sembrar.js';
import { api } from './rutas/index.js';
import { noEncontrado, manejarErrores } from './middleware/errores.js';

/**
 * Servidor de PLANSA Delivery.
 *
 * Sirve dos cosas: la API en /api y la aplicación del navegador. Está pensado
 * para correr en la red interna de la planta, no en internet: no hay sesiones
 * ni tokens, la puerta es la clave de logística que se verifica en el servidor.
 * Si algún día esto sale a internet, lo primero que hay que agregar es
 * autenticación de verdad.
 */

export function crearApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.use('/api', api);

  // --- estáticos ---
  // frontend/ es la raíz: lo que pida el navegador sale de ahí.
  app.use(express.static(CONFIG.estaticos.frontend, { index: 'index.html' }));

  // shared/ y data/ se publican aparte porque los usan el servidor Y el
  // navegador. El import map de index.html traduce "#shared/..." a estas URL;
  // en Node, el campo "imports" de package.json hace lo mismo contra el disco.
  // Un solo archivo, dos formas de resolverlo, cero duplicación.
  app.use('/shared', express.static(CONFIG.estaticos.shared));
  app.use('/data', express.static(CONFIG.estaticos.data));

  // uploads/ NO se publica como carpeta estática a propósito: los archivos se
  // sirven por /api/adjuntos/:id/archivo, que comprueba que el adjunto exista
  // en la base. Exponer la carpeta permitiría listar y adivinar nombres.

  app.use(noEncontrado);
  app.use(manejarErrores);

  return app;
}

export function iniciar({ puerto = CONFIG.puerto, silencioso = false } = {}) {
  abrir();
  fs.mkdirSync(CONFIG.subidas, { recursive: true });
  sembrar({ silencioso });

  const app = crearApp();
  const servidor = app.listen(puerto, () => {
    if (silencioso) return;
    const dir = servidor.address();
    console.log('\n  PLANSA Delivery');
    console.log('  http://localhost:' + dir.port);
    console.log('  base    ' + CONFIG.baseDatos);
    console.log('  subidas ' + CONFIG.subidas + '\n');
  });

  const apagar = () => {
    servidor.close(() => { cerrar(); process.exit(0); });
    // Si alguna conexión se resiste, no dejamos el proceso colgado.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);

  return servidor;
}
