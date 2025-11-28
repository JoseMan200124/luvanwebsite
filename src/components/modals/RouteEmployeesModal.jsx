// src/components/modals/RouteEmployeesModal.jsx

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

const RouteEmployeesModal = ({ 
    open, 
    onClose, 
    routeNumber, 
    scheduleIndex, 
    scheduleName,
    stopType, // 'entrada' or 'salida'
    corporationId, 
    fiscalYear, 
    selectedDay 
}) => {
    const { auth } = useContext(AuthContext);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Per-column filters
    const [filters, setFilters] = useState({
        name: '',
        email: '',
        stopTime: '',
        note: ''
    });
    
    // Sorting
    const [sortBy, setSortBy] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');

    const handleSortChange = (field) => {
        if (sortBy !== field) {
            setSortBy(field);
            setSortOrder('asc');
            return;
        }

        if (sortOrder === 'asc') {
            setSortOrder('desc');
            return;
        }

        if (sortOrder === 'desc') {
            setSortBy(null);
            setSortOrder('asc');
        }
    };

    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return null;
        const m = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (!m) return null;
        const hh = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        return hh * 60 + mm;
    };

    const fetchEmployees = useCallback(async () => {
        if (!routeNumber || scheduleIndex === undefined || scheduleIndex === null || scheduleIndex < 0 || !corporationId) {
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.get(`/routes/employees-corporate/${corporationId}/${routeNumber}/${scheduleIndex}/${stopType}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    fiscalYear: fiscalYear,
                    day: selectedDay
                }
            });
            
            setEmployees(response.data.employees || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
            setError('Error al cargar los colaboradores');
        } finally {
            setLoading(false);
        }
    }, [routeNumber, scheduleIndex, stopType, corporationId, fiscalYear, selectedDay, auth.token]);

    useEffect(() => {
        if (open) {
            fetchEmployees();
        }
    }, [open, fetchEmployees]);

    // Filter employees
    const filteredEmployees = employees.filter(emp => {
        const nameMatch = !filters.name || emp.name?.toLowerCase().includes(filters.name.toLowerCase());
        const emailMatch = !filters.email || emp.email?.toLowerCase().includes(filters.email.toLowerCase());
        const stopTimeMatch = !filters.stopTime || emp.stopTime?.includes(filters.stopTime);
        const noteMatch = !filters.note || emp.note?.toLowerCase().includes(filters.note.toLowerCase());
        
        return nameMatch && emailMatch && stopTimeMatch && noteMatch;
    });

    // Sort employees
    const sortedEmployees = [...filteredEmployees].sort((a, b) => {
        if (!sortBy) return 0;
        
        let valA = '';
        let valB = '';
        
        switch (sortBy) {
            case 'name':
                valA = a.name || '';
                valB = b.name || '';
                break;
            case 'email':
                valA = a.email || '';
                valB = b.email || '';
                break;
            case 'stopTime':
                const minsA = parseTimeToMinutes(a.stopTime);
                const minsB = parseTimeToMinutes(b.stopTime);
                if (minsA === null && minsB === null) return 0;
                if (minsA === null) return sortOrder === 'asc' ? 1 : -1;
                if (minsB === null) return sortOrder === 'asc' ? -1 : 1;
                return sortOrder === 'asc' ? minsA - minsB : minsB - minsA;
            case 'note':
                valA = a.note || '';
                valB = b.note || '';
                break;
            default:
                return 0;
        }
        
        if (sortBy !== 'stopTime') {
            const cmp = valA.toString().toLowerCase().localeCompare(valB.toString().toLowerCase());
            return sortOrder === 'asc' ? cmp : -cmp;
        }
        
        return 0;
    });

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleClearFilters = () => {
        setFilters({
            name: '',
            email: '',
            stopTime: '',
            note: ''
        });
    };

    const stopTypeLabel = stopType === 'entrada' ? 'Entrada' : 'Salida';

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DirectionsBus color="primary" />
                        <Typography variant="h6">
                            Colaboradores - Ruta {routeNumber} - {scheduleName} ({stopTypeLabel})
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="error">{error}</Typography>
                    </Box>
                ) : (
                    <>
                        {/* Filter Controls */}
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} sm={3}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Filtrar por nombre"
                                    value={filters.name}
                                    onChange={(e) => handleFilterChange('name', e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Filtrar por email"
                                    value={filters.email}
                                    onChange={(e) => handleFilterChange('email', e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Filtrar por hora"
                                    value={filters.stopTime}
                                    onChange={(e) => handleFilterChange('stopTime', e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Filtrar por nota"
                                    value={filters.note}
                                    onChange={(e) => handleFilterChange('note', e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    onClick={handleClearFilters}
                                    sx={{ height: '40px' }}
                                >
                                    Limpiar
                                </Button>
                            </Grid>
                        </Grid>

                        {/* Results Summary */}
                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="textSecondary">
                                Mostrando {sortedEmployees.length} de {employees.length} colaboradores
                            </Typography>
                        </Box>

                        {/* Table */}
                        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortBy === 'name'}
                                                direction={sortBy === 'name' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('name')}
                                            >
                                                Nombre
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortBy === 'email'}
                                                direction={sortBy === 'email' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('email')}
                                            >
                                                Email
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortBy === 'stopTime'}
                                                direction={sortBy === 'stopTime' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('stopTime')}
                                            >
                                                Hora de Parada
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortBy === 'note'}
                                                direction={sortBy === 'note' ? sortOrder : 'asc'}
                                                onClick={() => handleSortChange('note')}
                                            >
                                                Notas
                                            </TableSortLabel>
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sortedEmployees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                                <Typography variant="body2" color="textSecondary">
                                                    No hay colaboradores asignados a esta ruta y horario
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sortedEmployees.map((emp, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {emp.name || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {emp.email || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {emp.stopTime || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="textSecondary">
                                                        {emp.note || '-'}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </DialogContent>
            
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    Cerrar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RouteEmployeesModal;
