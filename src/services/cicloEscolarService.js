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

export const getCicloEscolarOptionLabel = (cicloEscolar) => {
    if (!cicloEscolar) return '';
    return cicloEscolar.label || cicloEscolar.nombre || String(cicloEscolar.anio || '');
};