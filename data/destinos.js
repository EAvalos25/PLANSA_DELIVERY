/**
 * Catálogo de destinos de la mensajería, con su tarifa de referencia.
 *
 * Sale del histórico real de 2026 (planilla de logística, 1600 viajes de enero a
 * septiembre). En esa planilla el mismo sitio aparece escrito de muchas formas
 * —erratas, tildes que faltan, la dirección con y sin número—, así que las
 * redacciones se agruparon por parecido y quedó una sola por lugar, con el
 * nombre corregido a mano. Dos sedes de una misma empresa siguen siendo dos
 * destinos: LIFE en Javier Prado no es LIFE en Cordillera Central.
 *
 * Solo están los lugares con 3 o más viajes; el resto se escribe a mano, porque
 * el campo de destino es libre y esta lista es únicamente una ayuda para elegir
 * rápido. La lista va de más a menos visitado, que es el orden en que se ofrece.
 *
 * `tarifa` es lo que más veces se pagó por ese viaje (no el promedio: la moda,
 * que es el precio de lista); `min` y `max` acotan lo que se llegó a pagar.
 *
 * @type {{nombre: string, viajes: number, tarifa: number, min: number, max: number}[]}
 */
export const DESTINOS = [
  { nombre: "PLUS COSMÉTICA, AV. VÍCTOR ANDRÉS BELAÚNDE 280, SAN ISIDRO", viajes: 134, tarifa: 25, min: 5, max: 45 },
  { nombre: "BOHLER, CASTRO RONCEROS 777, CERCADO DE LIMA", viajes: 128, tarifa: 20, min: 5, max: 35 },
  { nombre: "LIFE, AV. JAVIER PRADO ESTE 578, SAN ISIDRO", viajes: 72, tarifa: 25, min: 5, max: 25 },
  { nombre: "OFICINA DEL SR. PALACIOS, AV. JAVIER PRADO OESTE 757, MAGDALENA DEL MAR", viajes: 70, tarifa: 25, min: 10, max: 25 },
  { nombre: "VICCO, AV. SEPARADORA INDUSTRIAL 1815, ATE", viajes: 49, tarifa: 25, min: 5, max: 55 },
  { nombre: "UNIBELL, JR. VARELA 352, BREÑA", viajes: 47, tarifa: 20, min: 5, max: 25 },
  { nombre: "UNIBELL, AV. JAVIER PRADO OESTE 1475, SAN ISIDRO", viajes: 45, tarifa: 25, min: 5, max: 25 },
  { nombre: "LIFE, AV. CORDILLERA CENTRAL, CHORRILLOS", viajes: 43, tarifa: 35, min: 5, max: 35 },
  { nombre: "TORNERÍA, JR. PASCO, SAN MARTÍN DE PORRES", viajes: 36, tarifa: 20, min: 10, max: 20 },
  { nombre: "CIPESA, AV. COLONIAL 2066, CERCADO DE LIMA", viajes: 35, tarifa: 20, min: 10, max: 35 },
  { nombre: "TRATAR PERÚ, AV. ELMER FAUCETT 3430, CALLAO", viajes: 34, tarifa: 20, min: 10, max: 20 },
  { nombre: "CIPLAST, AV. NICOLÁS AYLLÓN 292, ATE", viajes: 32, tarifa: 25, min: 15, max: 25 },
  { nombre: "JAIME CHÁVEZ, AV. MARISCAL DOMINGO NIETO, ATE", viajes: 24, tarifa: 25, min: 5, max: 25 },
  { nombre: "JALEXA, JR. ALEJANDRO DEUSTUA 3749, SAN MARTÍN DE PORRES", viajes: 18, tarifa: 20, min: 10, max: 20 },
  { nombre: "BOX CLEAN, PAITA 164, SAN JUAN DE MIRAFLORES", viajes: 17, tarifa: 35, min: 15, max: 35 },
  { nombre: "PROCHILCA, AV. LOS ÁLAMOS MZ. D, CHILCA", viajes: 16, tarifa: 80, min: 80, max: 90 },
  { nombre: "AFERSA, CAL. LOS QUÍMICOS MZ. A LT. 12, LURIGANCHO - CHOSICA", viajes: 15, tarifa: 35, min: 10, max: 35 },
  { nombre: "SHALOM, AV. LAS PALMERAS 5236, LOS OLIVOS", viajes: 15, tarifa: 15, min: 10, max: 20 },
  { nombre: "CASA DEL SR. BELLIDO, TRIANA 185, MIRAFLORES", viajes: 14, tarifa: 25, min: 10, max: 25 },
  { nombre: "SERIGRAFÍA GAMARRA, AV. CAMPOY, SAN JUAN DE LURIGANCHO", viajes: 13, tarifa: 25, min: 15, max: 25 },
  { nombre: "TROQUELADOS MOZO, MZ. S LT. 11, SAN JUAN DE MIRAFLORES", viajes: 13, tarifa: 35, min: 20, max: 35 },
  { nombre: "YAVENGRAF, CL. MARISCAL JOSÉ DE LA MAR 590, ATE", viajes: 13, tarifa: 25, min: 15, max: 25 },
  { nombre: "BCP, MEGA PLAZA", viajes: 12, tarifa: 15, min: 10, max: 15 },
  { nombre: "CONTE, AV. SEPARADORA INDUSTRIAL 1591, ATE", viajes: 11, tarifa: 25, min: 10, max: 25 },
  { nombre: "JHOMERON, AV. SANTA ANA 48, CHACRA CERRO - COMAS", viajes: 11, tarifa: 20, min: 10, max: 20 },
  { nombre: "MASTERCOL, AV. LOS FRUTALES 211, ATE", viajes: 11, tarifa: 25, min: 10, max: 25 },
  { nombre: "PLUS COSMÉTICA, JR. HELIO 5647, LOS OLIVOS", viajes: 11, tarifa: 10, min: 10, max: 20 },
  { nombre: "SUMINOX, AV. MAQUINARIAS 1891, CERCADO DE LIMA", viajes: 11, tarifa: 20, min: 5, max: 25 },
  { nombre: "BBVA, AV. LA MOLINA 540, LA MOLINA", viajes: 10, tarifa: 25, min: 15, max: 25 },
  { nombre: "INDUSTRIAL CENTER, LOS ROBLES 161, BELLAVISTA - CALLAO", viajes: 10, tarifa: 15, min: 15, max: 25 },
  { nombre: "LABORATORIO ALAB, AV. GUARDIA CHALACA 1877, BELLAVISTA - CALLAO", viajes: 10, tarifa: 25, min: 22.5, max: 25 },
  { nombre: "BELTRÁN, AV. CASCANUECES MZ. M LT. 6, SANTA ANITA", viajes: 9, tarifa: 25, min: 10, max: 25 },
  { nombre: "ICS PACK, CHACRA CERRO, COMAS", viajes: 9, tarifa: 25, min: 10, max: 35 },
  { nombre: "CIMA FERTILIZANTES, AV. JULIO BAILETTI 352, SAN BORJA", viajes: 8, tarifa: 20, min: 15, max: 25 },
  { nombre: "GROBDI, AV. BRASIL 1215, JESÚS MARÍA", viajes: 7, tarifa: 20, min: 10, max: 20 },
  { nombre: "MARVISUR, AV. LAS PALMERAS 5343, LOS OLIVOS", viajes: 7, tarifa: 15, min: 10, max: 30 },
  { nombre: "NOTARÍA DANÓN, AV. JAVIER PRADO OESTE 705, MAGDALENA DEL MAR", viajes: 7, tarifa: 25, min: 10, max: 45 },
  { nombre: "ALICORP, AV. ARGENTINA 4793, CALLAO", viajes: 6, tarifa: 20, min: 20, max: 20 },
  { nombre: "ALKOFARMA, AV. CHACRA CERRO 41, COMAS", viajes: 6, tarifa: 20, min: 10, max: 20 },
  { nombre: "ECOFULL, JR. PATROCINIO 124, RÍMAC", viajes: 6, tarifa: 20, min: 10, max: 20 },
  { nombre: "EMPAQUES Y SERVICIOS, CALLE BOULEVARD 254, ATE", viajes: 6, tarifa: 25, min: 20, max: 25 },
  { nombre: "FIRE BOND, C. LOS MIRABLES 1136, SAN JUAN DE LURIGANCHO", viajes: 6, tarifa: 20, min: 15, max: 20 },
  { nombre: "HUB PERÚ CARGO, CALLE HERNANDO DE SOTO 170, SAN MIGUEL", viajes: 6, tarifa: 20, min: 15, max: 25 },
  { nombre: "LABORATORIO LABET, MZ. A LT. 1-2, CARABAYLLO", viajes: 6, tarifa: 25, min: 25, max: 25 },
  { nombre: "MOLMAC, JR. MONTERREY 373, SURCO", viajes: 6, tarifa: 25, min: 25, max: 25 },
  { nombre: "SILVESTRE, CAJAMARQUILLA, LURIGANCHO - CHOSICA", viajes: 6, tarifa: 35, min: 35, max: 35 },
  { nombre: "ANVIP, AV. PRODUCCIÓN NACIONAL 229B, CHORRILLOS", viajes: 5, tarifa: 35, min: 35, max: 35 },
  { nombre: "ARACELI CEBALLOS GAMARRA, SAN JUAN DE LURIGANCHO", viajes: 5, tarifa: 25, min: 10, max: 25 },
  { nombre: "ARGANIPRO, AV. AREQUIPA 4130, MIRAFLORES", viajes: 5, tarifa: 25, min: 10, max: 25 },
  { nombre: "INDUSTRIAL CENTER, AV. ARGENTINA 523, CERCADO DE LIMA", viajes: 5, tarifa: 20, min: 10, max: 20 },
  { nombre: "RODASUR, AV. GUILLERMO DANSEY 1912, CERCADO DE LIMA", viajes: 5, tarifa: 20, min: 10, max: 70 },
  { nombre: "SCOTIABANK, MEGA PLAZA, AV. ALFREDO MENDIOLA 2695", viajes: 5, tarifa: 15, min: 10, max: 15 },
  { nombre: "ANÁLISIS CLÍNICOS, CALLE LOS EUCALIPTOS 200, SAN ISIDRO", viajes: 4, tarifa: 25, min: 20, max: 25 },
  { nombre: "ANTO GROUP, AV. INDUSTRIAL, COMAS", viajes: 4, tarifa: 20, min: 15, max: 20 },
  { nombre: "CASA DE LESLIE CÓRDOVA, LOS NARANJOS, CARABAYLLO", viajes: 4, tarifa: 25, min: 25, max: 25 },
  { nombre: "CIPESA, CALLE SODIO 277, LOS OLIVOS", viajes: 4, tarifa: 10, min: 10, max: 15 },
  { nombre: "FITOINKA, AV. ROSA LUZ, PUENTE PIEDRA", viajes: 4, tarifa: 25, min: 20, max: 25 },
  { nombre: "GSS LUBRICANTES, CALLE LOS GIRASOLES", viajes: 4, tarifa: 25, min: 25, max: 30 },
  { nombre: "MERCADO DE PRODUCTORES, SANTA ANITA", viajes: 4, tarifa: 25, min: 5, max: 25 },
  { nombre: "MULTIFOODS, CALLE METEOROS, CHORRILLOS", viajes: 4, tarifa: 35, min: 35, max: 35 },
  { nombre: "SODIMAC, AV. ALFREDO MENDIOLA 5118, LOS OLIVOS", viajes: 4, tarifa: 10, min: 10, max: 15 },
  { nombre: "SODIMAC, MEGA PLAZA", viajes: 4, tarifa: 35.8, min: 10, max: 35.8 },
  { nombre: "TEST Y CONTROL, AV. SIMÓN BOLÍVAR, PUEBLO LIBRE", viajes: 4, tarifa: 20, min: 15, max: 20 },
  { nombre: "ALIMENTOS CIELO, MZ. F LT. 5, HUACHIPA", viajes: 3, tarifa: 30, min: 20, max: 30 },
  { nombre: "BCP, JR. LOS DÁMASOS, LA MOLINA", viajes: 3, tarifa: 10, min: 10, max: 20 },
  { nombre: "BELTRÁN, AV. CIRCUNVALACIÓN, HUACHIPA", viajes: 3, tarifa: 35, min: 25, max: 35 },
  { nombre: "CALLE EL CONDADO 217, LA MOLINA", viajes: 3, tarifa: 33, min: 20, max: 33 },
  { nombre: "CONSUMIBLES INDUSTRIALES, AV. DEL AIRE 1661, SAN LUIS", viajes: 3, tarifa: 25, min: 25, max: 25 },
  { nombre: "DARYZA, LURÍN", viajes: 3, tarifa: 40, min: 25, max: 40 },
  { nombre: "DROGAVET, URB. SANTA MARÍA, HUACHIPA", viajes: 3, tarifa: 30, min: 20, max: 30 },
  { nombre: "ECOCLEAN, AV. SANTA ROSA DE LLANAVILLA, LURÍN", viajes: 3, tarifa: 45, min: 35, max: 45 },
  { nombre: "ENVIPLAST, CALLE PEDRO DÁVALOS LISSÓN 226, CERCADO DE LIMA", viajes: 3, tarifa: 20, min: 15, max: 20 },
  { nombre: "EXCELLENT, AV. LOS FAISANES 316, CHORRILLOS", viajes: 3, tarifa: 30, min: 25, max: 30 },
  { nombre: "FARVET, AV. SANTIAGO DE SURCO, SURCO", viajes: 3, tarifa: 25, min: 20, max: 25 },
  { nombre: "INKAOZONO, CALLE LOS MOTORES, ANCÓN", viajes: 3, tarifa: 35, min: 30, max: 35 },
  { nombre: "LA PATRONA, CALLE LAS MORERAS MZ. D LT. 22C, SANTA MARÍA DE HUACHIPA", viajes: 3, tarifa: 15, min: 15, max: 30 },
  { nombre: "NOVEX, AV. LOS FAISANES 148, CHORRILLOS", viajes: 3, tarifa: 30, min: 15, max: 30 },
  { nombre: "PIAGGIO, AV. GUILLERMO DANSEY 2045, CERCADO DE LIMA", viajes: 3, tarifa: 20, min: 20, max: 20 },
  { nombre: "UNIBELL, JR. ZORRITOS 1074, CERCADO DE LIMA", viajes: 3, tarifa: 20, min: 20, max: 20 },
  { nombre: "VISTONY, PANAMERICANA NORTE MZ. A LT. 1, ANCÓN", viajes: 3, tarifa: 35, min: 35, max: 35 }
];

/** Solo los nombres, para la lista de sugerencias del formulario. */
export const DESTINOS_FRECUENTES = DESTINOS.map(d => d.nombre);

const PorNombre = new Map(DESTINOS.map(d => [d.nombre, d]));

/**
 * Tarifa de referencia de un destino, o null si no es uno de los frecuentes.
 * Se compara el texto exacto: quien elige de la lista obtiene referencia, quien
 * escribe una dirección nueva no, que es justo lo que se quiere decir.
 */
export function tarifaDe(destino) {
  return PorNombre.get(String(destino || '').trim()) || null;
}
