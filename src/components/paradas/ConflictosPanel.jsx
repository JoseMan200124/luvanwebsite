// src/components/paradas/ConflictosPanel.jsx
// Conflicto = estudiante editado aquí que también cambió en la plataforma. Agrupado por familia;
// la elección de un estudiante no afecta a sus hermanos. Reversible hasta procesar (en la sesión).
import React from 'react';
import { Box, Button, Grid, Paper, Typography } from '@mui/material';
import ListaParadasComparada from './ListaParadasComparada';

export default function ConflictosPanel({ familias, soloLectura, despachar }) {
    const conConflicto = familias.filter(f => f.students.some(s => s.conflicto));
    if (!conConflicto.length) return null;
    const pendientes = conConflicto.reduce((n, f) => n + f.students.filter(s => s.conflicto && !s.conflicto.eleccion).length, 0);

    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'warning.main' }}>
            <Typography variant="h6">Conflictos {pendientes ? `— faltan ${pendientes} estudiante(s) por resolver` : '— todos resueltos'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Estos estudiantes se editaron aquí y también cambiaron en la plataforma después. Elige qué versión conservar para cada uno.
                No se puede procesar mientras quede alguno sin resolver.
            </Typography>
            {!soloLectura && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={() => despachar({ tipo: 'resolverTodos', eleccion: 'archivo' })}>Todos: usar la versión del borrador</Button>
                    <Button variant="outlined" onClick={() => despachar({ tipo: 'resolverTodos', eleccion: 'actual' })}>Todos: usar la versión actual</Button>
                </Box>
            )}
            {conConflicto.map(f => (
                <Paper key={f.familyDetailId} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Typography fontWeight={600}>Familia {f.familyLastName}</Typography>
                    {f.students.filter(s => s.conflicto).map(s => (
                        <Box key={s.studentId} sx={{ mt: 1.5 }}>
                            <Typography>{s.fullName}</Typography>
                            <Grid container spacing={2} sx={{ my: 0.5 }}>
                                <Grid item xs={12} md={6}><ListaParadasComparada titulo="Versión del borrador / archivo" paradas={s.conflicto.paradasArchivo} otras={s.conflicto.paradasActual} /></Grid>
                                <Grid item xs={12} md={6}><ListaParadasComparada titulo="Versión actual en la plataforma" paradas={s.conflicto.paradasActual} otras={s.conflicto.paradasArchivo} /></Grid>
                            </Grid>
                            {!soloLectura && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button size="small" variant={s.conflicto.eleccion === 'archivo' ? 'contained' : 'outlined'} onClick={() => despachar({ tipo: 'resolverConflicto', familyDetailId: f.familyDetailId, studentId: s.studentId, eleccion: 'archivo' })}>Usar versión del borrador</Button>
                                    <Button size="small" variant={s.conflicto.eleccion === 'actual' ? 'contained' : 'outlined'} onClick={() => despachar({ tipo: 'resolverConflicto', familyDetailId: f.familyDetailId, studentId: s.studentId, eleccion: 'actual' })}>Usar versión actual</Button>
                                </Box>
                            )}
                        </Box>
                    ))}
                </Paper>
            ))}
        </Paper>
    );
}
