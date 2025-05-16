// src/context/AuthProvider.js

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
// Ojo: Asegúrate de usar la librería "jwt-decode" real.
// (Aquí la variable se llama "jwtDecode" pero asegúrate de tener "npm install jwt-decode")
import { jwtDecode } from 'jwt-decode';

import { loginUser } from '../services/authService';
import { initSocket, closeSocket } from '../services/socketService';

export const AuthContext = createContext();

const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [initialLoad, setInitialLoad] = useState(true);

    const [auth, setAuth] = useState({
        user: null,
        token: null,
        // Podrías guardar passwordExpired aquí, si quieres chequearlo en otras partes:
        // passwordExpired: false,
    });

    const [lastActivity, setLastActivity] = useState(Date.now());

    const resetTimer = useCallback(() => {
        setLastActivity(Date.now());
    }, []);

    useEffect(() => {
        const checkIdle = () => {
            const now = Date.now();
            if (auth.token && now - lastActivity > IDLE_TIMEOUT_MS) {
                logout();
            }
        };
        const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [auth.token, lastActivity]);

    useEffect(() => {
        const events = ['mousemove','mousedown','touchstart','keydown','scroll'];
        events.forEach((evt) => {
            window.addEventListener(evt, resetTimer, true);
        });
        return () => {
            events.forEach((evt) => {
                window.removeEventListener(evt, resetTimer, true);
            });
        };
    }, [resetTimer]);

    // Al montar, revisamos si hay token en localStorage
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            try {
                const decoded = jwtDecode(storedToken);
                if (decoded.exp * 1000 < Date.now()) {
                    localStorage.removeItem('token');
                } else {
                    setAuth({
                        user: { ...decoded, roleId: decoded.roleId },
                        token: storedToken,
                    });
                }
            } catch (error) {
                console.error('Token inválido:', error);
                localStorage.removeItem('token');
            }
        }

        // Revisar si hay ?token= en la URL (caso OAuth) ...
        const params = new URLSearchParams(location.search);
        const tokenFromOAuth = params.get('token');
        if (tokenFromOAuth) {
            try {
                const decoded = jwtDecode(tokenFromOAuth);
                localStorage.setItem('token', tokenFromOAuth);
                setAuth({
                    user: { ...decoded, roleId: decoded.roleId },
                    token: tokenFromOAuth,
                });
            } catch (error) {
                console.error('Token OAuth inválido:', error);
            }
        }

        setInitialLoad(false);
    }, [location]);

    // Inicializar el socket si hay user
    useEffect(() => {
        if (auth.user?.id) {
            initSocket(auth.user.id);
        }
    }, [auth.user]);

    // Nueva función login con passwordExpired
    const loginUpdateParentsInfo = async (email, password) => {
        try {
            // Llamamos a loginUser => /api/auth/login
            const response = await loginUser({ email, password });
            const { token, passwordExpired } = response.data; // <--- AQUÍ leemos passwordExpired

            const decoded = jwtDecode(token);

            // Si su rol no es Padres:
            const restrictedRoles = [3]; // Por ejemplo
            if (!restrictedRoles.includes(decoded.roleId)) {
                const userName = decoded.name || 'Usuario';
                throw new Error(`Para tu usuario ${userName}, solo acceso desde la página principal.`);
            }

            // Guardar en localStorage
            localStorage.setItem('token', token);

            // Actualizar estado
            setAuth({
                user: { ...decoded, roleId: decoded.roleId },
                token
            });

            // Retornar passwordExpired para que la LoginPage decida redirigir
            return { passwordExpired };
        } catch (error) {
            // Manejo de error: devolvemos error
            throw error;
        }
    };

    // Nueva función login con passwordExpired
    const login = async (email, password) => {
        try {
            // Llamamos a loginUser => /api/auth/login
            const response = await loginUser({ email, password });
            const { token, passwordExpired } = response.data; // <--- AQUÍ leemos passwordExpired

            const decoded = jwtDecode(token);

            // Si su rol es Piloto o Monitora, etc. (el check que tenías):
            const restrictedRoles = [3, 4, 5]; // Por ejemplo
            if (restrictedRoles.includes(decoded.roleId)) {
                const userName = decoded.name || 'Usuario';
                throw new Error(`Para tu usuario ${userName}, solo acceso desde la app móvil.`);
            }

            // Guardar en localStorage
            localStorage.setItem('token', token);

            // Actualizar estado
            setAuth({
                user: { ...decoded, roleId: decoded.roleId },
                token
            });

            // Retornar passwordExpired para que la LoginPage decida redirigir
            return { passwordExpired };
        } catch (error) {
            // Manejo de error: devolvemos error
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        closeSocket();
        setAuth({ user: null, token: null });
        navigate('/login');
    };

    const verifyToken = async () => {
        try {
            const response = await axios.get('/auth/verify', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            setAuth({
                user: {
                    ...response.data.user,
                    roleId: response.data.user.roleId,
                },
                token: auth.token,
            });
        } catch (error) {
            console.error('Token inválido o expirado:', error);
            logout();
        }
    };

    const value = {
        auth,
        initialLoad,
        loginUpdateParentsInfo,
        login,
        logout,
        verifyToken,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
