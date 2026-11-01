// src/components/paradas/ParadaFila.jsx
import React, { memo } from 'react';
import { Box, Button, Checkbox, FormControlLabel, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { ContentCopy, DeleteOutline } from '@mui/icons-material';
import { DIAS, HORA_RE, MAX_NOTA, rutasParaFranja } from './paradasModel';

function ParadaFila({ parada, indice, errores, avisos, contexto, deshabilitado, onCampo, onDia, onDuplicar, onQuitar }) {
    const error = (campo) => errores.find(e => e.indice === indice && e.campo === campo)?.mensaje;
    const aviso = avisos.find(a => a.indice === indice && a.campo === 'time')?.mensaje;
    // El selector nativo deja en blanco lo que no sea HH:mm (p. ej. "7.30" heredado): se muestra en el mensaje.
    const horaNoVisible = parada.time && !HORA_RE.test(parada.time) ? ` Valor actual: "${parada.time}".` : '';
    const rutas = rutasParaFranja(contexto, parada.franja);
    const rutaFuera = parada.routeNumber && !rutas.includes(parada.routeNumber);

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '150px 130px 150px minmax(160px, 1fr) auto auto' }, gap: 1, alignItems: 'start', py: 1, borderBottom: '1px dashed', borderColor: 'divider' }}>
            <TextField
                select size="small" label="Franja" value={parada.franja || ''} disabled={deshabilitado}
                error={!!error('franja')} helperText={error('franja') || ' '}
                onChange={e => onCampo(indice, 'franja', e.target.value)}
            >
                {contexto.franjas.map(f => <MenuItem key={f.code} value={f.code}>{f.code} · {f.name}</MenuItem>)}
            </TextField>
            <TextField
                select size="small" label="Ruta" value={parada.routeNumber || ''} disabled={deshabilitado}
                error={!!error('routeNumber')} helperText={error('routeNumber') || (parada.franja ? `Rutas con franja ${parada.franja}` : 'Elige primero la franja')}
                onChange={e => onCampo(indice, 'routeNumber', e.target.value)}
            >
                {rutas.map(r => <MenuItem key={r} value={r}>Ruta {r}</MenuItem>)}
                {rutaFuera && <MenuItem value={parada.routeNumber} disabled>Ruta {parada.routeNumber} (no válida)</MenuItem>}
            </TextField>
            {/* Selector nativo (hora, minutos, AM/PM) como en la asignación individual de paradas; el valor sigue siendo "HH:mm". */}
            <TextField
                size="small" type="time" label="Hora parada" value={parada.time || ''} disabled={deshabilitado}
                InputLabelProps={{ shrink: true }}
                error={!!error('time')} helperText={error('time') ? `${error('time')}${horaNoVisible}` : (aviso || ' ')}
                FormHelperTextProps={{ sx: aviso && !error('time') ? { color: 'warning.main' } : undefined }}
                onChange={e => onCampo(indice, 'time', e.target.value)}
            />
            <TextField
                size="small" label="Nota (opcional)" value={parada.note || ''} disabled={deshabilitado}
                inputProps={{ maxLength: MAX_NOTA }} error={!!error('note')} helperText={error('note') || 'Punto de referencia de la parada'}
                onChange={e => onCampo(indice, 'note', e.target.value)}
            />
            <Box>
                <Typography variant="caption" color={error('days') ? 'error' : 'text.secondary'}>Días</Typography>
                <Box sx={{ display: 'flex' }}>
                    {DIAS.map(d => (
                        <Tooltip key={d.key} title={d.nombre}>
                            <FormControlLabel
                                sx={{ m: 0 }} labelPlacement="top" label={d.corto}
                                control={<Checkbox size="small" checked={parada.days.includes(d.key)} disabled={deshabilitado} onChange={() => onDia(indice, d.key)} />}
                            />
                        </Tooltip>
                    ))}
                </Box>
                {error('days') && <Typography variant="caption" color="error">{error('days')}</Typography>}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 0.5 }}>
                <Button size="small" startIcon={<ContentCopy />} disabled={deshabilitado} onClick={() => onDuplicar(indice)}>Duplicar</Button>
                <Button size="small" color="error" startIcon={<DeleteOutline />} disabled={deshabilitado} onClick={() => onQuitar(indice)}>Quitar</Button>
            </Box>
        </Box>
    );
}

export default memo(ParadaFila);
