// services/busEmergencyService.js
import api from '../utils/axiosConfig';

/**
 * Obtener todas las emergencias de buses con filtros
 * @param {Object} filters - Filtros para la consulta
 * @param {number} filters.schoolId - ID del colegio
 * @param {number} filters.corporationId - ID de la corporación
 * @param {string} filters.plate - Placa del bus
 * @param {string} filters.routeNumber - Número de ruta
 * @param {string} filters.startDate - Fecha inicial (YYYY-MM-DD)
 * @param {string} filters.endDate - Fecha final (YYYY-MM-DD)
 * @param {string} filters.orderBy - Columna para ordenar
 * @param {string} filters.order - Dirección de orden (ASC/DESC)
 * @param {number} filters.page - Página
 * @param {number} filters.limit - Registros por página
 */
export const getAllBusEmergencies = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/bus-emergencies?${params.toString()}`);
    return response.data;
};

/**
 * Obtener una emergencia específica por ID
 * @param {number} id - ID de la emergencia
 */
export const getBusEmergencyById = async (id) => {
    const response = await api.get(`/bus-emergencies/${id}`);
    return response.data;
};

/**
 * Eliminar una emergencia por ID
 * @param {number} id - ID de la emergencia
 */
export const deleteBusEmergency = async (id) => {
    const response = await api.delete(`/bus-emergencies/${id}`);
    return response.data;
};

/**
 * Obtener estadísticas de emergencias
 * @param {Object} filters - Filtros para las estadísticas
 */
export const getBusEmergencyStatistics = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/bus-emergencies/statistics?${params.toString()}`);
    return response.data;
};
