// axiosConfig.js
import axios from 'axios';
import https from 'https'; // Importar el módulo HTTPS

const API_URL = 'https://34.56.161.166/api';

// Crear un agente HTTPS que deshabilite la validación del certificado
const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // Desactiva la validación del certificado
});

// Crear una instancia de Axios con la configuración base
const api = axios.create({
    baseURL: API_URL,
    httpsAgent, // Asignar el agente HTTPS personalizado
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
