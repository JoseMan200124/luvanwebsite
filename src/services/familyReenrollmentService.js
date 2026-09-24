// src/services/familyReenrollmentService.js
import api from '../utils/axiosConfig';

// El colegio destino es de otro ciclo: no inyectar el contexto guardado del
// padre, o authenticate respondería 403 SCHOOL_CYCLE_CONTEXT_FORBIDDEN.
const NO_CONTEXT = { skipSchoolCycleContext: true };

export const getReenrollmentOpportunities = async () => {
    const response = await api.get('/family-reenrollment/opportunities', NO_CONTEXT);
    return Array.isArray(response.data?.opportunities) ? response.data.opportunities : [];
};

export const getReenrollmentForm = async (targetSchoolId) => {
    const response = await api.get(`/family-reenrollment/schools/${targetSchoolId}`, NO_CONTEXT);
    return response.data;
};

export const submitReenrollment = async (targetSchoolId, payload) => {
    const response = await api.post(`/family-reenrollment/schools/${targetSchoolId}`, payload, NO_CONTEXT);
    return response.data;
};
