// src/services/fuelStatisticsService.js
import api from '../utils/axiosConfig';

// El interceptor agrega cicloEscolarId a los GET; el backend lo ignora en estos endpoints.
export const getFuelFinancialStatistics = async (params) => {
    const response = await api.get('/financial-statistics/fuel', { params });
    return response.data;
};

export const getFuelClients = async () => {
    const response = await api.get('/financial-statistics/fuel/clients');
    return response.data;
};
