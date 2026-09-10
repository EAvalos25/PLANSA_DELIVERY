# Plásticos Nacionales · Mensajería y Encargos

Registro y trazabilidad de mensajería, entrega de documentos y recojo de
paquetes para las sedes de Plásticos Nacionales. Aplicación web sin
dependencias ni build: HTML + CSS + JavaScript con módulos ES nativos.

## Uso

Sirve la carpeta con cualquier servidor estático (los módulos ES no cargan
vía `file://` en todos los navegadores) y abre `index.html`. Por ejemplo:

```powershell
# con Python
python -m http.server 8080
# o con Node (npx)
npx serve .
```

Luego visita `http://localhost:8080`.

- **Acceso solicitante:** ingresa con un DNI del padrón de demostración
  (ver `js/data/seed.js`), por ejemplo `41250873`.
- **Acceso logística:** clave de demostración `logistica` (cámbiala desde
  la pestaña *Padrón y accesos* antes de usar datos reales).

No incluye backend: todo el estado vive en `localStorage` del navegador
(clave `pn_mensajeria_v2`), con una semilla de datos ficticios generada de
forma determinística la primera vez que se abre.

## Estructura del proyecto

```
index.html                  Marcado de las 3 vistas (login, solicitante, logística)
css/
  styles.css                 Hoja de estilos única
js/
  config.js                  Constantes (clave de storage, ventana horaria, margen)
  store.js                    Persistencia en localStorage: cargar/guardar/sincronizar
  auth.js                     Login por DNI/PIN, autorizaciones, apertura de vistas
  render.js                   Orquestador: repinta lo que corresponde a la sesión activa
  main.js                     Punto de entrada: arranque, listeners y puente window.*
  state/
    sessionState.js            Sesión activa (usuario o logística)
  data/
    seed.js                     Datos y generador de la semilla de demostración
  utils/
    dom.js                      $ (getElementById), esc, marcar (validación de campos)
    format.js                   Fechas, horas, soles, textos cortos
    toast.js                    Notificaciones flotantes
  views/
    tabs.js                     Navegación por pestañas (solicitante y logística)
    requestForm.js              Formulario de nueva solicitud (acción, horario, envío)
    tickets.js                  Seguimiento de ticket y "mis servicios"
    presenters.js                Helpers de presentación compartidos (chips, riel, tarjeta)
    dispatch.js                 Bandeja de despacho, transporte/tarifa, modal de detalle
    history.js                  Histórico filtrable y exportación a CSV
    kpi.js                      Indicadores y gráficos (barras y columnas SVG)
    roster.js                   Padrón de personal y autorizaciones de acceso
```

Cada módulo tiene una responsabilidad única y se importa solo donde se
necesita. La única dependencia circular intencional es `render.js` ↔
`views/dispatch.js`: es segura porque las funciones involucradas solo se
invocan desde manejadores de eventos, nunca durante la carga del módulo
(está documentada en el propio código).

### Puente hacia el HTML (`window.*`)

El marcado usa atributos `onclick`/`onchange`/`oninput` (incluida la tabla
de la bandeja y las tarjetas de ticket, generadas dinámicamente). Como los
módulos ES no son globales, `js/main.js` expone explícitamente en `window`
solo las funciones que el HTML necesita invocar así. Es la única lista de
"superficie pública" de la app: si agregas un botón inline nuevo, expórtalo
desde su módulo y súmalo ahí.

**Próximo paso sugerido:** migrar esos atributos inline a delegación de
eventos (`addEventListener` sobre contenedores, leyendo `data-*` en vez de
IDs incrustados en el HTML generado). Es una mejora de aislamiento que no
hace falta para que la app funcione, pero elimina la dependencia de
`window.*`.

## Datos y producción

- El padrón de personal (`js/data/seed.js`) es ficticio. Reemplázalo por
  el listado real de RR.HH. antes de usar la plataforma en producción.
- No incluye IGV, arancel, percepción ni otros impuestos ni integraciones
  externas: es un registro operativo interno con persistencia local.
