// src/services/familiasActivasService.js
import { saveAs } from 'file-saver';
import api from '../utils/axiosConfig';

const BASE = '/familias-activas';

export const getFamiliasActivas = async (cicloEscolarId) => {
    const res = await api.get(BASE, { params: { cicloEscolarId } });
    return res.data;
};

export const getDetalleFamiliasActivas = async ({ schoolId, anio, mes }) => {
    const res = await api.get(`${BASE}/detalle`, { params: { schoolId, anio, mes } });
    return res.data;
};

export const descargarExcelFamiliasActivas = async ({ schoolId, anio, mes, nombreArchivo }) => {
    const res = await api.get(`${BASE}/excel`, { params: { schoolId, anio, mes }, responseType: 'blob' });
    saveAs(res.data, nombreArchivo);
};

