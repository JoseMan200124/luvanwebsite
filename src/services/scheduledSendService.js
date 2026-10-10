// src/services/scheduledSendService.js
import api from '../utils/axiosConfig';

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/** @param {{ page?: number, pageSize?: number, status?: string, kind?: string }} params */
export const listScheduledSends = async (params) => {
    const res = await api.get('/scheduled-sends', { params });
    return res.data;
};

export const getScheduledSend = async (uuid) => {
    const res = await api.get(`/scheduled-sends/${encodeURIComponent(uuid)}`);
    return res.data;
};

/** @param {FormData} formData subject, body, audience (JSON), cicloEscolarId, sendEmail, schedule (JSON), file? */
export const createScheduledCircular = async (formData) => {
    const res = await api.post('/scheduled-sends/circulars', formData, MULTIPART);
    return res.data;
};

/** @param {{ title: string, message: string, audience: object, cicloEscolarId?: number, schedule: object }} payload */
export const createScheduledNotification = async (payload) => {
    const res = await api.post('/scheduled-sends/notifications', payload);
    return res.data;
};

/** @param {FormData|object} data FormData para circulares (adjunto), objeto para notificaciones */
export const updateScheduledSend = async (uuid, data) => {
    const config = data instanceof FormData ? MULTIPART : undefined;
    const res = await api.put(`/scheduled-sends/${encodeURIComponent(uuid)}`, data, config);
    return res.data;
};

export const cancelScheduledSend = async (uuid) => {
    const res = await api.post(`/scheduled-sends/${encodeURIComponent(uuid)}/cancel`);
    return res.data;
};
