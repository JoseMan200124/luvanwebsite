// src/context/AuthProvider.jsx

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/axiosConfig';
import { jwtDecode } from 'jwt-decode';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import { loginUser } from '../services/authService';
import { initSocket, closeSocket } from '../services/socketService';

export const AuthContext = createContext();

const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos
const CHECK_INTERVAL_MS = 30 * 1000;
const SILENT_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [initialLoad, setInitialLoad] = useState(true);
    const [auth, setAuth] = useState({ user: null, token: null });
    const [showIdleSnackbar, setShowIdleSnackbar] = useState(false);

    // lastActivity se sincroniza entre pestañas vía localStorage
    const [lastActivity, setLastActivity] = useState(() => {
        try { const stored = localStorage.getItem('lastActivity'); return stored ? Number(stored) : Date.now(); }
        catch (e) { return Date.now(); }
    });

    const setSharedLastActivity = useCallback((ts) => {
        try { localStorage.setItem('lastActivity', String(ts)); } catch (e) {}
        setLastActivity(ts);
    }, []);

    const resetTimer = useCallback(() => setSharedLastActivity(Date.now()), [setSharedLastActivity]);

    const logout = useCallback(() => {
        try { localStorage.removeItem('token'); localStorage.removeItem('refreshToken'); } catch (e) {}
        closeSocket(); setAuth({ user: null, token: null }); navigate('/login');
    }, [navigate]);

    const logoutByIdle = useCallback(() => {
        try { localStorage.removeItem('token'); localStorage.removeItem('refreshToken'); } catch (e) {}
        closeSocket(); setAuth({ user: null, token: null }); setShowIdleSnackbar(true); navigate('/login');
    }, [navigate]);

    const silentRefreshIfNeeded = useCallback(async () => {
        try {
            const token = localStorage.getItem('token'); if (!token) return;
            const decoded = jwtDecode(token); const msLeft = decoded.exp * 1000 - Date.now();
            if (msLeft < SILENT_REFRESH_THRESHOLD_MS) {
                const refreshToken = localStorage.getItem('refreshToken'); if (!refreshToken) return;
                const res = await api.post('/auth/refresh', { refreshToken });
                const { token: newToken, refreshToken: newRefresh } = res.data;
                if (newToken) { localStorage.setItem('token', newToken); if (newRefresh) localStorage.setItem('refreshToken', newRefresh); setAuth(prev => ({ ...prev, token: newToken })); }
            }
        } catch (err) {
            try { localStorage.removeItem('token'); localStorage.removeItem('refreshToken'); } catch (e) {}
            logout();
        }
    }, [logout]);

    // Permisos ahora se cargan exclusivamente en PermissionsProvider

    useEffect(() => {
        const checkIdle = () => { const now = Date.now(); if (auth.token && now - lastActivity > IDLE_TIMEOUT_MS) logoutByIdle(); };
        const interval = setInterval(checkIdle, CHECK_INTERVAL_MS); return () => clearInterval(interval);
    }, [auth.token, lastActivity, logoutByIdle]);

    useEffect(() => {
        const events = ['mousemove','mousedown','touchstart','keydown','scroll'];
        events.forEach(evt => { window.addEventListener(evt, resetTimer, true); window.addEventListener(evt, silentRefreshIfNeeded, true); });

        const onStorage = (e) => {
            if (e.key === 'lastActivity' && e.newValue) { setLastActivity(Number(e.newValue)); }
            if (e.key === 'token' && e.newValue == null) { logout(); }
            if (e.key === 'refreshToken' && e.newValue == null) { logout(); }
        };
        window.addEventListener('storage', onStorage);
        
        // Escuchar evento de sesión invalidada desde axiosConfig
        const onSessionInvalidated = (event) => {
            console.log('[AuthProvider] Sesión invalidada:', event.detail?.message);
            logout();
        };
        window.addEventListener('sessionInvalidated', onSessionInvalidated);

        return () => { 
            events.forEach(evt => { window.removeEventListener(evt, resetTimer, true); window.removeEventListener(evt, silentRefreshIfNeeded, true); }); 
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('sessionInvalidated', onSessionInvalidated);
        };
    }, [resetTimer, silentRefreshIfNeeded, logout]);

    // On mount, restore token if valid
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                const decoded = jwtDecode(storedToken);
                if (decoded.exp * 1000 >= Date.now()) {
                    setAuth({ user: { ...decoded, roleId: decoded.roleId }, token: storedToken });
                } else {
                    localStorage.removeItem('token');
                }
            }
            const params = new URLSearchParams(location.search); const tokenFromOAuth = params.get('token');
            if (tokenFromOAuth) {
                const decoded = jwtDecode(tokenFromOAuth);
                localStorage.setItem('token', tokenFromOAuth);
                setAuth({ user: { ...decoded, roleId: decoded.roleId }, token: tokenFromOAuth });
            }
        } catch (e) { localStorage.removeItem('token'); }
        setInitialLoad(false);
    }, [location]);

    useEffect(() => { if (auth.user?.id) initSocket(auth.user.id); }, [auth.user]);

    // login functions
    const loginUpdateParentsInfo = async (email, password) => {
        try {
            const response = await loginUser({ email, password });
            const { token, passwordExpired, refreshToken } = response.data; const decoded = jwtDecode(token);
            const restrictedRoles = [3, 8]; // allow Padres (3) and Colaboradores (8) to use this dialog
            if (!restrictedRoles.includes(decoded.roleId)) throw new Error(`Para tu usuario ${(decoded.name||'Usuario')}, solo acceso desde la página principal.`);
            localStorage.setItem('token', token); if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
            setAuth({ user: { ...decoded, roleId: decoded.roleId }, token });
            return { passwordExpired, roleId: decoded.roleId };
        } catch (error) { throw error; }
    };

    const login = async (email, password) => {
        try {
            const response = await loginUser({ email, password });
            const { token, passwordExpired, refreshToken } = response.data; const decoded = jwtDecode(token);
            const restrictedRoles = [4,5]; if (restrictedRoles.includes(decoded.roleId)) throw new Error(`Para tu usuario ${(decoded.name||'Usuario')}, solo acceso desde la app móvil.`);
            localStorage.setItem('token', token); if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
            setAuth({ user: { ...decoded, roleId: decoded.roleId }, token });
            return { passwordExpired, roleId: decoded.roleId };
        } catch (error) { throw error; }
    };

    const verifyToken = async () => {
        try { 
            const response = await api.get('/auth/verify', { headers: { Authorization: `Bearer ${auth.token}` } }); 
            setAuth(prev => ({ 
                ...prev, 
                user: { ...response.data.user, roleId: response.data.user.roleId }, 
                token: auth.token 
            })); 
        }
        catch (error) { logout(); }
    };

    const value = { auth, initialLoad, loginUpdateParentsInfo, login, logout, verifyToken };

    return (
        <AuthContext.Provider value={value}>
            {children}
            <Snackbar open={showIdleSnackbar} onClose={() => setShowIdleSnackbar(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                <Alert severity="warning" sx={{ width: '100%' }}>El tiempo de inactividad venció. Vuelva a iniciar sesión.</Alert>
            </Snackbar>
        </AuthContext.Provider>
    );
};

export default AuthProvider;
        
