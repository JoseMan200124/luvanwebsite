import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, RadioGroup, FormControlLabel, Radio, TextField, Typography, Alert
} from '@mui/material';

// Quitar a un alumno guardado de la familia: desactivarlo (por defecto, se puede reactivar) o eliminarlo del sistema
// (baja lógica; solo soporte lo recupera). onConfirm({ accion: 'desactivar' | 'eliminar', nota }).
// canDelete: permiso alumnos-eliminar (por defecto solo Gestor). Sin él la opción se ve deshabilitada con el motivo.
const RemoveStudentDialog = ({ open, student, canDelete = false, onClose, onConfirm }) => {
    const [accion, setAccion] = useState('desactivar');
    const [nota, setNota] = useState('');

    useEffect(() => {
        if (open) {
            setAccion('desactivar');
            setNota('');
        }
    }, [open]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Quitar a {student?.fullName}</DialogTitle>
            <DialogContent>
                <RadioGroup value={accion} onChange={(e) => setAccion(e.target.value)}>
                    <FormControlLabel value="desactivar" control={<Radio />} label="Desactivar (deja de usar el bus; se puede reactivar)" />
                    <FormControlLabel
                        value="eliminar"
                        control={<Radio />}
                        disabled={!canDelete}
                        label={canDelete ? 'Eliminar del sistema' : 'Eliminar del sistema (solo un Gestor puede hacerlo)'}
                    />
                </RadioGroup>
                {accion === 'desactivar' ? (
                    <TextField
                        fullWidth
                        size="small"
                        sx={{ mt: 1 }}
                        label="Motivo (opcional)"
                        value={nota}
                        inputProps={{ maxLength: 500 }}
                        onChange={(e) => setNota(e.target.value)}
                    />
                ) : (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        Solo soporte podrá recuperarlo. Sus incidentes e historial se conservan.
                    </Alert>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Se aplica al guardar la familia. Sus horarios se borran y la mensualidad cambia desde el próximo cobro.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    variant="contained"
                    color={accion === 'eliminar' ? 'error' : 'primary'}
                    onClick={() => onConfirm({ accion, nota: nota.trim() })}
                >
                    {accion === 'eliminar' ? 'Eliminar' : 'Desactivar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RemoveStudentDialog;
