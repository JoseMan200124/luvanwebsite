/**
 * services/requestService.js
 *
 * Servicio para manejar solicitudes genéricas (Request)
 */
import api from '../utils/axiosConfig';

const API_URL = '/requests';

export const getAllRequests = async (params = {}) => {
    const res = await api.get(API_URL, { params });
    return res.data;
};

export const getRequestById = async (id) => {
    const res = await api.get(`${API_URL}/${id}`);
    return res.data;
};

export const getMyRequests = async () => {
    const res = await api.get(`${API_URL}/my-requests`);
    return res.data?.requests || [];
};

export const getRequestEvents = async (id) => {
    const res = await api.get(`${API_URL}/${id}/events`);
    return res.data?.events || [];
};

export const createRequest = async (data) => {
    const res = await api.post(API_URL, data);
    return res.data;
};

export const createServiceCancellation = async (data) => {
    const res = await api.post(`${API_URL}/service-cancellation`, data);
    return res.data;
};

export const updateRequestStatus = async (id, data) => {
    const res = await api.patch(`${API_URL}/${id}/status`, data);
    return res.data;
};

export const deleteRequest = async (id) => {
    const res = await api.delete(`${API_URL}/${id}`);
    return res.data;
};

export const cancelRequest = async (id) => {
    const res = await api.post(`${API_URL}/${id}/cancel`);
    return res.data;
};

export const getRequestStatistics = async (params = {}) => {
    const res = await api.get(`${API_URL}/statistics`, { params });
    return res.data;
};

export const getSchoolsList = async (params = {}) => {
    const res = await api.get('/schools', { params });
    return res.data?.schools || res.data || [];
};

export const getCorporationsList = async (params = {}) => {
    const res = await api.get('/corporations', { params });
    return res.data?.corporations || res.data || [];
};

export const REQUEST_TYPE_META = {
    service_cancellation: { label: 'Baja del Servicio', color: '#E74C3C', icon: 'cancel' },
    schedule_change: { label: 'Cambio de Horario', color: '#2196F3', icon: 'schedule' },
    route_change: { label: 'Cambio de Ruta', color: '#7B61FF', icon: 'bus' },
    other: { label: 'Otro', color: '#6C757D', icon: 'create' },
};

export const VALID_REQUEST_TYPES = Object.fromEntries(
    Object.entries(REQUEST_TYPE_META).map(([key, meta]) => [key, meta.label])
);

export const REQUEST_STATES = {
    pending: 'Pending',
    in_review: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed'
};

export const STATE_COLORS = {
    pending: 'warning',
    in_review: 'info',
    approved: 'success',
    rejected: 'error',
    completed: 'success'
};

export default {
    getAllRequests,
    getRequestById,
    getMyRequests,
    getRequestEvents,
    createRequest,
    createServiceCancellation,
    updateRequestStatus,
    deleteRequest,
    getRequestStatistics
    , getSchoolsList, getCorporationsList
};
