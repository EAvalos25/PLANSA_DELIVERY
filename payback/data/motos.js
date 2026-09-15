/**
 * Opciones de moto para el escenario de flota propia (150 cc).
 *
 * LOS PRECIOS SON MARCADORES DE POSICIÓN, NO COTIZACIONES. Están puestos
 * dentro del rango que indicó logística (USD 4 500 a 6 000) para que el
 * cálculo corra, pero hay que reemplazarlos por cotizaciones reales antes de
 * decidir. Dos avisos sobre ese rango:
 *
 * 1. En el mercado peruano una 150 cc de trabajo se mueve bastante por debajo
 *    de USD 4 500. Con ese presupuesto se compra una moto de mayor cilindrada
 *    o una 150 cc de gama alta. Si el precio real resulta menor, el escenario
 *    de flota propia mejora: la inversión se recupera antes.
 * 2. El precio de lista no es lo que cuesta poner la moto en la calle. Hay que
 *    sumarle placa, SOAT, seguro, equipamiento del conductor y mantenimiento;
 *    eso lo agrega ../backend/flota.js con los valores de parametros.js.
 *
 * Los modelos son de venta corriente en Lima en el segmento de reparto; se
 * listan como referencia de qué cotizar, no como recomendación de marca.
 */
export const MOTOS = [
  {
    id: 'xr150',
    modelo: 'Honda XR 150 L',
    cilindrada: 150,
    precioUsdReferencial: 4500,
    nota: 'Suspensión alta, aguanta pista rota y lomos. La más común en reparto por repuestos y talleres en todo Lima.'
  },
  {
    id: 'ns160',
    modelo: 'Bajaj Pulsar NS 160',
    cilindrada: 160,
    precioUsdReferencial: 5200,
    nota: 'Más veloz en avenida y más cómoda en trayectos largos, como Chilca o Lurín. Repuestos económicos.'
  },
  {
    id: 'fz150',
    modelo: 'Yamaha FZ-S FI 150',
    cilindrada: 150,
    precioUsdReferencial: 6000,
    nota: 'Inyección electrónica: menos consumo y menos mantenimiento de carburador. La más cara de las tres.'
  }
];

/** Opción por defecto al abrir el módulo: la de menor precio. */
export const MOTO_POR_DEFECTO = 'xr150';

export const motoPorId = id => MOTOS.find(m => m.id === id) || MOTOS[0];
