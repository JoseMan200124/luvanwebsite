// src/components/modals/ForgotPasswordModal.jsx

import React, { useState } from 'react';
import tw, { styled } from 'twin.macro';
import { Modal, Box, Typography, TextField, Button, Alert } from '@mui/material';
import { keyframes } from 'styled-components';

// Animación de apertura suave
const fadeIn = keyframes`
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

// Contenedor del Modal con animación
const ModalBox = styled(Box)`
    ${tw`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-8 w-11/12 max-w-md shadow-lg`}
    animation: ${fadeIn} 0.3s ease-out;
`;

// Título del Modal
const Title = tw(Typography)`text-center text-2xl font-semibold mb-6 text-green-600`;

// Campo de texto personalizado
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

// Botón de Envío personalizado
const SubmitButton = styled(Button)`
    ${tw`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 mt-4 w-full rounded`}
`;

// Botón de Cancelar personalizado
const CancelButton = styled(Button)`
    ${tw`text-gray-600 mt-2 w-full`}
`;

const ForgotPasswordModal = ({ open, handleClose }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validación de formato de correo electrónico
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setErrorMessage('Por favor, ingresa un correo electrónico válido.');
            return;
        }

        setLoading(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            // Implementar la lógica para enviar el enlace de restablecimiento
            // Por ejemplo, llamar a una API
            // Simulación de éxito
            setTimeout(() => {
                setSuccessMessage('Se ha enviado un enlace de restablecimiento a tu correo electrónico.');
                setLoading(false);
            }, 2000);
        } catch (error) {
            setErrorMessage('Ocurrió un error. Por favor, intenta nuevamente.');
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={handleClose}
            aria-labelledby="forgot-password-modal-title"
            aria-describedby="forgot-password-modal-description"
        >
            <ModalBox>
                <Title id="forgot-password-modal-title">
                    Restablecer Contraseña
                </Title>
                {successMessage && <Alert severity="success" tw="mb-4">{successMessage}</Alert>}
                {errorMessage && <Alert severity="error" tw="mb-4">{errorMessage}</Alert>}
                <form onSubmit={handleSubmit}>
                    <StyledTextField
                        label="Correo Electrónico"
                        variant="outlined"
                        fullWidth
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="ejemplo@correo.com"
                        tw="mb-4"
                    />
                    <SubmitButton
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        aria-label="Enviar enlace de restablecimiento"
                    >
                        {loading ? 'Enviando...' : 'Enviar Enlace'}
                    </SubmitButton>
                    <CancelButton
                        variant="text"
                        onClick={handleClose}
                        aria-label="Cancelar"
                    >
                        Cancelar
                    </CancelButton>
                </form>
            </ModalBox>
        </Modal>
    );
};

export default ForgotPasswordModal;
