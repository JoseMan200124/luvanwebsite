// src/components/paradas/ParadasToolbar.jsx
import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { fechaCorta } from './textoParada';

function textoGuardado(estado, ahora) {
    switch (estado.tipo) {
    case 'guardando': return 'Guardando…';
    case 'pendiente': return 'Cambios sin guardar: se guardan solos en unos segundos';
    case 'sin_conexion': return estado.mensaje;
    case 'error': return `No se pudo guardar: ${estado.mensaje} (se reintenta solo)`;
    case 'detenido': return 'Autoguardado detenido';
    default:
        return estado.guardadoAt ? `Guardado ✓ hace ${Math.max(0, Math.round((ahora - estado.guardadoAt) / 1000))} s` : 'Todo guardado';
    }
}

export default function ParadasToolbar({ estadoGuardado, eliminaAt, soloLectura, children }) {
    const [ahora, setAhora] = useState(Date.now());
    useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 5000); return () => clearInterval(id); }, []);
    const color = ['error', 'sin_conexion'].includes(estadoGuardado?.tipo) ? 'error' : 'text.secondary';
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 260 }}>
                {!soloLectura && <Typography variant="body2" color={color}>{textoGuardado(estadoGuardado, ahora)}</Typography>}
                {!soloLectura && <Typography variant="caption" color="text.secondary">Los cambios se guardan solos. Mientras tengas el editor abierto, nadie más puede modificar este borrador.</Typography>}
                {eliminaAt && <Typography variant="caption" display="block" color="text.secondary">Se eliminará automáticamente el {fechaCorta(eliminaAt)} si nadie lo edita.</Typography>}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{children}</Box>
        </Box>
    );
}
