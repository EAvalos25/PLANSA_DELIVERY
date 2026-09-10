import { pad, isoDia } from '../utils/format.js';

/**
 * Datos y generador de datos de demostración (DEMO).
 * Todo lo de este módulo es privado salvo `semilla()`: reemplaza el padrón
 * por el listado real de RR.HH. antes de usar la plataforma en producción.
 */
const PERSONAL_DEMO = [
  { dni: '41250873', nombre: 'Rosa Quispe Vilca', area: 'Compras y Logística', sede: 'Plásticos Nacionales - Talleres' },
  { dni: '40887219', nombre: 'Julio Ramírez Soto', area: 'Almacén', sede: 'Plásticos Nacionales - Talleres' },
  { dni: '45012366', nombre: 'Marta Chávez Ríos', area: 'Contabilidad', sede: 'Plásticos Nacionales - Fraguas' },
  { dni: '09873421', nombre: 'Enrique Salas Bravo', area: 'Mantenimiento', sede: 'Plásticos Nacionales - Talleres' },
  { dni: '46339015', nombre: 'Diana Ponce Aguirre', area: 'Calidad', sede: 'Plásticos Nacionales - Fraguas' },
  { dni: '43771208', nombre: 'César Huamán Ledesma', area: 'Producción', sede: 'Plásticos Nacionales - Talleres' },
  { dni: '47120945', nombre: 'Lucía Ferrer Montoya', area: 'Recursos Humanos', sede: 'Plásticos Nacionales - Fraguas' },
  { dni: '42556730', nombre: 'Óscar Bautista Núñez', area: 'Ventas', sede: 'Plásticos Nacionales - Talleres' },
  { dni: '44098213', nombre: 'Silvia Rojas Cárdenas', area: 'Administración', sede: 'Plásticos Nacionales - Fraguas' },
  { dni: '08765432', nombre: 'Manuel Ibáñez Torres', area: 'Gerencia', sede: 'Plásticos Nacionales - Talleres' },
  { dni: '45660128', nombre: 'Karina Espinoza Loayza', area: 'Compras y Logística', sede: 'Plásticos Nacionales - Talleres' },
  { dni: '43902517', nombre: 'Pedro Ccahuana Mamani', area: 'Almacén', sede: 'Plásticos Nacionales - Fraguas' }
];

const DESTINOS_DEMO = [
  'SUNAT - Av. Garcilaso de la Vega 1472, Cercado de Lima',
  'Notaría Paino - Av. Angamos Este 1805, Surquillo',
  'BCP Empresas - Av. Canaval y Moreyra 522, San Isidro',
  'Aduanas Callao - Av. Guardia Chalaca 1240, Callao',
  'Cliente Envases Andinos - Av. Argentina 3093, Callao',
  'Cliente Distribuidora Sur - Av. Aviación 2456, San Borja',
  'Municipalidad de Independencia - Av. Túpac Amaru 3000',
  'Laboratorio SGS - Av. Elmer Faucett 3348, Callao',
  'Proveedor Aceros del Norte - Av. Colonial 1876, Lima',
  'Estudio contable Vera & Asoc. - Av. Arequipa 2450, Lince',
  'Cliente Plásticos del Este - Ate, Carretera Central km 8',
  'Ministerio de Trabajo - Av. Salaverry 655, Jesús María'
];
const SERVICIOS_DEMO = ['Envío de documentos', 'Recojo de paquete', 'Muestras de producto', 'Repuestos', 'Cheques y valores', 'Trámite notarial', 'Materiales de almacén'];
const MOTIVOS_DEMO = [
  'Entrega de facturas del mes al cliente',
  'Recojo de guías de remisión firmadas',
  'Entrega de expediente para trámite',
  'Recojo de muestras de material',
  'Entrega de cheque a proveedor',
  'Recojo de certificado de calidad',
  'Entrega de contrato firmado',
  'Recojo de repuesto en tienda'
];

function rnd(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Genera la base de datos inicial (personal, solicitudes históricas y en curso). */
export function semilla() {
  const r = rnd(20260904);
  const pick = a => a[Math.floor(r() * a.length)];
  const sol = [];
  const ahora = new Date();
  let n = 0;
  for (let d = 34; d >= 0; d--) {
    const dia = new Date(ahora); dia.setDate(dia.getDate() - d);
    if (dia.getDay() === 0) continue;                 // sin domingos
    const cuantos = Math.floor(r() * 3) + (r() > .72 ? 2 : 0);
    for (let i = 0; i < cuantos; i++) {
      const p = pick(PERSONAL_DEMO);
      const salida = new Date(dia);
      salida.setHours(8 + Math.floor(r() * 9), r() > .5 ? 30 : 0, 0, 0);
      const creado = new Date(salida.getTime() - (4 + r() * 20) * 3600000);
      const origen = r() > .18 ? p.sede : 'Otros';
      const vehiculo = r() > .27 ? 'Motorizado' : 'Carro';
      const costo = vehiculo === 'Motorizado' ? 15 + Math.round(r() * 22) : 45 + Math.round(r() * 55);
      n++;
      const s = {
        id: 'REQ-' + pad(n),
        creado: creado.toISOString(),
        dni: p.dni, nombre: p.nombre, area: p.area, sedeUsuario: p.sede,
        tipo: r() > .45 ? 'Entregar' : 'Recoger',
        servicio: pick(SERVICIOS_DEMO),
        motivo: pick(MOTIVOS_DEMO),
        origen: origen,
        origenDetalle: origen === 'Otros' ? 'Av. Naranjal 1290, Independencia' : '',
        destino: pick(DESTINOS_DEMO),
        contacto: 'Mesa de partes',
        telefono: '9' + String(Math.floor(r() * 90000000) + 10000000).slice(0, 8),
        fechaProg: isoDia(salida),
        horaProg: pad(salida.getHours(), 2) + ':' + pad(salida.getMinutes(), 2),
        vehiculo: vehiculo, costo: costo,
        estado: 'Concluido',
        tsEspera: creado.toISOString(),
        tsTransito: salida.toISOString(),
        tsConcluido: new Date(salida.getTime() + (0.6 + r() * 3) * 3600000).toISOString(),
        demo: true
      };
      sol.push(s);
    }
  }
  // servicios en curso para que la bandeja abra con trabajo real
  const enCurso = [
    { estado: 'En tránsito', desfase: 2 },
    { estado: 'En espera', desfase: 5 },
    { estado: 'En espera', desfase: 7 }
  ];
  enCurso.forEach((c, i) => {
    const p = PERSONAL_DEMO[(i * 4 + 1) % PERSONAL_DEMO.length];
    const salida = new Date(); salida.setHours(new Date().getHours() + c.desfase, 0, 0, 0);
    const creado = new Date(Date.now() - (1 + i) * 3600000);
    n++;
    sol.push({
      id: 'REQ-' + pad(n), creado: creado.toISOString(),
      dni: p.dni, nombre: p.nombre, area: p.area, sedeUsuario: p.sede,
      tipo: i === 1 ? 'Recoger' : 'Entregar',
      servicio: SERVICIOS_DEMO[i % SERVICIOS_DEMO.length],
      motivo: MOTIVOS_DEMO[i * 2 % MOTIVOS_DEMO.length],
      origen: p.sede, origenDetalle: '',
      destino: DESTINOS_DEMO[i * 3 % DESTINOS_DEMO.length],
      contacto: 'Mesa de partes', telefono: '98' + (7654321 + i),
      fechaProg: isoDia(salida), horaProg: pad(salida.getHours(), 2) + ':00',
      vehiculo: c.estado === 'En tránsito' ? 'Motorizado' : null,
      costo: c.estado === 'En tránsito' ? 28 : null,
      estado: c.estado,
      tsEspera: creado.toISOString(),
      tsTransito: c.estado === 'En tránsito' ? new Date(Date.now() - 1800000).toISOString() : null,
      tsConcluido: null, demo: true
    });
  });
  return {
    pin: 'logistica',
    correlativo: n,
    personal: PERSONAL_DEMO.slice(),
    solicitudes: sol,
    autorizaciones: []
  };
}
