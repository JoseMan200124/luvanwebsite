// src/pages/LoginPage.jsx

import React, { useState, useContext } from 'react';
import tw, { styled } from 'twin.macro';
import {
    TextField,
    Button,
    Typography,
    Link,
    Divider,
    Snackbar,
    Alert,
    Box
} from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import ForgotPasswordModal from '../components/modals/ForgotPasswordModal';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { keyframes } from 'styled-components';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer'; // Importar el Footer
import logoLuvan from '../assets/img/logo-luvan.jpg'; // Asegúrate de tener el logo en esta ruta

// Animación para el fondo de la sección izquierda
const moveUp = keyframes`
    0% {
        background-position: center bottom;
    }
    100% {
        background-position: center top;
    }
`;

// Contenedor principal del login
const LoginContainer = tw.div`flex flex-col md:flex-row flex-grow min-h-screen`;

// Sección izquierda con fondo y contenido
const LeftSection = styled.div`
    ${tw`flex flex-col items-center justify-center bg-gray-900 text-white md:w-1/2 p-8 relative overflow-hidden`}
    &::before {
        content: '';
        ${tw`absolute inset-0`}
        background-image: url('data:image/svg+xml;charset=UTF-8,<svg width="200" height="600" xmlns="http://www.w3.org/2000/svg"><text x="0" y="200" font-size="200" fill="%232D966C20">🚍</text><text x="0" y="400" font-size="200" fill="%232D966C20">📚</text><text x="0" y="600" font-size="200" fill="%232D966C20">🎒</text></svg>');
        background-repeat: repeat-y;
        background-size: contain;
        animation: ${moveUp} 30s linear infinite;
    }
`;

// Logo en la sección izquierda
const Logo = styled.img`
    ${tw`h-20 mb-4`}
`;

// Eslogan en la sección izquierda
const Slogan = tw(Typography)`text-center text-lg mt-2`;

// Sección derecha con formulario de login
const RightSection = tw.div`flex flex-col items-center justify-center bg-white md:w-1/2 p-8`;

// Contenedor del formulario de login
const LoginFormContainer = styled.div`
    ${tw`bg-gray-50 rounded-lg p-8 shadow-lg relative w-full max-w-md`}
`;

// Pestaña de título del formulario
const FormTitleTab = styled.div`
    ${tw`absolute -top-6 left-1/2 transform -translate-x-1/2 px-6 py-2 bg-green-600 rounded-t-md`}
`;

// Texto de la pestaña
const FormTitle = tw(Typography)`text-white font-semibold`;

// Campo de texto personalizado
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

// Enlace de "Olvidé mi contraseña"
const ForgotPasswordLink = styled(Link)`
    ${tw`text-green-600 mt-4 mb-6 text-right underline cursor-pointer`}
`;

// Botón de login personalizado
const LoginButton = styled(Button)`
    ${tw`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 mt-4 rounded`}
`;

// Botón de OAuth (Google) personalizado
const OAuthButton = styled(Button)`
    ${tw`bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 mt-4 flex items-center justify-center rounded shadow`}
`;

// Mensaje de error centrado
const ErrorMessage = styled(Typography)`
    ${tw`mb-4 text-center text-red-600`}
`;

// Animación de FadeIn para Snackbar
const fadeIn = keyframes`
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
`;

// Contenedor para Snackbar con animación
const AnimatedSnackbar = styled(Snackbar)`
    & .MuiAlert-root {
        animation: ${fadeIn} 0.5s ease-out;
    }
`;

const LoginPage = () => {
    const { login } = useContext(AuthContext); // Obtener la función de login del contexto
    const navigate = useNavigate(); // Hook para navegación programática
    const [isModalOpen, setIsModalOpen] = useState(false); // Estado para el modal de "Olvidé mi contraseña"
    const [formData, setFormData] = useState({
        email: '', // Correo vacío
        password: '', // Contraseña vacía
    }); // Estado para los datos del formulario
    const [error, setError] = useState(''); // Estado para mensajes de error
    const [openSnackbar, setOpenSnackbar] = useState(false); // Estado para Snackbar
    const [snackbarMessage, setSnackbarMessage] = useState(''); // Mensaje de Snackbar
    const [snackbarSeverity, setSnackbarSeverity] = useState('success'); // Severidad de Snackbar

    // Manejar la apertura del modal
    const handleOpenModal = (e) => {
        e.preventDefault();
        setIsModalOpen(true);
    };

    // Manejar el cierre del modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    // Manejar cambios en los campos del formulario
    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    // Manejar el envío del formulario
    const handleSubmit = async (e) => {
        e.preventDefault(); // Evita la recarga de la página
        setError('');
        setSnackbarMessage('');
        setSnackbarSeverity('success');

        // Validación básica de los campos
        if (!formData.email || !formData.password) {
            setError('Por favor, completa todos los campos.');
            return;
        }

        try {
            await login(formData.email, formData.password); // Llamar a la función de login
            setSnackbarMessage('¡Inicio de sesión exitoso!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            navigate('/admin/dashboard'); // Redirigir al dashboard tras un login exitoso
        } catch (err) {
            // Manejar errores de autenticación
            setError(err.response?.data?.message || 'Error en el inicio de sesión. Por favor, intenta nuevamente.');
            setSnackbarMessage(err.response?.data?.message || 'Error en el inicio de sesión. Por favor, intenta nuevamente.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        }
    };

    // Manejar el cierre de Snackbar
    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenSnackbar(false);
    };

    // Manejar el inicio de sesión con Google
    const handleGoogleLogin = () => {
        // Redirigir al backend para iniciar OAuth con Google
        window.location.href = '/api/auth/google';
    };

    return (
        <Box tw="flex flex-col min-h-screen">
            {/* Navbar */}
            <Navbar />

            {/* Main Content */}
            <LoginContainer>
                {/* Sección Izquierda */}
                <LeftSection>
                    <Logo src={logoLuvan} alt="Transportes Luvan" />
                    <Typography variant="h4" tw="text-center font-bold mb-4">
                        Transportes Luvan
                    </Typography>
                    <Slogan variant="subtitle1">
                        Soluciones de Transporte Escolar Seguras y Confiables
                    </Slogan>
                </LeftSection>

                {/* Sección Derecha */}
                <RightSection>
                    <LoginFormContainer>
                        <FormTitleTab>
                            <FormTitle variant="h6">Iniciar Sesión</FormTitle>
                        </FormTitleTab>
                        {error && (
                            <ErrorMessage variant="body1">
                                {error}
                            </ErrorMessage>
                        )}
                        <form tw="mt-8" onSubmit={handleSubmit}>
                            {/* Campo de Correo Electrónico */}
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
                            {/* Campo de Contraseña */}
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
                            {/* Enlace para "Olvidé mi contraseña" */}
                            <ForgotPasswordLink href="#" variant="body2" onClick={handleOpenModal}>
                                ¿Olvidaste tu contraseña?
                            </ForgotPasswordLink>
                            {/* Botón de Ingreso */}
                            <LoginButton type="submit" variant="contained" fullWidth size="large">
                                Ingresar
                            </LoginButton>
                            {/* Divider */}
                            <Divider tw="my-4" />
                            {/* Botón de OAuth con Google */}
                            <OAuthButton onClick={handleGoogleLogin}>
                                <GoogleIcon tw="mr-2" /> Iniciar Sesión con Google
                            </OAuthButton>
                        </form>
                    </LoginFormContainer>
                </RightSection>
            </LoginContainer>

            {/* Footer */}
            <Footer />

            {/* Modal de Olvidé mi Contraseña */}
            <ForgotPasswordModal open={isModalOpen} handleClose={handleCloseModal} />

            {/* Snackbar para retroalimentación */}
            <AnimatedSnackbar
                open={openSnackbar}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </AnimatedSnackbar>
        </Box>
    );

};

export default LoginPage;
