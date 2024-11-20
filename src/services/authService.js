// src/services/authService.js

import axios from 'axios';

const API_URL = '/api/auth';

export const registerUser = (userData) => {
    return axios.post(`${API_URL}/register`, userData);
};

export const loginUser = (credentials) => {
    return axios.post(`${API_URL}/login`, credentials);
};

export const verifyMFA = (code, token) => {
    return axios.post(`${API_URL}/mfa/verify`, { code }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const setupMFA = (token) => {
    return axios.post(`${API_URL}/mfa/setup`, {}, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const oauthLogin = () => {
    window.location.href = `${API_URL}/google`;
};
