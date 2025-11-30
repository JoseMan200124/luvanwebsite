import React, { useState, useContext } from 'react';
import tw, { styled } from 'twin.macro';
import {
    Dialog,
    Typography,
    TextField,
    Button,
    Snackbar,
    Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthProvider';

import api from '../../utils/axiosConfig';
import logoLuvan from '../../assets/img/logo-sin-fondo.png';

const Logo = styled.img`
    ${tw`h-20 w-auto my-4`}
`;

const LoginFormContainer = styled.div`
    ${tw`relative bg-gray-50 rounded-lg shadow-lg w-full max-w-md mx-auto flex flex-col items-center pt-12 pb-8 px-8`}
`;

const StyledTextField = styled(TextField)`
    & .MuiInputBase-root {
        ${tw`bg-white rounded`}
    }
    & .MuiInputLabel-root {
        ${tw`text-gray-600`}
    }
    & .MuiInputBase-input::placeholder {
        ${tw`text-gray-400`}
    }
`;

const LoginButton = styled(Button)`
    ${tw`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 mt-4 rounded`}
`;

const ErrorMessage = styled(Typography)`
    ${tw`mb-4 text-center text-red-600`}
`;

const LoginModal = ({ open, onClose, onLoginSuccess }) => {
    const { loginUpdateParentsInfo } = useContext(AuthContext);
    const navigate = useNavigate();

    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedEmail = formData.email.trim();
        if (!trimmedEmail || !formData.password) {
            setError('Por favor, completa todos los campos.');
            return;
        }

        try {
            // Llamamos a login del AuthContext
            // Este login internamente hace la petición a /api/auth/login
            // y ya maneja el storage del token.
            const { passwordExpired, roleId } = await loginUpdateParentsInfo(trimmedEmail, formData.password);

            // Si el backend nos dice que la contraseña ha expirado:
            if (passwordExpired) {
                navigate('/force-password-change');
                return;
            }

            setSnackbar({
                open: true,
                message: '¡Inicio de sesión exitoso!',
                severity: 'success',
            });
            // Llamar al endpoint de prefill según el rol: Padres => update-parent-info, Colaboradores => update-colaborador-info
            let response;
            try {
                if (Number(roleId) === 8) {
                    response = await api.get('/update-colaborador-info', { params: { email: trimmedEmail } });
                } else {
                    response = await api.get('/update-parent-info', { params: { email: trimmedEmail } });
                }
            } catch (err) {
                // If prefill endpoint returned 404, surface a friendly message but allow login success flow
                console.warn('[LoginModal] Prefill endpoint returned error:', err?.response?.status || err.message);
                throw err;
            }

            const userData = response.data;
            onLoginSuccess(userData); // Pasar los datos del usuario al componente principal
            onClose();

        } catch (err) {
            const customMessage = err.message || 'Error en el inicio de sesión. Por favor, intenta nuevamente.';
            setError(customMessage);
        }
    };

    return (
        <>
            <Dialog open={open}>
                <LoginFormContainer>
                        <Logo src={logoLuvan} alt="Transportes Luvan" />

                        {error && (
                            <ErrorMessage variant="body1">
                                {error}
                            </ErrorMessage>
                        )}

                        <form tw="mt-6 w-full" onSubmit={handleSubmit}>
                            <StyledTextField
                                label="Correo Electrónico"
                                variant="outlined"
                                fullWidth
                                margin="normal"
                                placeholder="ejemplo@correo.com"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                aria-label="Correo Electrónico"
                            />
                            <StyledTextField
                                label="Contraseña"
                                type="password"
                                variant="outlined"
                                fullWidth
                                margin="normal"
                                placeholder="••••••••"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                aria-label="Contraseña"
                            />

                            <LoginButton
                                type="submit"
                                variant="contained"
                                fullWidth
                                size="large"
                            >
                                Ingresar
                            </LoginButton>
                        </form>
                    </LoginFormContainer>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default LoginModal;