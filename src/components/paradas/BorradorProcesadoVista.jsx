// src/components/paradas/BorradorProcesadoVista.jsx
import React from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { CloudDownload, CloudUpload, Replay } from '@mui/icons-material';
import { fechaCorta, fechaHora } from './textoParada';

export default function BorradorProcesadoVista({ draft, contexto, ocupado, onDescargar, onIniciarNuevo, onTomarControl, onCargarArchivo, onDescartar, onDescargarActual }) {
    const b = draft.borrador;
    const otroIniciando = b.bloqueo?.vigente;
    const activo = contexto?.cicloActivo;
    return (
        <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, mx: 'auto', mt: 3 }}>
            <Typography variant="h6" gutterBottom>
                Último procesamiento {fechaHora(b.procesadoAt)} por {b.procesadoBy?.nombre || 'un usuario'} — {b.estudiantesProcesados ?? 0} estudiante(s)
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Se guardó un respaldo del estado anterior. Se eliminará automáticamente el {fechaCorta(b.eliminaAt)}, junto con el respaldo.
            </Typography>
            {otroIniciando && (
                <Alert severity="warning" sx={{ my: 2 }}>{b.bloqueo.nombre || 'Otro usuario'} está iniciando un trabajo nuevo (desde {fechaHora(b.bloqueo.heartbeatAt)}).</Alert>
            )}
            {!activo && <Alert severity="info" sx={{ my: 2 }}>Este ciclo escolar está inactivo: solo puedes descargar.</Alert>}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                <Button variant="outlined" startIcon={<CloudDownload />} disabled={ocupado} onClick={() => onDescargar('previo')}>Descargar estado anterior</Button>
                <Button variant="outlined" startIcon={<CloudDownload />} disabled={ocupado} onClick={() => onDescargar('procesado')}>Descargar copia procesada</Button>
                <Button variant="text" startIcon={<CloudDownload />} disabled={ocupado} onClick={onDescargarActual}>Descargar estado actual</Button>
            </Box>
            {activo && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                    {otroIniciando
                        ? <Button variant="contained" disabled={ocupado} onClick={onTomarControl}>Tomar control</Button>
                        : <Button variant="contained" startIcon={<Replay />} disabled={ocupado} onClick={onIniciarNuevo}>Iniciar nuevo trabajo</Button>}
                    <Button variant="outlined" startIcon={<CloudUpload />} disabled={ocupado || otroIniciando} onClick={onCargarArchivo}>Cargar punto de guardado</Button>
                    <Button color="error" disabled={ocupado || otroIniciando} onClick={onDescartar}>Descartar procesado y respaldo</Button>
                </Box>
            )}
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
                Para revertir: descarga el estado anterior, cárgalo con "Cargar punto de guardado" y procésalo.
            </Typography>
        </Paper>
    );
}
