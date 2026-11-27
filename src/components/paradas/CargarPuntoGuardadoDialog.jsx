// src/components/paradas/CargarPuntoGuardadoDialog.jsx
// Carga: leer archivo → POST /export/unseal (servidor descifra y verifica colegio/ciclo) →
// comparar hojas visibles con la vista regenerada desde el payload → si difieren, flujo de Excel
// editado. Devuelve familias listas para reconciliar; el editor reemplaza el borrador completo.
import React, { useEffect, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import AppDialog from '../dialogs/AppDialog';
import FileField from '../form/FileField';
import paradasService, { mensajeError } from '../../services/paradasService';
import { leerExcel } from './excelPuntoGuardado';
import { filasDeVista, mismasFilas } from './excelNormalizar';
import ExcelEditadoDialog from './ExcelEditadoDialog';

export default function CargarPuntoGuardadoDialog({ open, schoolId, reemplaza, onCancelar, onCargado }) {
    const [archivo, setArchivo] = useState(null);
    const [leyendo, setLeyendo] = useState(false);
    const [error, setError] = useState(null);
    const [editado, setEditado] = useState(null); // { filas, payload }

    // Al abrir y al cerrar: el diálogo de "Excel editado" cuelga de `editado` y, si solo se limpiara al abrir,
    // seguiría visible después de cargar al borrador o cancelar (el padre solo apaga `open`).
    useEffect(() => { setArchivo(null); setError(null); setEditado(null); }, [open]);

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
            <AppDialog
                open={open && !editado}
                onClose={onCancelar}
                title="Cargar punto de guardado"
                icon={<UploadFile />}
                size="sm"
                onSubmit={cargar}
                submitLabel={reemplaza ? 'Reemplazar y cargar' : 'Cargar'}
                submitting={leyendo}
                submitDisabled={!archivo}
            >
                <Typography variant="body2" gutterBottom>
                    Elige un archivo .xlsx descargado de esta plataforma (punto de guardado, estado actual, estado anterior o copia procesada) de este mismo colegio y ciclo.
                </Typography>
                {reemplaza && <Alert severity="warning" sx={{ my: 2 }}>{reemplaza.texto}</Alert>}
                <Box sx={{ my: 2 }}>
                    <FileField accept=".xlsx" file={archivo} onChange={setArchivo} maxSizeMb={null} />
                </Box>
                {error && <Alert severity="error">{error}</Alert>}
            </AppDialog>
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
