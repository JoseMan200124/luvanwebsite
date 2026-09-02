// src/components/SendNotificationModal.jsx
import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    Typography, Box, Alert, CircularProgress, Divider,
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import AudienceTargetingPanel from './audience/AudienceTargetingPanel';
import { EMPTY_AUDIENCE, validateAudience } from './audience/audienceModel';
import { sendManualNotification } from '../services/notificationService';

const MAX_MESSAGE_LENGTH = 255;

const SendNotificationModal = ({ open, onClose, schools = [], cicloEscolarId = null }) => {
    const [audience, setAudience] = useState(EMPTY_AUDIENCE);
    const [preview, setPreview] = useState(null);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const totalUnique = preview?.counts?.totalUnique ?? 0;
    const audienceValidation = validateAudience(audience);
    const remaining = MAX_MESSAGE_LENGTH - message.length;

    const handleClose = () => {
        if (loading) return;
        setAudience(EMPTY_AUDIENCE);
        setPreview(null);
        setTitle('');
        setMessage('');
        setError('');
        setSuccess(false);
        onClose();
    };

    const handleSend = async () => {
        setError('');

        if (!title.trim()) { setError('El título es requerido.'); return; }
        if (!message.trim()) { setError('El mensaje es requerido.'); return; }
        if (message.length > MAX_MESSAGE_LENGTH) {
            setError(`El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`);
            return;
        }
        if (!audienceValidation.valid) { setError(audienceValidation.message); return; }

        setLoading(true);
        try {
            await sendManualNotification({
                title: title.trim(),
                message: message.trim(),
                audience,
                ...(cicloEscolarId ? { cicloEscolarId: Number(cicloEscolarId) } : {}),
            });
            setSuccess(true);
            setTimeout(handleClose, 1500);
        } catch (err) {
            setError(err?.response?.data?.message || 'Error al enviar la notificación.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsIcon color="primary" />
                Enviar Notificación Push
            </DialogTitle>

            <DialogContent dividers>
                {success ? (
                    <Alert severity="success" sx={{ mt: 1 }}>
                        ¡Notificación enviada correctamente!
                    </Alert>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
                        <AudienceTargetingPanel
                            schools={schools}
                            value={audience}
                            onChange={setAudience}
                            cicloEscolarId={cicloEscolarId}
                            onPreviewChange={setPreview}
                        />

                        <Divider />

                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
                            4) Contenido de la notificación
                        </Typography>

                        <TextField
                            label="Título"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); setError(''); }}
                            fullWidth
                            size="small"
                            required
                            inputProps={{ maxLength: 100 }}
                        />

                        <TextField
                            label="Mensaje"
                            value={message}
                            onChange={(e) => { setMessage(e.target.value); setError(''); }}
                            fullWidth
                            size="small"
                            required
                            multiline
                            minRows={3}
                            maxRows={6}
                            inputProps={{ maxLength: MAX_MESSAGE_LENGTH }}
                            helperText={
                                <Typography
                                    component="span"
                                    variant="caption"
                                    color={remaining < 20 ? 'error' : 'text.secondary'}
                                >
                                    {remaining} caracteres restantes
                                </Typography>
                            }
                        />

                        {error && <Alert severity="error">{error}</Alert>}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
                {!success && (
                    <Button
                        onClick={handleSend}
                        variant="contained"
                        disabled={loading || !audienceValidation.valid || totalUnique === 0 || !title.trim() || !message.trim()}
                        startIcon={loading ? <CircularProgress size={16} /> : <NotificationsIcon />}
                    >
                        {loading ? 'Enviando...' : 'Enviar Notificación'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default SendNotificationModal;
