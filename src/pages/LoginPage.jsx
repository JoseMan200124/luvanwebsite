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
    Box
} from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import ForgotPasswordModal from '../components/modals/ForgotPasswordModal';
import { useNavigate } from 'react-router-dom';
import { keyframes } from 'styled-components';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import logoLuvan from '../assets/img/logo-sin-fondo.png';

// (Opcionales) Animaciones
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

/* Contenedores principales */
const LoginContainer = tw.div`flex flex-col md:flex-row flex-grow min-h-screen`;

const LeftSection = styled.div`
    ${tw`flex flex-col items-center justify-center bg-gray-800 text-white md:w-1/2 p-8 relative overflow-hidden`}
`;

const RightSection = tw.div`flex flex-col items-center justify-center bg-[rgb(31,29,29)] md:w-1/2 p-8`;

/* Textos de la parte izquierda */
const Title = styled(Typography)`
    ${tw`text-center font-bold mb-2`}
    color: #FFFFFF;
`;

const Slogan = styled(Typography)`
    ${tw`text-center text-lg mt-2`}
    color: #FFFFFF;
`;

/* Logo */
const Logo = styled.img`
    ${tw`h-20 w-auto mb-4`}
`;

/* Contenedor principal del formulario */
const LoginFormContainer = styled.div`
    ${tw`relative bg-gray-50 rounded-lg p-8 shadow-lg w-full max-w-md mx-auto flex flex-col items-center`}
`;

const FormTitleTab = styled.div`
    ${tw`absolute -top-6 left-1/2 transform -translate-x-1/2 px-6 py-2 bg-green-600 rounded-t-md`}
`;

const FormTitle = tw(Typography)`text-white font-semibold`;

/* Campos del formulario */
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

const OAuthButton = styled(Button)`
    ${tw`bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 mt-4 flex items-center justify-center rounded shadow`}
`;

const ErrorMessage = styled(Typography)`
    ${tw`mb-4 text-center text-red-600`}
`;

/* Snackbar con animación */
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
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
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
            setSnackbarMessage('¡Inicio de sesión exitoso!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            navigate('/admin/dashboard');
        } catch (err) {
            const customMessage = err.message || 'Error en el inicio de sesión. Por favor, intenta nuevamente.';
            setError(customMessage);
            setSnackbarMessage(customMessage);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        }
    };

    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenSnackbar(false);
    };

    const handleGoogleLogin = () => {
        window.location.href = '/auth/google';
    };

    return (
        <Box tw="flex flex-col min-h-screen">
            <Navbar />

            <LoginContainer>
                {/* Sección izquierda con Título y Slogan */}
                <LeftSection>
                    <Title variant="h4">Transportes Luvan</Title>
                    <Slogan variant="subtitle1">
                        Soluciones de Transporte Escolar Seguras y Confiables
                    </Slogan>
                </LeftSection>

                {/* Sección derecha con el formulario */}
                <RightSection>
                    <LoginFormContainer>
                        {/* Pestaña verde con el título "Iniciar Sesión" */}
                        <FormTitleTab>
                            <FormTitle variant="h6">Iniciar Sesión</FormTitle>
                        </FormTitleTab>

                        {/* Logo centrado */}
                        <Logo src={logoLuvan} alt="Transportes Luvan" />

                        {/* Mensaje de error, si corresponde */}
                        {error && (
                            <ErrorMessage variant="body1">
                                {error}
                            </ErrorMessage>
                        )}

                        {/* Formulario con margen superior para separarlo del logo */}
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
