# Plásticos Nacionales · Mensajería y Encargos

Registro y trazabilidad de mensajería, entrega de documentos y recojo de
paquetes para las sedes de Plásticos Nacionales. Aplicación web sin
dependencias ni build: HTML + CSS + JavaScript con módulos ES nativos.

## Uso

Sirve la carpeta con cualquier servidor estático (los módulos ES no cargan
vía `file://`) y abre `index.html`. Por ejemplo:

```powershell
# con Python
python -m http.server 8080
# o con Node (npx)
npx serve .
```

Luego visita `http://localhost:8080`.

- **Acceso solicitante:** ingresa con un DNI del padrón de RR.HH.
  (ver `js/db/padron.js`), por ejemplo `73012556`.
- **Acceso logística:** la clave inicial es `logistica`. No se muestra en
  ninguna pantalla: para cambiarla hay que entrar con ella y usar la pestaña
  *Padrón y accesos*.

## Apariencia

- El **tema claro es el predeterminado**; el botón de la cabecera cambia a
  modo oscuro y la preferencia queda guardada en el navegador.
- La paleta sale del logo: azul `#1B4E8E` y verde `#2FA84F`. Los estados
  (en espera / en tránsito / concluido / error) tienen su propia familia de
  colores para que se distingan sin depender de la marca.
- Todo el color vive en variables CSS al inicio de `css/styles.css`: se
  cambia la marca completa editando ese bloque.
- El logo es un SVG dibujado en el propio `index.html` (no depende de
  ningún archivo de imagen). Si prefieres el archivo original de la marca,
  reemplaza ese `<svg class="brand-logo">` por un `<img>`.

## Estructura del proyecto

```
index.html                  Marcado de las 3 vistas (login, solicitante, logística)
css/
  styles.css                 Hoja de estilos única (tokens de color claro/oscuro)
js/                          ← LA APLICACIÓN DE MENSAJERÍA
  config.js                  Constantes (clave de storage, ventana horaria, margen)
  auth.js                    Login por DNI/PIN, autorizaciones, apertura de vistas
  render.js                  Orquestador: repinta lo que corresponde a la sesión
  main.js                    Punto de entrada: arranque, listeners y puente window.*
  db/                        ← BASE DE DATOS
    index.js                  API: DB, cargar(), guardar(), sincronizar()
    schema.js                 Forma de cada colección + versión + migraciones
    padron.js                 Padrón real de RR.HH. + normalización del documento
    destinos.js               Destinos frecuentes unificados + tarifa de referencia
    historico.js              Los 1 386 servicios de 2026 con su costo
    seed.js                   Estado inicial: padrón + histórico, sin datos inventados
    adapters/
      localStorageAdapter.js   Implementación actual + contrato para migrar a nube
  storage/                   ← ARCHIVOS (guías de entrega)
    index.js                  API: subir(), adjuntosDe(), eliminar(), urlDe()
    adapters/
      indexedDbAdapter.js      Implementación actual + contrato para migrar a nube
  state/
    sessionState.js            Sesión activa (usuario o logística)
  ui/
    themeBoot.js               Script clásico: aplica el tema antes del primer pintado
    theme.js                   Conmutador claro/oscuro
  utils/
    dom.js                     $ (getElementById), esc, marcar (validación)
    format.js                  Fechas, horas, soles, textos cortos
    toast.js                   Notificaciones flotantes
  views/
    tabs.js                    Navegación por pestañas
    requestForm.js             Formulario de nueva solicitud
    tickets.js                 Seguimiento de ticket y "mis servicios"
    presenters.js              Helpers de presentación compartidos
    dispatch.js                Bandeja de despacho y modal de gestión
    attachments.js             Guía / documento de entrega por viaje
    history.js                 Histórico filtrable y exportación a CSV
    kpi.js                     Indicadores y gráficos
    roster.js                  Padrón de personal y autorizaciones

payback/                     ← MÓDULO PAYBACK (análisis de motorizado propio)
  README.md                  El análisis escrito, con las cifras y la conclusión
  data/                      Los supuestos: se editan sin tocar el cálculo
    parametros.js             Jornada, tasas de ley, costos de flota, escenarios
    motos.js                  Las 3 opciones de 150 cc (US$ 2 500 a 5 000)
    zonas.js                  Distritos, minutos desde planta y días de ruta
    tiempos.js                Matriz de minutos entre zonas, sin pasar por planta
  backend/                   Cálculo puro, sin DOM: se corre y se verifica en Node
    planilla.js               Costo laboral por persona + avisos legales
    flota.js                  Inversión y gasto mensual de una moto propia
    demanda.js                Lo que pasa hoy, leído del histórico de servicios
    capacidad.js              Minutos de ruta que exige la demanda
    ruta.js                   Simula UNA salida: orden, paradas y retorno
    devengos.js               Gratificación y CTS según la fecha de ingreso
    escenarios.js             Arma los tres escenarios completos
    payback.js                Compara contra el courier y calcula el retorno
  frontend/                  La pantalla; única capa que toca el DOM
    vista.js                  Arma la pantalla y orquesta las secciones
    simulador.js              Simulador editable de una salida
    calendario.js             Calendario de beneficios por fecha de ingreso
  test/
    pruebas.mjs               node payback/test/pruebas.mjs
```

Cada módulo tiene una responsabilidad única. La única dependencia circular
intencional es `render.js` ↔ `views/dispatch.js`: es segura porque las
funciones involucradas solo se invocan desde manejadores de eventos, nunca
durante la carga del módulo (está documentada en el código).

## Guía de entrega por viaje

Logística adjunta una **imagen o PDF** a cada servicio desde el botón
*Gestionar* de la bandeja. El solicitante ve esos documentos (sin poder
modificarlos) en su tarjeta de ticket, y la bandeja muestra un contador de
adjuntos por fila.

Hoy los archivos se guardan en **IndexedDB del navegador** (soporta fotos y
PDF de varios MB, a diferencia de localStorage). Límite por archivo: 15 MB.

> **Importante:** IndexedDB es local a cada equipo y navegador. Los adjuntos
> subidos en la PC de logística no se ven desde otra PC. Para compartirlos de
> verdad hace falta una nube: ver la sección siguiente.

El arranque de la app **nunca depende** del almacenamiento de archivos: si
IndexedDB está bloqueado o no responde, la app de despacho funciona igual y
solo se avisa que los adjuntos no persistirán.

## Cómo migrar a una nube real

Igual que los archivos, **los datos también son locales a cada navegador**:
hoy cada PC tiene su propia base. Para que logística y los solicitantes
compartan la misma información hace falta un servicio real (Firebase,
Supabase, o una API propia).

Todo el proyecto está preparado para ese cambio: el resto del código no sabe
dónde viven los datos ni los archivos. Para migrar:

1. **Base de datos** — crea `js/db/adapters/miNubeAdapter.js` que exporte
   `leer()`, `escribir(texto)` y `leerSincrono()` (contrato documentado en
   `localStorageAdapter.js`) y cambia el único `import` de `js/db/index.js`.
2. **Archivos** — crea `js/storage/adapters/miNubeAdapter.js` que exporte
   `guardar()`, `listarMetadatos()`, `leer()` y `eliminar()` (contrato
   documentado en `indexedDbAdapter.js`) y cambia el `import` de
   `js/storage/index.js`.

Ningún otro archivo del proyecto se toca. `cargar()` ya es asíncrona
justamente para que un adaptador de red entre sin cambios en quien la llama.

## Puente hacia el HTML (`window.*`)

El marcado usa atributos `onclick`/`onchange`/`oninput` (incluida la tabla de
la bandeja y las tarjetas, generadas dinámicamente). Como los módulos ES no
son globales, `js/main.js` expone explícitamente en `window` solo las
funciones que el HTML necesita invocar así. Es la única "superficie pública"
de la app: si agregas un botón inline nuevo, expórtalo desde su módulo y
súmalo ahí.

**Próximo paso sugerido:** migrar esos atributos inline a delegación de
eventos (`addEventListener` sobre contenedores, leyendo `data-*`). Elimina la
dependencia de `window.*`, aunque no hace falta para que la app funcione.

## Datos y producción

- El padrón (`js/db/padron.js`) son las 212 personas del listado de RR.HH.
  Para actualizarlo, reemplaza esa lista y **sube `VERSION` en
  `js/db/schema.js`**: así las bases ya guardadas en los navegadores adoptan
  el padrón nuevo en el siguiente ingreso. Las altas hechas a mano desde la
  pestaña *Padrón y accesos* (marcadas con `origen: 'manual'`) sobreviven.
- **Documento de identidad.** Se guarda siempre en forma canónica: los DNI de
  7 dígitos (el sistema de RR.HH. recorta el cero inicial) se completan a 8,
  así la persona entra escriba `8161848` o `08161848`. Los documentos de
  9 dígitos son carnés de extranjería y se respetan tal cual.
- **El padrón no se lista en pantalla.** Son datos personales de todo el
  personal: la tabla de *Padrón y accesos* aparece vacía y solo muestra las
  fichas que logística busca por documento, apellido o nombre. La búsqueda
  ignora tildes y admite las palabras en cualquier orden.
- **Sede.** No se guarda por persona. La sede de salida se elige en cada
  solicitud, que es donde realmente cambia.
- **Nada de datos inventados.** La base arranca con el padrón de RR.HH. y con
  los **1 386 servicios reales de 2026** (`js/db/historico.js`, del 15/01 al
  19/08, S/ 30 264,60). Entran como concluidos, así que los indicadores abren
  con el gasto real del año y la bandeja de despacho abre vacía, que es lo
  correcto: no hay nada pendiente hasta que alguien registre una solicitud.
- **Lo que la planilla no registra se deja vacío**, no se rellena: hora
  programada, vehículo, persona que recibe, teléfono y los tiempos del flujo.
  Por eso los paneles de *Reparto por vehículo* y *Tiempos del flujo* empiezan
  sin datos y se van llenando con los tickets que sí pasen por la aplicación.
  Cada servicio lleva `fuente` (`historico` o `app`), visible en el detalle y
  en el CSV.
- **Destinos** (`js/db/destinos.js`). Salen del mismo histórico. El mismo sitio
  aparecía escrito de muchas formas —erratas, tildes ausentes, la dirección con
  y sin número—, así que las redacciones se agruparon por parecido y quedó una
  por lugar, con el nombre corregido a mano. Dos sedes de una misma empresa
  siguen siendo dos destinos. Se ofrecen como sugerencia al escribir el
  destino; el campo sigue aceptando texto libre.
- **Tarifa de referencia.** Cada destino frecuente guarda lo que más veces se
  pagó por ir allí (la moda, que es el precio de lista) y el rango real. Al
  asignar la tarifa, logística ve esa referencia y puede aplicarla de un clic.
- Los dos CSV de origen son el mismo conjunto de viajes: `data_valorizado.csv`
  es `data_destinos.csv` con fecha, costo y solicitante, así que es el único
  que se usa para generar los módulos.
- **Correlativo.** Lo genera la app (`REQ-001`, `REQ-002`…). En *Seguimiento*
  el prefijo `REQ-` es fijo en pantalla y el solicitante teclea solo el número.
- Lo único ficticio que queda son las solicitudes con las que abre la bandeja
  (`js/db/seed.js`), todas marcadas con `demo: true`.
- La clave inicial de logística es `logistica` y ya no aparece escrita en la
  interfaz. Cámbiala desde la pestaña *Padrón y accesos*.
- No incluye IGV, arancel, percepción ni otros impuestos: es un registro
  operativo interno.
