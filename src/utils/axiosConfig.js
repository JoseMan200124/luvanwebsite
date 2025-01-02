// axiosConfig.js
import axios from 'axios';

const API_URL = 'https://34.56.161.166/api';

// Crear una instancia de Axios con la configuración base
const api = axios.create({
    baseURL: API_URL,
});

// Opcional: Configurar interceptores para manejar tokens u otras configuraciones globales
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); // O de donde obtengas el token
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
