import api from '../utils/axiosConfig';

export const getCiclosEscolares = async () => {
    const response = await api.get('/ciclos-escolares');
    return response.data;
};

export const createCicloEscolar = async (payload) => {
    const response = await api.post('/ciclos-escolares', payload);
    return response.data;
};

export const updateCicloEscolar = async (id, payload) => {
    const response = await api.put(`/ciclos-escolares/${id}`, payload);
    return response.data;
};

export const activateCicloEscolar = async (id) => {
    const response = await api.patch(`/ciclos-escolares/${id}/activate`);
    return response.data;
};

export const setDefaultCicloEscolar = async (id) => {
    const response = await api.patch(`/ciclos-escolares/${id}/default`);
    return response.data;
};

const normalizeCycleYear = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const year = Number.parseInt(value, 10);
    return Number.isInteger(year) && year >= 1900 && year <= 2199 ? String(year) : '';
};

const extractCycleYear = (value) => {
    const match = /\b(?:19|20|21)\d{2}\b/.exec(String(value || ''));
    return match ? match[0] : '';
};

const getStoredCycleLabel = (cicloEscolar) => {
    const value = String(cicloEscolar?.label || cicloEscolar?.nombre || '').trim();
    if (!value) return '';
    return /^(ciclo\s+escolar\s*)?\d{1,3}$/i.test(value) ? '' : value;
};

export const getCicloEscolarYear = (cicloEscolar) => {
    if (!cicloEscolar) return '';
    return normalizeCycleYear(cicloEscolar.anio)
        || extractCycleYear(cicloEscolar.label)
        || extractCycleYear(cicloEscolar.nombre);
};

export const getCicloEscolarOptionLabel = (cicloEscolar) => {
    if (!cicloEscolar) return '';
    const year = getCicloEscolarYear(cicloEscolar);
    return year ? `Ciclo Escolar ${year}` : getStoredCycleLabel(cicloEscolar);
};
