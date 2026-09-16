/**
 * Manejo de errores de la API.
 *
 * Todo lo que falla sale con la misma forma —`{ error: "mensaje" }`— para que
 * el navegador tenga siempre algo que mostrarle al usuario. Los repositorios
 * lanzan errores con `status` cuando saben el código HTTP que corresponde;
 * cualquier otra cosa es un fallo nuestro y sale como 500 sin detalles.
 */

export function noEncontrado(req, res) {
  res.status(404).json({ error: 'No existe la ruta ' + req.method + ' ' + req.originalUrl });
}

export function manejarErrores(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    // Un 500 es un error de programación: al log completo, que es donde se
    // arregla. Al usuario no se le cuenta la estructura interna.
    console.error('[error]', req.method, req.originalUrl, '\n', err);
    return res.status(500).json({ error: 'Error interno del servidor. Revisa la consola del servidor.' });
  }

  res.status(status).json({ error: err.message });
}

/**
 * Envuelve un manejador asíncrono para que un rechazo llegue al manejador de
 * errores en vez de quedar como promesa sin capturar.
 */
export const asinc = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
