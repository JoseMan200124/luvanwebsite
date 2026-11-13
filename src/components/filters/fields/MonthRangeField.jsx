// src/components/filters/fields/MonthRangeField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import { Box, TextField } from '@mui/material';

const INPUT_SX = { width: { xs: '100%', sm: 160 } };

// Rango de meses; el valor es { from: 'YYYY-MM' | '', to: 'YYYY-MM' | '' }.
const MonthRangeField = ({ field, value, onChange, disabled }) => {
    const range = value || { from: '', to: '' };
    return (
        <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
            <TextField
                size="small"
                type="month"
                label={field.fromLabel || 'Desde'}
                value={range.from}
                disabled={disabled}
                onChange={(event) => onChange({ ...range, from: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={INPUT_SX}
            />
            <TextField
                size="small"
                type="month"
                label={field.toLabel || 'Hasta'}
                value={range.to}
                disabled={disabled}
                onChange={(event) => onChange({ ...range, to: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={INPUT_SX}
            />
        </Box>
    );
};

export default MonthRangeField;
