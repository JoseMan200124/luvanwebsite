// src/components/feedback/ConfirmDialog.jsx
// Confirmación única de todo el sistema. Las pantallas no declaran diálogos de sí/no ni usan window.confirm:
// usan const ok = await confirm({ … }).
import React, { createContext, useCallback, useRef, useState } from 'react';
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    TextField,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import useNotify from '../../hooks/useNotify';
import DialogHeading from '../dialogs/DialogHeading';
import { DANGER_COLOR, DIALOG_SHADOW, FEEDBACK_Z_INDEX, LOGO_COLORS } from '../../theme/tokens';

export const ConfirmContext = createContext(null);

const INITIAL_STATE = {
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    tone: 'default',
    icon: null,
    onConfirm: null,
    errorMessage: 'No se pudo completar la acción',
    requireText: '',
};

export const ConfirmProvider = ({ children }) => {
    const notify = useNotify();
    const [state, setState] = useState(INITIAL_STATE);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const resolverRef = useRef(null);
    const busyRef = useRef(false);

    const confirm = useCallback((options = {}) => new Promise((resolve) => {
        resolverRef.current = resolve;
        busyRef.current = false;
        setBusy(false);
        setTyped('');
        setState({ ...INITIAL_STATE, ...options, open: true });
    }), []);

    const finish = (result) => {
        setState((prev) => ({ ...prev, open: false }));
        if (resolverRef.current) {
            resolverRef.current(result);
            resolverRef.current = null;
        }
    };

    const handleCancel = () => {
        if (!busyRef.current) {
            finish(false);
        }
    };

    const handleConfirm = async () => {
        if (busyRef.current) {
            return;
        }
        if (!state.onConfirm) {
            finish(true);
            return;
        }
        busyRef.current = true;
        setBusy(true);
        try {
            await state.onConfirm();
            busyRef.current = false;
            setBusy(false);
            finish(true);
        } catch (err) {
            busyRef.current = false;
            setBusy(false);
            notify.fromError(err, state.errorMessage);
        }
    };

    const textMatches = !state.requireText || typed.trim() === String(state.requireText).trim();
    const danger = state.tone === 'danger';
    const icon = state.icon || (danger ? <WarningAmberRoundedIcon /> : <HelpOutlineRoundedIcon />);
    const accent = danger ? DANGER_COLOR : LOGO_COLORS.blue;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Dialog
                open={state.open}
                onClose={handleCancel}
                maxWidth="xs"
                fullWidth
                sx={{ zIndex: FEEDBACK_Z_INDEX.confirm }}
                PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: DIALOG_SHADOW } }}
            >
                <DialogHeading title={state.title} icon={icon} tone={state.tone} />
                <DialogContent sx={{ pt: 2.5 }}>
                    {typeof state.message === 'string'
                        ? <DialogContentText>{state.message}</DialogContentText>
                        : state.message}
                    {state.requireText ? (
                        <TextField
                            autoFocus
                            fullWidth
                            size="small"
                            sx={{ mt: 2 }}
                            label={`Escriba "${state.requireText}" para confirmar`}
                            value={typed}
                            onChange={(event) => setTyped(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && textMatches) {
                                    handleConfirm();
                                }
                            }}
                            disabled={busy}
                        />
                    ) : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
                    <Button onClick={handleCancel} disabled={busy} sx={{ color: 'text.secondary' }}>
                        {state.cancelLabel}
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={handleConfirm}
                        disabled={busy || !textMatches}
                        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
                        sx={{
                            bgcolor: accent,
                            fontWeight: 600,
                            px: 2.5,
                            '&:hover': { bgcolor: accent, filter: 'brightness(0.9)' },
                        }}
                    >
                        {state.confirmLabel}
                    </Button>
                </DialogActions>
            </Dialog>
        </ConfirmContext.Provider>
    );
};

export default ConfirmProvider;
