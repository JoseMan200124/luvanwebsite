// src/components/MFASetup.jsx

import React, { useState, useContext } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { TextField, Button, Typography } from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // Import nombrado

const SetupContainer = tw.div`flex flex-col items-center justify-center bg-gray-100 p-8 rounded-lg shadow-md`;

const SetupForm = tw.form`bg-white p-8 rounded-lg shadow-md w-full max-w-md`;

const FormField = tw.div`mb-4`;

const MFASetup = () => {
    const { auth } = useContext(AuthContext);
    const [setupCode, setSetupCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSetup = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            // Solicitar al backend la generación de un código QR o enlace para configurar MFA
            const response = await axios.post('/api/auth/mfa/setup', {}, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });

            // Suponiendo que el backend devuelve una URL para el QR
            const { qrCodeUrl } = response.data;
            window.open(qrCodeUrl, '_blank');
            setSuccess('Escanea el código QR con tu aplicación de autenticación');
        } catch (err) {
            setError(err.response?.data?.message || 'Error al configurar MFA');
        }
    };

    return (
        <SetupContainer>
            <SetupForm onSubmit={handleSetup}>
                <Typography variant="h5" tw="text-center mb-6">
                    Configuración de MFA
                </Typography>
                {error && (
                    <Typography variant="body1" color="error" tw="mb-4 text-center">
                        {error}
                    </Typography>
                )}
                {success && (
                    <Typography variant="body1" color="primary" tw="mb-4 text-center">
                        {success}
                    </Typography>
                )}
                <FormField>
                    <Button type="submit" variant="contained" color="primary" fullWidth>
                        Configurar MFA
                    </Button>
                </FormField>
            </SetupForm>
        </SetupContainer>
    );
};

export default MFASetup;
