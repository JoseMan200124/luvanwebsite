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
  const {
    notify = false,
    confirmScheduleDeletion = false,
    downloadAffectedStudentsExcel = false
  } = options; // Notificaciones deshabilitadas

  try {
    const response = await api.patch(`/schools/${schoolId}/schedules`, {
      schedules,
      confirmScheduleDeletion,
      downloadAffectedStudentsExcel
    });

    return {
      success: true,
      school: response.data.school,
      scheduleChanges: response.data.scheduleChanges,
      schoolSchedulesSync: response.data.schoolSchedulesSync,
      scheduleDeletionDownload: response.data.scheduleDeletionDownload || null,
      notify
    };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status === 409 && data?.requiresConfirmation) {
      const err = new Error(data?.message || 'Se requiere confirmación para eliminar horarios con paradas asociadas.');
      err.code = 'SCHEDULE_DELETION_CONFIRMATION_REQUIRED';
      err.confirmationData = data;
      err.originalError = error;
      throw err;
    }

    console.error('Error updating school schedules:', error);
    const errorMessage = error.response?.data?.message || 'Error al actualizar horarios';
    const err = new Error(errorMessage);
    err.originalError = error;
    throw err;
  }
};

function getFilenameFromDisposition(contentDisposition, fallback) {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];
  return fallback;
}

export const downloadScheduleDeletionZip = async (token) => {
  if (!token) {
    throw new Error('No se recibió token de descarga.');
  }

  const response = await api.get(`/schools/schedule-deletion-download/${encodeURIComponent(token)}`, {
    responseType: 'blob'
  });

  const contentDisposition = response.headers?.['content-disposition'] || '';
  const fallbackName = `Estudiantes afectados eliminacion horarios ${new Date().toISOString().slice(0, 10)}.zip`;
  const fileName = getFilenameFromDisposition(contentDisposition, fallbackName);
  const contentType = response.headers?.['content-type'] || 'application/zip';
  const blob = new Blob([response.data], { type: contentType });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getScheduleDeletionImpact = async (schoolId, schedulePayload) => {
  const response = await api.post(`/schools/${schoolId}/schedules/deletion-impact`, {
    code: schedulePayload?.code || null,
    originalCode: schedulePayload?.originalCode || null
  });

  return response.data?.impact || {
    scheduleCode: schedulePayload?.code || schedulePayload?.originalCode || null,
    scheduleId: null,
    affectedScheduleSlots: 0,
    affectedStudents: 0,
    affectedFamilies: 0
  };
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
  getScheduleDeletionImpact,
  downloadScheduleDeletionZip,
  getSchoolSchedules,
  getSchoolById,
  validateSchedules,
  formatScheduleChange,
  extractScheduleCode
};

export default scheduleService;
