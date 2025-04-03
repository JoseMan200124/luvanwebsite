// src/pages/ForcePasswordChangePage.jsx

import React, { useState, useContext } from 'react';
import {
    TextField,
    Button,
    Typography,
    Snackbar,
    Alert,
    Box
} from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig'; // <---- en lugar de axios

const ForcePasswordChangePage = () => {
    const { auth, logout } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    });

    const [snackbar, setSnackbar] = useState({
        open: false,
        severity: 'success',
        message: '',
    });

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.oldPassword || !formData.newPassword || !formData.confirmNewPassword) {
            setSnackbar({
                open: true,
                severity: 'error',
                message: 'Por favor complete todos los campos.',
            });
            return;
        }

        try {
            // En lugar de axios, usamos api
            await api.put('/auth/change-password', {
                oldPassword: formData.oldPassword,
                newPassword: formData.newPassword,
                confirmNewPassword: formData.confirmNewPassword,
            });

            setSnackbar({
                open: true,
                severity: 'success',
                message: '¡Contraseña actualizada! Por favor, inicie sesión nuevamente.',
            });

            setTimeout(() => {
                logout();
            }, 2000);

        } catch (error) {
            const errorMsg = error?.response?.data?.message || 'Error al cambiar la contraseña.';
            setSnackbar({
                open: true,
                severity: 'error',
                message: errorMsg,
            });
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
            }}
        >
            <Typography variant="h5" gutterBottom>
                Cambio de Contraseña Obligatorio
            </Typography>
            <Typography variant="body1" gutterBottom>
                Tu contraseña ha expirado. Ingresa tu contraseña actual y una nueva contraseña.
            </Typography>
            <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{ display: 'flex', flexDirection: 'column', width: '300px', mt: 3 }}
            >
                <TextField
                    type="password"
                    label="Contraseña actual"
                    name="oldPassword"
                    value={formData.oldPassword}
                    onChange={handleChange}
                    required
                    margin="normal"
                />
                <TextField
                    type="password"
                    label="Nueva contraseña"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    margin="normal"
                />
                <TextField
                    type="password"
                    label="Confirmar nueva contraseña"
                    name="confirmNewPassword"
                    value={formData.confirmNewPassword}
                    onChange={handleChange}
                    required
                    margin="normal"
                />
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    sx={{ mt: 2 }}
                >
                    Cambiar Contraseña
                </Button>
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ForcePasswordChangePage;
