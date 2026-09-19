/**
 * Bloquea escrituras que no vengan del propio origen: el equivalente a un
 * token CSRF cuando no hay cookies de sesión (acá la sesión va en un header
 * `Authorization`, que un sitio ajeno no puede adjuntar), pero sigue faltando
 * algo que impida un <form> ajeno apuntando a esta API.
 *
 * Antes de esto, un <form method="POST" action="http://<esta-pc>:3000/api/...">
 * en cualquier página -abierta por alguien con acceso de red a este servidor-
 * podía enviarse solo (`form.submit()`), sin que hiciera falta JavaScript
 * "de verdad": es una petición simple, no dispara preflight de CORS, y
 * `express.urlencoded()` (ver servidor.js) la habría interpretado igual que
 * una del propio formulario. Cerrar esto exige dos cosas juntas, no una sola:
 * quitar `express.urlencoded()` (ya no hay nada que lo necesite) y comprobar
 * el origen en cada escritura, que es lo que hace este archivo.
 *
 * Los navegadores mandan la cabecera `Origin` en todo POST/PUT/PATCH/DELETE,
 * venga de un <form> o de fetch, sea el sitio que sea. Un cliente que no es un
 * navegador (curl, un script, Power BI) normalmente no la manda: no se
 * bloquea, porque esa cabecera nunca miente sobre su origen -a diferencia de
 * un navegador engañado por un <form> ajeno- y bloquearla no cierra nada.
 */
export function origenPropio(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origen = req.headers.origin;
  if (!origen) return next();

  const propio = req.protocol + '://' + req.get('host');
  if (origen !== propio) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }
  next();
}
