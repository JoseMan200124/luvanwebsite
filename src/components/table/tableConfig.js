// src/components/table/tableConfig.js
// Opciones y textos únicos de la paginación de todas las tablas.

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_ROWS_PER_PAGE = 10;

export const labelDisplayedRows = ({ from, to, count }) => (
    `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
);

const ARIA_LABELS = {
    first: 'Primera página',
    last: 'Última página',
    next: 'Página siguiente',
    previous: 'Página anterior',
};

export const getItemAriaLabel = (type) => ARIA_LABELS[type] || type;
