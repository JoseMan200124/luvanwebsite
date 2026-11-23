// src/components/filters/fields/SearchField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import SearchInput from '../../form/SearchInput';

// Solo actualiza el borrador; Enter aplica porque la barra es un <form>.
const SearchField = ({ field, value, onChange, disabled, sx }) => (
    <SearchInput
        label={field.label}
        placeholder={field.placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        sx={sx}
    />
);

export default SearchField;
