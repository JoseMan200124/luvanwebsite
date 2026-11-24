// src/components/table/AppTablePagination.jsx
// Paginación única: 10 filas por defecto, [10, 25, 50, 100], textos en español.
// En pantallas angostas la barra pasa a dos líneas para que las flechas de página no queden fuera de la vista.
import React from 'react';
import { TablePagination } from '@mui/material';
import { ROWS_PER_PAGE_OPTIONS, getItemAriaLabel, labelDisplayedRows } from './tableConfig';

const MOBILE_WRAP_SX = {
    overflow: 'visible',
    '& .MuiTablePagination-toolbar': {
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        justifyContent: { xs: 'flex-end', sm: 'flex-start' },
        rowGap: { xs: 0.5, sm: 0 },
        px: { xs: 1, sm: 2 },
    },
    '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } },
    '& .MuiTablePagination-actions': { ml: { xs: 1, sm: 2.5 } },
};

const AppTablePagination = ({ count, page, rowsPerPage, onPageChange, onRowsPerPageChange, sx, ...rest }) => {
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
            sx={{ ...MOBILE_WRAP_SX, ...sx }}
            {...rest}
        />
    );
};

export default AppTablePagination;
