// src/pages/LoginPage.jsx

import React, { useState, useContext } from 'react';
import tw, { styled } from 'twin.macro';
import {
    TextField,
    Button,
    Typography,
    Link,
    Snackbar,
    Alert,
    Box,
} from '@mui/material';
import { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ForgotPasswordModal from '../components/modals/ForgotPasswordModal';
import logoLuvan from '../assets/img/logo-sin-fondo.png';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { modules } from '../modules';

const moveUp = keyframes`
    0% {
        background-position: center bottom;
    }
    100% {
        background-position: center top;
    }
`;

const fadeIn = keyframes`
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
`;

// Contenedor principal que se adapta al alto de la pantalla
const LoginContainer = tw.div`flex flex-col md:flex-row flex-grow min-h-screen`;

// En desktop se muestra la sección izquierda, en móviles se oculta para centrar el formulario.
const LeftSection = styled.div`
    ${tw`hidden md:flex flex-col items-center justify-center bg-gray-800 text-white md:w-1/2 p-8 relative overflow-hidden`}
`;

// La sección derecha contendrá el formulario de inicio y se adapta ocupando todo el ancho en móviles.
const RightSection = styled.div`
    ${tw`flex flex-col items-center justify-center bg-[rgb(31,29,29)] md:w-1/2 p-8 flex-grow`}
`;

const Title = styled(Typography)`
    ${tw`text-center font-bold mb-2`}
    color: #ffffff;
`;

const Slogan = styled(Typography)`
    ${tw`text-center text-lg mt-2`}
    color: #ffffff;
`;

const Logo = styled.img`
    ${tw`h-20 w-auto mb-4`}
`;

const LoginFormContainer = styled.div`
    ${tw`relative bg-gray-50 rounded-lg p-8 shadow-lg w-full max-w-md mx-auto flex flex-col items-center`}
`;

const FormTitleTab = styled.div`
    ${tw`absolute -top-6 left-1/2 transform -translate-x-1/2 px-6 py-2 bg-green-600 rounded-t-md`}
`;

const FormTitle = tw(Typography)`text-white font-semibold`;

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

const ForgotPasswordLink = styled(Link)`
    ${tw`text-green-600 mt-4 mb-6 text-right underline cursor-pointer`}
`;

const LoginButton = styled(Button)`
    ${tw`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 mt-4 rounded`}
`;

const ErrorMessage = styled(Typography)`
    ${tw`mb-4 text-center text-red-600`}
`;

const AnimatedSnackbar = styled(Snackbar)`
    & .MuiAlert-root {
        animation: ${fadeIn} 0.5s ease-out;
    }
`;

const LoginPage = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [error, setError] = useState('');
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');

    const handleOpenModal = (e) => {
        e.preventDefault();
        setIsModalOpen(true);
    };
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenSnackbar(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSnackbarMessage('');
        setSnackbarSeverity('success');

        const trimmedEmail = formData.email.trim();

        if (!trimmedEmail || !formData.password) {
            setError('Por favor, completa todos los campos.');
            return;
        }

        try {
            await login(trimmedEmail, formData.password);

            const storedToken = localStorage.getItem('token');
            if (!storedToken) {
                throw new Error('No se encontró un token válido tras iniciar sesión.');
            }

            const tokenPayload = jwtDecode(storedToken);
            const roleId = tokenPayload.roleId;

            const res = await api.get(`/permissions/role/${roleId}`, {
                headers: { Authorization: `Bearer ${storedToken}` },
            });
            const permissions = res?.data?.permissions || {};

            if (permissions['dashboard']) {
                setSnackbarMessage('¡Inicio de sesión exitoso!');
                setSnackbarSeverity('success');
                setOpenSnackbar(true);

                navigate('/admin/dashboard');
            } else {
                let fallbackPath = '/admin';
                outerLoop: for (const module of modules) {
                    if (permissions[module.key]) {
                        for (const submodule of module.submodules) {
                            if (permissions[submodule.key]) {
                                fallbackPath = `/admin/${submodule.path}`;
                                break outerLoop;
                            }
                        }
                    }
                }

                setSnackbarMessage('¡Inicio de sesión exitoso!');
                setSnackbarSeverity('success');
                setOpenSnackbar(true);

                navigate(fallbackPath);
            }
        } catch (err) {
            const customMessage = err.message || 'Error en el inicio de sesión. Por favor, intenta nuevamente.';
            setError(customMessage);
            setSnackbarMessage(customMessage);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        }
    };

    return (
        <Box tw="flex flex-col min-h-screen">
            <Navbar />

            <LoginContainer>
                {/* Se muestra solo en desktop para una mejor experiencia en móviles */}
                <LeftSection>
                    <Title variant="h4">Transportes Luvan</Title>
                    <Slogan variant="subtitle1">
                        Soluciones de Transporte Escolar Seguras y Confiables
                    </Slogan>
                </LeftSection>

                <RightSection>
                    <LoginFormContainer>
                        <FormTitleTab>
                            <FormTitle variant="h6">Iniciar Sesión</FormTitle>
                        </FormTitleTab>

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

                            <ForgotPasswordLink
                                href="#"
                                variant="body2"
                                onClick={handleOpenModal}
                            >
                                ¿Olvidaste tu contraseña?
                            </ForgotPasswordLink>

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
                </RightSection>
            </LoginContainer>

            <Footer />

            <ForgotPasswordModal
                open={isModalOpen}
                handleClose={handleCloseModal}
            />

            <AnimatedSnackbar
                open={openSnackbar}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbarSeverity}
                    sx={{ width: '100%' }}
                >
                    {snackbarMessage}
                </Alert>
            </AnimatedSnackbar>
        </Box>
    );
};

export default LoginPage;
