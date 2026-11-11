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
 * Ingreso manual de un mapeo de fallas (solo Gestor)
 * @param {Object} data - Ver body de POST /failure-mappings/web
 */
export const createFailureMappingWeb = async (data) => {
    const response = await api.post('/failure-mappings/web', data);
    return response.data;
};

// Códigos 409 de conflicto con otros registros del día o con la placa
export const CONFLICT_CODES = ['DIA_CERRADO', 'DIA_CON_FALLA', 'FALLA_DUPLICADA', 'PLACA_EN_OTRO_CLIENTE', 'REGISTRO_DUPLICADO'];
// Único conflicto que se puede confirmar con "Guardar de todos modos" (force); los del día nunca
export const FORCEABLE_CODE = 'PLACA_EN_OTRO_CLIENTE';

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
