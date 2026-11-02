// src/components/paradas/DescargarEstadoActualDialog.jsx
// Excel sellado desde los slots reales (sin borrador). Disponible también en ciclos inactivos.
// "Seleccionar todas" sin desmarcar ni buscar → se manda estado 'todas' y el servidor consulta directo.
import React from 'react';
import paradasService, { mensajeError } from '../../services/paradasService';
import { descargarExcel } from './excelPuntoGuardado';
import SeleccionFamiliasDialog from './SeleccionFamiliasDialog';

export default function DescargarEstadoActualDialog({ open, schoolId, onCerrar, onAviso }) {
    const confirmar = async (sel) => {
        try {
            const exp = await paradasService.exportar(schoolId, sel.todasDelFiltro
                ? { tipo: 'actual', estado: 'todas' }
                : { tipo: 'actual', familyIds: sel.familyIds });
            await descargarExcel(exp);
            onAviso(exp.excluidas.length
                ? { severity: 'warning', texto: `Descargado. ${exp.excluidas.length} familia(s) ya no pertenecen al colegio y no se incluyeron.` }
                : { severity: 'success', texto: 'Estado actual descargado.' });
            onCerrar();
        } catch (e) {
            onAviso({ severity: 'error', texto: mensajeError(e, 'No se pudo descargar el estado actual.') });
        }
    };
    return (
        <SeleccionFamiliasDialog
            open={open}
            schoolId={schoolId}
            titulo="Descargar estado actual"
            descripcion="Genera un Excel con las paradas que hoy tiene la plataforma para las familias elegidas. Sirve como respaldo o como punto de partida para cargarlo después."
            textoConfirmar="Descargar Excel"
            permitirTodasDelFiltro
            onConfirmar={confirmar}
            onCancelar={onCerrar}
        />
    );
}
