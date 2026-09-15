# Módulo payback

Responde una pregunta: **¿conviene dejar de tercerizar la mensajería y tener
motorizado propio?** Y si conviene, en cuál de los tres escenarios.

Se abre desde el botón **Payback**, arriba a la derecha de la vista de
logística. No guarda nada: lee el histórico de servicios y recalcula cada vez,
así que a medida que se registren tickets reales el análisis se actualiza solo.

---

## Cómo está organizado

```
payback/
  data/        Los supuestos. Todo lo que se discute con RR.HH., Finanzas
               o un proveedor vive aquí, y se cambia sin tocar el cálculo.
    parametros.js   jornada, tasas de ley, costos de flota, los 3 escenarios
    motos.js        las 3 opciones de 150 cc a cotizar
    zonas.js        mapa de distritos, tiempos de viaje y días de ruta

  backend/     El cálculo. Funciones puras, sin DOM y sin base de datos:
               entra una configuración, sale un número. Se corre en Node.
    planilla.js     costo laboral de una persona + avisos legales
    flota.js        inversión y gasto mensual de una moto propia
    demanda.js      lo que pasa hoy, leído del histórico de servicios
    capacidad.js    minutos de ruta que exige la demanda contra los disponibles
    escenarios.js   arma los tres escenarios completos
    payback.js      compara contra el courier y calcula el retorno

  frontend/    La pantalla. Única capa que toca el DOM.
    vista.js

  test/
    pruebas.mjs     node payback/test/pruebas.mjs
```

La separación no es decorativa: `backend/` no sabe que existe una pantalla, y
por eso se puede verificar número por número. Si mañana esto se mueve a un
servidor, `backend/` viaja tal cual.

---

## Los números, con la data real

Base de comparación: **1 386 servicios de 2026** registrados en el histórico.

| | |
|---|---|
| Gasto mensual en courier | **S/ 4 947** (promedio de mayo, junio y julio) |
| Costo promedio por viaje | S/ 23,05 |
| Encargos por día, lun-vie | 8,7 |
| Encargos el sábado | 3,3 |
| Día cargado (10% de los días lo supera) | 12 |
| Máximo medido en un día | 20 |

Agosto queda fuera del promedio porque la planilla corta el día 19 y el mes
está incompleto; incluirlo haría parecer que se gasta menos.

### Los tres escenarios

Con el bono tratado como remunerativo (el supuesto conservador) y la Honda XR
150 L a US$ 4 500 de referencia:

| | Escenario 1<br>moto propia del trabajador | Escenario 2<br>moto de la empresa | Escenario 3<br>dos part time |
|---|---:|---:|---:|
| Planilla total | 2 948 | 2 527 | 2 744 |
| Gasto de moto | — | 756 | — |
| Cobertura de vacaciones | 430 | 430 | 86 |
| Courier para días cargados | 465 | 465 | 465 |
| **Costo mensual** | **3 844** | **4 179** | **3 296** |
| **Ahorro frente al courier** | **1 103** | **768** | **1 651** |
| Ahorro al año | 13 236 | 9 215 | 19 815 |
| Inversión inicial | — | 18 025 | — |
| Retorno de la inversión | — | 23,5 meses | — |

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
tiempo útil. El techo son **9,4 encargos al día** y hoy se hacen 8,7.

Atendiendo cada pedido por separado, en cuanto llega, el mismo volumen exige el
**243%** de la jornada: dos motorizados y medio.

Lo que satura no es el número de encargos, es el número de **salidas**. Diez
encargos a Lima norte en una salida caben; cuatro encargos a cuatro zonas
distintas, no. La programación no es una mejora deseable: es la condición para
que esto exista.

### 3. El día cargado se desborda, y está previsto

El promedio es 8,7, pero el 10% de los días pasa de 12 y hubo días de 20. Con 12
encargos el uso sube a 125%: no entra. Esos días el excedente sigue saliendo por
courier, y por eso hay una línea de S/ 465 al mes en los tres escenarios.

Dimensionar para el pico exigiría un segundo motorizado permanente, que costaría
más de lo que ahorra. Dimensionar para el promedio y derivar el pico es lo
correcto.

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
- **Los precios de las motos** son marcadores de posición dentro del rango
  indicado (US$ 4 500 a 6 000), no cotizaciones. En el mercado peruano una
  150 cc de trabajo se mueve bastante por debajo de ese rango; si el precio real
  resulta menor, el escenario 2 mejora y su retorno se acorta.
- **Los minutos de viaje por zona** son estimaciones de tráfico de día
  laborable. El primer mes de operación real los corrige.

Todo eso se edita en `data/parametros.js`, `data/motos.js` y `data/zonas.js`.
El cálculo no se toca.

Dos puntos legales que el módulo verifica y avisa en pantalla:

- La jornada pedida (lun-vie 8:00–17:30, sáb 8:00–12:30) suma **47 h**, debajo
  del tope de 48 h, **siempre que el refrigerio de 60 minutos no se compute como
  trabajo**. Con 45 minutos se pasaría del tope y habría sobretiempo.
- El escenario 3 solo es part time si cada persona queda **por debajo de 4 h
  diarias** (le corresponden 3,92 h). A partir de 4 h corresponden CTS, 30 días
  de vacaciones y la remuneración mínima completa, y el ahorro desaparece.
