// src/components/filters/fields/AutocompleteField.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import useDebouncedValue from '../../../hooks/useDebouncedValue';

// Opciones estáticas (field.options) o buscadas en el servidor (field.loadOptions, que debe ser estable: useCallback).
const AutocompleteField = ({ field, value, onChange, disabled, sx }) => {
    const { label, options: staticOptions = [], loadOptions, minChars = 2 } = field;
    const [input, setInput] = useState('');
    const [remoteOptions, setRemoteOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const debouncedInput = useDebouncedValue(input, 300);

    useEffect(() => {
        if (!loadOptions) {
            return undefined;
        }
        const text = debouncedInput.trim();
        if (text.length < minChars) {
            setRemoteOptions([]);
            return undefined;
        }
        let active = true;
        setLoading(true);
        Promise.resolve(loadOptions(text))
            .then((list) => { if (active) { setRemoteOptions(list || []); } })
            .catch(() => { if (active) { setRemoteOptions([]); } })
            .finally(() => { if (active) { setLoading(false); } });
        return () => { active = false; };
    }, [debouncedInput, loadOptions, minChars]);

    const options = loadOptions ? remoteOptions : staticOptions;
    const waitingForInput = Boolean(loadOptions) && input.trim().length < minChars;

    return (
        <Autocomplete
            size="small"
            sx={sx}
            disabled={disabled}
            options={options}
            value={value || null}
            onChange={(event, next) => onChange(next ? { value: String(next.value), label: next.label } : null)}
            onInputChange={(event, text) => setInput(text)}
            getOptionLabel={(option) => option?.label || ''}
            isOptionEqualToValue={(a, b) => String(a.value) === String(b.value)}
            filterOptions={loadOptions ? (list) => list : undefined}
            loading={loading}
            loadingText="Buscando…"
            noOptionsText={waitingForInput ? `Escriba al menos ${minChars} caracteres` : 'Sin coincidencias'}
            renderInput={(params) => <TextField {...params} label={label} />}
        />
    );
};

export default AutocompleteField;
