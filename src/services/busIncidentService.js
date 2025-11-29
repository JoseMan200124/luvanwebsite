// services/busIncidentService.js
import api from '../utils/axiosConfig';

/**
 * Obtener todos los incidentes de buses con filtros
 * @param {Object} filters - Filtros para la consulta
 * @param {number} filters.schoolId - ID del colegio
 * @param {number} filters.corporationId - ID de la corporación
 * @param {string} filters.plate - Placa del bus
 * @param {string} filters.routeNumber - Número de ruta
 * @param {string} filters.tipoFalla - Tipo de falla (mecánico, eléctrico, choque, otro)
 * @param {string} filters.tipo - Tipo de evento (incidente, accidente)
 * @param {string} filters.startDate - Fecha inicial (YYYY-MM-DD)
 * @param {string} filters.endDate - Fecha final (YYYY-MM-DD)
 * @param {boolean} filters.noFallas - Sin fallas reportadas
 * @param {boolean} filters.impacto - Con impacto
 * @param {number} filters.page - Página
 * @param {number} filters.limit - Registros por página
 */
export const getAllBusIncidents = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/bus-incidents?${params.toString()}`);
    return response.data;
};

/**
 * Obtener un incidente específico por ID
 * @param {number} id - ID del incidente
 */
export const getBusIncidentById = async (id) => {
    const response = await api.get(`/bus-incidents/${id}`);
    return response.data;
};

/**
 * Eliminar un incidente por ID
 * @param {number} id - ID del incidente
 */
export const deleteBusIncident = async (id) => {
    const response = await api.delete(`/bus-incidents/${id}`);
    return response.data;
};

/**
 * Obtener estadísticas de incidentes
 * @param {Object} filters - Filtros para las estadísticas
 */
export const getBusIncidentStatistics = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/bus-incidents/statistics?${params.toString()}`);
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
 * Tipos de incidente
 */
export const INCIDENT_EVENT_TYPES = {
    'incidente': 'Incidente',
    'accidente': 'Accidente'
};
