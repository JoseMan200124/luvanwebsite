// services/fuelRecordService.js
import api from '../utils/axiosConfig';

/**
 * Obtener todos los registros de combustible con filtros
 * @param {Object} filters - Filtros para la consulta
 * @param {number} filters.schoolId - ID del colegio
 * @param {number} filters.busId - ID del bus
 * @param {string} filters.fuelingReason - Razón del abastecimiento (ruta, mecanico, excursion, admin, suplente)
 * @param {string} filters.startDate - Fecha inicial (YYYY-MM-DD)
 * @param {string} filters.endDate - Fecha final (YYYY-MM-DD)
 * @param {number} filters.page - Página
 * @param {number} filters.limit - Registros por página
 */
export const getFuelRecords = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/fuel-records?${params.toString()}`);
    return response.data;
};

/**
 * Exportar a Excel los registros de combustible que coinciden con los filtros dados.
 * Mismos filtros que getFuelRecords, pero sin page/limit (el backend trae todo lo que matchea).
 * @param {Object} filters - Filtros para la consulta
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta completa (response.data es un Blob)
 */
export const exportFuelRecordsExcel = async (filters = {}) => {
    const params = new URLSearchParams();

    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    return api.get(`/fuel-records/export/excel?${params.toString()}`, { responseType: 'blob' });
};

/**
 * Obtener estadísticas de combustible
 * @param {Object} filters - Filtros para las estadísticas
 */
export const getFuelStatistics = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/fuel-records/statistics?${params.toString()}`);
    return response.data;
};

/**
 * Obtener un registro específico por ID
 * @param {number} id - ID del registro
 */
export const getFuelRecordById = async (id) => {
    const response = await api.get(`/fuel-records/${id}`);
    return response.data;
};

/**
 * Crear un nuevo registro de combustible desde la plataforma web.
 * Usa un endpoint separado para no afectar la lógica de la app móvil.
 */
export const createFuelRecordWeb = async (data) => {
    const response = await api.post(`/fuel-records/web`, data);
    return response.data;
};

/**
 * Actualizar un registro de combustible
 * @param {number} id - ID del registro
 * @param {Object} data - Datos actualizados
 */
export const updateFuelRecord = async (id, data) => {
    const response = await api.put(`/fuel-records/${id}`, data);
    return response.data;
};

/**
 * Eliminar un registro de combustible
 * @param {number} id - ID del registro
 */
export const deleteFuelRecord = async (id) => {
    const response = await api.delete(`/fuel-records/${id}`);
    return response.data;
};

/**
 * Razones de abastecimiento disponibles
 */
export const FUELING_REASONS = {
    'ruta': 'Ruta Normal',
    'mecanico': 'Visita al Mecánico',
    'excursion': 'Excursión/Evento',
    'admin': 'Administrativo',
    'suplente': 'Suplente'
};

/**
 * Tipos de combustible disponibles
 */
export const FUEL_TYPES = {
    'diesel': 'Diesel',
    'ion_diesel': 'Ion Diesel',
    'super': 'Super',
    'regular': 'Regular'
};
