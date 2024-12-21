import React, { useState } from 'react';
import {
    Modal,
    Box,
    Typography,
    TextField,
    Button,
    Snackbar,
    Alert
} from '@mui/material';
import tw, { styled } from 'twin.macro';
import api from '../../utils/axiosConfig';
const ModalBox = styled(Box)`
    ${tw`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-8 rounded-lg shadow-lg w-11/12 max-w-md`}
`;

const ForgotPasswordModal = ({ open, handleClose }) => {
    const [email, setEmail] = useState('');
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/mail/forgot-password', { email });
            setSnackbar({
                open: true,
                message: response.data.message || 'Se ha enviado un correo para restablecer la contraseña.',
                severity: 'success',
            });
            setEmail('');
            handleClose();
        } catch (error) {
            console.error('Error al enviar el correo:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Error al enviar el correo. Por favor, intenta nuevamente.',
                severity: 'error',
            });
        }
    };

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    return (
        <>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-title"
                aria-describedby="modal-description"
            >
                <ModalBox>
                    <Typography id="modal-title" variant="h6" component="h2" tw="mb-4">
                        Recuperar Contraseña
                    </Typography>
                    <form onSubmit={handleSubmit}>
                        <TextField
                            label="Correo Electrónico"
                            variant="outlined"
                            fullWidth
                            margin="normal"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <Button type="submit" variant="contained" color="primary" fullWidth tw="mt-4">
                            Enviar
                        </Button>
                    </form>
                </ModalBox>
            </Modal>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default ForgotPasswordModal;
