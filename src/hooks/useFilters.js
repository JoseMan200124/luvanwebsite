// src/hooks/useFilters.js
import { useCallback, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
    countActive,
    getInitialValues,
    readValuesFromSearch,
    setFieldValue,
    valuesEqual,
    writeValuesToSearch,
} from '../components/filters/filterState';

/**
 * Estado de una barra de filtros.
 * - `draft`: lo que el usuario está editando (no consulta nada).
 * - `applied`: lo último aplicado con "Aplicar filtros", Enter o "Limpiar filtros". Las pantallas consultan con esto.
 * `applied` se sincroniza con la URL (solo las claves propias, con `urlPrefix`) para sobrevivir a "Refrescar" y F5.
 */
const useFilters = ({ fields, onApplied, urlPrefix = '', syncUrl = true, validate, presets = [] }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    const fieldsRef = useRef(fields);
    fieldsRef.current = fields;
    const onAppliedRef = useRef(onApplied);
    onAppliedRef.current = onApplied;
    // Se preserva location.state al escribir la URL: las páginas de colegio lo usan como respaldo del ciclo y del nombre.
    const locationStateRef = useRef(location.state);
    locationStateRef.current = location.state;

    const [applied, setApplied] = useState(() => (
        syncUrl ? readValuesFromSearch(fields, searchParams, urlPrefix) : getInitialValues(fields)
    ));
    const [draft, setDraft] = useState(applied);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const appliedRef = useRef(applied);
    appliedRef.current = applied;

    const setValue = useCallback((key, value) => {
        setDraft((prev) => setFieldValue(fieldsRef.current, prev, key, value));
    }, []);

    const setValues = useCallback((partial) => {
        setDraft((prev) => Object.entries(partial)
            .reduce((acc, [key, value]) => setFieldValue(fieldsRef.current, acc, key, value), prev));
    }, []);

    const commit = useCallback((values) => {
        setApplied(values);
        setDraft(values);
        if (syncUrl) {
            setSearchParams(
                (prev) => writeValuesToSearch(fieldsRef.current, values, prev, urlPrefix),
                { replace: true, state: locationStateRef.current, preventScrollReset: true }
            );
        }
        if (onAppliedRef.current) {
            onAppliedRef.current(values);
        }
    }, [setSearchParams, syncUrl, urlPrefix]);

    const apply = useCallback(() => {
        const values = draftRef.current;
        if (validate && validate(values)) {
            return;
        }
        commit(values);
    }, [commit, validate]);

    const reset = useCallback(() => {
        commit(getInitialValues(fieldsRef.current));
    }, [commit]);

    // Aplica valores desde código sobre lo ya aplicado (p. ej. una selección por defecto que depende de datos que cargan después).
    const applyValues = useCallback((partial) => {
        commit({ ...appliedRef.current, ...partial });
    }, [commit]);

    const applyPreset = useCallback((preset) => setValues(preset.values()), [setValues]);

    const isDirty = !valuesEqual(draft, applied);
    const activeCount = countActive(fields, applied);
    const error = validate ? validate(draft) : null;
    const activePreset = presets.find((preset) => Object.entries(preset.values())
        .every(([key, value]) => valuesEqual(draft[key], value)));

    return {
        draft,
        applied,
        setValue,
        setValues,
        apply,
        applyValues,
        reset,
        isDirty,
        activeCount,
        error,
        barProps: {
            fields,
            values: draft,
            onChange: setValue,
            onApply: apply,
            onReset: reset,
            isDirty,
            activeCount,
            error,
            presets,
            activePresetKey: activePreset?.key,
            onPreset: applyPreset,
        },
    };
};

export default useFilters;
