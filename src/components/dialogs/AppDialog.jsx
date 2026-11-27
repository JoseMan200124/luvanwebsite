// src/components/dialogs/AppDialog.jsx
// Estructura única de los diálogos: cabecera con el degradado del logo (DialogHeading) y la X, contenido,
// y Cancelar + acción principal. En móvil ocupa la pantalla. Mientras envía no se puede cerrar ni volver a enviar.
// Con dirty, cerrar pide confirmación.
import React, { useRef, useState } from 'react';
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import useIsMobile from '../../hooks/useIsMobile';
import useConfirm from '../../hooks/useConfirm';
import DialogHeading from './DialogHeading';
import { DANGER_COLOR, DIALOG_SHADOW, LOGO_COLORS } from '../../theme/tokens';

/**
 * - size: 'xs' | 'sm' | 'md' | 'lg' (por defecto 'sm').
 * - Con onSubmit, el diálogo es un <form>: Enter en un campo de una línea envía.
 * - Sin onSubmit (o con readOnly) se muestra solo "Cerrar".
 * - actions reemplaza los botones por defecto; extraActions se suman antes de ellos (p. ej. "Editar" en un detalle).
 * - hideClose oculta la X y no cierra con Escape ni clic afuera (obliga a elegir una acción).
 * - tone 'danger' pinta la cabecera y el botón principal de rojo.
 */
const AppDialog = ({
    open,
    onClose,
    title,
    subtitle,
    icon,
    tone = 'default',
    size = 'sm',
    children,
    onSubmit,
    submitLabel = 'Guardar',
    cancelLabel = 'Cancelar',
    submitting = false,
    submitDisabled = false,
    dirty = false,
    readOnly = false,
    hideClose = false,
    actions,
    extraActions,
    contentSx,
    actionsSx,
    scroll = 'paper',
    TransitionProps,
}) => {
    const isMobile = useIsMobile();
    const confirm = useConfirm();
    // pendingRef frena el doble envío en el mismo instante; pending redibuja los botones al empezar y al terminar.
    const pendingRef = useRef(false);
    const [pending, setPending] = useState(false);
    const busy = submitting || pending;

    const requestClose = async () => {
        if (submitting || pendingRef.current || hideClose) {
            return;
        }
        if (dirty) {
            const ok = await confirm({
                title: 'Descartar cambios',
                message: 'Los cambios que no guardó se perderán.',
                confirmLabel: 'Descartar',
                cancelLabel: 'Seguir editando',
                tone: 'danger',
            });
            if (!ok) {
                return;
            }
        }
        onClose();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        // Un diálogo abierto desde otro formulario.
        event.stopPropagation();
        if (pendingRef.current || submitting || submitDisabled || readOnly || !onSubmit) {
            return;
        }
        pendingRef.current = true;
        setPending(true);
        try {
            await onSubmit(event);
        } finally {
            pendingRef.current = false;
            setPending(false);
        }
    };

    const accent = tone === 'danger' ? DANGER_COLOR : LOGO_COLORS.blue;
    const isForm = Boolean(onSubmit) && !readOnly;

    const paperProps = {
        ...(isForm ? { component: 'form', onSubmit: handleSubmit, noValidate: true } : {}),
        sx: {
            borderRadius: isMobile ? 0 : 3,
            overflow: 'hidden',
            boxShadow: DIALOG_SHADOW,
        },
    };

    const defaultActions = isForm
        ? (
            <>
                <Button onClick={requestClose} disabled={busy} sx={{ color: 'text.secondary' }}>
                    {cancelLabel}
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disableElevation
                    disabled={busy || submitDisabled}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{
                        bgcolor: accent,
                        fontWeight: 600,
                        px: 2.5,
                        '&:hover': { bgcolor: accent, filter: 'brightness(0.9)' },
                    }}
                >
                    {submitLabel}
                </Button>
            </>
        )
        : (
            <Button onClick={requestClose} sx={{ color: 'text.secondary' }}>
                Cerrar
            </Button>
        );

    const closeButton = hideClose ? null : (
        <IconButton
            aria-label="Cerrar"
            onClick={requestClose}
            disabled={busy}
            sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: '#fff',
                '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.5)' },
            }}
        >
            <CloseIcon />
        </IconButton>
    );

    return (
        <Dialog
            open={open}
            onClose={requestClose}
            maxWidth={size}
            fullWidth
            fullScreen={isMobile}
            scroll={scroll}
            PaperProps={paperProps}
            TransitionProps={TransitionProps}
        >
            <DialogHeading title={title} subtitle={subtitle} icon={icon} tone={tone} action={closeButton} />
            <DialogContent sx={{ pt: 2.5, ...contentSx }}>
                {children}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1, ...actionsSx }}>
                {extraActions ?? null}
                {actions ?? defaultActions}
            </DialogActions>
        </Dialog>
    );
};

export default AppDialog;
