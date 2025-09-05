// src/components/modals/RouteStudentsModal.jsx

import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    CircularProgress,
    Box,
    IconButton,
    TableSortLabel,
    Grid,
    TextField
} from '@mui/material';
import { Close as CloseIcon, DirectionsBus } from '@mui/icons-material';
import { AuthContext } from '../../context/AuthProvider';
import api from '../../utils/axiosConfig';

const RouteStudentsModal = ({ open, onClose, routeNumber, scheduleCode, schoolId, schoolYear, selectedDay }) => {
    const { auth } = useContext(AuthContext);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Per-column filters
    const [filters, setFilters] = useState({
        lastName: '',
        studentName: '',
        grade: '',
        stopTime: '',
        note: ''
    });
    // Sorting
    const [sortBy, setSortBy] = useState(null); // 'lastName' | 'studentName' | 'grade' | 'stopTime' | 'note'
    const [sortOrder, setSortOrder] = useState('asc');

    // Toggle sorting: asc -> desc -> none
    const handleSortChange = (field) => {
        if (sortBy !== field) {
            setSortBy(field);
            setSortOrder('asc');
            return;
        }

        // same field: cycle asc -> desc -> none
        if (sortOrder === 'asc') {
            setSortOrder('desc');
            return;
        }

        if (sortOrder === 'desc') {
            // clear sorting
            setSortBy(null);
            setSortOrder('asc');
        }
    };

    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return null;
        // accept formats like '07:15' or '7:15 AM' or '07:15 AM'
        const m = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (!m) return null;
        const hh = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        return hh * 60 + mm;
    };

    const fetchStudents = useCallback(async () => {
        if (!routeNumber || !scheduleCode || !schoolId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.get(`/routes/students/${schoolId}/${routeNumber}/${scheduleCode}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    schoolYear: schoolYear,
                    day: selectedDay
                }
            });
            
            setStudents(response.data.students || []);
        } catch (err) {
            console.error('Error fetching students:', err);
            setError('Error al cargar los estudiantes');
        } finally {
            setLoading(false);
        }
    }, [routeNumber, scheduleCode, schoolId, schoolYear, selectedDay, auth.token]);

    useEffect(() => {
        if (open && routeNumber && scheduleCode && schoolId) {
            fetchStudents();
        }
    }, [open, routeNumber, scheduleCode, schoolId, fetchStudents]);

    const handleClose = () => {
        setStudents([]);
        setError(null);
        onClose();
    };

    const getDayLabel = (day) => {
        const dayLabels = {
            'monday': 'Lunes',
            'tuesday': 'Martes', 
            'wednesday': 'Miércoles',
            'thursday': 'Jueves',
            'friday': 'Viernes',
            'saturday': 'Sábado',
            'sunday': 'Domingo',
            'all': 'Todos los días'
        };
        return dayLabels[day] || day;
    };

    const getScheduleCodeLabel = (code) => {
        const labels = {
            'AM': 'Mañana',
            'PM': 'Tarde',
            'MD': 'Medio Día',
            'EX': 'Extra'
        };
        return labels[code] || code;
    };

    // compute visible rows based on active filters and sorting
    let visibleStudents = Array.isArray(students) ? students.filter(s => {
        const last = (s.apellidosFamilia || '').toString().toLowerCase();
        const name = (s.nombresEstudiante || '').toString().toLowerCase();
        const grade = (s.grado || '').toString().toLowerCase();
        const time = (s.horarioParada || '').toString().toLowerCase();
        const note = (s.notaParada || '').toString().toLowerCase();

        if (filters.lastName && !last.includes(filters.lastName.toLowerCase())) return false;
        if (filters.studentName && !name.includes(filters.studentName.toLowerCase())) return false;
        if (filters.grade && !grade.includes(filters.grade.toLowerCase())) return false;
        if (filters.stopTime && !time.includes(filters.stopTime.toLowerCase())) return false;
        if (filters.note && !note.includes(filters.note.toLowerCase())) return false;
        return true;
    }) : [];

    // apply sorting
    if (sortBy) {
        visibleStudents = visibleStudents.slice().sort((a, b) => {
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
            } else if (sortBy === 'note') {
                va = (a.notaParada || '').toString().toLowerCase();
                vb = (b.notaParada || '').toString().toLowerCase();
            } else if (sortBy === 'stopTime') {
                const ta = parseTimeToMinutes(a.horarioParada || '');
                const tb = parseTimeToMinutes(b.horarioParada || '');
                if (ta === null && tb === null) {
                    va = (a.horarioParada || '').toString().toLowerCase();
                    vb = (b.horarioParada || '').toString().toLowerCase();
                } else {
                    // numeric compare
                    if (ta === null) return sortOrder === 'asc' ? -1 : 1;
                    if (tb === null) return sortOrder === 'asc' ? 1 : -1;
                    return sortOrder === 'asc' ? ta - tb : tb - ta;
                }
            }

            if (va < vb) return sortOrder === 'asc' ? -1 : 1;
            if (va > vb) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="lg" 
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                backgroundColor: 'primary.main',
                color: 'white',
                py: 2
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DirectionsBus />
                    <Box>
                        <Typography variant="h6" component="div">
                            Ruta {routeNumber} - Horario {getScheduleCodeLabel(scheduleCode)}
                        </Typography>
                        {selectedDay && selectedDay !== 'all' && (
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                Filtrado por: {getDayLabel(selectedDay)}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <IconButton 
                    onClick={handleClose} 
                    sx={{ color: 'white' }}
                    size="small"
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        minHeight: 200,
                        flexDirection: 'column',
                        gap: 2
                    }}>
                        <CircularProgress size={40} />
                        <Typography variant="body2" color="textSecondary">
                            Cargando estudiantes...
                        </Typography>
                    </Box>
                ) : error ? (
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        minHeight: 200,
                        flexDirection: 'column',
                        gap: 2
                    }}>
                        <Typography variant="body1" color="error">
                            {error}
                        </Typography>
                        <Button variant="outlined" onClick={fetchStudents}>
                            Reintentar
                        </Button>
                    </Box>
                ) : visibleStudents.length === 0 ? (
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        minHeight: 200,
                        flexDirection: 'column',
                        gap: 2
                    }}>
                        <DirectionsBus sx={{ fontSize: 48, color: 'grey.400' }} />
                        <Typography variant="body1" color="textSecondary">
                            No hay estudiantes asignados a esta ruta y horario
                        </Typography>
                    </Box>
                ) : (
                    <> 
                        {/* Filters above the table */}
                        <Box sx={{ p: 2 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3} lg={2}>
                                    <TextField
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        placeholder="Filtrar Apellidos..."
                                        value={filters.lastName}
                                        onChange={(e) => setFilters(f => ({ ...f, lastName: e.target.value }))}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} lg={2}>
                                    <TextField
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        placeholder="Filtrar Nombres..."
                                        value={filters.studentName}
                                        onChange={(e) => setFilters(f => ({ ...f, studentName: e.target.value }))}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={2} lg={2}>
                                    <TextField
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        placeholder="Filtrar Grado..."
                                        value={filters.grade}
                                        onChange={(e) => setFilters(f => ({ ...f, grade: e.target.value }))}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={2} lg={2}>
                                    <TextField
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        placeholder="Filtrar Hora..."
                                        value={filters.stopTime}
                                        onChange={(e) => setFilters(f => ({ ...f, stopTime: e.target.value }))}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={2} lg={2}>
                                    <TextField
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        placeholder="Filtrar Nota..."
                                        value={filters.note}
                                        onChange={(e) => setFilters(f => ({ ...f, note: e.target.value }))}
                                    />
                                </Grid>
                            </Grid>
                        </Box>

                        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.50' }}>
                                            <TableSortLabel
                                                active={sortBy === 'lastName'}
                                                direction={sortBy === 'lastName' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('lastName')}
                                            >
                                                Apellidos Familia
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.50' }}>
                                            <TableSortLabel
                                                active={sortBy === 'studentName'}
                                                direction={sortBy === 'studentName' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('studentName')}
                                            >
                                                Nombres (Estudiante)
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.50' }}>
                                            <TableSortLabel
                                                active={sortBy === 'grade'}
                                                direction={sortBy === 'grade' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('grade')}
                                            >
                                                Grado
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.50' }}>
                                            <TableSortLabel
                                                active={sortBy === 'stopTime'}
                                                direction={sortBy === 'stopTime' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('stopTime')}
                                            >
                                                Horario Parada
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.50' }}>
                                            <TableSortLabel
                                                active={sortBy === 'note'}
                                                direction={sortBy === 'note' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('note')}
                                            >
                                                Nota Parada
                                            </TableSortLabel>
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {visibleStudents.map((student, index) => (
                                        <TableRow key={student.id || index} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="medium">
                                                    {student.apellidosFamilia}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {student.nombresEstudiante}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {student.grado}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="medium">
                                                    {student.horarioParada}
                                                </Typography>
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
                        </TableContainer>
                    </>
                )}
            </DialogContent>
            
            <DialogActions sx={{ p: 2, backgroundColor: 'grey.50' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <Typography variant="body2" color="textSecondary">
                        {visibleStudents.length} estudiante{visibleStudents.length !== 1 ? 's' : ''} encontrado{visibleStudents.length !== 1 ? 's' : ''}
                    </Typography>
                    <Button onClick={handleClose} variant="contained">
                        Cerrar
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default RouteStudentsModal;
