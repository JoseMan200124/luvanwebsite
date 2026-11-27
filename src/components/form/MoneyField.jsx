// src/components/form/MoneyField.jsx
// Campo de monto único: prefijo Q, paso de 0.01 y sin negativos desde las flechas. Se usa igual que un TextField
// (mismo onChange, value, name, error y helperText); el tamaño lo decide el formulario.
import React from 'react';
import { InputAdornment, TextField } from '@mui/material';

const MoneyField = ({ InputProps, inputProps, fullWidth = true, ...rest }) => (
    <TextField
        type="number"
        fullWidth={fullWidth}
        InputProps={{ startAdornment: <InputAdornment position="start">Q</InputAdornment>, ...InputProps }}
        inputProps={{ min: 0, step: '0.01', inputMode: 'decimal', ...inputProps }}
        {...rest}
    />
);

export default MoneyField;
