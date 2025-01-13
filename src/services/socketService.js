// src/services/socketService.js

import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

let socket = null;

export const initSocket = (userId) => {
    console.log("SOCKET (init): ", socket);

    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ['websocket'],
        });
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
