// src/services/audienceService.js
import api from '../utils/axiosConfig';

/**
 * Vista previa de destinatarios. Mismo endpoint para circulares y push, para
 * que el conteo mostrado sea el que resuelve el envío.
 */
export const previewAudience = async ({ audience, cicloEscolarId = null }) => {
    const res = await api.post('/audience/preview', {
        audience,
        ...(cicloEscolarId ? { cicloEscolarId: Number(cicloEscolarId) } : {}),
    });
    return res.data;
};

/**
 * Conteo de padres por horario para un colegio y sus rutas.
 */
export const fetchScheduleCounts = async ({ schoolId, routeNumbers, cicloEscolarId = null }) => {
    const res = await api.post('/audience/schedule-counts', {
        schoolId: Number(schoolId),
        routeNumbers,
        ...(cicloEscolarId ? { cicloEscolarId: Number(cicloEscolarId) } : {}),
    });
    return res.data?.scheduleCountsParents || {};
};
