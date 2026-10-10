// src/components/audience/FamilyPicker.jsx
import { memo, useEffect, useMemo, useState } from 'react';
import {
    TextField, Chip, Box, Checkbox, CircularProgress, Alert, Button, Typography,
    List, ListItemButton, ListItemIcon, ListItemText, InputAdornment, IconButton,
} from '@mui/material';
import { Clear, Search } from '@mui/icons-material';
import api from '../../utils/axiosConfig';

// Las coincidencias pueden ser miles: se pintan de 50 en 50 con «Cargar más».
// «Seleccionar todas» aplica a todas las coincidencias, no solo a las visibles.
const PAGE_SIZE = 50;

const normalize = (text) => String(text || '')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase();

// Varios términos separados por coma o punto y coma: coincide con cualquiera.
const parseTerms = (text) => text.split(/[,;]/).map(normalize).map((term) => term.trim()).filter(Boolean);

/**
 * Selector de familias por apellidos o correo. Alimenta audience.userIds.
 *
 * Lista las familias de todo el sistema, sin acotar por ciclo escolar.
 * `GET /users/parents` no acepta búsqueda por texto: se carga una vez y el
 * filtrado corre en el cliente al pulsar «Buscar» (o Enter), no en cada tecla.
 *
 * Los resultados se marcan con checkboxes y las familias elegidas quedan en un
 * panel aparte, para que el texto buscado no se mezcle con la selección.
 */
const FamilyPicker = ({ value = [], onChange }) => {
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');

        // Familias de todo el sistema: `allCycles` evita que el interceptor de axios
        // inyecte el ciclo de la pestaña.
        api.get('/users/parents', { params: { allCycles: true } })
            .then((res) => {
                if (!active) return;
                const users = res.data?.users || [];
                setOptions(users.map((user) => {
                    const lastName = String(user.FamilyDetail?.familyLastName || '').trim();
                    const email = user.email || '';
                    const familyName = lastName || user.name || 'Familia';
                    return {
                        id: user.id,
                        label: email ? `${familyName} — ${email}` : familyName,
                        // La búsqueda es por apellidos de familia (y correo), no por el
                        // nombre del usuario; el nombre solo entra si no hay apellidos.
                        searchText: normalize(`${lastName || user.name || ''} ${email}`),
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
    }, []);

    // Índice estable: solo se recalcula cuando cambia la lista, no en cada pick.
    const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

    const selectedIds = useMemo(() => new Set(value), [value]);

    const matches = useMemo(() => {
        const terms = parseTerms(searchTerm);
        if (terms.length === 0) return [];
        return options.filter((option) => terms.some((term) => option.searchText.includes(term)));
    }, [options, searchTerm]);

    const visibleMatches = matches.slice(0, visibleCount);
    const remainingMatches = matches.length - visibleMatches.length;
    const unselectedMatches = matches.filter((option) => !selectedIds.has(option.id));

    // Cada búsqueda nueva vuelve a la primera página.
    const runSearch = () => {
        setSearchTerm(inputValue.trim());
        setVisibleCount(PAGE_SIZE);
    };

    const clearSearch = () => {
        setInputValue('');
        setSearchTerm('');
        setVisibleCount(PAGE_SIZE);
    };

    const loadMore = () => setVisibleCount((count) => count + PAGE_SIZE);

    const toggle = (id) => {
        onChange(selectedIds.has(id) ? value.filter((item) => item !== id) : [...value, id]);
    };

    const selectAllMatches = () => onChange([...value, ...unselectedMatches.map((option) => option.id)]);

    let resultsBody = null;
    if (searchTerm) {
        resultsBody = matches.length === 0
            ? <Typography variant="body2" color="text.secondary">Sin coincidencias para «{searchTerm}».</Typography>
            : (
                <>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                            {`Mostrando ${visibleMatches.length} de ${matches.length} coincidencia(s)`}
                        </Typography>
                        <Button size="small" onClick={selectAllMatches} disabled={unselectedMatches.length === 0}>
                            {`Seleccionar todas (${unselectedMatches.length})`}
                        </Button>
                    </Box>
                    <List dense disablePadding sx={{ maxHeight: 240, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        {visibleMatches.map((option) => (
                            <ListItemButton key={option.id} onClick={() => toggle(option.id)} dense>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Checkbox edge="start" size="small" checked={selectedIds.has(option.id)} tabIndex={-1} disableRipple />
                                </ListItemIcon>
                                <ListItemText primary={option.label} />
                            </ListItemButton>
                        ))}
                    </List>
                    {remainingMatches > 0 && (
                        <Button size="small" onClick={loadMore} sx={{ mt: 0.5, alignSelf: 'flex-start' }}>
                            {`Cargar ${Math.min(PAGE_SIZE, remainingMatches)} más (faltan ${remainingMatches})`}
                        </Button>
                    )}
                </>
            );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                    fullWidth
                    size="small"
                    label="Buscar familias por apellidos o correo"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            runSearch();
                        }
                    }}
                    helperText={
                        loading
                            ? 'Cargando familias...'
                            : 'Pulsa «Buscar» o Enter. Para varias a la vez, sepáralas con coma: pazos, najera, lopez'
                    }
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    {loading && <CircularProgress size={16} />}
                                    {inputValue && !loading && (
                                        <IconButton size="small" aria-label="Limpiar búsqueda" onClick={clearSearch} edge="end">
                                            <Clear fontSize="small" />
                                        </IconButton>
                                    )}
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                <Button
                    variant="contained"
                    startIcon={<Search />}
                    onClick={runSearch}
                    disabled={loading}
                    sx={{ height: 40, flexShrink: 0 }}
                >
                    Buscar
                </Button>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            {resultsBody}

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: value.length > 0 ? 0.5 : 0 }}>
                    <Typography variant="subtitle2">
                        {value.length === 0 ? 'Ninguna familia seleccionada' : `${value.length} familia(s) seleccionada(s)`}
                    </Typography>
                    {value.length > 0 && (
                        <Button size="small" color="inherit" onClick={() => onChange([])}>Quitar todas</Button>
                    )}
                </Box>
                {value.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 140, overflowY: 'auto' }}>
                        {value.map((id) => (
                            <Chip
                                key={id}
                                size="small"
                                label={byId.get(id)?.label || `Familia #${id}`}
                                onDelete={() => toggle(id)}
                            />
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default memo(FamilyPicker);
