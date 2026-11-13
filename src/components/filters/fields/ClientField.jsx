// src/components/filters/fields/ClientField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import ClientSelector from '../../ClientSelector';

// Guarda solo { type, id }: el nombre se resuelve con las opciones (y así un valor restaurado de la URL coincide).
const ClientField = ({ field, value, onChange, disabled, sx }) => (
    <ClientSelector
        schools={field.schools}
        corporations={field.corporations}
        extraOptions={field.extraOptions}
        schoolsGroupLabel={field.schoolsGroupLabel}
        label={field.label}
        helperText={field.helperText}
        value={value}
        onChange={(option) => onChange(option ? { type: option.type, id: String(option.id) } : null)}
        size="small"
        fullWidth={false}
        disabled={disabled}
        sx={sx}
    />
);

export default ClientField;
