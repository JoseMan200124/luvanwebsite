// src/utils/axiosConfig.js
/* global globalThis */
import axios from 'axios';

const API_URL = 'https://api.transportesluvan.com/api';


const api = axios.create({
    baseURL: API_URL,
});

const WRITE_METHODS = new Set(['post', 'put', 'patch']);

// Roles that have a fixed school context and require automatic school injection (parent=3, colaborador=8)
const SCHOOL_CONTEXT_ROLE_IDS = new Set([3, 8]);

const getTokenRoleId = (token) => {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload?.roleId ?? null;
    } catch {
        return null;
    }
};

const getCycleContext = () => {
    const token = localStorage.getItem('token');
    return {
        token,
        roleId: getTokenRoleId(token),
        selectedCicloEscolarId: localStorage.getItem('selectedCicloEscolarId'),
        selectedSchoolId: localStorage.getItem('selectedSchoolId')
    };
};

const shouldInjectCycleContext = (url = '') => {
    const skippedFragments = [
        '/school-years',
        '/ciclos-escolares',
        '/protocols',
        '/update-parent-info',
        '/update-colaborador-info'
    ];
    return !skippedFragments.some((fragment) => url.includes(fragment));
};

const ensureObjectParams = (config) => {
    if (!config.params || typeof config.params !== 'object') {
        config.params = {};
    }
    return config.params;
};

const isJsonBody = (data) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return data && typeof data === 'object' && !isFormData;
};

const CYCLE_OVERRIDE_KEYS = new Set(['allCycles', 'cicloEscolarId', 'ciclo_escolar_id']);
const SCHOOL_OVERRIDE_KEYS = new Set(['schoolId', 'school_id']);

const hasOverrideInParams = (params, overrideKeys) => {
    if (!params || typeof params !== 'object') return false;
    if (params instanceof URLSearchParams) {
        return Array.from(overrideKeys).some((key) => params.has(key));
    }
    const keys = Object.keys(params);
    return keys.some((key) => overrideKeys.has(key));
};

const hasOverrideInUrl = (url = '', overrideKeys) => {
    const queryIndex = String(url).indexOf('?');
    if (queryIndex === -1) return false;

    const searchParams = new URLSearchParams(String(url).slice(queryIndex + 1));
    return Array.from(overrideKeys).some((key) => searchParams.has(key));
};

const hasExplicitCycleOverride = (config) => {
    if (hasOverrideInUrl(config.url || '', CYCLE_OVERRIDE_KEYS)) return true;
    if (hasOverrideInParams(config.params, CYCLE_OVERRIDE_KEYS)) return true;
    if (isJsonBody(config.data) && hasOverrideInParams(config.data, CYCLE_OVERRIDE_KEYS)) return true;
    return false;
};

const hasExplicitSchoolOverride = (config) => {
    if (hasOverrideInUrl(config.url || '', SCHOOL_OVERRIDE_KEYS)) return true;
    if (hasOverrideInParams(config.params, SCHOOL_OVERRIDE_KEYS)) return true;
    if (isJsonBody(config.data) && hasOverrideInParams(config.data, SCHOOL_OVERRIDE_KEYS)) return true;
    return false;
};

const injectCycleHeaders = (config, cycleContext) => {
    if (cycleContext.selectedCicloEscolarId) {
        config.headers['X-Ciclo-Escolar-Id'] = cycleContext.selectedCicloEscolarId;
    }
};

const injectSchoolHeaders = (config, cycleContext) => {
    if (cycleContext.selectedSchoolId) {
        config.headers['X-School-Id'] = cycleContext.selectedSchoolId;
    }
};

const injectCycleParams = (config, cycleContext) => {
    const params = ensureObjectParams(config);
    if (cycleContext.selectedCicloEscolarId && !('cicloEscolarId' in params)) {
        params.cicloEscolarId = cycleContext.selectedCicloEscolarId;
    }
};

const injectSchoolParams = (config, cycleContext) => {
    const params = ensureObjectParams(config);
    if (cycleContext.selectedSchoolId && !('schoolId' in params)) {
        params.schoolId = cycleContext.selectedSchoolId;
    }
};

const injectCycleBody = (config, cycleContext) => {
    if (!isJsonBody(config.data)) return;
    if (cycleContext.selectedCicloEscolarId && !('cicloEscolarId' in config.data)) {
        config.data.cicloEscolarId = cycleContext.selectedCicloEscolarId;
    }
};

const injectSchoolBody = (config, cycleContext) => {
    if (!isJsonBody(config.data)) return;
    if (cycleContext.selectedSchoolId && !('schoolId' in config.data)) {
        config.data.schoolId = cycleContext.selectedSchoolId;
    }
};

const applyRequestConfig = (config) => {
    const cycleContext = getCycleContext();
    const method = (config.method || 'get').toLowerCase();
    const url = (config.url || '').toString();
    config.headers = config.headers || {};

    if (!config.skipAuth && cycleContext.token) {
        config.headers.Authorization = `Bearer ${cycleContext.token}`;
    }

    if (config.skipSchoolCycleContext) return config;

    if (!shouldInjectCycleContext(url)) return config;

    if (!hasExplicitCycleOverride(config)) {
        injectCycleHeaders(config, cycleContext);
        if (method === 'get') {
            injectCycleParams(config, cycleContext);
        }
        if (WRITE_METHODS.has(method)) {
            injectCycleBody(config, cycleContext);
        }
    }

    // Only auto-inject school context for roles that have a fixed school (parent/colaborador).
    // Admin users manage their own schoolId filtering explicitly per request.
    if (!hasExplicitSchoolOverride(config) && SCHOOL_CONTEXT_ROLE_IDS.has(Number(cycleContext.roleId))) {
        injectSchoolHeaders(config, cycleContext);
        if (method === 'get') {
            injectSchoolParams(config, cycleContext);
        }
        if (WRITE_METHODS.has(method)) {
            injectSchoolBody(config, cycleContext);
        }
    }
    return config;
};

api.interceptors.request.use(
    applyRequestConfig,
    (error) => { throw error; }
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

const clearStoredSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
};

const isSessionInvalidatedMessage = (message) => (
    message.includes('Sesión inválida') ||
    message.includes('Session inválida') ||
    message.includes('inicia sesión nuevamente')
);

const dispatchSessionInvalidated = (message) => {
    clearStoredSession();
    globalThis.dispatchEvent(new CustomEvent('sessionInvalidated', {
        detail: { message }
    }));
};

const waitForRefresh = (originalRequest) => (
    new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
    }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
    })
);

const refreshAuthToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    const response = await axios.post(`${api.defaults.baseURL.replace('/api', '')}/api/auth/refresh`, { refreshToken });
    const { token, refreshToken: newRefresh } = response.data;
    localStorage.setItem('token', token);
    if (newRefresh) {
        localStorage.setItem('refreshToken', newRefresh);
    }
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return token;
};

const handleUnauthorizedResponse = async (error) => {
    const originalRequest = error.config;
    const errorMessage = error.response?.data?.message || '';

    if (!originalRequest) throw error;

    if (isSessionInvalidatedMessage(errorMessage)) {
        dispatchSessionInvalidated(errorMessage);
        throw error;
    }

    if (originalRequest._retry) throw error;
    originalRequest._retry = true;

    if (isRefreshing) {
        return waitForRefresh(originalRequest);
    }

    isRefreshing = true;
    try {
        const token = await refreshAuthToken();
        if (!token) throw error;
        processQueue(null, token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
    } catch (refreshError) {
        processQueue(refreshError, null);
        clearStoredSession();
        throw refreshError;
    } finally {
        isRefreshing = false;
    }
};

api.interceptors.response.use(
    response => response,
    async (error) => {
        if (error.response?.status === 401) {
            return handleUnauthorizedResponse(error);
        }
        throw error;
    }
);

export default api;
