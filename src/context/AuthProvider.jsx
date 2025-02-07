// src/context/AuthProvider.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
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
        const events = [
            'mousemove',
            'mousedown',
            'touchstart',
            'keydown',
            'scroll',
        ];
        events.forEach((evt) => {
            window.addEventListener(evt, resetTimer, true);
        });
        return () => {
            events.forEach((evt) => {
                window.removeEventListener(evt, resetTimer, true);
            });
        };
    }, [resetTimer]);

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
                // navigate('/admin/dashboard');
            } catch (error) {
                console.error('Token OAuth inválido:', error);
            }
        }

        setInitialLoad(false);
    }, [location]);

    useEffect(() => {
        if (auth.user?.id) {
            initSocket(auth.user.id);
        }
    }, [auth.user]);

    const login = async (email, password) => {
        try {
            const response = await loginUser({ email, password });
            const { token } = response.data;
            const decoded = jwtDecode(token);

            const restrictedRoles = [3, 4, 5];
            if (restrictedRoles.includes(decoded.roleId)) {
                const userName = decoded.name || 'Usuario';
                throw new Error(`Para tu usuario ${userName}, solo acceso desde la app móvil.`);
            }

            localStorage.setItem('token', token);
            setAuth({
                user: { ...decoded, roleId: decoded.roleId },
                token,
            });
        } catch (error) {
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
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
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
        login,
        logout,
        verifyToken,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
