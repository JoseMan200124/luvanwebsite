// src/components/form/EntitySelect.jsx
// Selector único de colegio, corporación, bus, piloto o monitora en formularios. Al abrirlo muestra todas las
// opciones; también se puede escribir para dejar solo las que coinciden. La lista sale del caché de catálogos,
// o de `options` cuando el formulario ya tiene su propia lista (por ejemplo, filtrada).
import React from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useCatalog } from '../../hooks/useCatalog';

const PRESETS = {
    school: { catalog: 'schools', label: 'Colegio', getLabel: (option) => option.name },
    corporation: { catalog: 'corporations', label: 'Corporación', getLabel: (option) => option.name },
    bus: { catalog: 'buses', label: 'Bus', getLabel: (option) => option.plate },
    pilot: { catalog: 'pilots', label: 'Piloto', getLabel: (option) => option.name },
    monitor: { catalog: 'monitors', label: 'Monitora', getLabel: (option) => option.name },
};

const EntitySelect = ({
    entity,
    value,
    onChange,
    options,
    params,
    catalogOptions,
    label,
    required = false,
    error = false,
    helperText,
    disabled = false,
    getOptionLabel,
    renderOption,
    filterOptions,
    name,
    size = 'small',
    fullWidth = true,
    sx,
}) => {
    const preset = PRESETS[entity];
    const catalog = useCatalog(preset.catalog, params, { ...catalogOptions, enabled: !options && (catalogOptions?.enabled ?? true) });
    const list = options || catalog.data;
    const selected = list.find((option) => String(option.id) === String(value)) || null;
    const readLabel = getOptionLabel || preset.getLabel;

    return (
        <Autocomplete
            size={size}
            fullWidth={fullWidth}
            options={list}
            loading={!options && catalog.loading}
            value={selected}
            onChange={(_event, option) => onChange(option ? option.id : '', option)}
            getOptionLabel={(option) => readLabel(option) || ''}
            isOptionEqualToValue={(option, current) => String(option.id) === String(current.id)}
            renderOption={renderOption}
            filterOptions={filterOptions}
            noOptionsText="Sin resultados"
            loadingText="Cargando..."
            disabled={disabled}
            sx={sx}
            renderInput={(inputParams) => (
                <TextField
                    {...inputParams}
                    name={name}
                    label={label || preset.label}
                    required={required}
                    error={error}
                    helperText={helperText}
                />
            )}
        />
    );
};

export default EntitySelect;
