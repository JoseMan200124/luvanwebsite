// src/context/AuthProvider.js

import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../services/authService';
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

    const login = async (email, password) => {
        try {
            const response = await loginUser({ email, password });
            const { token } = response.data;
            const decoded = jwtDecode(token);
            localStorage.setItem('token', token);
            setAuth({
                user: {
                    ...decoded,
                    roleId: decoded.roleId,
                },
                token,
            });
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
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
