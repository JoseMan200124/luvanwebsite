// src/components/table/AppTablePagination.jsx
// Paginación única: 10 filas por defecto, [10, 25, 50, 100], textos en español.
import React from 'react';
import { TablePagination } from '@mui/material';
import { ROWS_PER_PAGE_OPTIONS, getItemAriaLabel, labelDisplayedRows } from './tableConfig';

const AppTablePagination = ({ count, page, rowsPerPage, onPageChange, onRowsPerPageChange, ...rest }) => {
    const total = count || 0;
    const lastPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
    return (
        <TablePagination
            component="div"
            count={total}
            page={Math.min(page, lastPage)}
            rowsPerPage={rowsPerPage}
            onPageChange={onPageChange}
            onRowsPerPageChange={onRowsPerPageChange}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={labelDisplayedRows}
            getItemAriaLabel={getItemAriaLabel}
            showFirstButton={lastPage > 4}
            showLastButton={lastPage > 4}
            {...rest}
        />
    );
};

export default AppTablePagination;
