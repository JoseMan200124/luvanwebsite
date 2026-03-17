// src/services/scheduleService.js
/**
 * Servicios para gestionar y actualizar horarios escolares
 */

import api from '../utils/axiosConfig';

/**
 * Actualiza SOLO los horarios de una escuela y propaga los cambios a ScheduleSlots
 * NOTA: Las notificaciones están deshabilitadas por defecto
 * 
 * Soporta cambios en:
 * - Código del horario (ej: LUN → LUNES)
 * - Nombre del horario (ej: Lunes → Monday)
 * - Hora (ej: 07:00 → 07:15)
 * - Combinaciones de los anteriores
 * 
 * @param {number} schoolId - ID de la escuela
 * @param {Array} schedules - Array de horarios: [{ code, name, times, days }, ...]
 * @param {Object} options - { notify: false } (por defecto deshabilitado)
 * @returns {Promise} - Respuesta del servidor con cambios propagados
 */
export const updateSchoolSchedules = async (schoolId, schedules, options = {}) => {
  const { notify = false } = options; // Notificaciones deshabilitadas

  try {
    const response = await api.patch(`/schools/${schoolId}/schedules`, {
      schedules
    });

    return {
      success: true,
      school: response.data.school,
      scheduleChanges: response.data.scheduleChanges,
      notify
    };
  } catch (error) {
    console.error('Error updating school schedules:', error);
    const errorMessage = error.response?.data?.message || 'Error al actualizar horarios';
    const err = new Error(errorMessage);
    err.originalError = error;
    throw err;
  }
};

/**
 * Obtiene los horarios actuales de una escuela
 * 
 * @param {number} schoolId - ID de la escuela
 * @returns {Promise} - Array de horarios
 */
export const getSchoolSchedules = async (schoolId) => {
  try {
    const response = await api.get(`/schools/${schoolId}/schedules`);
    return response.data.schedules || [];
  } catch (error) {
    console.error('Error fetching school schedules:', error);
    return [];
  }
};

/**
 * Obtiene toda la información de una escuela
 * 
 * @param {number} schoolId - ID de la escuela
 * @returns {Promise} - Datos de la escuela
 */
export const getSchoolById = async (schoolId) => {
  try {
    const response = await api.get(`/schools/${schoolId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching school:', error);
    throw error;
  }
};

/**
 * Valida que los horarios tengan el formato correcto
 * 
 * @param {Array} schedules - Array de horarios a validar
 * @returns {Object} - { valid: boolean, errors: [] }
 */
export const validateSchedules = (schedules) => {
  const errors = [];

  if (!Array.isArray(schedules)) {
    return { valid: false, errors: ['Schedules debe ser un array'] };
  }

  schedules.forEach((schedule, index) => {
    if (!schedule.code) {
      errors.push(`Schedule ${index}: 'code' es requerido`);
    }
    if (!schedule.name) {
      errors.push(`Schedule ${index}: 'name' es requerido`);
    }
    if (!Array.isArray(schedule.times) || schedule.times.length === 0) {
      errors.push(`Schedule ${index}: 'times' debe ser un array con al menos una hora`);
    } else {
      // Validar formato HH:MM
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      schedule.times.forEach(time => {
        if (!timeRegex.test(time)) {
          errors.push(`Schedule ${index}: hora inválida '${time}', usa formato HH:MM`);
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Formatea un cambio de horario para mostrar en UI
 * Soporta cambios en código, nombre, hora y combinaciones
 * 
 * @param {Object} change - { code, oldTime, newTime, type, changes, ... }
 * @returns {string} - Mensaje formateado
 */
export const formatScheduleChange = (change) => {
  if (change.type === 'created') {
    return `✓ Horario ${change.code} (${change.newName}) creado a las ${change.newTime}`;
  }

  if (change.type === 'deleted') {
    return `✗ Horario ${change.code} eliminado (${change.affectedSlots} estudiantes afectados)`;
  }

  if (change.type === 'modified') {
    const changeSummary = change.changes.join(', ');
    return `◆ Horario ${change.oldCode}: ${changeSummary} (${change.affectedSlots} estudiantes afectados)`;
  }

  if (change.error) {
    return `✗ Error en horario ${change.code}: ${change.error}`;
  }

  return `◆ Cambio en horario: ${JSON.stringify(change)}`;
};

/**
 * Extrae el código de un string de horario escolar
 * Ej: "07:15 LUN" -> "LUN"
 * 
 * @param {string} schoolScheduleStr - String del formato "HH:MM CODE"
 * @returns {string|null} - El código o null si no se encuentra
 */
export const extractScheduleCode = (schoolScheduleStr) => {
  if (!schoolScheduleStr || typeof schoolScheduleStr !== 'string') {
    return null;
  }

  const parts = schoolScheduleStr.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : null;
};

const scheduleService = {
  updateSchoolSchedules,
  getSchoolSchedules,
  getSchoolById,
  validateSchedules,
  formatScheduleChange,
  extractScheduleCode
};

export default scheduleService;
