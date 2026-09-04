// src/services/educationLevelsService.js
import api from '../utils/axiosConfig';

export const listEducationLevels = async () => {
    const res = await api.get('/education-levels');
    return res.data?.levels || [];
};

export const getEducationLevelUsage = async (id) => {
    const res = await api.get(`/education-levels/${id}/usage`);
    return res.data;
};

export const createEducationLevel = async ({ name, order }) => {
    const res = await api.post('/education-levels', { name, order });
    return res.data?.level;
};

export const updateEducationLevel = async (id, { name, order }) => {
    const res = await api.put(`/education-levels/${id}`, { name, order });
    return res.data?.level;
};

export const deleteEducationLevel = async (id) => {
    const res = await api.delete(`/education-levels/${id}`);
    return res.data;
};

/**
 * Guarda el mapeo nivel -> grados de un colegio.
 * @param {number} schoolId
 * @param {Record<string, string[]>} levelGrades
 */
export const updateSchoolLevelGrades = async (schoolId, levelGrades) => {
    const res = await api.put(`/schools/${schoolId}/level-grades`, { levelGrades });
    return res.data?.levelGrades || {};
};
