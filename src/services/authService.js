// src/services/authService.js
import api from '../utils/axiosConfig';

export const loginUser = (credentials) => {
    return api.post('/auth/login', credentials);
};
