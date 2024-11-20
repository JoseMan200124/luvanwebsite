// src/components/modals/ForgotPasswordModal.jsx
import React, { useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { Modal, Box, Typography, TextField, Button, Alert } from '@mui/material';

const ModalBox = styled(Box)`
    ${tw`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-8 w-11/12 max-w-md shadow-lg`}
`;

const Title = styled(Typography)`
    ${tw`text-center text-xl font-semibold mb-6`}
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

const SubmitButton = styled(Button)`
    ${tw`bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 mt-4`}
`;

const CancelButton = styled(Button)`
    ${tw`text-gray-600 mt-2`}
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
                        fullWidth
                        disabled={loading}
                    >
                        {loading ? 'Enviando...' : 'Enviar Enlace'}
                    </SubmitButton>
                    <CancelButton
                        variant="text"
                        fullWidth
                        onClick={handleClose}
                    >
                        Cancelar
                    </CancelButton>
                </form>
            </ModalBox>
        </Modal>
    );
};

export default ForgotPasswordModal;
