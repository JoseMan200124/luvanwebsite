// src/components/filters/FilterField.jsx
/* eslint-disable react/prop-types */
import React from 'react';
import { isFieldDisabledByParent } from './filterState';
import { getFieldSx } from './fields/fieldSx';
import SearchField from './fields/SearchField';
import SelectField from './fields/SelectField';
import AutocompleteField from './fields/AutocompleteField';
import CycleField from './fields/CycleField';
import ClientField from './fields/ClientField';
import DateRangeField from './fields/DateRangeField';
import MonthRangeField from './fields/MonthRangeField';
import TimeRangeField from './fields/TimeRangeField';
import SwitchField from './fields/SwitchField';
import ToggleField from './fields/ToggleField';

const COMPONENTS = {
    search: SearchField,
    select: SelectField,
    autocomplete: AutocompleteField,
    cycle: CycleField,
    client: ClientField,
    dateRange: DateRangeField,
    monthRange: MonthRangeField,
    timeRange: TimeRangeField,
    switch: SwitchField,
    toggle: ToggleField,
};

// Despacha cada campo a su componente; `field.disabled` puede ser booleano o función (values) => boolean.
const FilterField = ({ field, values, onChange, disabled }) => {
    const Component = COMPONENTS[field.type];
    if (!Component) {
        return null;
    }
    const ownDisabled = typeof field.disabled === 'function' ? field.disabled(values) : Boolean(field.disabled);
    return (
        <Component
            field={field}
            value={values[field.key]}
            onChange={(value) => onChange(field.key, value)}
            disabled={disabled || ownDisabled || isFieldDisabledByParent(field, values)}
            sx={getFieldSx(field.width)}
        />
    );
};

export default FilterField;
