// src/utils/tableSort.js
// Orden de filas en el cliente. Reemplaza las copias de descendingComparator / getComparator / stableSort.
// Los vacíos van siempre al final, en los dos sentidos. El orden es estable.

const isEmpty = (value) => value === null || value === undefined || value === '';

const toComparable = (value, type) => {
    if (isEmpty(value)) {
        return null;
    }
    if (type === 'date') {
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? null : time;
    }
    if (typeof value === 'number') {
        return Number.isNaN(value) ? null : value;
    }
    return String(value);
};

const compare = (a, b, type) => {
    if (type === 'date' || (typeof a === 'number' && typeof b === 'number')) {
        return a - b;
    }
    // numeric: '2' < '10'; sensitivity base: 'á' = 'a' = 'A'
    return String(a).localeCompare(String(b), 'es', { sensitivity: 'base', numeric: true });
};

export const sortRows = (rows, { orderBy, order = 'asc', type = 'string', getValue } = {}) => {
    if (!orderBy || !Array.isArray(rows)) {
        return rows;
    }
    const read = getValue || ((row) => row?.[orderBy]);
    const direction = order === 'desc' ? -1 : 1;
    return rows
        .map((row, index) => ({ row, index, value: toComparable(read(row, orderBy), type) }))
        .sort((x, y) => {
            if (x.value === null && y.value === null) {
                return x.index - y.index;
            }
            if (x.value === null) {
                return 1;
            }
            if (y.value === null) {
                return -1;
            }
            const result = compare(x.value, y.value, type) * direction;
            return result !== 0 ? result : x.index - y.index;
        })
        .map((entry) => entry.row);
};
