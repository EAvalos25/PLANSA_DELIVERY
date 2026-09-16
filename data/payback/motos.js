/**
 * Opciones de moto para el escenario de flota propia (150 cc).
 *
 * LOS PRECIOS SON REFERENCIALES, NO COTIZACIONES. Están dentro del rango de
 * mercado indicado por logística (US$ 2 500 a 5 000), que es donde de verdad
 * se mueve una 150 cc de trabajo en Lima. Hay que reemplazarlos por
 * cotizaciones firmes antes de decidir: el precio es lo que más mueve el
 * plazo de retorno del escenario 2.
 *
 * El precio de lista no es lo que cuesta poner la moto en la calle. Hay que
 * sumarle placa, SOAT, seguro, equipamiento del conductor y mantenimiento; eso
 * lo agrega ../backend/flota.js con los valores de parametros.js.
 *
 * Los modelos son de venta corriente en Lima en el segmento de reparto; se
 * listan como referencia de qué cotizar, no como recomendación de marca.
 */
export const MOTOS = [
  {
    id: 'xr150',
    modelo: 'Honda XR 150 L',
    cilindrada: 150,
    precioUsdReferencial: 2900,
    nota: 'Suspensión alta, aguanta pista rota y lomos. La más común en reparto: repuestos y talleres en toda Lima.'
  },
  {
    id: 'ns160',
    modelo: 'Bajaj Pulsar NS 160',
    cilindrada: 160,
    precioUsdReferencial: 3600,
    nota: 'Más veloz en avenida y más cómoda en trayectos largos, como Chilca o Lurín. Repuestos económicos.'
  },
  {
    id: 'fz150',
    modelo: 'Yamaha FZ-S FI 150',
    cilindrada: 150,
    precioUsdReferencial: 4600,
    nota: 'Inyección electrónica: menos consumo y sin mantenimiento de carburador. La más cara de las tres.'
  }
];

/** Rango dentro del cual se espera que caigan las cotizaciones reales. */
export const RANGO_USD = { desde: 2500, hasta: 5000 };

/** Opción por defecto al abrir el módulo: la de menor precio. */
export const MOTO_POR_DEFECTO = 'xr150';

export const motoPorId = id => MOTOS.find(m => m.id === id) || MOTOS[0];
