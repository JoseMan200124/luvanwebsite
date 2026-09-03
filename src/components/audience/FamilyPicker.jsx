// src/components/audience/FamilyPicker.jsx
import { memo, useEffect, useMemo, useState } from 'react';
import {
    Autocomplete, TextField, Chip, Box, Checkbox, CircularProgress, Alert,
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material';
import api from '../../utils/axiosConfig';

const CHECKED_ICON = <CheckBox fontSize="small" />;
const UNCHECKED_ICON = <CheckBoxOutlineBlank fontSize="small" />;

// Nunca se renderiza toda la lista del ciclo (pueden ser miles): se acotan las
// coincidencias a 50, que es lo que hace lenta la selección múltiple si no.
const filterOptions = createFilterOptions({
    limit: 50,
    stringify: (option) => option.label,
});

/**
 * Selector múltiple de familias por nombre o correo. Alimenta audience.userIds.
 *
 * `GET /users/parents` no acepta búsqueda por texto: devuelve la lista del
 * ciclo. Se carga una vez y el filtrado corre en el cliente.
 */
const FamilyPicker = ({ value = [], onChange, cicloEscolarId = null }) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');

        api.get('/users/parents', {
            params: { ...(cicloEscolarId ? { cicloEscolarId: Number(cicloEscolarId) } : {}) },
        })
            .then((res) => {
                if (!active) return;
                const users = res.data?.users || [];
                setOptions(users.map((user) => {
                    const familyName = user.FamilyDetail?.familyLastName || user.name || 'Familia';
                    const email = user.email || '';
                    return {
                        id: user.id,
                        label: email ? `${familyName} — ${email}` : familyName,
                    };
                }));
            })
            .catch((err) => {
                if (!active) return;
                console.error('[FamilyPicker] Error cargando familias:', err);
                setError('No se pudieron cargar las familias.');
                setOptions([]);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [cicloEscolarId]);

    // Índice estable: solo se recalcula cuando cambia la lista, no en cada pick.
    const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

    // Conserva las familias ya elegidas aunque `options` aún no haya cargado.
    const selected = useMemo(
        () => value.map((id) => byId.get(id) || { id, label: `Familia #${id}` }),
        [byId, value]
    );

    return (
        <Box>
            <Autocomplete
                multiple
                disableCloseOnSelect
                disableListWrap
                limitTags={8}
                filterOptions={filterOptions}
                options={options}
                value={selected}
                loading={loading}
                isOptionEqualToValue={(option, item) => option.id === item.id}
                getOptionLabel={(option) => option.label}
                onChange={(_, next) => onChange(next.map((item) => item.id))}
                renderOption={(props, option, { selected: isSelected }) => {
                    const { key, ...liProps } = props;
                    return (
                        <li key={key} {...liProps}>
                            <Checkbox
                                icon={UNCHECKED_ICON}
                                checkedIcon={CHECKED_ICON}
                                sx={{ mr: 1 }}
                                checked={isSelected}
                            />
                            {option.label}
                        </li>
                    );
                }}
                renderTags={(items, getTagProps) =>
                    items.map((item, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return <Chip key={key} {...tagProps} label={item.label} size="small" />;
                    })
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        label="Buscar y seleccionar familias"
                        helperText={
                            loading
                                ? 'Cargando familias...'
                                : 'Escribe para filtrar; se listan las primeras 50 coincidencias'
                        }
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                    />
                )}
            />
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            {value.length > 0 && (
                <Box sx={{ mt: 1 }}>
                    <Chip size="small" label={`${value.length} familia(s) seleccionada(s)`} />
                </Box>
            )}
        </Box>
    );
};

export default memo(FamilyPicker);
