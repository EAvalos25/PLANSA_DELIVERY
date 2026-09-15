/**
 * Zonas de reparto: cómo se reparten los destinos reales y cuánto cuesta
 * llegar a cada una.
 *
 * El reparto (`participacion`) NO es un supuesto: sale de clasificar por
 * distrito los 1 386 viajes de 2026 que están en js/db/historico.js. El módulo
 * lo recalcula en vivo (ver ../backend/demanda.js); lo que está aquí es el
 * mapa de distritos y los tiempos.
 *
 * `minutosIdaVuelta` SÍ es un supuesto: es lo que toma ir de la planta a la
 * zona y volver, en moto, en tráfico de día laborable, SIN contar el tiempo en
 * cada punto (eso es `minutosPorParada` en parametros.js). Son estimaciones
 * para ordenar la discusión; el primer mes de operación real las corrige.
 *
 * `diasDeRuta` es la propuesta de programación: a qué zonas se sale todos los
 * días y a cuáles solo ciertos días. Es la palanca principal contra las
 * urgencias, porque convierte "necesito ir a Chilca hoy" en "Chilca sale los
 * martes". Ver el análisis en ../README.md
 */
export const ZONAS = [
  {
    id: 'norte',
    nombre: 'Lima norte',
    detalle: 'Los Olivos, Comas, Independencia, SMP, Carabayllo, Puente Piedra, Ancón',
    distritos: ['LOS OLIVOS', 'COMAS', 'INDEPENDENCIA', 'SAN MARTIN DE PORRES', 'SMP', 'CARABAYLLO',
                'PUENTE PIEDRA', 'ANCÓN', 'ANCON', 'CHACRA CERRO', 'CHACRACERRO', 'TRAPICHE',
                'SAN MARTÍN DE PORRES', 'MEGA PLAZA', 'MEGAPLAZA', 'PLAZA NORTE'],
    minutosIdaVuelta: 45,
    diasDeRuta: 6
  },
  {
    id: 'centro',
    nombre: 'Lima centro',
    detalle: 'Cercado, Breña, Rímac, La Victoria, El Agustino',
    distritos: ['CERCADO DE LIMA', 'CERCADO', 'BREÑA', 'BRENA', 'RIMAC', 'RÍMAC', 'LA VICTORIA',
                'EL AGUSTINO', 'LIMA'],
    minutosIdaVuelta: 70,
    diasDeRuta: 6
  },
  {
    id: 'moderna',
    nombre: 'Lima moderna',
    detalle: 'San Isidro, Miraflores, Magdalena, Surco, San Borja, Lince, Jesús María, Pueblo Libre, San Luis, La Molina',
    distritos: ['SAN ISIDRO', 'MIRAFLORES', 'MAGDALENA', 'SURCO', 'SAN BORJA', 'LINCE', 'JESUS MARIA',
                'JESÚS MARÍA', 'PUEBLO LIBRE', 'SAN LUIS', 'LA MOLINA', 'SAN MIGUEL'],
    minutosIdaVuelta: 100,
    diasDeRuta: 6
  },
  {
    id: 'este',
    nombre: 'Lima este',
    detalle: 'Ate, Santa Anita, Huachipa, Lurigancho, Chosica, Chaclacayo, SJL',
    distritos: ['ATE', 'SANTA ANITA', 'HUACHIPA', 'CHOSICA', 'LURIGANCHO', 'SAN JUAN DE LURIGANCHO',
                'SJL', 'CHACLACAYO', 'CAJAMARQUILLA', 'CAMPOY', 'VITARTE', 'HUAYCAN'],
    minutosIdaVuelta: 110,
    diasDeRuta: 6
  },
  {
    id: 'callao',
    nombre: 'Callao',
    detalle: 'Callao, Bellavista, Ventanilla',
    distritos: ['CALLAO', 'BELLAVISTA', 'VENTANILLA', 'FAUCETT', 'GAMBETTA', 'GAMBETA'],
    minutosIdaVuelta: 80,
    diasDeRuta: 3
  },
  {
    id: 'sur',
    nombre: 'Lima sur',
    detalle: 'Chorrillos, San Juan de Miraflores, Villa El Salvador, VMT, Pachacámac',
    distritos: ['CHORRILLOS', 'CHORRILOS', 'SAN JUAN DE MIRAFLORES', 'SJM', 'VILLA EL SALVADOR',
                'VMT', 'PACHACAMAC', 'PACHACÁMAC', 'S.J.M', 'SJ.M'],
    minutosIdaVuelta: 130,
    diasDeRuta: 3
  },
  {
    id: 'lejos',
    nombre: 'Fuera de Lima',
    detalle: 'Chilca, Lurín y despachos a agencia para provincia',
    distritos: ['CHILCA', 'LURIN', 'LURÍN', 'JULIACA', 'MAMACONA'],
    minutosIdaVuelta: 240,
    diasDeRuta: 1
  },
  {
    id: 'otros',
    nombre: 'Sin clasificar',
    detalle: 'Direcciones del histórico que no nombran distrito reconocible. Se les asume un trayecto promedio.',
    distritos: [],
    minutosIdaVuelta: 90,
    diasDeRuta: 6
  }
];

export const ZONA_OTROS = 'otros';

/**
 * Orden en que se pregunta por cada zona al clasificar. NO es el orden en que
 * se muestran: va de lo más específico a lo más genérico, porque hay nombres
 * que se contienen unos a otros. 'Lima centro' incluye la palabra LIMA, que
 * aparece suelta en direcciones de media ciudad, así que se pregunta al final.
 */
const ORDEN_CLASIFICACION = ['lejos', 'sur', 'este', 'callao', 'moderna', 'norte', 'centro'];

/** Clasifica una dirección de destino en una de las zonas de arriba. */
export function zonaDe(destino) {
  const t = String(destino || '').toUpperCase();
  for (const id of ORDEN_CLASIFICACION) {
    const z = ZONAS.find(z => z.id === id);
    if (z && z.distritos.some(d => t.includes(d))) return z.id;
  }
  return ZONA_OTROS;
}

export const zonaPorId = id => ZONAS.find(z => z.id === id) || ZONAS[ZONAS.length - 1];
