// src/components/school/SchoolLevelGradesEditor.jsx
import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Chip, Checkbox, FormControl, InputLabel, ListItemText, MenuItem,
    OutlinedInput, Select, Typography, CircularProgress,
} from '@mui/material';
import { listEducationLevels } from '../../services/educationLevelsService';

/**
 * Editor controlado del mapeo nivel -> grados de un colegio.
 *
 * Vive dentro de la sección "Grados y Niveles" de Editar Colegio y comparte la
 * misma lista de grados en vivo: al agregar un grado en el formulario aparece
 * aquí sin necesidad de guardar. No tiene botón propio; persiste con el
 * "Guardar Cambios" del colegio.
 *
 * Props:
 *  - grades: string[]  (nombres de grado, ya normalizados por el padre)
 *  - value:  { [educationLevelId]: string[] }
 *  - onChange: (nextValue) => void
 */
const SchoolLevelGradesEditor = ({ grades = [], value = {}, onChange }) => {
    const [levels, setLevels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        listEducationLevels()
            .then((data) => { if (active) setLevels(data); })
            .catch(() => { if (active) setError('No se pudieron cargar los niveles.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    // Un grado solo puede estar en un nivel: se oculta de los demás selectores.
    const assignedElsewhere = useMemo(() => {
        const map = {};
        Object.entries(value || {}).forEach(([levelId, levelGrades]) => {
            (levelGrades || []).forEach((grade) => { map[grade] = levelId; });
        });
        return map;
    }, [value]);

    const unassigned = useMemo(
        () => grades.filter((grade) => !assignedElsewhere[grade]),
        [grades, assignedElsewhere]
    );

    const handleLevelChange = (levelId, selected) => {
        // Solo grados que siguen existiendo en el colegio.
        const clean = selected.filter((grade) => grades.includes(grade));
        onChange({ ...value, [String(levelId)]: clean });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2">Cargando niveles...</Typography>
            </Box>
        );
    }

    if (grades.length === 0) {
        return (
            <Alert severity="info">
                Agrega grados arriba para poder asignarlos a un nivel.
            </Alert>
        );
    }

    if (levels.length === 0) {
        return (
            <Alert severity={error ? 'error' : 'info'}>
                {error || 'No hay niveles educativos registrados. Créalos en la sección "Niveles Educativos".'}
            </Alert>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
                Asigna los grados de este colegio a cada nivel. Cada grado puede pertenecer a un solo nivel.
            </Typography>

            {levels.map((level) => {
                const selected = value?.[String(level.id)] || [];
                const options = grades.filter(
                    (grade) => !assignedElsewhere[grade] || assignedElsewhere[grade] === String(level.id)
                );
                return (
                    <FormControl key={level.id} fullWidth size="small">
                        <InputLabel>{level.name}</InputLabel>
                        <Select
                            multiple
                            value={selected}
                            onChange={(e) => handleLevelChange(level.id, e.target.value)}
                            input={<OutlinedInput label={level.name} />}
                            renderValue={(items) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {items.map((grade) => <Chip key={grade} label={grade} size="small" />)}
                                </Box>
                            )}
                        >
                            {options.map((grade) => (
                                <MenuItem key={grade} value={grade}>
                                    <Checkbox checked={selected.includes(grade)} />
                                    <ListItemText primary={grade} />
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );
            })}

            {unassigned.length > 0 && (
                <Alert severity="warning">
                    Sin nivel asignado: {unassigned.join(', ')}. No se alcanzarán al enviar por nivel.
                </Alert>
            )}
        </Box>
    );
};

export default SchoolLevelGradesEditor;
