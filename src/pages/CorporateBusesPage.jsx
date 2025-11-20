// src/pages/CorporateBusesPage.jsx

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

const CorporateBusesPage = () => {
    const { auth } = useContext(AuthContext);
    const { fiscalYear, corporationId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const stateCorporation = location.state?.corporation;
    const stateFiscalYear = location.state?.fiscalYear;

    const [buses, setBuses] = useState([]);
    const [corporationRouteNumbers, setCorporationRouteNumbers] = useState([]);
    const [routeBusAssignments, setRouteBusAssignments] = useState({});
    const [pilotAssignments, setPilotAssignments] = useState({});
    const [monitorAssignments, setMonitorAssignments] = useState({});
    const [availablePilots, setAvailablePilots] = useState([]);
    const [availableMonitors, setAvailableMonitors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const currentCorporation = stateCorporation;
    const currentFiscalYear = fiscalYear || stateFiscalYear;

    const fetchCorporationData = useCallback(async () => {
        if (!corporationId) return;
        try {
            const resp = await api.get(`/corporations/${corporationId}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const corporation = resp.data.corporation;
            if (corporation && corporation.routeNumbers) {
                let routeNumbers = corporation.routeNumbers;
                
                // Parse if it's a string
                if (typeof routeNumbers === 'string' && routeNumbers.trim()) {
                    try {
                        routeNumbers = JSON.parse(routeNumbers);
                    } catch (err) {
                        console.error('Error parsing routeNumbers:', err);
                        routeNumbers = [];
                    }
                }
                
                setCorporationRouteNumbers(Array.isArray(routeNumbers) ? routeNumbers : []);
            } else {
                setCorporationRouteNumbers([]);
            }
        } catch (err) {
            console.error('Error fetching corporation data:', err);
            setSnackbar({ open: true, message: 'Error al obtener datos de la corporación', severity: 'error' });
            setCorporationRouteNumbers([]);
        }
    }, [auth.token, corporationId]);

    const fetchBuses = useCallback(async () => {
        if (!corporationId) return;
        try {
            const resp = await api.get('/buses/simple', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const allBuses = resp.data.buses || resp.data || [];
            setBuses(allBuses);

            // Build map of current assignments (routeNumber -> busId)
            const assignments = {};
            const pilots = {};
            const monitors = {};
            
            allBuses.forEach(bus => {
                if (bus.routeNumber && bus.corporationId === parseInt(corporationId)) {
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
    }, [auth.token, corporationId]);

    const fetchPilots = useCallback(async () => {
        if (!corporationId) return;
        try {
            // Fetch pilots - adjust endpoint if needed for corporations
            const url = `/users/pilots?corporationId=${corporationId}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const pilots = Array.isArray(response.data.users) ? response.data.users : [];
            setAvailablePilots(pilots);
        } catch (err) {
            console.error('Error fetching pilots:', err);
            // Fallback: try to get all pilots with roleId=5
            try {
                const response = await api.get('/users/pilots', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setAvailablePilots(Array.isArray(response.data.users) ? response.data.users : []);
            } catch (fallbackErr) {
                console.error('Fallback fetch also failed:', fallbackErr);
                setAvailablePilots([]);
            }
        }
    }, [auth.token, corporationId]);

    const fetchMonitors = useCallback(async () => {
        if (!corporationId) return;
        try {
            // Fetch monitors - adjust endpoint if needed for corporations
            const url = `/users/monitors?corporationId=${corporationId}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const monitors = Array.isArray(response.data.users) ? response.data.users : [];
            setAvailableMonitors(monitors);
        } catch (err) {
            console.error('Error fetching monitors:', err);
            // Fallback: try to get all monitors with roleId=4
            try {
                const response = await api.get('/users/monitors', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setAvailableMonitors(Array.isArray(response.data.users) ? response.data.users : []);
            } catch (fallbackErr) {
                console.error('Fallback fetch also failed:', fallbackErr);
                setAvailableMonitors([]);
            }
        }
    }, [auth.token, corporationId]);

    useEffect(() => {
        if (auth.token && corporationId) {
            setLoading(true);
            Promise.all([fetchCorporationData(), fetchBuses(), fetchPilots(), fetchMonitors()])
                .finally(() => setLoading(false));
        }
    }, [auth.token, corporationId, fetchCorporationData, fetchBuses, fetchPilots, fetchMonitors]);

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
            // First, clear all existing assignments for this corporation
            const busesToClear = buses.filter(bus => 
                bus.corporationId === parseInt(corporationId) && (bus.routeNumber || bus.pilotId || bus.monitoraId)
            );
            
            for (const bus of busesToClear) {
                await api.put(`/buses/${bus.id}`, {
                    routeNumber: null,
                    pilotId: null,
                    monitoraId: null,
                    corporationId: null
                }, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
            }

            // Then, assign the new route numbers, pilots and monitors
            for (const [routeNumber, busId] of Object.entries(routeBusAssignments)) {
                if (busId && routeNumber) {
                    const updateData = {
                        routeNumber: routeNumber,
                        corporationId: parseInt(corporationId),
                        schoolId: null // Ensure it's not assigned to a school
                    };

                    // Add pilot/monitor explicitly (null if not assigned)
                    updateData.pilotId = pilotAssignments[busId] ? pilotAssignments[busId] : null;
                    updateData.monitoraId = monitorAssignments[busId] ? monitorAssignments[busId] : null;

                    await api.put(`/buses/${busId}`, updateData, {
                        headers: { Authorization: `Bearer ${auth.token}` }
                    });
                }
            }

            setSnackbar({ open: true, message: 'Asignaciones guardadas exitosamente', severity: 'success' });
            fetchBuses(); // Refresh data
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
        if (!corporationId) return;
        setLoading(true);
        try {
            await Promise.all([fetchCorporationData(), fetchBuses(), fetchPilots(), fetchMonitors()]);
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
            // Bus available if:
            // 1. Has no routeNumber assigned, or
            // 2. Is assigned to current routeNumber, or  
            // 3. Is not assigned to any route number of this corporation
            const isAssignedToCurrentRoute = bus.routeNumber === currentRouteNumber;
            const isAssignedToOtherRoute = bus.routeNumber && 
                bus.routeNumber !== currentRouteNumber && 
                bus.corporationId === parseInt(corporationId);
            
            return !isAssignedToOtherRoute || isAssignedToCurrentRoute;
        });
    };

    const getBusInfo = (busId) => {
        const bus = buses.find(b => b.id === parseInt(busId));
        if (!bus) return 'Bus no encontrado';
        return `${bus.plate} (Cap: ${bus.capacity || 'N/A'})`;
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
                            <Typography variant="h4">Asignación de Buses - {currentCorporation?.name || 'Cargando...'}</Typography>
                            <Typography variant="body2">Año Fiscal {currentFiscalYear}</Typography>
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
                    ) : corporationRouteNumbers.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <DirectionsBus sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                            <Typography variant="body1" color="textSecondary">
                                No hay números de ruta configurados para esta corporación.
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                Configure los números de ruta en la gestión de corporaciones.
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
                                    {corporationRouteNumbers.map((routeNumber) => {
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

                    {corporationRouteNumbers.length > 0 && (
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
                                • Los pilotos y monitoras deben pertenecer a la misma corporación
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

export default CorporateBusesPage;
