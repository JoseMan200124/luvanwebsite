// src/utils/outcomeReasons.js
// Subcategoría del resultado de un envío (outcomeReason): texto que se muestra bajo el estado.
// Compartido por Envíos Programados y el Historial de Circulares para que no diverjan.
export const OUTCOME_REASON_LABEL = {
    sin_correo: 'Enviada solo al sistema (sin correo)',
    correo_parcial: 'El correo no llegó a todos',
    correo_no_enviado: 'Publicada; el correo no se pudo enviar',
    direcciones_rechazadas: 'Direcciones de correo rechazadas',
    colegio_bloqueado: 'Comunicación del colegio bloqueada',
    adjunto: 'No se pudo cargar el adjunto',
    error_interno: 'Error interno',
    interrumpido: 'Interrumpido por reinicio del servidor',
    sin_destinatarios: 'Sin destinatarios al momento del envío',
    muy_tarde: 'Servidor no disponible a la hora programada',
};
