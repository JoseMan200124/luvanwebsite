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
 * Obtener todos los registros de tiempos que coincidan con los filtros (iterativo)
 * Usa paginación interna para recolectar todos los elementos y devolverlos como un array plano
 * @param {Object} filters
 * @param {number} perPage - tamaño de página para solicitar al backend (por defecto 1000)
 */
export const getAllRouteTimeLogs = async (filters = {}, perPage = 1000) => {
    try {
        const collected = [];
        let page = 1;
        let total = null;

        while (true) {
            const params = new URLSearchParams();
            const merged = { ...filters, page, limit: perPage };
            Object.keys(merged).forEach(key => {
                if (merged[key] !== undefined && merged[key] !== null && merged[key] !== '') {
                    params.append(key, merged[key]);
                }
            });

            const response = await api.get(`/monitora/route-times?${params.toString()}`);
            const data = response.data || {};
            const pageItems = data.timeLogs || data.data || [];

            if (Array.isArray(pageItems) && pageItems.length > 0) {
                collected.push(...pageItems);
            }

            // total puede venir en data.total
            if (total === null) total = data.total ?? null;

            // si no hay total, usar heurística por length < perPage
            const fetchedCount = pageItems.length;
            if ((total !== null && collected.length >= Number(total)) || fetchedCount < perPage) {
                break;
            }

            page += 1;
        }

        return collected;
    } catch (err) {
        throw err;
    }
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
