import { CONFIG } from '../config.js';

/**
 * Dos defensas mínimas para cuando la aplicación deja de estar sola en una PC
 * y pasa a escucharse en la red: freno a los intentos de clave y cabeceras
 * que le dicen al navegador que no se tome libertades.
 *
 * No reemplazan a la autenticación de verdad, que este proyecto todavía no
 * tiene. Son lo que evita que una prueba con gente conectada se convierta en
 * un problema por algo tonto.
 */

// ------------------------------------------------------------ fuerza bruta
/**
 * Freno por IP para las rutas de ingreso.
 *
 * La clave de logística es una sola palabra: sin freno, un script prueba el
 * diccionario entero en segundos, y el servidor responde encantado porque
 * comparar cadenas no le cuesta nada. Con esto, cada IP tiene un presupuesto
 * de intentos fallidos y luego espera.
 *
 * El contador vive en memoria, no en la base: se pierde al reiniciar y no
 * sirve contra un atacante con muchas IP. Para una planta con una red interna
 * y una prueba en la red privada de la empresa, alcanza; si esto sale a
 * internet, hace falta sesiones de verdad, no un contador.
 */
const intentos = new Map();          // ip -> { n, hasta }

/** Se limpia sola: sin esto, la tabla crece con cada IP que pasa alguna vez. */
function purgar(ahora) {
  for (const [ip, e] of intentos) if (e.hasta <= ahora) intentos.delete(ip);
}

export function limitarIntentos({ maximo = CONFIG.limites.intentos, ventanaMs = CONFIG.limites.ventanaMs } = {}) {
  return function (req, res, next) {
    const ahora = Date.now();
    if (intentos.size > 1000) purgar(ahora);

    const ip = req.ip || req.socket.remoteAddress || 'desconocida';
    const e = intentos.get(ip);
    if (e && e.hasta > ahora && e.n >= maximo) {
      const faltan = Math.ceil((e.hasta - ahora) / 1000);
      res.setHeader('Retry-After', String(faltan));
      return res.status(429).json({
        error: 'Demasiados intentos fallidos. Espera ' + faltan + ' segundos y vuelve a probar.'
      });
    }

    // Solo cuentan los fallos: quien acierta no gasta presupuesto, y al
    // acertar se le borra el que había gastado.
    res.on('finish', () => {
      if (res.statusCode < 400) { intentos.delete(ip); return; }
      if (res.statusCode === 429) return;
      const previo = intentos.get(ip);
      const vigente = previo && previo.hasta > Date.now() ? previo : { n: 0, hasta: 0 };
      intentos.set(ip, { n: vigente.n + 1, hasta: Date.now() + ventanaMs });
    });

    next();
  };
}

/** Para las pruebas: deja el contador como recién arrancado. */
export const olvidarIntentos = () => intentos.clear();

// ------------------------------------------------------- cabeceras básicas
/**
 * Cabeceras de seguridad. Son pocas y todas por un motivo concreto:
 *
 *  - nosniff          el navegador no adivina el tipo de un archivo subido.
 *  - DENY en frames   nadie puede meter la app en un iframe y engañar al clic.
 *  - Referrer         al abrir un enlace externo no se filtra la ruta interna.
 *  - CSP              los scripts salen de este servidor y de ningún otro; si
 *                     algún día entra un texto con <script>, no se ejecuta
 *                     nada traído de fuera. 'unsafe-inline' sigue habilitado
 *                     porque el HTML usa atributos onclick; quitarlos es la
 *                     mejora siguiente, no esta.
 */
export function cabeceras(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  next();
}

// --------------------------------------------------- estáticos de data/
/**
 * `data/` tiene dos clases de archivos muy distintas: los supuestos del
 * payback, que el navegador necesita, y el padrón y el histórico, que son
 * datos personales y de costos y no tienen por qué salir del servidor.
 *
 * Publicar la carpeta entera dejaba `/data/padron.js` —212 nombres con su
 * DNI— al alcance de cualquiera que escribiera la URL. Aquí se invierte la
 * regla: solo se sirve lo que está declarado como público y lo demás no
 * existe para el navegador, así que un archivo nuevo en `data/` nace privado.
 */
export function soloDatosPublicos(req, res, next) {
  const pedido = decodeURIComponent(req.path).replace(/^\/+/, '');
  const publico = CONFIG.datosPublicos.some(p =>
    p.endsWith('/') ? pedido.startsWith(p) : pedido === p);
  if (publico) return next();
  res.status(404).json({ error: 'No existe /data/' + pedido });
}
