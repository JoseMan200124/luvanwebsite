// src/components/paradas/ExcelEditadoDialog.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography,
} from '@mui/material';
import { interpretarExcelEditado } from './excelEditado';

const RIESGOS = [
    'Nombres de familia modificados que ya no coinciden con la plataforma.',
    'Nombres de estudiante modificados o con errores de escritura.',
    'Grados modificados o inexistentes en el colegio.',
    'Horas de parada con formato inválido o mal convertidas por Excel.',
    'Números de ruta inexistentes o que no pertenecen al colegio.',
    'Horas de parada que no corresponden al horario de la ruta o franja.',
    'Franjas no permitidas para la ruta.',
    'Filas copiadas, duplicadas o borradas por error (un estudiante sin filas quedará sin paradas).',
    'Códigos de referencia ocultos borrados o alterados.',
];

export function ResumenExcel({ resumen, onCerrar }) {
    if (!resumen) return null;
    return (
        <Alert severity="warning" onClose={onCerrar} sx={{ mb: 2 }}>
            <Typography fontWeight={600}>Resultado de la carga del Excel editado</Typography>
            <Typography variant="body2">• {resumen.cambiados.length} estudiante(s) con cambios (filtro "Editados en Excel").</Typography>
            {!!resumen.sinParadas.length && <Typography variant="body2">• <strong>{resumen.sinParadas.length} estudiante(s) quedarán sin paradas:</strong> {resumen.sinParadas.map(s => s.fullName).join(', ')}.</Typography>}
            {!!resumen.errores.length && <Typography variant="body2">• {new Set(resumen.errores.map(e => e.numero)).size} fila(s) con error de formato (quedaron marcadas en el editor).</Typography>}
            {!!resumen.descartadas.length && <Typography variant="body2">• {resumen.descartadas.length} fila(s) descartadas.</Typography>}
            {resumen.avisos.map(a => <Typography key={`${a.numero}-${a.tipo}`} variant="body2">• {a.mensaje}</Typography>)}
            {resumen.errores.map((e, i) => <Typography key={`e${e.numero}-${i}`} variant="body2">• {e.mensaje}</Typography>)}
        </Alert>
    );
}

export default function ExcelEditadoDialog({ open, filas, payload, onCancelar, onAceptar }) {
    const [paso, setPaso] = useState('confirmar');
    const [entiendo, setEntiendo] = useState(false);
    const [asignaciones, setAsignaciones] = useState({});
    const [ignorarDias, setIgnorarDias] = useState(() => new Set());

    useEffect(() => { if (open) { setPaso('confirmar'); setEntiendo(false); setAsignaciones({}); setIgnorarDias(new Set()); } }, [open]);

    const resultado = useMemo(
        () => (open && paso === 'revisar' ? interpretarExcelEditado({ filas, payload, asignaciones, ignorarDias }) : null),
        [open, paso, filas, payload, asignaciones, ignorarDias],
    );

    return (
        <Dialog open={open} maxWidth="md" fullWidth onClose={onCancelar}>
            <DialogTitle>Este archivo fue editado fuera de la plataforma</DialogTitle>
            {paso === 'confirmar' || !resultado ? (
                <>
                    <DialogContent dividers>
                        <Typography gutterBottom>Editar el Excel directamente puede causar múltiples conflictos, entre ellos:</Typography>
                        {RIESGOS.map(r => <Typography key={r} variant="body2">• {r}</Typography>)}
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            Si continúas, la plataforma identificará cada fila por su código oculto, ignorará nombres y grados editados, validará todo y te mostrará los cambios antes de cargarlos al borrador. Nada se aplica a las paradas reales hasta que proceses.
                        </Typography>
                        <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={entiendo} onChange={e => setEntiendo(e.target.checked)} />} label="Entiendo los riesgos y quiero revisar los cambios del archivo editado" />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onCancelar}>Cancelar</Button>
                        <Button variant="contained" disabled={!entiendo} onClick={() => setPaso('revisar')}>Revisar cambios</Button>
                    </DialogActions>
                </>
            ) : (
                <>
                    <DialogContent dividers>
                        <Typography gutterBottom><strong>{resultado.cambiados.length}</strong> estudiante(s) con cambios · <strong>{resultado.sinParadas.length}</strong> quedarán sin paradas · <strong>{new Set(resultado.errores.map(e => e.numero)).size}</strong> fila(s) con error de formato · <strong>{resultado.avisos.length}</strong> aviso(s).</Typography>
                        {!!resultado.pendientes.length && (
                            <Alert severity="error" sx={{ my: 2 }}>
                                Hay {resultado.pendientes.length} fila(s) que no se pudieron usar. Decide qué hacer con cada una para continuar.
                            </Alert>
                        )}
                        {resultado.pendientes.map(p => (
                            <Box key={p.numero} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    Fila {p.numero}: {p.familia || '(sin familia)'} — {p.estudiante || '(sin estudiante)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    {p.motivo === 'dia_invalido' && `Tiene días con valores no válidos (${p.detalle}). Usa X para marcar un día.`}
                                    {p.motivo === 'ambiguo' && 'Hay varios estudiantes con ese nombre en el archivo. Elige a cuál corresponde.'}
                                    {p.motivo === 'sin_identificar' && 'No se pudo identificar al estudiante. Si no está en el archivo, agrégalo desde la plataforma ("Agregar familias") y descarta esta fila.'}
                                </Typography>
                                {p.motivo === 'dia_invalido' ? (
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button size="small" variant="outlined" onClick={() => setIgnorarDias(s => new Set(s).add(p.numero))}>Usar la fila sin esos días</Button>
                                        <Button size="small" color="error" onClick={() => setAsignaciones(a => ({ ...a, [p.numero]: 'descartar' }))}>Descartar fila</Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <TextField size="small" select label="Asignar a" value="" sx={{ minWidth: 300 }} onChange={e => setAsignaciones(a => ({ ...a, [p.numero]: e.target.value }))}>
                                            {p.candidatos.map(c => <MenuItem key={c.ref} value={c.ref}>{c.fullName} — familia {c.familyLastName}</MenuItem>)}
                                        </TextField>
                                        <Button size="small" color="error" onClick={() => setAsignaciones(a => ({ ...a, [p.numero]: 'descartar' }))}>Descartar fila</Button>
                                    </Box>
                                )}
                            </Box>
                        ))}
                        <ResumenExcel resumen={resultado} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onCancelar}>Cancelar</Button>
                        <Button variant="contained" disabled={!!resultado.pendientes.length} onClick={() => onAceptar(resultado)}>Cargar al borrador</Button>
                    </DialogActions>
                </>
            )}
        </Dialog>
    );
}
