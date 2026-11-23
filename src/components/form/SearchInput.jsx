// src/components/form/SearchInput.jsx
// Campo de búsqueda único (lupa + label + small). Lo usan la barra de filtros (SearchField) y los buscadores de modales.
// - onKeyDown: para los buscadores dentro de un formulario que no deben enviarlo con Enter.
import React from 'react';
import { InputAdornment, TextField } from '@mui/material';
import { Search } from '@mui/icons-material';

const SearchInput = ({
    label = 'Buscar',
    value,
    onChange,
    placeholder,
    autoFocus = false,
    disabled = false,
    fullWidth = false,
    onKeyDown,
    sx,
}) => (
    <TextField
        size="small"
        label={label}
        placeholder={placeholder}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        fullWidth={fullWidth}
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

export default SearchInput;
