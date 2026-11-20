// src/components/SendNotificationModal.jsx
import React, { useEffect, useState } from 'react';
import {
    TextField,
    Typography, Box, Alert, Divider,
} from '@mui/material';
import { Notifications as NotificationsIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import AudienceTargetingPanel from './audience/AudienceTargetingPanel';
import { EMPTY_AUDIENCE, validateAudience } from './audience/audienceModel';
import ScheduleSection from './scheduling/ScheduleSection';
import {
    EMPTY_SCHEDULE, buildSchedulePayload, describeSchedule, scheduleFromPayload, validateSchedule,
} from './scheduling/scheduleModel';
import { sendManualNotification } from '../services/notificationService';
import { createScheduledNotification, updateScheduledSend } from '../services/scheduledSendService';
import AppDialog from './dialogs/AppDialog';

const MAX_MESSAGE_LENGTH = 255;

const SendNotificationModal = ({ open, onClose, schools = [], cicloEscolarId = null, onSuccess, editing = null }) => {
    const [audience, setAudience] = useState(EMPTY_AUDIENCE);
    const [preview, setPreview] = useState(null);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [schedule, setSchedule] = useState(EMPTY_SCHEDULE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (!open || !editing) {
            return;
        }
        setAudience(editing.audience || EMPTY_AUDIENCE);
        setTitle(editing.content?.title || '');
        setMessage(editing.content?.message || '');
        setSchedule(scheduleFromPayload(editing.schedule, editing.nextRunAt));
    }, [open, editing]);

    const totalUnique = preview?.counts?.totalUnique ?? 0;
    const audienceValidation = validateAudience(audience);
    const scheduleValidation = validateSchedule(schedule);
    const isScheduled = schedule.mode === 'scheduled';
    const remaining = MAX_MESSAGE_LENGTH - message.length;

    const handleClose = () => {
        if (loading) {
            return;
        }
        setAudience(EMPTY_AUDIENCE);
        setPreview(null);
        setTitle('');
        setMessage('');
        setSchedule(EMPTY_SCHEDULE);
        setError('');
        setSuccessMessage('');
        onClose();
    };

    const handleSubmit = async () => {
        setError('');

        if (!title.trim()) { setError('El título es requerido.'); return; }
        if (!message.trim()) { setError('El mensaje es requerido.'); return; }
        if (message.length > MAX_MESSAGE_LENGTH) {
            setError(`El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`);
            return;
        }
        if (!audienceValidation.valid) { setError(audienceValidation.message); return; }
        if (!scheduleValidation.valid) { setError(scheduleValidation.message); return; }

        setLoading(true);
        try {
            const base = { title: title.trim(), message: message.trim(), audience };
            let text;
            if (editing) {
                await updateScheduledSend(editing.uuid, { ...base, schedule: buildSchedulePayload(schedule) });
                text = 'Envío programado actualizado.';
            } else if (isScheduled) {
                await createScheduledNotification({
                    ...base,
                    schedule: buildSchedulePayload(schedule),
                    ...(cicloEscolarId ? { cicloEscolarId: Number(cicloEscolarId) } : {}),
                });
                text = `Notificación programada: ${describeSchedule(buildSchedulePayload(schedule))}.`;
            } else {
                await sendManualNotification({
                    ...base,
                    ...(cicloEscolarId ? { cicloEscolarId: Number(cicloEscolarId) } : {}),
                });
                text = '¡Notificación enviada correctamente!';
            }
            setSuccessMessage(text);
            if (onSuccess) {
                onSuccess(text);
            }
            setTimeout(handleClose, 1500);
        } catch (err) {
            setError(err?.response?.data?.message || 'Error al guardar la notificación.');
        } finally {
            setLoading(false);
        }
    };

    let submitLabel = 'Enviar notificación';
    if (editing) {
        submitLabel = 'Guardar cambios';
    }
    else if (isScheduled) {
        submitLabel = 'Programar notificación';
    }

    return (
        <AppDialog
            open={open}
            onClose={handleClose}
            title={editing ? 'Editar notificación programada' : 'Enviar notificación push'}
            icon={editing ? <ScheduleIcon /> : <NotificationsIcon />}
            size="sm"
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
            submitting={loading}
            submitDisabled={!audienceValidation.valid || !scheduleValidation.valid || totalUnique === 0 || !title.trim() || !message.trim()}
            readOnly={Boolean(successMessage)}
            dirty={!editing && !successMessage && Boolean(title.trim() || message.trim())}
        >
            {successMessage ? (
                <Alert severity="success" sx={{ mt: 1 }}>{successMessage}</Alert>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
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

                    <Divider />

                    <ScheduleSection value={schedule} onChange={setSchedule} allowSendNow={!editing} />

                    {error && <Alert severity="error">{error}</Alert>}
                </Box>
            )}
        </AppDialog>
    );
};

export default SendNotificationModal;
