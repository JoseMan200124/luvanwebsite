// src/components/modals/SchoolStudentSearchModal.jsx

import React, { useState, useContext, useCallback } from 'react';
import {
    Paper,
    Button,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Typography,
    CircularProgress,
    Box,
    TextField,
    Grid
} from '@mui/material';
import { PersonSearch } from '@mui/icons-material';
import { AuthContext } from '../../context/AuthProvider';
import api from '../../utils/axiosConfig';
import { getScheduleLabel } from '../../utils/scheduleConfig';
import useTableState from '../../hooks/useTableState';
import SortableTableHead from '../table/SortableTableHead';
import AppTableContainer from '../table/AppTableContainer';
import AppDialog from '../dialogs/AppDialog';

const MIN_FIELD_LENGTH = 2;

// param -> etiqueta del campo de búsqueda
const SEARCH_FIELDS = [
    { key: 'apellidos', label: 'Apellidos Familia' },
    { key: 'nombre', label: 'Nombres (Estudiante)' },
    { key: 'grado', label: 'Grado' },
    { key: 'horarioParada', label: 'Horario Parada' },
    { key: 'notaParada', label: 'Nota Parada' }
];

const EMPTY_FIELDS = SEARCH_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});

// Columnas de la tabla
const COLUMNS = [
    { id: 'lastName', label: 'Apellidos Familia', sortable: true },
    { id: 'studentName', label: 'Nombres (Estudiante)', sortable: true },
    { id: 'grade', label: 'Grado', sortable: true },
    { id: 'route', label: 'Ruta', sortable: true },
    { id: 'horario', label: 'Horario' },
    { id: 'stopTime', label: 'Horario Parada', sortable: true },
    { id: 'note', label: 'Nota Parada', sortable: true },
];

const SchoolStudentSearchModal = ({ open, onClose, schoolId, cicloEscolarId }) => {
    const { auth } = useContext(AuthContext);

    const [fields, setFields] = useState(EMPTY_FIELDS);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Sorting: asc -> desc -> none
    const table = useTableState({ clearable: true });
    const { orderBy: sortBy, order: sortOrder } = table;

    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) {
            return null;
        }
        const m = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (!m) {
            return null;
        }
        return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
    };

    // Solo se envían los campos con texto (>= 2 caracteres tras trim).
    const buildActiveParams = useCallback(() => {
        const params = {};
        SEARCH_FIELDS.forEach(({ key }) => {
            const value = (fields[key] || '').trim();
            if (value.length >= MIN_FIELD_LENGTH) {
                params[key] = value;
            }
        });
        return params;
    }, [fields]);

    const canSearch = Object.keys(buildActiveParams()).length > 0 && !loading;

    // La llamada al endpoint se hace SOLO al presionar "Buscar" (o Enter), nunca al tipear.
    const handleSearch = useCallback(async () => {
        const activeParams = buildActiveParams();
        if (Object.keys(activeParams).length === 0 || !schoolId) {
            return;
        }

        setLoading(true);
        setError(null);
        setHasSearched(true);

        try {
            const response = await api.get(`/routes/students/search/${schoolId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    ...activeParams,
                    cicloEscolarId
                }
            });
            setStudents(response.data.students || []);
        } catch (err) {
            console.error('Error buscando estudiantes por parada:', err);
            setError('Error al buscar los estudiantes');
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [buildActiveParams, schoolId, cicloEscolarId, auth.token]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && canSearch) {
            handleSearch();
        }
    };

    const handleFieldChange = (key) => (e) => {
        const { value } = e.target;
        setFields((prev) => ({ ...prev, [key]: value }));
    };

    const handleClear = () => {
        setFields(EMPTY_FIELDS);
        setStudents([]);
        setError(null);
        setHasSearched(false);
        table.setSort('', 'asc');
    };

    const handleClose = () => {
        handleClear();
        onClose();
    };

    // Ordenamiento en cliente sobre los resultados ya traídos del servidor
    let visibleStudents = Array.isArray(students) ? students.slice() : [];
    if (sortBy) {
        visibleStudents = visibleStudents.sort((a, b) => {
            let va = '';
            let vb = '';
            if (sortBy === 'lastName') {
                va = (a.apellidosFamilia || '').toString().toLowerCase();
                vb = (b.apellidosFamilia || '').toString().toLowerCase();
            } else if (sortBy === 'studentName') {
                va = (a.nombresEstudiante || '').toString().toLowerCase();
                vb = (b.nombresEstudiante || '').toString().toLowerCase();
            } else if (sortBy === 'grade') {
                va = (a.grado || '').toString().toLowerCase();
                vb = (b.grado || '').toString().toLowerCase();
            } else if (sortBy === 'route') {
                va = (a.routeNumber || '').toString().toLowerCase();
                vb = (b.routeNumber || '').toString().toLowerCase();
            } else if (sortBy === 'note') {
                va = (a.notaParada || '').toString().toLowerCase();
                vb = (b.notaParada || '').toString().toLowerCase();
            } else if (sortBy === 'stopTime') {
                const ta = parseTimeToMinutes(a.horarioParada || '');
                const tb = parseTimeToMinutes(b.horarioParada || '');
                if (ta !== null || tb !== null) {
                    if (ta === null) {
                        return sortOrder === 'asc' ? -1 : 1;
                    }
                    if (tb === null) {
                        return sortOrder === 'asc' ? 1 : -1;
                    }
                    return sortOrder === 'asc' ? ta - tb : tb - ta;
                }
                va = (a.horarioParada || '').toString().toLowerCase();
                vb = (b.horarioParada || '').toString().toLowerCase();
            }
            if (va < vb) {
                return sortOrder === 'asc' ? -1 : 1;
            }
            if (va > vb) {
                return sortOrder === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    const renderBody = () => {
        if (loading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 2 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="textSecondary">Buscando estudiantes...</Typography>
                </Box>
            );
        }
        if (error) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body1" color="error">{error}</Typography>
                    <Button variant="outlined" onClick={handleSearch}>Reintentar</Button>
                </Box>
            );
        }
        if (!hasSearched) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 2 }}>
                    <PersonSearch sx={{ fontSize: 48, color: 'grey.400' }} />
                    <Typography variant="body1" color="textSecondary">
                        Completá uno o más campos y presioná "Buscar"
                    </Typography>
                </Box>
            );
        }
        if (visibleStudents.length === 0) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 2 }}>
                    <PersonSearch sx={{ fontSize: 48, color: 'grey.400' }} />
                    <Typography variant="body1" color="textSecondary">
                        No se encontraron estudiantes con los criterios ingresados
                    </Typography>
                </Box>
            );
        }
        return (
            <AppTableContainer component={Paper} maxHeight={{ xs: 'calc(100dvh - 340px)', sm: 460 }}>
                <Table stickyHeader sx={{ minWidth: 860 }}>
                    <SortableTableHead columns={COLUMNS} cellSx={{ fontWeight: 'bold', backgroundColor: 'grey.50' }} {...table.sortProps} />
                    <TableBody>
                        {visibleStudents.map((student, index) => (
                            <TableRow key={student.slotId || student.id || index} hover>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="medium">{student.apellidosFamilia}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{student.nombresEstudiante}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{student.grado}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{student.routeNumber}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {student.scheduleCode ? getScheduleLabel(student.scheduleCode) : 'Sin especificar'}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="medium">{student.horarioParada}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontStyle: student.notaParada === 'Sin nota' ? 'italic' : 'normal',
                                            color: student.notaParada === 'Sin nota' ? 'grey.500' : 'text.primary'
                                        }}
                                    >
                                        {student.notaParada}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </AppTableContainer>
        );
    };

    return (
        <AppDialog
            open={open}
            onClose={handleClose}
            title="Buscar estudiantes por parada"
            icon={<PersonSearch />}
            size="lg"
            readOnly
            contentSx={{ p: 0 }}
            extraActions={(
                <Typography variant="body2" color="textSecondary" sx={{ mr: 'auto' }}>
                    {hasSearched && !loading && !error
                        ? `${visibleStudents.length} estudiante${visibleStudents.length !== 1 ? 's' : ''} encontrado${visibleStudents.length !== 1 ? 's' : ''}`
                        : ''}
                </Typography>
            )}
        >
            <Box sx={{ p: 2 }}>
                <Grid container spacing={2}>
                    {SEARCH_FIELDS.map(({ key, label }) => (
                        <Grid item xs={12} sm={6} md={4} key={key}>
                            <TextField
                                variant="outlined"
                                size="small"
                                fullWidth
                                label={label}
                                placeholder={`Buscar por ${label.toLowerCase()}...`}
                                value={fields[key]}
                                onChange={handleFieldChange(key)}
                                onKeyPress={handleKeyPress}
                            />
                        </Grid>
                    ))}
                </Grid>
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="contained" onClick={handleSearch} disabled={!canSearch}>
                        Buscar
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleClear}
                        disabled={loading || (!hasSearched && Object.values(fields).every((v) => !v))}
                    >
                        Limpiar
                    </Button>
                    <Typography variant="caption" color="textSecondary" sx={{ alignSelf: 'center' }}>
                        Se buscan solo los campos con al menos {MIN_FIELD_LENGTH} caracteres.
                    </Typography>
                </Box>
            </Box>

            {renderBody()}
        </AppDialog>
    );
};

export default SchoolStudentSearchModal;
