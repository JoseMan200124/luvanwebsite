// src/components/filters/fields/SwitchField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import { FormControlLabel, Switch } from '@mui/material';

const SwitchField = ({ field, value, onChange, disabled }) => (
    <FormControlLabel
        control={<Switch size="small" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />}
        label={field.label}
        disabled={disabled}
        sx={{ m: 0, whiteSpace: 'nowrap', '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
    />
);

export default SwitchField;
