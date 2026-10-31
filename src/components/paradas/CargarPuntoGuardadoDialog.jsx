// src/components/paradas/CargarPuntoGuardadoDialog.jsx
// Carga: leer archivo → POST /export/unseal (servidor descifra y verifica colegio/ciclo) →
// comparar hojas visibles con la vista regenerada desde el payload → si difieren, flujo de Excel
// editado. Devuelve familias listas para reconciliar; el editor reemplaza el borrador completo.
import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import paradasService, { mensajeError } from '../../services/paradasService';
import { leerExcel } from './excelPuntoGuardado';
import { filasDeVista, mismasFilas } from './excelNormalizar';
import ExcelEditadoDialog from './ExcelEditadoDialog';

export default function CargarPuntoGuardadoDialog({ open, schoolId, reemplaza, onCancelar, onCargado }) {
    const [archivo, setArchivo] = useState(null);
    const [leyendo, setLeyendo] = useState(false);
    const [error, setError] = useState(null);
    const [editado, setEditado] = useState(null); // { filas, payload }

    useEffect(() => { if (open) { setArchivo(null); setError(null); setEditado(null); } }, [open]);

    const cargar = async () => {
        setLeyendo(true);
        setError(null);
        try {
            const { sello, filas } = await leerExcel(archivo);
            const payload = await paradasService.abrirArchivo(schoolId, sello);
            const familias = payload.familias.map(({ ref, ...f }) => ({ ...f, students: f.students.map(({ ref: _r, ...s }) => s) }));
            if (mismasFilas(filas.map(f => f.celdas), filasDeVista(payload))) {
                onCargado({ familias, importadoEditado: false, resumenExcel: null });
            } else {
                setEditado({ filas, payload });
            }
        } catch (e) {
            setError(e.code && !e.response ? e.message : mensajeError(e, 'No se pudo cargar el archivo.'));
        } finally {
            setLeyendo(false);
        }
    };

    return (
        <>
            <Dialog open={open && !editado} onClose={onCancelar} maxWidth="sm" fullWidth>
                <DialogTitle>Cargar punto de guardado</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" gutterBottom>
                        Elige un archivo .xlsx descargado de esta plataforma (punto de guardado, estado actual, estado anterior o copia procesada) de este mismo colegio y ciclo.
                    </Typography>
                    {reemplaza && <Alert severity="warning" sx={{ my: 2 }}>{reemplaza.texto}</Alert>}
                    <Box sx={{ my: 2 }}>
                        <Button variant="outlined" component="label" startIcon={<UploadFile />}>
                            Elegir archivo
                            <input hidden type="file" accept=".xlsx" onChange={e => setArchivo(e.target.files?.[0] || null)} />
                        </Button>
                        <Typography variant="body2" sx={{ mt: 1 }}>{archivo ? archivo.name : 'Ningún archivo elegido'}</Typography>
                    </Box>
                    {error && <Alert severity="error">{error}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCancelar}>Cancelar</Button>
                    <Button variant="contained" disabled={!archivo || leyendo} onClick={cargar} startIcon={leyendo ? <CircularProgress size={16} /> : null}>
                        {reemplaza ? 'Reemplazar y cargar' : 'Cargar'}
                    </Button>
                </DialogActions>
            </Dialog>
            <ExcelEditadoDialog
                open={!!editado}
                filas={editado?.filas || []}
                payload={editado?.payload || { familias: [] }}
                onCancelar={onCancelar}
                onAceptar={resultado => onCargado({ familias: resultado.familias, importadoEditado: true, resumenExcel: resultado })}
            />
        </>
    );
}
