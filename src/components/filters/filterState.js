// src/components/filters/filterState.js
// Lógica pura de las barras de filtros (sin React): valores iniciales, dependencias, conteo de activos y URL.

export const isEmptyValue = (value) => {
    if (value === undefined || value === null || value === '') {
        return true;
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    if (typeof value === 'object') {
        return Object.values(value).every((item) => item === undefined || item === null || item === '');
    }
    return false;
};

export const valuesEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const resolveInitial = (field) => (typeof field.initial === 'function' ? field.initial() : field.initial);

export const getInitialValues = (fields) => fields.reduce((acc, field) => {
    acc[field.key] = resolveInitial(field);
    return acc;
}, {});

const getParents = (field) => [].concat(field.dependsOn || []);

// Claves que dependen (directa o indirectamente) de `key` vía `dependsOn`.
export const getDependentKeys = (fields, key) => {
    const result = [];
    const visit = (parentKey) => {
        fields.forEach((field) => {
            if (getParents(field).includes(parentKey) && !result.includes(field.key)) {
                result.push(field.key);
                visit(field.key);
            }
        });
    };
    visit(key);
    return result;
};

// Cambia un valor y, si cambió de verdad, devuelve sus dependientes a su valor inicial.
export const setFieldValue = (fields, values, key, value) => {
    const next = { ...values, [key]: value };
    if (valuesEqual(values[key], value)) {
        return next;
    }
    getDependentKeys(fields, key).forEach((childKey) => {
        const child = fields.find((field) => field.key === childKey);
        next[childKey] = resolveInitial(child);
    });
    return next;
};

// Un campo dependiente se deshabilita mientras algún padre esté vacío (salvo `requireParent: false`).
export const isFieldDisabledByParent = (field, values) => {
    if (field.requireParent === false) {
        return false;
    }
    return getParents(field).some((parentKey) => isEmptyValue(values[parentKey]));
};

const isRangeValue = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && 'from' in value && 'to' in value;

// Cuántos filtros difieren de su valor inicial. En los rangos (Desde/Hasta) cada lado cuenta por separado.
export const countActive = (fields, values) => fields.reduce((total, field) => {
    const value = values[field.key];
    const initial = resolveInitial(field);
    if (isRangeValue(value) || isRangeValue(initial)) {
        const current = value || {};
        const start = initial || {};
        return total
            + ((current.from || '') !== (start.from || '') ? 1 : 0)
            + ((current.to || '') !== (start.to || '') ? 1 : 0);
    }
    return total + (valuesEqual(value, initial) ? 0 : 1);
}, 0);

export const readValuesFromSearch = (fields, searchParams, prefix = '') => {
    const values = getInitialValues(fields);
    fields.forEach((field) => {
        const raw = searchParams.get(prefix + field.key);
        if (raw === null) {
            return;
        }
        const parsed = field.parse ? field.parse(raw) : raw;
        if (parsed !== undefined) {
            values[field.key] = parsed;
        }
    });
    return values;
};

// Escribe en la URL solo los campos propios que difieren de su valor inicial; no toca otros parámetros.
export const writeValuesToSearch = (fields, values, searchParams, prefix = '') => {
    const next = new URLSearchParams(searchParams);
    fields.forEach((field) => {
        const name = prefix + field.key;
        const value = values[field.key];
        if (valuesEqual(value, resolveInitial(field))) {
            next.delete(name);
            return;
        }
        next.set(name, field.serialize ? field.serialize(value) : String(value ?? ''));
    });
    return next;
};
