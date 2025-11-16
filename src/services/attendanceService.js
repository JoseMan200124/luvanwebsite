// services/attendanceService.js
import api from '../utils/axiosConfig';

/**
 * Obtener asistencias registradas con filtros
 * @param {Object} filters - Filtros para la consulta
 * @param {number} filters.schoolId - ID del colegio
 * @param {number} filters.busId - ID del bus
 * @param {string} filters.startDate - Fecha inicial (YYYY-MM-DD)
 * @param {string} filters.endDate - Fecha final (YYYY-MM-DD)
 * @param {string} filters.schedule - Horario (AM, MD, PM, EX)
 * @param {number} filters.page - Página
 * @param {number} filters.limit - Registros por página
 */
export const getAttendances = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/monitora/asistencia?${params.toString()}`);
    return response.data;
};

/**
 * Verificar si existe registro de asistencia
 * @param {Object} params - Parámetros de verificación
 * @param {number} params.monitoraId - ID de la monitora
 * @param {string} params.fecha - Fecha (YYYY-MM-DD)
 * @param {string} params.schedule - Horario (AM, MD, PM, EX)
 * @param {string} params.day - Día de la semana
 */
export const checkAttendanceExists = async (params) => {
    const queryParams = new URLSearchParams(params);
    const response = await api.get(`/monitora/asistencia/check?${queryParams.toString()}`);
    return response.data;
};

/**
 * Obtener estadísticas de asistencias
 * @param {Object} filters - Filtros para las estadísticas
 */
export const getAttendanceStatistics = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/monitora/asistencia/statistics?${params.toString()}`);
    return response.data;
};

/**
 * Obtener detalles de una asistencia específica con lista de estudiantes
 * @param {number} id - ID del registro de asistencia
 */
export const getAttendanceDetails = async (id) => {
    const response = await api.get(`/monitora/asistencia/${id}`);
    return response.data;
};
