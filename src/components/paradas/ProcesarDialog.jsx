// src/components/paradas/ProcesarDialog.jsx
import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material';

export default function ProcesarDialog({ open, resumen, ocupado = false, onCancelar, onConfirmar }) {
    const [confirmaSinParadas, setConfirmaSinParadas] = useState(false);
    useEffect(() => { if (open) setConfirmaSinParadas(false); }, [open]);
    if (!resumen) return null;
    const bloqueado = resumen.conErrores > 0 || resumen.conflictos > 0 || resumen.modificados === 0;
    const sinParadas = resumen.sinParadasLista;

    return (
        <Dialog open={open} onClose={onCancelar} maxWidth="sm" fullWidth>
            <DialogTitle>Procesar paradas</DialogTitle>
            <DialogContent dividers>
                {resumen.modificados === 0 && <Alert severity="info">No hay estudiantes modificados: no hay nada que procesar.</Alert>}
                {resumen.conErrores > 0 && <Alert severity="error" sx={{ mb: 1 }}>{resumen.conErrores} estudiante(s) tienen errores. Corrígelos antes de procesar (filtro "Con errores o incompletas").</Alert>}
                {resumen.conflictos > 0 && <Alert severity="error" sx={{ mb: 1 }}>{resumen.conflictos} conflicto(s) sin resolver. Resuélvelos en el panel "Conflictos".</Alert>}
                {!bloqueado && (
                    <>
                        <Typography gutterBottom>
                            Se reemplazarán las paradas de <strong>{resumen.modificados}</strong> estudiante(s) modificados. Los demás {resumen.estudiantes - resumen.modificados} no se tocan.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Se guarda un respaldo del estado anterior para poder revertir. Al terminar tendrás que descargar la copia de lo procesado.
                        </Typography>
                        {!!sinParadas.length && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                <Typography fontWeight={600}>{sinParadas.length} estudiante(s) quedarán sin paradas:</Typography>
                                {sinParadas.map(s => <Typography key={s.studentId} variant="body2">• {s.fullName} (familia {s.familyLastName})</Typography>)}
                                <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={confirmaSinParadas} onChange={e => setConfirmaSinParadas(e.target.checked)} />} label="Confirmo que estos estudiantes quedarán sin paradas" />
                            </Alert>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancelar}>Cancelar</Button>
                {/* ocupado: el diálogo sigue montado durante su transición de salida; un segundo clic mandaría otra petición. */}
                <Button variant="contained" disabled={ocupado || bloqueado || (sinParadas.length > 0 && !confirmaSinParadas)} onClick={() => onConfirmar(sinParadas.length > 0 && confirmaSinParadas)}>
                    Procesar {resumen.modificados} estudiante(s)
                </Button>
            </DialogActions>
        </Dialog>
    );
}
