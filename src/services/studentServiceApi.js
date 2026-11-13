import api from '../utils/axiosConfig';

// Desactiva (activo=false) o reactiva (activo=true) a un alumno por separado de su familia.
// Al desactivar se borran sus horarios y la mensualidad cambia desde el próximo cobro.
export const cambiarServicioAlumno = async (studentId, activo, nota = '') => {
    const { data } = await api.patch(`/students/${studentId}/servicio`, { activo, nota });
    return data;
};
