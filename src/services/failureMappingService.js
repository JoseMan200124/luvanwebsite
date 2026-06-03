// services/failureMappingService.js
import api from '../utils/axiosConfig';

/**
 * Obtener todos los mapeos de fallas con filtros
 * @param {Object} filters - Filtros para la consulta
 */
export const getAllFailureMappings = async (filters = {}) => {
    const params = new URLSearchParams();

    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/failure-mappings?${params.toString()}`);
    return response.data;
};

/**
 * Obtener un mapeo de fallas específico por ID
 * @param {number} id - ID del mapeo
 */
export const getFailureMappingById = async (id) => {
    const response = await api.get(`/failure-mappings/${id}`);
    return response.data;
};

/**
 * Eliminar un mapeo de fallas por ID
 * @param {number} id - ID del mapeo
 */
export const deleteFailureMapping = async (id) => {
    const response = await api.delete(`/failure-mappings/${id}`);
    return response.data;
};

/**
 * Actualizar campos de un mapeo de fallas
 * @param {number} id - ID del mapeo
 * @param {Object} payload - Campos a actualizar
 */
export const updateFailureMapping = async (id, payload = {}) => {
    const response = await api.patch(`/failure-mappings/${id}`, payload);
    return response.data;
};

/**
 * Obtener estadísticas de mapeos de fallas
 * @param {Object} filters - Filtros para las estadísticas
 */
export const getFailureMappingStatistics = async (filters = {}) => {
    const params = new URLSearchParams();

    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/failure-mappings/statistics?${params.toString()}`);
    return response.data;
};

/**
 * Tipos de falla disponibles
 */
export const FAILURE_TYPES = {
    'mecánico': 'Mecánico',
    'eléctrico': 'Eléctrico',
    'choque': 'Choque',
    'otro': 'Otro'
};

/**
 * Tipos de evento
 */
export const INCIDENT_EVENT_TYPES = {
    'incidente': 'Incidente',
    'accidente': 'Accidente'
};
