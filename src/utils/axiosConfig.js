// src/utils/axiosConfig.js
import axios from 'axios';

const API_URL = 'https://api.transportesluvan.com/api';
//const API_URL = 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        const selectedSchoolYear = localStorage.getItem('selectedSchoolYear');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Always include selected school year when available
        if (selectedSchoolYear) {
            // Header for middleware consumption
            config.headers['X-School-Year'] = selectedSchoolYear;

            // Add as query param for GET requests when not explicitly provided
            const method = (config.method || 'get').toLowerCase();
            const url = (config.url || '').toString();
            const isSchoolYearsEndpoint = url.includes('/school-years');
            const isProtocolsEndpoint = url.includes('/protocols');
            // Do not attach schoolYear param for some public prefill endpoints (parents/colaboradores)
            const isUpdateParentPrefill = url.includes('/update-parent-info');
            const isUpdateColaboradorPrefill = url.includes('/update-colaborador-info');
            if (method === 'get' && !isSchoolYearsEndpoint && !isProtocolsEndpoint && !isUpdateParentPrefill && !isUpdateColaboradorPrefill) {
                if (!config.params) config.params = {};
                if (typeof config.params === 'object' && !('schoolYear' in config.params)) {
                    config.params.schoolYear = selectedSchoolYear;
                }
            }

            // For write operations, inject cicloescolar into JSON bodies if missing
            if ([ 'post', 'put', 'patch' ].includes(method) && !isProtocolsEndpoint) {
                const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
                const isJsonObject = config.data && typeof config.data === 'object' && !isFormData;
                if (isJsonObject && !('cicloescolar' in config.data)) {
                    config.data.cicloescolar = selectedSchoolYear;
                }
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

api.interceptors.response.use(
    response => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            isRefreshing = true;
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                isRefreshing = false;
                return Promise.reject(error);
            }

            try {
                const res = await axios.post(`${api.defaults.baseURL.replace('/api', '')}/api/auth/refresh`, { refreshToken });
                const { token, refreshToken: newRefresh } = res.data;
                localStorage.setItem('token', token);
                if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                processQueue(null, token);
                isRefreshing = false;
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);
                isRefreshing = false;
                // If refresh failed, remove tokens and let app handle logout
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
