import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Configuración del servidor. Un solo lugar donde mirar cuando algo "no
 * encuentra" un archivo o un puerto está ocupado.
 *
 * Todo se puede sobrescribir por variable de entorno, que es lo que permite
 * mover la base o la carpeta de subidas a un disco de red sin tocar código:
 *
 *   PLANSA_PUERTO=8080 PLANSA_DB=D:/datos/plansa.sqlite npm start
 */

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ruta = (env, porDefecto) =>
  process.env[env] ? path.resolve(process.env[env]) : path.join(RAIZ, porDefecto);

export const CONFIG = {
  puerto: Number(process.env.PLANSA_PUERTO) || 3000,

  /** Archivo de la base SQLite. Se crea solo la primera vez. */
  baseDatos: ruta('PLANSA_DB', 'plansa.sqlite'),

  /** Carpeta donde multer deja las guías de entrega. */
  subidas: ruta('PLANSA_UPLOADS', 'uploads'),

  /** Lo que se sirve al navegador. */
  estaticos: {
    frontend: path.join(RAIZ, 'frontend'),
    // El cálculo puro y los datos de referencia los usan el servidor Y el
    // navegador. Se publican para que el import map del HTML los resuelva.
    shared: path.join(RAIZ, 'shared'),
    data: path.join(RAIZ, 'data')
  },

  archivos: {
    /** 15 MB por archivo. */
    tamanoMaximo: 15 * 1024 * 1024,
    /** Se admiten imágenes y PDF: es una guía de entrega, no un repositorio. */
    tiposAceptados: [/^image\//, /^application\/pdf$/]
  }
};
