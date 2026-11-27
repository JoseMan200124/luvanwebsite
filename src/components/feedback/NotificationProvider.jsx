// src/components/feedback/NotificationProvider.jsx
// Aviso único de todo el sistema. Las pantallas no declaran su propio Snackbar: usan useNotify().
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Paper, Snackbar, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloseIcon from '@mui/icons-material/Close';
import DuplicateEmailAlert from '../DuplicateEmailAlert';
import { FEEDBACK_Z_INDEX, HEADER_TITLE_COLOR, NOTIFY_ACCENTS, NOTIFY_SHADOW } from '../../theme/tokens';
import {
    DUPLICATE_EMAIL_DURATION,
    enqueue,
    getDuration,
    getErrorMessage,
    isDuplicateEmailError,
} from './notifyModel';

export const NotificationContext = createContext(null);

let nextId = 1;

const SEVERITY_ICONS = {
    success: CheckCircleRoundedIcon,
    info: InfoRoundedIcon,
    warning: WarningAmberRoundedIcon,
    error: ErrorOutlineRoundedIcon,
};

// Tarjeta del aviso: blanca con sombra, barra izquierda y cuadro del ícono con el color del tipo.
const NotificationCard = React.forwardRef(({ severity, message, action, onClose }, ref) => {
    const accent = NOTIFY_ACCENTS[severity] || NOTIFY_ACCENTS.info;
    const Icon = SEVERITY_ICONS[severity] || SEVERITY_ICONS.info;
    return (
        <Paper
            ref={ref}
            role="alert"
            elevation={0}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: { xs: '100%', sm: 'auto' },
                minWidth: { sm: 320 },
                maxWidth: 480,
                py: 1.25,
                pl: 1.5,
                pr: 1,
                borderRadius: 2,
                bgcolor: '#fff',
                borderLeft: `4px solid ${accent}`,
                boxShadow: NOTIFY_SHADOW,
            }}
        >
            <Box
                sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    bgcolor: accent,
                }}
            >
                <Icon fontSize="small" />
            </Box>
            <Typography component="div" variant="body2" sx={{ flex: 1, color: HEADER_TITLE_COLOR, fontWeight: 500 }}>
                {message}
            </Typography>
            {action}
            <IconButton size="small" aria-label="Cerrar" onClick={onClose} sx={{ color: 'text.secondary' }}>
                <CloseIcon fontSize="small" />
            </IconButton>
        </Paper>
    );
});

const NotificationProvider = ({ children }) => {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const [open, setOpen] = useState(false);
    const currentRef = useRef(null);

    useEffect(() => {
        currentRef.current = current;
    }, [current]);

    const push = useCallback((severity, message, options = {}) => {
        if (!message) {
            return;
        }
        const item = {
            id: nextId++,
            severity,
            message,
            duration: getDuration(severity, options.duration),
            action: options.action || null,
            closeOnClickAway: options.closeOnClickAway === true,
        };
        setQueue((prev) => enqueue(prev, currentRef.current, item));
    }, []);

    // Muestra el siguiente aviso cuando no hay ninguno en pantalla.
    useEffect(() => {
        if (!current && queue.length > 0) {
            setCurrent(queue[0]);
            setQueue((prev) => prev.slice(1));
            setOpen(true);
        }
    }, [current, queue]);

    const handleClose = (_event, reason) => {
        if (reason === 'clickaway' && !currentRef.current?.closeOnClickAway) {
            return;
        }
        setOpen(false);
    };

    const notify = useMemo(() => ({
        success: (message, options) => push('success', message, options),
        info: (message, options) => push('info', message, options),
        warning: (message, options) => push('warning', message, options),
        error: (message, options) => push('error', message, options),
        fromError: (err, fallback, options = {}) => {
            if (isDuplicateEmailError(err)) {
                const data = err.response.data;
                push('error', (
                    <DuplicateEmailAlert
                        roleLabel={data.roleLabel}
                        associated={data.associated}
                        includeArticle={options.includeArticle !== false}
                    />
                ), { duration: DUPLICATE_EMAIL_DURATION });
                return;
            }
            push('error', getErrorMessage(err, fallback), options);
        },
        dismiss: () => setOpen(false),
    }), [push]);

    return (
        <NotificationContext.Provider value={notify}>
            {children}
            <Snackbar
                key={current?.id}
                open={open}
                autoHideDuration={current?.duration ?? null}
                onClose={handleClose}
                TransitionProps={{ onExited: () => setCurrent(null) }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ zIndex: FEEDBACK_Z_INDEX.notify }}
            >
                {current ? (
                    <NotificationCard
                        severity={current.severity}
                        message={current.message}
                        action={current.action}
                        onClose={handleClose}
                    />
                ) : <span />}
            </Snackbar>
        </NotificationContext.Provider>
    );
};

export default NotificationProvider;
