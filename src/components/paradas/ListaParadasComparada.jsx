// src/components/paradas/ListaParadasComparada.jsx
// Lista de paradas (consolidadas) resaltando las que no están en la otra versión. Una sola
// comparación visual para "Ver cambios" (FamiliaCard) y el panel de conflictos.
import React from 'react';
import { Box, Typography } from '@mui/material';
import { consolidar } from './paradasModel';
import { textoParada } from './textoParada';

export default function ListaParadasComparada({ titulo, paradas, otras }) {
    const otrasTexto = new Set(consolidar(otras).map(textoParada));
    const lista = consolidar(paradas);
    return (
        <Box>
            <Typography variant="subtitle2" gutterBottom>{titulo}</Typography>
            {!lista.length && <Typography variant="body2" color="text.secondary">Sin paradas</Typography>}
            {lista.map((p) => {
                const t = textoParada(p);
                return <Typography key={t} variant="body2" sx={!otrasTexto.has(t) ? { fontWeight: 700, bgcolor: 'warning.light', px: 0.5, borderRadius: 0.5 } : undefined}>{t}</Typography>;
            })}
        </Box>
    );
}
