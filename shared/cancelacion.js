/**
 * Motivos de cancelación de un servicio. Una sola lista, la usan el
 * desplegable del navegador y la validación del servidor: si mañana se agrega
 * un motivo, se agrega acá y no hay que acordarse de tocar dos archivos.
 *
 * "Usuario solicitó baja" es también el motivo que el servidor pone solo,
 * sin preguntar, cuando es el propio solicitante quien cancela su ticket
 * (ver backend/rutas/index.js, POST /solicitudes/:id/cancelar): admin y
 * seguimiento sí tienen que elegir uno de los tres al cancelar el de otro.
 */
export const MOTIVOS_CANCELACION = ['Usuario solicitó baja', 'No autorizado', 'Otros'];

export const motivoValido = m => MOTIVOS_CANCELACION.includes(m);
