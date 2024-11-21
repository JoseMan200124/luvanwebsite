// src/context/AuthProvider.jsx

import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Importación nombrada
import { useNavigate, useLocation } from 'react-router-dom';

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

    const login = async (email, password) => {
        // Simular el login para el usuario específico
        return new Promise((resolve, reject) => {
            // Definir las credenciales simuladas
            const validEmail = 'prueba@correo.com';
            const validPassword = '12345';

            if (email === validEmail && password === validPassword) {
                // Token JWT simulado
                const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
                    'eyJuYW1lIjoiSnVhbiBNLiBBbmNhc3RlIiwiZW1haWwiOiJqbWFuY2FzdGVAZ21haWwuY29tIiwicm9sZSI6IkFkbWluaXN0cmFkb3IiLCJleHAiOjk5OTk5OTk5OTl9.' +
                    'dummy-signature';

                // Decodificar el token
                const decoded = jwtDecode(mockToken);

                // Almacenar el token en localStorage
                localStorage.setItem('token', mockToken);

                // Actualizar el estado de autenticación
                setAuth({
                    user: decoded,
                    token: mockToken,
                });

                // Redirigir al dashboard o página principal
                navigate('/');
                resolve();
            } else {
                // Credenciales incorrectas
                reject({ response: { data: { message: 'Correo o contraseña incorrectos' } } });
            }
        });
    };

    const register = async (userData) => {
        // Simular el registro como no disponible
        return new Promise((resolve, reject) => {
            reject({ response: { data: { message: 'Registro no disponible en esta simulación' } } });
        });
    };

    const logout = () => {
        localStorage.removeItem('token');
        setAuth({
            user: null,
            token: null,
        });
        navigate('/login');
    };

    const value = {
        auth,
        login,
        register,
        logout,
        setAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
