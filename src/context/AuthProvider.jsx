// src/context/AuthProvider.jsx

import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Importación nombrada para versión 4.x
import { useNavigate, useLocation } from 'react-router-dom';
import { loginUser, registerUser } from '../services/authService';
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
        // Verificar si hay un token en el localStorage
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                // Verificar si el token ha expirado
                if (decoded.exp * 1000 < Date.now()) {
                    localStorage.removeItem('token');
                } else {
                    setAuth({
                        user: decoded,
                        token,
                    });
                }
            } catch (error) {
                console.error('Token inválido:', error);
                localStorage.removeItem('token');
            }
        }

        // Manejar redirección después de OAuth (si aplica)
        const params = new URLSearchParams(location.search);
        const tokenFromOAuth = params.get('token');
        if (tokenFromOAuth) {
            try {
                const decoded = jwtDecode(tokenFromOAuth);
                localStorage.setItem('token', tokenFromOAuth);
                setAuth({
                    user: decoded,
                    token: tokenFromOAuth,
                });
                navigate('/');
            } catch (error) {
                console.error('Token OAuth inválido:', error);
            }
        }
    }, [location, navigate]);

    /**
     * Función para iniciar sesión
     * @param {string} email - Correo electrónico del usuario
     * @param {string} password - Contraseña del usuario
     */
    const login = async (email, password) => {
        try {
            const response = await loginUser({ email, password });
            const { token } = response.data;
            const decoded = jwtDecode(token);
            localStorage.setItem('token', token);
            setAuth({
                user: decoded,
                token,
            });
        } catch (error) {
            // Re-throw para manejar en el componente
            throw error;
        }
    };

    /**
     * Función para registrar un nuevo usuario
     * @param {Object} userData - Datos del usuario (name, email, password, roleName)
     */
    const register = async (userData) => {
        try {
            const response = await registerUser(userData);
            const { token } = response.data; // Si el backend retorna un token al registrar
            if (token) {
                const decoded = jwtDecode(token);
                localStorage.setItem('token', token);
                setAuth({
                    user: decoded,
                    token,
                });
            }
            return response.data;
        } catch (error) {
            // Re-throw para manejar en el componente
            throw error;
        }
    };

    /**
     * Función para cerrar sesión
     */
    const logout = () => {
        localStorage.removeItem('token');
        setAuth({
            user: null,
            token: null,
        });
        navigate('/login');
    };

    /**
     * Función para verificar el token y obtener información del usuario
     */
    const verifyToken = async () => {
        try {
            const response = await axios.get('/api/auth/verify', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setAuth({
                user: response.data.user,
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
        register,
        logout,
        verifyToken,
        setAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
