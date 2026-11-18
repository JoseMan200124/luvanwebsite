// src/hooks/useTableState.js
// Estado único de paginación y orden de una tabla. resetPage() se conecta al onApplied de useFilters.
// clearable: el tercer clic sobre la misma columna quita el orden (asc → desc → sin orden), para tablas
// cuyo orden original tiene sentido propio (por ejemplo, el orden de las paradas).
import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_ROWS_PER_PAGE } from '../components/table/tableConfig';

const useTableState = ({ defaultRowsPerPage = DEFAULT_ROWS_PER_PAGE, defaultOrderBy = '', defaultOrder = 'asc', clearable = false } = {}) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
    const [orderBy, setOrderBy] = useState(defaultOrderBy);
    const [order, setOrder] = useState(defaultOrder);

    const onSort = useCallback((columnId) => {
        if (clearable && orderBy === columnId && order === 'desc') {
            setOrderBy('');
            setOrder('asc');
        } else {
            setOrder(orderBy === columnId && order === 'asc' ? 'desc' : 'asc');
            setOrderBy(columnId);
        }
        setPage(0);
    }, [clearable, order, orderBy]);

    const onPageChange = useCallback((_event, newPage) => setPage(newPage), []);

    const onRowsPerPageChange = useCallback((event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    }, []);

    const resetPage = useCallback(() => setPage(0), []);

    const setSort = useCallback((columnId, direction = 'asc') => {
        setOrderBy(columnId);
        setOrder(direction);
        setPage(0);
    }, []);

    const paginate = useCallback(
        (rows) => (rows || []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [page, rowsPerPage]
    );

    const paginationProps = useMemo(
        () => ({ page, rowsPerPage, onPageChange, onRowsPerPageChange }),
        [page, rowsPerPage, onPageChange, onRowsPerPageChange]
    );

    const sortProps = useMemo(() => ({ order, orderBy, onSort }), [order, orderBy, onSort]);

    return { page, rowsPerPage, order, orderBy, setPage, resetPage, setSort, onSort, paginate, paginationProps, sortProps };
};

export default useTableState;
