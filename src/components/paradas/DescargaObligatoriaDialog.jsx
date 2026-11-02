// src/components/paradas/DescargaObligatoriaDialog.jsx
// No se puede cerrar hasta descargar la copia procesada (diseño, "Procesar").
import React, { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { CloudDownload } from '@mui/icons-material';
import paradasService, { mensajeError } from '../../services/paradasService';
import { descargarExcel } from './excelPuntoGuardado';

export default function DescargaObligatoriaDialog({ open, schoolId, resultado, onTerminar }) {
    const [descargado, setDescargado] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => { if (open) { setDescargado(false); setError(null); } }, [open]);

    const descargar = async () => {
        setDescargando(true);
        setError(null);
        try {
            await descargarExcel(await paradasService.exportar(schoolId, { tipo: 'procesado' }));
            setDescargado(true);
        } catch (e) {
            setError(mensajeError(e, 'No se pudo generar la copia; vuelve a intentarlo.'));
        } finally {
            setDescargando(false);
        }
    };

    return (
        <Dialog open={open} disableEscapeKeyDown onClose={() => {}} maxWidth="sm" fullWidth>
            <DialogTitle>Paradas procesadas</DialogTitle>
            <DialogContent dividers>
                {resultado && (
                    <Typography gutterBottom>
                        Se actualizaron {resultado.estudiantesProcesados} estudiante(s){resultado.sinParadas ? ` (${resultado.sinParadas} quedaron sin paradas)` : ''}.
                    </Typography>
                )}
                <Typography gutterBottom>Descarga la copia de lo procesado antes de cerrar. Es tu respaldo de lo que quedó en la plataforma.</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                {descargado && <Alert severity="success">Copia descargada.</Alert>}
            </DialogContent>
            <DialogActions>
                <Button variant={descargado ? 'outlined' : 'contained'} startIcon={descargando ? <CircularProgress size={16} /> : <CloudDownload />} disabled={descargando} onClick={descargar}>
                    {descargado ? 'Descargar otra vez' : 'Descargar copia procesada'}
                </Button>
                <Button variant="contained" disabled={!descargado} onClick={onTerminar}>Terminar</Button>
            </DialogActions>
        </Dialog>
    );
}
