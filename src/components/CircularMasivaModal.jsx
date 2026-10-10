// src/components/CircularMasivaModal.jsx
import { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Snackbar,
    Alert, Box, Checkbox, FormControl, FormHelperText, Typography, Stack, Divider,
    CircularProgress,
} from '@mui/material';
import { FileUpload, Notifications as NotificationsIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import api from '../utils/axiosConfig';
import AudienceTargetingPanel from './audience/AudienceTargetingPanel';
import { EMPTY_AUDIENCE, validateAudience } from './audience/audienceModel';
import ScheduleSection from './scheduling/ScheduleSection';
import {
    EMPTY_SCHEDULE, buildSchedulePayload, describeSchedule, scheduleFromPayload, validateSchedule,
} from './scheduling/scheduleModel';
import { createScheduledCircular, updateScheduledSend } from '../services/scheduledSendService';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const CircularMasivaModal = ({ open, onClose, schools = [], cicloEscolarId = null, onSuccess, editing = null }) => {
    const [audience, setAudience] = useState(EMPTY_AUDIENCE);
    const [preview, setPreview] = useState(null);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);
    const [removeAttachment, setRemoveAttachment] = useState(false);
    const [sendEmail, setSendEmail] = useState(false);
    const [schedule, setSchedule] = useState(EMPTY_SCHEDULE);
    const [sending, setSending] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Modo edición: precargar con el envío programado.
    useEffect(() => {
        if (!open || !editing) return;
        setAudience(editing.audience || EMPTY_AUDIENCE);
        setSubject(editing.content?.subject || '');
        setMessage(editing.content?.body || '');
        setSendEmail(!!editing.content?.sendEmail);
        setSchedule(scheduleFromPayload(editing.schedule, editing.nextRunAt));
        setFile(null);
        setRemoveAttachment(false);
    }, [open, editing]);

    const totalUnique = preview?.counts?.totalUnique ?? 0;
    const audienceValidation = validateAudience(audience);
    const scheduleValidation = validateSchedule(schedule);
    const isScheduled = schedule.mode === 'scheduled';
    const currentAttachment = editing?.attachment && !removeAttachment ? editing.attachment : null;

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
        setRemoveAttachment(false);
        setSendEmail(false);
        setSchedule(EMPTY_SCHEDULE);
        onClose();
    };

    const handleSubmit = async () => {
        if (!subject || !message) {
            setSnackbar({ open: true, message: 'Asunto y mensaje son requeridos.', severity: 'error' });
            return;
        }
        if (!audienceValidation.valid) {
            setSnackbar({ open: true, message: audienceValidation.message, severity: 'error' });
            return;
        }
        if (!scheduleValidation.valid) {
            setSnackbar({ open: true, message: scheduleValidation.message, severity: 'error' });
            return;
        }

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('body', message);
            formData.append('audience', JSON.stringify(audience));
            formData.append('sendEmail', sendEmail ? 'true' : 'false');
            if (file) formData.append('file', file);

            let successMessage;
            if (editing) {
                formData.append('schedule', JSON.stringify(buildSchedulePayload(schedule)));
                if (removeAttachment && !file) formData.append('removeAttachment', 'true');
                await updateScheduledSend(editing.uuid, formData);
                successMessage = 'Envío programado actualizado.';
            } else if (isScheduled) {
                if (cicloEscolarId) formData.append('cicloEscolarId', String(cicloEscolarId));
                formData.append('schedule', JSON.stringify(buildSchedulePayload(schedule)));
                await createScheduledCircular(formData);
                successMessage = `Circular programada: ${describeSchedule(buildSchedulePayload(schedule))}.`;
            } else {
                if (cicloEscolarId) formData.append('cicloEscolarId', String(cicloEscolarId));
                formData.append('useSmtp', true);
                // Push SIEMPRE; el correo es opcional.
                formData.append('sendPush', 'true');
                await api.post('/mail/send-circular', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                successMessage = 'Circular enviada correctamente.';
            }

            setSnackbar({ open: true, message: successMessage, severity: 'success' });
            if (onSuccess) onSuccess(successMessage);
            resetAndClose();
        } catch (error) {
            console.error('Error al enviar circular:', error);
            const fallback = isScheduled || editing ? 'Error al programar la circular.' : 'Error al enviar la circular.';
            setSnackbar({ open: true, message: error?.response?.data?.message || fallback, severity: 'error' });
        } finally {
            setSending(false);
        }
    };

    let submitLabel = 'Enviar Circular';
    if (editing) submitLabel = 'Guardar cambios';
    else if (isScheduled) submitLabel = 'Programar Circular';

    return (
        <>
            <Dialog open={open} onClose={sending ? undefined : resetAndClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {editing ? <ScheduleIcon color="primary" /> : <NotificationsIcon color="primary" />}
                    {editing ? 'Editar Circular Programada' : 'Enviar Circular Masiva'}
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
                            loadedAudience={editing?.audience || null}
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
                                {currentAttachment ? 'Reemplazar Archivo' : 'Seleccionar Archivo'}
                                <input type="file" hidden accept="application/pdf,image/*" onChange={handleFileChange} />
                            </Button>
                            {file && <Typography variant="body2">{file.name}</Typography>}
                            {!file && currentAttachment && (
                                <>
                                    <Typography variant="body2">Adjunto actual: {currentAttachment.name}</Typography>
                                    <Button size="small" color="error" onClick={() => setRemoveAttachment(true)}>
                                        Quitar adjunto
                                    </Button>
                                </>
                            )}
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

                        <Divider />

                        <ScheduleSection value={schedule} onChange={setSchedule} allowSendNow={!editing} />
                    </Box>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={resetAndClose} disabled={sending}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={sending || !audienceValidation.valid || !scheduleValidation.valid || totalUnique === 0 || !subject || !message}
                        startIcon={sending ? <CircularProgress size={16} /> : (isScheduled ? <ScheduleIcon /> : <NotificationsIcon />)}
                    >
                        {sending ? 'Guardando...' : submitLabel}
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
