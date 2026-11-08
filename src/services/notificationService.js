// src/services/notificationService.js
import api from '../utils/axiosConfig';

/**
 * Send a manual push notification to a targeted audience.
 * @param {{ title: string, message: string, audience: object, cicloEscolarId?: number }} payload
 */
export const sendManualNotification = async (payload) => {
    const res = await api.post('/notifications', {
        type: 'manual',
        sendPush: true,
        ...payload,
    });
    return res.data;
};

/**
 * Lista paginada del historial de notificaciones manuales enviadas (admin).
 * @param {{ page?: number, pageSize?: number, q?: string, startDate?: string, endDate?: string,
 *           cicloEscolarId?: number|string, allCycles?: boolean, sortBy?: string, sortDirection?: string }} params
 */
export const listNotificationHistory = async (params) => {
    const res = await api.get('/notifications/admin', { params });
    return res.data;
};

/**
 * Detalle de una notificación enviada: mensaje, audiencia y destinatarios.
 * @param {string} uuid
 */
export const getNotificationHistoryDetail = async (uuid) => {
    const res = await api.get(`/notifications/admin/${encodeURIComponent(uuid)}`);
    return res.data;
};
