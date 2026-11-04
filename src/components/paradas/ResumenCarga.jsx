// src/components/paradas/ResumenCarga.jsx
import React from 'react';
import { Alert, Typography } from '@mui/material';

export default function ResumenCarga({ resumen, onCerrar }) {
    if (!resumen) return null;
    const conCambiosPerdidos = resumen.quitados.filter(q => q.teniaCambios).length;
    const lineas = [
        resumen.actualizados.length && `${resumen.actualizados.length} estudiante(s) actualizados con datos recientes de la plataforma.`,
        resumen.conflictos.length && `${resumen.conflictos.length} estudiante(s) en conflicto: resuélvelos abajo.`,
        resumen.agregados.length && `${resumen.agregados.length} estudiante(s) nuevos en sus familias, agregados sin cambios.`,
        resumen.quitados.length && `${resumen.quitados.length} estudiante(s) ya no están en su familia y se quitaron${conCambiosPerdidos ? ` (${conCambiosPerdidos} tenían cambios que se descartaron)` : ''}.`,
        resumen.excluidas.length && `${resumen.excluidas.length} familia(s) ya no pertenecen a este colegio o ciclo y se quitaron: ${resumen.excluidas.map(e => e.familyLastName).join(', ')}.`,
    ].filter(Boolean);
    return (
        <Alert severity={resumen.conflictos.length ? 'warning' : 'info'} onClose={onCerrar} sx={{ mb: 2 }}>
            <Typography fontWeight={600}>Al abrir se compararon tus datos con la plataforma:</Typography>
            {lineas.map(l => <Typography key={l} variant="body2">• {l}</Typography>)}
        </Alert>
    );
}
