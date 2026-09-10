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

- **Acceso solicitante:** ingresa con un DNI del padrón de demostración
  (ver `js/db/seed.js`), por ejemplo `41250873`.
- **Acceso logística:** clave de demostración `logistica` (cámbiala desde
  la pestaña *Padrón y accesos* antes de usar datos reales).

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
js/
  config.js                  Constantes (clave de storage, ventana horaria, margen)
  auth.js                    Login por DNI/PIN, autorizaciones, apertura de vistas
  render.js                  Orquestador: repinta lo que corresponde a la sesión
  main.js                    Punto de entrada: arranque, listeners y puente window.*
  db/                        ← BASE DE DATOS
    index.js                  API: DB, cargar(), guardar(), sincronizar()
    schema.js                 Forma de cada colección + versión + migraciones
    seed.js                   Datos de demostración
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

- El padrón de personal (`js/db/seed.js`) es ficticio. Reemplázalo por el
  listado real de RR.HH. antes de poner la plataforma en producción.
- La clave de logística de demostración es `logistica`. Cámbiala desde la
  pestaña *Padrón y accesos*.
- No incluye IGV, arancel, percepción ni otros impuestos: es un registro
  operativo interno.
