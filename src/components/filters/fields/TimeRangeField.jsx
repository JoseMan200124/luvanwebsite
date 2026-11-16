// src/components/filters/fields/TimeRangeField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import { Box, TextField } from '@mui/material';

const INPUT_SX = { width: { xs: '100%', sm: 130 } };

// Rango de horas; el valor es { from: 'HH:mm' | '', to: 'HH:mm' | '' }.
const TimeRangeField = ({ field, value, onChange, disabled }) => {
    const range = value || { from: '', to: '' };
    return (
        <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
            <TextField
                size="small"
                type="time"
                label={field.fromLabel || 'Hora desde'}
                value={range.from}
                disabled={disabled}
                onChange={(event) => onChange({ ...range, from: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={INPUT_SX}
            />
            <TextField
                size="small"
                type="time"
                label={field.toLabel || 'Hora hasta'}
                value={range.to}
                disabled={disabled}
                onChange={(event) => onChange({ ...range, to: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={INPUT_SX}
            />
        </Box>
    );
};

export default TimeRangeField;
