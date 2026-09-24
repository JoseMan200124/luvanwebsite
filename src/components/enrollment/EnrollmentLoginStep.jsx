// src/components/enrollment/EnrollmentLoginStep.jsx
import React, { useContext, useState } from 'react';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { AuthContext } from '../../context/AuthProvider';
import ForgotPasswordModal from '../modals/ForgotPasswordModal';

const EnrollmentLoginStep = ({ initialEmail = '', onSuccess, onBack, onPasswordExpired }) => {
    const { login } = useContext(AuthContext);
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setError('Ingresa tu correo y contraseña.');
            return;
        }

        setSubmitting(true);
        try {
            // Quién puede reinscribirse lo decide el backend con `padre-reinscripcion-ver`.
            const { passwordExpired } = await login(trimmedEmail, password);
            if (passwordExpired) {
                onPasswordExpired();
                return;
            }
            onSuccess();
        } catch (loginError) {
            setError(loginError?.response?.data?.message || loginError?.message || 'No se pudo iniciar sesión. Intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 420, mx: 'auto', width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Inicia sesión con tu cuenta Luvan</Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#555' }}>
                Usa el mismo correo y contraseña del ciclo anterior. Tu nueva inscripción quedará en esa misma cuenta.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                fullWidth
                margin="normal"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
            />
            <TextField
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
            />
            <Link component="button" type="button" variant="body2" onClick={() => setForgotOpen(true)} sx={{ mt: 1 }}>
                ¿Olvidaste tu contraseña?
            </Link>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
                <Button variant="outlined" onClick={onBack} disabled={submitting} fullWidth>
                    Volver
                </Button>
                <Button type="submit" variant="contained" disabled={submitting} fullWidth sx={{ backgroundColor: '#47A56B' }}>
                    {submitting ? 'Ingresando...' : 'Ingresar y continuar'}
                </Button>
            </Stack>
            <ForgotPasswordModal open={forgotOpen} handleClose={() => setForgotOpen(false)} />
        </Box>
    );
};

export default EnrollmentLoginStep;
