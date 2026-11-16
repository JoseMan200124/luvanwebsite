// src/components/filters/fields/SearchField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import { InputAdornment, TextField } from '@mui/material';
import { Search } from '@mui/icons-material';

// Solo actualiza el borrador; Enter aplica porque la barra es un <form>.
const SearchField = ({ field, value, onChange, disabled, sx }) => (
    <TextField
        size="small"
        label={field.label}
        placeholder={field.placeholder}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        sx={sx}
        slotProps={{
            input: {
                startAdornment: (
                    <InputAdornment position="start">
                        <Search fontSize="small" />
                    </InputAdornment>
                ),
            },
        }}
    />
);

export default SearchField;
