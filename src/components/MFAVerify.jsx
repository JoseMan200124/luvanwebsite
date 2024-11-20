// src/components/MFAVerify.jsx

import React, { useState, useContext } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { TextField, Button, Typography } from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // Importación nombrada
import { useNavigate } from 'react-router-dom';

const VerifyContainer = tw.div`flex flex-col items-center justify-center h-screen bg-gray-100`;

const VerifyForm = tw.form`bg-white p-8 rounded-lg shadow-md w-full max-w-md`;

const FormField = tw.div`mb-4`;

const MFAVerify = () => {
    const { auth, setAuth } = useContext(AuthContext);
    const navigate = useNavigate(); // Usar useNavigate
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // Enviar el código MFA al backend para verificar
            const response = await axios.post('/api/auth/mfa/verify', { code }, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });

            // Actualizar el estado de autenticación según la respuesta
            const { token } = response.data;
            localStorage.setItem('token', token);
            const decoded = jwtDecode(token);
            setAuth({
                user: decoded,
                token,
            });
            // Redirigir a la página principal o donde corresponda
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Error en la verificación de MFA');
        }
    };

    return (
        <VerifyContainer>
            <VerifyForm onSubmit={handleVerify}>
                <Typography variant="h5" tw="text-center mb-6">
                    Verificación MFA
                </Typography>
                {error && (
                    <Typography variant="body1" color="error" tw="mb-4 text-center">
                        {error}
                    </Typography>
                )}
                <FormField>
                    <TextField
                        label="Código MFA"
                        variant="outlined"
                        fullWidth
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                </FormField>
                <Button type="submit" variant="contained" color="primary" fullWidth>
                    Verificar
                </Button>
            </VerifyForm>
        </VerifyContainer>
    );
};

export default MFAVerify;
