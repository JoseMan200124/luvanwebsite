// services/studentIncidentService.js
import api from '../utils/axiosConfig';

/**
 * Obtener todos los incidentes de estudiantes con filtros
 * @param {Object} filters - Filtros para la consulta
 * @param {number} filters.schoolId - ID del colegio
 * @param {number} filters.busId - ID del bus
 * @param {number} filters.studentId - ID del estudiante
 * @param {number} filters.monitoraId - ID de la monitora
 * @param {string} filters.incidentType - Tipo de incidente
 * @param {string} filters.scheduleType - Tipo de horario (AM, MD, PM, EX)
 * @param {string} filters.startDate - Fecha inicial (YYYY-MM-DD)
 * @param {string} filters.endDate - Fecha final (YYYY-MM-DD)
 * @param {number} filters.page - Página
 * @param {number} filters.limit - Registros por página
 */
export const getAllStudentIncidents = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/student-incidents?${params.toString()}`);
    return response.data;
};

/**
 * Obtener un incidente específico por ID
 * @param {number} id - ID del incidente
 */
export const getStudentIncidentById = async (id) => {
    const response = await api.get(`/student-incidents/${id}`);
    return response.data;
};

/**
 * Obtener estadísticas de incidentes
 * @param {Object} filters - Filtros para las estadísticas
 */
export const getStudentIncidentStatistics = async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });

    const response = await api.get(`/student-incidents/statistics?${params.toString()}`);
    return response.data;
};

/**
 * Tipos de incidentes disponibles
 */
export const INCIDENT_TYPES = {
    'emergencia_sanitaria': 'Emergencia Sanitaria',
    'lesion_otro_alumno': 'Lesión a Otro Alumno',
    'saca_extremidades': 'Saca Extremidades del Bus',
    'mal_comportamiento': 'Mal Comportamiento',
    'falta_respeto': 'Falta de Respeto',
    'lenguaje_inapropiado': 'Lenguaje Inapropiado',
    'no_sigue_indicaciones': 'No Sigue Indicaciones',
    'no_usa_cinturon': 'No Usa Cinturón de Seguridad',
    'danos_al_bus': 'Daños al Bus',
    'otro': 'Otro'
};
