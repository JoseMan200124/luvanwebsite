/**
 * services/mechanicRequestService.js
 * 
 * Servicio para la gestión de solicitudes de mecánica
 */

import api from '../utils/axiosConfig';

const API_URL = '/mechanic-requests';

/**
 * Obtener todas las solicitudes de mecánica con filtros y paginación
 */
export const getAllMechanicRequests = async (params = {}) => {
    const response = await api.get(API_URL, { params });
    return response.data;
};

/**
 * Obtener una solicitud de mecánica por ID
 */
export const getMechanicRequestById = async (id) => {
    const response = await api.get(`${API_URL}/${id}`);
    return response.data;
};

/**
 * Actualizar estado de una solicitud de mecánica
 */
export const updateMechanicRequestStatus = async (id, data) => {
    const response = await api.patch(`${API_URL}/${id}/status`, data);
    return response.data;
};

/**
 * Eliminar una solicitud de mecánica
 */
export const deleteMechanicRequest = async (id) => {
    const response = await api.delete(`${API_URL}/${id}`);
    return response.data;
};

/**
 * Obtener estadísticas de solicitudes de mecánica
 */
export const getMechanicRequestStatistics = async (params = {}) => {
    const response = await api.get(`${API_URL}/statistics`, { params });
    return response.data;
};

/**
 * Tipos de trabajo para solicitudes de mecánica
 */
export const WORK_TYPES = {
    'mecánico': 'Mecánico',
    'eléctrico': 'Eléctrico',
    'frenos': 'Frenos',
    'otro': 'Otro'
};

/**
 * Estados de solicitudes de mecánica
 */
export const REQUEST_STATES = {
    'pendiente': 'Pendiente',
    'en_proceso': 'En Proceso',
    'completado': 'Completado',
    'cancelado': 'Cancelado'
};

/**
 * Colores para los estados
 */
export const STATE_COLORS = {
    'pendiente': 'warning',
    'en_proceso': 'info',
    'completado': 'success',
    'cancelado': 'error'
};
