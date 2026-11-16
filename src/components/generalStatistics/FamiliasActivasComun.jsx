// src/components/generalStatistics/FamiliasActivasComun.jsx
//
// Piezas compartidas por la pestaña "Familias activas" y su diálogo de detalle.
import React from 'react';
import { Chip, Tooltip } from '@mui/material';

// "Cierre" = datos guardados el día 1 del mes siguiente; "Calculado hoy" = mes sin cierre todavía.
export const ESTADOS = {
    CERRADO: { etiqueta: 'Cierre', color: 'success', ayuda: 'Cierre del mes: los datos se guardaron el día 1 del mes siguiente y ya no cambian.' },
    CALCULADO: { etiqueta: 'Calculado hoy', color: 'warning', ayuda: 'Mes sin cierre: se calcula con el historial actual y puede cambiar.' }
};

export const sxChip = { height: 20, fontSize: 11 };
export const numeros = { fontVariantNumeric: 'tabular-nums' };

// Colegio sin fechas del año escolar: los meses se estiman con su historial (ver "Meses del ciclo" del plan).
export const ChipFechasEstimadas = ({ sx }) => (
    <Tooltip title="Este colegio no tiene fechas de año escolar configuradas. Los meses van desde su primer movimiento hasta el mes en curso. Configura las fechas del colegio para que el reporte use el año escolar real.">
        <Chip size="small" variant="outlined" color="warning" label="Fechas estimadas" sx={{ ...sxChip, ...sx }} />
    </Tooltip>
);

// Colegio excluido del flujo de pagos: sus familias se cuentan igual (el reporte no depende de pagos).
export const ChipSinPagos = ({ sx }) => (
    <Tooltip title="Este colegio no usa el flujo de pagos. Sus familias se cuentan igual; solo no tienen suspensión por mora.">
        <Chip size="small" variant="outlined" label="Sin flujo de pagos" sx={{ ...sxChip, ...sx }} />
    </Tooltip>
);
