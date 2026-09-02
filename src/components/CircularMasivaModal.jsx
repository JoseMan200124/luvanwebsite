// src/components/CircularMasivaModal.jsx
import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Snackbar,
    Alert, Box, Checkbox, FormControl, FormHelperText, Typography, Stack, Divider,
    CircularProgress,
} from '@mui/material';
import { FileUpload, Notifications as NotificationsIcon } from '@mui/icons-material';
import api from '../utils/axiosConfig';
import AudienceTargetingPanel from './audience/AudienceTargetingPanel';
import { EMPTY_AUDIENCE, validateAudience } from './audience/audienceModel';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const CircularMasivaModal = ({ open, onClose, schools = [], cicloEscolarId = null, onSuccess }) => {
    const [audience, setAudience] = useState(EMPTY_AUDIENCE);
    const [preview, setPreview] = useState(null);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);
    const [sendEmail, setSendEmail] = useState(false);
    const [sending, setSending] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const totalUnique = preview?.counts?.totalUnique ?? 0;
    const audienceValidation = validateAudience(audience);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.size > MAX_FILE_SIZE) {
            setSnackbar({ open: true, message: 'El archivo no puede superar los 5MB.', severity: 'error' });
            e.target.value = null;
            setFile(null);
            return;
        }
        setFile(selectedFile);
    };

    const resetAndClose = () => {
        setAudience(EMPTY_AUDIENCE);
        setPreview(null);
        setSubject('');
        setMessage('');
        setFile(null);
        setSendEmail(false);
        onClose();
    };

    const handleSendCircular = async () => {
        if (!subject || !message) {
            setSnackbar({ open: true, message: 'Asunto y mensaje son requeridos.', severity: 'error' });
            return;
        }
        if (!audienceValidation.valid) {
            setSnackbar({ open: true, message: audienceValidation.message, severity: 'error' });
            return;
        }

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('body', message);
            formData.append('audience', JSON.stringify(audience));
            if (cicloEscolarId) formData.append('cicloEscolarId', String(cicloEscolarId));
            formData.append('useSmtp', true);
            // Push SIEMPRE; el correo es opcional.
            formData.append('sendPush', 'true');
            formData.append('sendEmail', sendEmail ? 'true' : 'false');
            if (file) formData.append('file', file);

            await api.post('/mail/send-circular', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSnackbar({ open: true, message: 'Circular enviada correctamente.', severity: 'success' });
            if (onSuccess) onSuccess();
            resetAndClose();
        } catch (error) {
            console.error('Error al enviar circular:', error);
            setSnackbar({ open: true, message: 'Error al enviar la circular.', severity: 'error' });
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NotificationsIcon color="primary" />
                    Enviar Circular Masiva
                </DialogTitle>

                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
                        <Alert severity="info" sx={{ py: 1, px: 1.5, fontSize: '0.875rem' }}>
                            Las circulares estarán disponibles en el historial de circulares del sistema y en la app/web
                            para las familias que quieran consultar las circulares recibidas.
                        </Alert>

                        <AudienceTargetingPanel
                            schools={schools}
                            value={audience}
                            onChange={setAudience}
                            cicloEscolarId={cicloEscolarId}
                            onPreviewChange={setPreview}
                        />

                        <Divider />

                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
                            4) Contenido de la circular
                        </Typography>

                        <TextField
                            fullWidth
                            size="small"
                            label="Asunto"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                        <TextField
                            fullWidth
                            size="small"
                            label="Mensaje"
                            multiline
                            minRows={3}
                            maxRows={6}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Button variant="outlined" component="label" startIcon={<FileUpload />} size="small">
                                Seleccionar Archivo
                                <input type="file" hidden accept="application/pdf,image/*" onChange={handleFileChange} />
                            </Button>
                            {file && <Typography variant="body2">{file.name}</Typography>}
                        </Box>

                        <FormControl component="fieldset" variant="standard">
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                                <Typography variant="body2">Enviar correo (opcional)</Typography>
                            </Stack>
                            <FormHelperText>
                                Enviar correo es opcional, al marcar esta opción se enviará correo electrónico a los destinatarios.
                            </FormHelperText>
                        </FormControl>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={onClose} disabled={sending}>Cancelar</Button>
                    <Button
                        onClick={handleSendCircular}
                        variant="contained"
                        disabled={sending || !audienceValidation.valid || totalUnique === 0 || !subject || !message}
                        startIcon={sending ? <CircularProgress size={16} /> : <NotificationsIcon />}
                    >
                        {sending ? 'Enviando...' : 'Enviar Circular'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default CircularMasivaModal;
