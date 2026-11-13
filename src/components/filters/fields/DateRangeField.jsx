// src/components/filters/fields/DateRangeField.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import 'moment/locale/es';

const toMoment = (text) => (text ? moment(text, 'YYYY-MM-DD') : null);
const toText = (value) => (value && value.isValid() ? value.format('YYYY-MM-DD') : '');
const PICKER_SX = { width: { xs: '100%', sm: 185 } };

// Una fecha: solo propaga valores completos y válidos (o vacío); lo que se está tecleando queda local.
const DateInput = ({ label, text, onChange, minDate, maxDate, disabled }) => {
    const [local, setLocal] = useState(() => toMoment(text));

    useEffect(() => {
        if (toText(local) !== text) {
            setLocal(toMoment(text));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    return (
        <DatePicker
            label={label}
            format="DD/MM/YYYY"
            value={local}
            minDate={minDate || undefined}
            maxDate={maxDate || undefined}
            disabled={disabled}
            onChange={(next) => {
                setLocal(next);
                if (!next) {
                    onChange('');
                } else if (next.isValid()) {
                    onChange(toText(next));
                }
            }}
            slotProps={{ textField: { size: 'small', sx: PICKER_SX }, field: { clearable: true } }}
        />
    );
};

// Rango Desde/Hasta; el valor es { from: 'YYYY-MM-DD' | '', to: 'YYYY-MM-DD' | '' }.
const DateRangeField = ({ field, value, onChange, disabled }) => {
    const range = value || { from: '', to: '' };
    return (
        <LocalizationProvider dateAdapter={AdapterMoment} adapterLocale="es">
            <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
                <DateInput
                    label={field.fromLabel || 'Desde'}
                    text={range.from}
                    maxDate={toMoment(range.to)}
                    disabled={disabled}
                    onChange={(from) => onChange({ ...range, from })}
                />
                <DateInput
                    label={field.toLabel || 'Hasta'}
                    text={range.to}
                    minDate={toMoment(range.from)}
                    disabled={disabled}
                    onChange={(to) => onChange({ ...range, to })}
                />
            </Box>
        </LocalizationProvider>
    );
};

export default DateRangeField;
