// src/services/socketService.js

import { io } from 'socket.io-client';
import api from '../utils/axiosConfig';

// El socket vive en el mismo servidor que la API: se toma el origen de la baseURL de
// axios (https://api.transportesluvan.com/api -> https://api.transportesluvan.com),
// así hay un solo lugar que cambiar entre local y producción.
const SOCKET_URL = new URL(api.defaults.baseURL).origin;

let socket = null;
let visibilityHandlerAttached = false;

// Pestaña oculta: se corta el socket (y sus reintentos). Al volver, se reconecta una sola vez.
const attachVisibilityHandler = () => {
    if (visibilityHandlerAttached) return;
    visibilityHandlerAttached = true;
    document.addEventListener('visibilitychange', () => {
        if (!socket) return;
        if (document.hidden) {
            socket.disconnect();
        } else if (!socket.connected) {
            socket.connect();
        }
    });
};

export const initSocket = (userId) => {
    console.log("SOCKET (init): ", socket);

    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ['websocket'],
            // Reintentos acotados: sin esto, si el backend no responde se acumulan
            // handshakes colgados que agotan el pool de conexiones del navegador
            // y congelan todos los requests al mismo host.
            timeout: 10000,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.5,
        });
        attachVisibilityHandler();
        console.log("SOCKET (io created): ", socket);

        socket.on('connect', () => {
            console.log('Conectado al socket:', socket.id);
            if (userId) {
                socket.emit('registerUser', userId);
            }
        });

        socket.on('connect_error', (err) => {
            console.error('Error de conexión socket:', err);
        });
    }
    return socket;
};

export const getSocket = () => {
    return socket;
};

// NUEVO: Cerrar o destruir la conexión
export const closeSocket = () => {
    if (socket) {
        console.log("[closeSocket] Desconectando socket:", socket.id);
        socket.disconnect();
        socket = null;
    }
};
