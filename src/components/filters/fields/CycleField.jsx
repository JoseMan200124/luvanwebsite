// src/components/filters/fields/CycleField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import CicloEscolarFilter from '../../CicloEscolarFilter';

const CycleField = ({ field, value, onChange, sx }) => (
    <CicloEscolarFilter
        value={value}
        onChange={onChange}
        label={field.label}
        allLabel={field.allLabel}
        size="small"
        fullWidth={false}
        sx={sx}
    />
);

export default CycleField;
