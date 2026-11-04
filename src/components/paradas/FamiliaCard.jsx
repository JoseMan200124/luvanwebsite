// src/components/paradas/FamiliaCard.jsx
import React, { memo, useCallback, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Paper, Typography } from '@mui/material';
import { Add, ExpandLess, ExpandMore } from '@mui/icons-material';
import { paradaNueva, revisarEstudiante, revisarFamilia } from './paradasModel';
import ListaParadasComparada from './ListaParadasComparada';
import ParadaFila from './ParadaFila';

function EstudianteParadas({ familyDetailId, est, contexto, soloLectura, despachar }) {
    const [verCambios, setVerCambios] = useState(false);
    const r = revisarEstudiante(est, contexto);
    const bloqueado = soloLectura || r.conflictoPendiente;
    const { studentId } = est;
    const a = { familyDetailId, studentId };
    // Callbacks estables: sin ellos memo(ParadaFila) no evita redibujar las filas de los hermanos.
    const onCampo = useCallback((indice, campo, valor) => despachar({ tipo: 'editarParada', familyDetailId, studentId, indice, campo, valor }), [despachar, familyDetailId, studentId]);
    const onDia = useCallback((indice, dia) => despachar({ tipo: 'alternarDia', familyDetailId, studentId, indice, dia }), [despachar, familyDetailId, studentId]);
    const onDuplicar = useCallback(indice => despachar({ tipo: 'duplicarParada', familyDetailId, studentId, indice }), [despachar, familyDetailId, studentId]);
    const onQuitar = useCallback(indice => despachar({ tipo: 'quitarParada', familyDetailId, studentId, indice }), [despachar, familyDetailId, studentId]);

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography fontWeight={600}>{est.fullName}</Typography>
                <Typography variant="body2" color="text.secondary">{est.grade}</Typography>
                {est.touched && <Chip size="small" color="primary" label="Modificado" />}
                {r.sinParadas && <Chip size="small" color="warning" label="Sin paradas" />}
                {r.incompleta && <Chip size="small" variant="outlined" color="warning" label="Incompleta" />}
                {est.editadoEnExcel && <Chip size="small" variant="outlined" label="Editado en Excel" />}
                {r.conflictoPendiente && <Chip size="small" color="warning" label="Conflicto" />}
                <Box sx={{ flex: 1 }} />
                {est.paradasActuales && <Button size="small" onClick={() => setVerCambios(true)}>Ver cambios</Button>}
            </Box>
            {r.conflictoPendiente && (
                <Alert severity="warning" sx={{ mt: 1 }}>Este estudiante cambió en la plataforma mientras se editaba aquí. Resuélvelo en el panel "Conflictos" de arriba para poder editarlo.</Alert>
            )}
            {r.incompleta && (
                <Alert severity="info" sx={{ mt: 1 }}>Tiene una parada incompleta en la plataforma. No bloquea el procesamiento mientras no lo edites; si lo editas, hay que completarla.</Alert>
            )}
            {est.paradas.map((p, i) => (
                <ParadaFila
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    parada={p} indice={i} errores={r.errores} avisos={r.avisos} contexto={contexto} deshabilitado={bloqueado}
                    onCampo={onCampo} onDia={onDia} onDuplicar={onDuplicar} onQuitar={onQuitar}
                />
            ))}
            {!est.paradas.length && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    {est.touched ? 'Quedará sin paradas al procesar (por ejemplo, si dejó de usar el transporte).' : 'Sin paradas registradas.'}
                </Typography>
            )}
            {!bloqueado && (
                <Button size="small" startIcon={<Add />} sx={{ mt: 1 }} onClick={() => despachar({ tipo: 'agregarParada', ...a, parada: paradaNueva() })}>
                    Agregar parada
                </Button>
            )}
            <Dialog open={verCambios} onClose={() => setVerCambios(false)} maxWidth="md" fullWidth>
                <DialogTitle>Cambios de {est.fullName}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Resaltado: lo que es distinto entre ambas columnas.</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}><ListaParadasComparada titulo="Ahora en la plataforma" paradas={est.paradasActuales || []} otras={est.paradas} /></Grid>
                        <Grid item xs={12} md={6}><ListaParadasComparada titulo="En este borrador" paradas={est.paradas} otras={est.paradasActuales || []} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions><Button onClick={() => setVerCambios(false)}>Cerrar</Button></DialogActions>
            </Dialog>
        </Box>
    );
}

function FamiliaCard({ familia, contexto, expandida, soloLectura, onExpandir, despachar, onQuitarFamilia }) {
    const r = revisarFamilia(familia, contexto);
    return (
        <Paper variant="outlined" sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, flexWrap: 'wrap' }}>
                <Typography fontWeight={600} sx={{ flex: 1, minWidth: 160 }}>Familia {familia.familyLastName}</Typography>
                <Chip size="small" label={`${familia.students.length} estudiante(s)`} />
                {r.modificados > 0 && <Chip size="small" color="primary" label={`${r.modificados} modificado(s)`} />}
                {r.conErrores > 0 && <Chip size="small" color="error" label={`${r.conErrores} con errores`} />}
                {r.conflictos > 0 && <Chip size="small" color="warning" label={`${r.conflictos} en conflicto`} />}
                {r.incompletas > 0 && <Chip size="small" variant="outlined" color="warning" label={`${r.incompletas} incompleta(s)`} />}
                <Button size="small" variant="outlined" endIcon={expandida ? <ExpandLess /> : <ExpandMore />} onClick={() => onExpandir(expandida ? null : familia.familyDetailId)}>
                    {expandida ? 'Ocultar paradas' : (soloLectura ? 'Ver paradas' : 'Ver y editar paradas')}
                </Button>
                {!soloLectura && <Button size="small" color="error" onClick={() => onQuitarFamilia(familia)}>Quitar familia</Button>}
            </Box>
            {expandida && (
                <Box sx={{ px: 2, pb: 2 }}>
                    {familia.students.map(est => (
                        <EstudianteParadas key={est.studentId} familyDetailId={familia.familyDetailId} est={est} contexto={contexto} soloLectura={soloLectura} despachar={despachar} />
                    ))}
                </Box>
            )}
        </Paper>
    );
}

export default memo(FamiliaCard);
