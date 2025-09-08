// src/pages/SchoolBusesPage.jsx

import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Snackbar,
    Alert,
    // FormControl, InputLabel, Select, MenuItem removed - replaced by Autocomplete
    TextField,
    Autocomplete,
    Chip
} from '@mui/material';
import { DirectionsBus, Save, Clear, ArrowBack, Refresh } from '@mui/icons-material';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';

const PageContainer = styled.div`
    ${tw`bg-gray-50 min-h-screen w-full`}
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
`;

const HeaderCard = styled(Card)`
    ${tw`mb-6 shadow-lg`}
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
`;

const SchoolBusesPage = () => {
    const { auth } = useContext(AuthContext);
    const { schoolYear, schoolId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const stateSchool = location.state?.school;
    const stateSchoolYear = location.state?.schoolYear;

    const [buses, setBuses] = useState([]);
    const [schoolRouteNumbers, setSchoolRouteNumbers] = useState([]);
    const [routeBusAssignments, setRouteBusAssignments] = useState({});
    const [pilotAssignments, setPilotAssignments] = useState({});
    const [monitorAssignments, setMonitorAssignments] = useState({});
    const [availablePilots, setAvailablePilots] = useState([]);
    const [availableMonitors, setAvailableMonitors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const currentSchool = stateSchool;
    const currentSchoolYear = schoolYear || stateSchoolYear;

    const fetchSchoolData = useCallback(async () => {
        if (!schoolId) return;
        try {
            const resp = await api.get(`/schools/${schoolId}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const school = resp.data.school;
            if (school && school.routeNumbers) {
                const routeNumbers = typeof school.routeNumbers === 'string' 
                    ? JSON.parse(school.routeNumbers) 
                    : school.routeNumbers;
                setSchoolRouteNumbers(Array.isArray(routeNumbers) ? routeNumbers : []);
            } else {
                setSchoolRouteNumbers([]);
            }
        } catch (err) {
            console.error('Error fetching school data:', err);
            setSnackbar({ open: true, message: 'Error al obtener datos del colegio', severity: 'error' });
            setSchoolRouteNumbers([]);
        }
    }, [auth.token, schoolId]);

    const fetchBuses = useCallback(async () => {
        if (!schoolId) return;
        try {
            const resp = await api.get('/buses/simple', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const allBuses = resp.data.buses || resp.data || [];
            setBuses(allBuses);

            // Construir mapa de asignaciones actuales (routeNumber -> busId)
            const assignments = {};
            const pilots = {};
            const monitors = {};
            
            allBuses.forEach(bus => {
                if (bus.routeNumber && bus.schoolId === parseInt(schoolId)) {
                    assignments[bus.routeNumber] = bus.id;
                    if (bus.pilotId) {
                        pilots[bus.id] = bus.pilotId;
                    }
                    if (bus.monitoraId) {
                        monitors[bus.id] = bus.monitoraId;
                    }
                }
            });
            setRouteBusAssignments(assignments);
            setPilotAssignments(pilots);
            setMonitorAssignments(monitors);
        } catch (err) {
            console.error('Error fetching buses:', err);
            setSnackbar({ open: true, message: 'Error al obtener buses', severity: 'error' });
            setBuses([]);
        }
    }, [auth.token, schoolId]);

    const fetchPilots = useCallback(async () => {
        if (!schoolId) return;
        try {
            const url = `/users/pilots?schoolId=${schoolId}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const pilots = Array.isArray(response.data.users) ? response.data.users : [];
            setAvailablePilots(pilots);
        } catch (err) {
            console.error('Error fetching pilots:', err);
            setAvailablePilots([]);
        }
    }, [auth.token, schoolId]);

    const fetchMonitors = useCallback(async () => {
        if (!schoolId) return;
        try {
            const url = `/users/monitors?schoolId=${schoolId}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const monitors = Array.isArray(response.data.users) ? response.data.users : [];
            setAvailableMonitors(monitors);
        } catch (err) {
            console.error('Error fetching monitors:', err);
            setAvailableMonitors([]);
        }
    }, [auth.token, schoolId]);

    useEffect(() => {
        if (auth.token && schoolId) {
            setLoading(true);
            Promise.all([fetchSchoolData(), fetchBuses(), fetchPilots(), fetchMonitors()])
                .finally(() => setLoading(false));
        }
    }, [auth.token, schoolId, fetchSchoolData, fetchBuses, fetchPilots, fetchMonitors]);

    const handleAssignmentChange = (routeNumber, busId) => {
        setRouteBusAssignments(prev => ({
            ...prev,
            [routeNumber]: busId || null
        }));
    };

    const handlePilotAssignmentChange = (busId, pilotId) => {
        setPilotAssignments(prev => ({
            ...prev,
            [busId]: pilotId || null
        }));
    };

    const handleMonitorAssignmentChange = (busId, monitorId) => {
        setMonitorAssignments(prev => ({
            ...prev,
            [busId]: monitorId || null
        }));
    };

    const handleSaveAssignments = async () => {
        setSaving(true);
        try {
            // Primero, limpiar todas las asignaciones existentes para este colegio
            const busesToClear = buses.filter(bus => 
                bus.schoolId === parseInt(schoolId) && (bus.routeNumber || bus.pilotId || bus.monitoraId)
            );
            
            for (const bus of busesToClear) {
                await api.put(`/buses/${bus.id}`, {
                    routeNumber: null,
                    pilotId: null,
                    monitoraId: null,
                    schoolId: null
                }, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
            }

            // Luego, asignar los nuevos números de ruta, pilotos y monitoras
            for (const [routeNumber, busId] of Object.entries(routeBusAssignments)) {
                if (busId && routeNumber) {
                    const updateData = {
                        routeNumber: routeNumber,
                        schoolId: parseInt(schoolId)
                    };

                    // Añadir piloto/monitora explícitamente (null si no asignado)
                    updateData.pilotId = pilotAssignments[busId] ? pilotAssignments[busId] : null;
                    updateData.monitoraId = monitorAssignments[busId] ? monitorAssignments[busId] : null;

                    await api.put(`/buses/${busId}`, updateData, {
                        headers: { Authorization: `Bearer ${auth.token}` }
                    });
                }
            }

            setSnackbar({ open: true, message: 'Asignaciones guardadas exitosamente', severity: 'success' });
            fetchBuses(); // Refrescar datos
        } catch (err) {
            console.error('Error saving assignments:', err);
            setSnackbar({ open: true, message: 'Error al guardar asignaciones', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleClearAssignments = () => {
        setRouteBusAssignments({});
        setPilotAssignments({});
        setMonitorAssignments({});
    };

    const handleRefresh = async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            await Promise.all([fetchSchoolData(), fetchBuses(), fetchPilots(), fetchMonitors()]);
            setSnackbar({ open: true, message: 'Datos actualizados', severity: 'success' });
        } catch (err) {
            console.error('Error refreshing data:', err);
            setSnackbar({ open: true, message: 'Error al actualizar datos', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        navigate(-1);
    };

    const getAvailableBuses = (currentRouteNumber) => {
        return buses.filter(bus => {
            // Bus disponible si:
            // 1. No tiene routeNumber asignado, o
            // 2. Está asignado al routeNumber actual, o  
            // 3. No está asignado a ningún número de ruta de este colegio
            const isAssignedToCurrentRoute = bus.routeNumber === currentRouteNumber;
            const isAssignedToOtherRoute = bus.routeNumber && 
                bus.routeNumber !== currentRouteNumber && 
                bus.schoolId === parseInt(schoolId);
            
            return !isAssignedToOtherRoute || isAssignedToCurrentRoute;
        });
    };

    const getBusInfo = (busId) => {
        const bus = buses.find(b => b.id === parseInt(busId));
        if (!bus) return 'Bus no encontrado';
        return `${bus.plate} (Cap: ${bus.capacity || 'N/A'})`;
    };

    // Helper functions for potential future use
    // eslint-disable-next-line no-unused-vars
    const getPilotName = (pilotId) => {
        const pilot = availablePilots.find(p => p.id === parseInt(pilotId));
        return pilot ? pilot.name || pilot.email : '';
    };

    // eslint-disable-next-line no-unused-vars
    const getMonitorName = (monitorId) => {
        const monitor = availableMonitors.find(m => m.id === parseInt(monitorId));
        return monitor ? monitor.name || monitor.email : '';
    };

    return (
        <PageContainer>
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={handleBack}
                            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                        >
                            Volver
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <DirectionsBus sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4">Asignación de Buses - {currentSchool?.name || 'Cargando...'}</Typography>
                            <Typography variant="body2">Ciclo Escolar {currentSchoolYear}</Typography>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Asignación de Rutas, Buses, Pilotos y Monitoras</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button 
                                variant="outlined" 
                                startIcon={<Clear />} 
                                onClick={handleClearAssignments}
                                disabled={saving}
                            >
                                Limpiar
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<Refresh />}
                                onClick={handleRefresh}
                                disabled={loading}
                            >
                                Refrescar
                            </Button>
                            <Button 
                                variant="contained" 
                                startIcon={<Save />} 
                                onClick={handleSaveAssignments}
                                disabled={saving}
                            >
                                {saving ? 'Guardando...' : 'Guardar Asignaciones'}
                            </Button>
                        </Box>
                    </Box>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : schoolRouteNumbers.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <DirectionsBus sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                            <Typography variant="body1" color="textSecondary">
                                No hay números de ruta configurados para este colegio.
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                Configure los números de ruta en la gestión de colegios.
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer component={Paper} sx={{ mt: 2 }}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>Número de Ruta</strong></TableCell>
                                        <TableCell><strong>Bus Asignado</strong></TableCell>
                                        <TableCell><strong>Piloto</strong></TableCell>
                                        <TableCell><strong>Monitora</strong></TableCell>
                                        <TableCell><strong>Estado</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {schoolRouteNumbers.map((routeNumber) => {
                                        const assignedBusId = routeBusAssignments[routeNumber];
                                        const availableBuses = getAvailableBuses(routeNumber);
                                        
                                        return (
                                            <TableRow key={routeNumber}>
                                                <TableCell>
                                                    <Typography variant="h6" color="primary">
                                                        Ruta {routeNumber}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Autocomplete
                                                        disableClearable={false}
                                                        options={availableBuses}
                                                        getOptionLabel={(option) => option ? `${option.plate} (${option.capacity || 'N/A'})` : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={availableBuses.find(b => b.id === assignedBusId) || null}
                                                        onChange={(_, newValue) => handleAssignmentChange(routeNumber, newValue ? newValue.id : null)}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Seleccionar Bus"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                        renderOption={(props, option) => (
                                                            <li {...props} key={option.id}>
                                                                {getBusInfo(option.id)}
                                                            </li>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Autocomplete
                                                        disabled={!assignedBusId}
                                                        options={availablePilots.slice().sort((a,b)=>{
                                                            const an = (a.name || a.email || '').toLowerCase();
                                                            const bn = (b.name || b.email || '').toLowerCase();
                                                            return an < bn ? -1 : an > bn ? 1 : 0;
                                                        })}
                                                        getOptionLabel={(option) => option ? (option.name || option.email) : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={assignedBusId ? availablePilots.find(p => p.id === pilotAssignments[assignedBusId]) || null : null}
                                                        onChange={(_, newValue) => assignedBusId && handlePilotAssignmentChange(assignedBusId, newValue ? newValue.id : null)}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Seleccionar Piloto"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                        clearOnEscape
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Autocomplete
                                                        disabled={!assignedBusId}
                                                        options={availableMonitors.slice().sort((a,b)=>{
                                                            const an = (a.name || a.email || '').toLowerCase();
                                                            const bn = (b.name || b.email || '').toLowerCase();
                                                            return an < bn ? -1 : an > bn ? 1 : 0;
                                                        })}
                                                        getOptionLabel={(option) => option ? (option.name || option.email) : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={assignedBusId ? availableMonitors.find(m => m.id === monitorAssignments[assignedBusId]) || null : null}
                                                        onChange={(_, newValue) => assignedBusId && handleMonitorAssignmentChange(assignedBusId, newValue ? newValue.id : null)}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Seleccionar Monitora"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                        clearOnEscape
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {assignedBusId ? (
                                                        <Chip 
                                                            label="Asignado" 
                                                            color="success" 
                                                            size="small"
                                                        />
                                                    ) : (
                                                        <Chip 
                                                            label="Sin asignar" 
                                                            color="warning" 
                                                            size="small"
                                                        />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {schoolRouteNumbers.length > 0 && (
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Información:
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Cada número de ruta puede tener asignado solo un bus
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Un bus solo puede estar asignado a un número de ruta a la vez
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Los pilotos y monitoras solo se pueden asignar si hay un bus asignado
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Los pilotos y monitoras deben pertenecer al mismo colegio
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default SchoolBusesPage;
