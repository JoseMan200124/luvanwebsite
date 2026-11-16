// src/components/filters/fields/ToggleField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

const ToggleField = ({ field, value, onChange, disabled }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">{field.label}</Typography>
        <ToggleButtonGroup
            size="small"
            exclusive
            value={value}
            disabled={disabled}
            onChange={(event, next) => { if (next !== null) { onChange(next); } }}
        >
            {field.options.map((option) => (
                <ToggleButton key={option.value} value={option.value} sx={{ px: 1.5, textTransform: 'none' }}>
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    </Box>
);

export default ToggleField;
