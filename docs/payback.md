# Módulo payback

Responde una pregunta: **¿conviene dejar de tercerizar la mensajería y tener
motorizado propio?** Y si conviene, en cuál de los tres escenarios.

Se abre desde el botón **Payback**, arriba a la derecha de la vista de
logística. No guarda nada: lee el histórico de servicios y recalcula cada vez,
así que a medida que se registren tickets reales el análisis se actualiza solo.

---

## Cómo está organizado

El análisis no vive en una carpeta propia: sus piezas están repartidas por la
estructura general del proyecto, cada una donde le corresponde.

```
data/payback/    Los supuestos. Todo lo que se discute con RR.HH., Finanzas
                 o un proveedor vive aquí, y se cambia sin tocar el cálculo.
  parametros.js   jornada, tasas de ley, costos de flota, los 3 escenarios
  motos.js        las 3 opciones de 150 cc a cotizar (US$ 2 500 a 5 000)
  zonas.js        distritos, minutos desde planta y días de ruta
  tiempos.js      matriz de minutos entre zonas, sin pasar por planta

shared/payback/  El cálculo. Funciones puras, sin DOM, sin base y sin red:
                 entra una configuración, sale un número.
  planilla.js     costo laboral de una persona + avisos legales
  flota.js        inversión y gasto mensual de una moto propia
  demanda.js      lo que pasa hoy, leído del histórico de servicios
  capacidad.js    minutos de ruta que exige la demanda contra los disponibles
  ruta.js         simula UNA salida concreta: orden, paradas y retorno
  devengos.js     gratificación y CTS mes a mes según la fecha de ingreso
  escenarios.js   arma los tres escenarios completos
  payback.js      compara contra el courier y calcula el retorno

frontend/js/views/payback/    La pantalla. Única capa que toca el DOM.
  vista.js        arma la pantalla y orquesta las secciones
  simulador.js    el simulador editable de una salida
  calendario.js   el calendario de beneficios por fecha de ingreso

tests/payback.mjs               node tests/payback.mjs
```

Que el cálculo esté en `shared/` no es un detalle de orden: lo importan igual el
servidor y el navegador. La pantalla lo llama directo, así que el simulador de
rutas responde al instante sin ir y volver por la red; y la API expone el mismo
resultado en `GET /api/payback`, para consultarlo desde Power BI o un script sin
abrir el navegador. Un solo archivo, dos consumidores, cero duplicación.

---

## Los números, con la data real

Base de comparación: **1 600 servicios de 2026** registrados en el histórico
(15 de enero al 15 de septiembre, S/ 35 234,60).

| | |
|---|---|
| Gasto mensual en courier | **S/ 5 064** (promedio de junio, julio y agosto) |
| Costo promedio por viaje | S/ 22,95 |
| Encargos por día, lun-vie | 9,0 |
| Encargos el sábado | 3,3 |
| Día cargado (10% de los días lo supera) | 12 |
| Máximo medido en un día | 20 |
| Días con movimiento medidos | 197 |

Septiembre queda fuera del promedio porque la planilla corta el día 15 y el mes
está incompleto; incluirlo haría parecer que se gasta menos. El promedio se
toma siempre de los tres últimos meses cerrados, así que se mueve solo cuando
se carga una planilla más nueva.

### Los tres escenarios

Con el bono tratado como remunerativo (el supuesto conservador) y la Honda XR
150 L a US$ 2 900 de referencia:

| | Escenario 1<br>moto propia del trabajador | Escenario 2<br>moto de la empresa | Escenario 3<br>dos part time |
|---|---:|---:|---:|
| Planilla total | 2 948 | 2 527 | 2 744 |
| Gasto de moto | — | 681 | — |
| Cobertura de vacaciones | 440 | 440 | 88 |
| Courier para días cargados | 547 | 547 | 547 |
| **Costo mensual** | **3 935** | **4 196** | **3 379** |
| **Ahorro frente al courier** | **1 128** | **868** | **1 684** |
| Ahorro al año | 13 538 | 10 418 | 20 211 |
| Inversión inicial | — | 12 025 | — |
| Retorno de la inversión | — | 14 meses | — |

Esos 14 meses son la cuenta simple: inversión entre ahorro mensual. El módulo
también calcula el retorno recorriendo el flujo real mes a mes desde la fecha
de ingreso, y ahí cambia —12 o 13 meses según cuándo entre— porque el primer
año no paga las mismas gratificaciones. Es lo que se explica más abajo.

Los tres salen más baratos que tercerizar. El tercero es el más barato y el
único sin riesgo alto.

### Por qué el costo laboral es 1,40 veces el sueldo

Sobre S/ 1 800 + S/ 300 de bono, el costo real para la empresa es S/ 2 948 al
mes. La diferencia son gratificaciones (2 al año), la bonificación
extraordinaria de la Ley 30334, CTS (7/6 de sueldo al año, porque la
remuneración computable incluye un sexto de la gratificación), EsSalud 9%,
Vida Ley y SCTR.

Las **vacaciones no aparecen** como costo en planilla, y es a propósito: los 30
días se pagan dentro de los doce sueldos del año, no encima de ellos. Sumarlas
otra vez sería contarlas dos veces. Lo que sí cuesta es quedarse sin motorizado
esos 26 días hábiles: ahí vuelve el courier, y eso está provisionado aparte.

---

## Las tres cosas que cambian la decisión

### 1. La capacidad es la misma en los tres escenarios

Una persona a tiempo completo trabaja 47 h a la semana. Dos personas a media
jornada suman **las mismas 47 h**. Dos motos no rinden el doble si se turnan
para cubrir el mismo horario de 8:00 a 17:30; rendirían el doble solo si
salieran a la vez, y entonces media jornada quedaría sin cubrir.

Lo que cambia entre escenarios es el costo y el riesgo, no cuántos encargos se
mueven.

### 2. Sí alcanza una sola moto, pero solo con programación

Con los encargos agrupados por zona, un día promedio ocupa el **94%** del
tiempo útil. El techo son **9,3 encargos al día** y hoy se hacen 9,0.

Atendiendo cada pedido por separado, en cuanto llega, el mismo volumen exige el
**243%** de la jornada: dos motorizados y medio.

Lo que satura no es el número de encargos, es el número de **salidas**. Diez
encargos a Lima norte en una salida caben; cuatro encargos a cuatro zonas
distintas, no. La programación no es una mejora deseable: es la condición para
que esto exista.

**El simulador de salida** lleva esto al caso concreto. Se arma la ruta como se
armaría mañana —qué zonas, en qué orden, cuántas entregas en cada una, a qué
hora se sale— y devuelve la cronología minuto a minuto: cuándo llega a cada
zona, cuánto tarda en los puntos, a qué hora vuelve a planta y cuánto margen
queda antes del fin de jornada.

Sirve para dos cosas que el promedio semanal no puede responder:

- **El orden importa.** Norte → centro → moderna toma 4 h 49 min; las mismas
  ocho entregas empezando por moderna toman 27 minutos más. El botón de ordenar
  prueba todas las combinaciones y se queda con la más corta.
- **La hora de salida importa.** Doce entregas repartidas en Chilca, Lima sur y
  Lima este entran saliendo a las 8:00, con menos de una hora de margen; la
  misma ruta saliendo a las 10:00 ya no entra.

Los minutos de viaje se editan en la misma pantalla, sin tocar código: son el
supuesto que más mueve el resultado y conviene corregirlos con lo que se mida
en la calle.

### 3. El día cargado se desborda, y está previsto

El promedio es 9,0, pero el 10% de los días pasa de 12 y hubo días de 20. Con 12
encargos el uso sube a 125%: no entra. Esos días el excedente sigue saliendo por
courier, y por eso hay una línea de S/ 465 al mes en los tres escenarios.

Dimensionar para el pico exigiría un segundo motorizado permanente, que costaría
más de lo que ahorra. Dimensionar para el promedio y derivar el pico es lo
correcto.

---

## Cuándo entra el motorizado, y por qué cambia el costo

La gratificación es **un sueldo completo por semestre entero**, y proporcional
si se trabajó menos: un sexto de sueldo por cada mes completo. Se paga en julio
(por el semestre enero-junio) y en diciembre (por julio-diciembre). La CTS se
deposita en mayo y noviembre, y su base no es solo el sueldo: es el sueldo más
un sexto de la última gratificación recibida.

Eso hace que el primer año dependa mucho de la fecha de ingreso, y el módulo lo
calcula solo. Poniendo la fecha, la tabla muestra mes por mes qué se paga:

| Ingreso | Costo del primer año | Retorno de la inversión (escenario 2) |
|---|---:|---:|
| 1 de octubre de 2026 | S/ 48 390 | 12 meses |
| 1 de enero de 2027 | S/ 49 896 | 13 meses |

Entrar en octubre sale más barato el primer año porque no se alcanza la
gratificación de julio y la de diciembre se cobra a medias (3 de 6 meses). No es
un ahorro real —se paga igual el año siguiente—, pero sí cambia la caja del
primer año y el momento en que la inversión se recupera.

Dos detalles que la tabla deja ver y que suelen olvidarse:

- El **primer depósito de CTS** de quien acaba de entrar sale más bajo de lo que
  saldrá después, porque todavía no hay gratificación previa que sumar a la
  base.
- **Julio y diciembre cuestan casi el doble** que un mes normal. Conviene que
  Finanzas lo tenga en el presupuesto y no lo descubra en la planilla.

El part time del escenario 3 no genera CTS, así que su calendario solo tiene los
dos hitos de gratificación.

---

## Cómo se dejan de tener urgencias

Con un solo motorizado, cada urgencia no atrasa un envío: rompe la ruta del día.
Seis medidas, de la más simple a la más de fondo:

1. **Hora de corte diaria.** Lo que entra hasta las 16:00 se programa en la ruta
   del día siguiente. La plataforma ya obliga a un margen de 4 horas; la hora de
   corte es la misma idea, fijada a una hora concreta y conocida por todos.

2. **Días fijos por zona.** Las zonas lejanas no se visitan todos los días.
   Publicar el calendario convierte «necesito ir a Chilca hoy» en «Chilca sale
   los martes», que es otra conversación.

3. **Cupo reservado para urgencias reales.** El 15% de la jornada queda libre a
   propósito: unas 6 h a la semana para lo que de verdad no puede esperar. Tener
   el cupo explícito evita que cada urgencia rompa la ruta completa.

4. **La urgencia se carga al área que la pide.** Mientras el sobrecosto lo
   absorba logística, no hay motivo para programar. Si aparece en el centro de
   costo de quien lo pidió, la urgencia se vuelve cara para quien la genera.

5. **Medir quién genera urgencias.** El módulo de indicadores ya muestra quién
   solicita más servicios. Añadir el conteo de pedidos fuera de la hora de corte,
   publicado por área cada mes, suele bastar.

6. **Encargos recurrentes en calendario.** Buena parte de los viajes se repiten
   —Lima moderna concentra el 29%—. Lo que se repite todas las semanas no
   debería pedirse cada vez.

---

## Antes de decidir

Tres cosas de este módulo son supuestos, no datos, y están marcadas como tales
en el código:

- **Las tasas de ley** son las del régimen laboral común del sector privado. Las
  primas de Vida Ley y SCTR varían por aseguradora y por clasificación de
  riesgo. Que RR.HH. y contabilidad las validen antes de firmar nada.
- **Los precios de las motos** son referenciales dentro del rango de mercado
  (US$ 2 500 a 5 000), no cotizaciones firmes. Es lo que más mueve el plazo de
  retorno del escenario 2.
- **Los minutos de viaje** —desde planta y entre zonas— son estimaciones de
  tráfico de día laborable, calibradas para una planta en Lima norte. Se editan
  en el propio simulador, y el primer mes de operación real los corrige.

Todo eso se edita en `data/parametros.js`, `data/motos.js`, `data/zonas.js` y
`data/tiempos.js`. El cálculo no se toca.

Dos puntos legales que el módulo verifica y avisa en pantalla:

- La jornada pedida (lun-vie 8:00–17:30, sáb 8:00–12:30) suma **47 h**, debajo
  del tope de 48 h, **siempre que el refrigerio de 60 minutos no se compute como
  trabajo**. Con 45 minutos se pasaría del tope y habría sobretiempo.
- El escenario 3 solo es part time si cada persona queda **por debajo de 4 h
  diarias** (le corresponden 3,92 h). A partir de 4 h corresponden CTS, 30 días
  de vacaciones y la remuneración mínima completa, y el ahorro desaparece.
