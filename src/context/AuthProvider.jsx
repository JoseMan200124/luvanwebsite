// src/context/AuthProvider.js
import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Asegúrate de instalar 'jwt-decode' con npm o yarn
import { useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { initSocket, closeSocket } from '../services/socketService';

import axios from 'axios';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [auth, setAuth] = useState({
        user: null,
        token: null,
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                if (decoded.exp * 1000 < Date.now()) {
                    localStorage.removeItem('token');
                } else {
                    setAuth({
                        user: {
                            ...decoded,
                            roleId: decoded.roleId,
                        },
                        token,
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
                    user: {
                        ...decoded,
                        roleId: decoded.roleId,
                    },
                    token: tokenFromOAuth,
                });
                navigate('/');
            } catch (error) {
                console.error('Token OAuth inválido:', error);
            }
        }
    }, [location, navigate]);

    useEffect(() => {
        console.log("AUTH USER: ", auth.user);
        if (auth.user?.id) {
            initSocket(auth.user.id);
        }
    }, [auth.user]);

    const login = async (email, password) => {
        try {
            const response = await loginUser({ email, password });
            const { token } = response.data;
            const decoded = jwtDecode(token);

            // Verificar si el roleId está en los roles restringidos
            const restrictedRoles = [3, 4, 5];
            if (restrictedRoles.includes(decoded.roleId)) {
                const userName = decoded.name || 'Usuario'; // Asegúrate de que el token incluya 'name'
                throw new Error(`Para tu usuario ${userName}, puedes acceder unicamente desde tu aplicación móvil.`);
            }
            console.log("DECODED: ", decoded);
            localStorage.setItem('token', token);
            setAuth({
                user: {
                    ...decoded,
                    roleId: decoded.roleId,
                },
                token,
            });
        } catch (error) {
            // Re-lanzar el error para que pueda ser manejado en el componente de login
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        closeSocket();
        setAuth({
            user: null,
            token: null,
        });
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
        login,
        logout,
        verifyToken,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
