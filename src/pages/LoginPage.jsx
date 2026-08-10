import React, { useContext, useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import ForgotPasswordModal from '../components/modals/ForgotPasswordModal';
import logoLuvan from '../assets/img/logo-sin-fondo.png';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import {
    getDefaultPathForRole,
    isSchoolContextRequiredRole,
    normalizeSchoolContext,
    setStoredSchoolContext,
} from '../utils/schoolContext';
import './LoginPage.css';

const LoginPage = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');

    useEffect(() => {
        document.title = 'Iniciar Sesión · Transportes Luvan';
    }, []);

    const handleOpenModal = (event) => {
        event.preventDefault();
        setIsModalOpen(true);
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));
    };

    const handleSnackbarClose = (_event, reason) => {
        if (reason !== 'clickaway') setOpenSnackbar(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSnackbarMessage('');
        setSnackbarSeverity('success');

        const trimmedEmail = formData.email.trim();
        if (!trimmedEmail || !formData.password) {
            setError('Por favor, completa todos los campos.');
            return;
        }

        try {
            const { passwordExpired, roleId } = await login(trimmedEmail, formData.password);

            if (passwordExpired) {
                navigate('/force-password-change');
                return;
            }

            const targetPath = getDefaultPathForRole(roleId);

            if (isSchoolContextRequiredRole(roleId)) {
                const contextsResponse = await api.get('/auth/me/contexts', { skipSchoolCycleContext: true });
                const contexts = Array.isArray(contextsResponse.data?.contexts)
                    ? contextsResponse.data.contexts
                        .map(normalizeSchoolContext)
                        .filter((context) => context.schoolId && context.cicloEscolarId)
                    : [];

                if (contexts.length === 1) {
                    setStoredSchoolContext(contexts[0]);
                    navigate(targetPath);
                } else if (contexts.length > 1) {
                    navigate('/select-context', { replace: true, state: { nextPath: targetPath, forceChoice: true } });
                } else {
                    // No school contexts: attempt corporation fallback (users assigned to a corporation)
                    try {
                        const verifyResp = await api.get('/auth/verify');
                        const corpId = verifyResp.data?.user?.corporationId;
                        if (corpId) {
                            // Redirect corporate users to the existing corporations page (filtered by backend)
                            navigate('/admin/corporaciones', { replace: true });
                            setSnackbarMessage('¡Inicio de sesión exitoso!');
                            setSnackbarSeverity('success');
                            setOpenSnackbar(true);
                            return;
                        }
                    } catch (err) {
                        // ignore and fall through to original error
                    }

                    throw new Error('Tu usuario no tiene un colegio o ciclo escolar activo asignado. Contacta al administrador.');
                }

                setSnackbarMessage('¡Inicio de sesión exitoso!');
                setSnackbarSeverity('success');
                setOpenSnackbar(true);
                return;
            }

            navigate(targetPath);
            setSnackbarMessage('¡Inicio de sesión exitoso!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
        } catch (loginError) {
            const customMessage = loginError.message || 'Error en el inicio de sesión. Por favor, intenta nuevamente.';
            setError(customMessage);
            setSnackbarMessage(customMessage);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        }
    };

    return (
        <main className="luvan-login">
            <div className="luvan-login-split">
                <section className="luvan-login-left">
                    <Link to="/" className="luvan-login-logo" aria-label="Volver a Transportes Luvan">
                        <img src={logoLuvan} alt="Transportes Luvan" />
                    </Link>

                    <div className="luvan-login-mid">
                        <span className="luvan-login-eyebrow">Portal de clientes</span>
                        <h1>Transportes Luvan</h1>
                        <p>Soluciones de transporte seguras y confiables. Accede a tu cuenta para gestionar tus servicios.</p>
                    </div>

                    <Link to="/" className="luvan-login-back">← Volver al sitio</Link>
                </section>

                <section className="luvan-login-right">
                    <div className="luvan-login-card">
                        <div className="luvan-login-top">
                            <img src={logoLuvan} alt="Transportes Luvan" />
                            <h2>Iniciar Sesión</h2>
                            <p>Bienvenido de nuevo</p>
                        </div>

                        {error && <p className="luvan-login-error" role="alert">{error}</p>}

                        <form onSubmit={handleSubmit}>
                            <div className="luvan-login-field">
                                <label htmlFor="email">Correo electrónico</label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    required
                                    placeholder="tucorreo@ejemplo.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="luvan-login-field">
                                <label htmlFor="pass">Contraseña</label>
                                <input
                                    id="pass"
                                    type="password"
                                    name="password"
                                    autoComplete="current-password"
                                    required
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            <a href="#forgot-password" className="luvan-login-forgot" onClick={handleOpenModal}>¿Olvidaste tu contraseña?</a>
                            <button type="submit" className="luvan-login-btn">Ingresar</button>
                        </form>

                        <div className="luvan-login-alt">¿No tienes cuenta? <a href="/#contacto">Contáctanos</a></div>
                    </div>
                </section>
            </div>

            <ForgotPasswordModal open={isModalOpen} handleClose={() => setIsModalOpen(false)} />

            <Snackbar
                open={openSnackbar}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </main>
    );
};

export default LoginPage;
