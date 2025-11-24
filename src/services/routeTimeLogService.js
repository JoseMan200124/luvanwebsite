// services/routeTimeLogService.js
import api from '../utils/axiosConfig';

/**
 * Obtener registros de tiempos de rutas con filtros
 * @param {Object} filters - Filtros para la consulta
 * @param {number} filters.schoolId - ID del colegio
 * @param {number} filters.busId - ID del bus
 * @param {number} filters.monitoraId - ID de la monitora
 * @param {string} filters.schedule - Horario (AM, MD, PM, EX)
 * @param {string} filters.day - Día de la semana
 * @param {string} filters.startDate - Fecha inicial (YYYY-MM-DD)
 * @param {string} filters.endDate - Fecha final (YYYY-MM-DD)
 * @param {number} filters.page - Página
 * @param {number} filters.limit - Registros por página
 */
export const getRouteTimeLogs = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/monitora/route-times?${params.toString()}`);
    return response.data;
};

/**
 * Obtener un registro específico por ID
 * @param {number} id - ID del registro
 */
export const getRouteTimeLogById = async (id) => {
    const response = await api.get(`/monitora/route-times/${id}`);
    return response.data;
};

/**
 * Eliminar un registro de tiempos por ID
 * @param {number} id
 */
export const deleteRouteTimeLog = async (id) => {
    const response = await api.delete(`/monitora/route-times/${id}`);
    return response.data;
};

/**
 * Obtener estadísticas de tiempos de rutas
 * @param {Object} filters - Filtros para las estadísticas
 */
export const getRouteTimeLogStatistics = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/monitora/route-times/statistics?${params.toString()}`);
    return response.data;
};
