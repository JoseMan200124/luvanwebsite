// src/components/filters/FilterBar.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Badge, Box, Button, Chip, CircularProgress, Collapse, Paper, Stack, Typography } from '@mui/material';
import { FilterAltOff, Search, Tune } from '@mui/icons-material';
import FilterField from './FilterField';
import { isEmptyValue } from './filterState';

const ROW_SX = { display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' };
// En móvil cada botón va en su propia fila a todo el ancho ("Aplicar filtros" arriba); desde `sm`, en línea a la derecha.
const ACTIONS_SX = {
    display: 'flex',
    flexDirection: { xs: 'column-reverse', sm: 'row' },
    gap: { xs: 1.5, sm: 3 },
    ml: { sm: 'auto' },
    width: { xs: '100%', sm: 'auto' },
};
const BUTTON_SLOT_SX = { width: { xs: '100%', sm: 'auto' } };
const BUTTON_SX = { width: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' };

/**
 * Barra de filtros estándar. Nada se consulta al editar: solo "Aplicar filtros", Enter o "Limpiar filtros".
 * Recibe `{...pageFilters.barProps}` de useFilters más `loading`, `disabled` y `caption`.
 */
const FilterBar = ({
    fields,
    values,
    onChange,
    onApply,
    onReset,
    isDirty,
    activeCount,
    error = null,
    presets = [],
    activePresetKey,
    onPreset = () => {},
    loading = false,
    disabled = false,
    caption,
}) => {
    const visibleFields = fields.filter((field) => !field.hidden);
    const mainFields = visibleFields.filter((field) => !field.advanced);
    const advancedFields = visibleFields.filter((field) => field.advanced);
    const [showAdvanced, setShowAdvanced] = useState(() => advancedFields.some((field) => !isEmptyValue(values[field.key])));

    const canApply = !disabled && !loading && isDirty && !error;

    const handleSubmit = (event) => {
        event.preventDefault();
        if (canApply) {
            onApply();
        }
    };

    const renderFields = (list) => list.map((field) => (
        <FilterField key={field.key} field={field} values={values} onChange={onChange} disabled={disabled} />
    ));

    return (
        <Paper variant="outlined" component="form" noValidate onSubmit={handleSubmit} sx={{ p: 2, mb: 2 }}>
            {presets.length > 0 && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                    {presets.map((preset) => {
                        const active = preset.key === activePresetKey;
                        return (
                            <Chip
                                key={preset.key}
                                label={preset.label}
                                size="small"
                                clickable
                                color={active ? 'primary' : 'default'}
                                variant={active ? 'filled' : 'outlined'}
                                onClick={() => onPreset(preset)}
                                disabled={disabled}
                            />
                        );
                    })}
                </Stack>
            )}

            <Box sx={ROW_SX}>
                {renderFields(mainFields)}
                {advancedFields.length > 0 && (
                    <Button size="small" startIcon={<Tune />} onClick={() => setShowAdvanced((open) => !open)}>
                        {showAdvanced ? 'Menos filtros' : 'Más filtros'}
                    </Button>
                )}
                <Box sx={ACTIONS_SX}>
                    <Badge badgeContent={activeCount} color="primary" overlap="rectangular" sx={BUTTON_SLOT_SX}>
                        <Button
                            variant="text"
                            startIcon={<FilterAltOff />}
                            onClick={onReset}
                            disabled={disabled || loading || (activeCount === 0 && !isDirty)}
                            sx={BUTTON_SX}
                        >
                            Limpiar filtros
                        </Button>
                    </Badge>
                    <Badge variant="dot" color="warning" invisible={!isDirty || Boolean(error)} overlap="rectangular" sx={BUTTON_SLOT_SX}>
                        <Button
                            type="submit"
                            variant="contained"
                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search />}
                            disabled={!canApply}
                            sx={BUTTON_SX}
                        >
                            Aplicar filtros
                        </Button>
                    </Badge>
                </Box>
            </Box>

            {advancedFields.length > 0 && (
                <Collapse in={showAdvanced}>
                    <Box sx={{ ...ROW_SX, mt: 1.5 }}>{renderFields(advancedFields)}</Box>
                </Collapse>
            )}

            {(error || caption) && (
                <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ display: 'block', mt: 1 }}>
                    {error || caption}
                </Typography>
            )}
        </Paper>
    );
};

FilterBar.propTypes = {
    fields: PropTypes.arrayOf(PropTypes.object).isRequired,
    values: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    onApply: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    isDirty: PropTypes.bool.isRequired,
    activeCount: PropTypes.number.isRequired,
    error: PropTypes.string,
    presets: PropTypes.arrayOf(PropTypes.object),
    activePresetKey: PropTypes.string,
    onPreset: PropTypes.func,
    loading: PropTypes.bool,
    disabled: PropTypes.bool,
    caption: PropTypes.node,
};

export default FilterBar;
