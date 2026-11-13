// src/components/filters/fields/SelectField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import { Checkbox, FormControl, InputLabel, ListItemText, ListSubheader, MenuItem, Select } from '@mui/material';

const MENU_PROPS = { PaperProps: { sx: { maxHeight: 320 } } };

// Select simple o múltiple, con grupos (option.group) y opción "Todos" (valor vacío).
const SelectField = ({ field, value, onChange, disabled, sx }) => {
    const { key, label, options = [], multiple = false, allLabel } = field;
    const labelId = `filtro-${key}-label`;
    const selected = multiple ? (value || []) : (value ?? '');
    const labelFor = (optionValue) => options.find((option) => String(option.value) === String(optionValue))?.label ?? optionValue;

    const items = [];
    if (allLabel) {
        items.push(<MenuItem key="__todos__" value=""><em>{allLabel}</em></MenuItem>);
    }
    let lastGroup;
    options.forEach((option) => {
        if (option.group && option.group !== lastGroup) {
            items.push(<ListSubheader key={`grupo-${option.group}`}>{option.group}</ListSubheader>);
            lastGroup = option.group;
        }
        const optionValue = String(option.value);
        items.push(
            <MenuItem key={optionValue} value={optionValue}>
                {multiple && <Checkbox size="small" checked={selected.includes(optionValue)} sx={{ p: 0, mr: 1 }} />}
                <ListItemText primary={option.label} />
            </MenuItem>
        );
    });

    const handleChange = (event) => {
        const next = event.target.value;
        if (!multiple) {
            onChange(next);
            return;
        }
        const list = typeof next === 'string' ? next.split(',') : next;
        // Elegir "Todos" en un múltiple vacía la selección (vacío = todos).
        onChange(list.includes('') ? [] : list);
    };

    return (
        <FormControl size="small" sx={sx} disabled={disabled}>
            <InputLabel id={labelId}>{label}</InputLabel>
            <Select
                labelId={labelId}
                label={label}
                multiple={multiple}
                value={selected}
                onChange={handleChange}
                MenuProps={MENU_PROPS}
                renderValue={multiple ? (list) => list.map(labelFor).join(', ') : undefined}
            >
                {items}
            </Select>
        </FormControl>
    );
};

export default SelectField;
