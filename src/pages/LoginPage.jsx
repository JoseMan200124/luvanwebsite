// src/pages/LoginPage.jsx

import React, { useState, useContext } from 'react';
import tw from 'twin.macro';
import styled, { keyframes } from 'styled-components';
import {
    TextField,
    Button,
    Typography,
    Link,
    Divider,
} from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import ForgotPasswordModal from '../components/modals/ForgotPasswordModal';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const moveUp = keyframes`
    0% {
        background-position: center bottom;
    }
    100% {
        background-position: center top;
    }
`;

const LoginContainer = tw.div`flex flex-col md:flex-row h-screen`;
const LeftSection = styled.div`
    ${tw`flex flex-col items-center justify-center bg-gray-900 text-white md:w-1/2 p-8 relative overflow-hidden`}
    &::before {
        content: '';
        ${tw`absolute inset-0`}
        background-image: url('data:image/svg+xml;charset=UTF-8,<svg width="200" height="600" xmlns="http://www.w3.org/2000/svg"><text x="0" y="200" font-size="200" fill="%23ffffff20">🚍</text><text x="0" y="400" font-size="200" fill="%23ffffff20">📚</text><text x="0" y="600" font-size="200" fill="%23ffffff20">🎒</text></svg>');
        background-repeat: repeat-y;
        background-size: contain;
        animation: ${moveUp} 30s linear infinite;
    }
`;
const RightSection = tw.div`flex flex-col items-center justify-center bg-yellow-400 md:w-1/2 p-8 relative`;

const LoginForm = styled.div`
    ${tw`bg-gray-800 rounded-lg p-8 shadow-lg relative`}
`;
const Tab = styled.div`
    ${tw`absolute top-[-20px] left-1/2 transform -translate-x-1/2 px-6 py-2 bg-yellow-500 rounded-t-md`}
`;

const StyledTextField = styled(TextField)`
    & .MuiInputBase-root {
        ${tw`bg-gray-100 rounded`}
    }
    & .MuiInputLabel-root {
        ${tw`text-gray-600`}
    }
    & .MuiInputBase-input::placeholder {
        ${tw`text-gray-400`}
    }
`;

const ForgotPasswordLink = styled(Link)`
    ${tw`text-white mt-4 mb-6 text-right underline cursor-pointer`}
`;

const LoginButton = styled(Button)`
    ${tw`bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 mt-4`}
`;

const OAuthButton = styled(Button)`
    ${tw`bg-white hover:bg-gray-100 text-black font-semibold py-2 mt-4 flex items-center justify-center`}
`;

const LoginPage = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        email: 'prueba@correo.com', // Correo predefinido
        password: '12345',        // Contraseña predefinida
    });
    const [error, setError] = useState('');

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
        try {
            await login(formData.email, formData.password);
            // Después del login, redirigir al Dashboard
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Error en el inicio de sesión');
        }
    };

    const handleGoogleLogin = () => {
        // Redirigir al backend para iniciar OAuth con Google
        window.location.href = '/api/auth/google';
    };

    return (
        <LoginContainer>
            {/* Sección Izquierda */}
            <LeftSection>
                <Typography variant="h3" component="h1" tw="font-bold mb-8 relative z-10">
                    Transportes Luvan
                </Typography>
            </LeftSection>

            {/* Sección Derecha */}
            <RightSection>
                <LoginForm>
                    <Tab>
                        <Typography variant="h6" component="h2" tw="text-black font-bold">
                            Iniciar Sesión
                        </Typography>
                    </Tab>
                    {error && (
                        <Typography variant="body1" color="error" tw="mb-4 text-center">
                            {error}
                        </Typography>
                    )}
                    <form tw="mt-8" onSubmit={handleSubmit}>
                        <StyledTextField
                            label="Correo"
                            variant="outlined"
                            fullWidth
                            margin="normal"
                            placeholder="ejemplo@correo.com"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
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
                        />
                        <ForgotPasswordLink href="#" variant="body2" onClick={handleOpenModal}>
                            ¿Olvidaste tu contraseña?
                        </ForgotPasswordLink>
                        <LoginButton type="submit" variant="contained" fullWidth size="large">
                            Ingresar
                        </LoginButton>
                        <Divider tw="my-4" />
                        <OAuthButton onClick={handleGoogleLogin}>
                            <GoogleIcon tw="mr-2" /> Iniciar Sesión con Google
                        </OAuthButton>
                    </form>
                </LoginForm>
            </RightSection>

            {/* Modal de Olvidé mi Contraseña */}
            <ForgotPasswordModal open={isModalOpen} handleClose={handleCloseModal} />
        </LoginContainer>
    );

};

export default LoginPage;
