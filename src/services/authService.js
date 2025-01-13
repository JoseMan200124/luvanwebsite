// src/services/authService.js
import api from '../utils/axiosConfig';

export const registerUser = (userData) => {
    return api.post('/auth/register', userData);
};

export const loginUser = (credentials) => {
    return api.post('/auth/login', credentials);
};

export const verifyMFA = (code, token) => {
    return api.post('/auth/mfa/verify', { code }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const setupMFA = (token) => {
    return api.post('/auth/mfa/setup', {}, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const oauthLogin = () => {
    window.location.href = `${api.defaults.baseURL}/google`;
};
