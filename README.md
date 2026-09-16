# PLANSA Delivery

Mensajería y encargos de Plásticos Nacionales: registro de solicitudes,
trazabilidad del despacho, guías de entrega e indicadores de costo.

Aplicación Node.js + SQLite. El navegador no guarda nada: la verdad vive en el
servidor, así que lo que registra una persona lo ve el resto al instante, desde
cualquier PC de la red.

---

## Arrancar

```bash
npm install     # solo la primera vez
npm start       # http://localhost:3000
```

La primera vez se crea `plansa.sqlite` y se siembra con el padrón de RR.HH.
(212 personas) y el histórico real de 2026 (1 386 servicios, S/ 30 264,60).

```bash
npm run dev            # recarga al guardar
npm test               # las tres suites de pruebas
npm run db:reiniciar   # vacía y vuelve a sembrar la base
```

Para mover la base o las subidas a un disco de red:

```bash
PLANSA_PUERTO=8080 PLANSA_DB=D:/datos/plansa.sqlite PLANSA_UPLOADS=D:/datos/guias npm start
```

- **Acceso solicitante:** con un DNI del padrón, por ejemplo `73012556`.
- **Acceso logística:** clave inicial `logistica`. Se verifica en el servidor y
  nunca se envía al navegador. Para cambiarla hay que conocer la vigente.

---

## Estructura

```
server.js                    Punto de entrada: arranca el servidor

backend/                     ← NODE.JS. Nada de esto llega al navegador.
  servidor.js                 Express: API, estáticos, apagado ordenado
  config.js                   Puerto, rutas y límites; todo por variable de entorno
  db/
    esquema.sql               DDL de las tablas: la forma de los datos
    conexion.js               SQLite (node:sqlite), transacciones, snake_case ↔ camelCase
    sembrar.js                Carga inicial: padrón + histórico 2026
    repos/                    Único sitio del proyecto que escribe SQL
      personal.js              padrón y búsqueda
      solicitudes.js           tickets, correlativo y flujo de estados
      autorizaciones.js        pedidos de acceso
      adjuntos.js              metadatos de las guías
      ajustes.js               clave de logística y testigo de revisión
  middleware/
    subida.js                 multer → uploads/, renombrado único
    errores.js                Formato uniforme de errores
  rutas/
    index.js                  La API REST completa

frontend/                    ← NAVEGADOR
  index.html                  Marcado de las vistas + import map
  css/styles.css              Hoja de estilos única (claro/oscuro)
  js/
    main.js                   Arranque, listeners y puente window.*
    auth.js                   Ingreso por DNI / clave, apertura de vistas
    render.js                 Orquestador de repintado y sondeo
    config.js                 Constantes de la interfaz
    api/                      ← Lo único que habla con el servidor
      cliente.js               fetch, errores, URL base
      estado.js                Copia local del estado + escrituras
      adjuntos.js              Subida y descarga de guías
    state/ ui/ utils/          Sesión, tema y utilidades
    views/                     Una vista por pestaña
      payback/                 Pantalla del análisis payback

shared/                      ← CÁLCULO PURO. Lo usan el servidor Y el navegador.
  payback/                    Sin DOM, sin base de datos, sin red: se verifica
    planilla.js               en Node número por número.
    flota.js  demanda.js  capacidad.js  ruta.js  devengos.js
    escenarios.js  payback.js

data/                        ← DATOS DE REFERENCIA (código versionado)
  padron.js                   Las 212 personas de RR.HH.
  destinos.js                 Destinos frecuentes + tarifa de referencia
  historico.js                Los 1 386 servicios de 2026
  payback/                    Supuestos del análisis: jornada, ley, motos, zonas

uploads/                     ← Guías de entrega subidas (fuera de git)
plansa.sqlite                ← La base (fuera de git)
tests/                       node tests/payback.mjs · api.mjs · frontend.mjs
docs/payback.md              El análisis payback, escrito
```

### Por qué `shared/` existe

El cálculo del payback es aritmética pura: no toca el DOM, ni la base, ni la
red. Ponerlo en `backend/` obligaría al navegador a pedir por HTTP cada cambio
del simulador de rutas; ponerlo en `frontend/` dejaría a la API sin poder
calcular. Está en medio, y lo importan los dos con el mismo especificador:

```js
import { comparar } from '#shared/payback/payback.js';
```

En Node lo resuelve el campo `imports` de `package.json`; en el navegador, el
`<script type="importmap">` de `index.html`. Un solo archivo en disco, dos
formas de encontrarlo, cero duplicación.

---

## La base de datos

SQLite, en un solo archivo, con `node:sqlite` incorporado en Node 22.5+. Sin
dependencias nativas que compilar, que en Windows sin herramientas de build es
la diferencia entre funcionar y no.

Cinco tablas —`personal`, `solicitudes`, `autorizaciones`, `adjuntos`,
`ajustes`— definidas en `backend/db/esquema.sql`. Las reglas viven en la base,
no solo en el código: un estado que no existe o una tarifa negativa los rechaza
SQLite con un CHECK, aunque el bug esté en la pantalla.

Todo el SQL está en `backend/db/repos/`. Ninguna ruta, ninguna vista y ningún
cálculo escriben una consulta: si mañana esto se muda a PostgreSQL, se
reescriben esos cinco archivos y nada más.

### Sincronización entre pestañas

Cada escritura mueve un testigo de revisión. El navegador sondea solo ese valor
—unos bytes— y recarga el estado completo únicamente cuando cambió de verdad.
Sin eso, con el histórico cargado, sondear cada dos segundos sería descargar
cientos de KB una y otra vez.

---

## Archivos y fotos

Las guías de entrega se suben con **multer** a `uploads/`. El nombre que manda
el usuario no se usa nunca como nombre en disco:

```
20260915-143012-a3f9c1-guia-de-entrega.jpg
│        │      │      │                └── extensión derivada del tipo declarado
│        │      │      └── nombre original saneado (sin tildes, sin espacios)
│        │      └── 6 caracteres al azar
│        └── hora
└── fecha
```

La marca de tiempo va primero para que la carpeta se ordene sola, y lleva azar
porque dos subidas en el mismo segundo son perfectamente posibles: el timestamp
por sí solo no garantiza unicidad. Construir el nombre desde cero también cierra
la puerta a un `../../backend/servidor.js` como nombre de archivo.

`uploads/` **no** se publica como carpeta estática. Los archivos se sirven por
`GET /api/adjuntos/:id/archivo`, que comprueba que el adjunto exista en la base;
exponer la carpeta permitiría listarla y adivinar nombres.

---

## La API

| | |
|---|---|
| `GET /api/estado` | Todo lo que la pantalla necesita, en una llamada |
| `GET /api/revision` | El testigo, para el sondeo |
| `POST /api/auth/logistica` | Verifica la clave (en el servidor) |
| `GET /api/auth/solicitante/:doc` | Busca un DNI en el padrón |
| `GET /api/personal?q=` | Busca en el padrón; sin `q` no devuelve nada |
| `POST/DELETE /api/personal` | Alta y baja manual |
| `GET/POST /api/solicitudes` | Listar y registrar |
| `PATCH /api/solicitudes/:id` | Transporte y tarifa |
| `POST /api/solicitudes/:id/avanzar` | Mueve el ticket por el flujo |
| `GET/POST/DELETE /api/adjuntos` | Guías de entrega |
| `GET /api/adjuntos/:id/archivo` | Descarga el binario |
| `PUT /api/ajustes/clave` | Cambia la clave (pidiendo la vigente) |
| `GET /api/payback` | El análisis completo, en JSON |
| `GET /api/salud` | Estado del servidor y de la base |

Las validaciones están en el servidor, no solo en la pantalla: sin transporte no
hay salida, sin tarifa no hay cierre, y un ticket concluido ya no se modifica.
Confiar en que el navegador lo valide deja la puerta abierta a que un ticket se
cierre sin costo y los indicadores mientan.

---

## Datos y producción

- **El padrón** (`data/padron.js`) son las 212 personas de RR.HH. Para
  actualizarlo se reemplaza esa lista y se corre `npm run db:reiniciar`. Las
  altas manuales de logística (`origen: 'manual'`) sobreviven a la recarga.
- **Documento de identidad.** Se guarda siempre en forma canónica: los DNI de
  7 dígitos, que el sistema de RR.HH. entrega sin el cero inicial, se completan
  a 8. La persona entra escriba `8161848` o `08161848`. Los de 9 dígitos son
  carnés de extranjería y se respetan tal cual.
- **El padrón no se lista en pantalla.** Son datos personales de todo el
  personal: la tabla aparece vacía y solo muestra las fichas que logística
  busca. La API hace lo mismo: `GET /api/personal` sin búsqueda no devuelve a
  nadie.
- **Nada de datos inventados.** La base arranca con el histórico real de 2026,
  cargado como concluido. Lo que la planilla no registraba —hora, vehículo,
  contacto, tiempos del flujo— se deja vacío en vez de rellenarse. Cada servicio
  lleva `fuente` (`historico` o `app`).
- **Sin autenticación de verdad.** Está pensado para la red interna de la
  planta. La puerta es la clave de logística. Si esto sale a internet, lo
  primero que hay que agregar son sesiones.
- No incluye IGV ni otros impuestos: es un registro operativo interno.

---

## Análisis payback

El módulo que compara tercerizar la mensajería contra tener motorizado propio
—tres escenarios, capacidad, simulador de rutas y calendario de beneficios
sociales— está documentado aparte en **[docs/payback.md](docs/payback.md)**.
