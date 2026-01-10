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
    // Per-route pilot assignments for corporation routes when no bus is selected
    const [routePilotAssignments, setRoutePilotAssignments] = useState({});
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
            // Fetch only pilots that belong to this corporation
            const url = `/users/pilots?corporationId=${corporationId}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const pilots = Array.isArray(response.data.users) ? response.data.users : [];
            setAvailablePilots(pilots);
        } catch (err) {
            console.error('Error fetching pilots:', err);
            setAvailablePilots([]);
        }
    }, [auth.token, corporationId]);

    // Monitoras are not used for corporations, but keep empty array for compatibility
    const fetchMonitors = useCallback(async () => {
        // Monitoras don't apply to corporations
        setAvailableMonitors([]);
    }, []);

    const fetchRouteAssignments = useCallback(async () => {
        if (!corporationId) return;
        try {
            const response = await api.get(`/route-assignments?corporationId=${corporationId}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const assignments = response.data.assignments || response.data || [];
            const routePilots = {};
            assignments.forEach(assignment => {
                if (assignment.routeNumber && assignment.pilotId) {
                    routePilots[assignment.routeNumber] = assignment.pilotId;
                }
            });
            setRoutePilotAssignments(routePilots);
        } catch (err) {
            console.error('Error fetching route assignments:', err);
        }
    }, [auth.token, corporationId]);

    useEffect(() => {
        if (auth.token && corporationId) {
            setLoading(true);
            Promise.all([fetchCorporationData(), fetchBuses(), fetchPilots(), fetchMonitors(), fetchRouteAssignments()])
                .finally(() => setLoading(false));
        }
    }, [auth.token, corporationId, fetchCorporationData, fetchBuses, fetchPilots, fetchMonitors, fetchRouteAssignments]);

    const handleAssignmentChange = (routeNumber, newBusId) => {
        // Get the previous bus assigned to this route
        const previousBusId = routeBusAssignments[routeNumber];
        
        // If there was a previous bus and a new bus, transfer pilot
        if (previousBusId && newBusId && previousBusId !== newBusId) {
            const previousPilotId = pilotAssignments[previousBusId];
            
            // Transfer pilot to the new bus
            setPilotAssignments(prev => {
                const updated = { ...prev };
                // Assign the pilot from the previous bus to the new bus
                if (previousPilotId) {
                    updated[newBusId] = previousPilotId;
                }
                // Clear the previous bus (no longer assigned to this route)
                delete updated[previousBusId];
                return updated;
            });
        } else if (previousBusId && !newBusId) {
            // When removing the bus, transfer pilot to route-level assignment
            const previousPilotId = pilotAssignments[previousBusId];
            
            if (previousPilotId) {
                // Transfer to route-level assignment
                setRoutePilotAssignments(prev => ({
                    ...prev,
                    [routeNumber]: previousPilotId
                }));
                
                // Clear the bus assignment
                setPilotAssignments(prev => {
                    const updated = { ...prev };
                    delete updated[previousBusId];
                    return updated;
                });
            }
        }
        
        setRouteBusAssignments(prev => ({
            ...prev,
            [routeNumber]: newBusId || null
        }));
        
        // If a per-route pilot was set and now a bus is selected, transfer it
        if (newBusId) {
            const currentRoutePilot = routePilotAssignments[routeNumber];
            
            if (currentRoutePilot) {
                // Update pilot assignment for the new bus
                setPilotAssignments(prev => ({
                    ...prev,
                    [newBusId]: currentRoutePilot
                }));

                // Clear route-level pilot assignment
                setRoutePilotAssignments(prev => {
                    const updated = { ...prev };
                    delete updated[routeNumber];
                    return updated;
                });
            }
        }
    };

    const handlePilotAssignmentChange = (busId, pilotId) => {
        setPilotAssignments(prev => ({
            ...prev,
            [busId]: pilotId || null
        }));
    };

    const handleRoutePilotChange = (routeNumber, pilotId) => {
        setRoutePilotAssignments(prev => ({
            ...prev,
            [routeNumber]: pilotId || null
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
            const errors = [];
            const successfulChanges = [];

            // Get current buses state from server
            const currentBusesResponse = await api.get('/buses', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const currentBuses = currentBusesResponse.data;

            // Create map of current assignments on the server
            const serverAssignments = {};
            currentBuses.forEach(bus => {
                if (bus.corporationId === parseInt(corporationId) && bus.routeNumber) {
                    serverAssignments[bus.routeNumber] = {
                        busId: bus.id,
                        pilotId: bus.pilotId
                    };
                }
            });

            // Create map of desired assignments (current UI state)
            const desiredAssignments = {};
            Object.entries(routeBusAssignments).forEach(([routeNumber, busId]) => {
                if (busId) {
                    desiredAssignments[routeNumber] = {
                        busId: busId,
                        pilotId: pilotAssignments[busId] || null
                    };
                }
            });

            // Process each route for changes
            for (const routeNumber of corporationRouteNumbers) {
                const serverData = serverAssignments[routeNumber];
                const desiredData = desiredAssignments[routeNumber];

                // Case 1: Route had a bus and now has none (only clear)
                if (serverData && !desiredData) {
                    try {
                        await api.put(`/buses/${serverData.busId}`, {
                            routeNumber: null,
                            corporationId: null,
                            pilotId: null,
                            monitoraId: null
                        }, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        successfulChanges.push(`Ruta ${routeNumber}: bus ${getBusInfo(serverData.busId)} desasignado`);
                    } catch (err) {
                        const busInfo = getBusInfo(serverData.busId);
                        errors.push(`Error al desasignar bus ${busInfo} de ruta ${routeNumber}: ${err.response?.data?.message || err.message}`);
                    }
                    continue;
                }

                // Case 2: Route had no bus and now has one (only assign)
                if (!serverData && desiredData) {
                    try {
                        await api.put(`/buses/${desiredData.busId}`, {
                            routeNumber: routeNumber,
                            corporationId: parseInt(corporationId),
                            pilotId: desiredData.pilotId,
                            monitoraId: null, // Corporations don't use monitoras
                            schoolId: null // Ensure it's not assigned to a school
                        }, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        successfulChanges.push(`Ruta ${routeNumber}: bus ${getBusInfo(desiredData.busId)} asignado`);
                    } catch (err) {
                        const busInfo = getBusInfo(desiredData.busId);
                        const errorMsg = err.response?.data?.message;
                        if (errorMsg) {
                            errors.push(`Ruta ${routeNumber} - Bus ${busInfo}: ${errorMsg}`);
                        } else {
                            errors.push(`Error al asignar bus ${busInfo} a ruta ${routeNumber}: ${err.message}`);
                        }
                    }
                    continue;
                }

                // Case 3: Route has same bus but pilot changed (only update)
                if (serverData && desiredData && serverData.busId === desiredData.busId) {
                    const needsUpdate = serverData.pilotId !== desiredData.pilotId;
                    if (needsUpdate) {
                        try {
                            await api.put(`/buses/${desiredData.busId}`, {
                                routeNumber: routeNumber,
                                corporationId: parseInt(corporationId),
                                pilotId: desiredData.pilotId,
                                monitoraId: null
                            }, {
                                headers: { Authorization: `Bearer ${auth.token}` }
                            });
                            successfulChanges.push(`Ruta ${routeNumber}: actualizado piloto`);
                        } catch (err) {
                            const busInfo = getBusInfo(desiredData.busId);
                            errors.push(`Error al actualizar bus ${busInfo} en ruta ${routeNumber}: ${err.response?.data?.message || err.message}`);
                        }
                    }
                    continue;
                }

                // Case 4: Route changed bus (assign the new one)
                if (serverData && desiredData && serverData.busId !== desiredData.busId) {
                    // Assign the new bus to this route
                    // Backend will automatically free the previous bus via automatic replacement
                    try {
                        await api.put(`/buses/${desiredData.busId}`, {
                            routeNumber: routeNumber,
                            corporationId: parseInt(corporationId),
                            pilotId: desiredData.pilotId,
                            monitoraId: null,
                            schoolId: null
                        }, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        
                        // NOTE: We don't manually clear the previous bus
                        // Backend does it automatically when assigning the new bus
                        // This avoids conflicts in bus exchange scenarios
                        
                        successfulChanges.push(`Ruta ${routeNumber}: cambiado de bus ${getBusInfo(serverData.busId)} a ${getBusInfo(desiredData.busId)}`);
                    } catch (err) {
                        // If new bus assignment fails, route keeps its original assignment
                        const busInfo = getBusInfo(desiredData.busId);
                        const errorMsg = err.response?.data?.message;
                        if (errorMsg) {
                            errors.push(`Ruta ${routeNumber} - Bus ${busInfo}: ${errorMsg}`);
                        } else {
                            errors.push(`Error al cambiar bus de ruta ${routeNumber} a ${busInfo}: ${err.message}`);
                        }
                    }
                    continue;
                }
            }

            // Persist per-route pilot assignments (no bus) as RouteAssignments
            for (const routeNumber of corporationRouteNumbers) {
                const hasBus = !!routeBusAssignments[routeNumber];
                const rp = routePilotAssignments[routeNumber] || null;
                if (!hasBus && rp) {
                    try {
                        await api.post('/route-assignments', {
                            corporationId: parseInt(corporationId),
                            routeNumber: routeNumber,
                            pilotId: rp
                        }, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        successfulChanges.push(`Ruta ${routeNumber}: asignación por ruta guardada`);
                    } catch (err) {
                        console.error('Error saving corporation route assignment:', err);
                        errors.push(`Error al guardar asignación de ruta ${routeNumber}: ${err.response?.data?.message || err.message}`);
                    }
                } else if (!hasBus && !rp) {
                    // Delete route assignment if no bus and no pilot
                    try {
                        await api.delete(`/route-assignments?corporationId=${corporationId}&routeNumber=${routeNumber}`, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                    } catch (err) {
                        // Ignore 404 errors (no assignment to delete)
                        if (err.response?.status !== 404) {
                            console.error('Error deleting route assignment:', err);
                        }
                    }
                }
            }

            // Show results
            if (errors.length > 0) {
                setSnackbar({ 
                    open: true, 
                    message: `Errores: ${errors.join('; ')}`, 
                    severity: 'error' 
                });
            } else if (successfulChanges.length === 0) {
                setSnackbar({ open: true, message: 'No hay cambios que guardar', severity: 'info' });
            } else {
                setSnackbar({ open: true, message: 'Asignaciones guardadas exitosamente', severity: 'success' });
            }

            // Only refresh if there were successful changes
            if (successfulChanges.length > 0) {
                fetchBuses(); // Refresh data only on success
            }
        } catch (err) {
            console.error('Error saving assignments:', err);
            setSnackbar({ open: true, message: `Error al guardar asignaciones: ${err.response?.data?.message || err.message}`, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleClearAssignments = () => {
        setRouteBusAssignments({});
        setPilotAssignments({});
        setMonitorAssignments({});
        setRoutePilotAssignments({});
    };

    const handleRefresh = async () => {
        if (!corporationId) return;
        setLoading(true);
        try {
            await Promise.all([fetchCorporationData(), fetchBuses(), fetchPilots(), fetchMonitors(), fetchRouteAssignments()]);
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
        // Obtener IDs de buses ya asignados a otras rutas de esta corporación en el estado actual
        const busesAssignedToOtherRoutes = new Set();
        Object.entries(routeBusAssignments).forEach(([routeNum, busId]) => {
            if (routeNum !== currentRouteNumber && busId) {
                busesAssignedToOtherRoutes.add(busId);
            }
        });

        return buses.filter(bus => {
            // Si el bus está asignado a la ruta actual, siempre mostrarlo
            if (routeBusAssignments[currentRouteNumber] === bus.id) {
                return true;
            }
            // Excluir buses ya asignados a otras rutas de esta corporación en el estado actual
            if (busesAssignedToOtherRoutes.has(bus.id)) {
                return false;
            }
            // No excluir buses asignados a otros colegios/corporaciones
            // El backend validará y mostrará un error apropiado si el bus ya está asignado
            return true;
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
                                                        disabled={false}
                                                        options={assignedBusId
                                                            ? availablePilots.slice().sort((a,b)=>{
                                                                const an = (a.name || a.email || '').toLowerCase();
                                                                const bn = (b.name || b.email || '').toLowerCase();
                                                                return an < bn ? -1 : an > bn ? 1 : 0;
                                                            })
                                                            : availablePilots.filter(pilot => {
                                                                const assignedPilots = new Set(Object.values(pilotAssignments).filter(Boolean));
                                                                const routeAssignedPilots = new Set(Object.values(routePilotAssignments).filter(Boolean));
                                                                return !assignedPilots.has(pilot.id) && !routeAssignedPilots.has(pilot.id);
                                                            }).sort((a,b)=>{
                                                                const an = (a.name || a.email || '').toLowerCase();
                                                                const bn = (b.name || b.email || '').toLowerCase();
                                                                return an < bn ? -1 : an > bn ? 1 : 0;
                                                            })}
                                                        getOptionLabel={(option) => option ? (option.name || option.email) : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={assignedBusId ? availablePilots.find(p => p.id === pilotAssignments[assignedBusId]) || null : (routePilotAssignments[routeNumber] ? availablePilots.find(p => p.id === routePilotAssignments[routeNumber]) || null : null)}
                                                        onChange={(_, newValue) => {
                                                            if (assignedBusId) {
                                                                handlePilotAssignmentChange(assignedBusId, newValue ? newValue.id : null);
                                                            } else {
                                                                handleRoutePilotChange(routeNumber, newValue ? newValue.id : null);
                                                            }
                                                        }}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Seleccionar Piloto"
                                                                variant="outlined"
                                                                helperText={!assignedBusId && routePilotAssignments[routeNumber] ? 'Asignación por ruta (sin bus)' : ''}
                                                            />
                                                        )}
                                                        clearOnEscape
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        disabled
                                                        value="No aplica"
                                                        variant="outlined"
                                                        label="Monitora"
                                                        InputProps={{
                                                            readOnly: true,
                                                        }}
                                                        sx={{ 
                                                            '& .MuiInputBase-input.Mui-disabled': {
                                                                WebkitTextFillColor: '#999',
                                                            }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {(assignedBusId || routePilotAssignments[routeNumber]) ? (
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
                                • Solo se muestran buses que no están asignados a ningún colegio ni corporación
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Los pilotos se pueden asignar también sin un bus; se guardarán como asignaciones de ruta
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Solo se muestran pilotos que pertenecen a esta corporación
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Las monitoras no aplican para corporaciones
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
