// src/services/authService.js

import axios from 'axios';

// Si configuraste un proxy, puedes usar rutas relativas
const API_URL = 'http://localhost:3001/api/auth';

/**
 * Registrar un nuevo usuario
 * @param {Object} userData - Datos del usuario (name, email, password, roleName)
 */
export const registerUser = (userData) => {
    return axios.post(`${API_URL}/register`, userData);
};

/**
 * Iniciar sesión de un usuario
 * @param {Object} credentials - Credenciales del usuario (email, password)
 */
export const loginUser = (credentials) => {
    return axios.post(`${API_URL}/login`, credentials);
};

/**
 * Verificar MFA (si implementas MFA en el backend)
 * @param {string} code - Código de MFA
 * @param {string} token - Token JWT
 */
export const verifyMFA = (code, token) => {
    return axios.post(`${API_URL}/mfa/verify`, { code }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

/**
 * Configurar MFA (si implementas MFA en el backend)
 * @param {string} token - Token JWT
 */
export const setupMFA = (token) => {
    return axios.post(`${API_URL}/mfa/setup`, {}, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

/**
 * Iniciar sesión con OAuth (Google)
 */
export const oauthLogin = () => {
    window.location.href = `${API_URL}/google`;
};
