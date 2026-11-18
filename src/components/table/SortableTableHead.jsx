// src/components/table/SortableTableHead.jsx
// Encabezado único de tabla con el aspecto estándar de MUI. Una columna es ordenable solo con sortable: true.
// - column.sx: estilos propios de una celda (por ejemplo, bordes de separación).
// - cellSx / rowSx: estilos de todas las celdas o de la fila (negrita, fondo), para conservar el aspecto de cada pantalla.
// - showSortIcons: muestra siempre las flechas de las columnas ordenables, no solo al pasar el mouse.
import React from 'react';
import { TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';

const ALWAYS_VISIBLE_ICON_SX = { '& .MuiTableSortLabel-icon': { opacity: 1 } };

const SortableTableHead = ({ columns, order, orderBy, onSort, cellSx, rowSx, showSortIcons = false }) => (
    <TableHead>
        <TableRow sx={rowSx}>
            {columns.map((column) => (
                <TableCell
                    key={column.id}
                    align={column.align || 'left'}
                    sortDirection={orderBy === column.id ? order : false}
                    sx={{
                        width: column.width,
                        minWidth: column.minWidth,
                        ...cellSx,
                        ...column.sx,
                    }}
                >
                    {column.sortable && onSort ? (
                        <TableSortLabel
                            active={orderBy === column.id}
                            direction={orderBy === column.id ? order : 'asc'}
                            onClick={() => onSort(column.id)}
                            sx={showSortIcons ? ALWAYS_VISIBLE_ICON_SX : undefined}
                        >
                            {column.label}
                        </TableSortLabel>
                    ) : column.label}
                </TableCell>
            ))}
        </TableRow>
    </TableHead>
);

export default SortableTableHead;
