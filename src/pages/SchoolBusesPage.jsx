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

    const handleAssignmentChange = (routeNumber, newBusId) => {
        // Obtener el bus anterior asignado a esta ruta
        const previousBusId = routeBusAssignments[routeNumber];
        
        // Si hay un bus anterior y un nuevo bus, transferir piloto y monitora
        if (previousBusId && newBusId && previousBusId !== newBusId) {
            const previousPilotId = pilotAssignments[previousBusId];
            const previousMonitorId = monitorAssignments[previousBusId];
            
            // Transferir asignaciones al nuevo bus
            setPilotAssignments(prev => {
                const updated = { ...prev };
                // Asignar al nuevo bus el piloto del anterior
                if (previousPilotId) {
                    updated[newBusId] = previousPilotId;
                }
                // Limpiar el bus anterior (ya no está asignado a esta ruta)
                delete updated[previousBusId];
                return updated;
            });
            
            setMonitorAssignments(prev => {
                const updated = { ...prev };
                // Asignar al nuevo bus la monitora del anterior
                if (previousMonitorId) {
                    updated[newBusId] = previousMonitorId;
                }
                // Limpiar el bus anterior
                delete updated[previousBusId];
                return updated;
            });
        } else if (previousBusId && !newBusId) {
            // FIX: Al quitar el bus (presionar X), NO limpiar piloto/monitora
            // Las asignaciones de piloto/monitora permanecen en el estado
            // La validación antes de guardar detectará esto y pedirá al usuario
            // que asigne un bus o elimine las asignaciones manualmente
        }
        
        setRouteBusAssignments(prev => ({
            ...prev,
            [routeNumber]: newBusId || null
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
            // VALIDACIÓN: Detectar rutas sin bus pero con piloto/monitora asignados
            const validationErrors = [];
            
            // Recorrer todas las rutas configuradas
            for (const routeNumber of schoolRouteNumbers) {
                const assignedBusId = routeBusAssignments[routeNumber];
                
                // Si NO hay bus asignado a esta ruta
                if (!assignedBusId) {
                    // Verificar si hay piloto o monitora asociados a algún busId
                    // que anteriormente estaba en esta ruta
                    // Como el bug era que al quitar el bus NO se limpiaban piloto/monitora,
                    // ahora pueden quedar "huérfanos" en el estado
                    
                    // Buscar en pilotAssignments y monitorAssignments
                    // Necesitamos detectar si hay asignaciones que quedaron del bus anterior
                    // Pero como ya no hay busId en routeBusAssignments[routeNumber],
                    // no hay forma directa de saber qué piloto/monitora pertenecían a esta ruta
                    
                    // Enfoque alternativo: revisar si hay piloto/monitora en buses
                    // que NO están asignados a ninguna ruta
                    continue; // Por ahora, skip - necesitamos otro enfoque
                }
                
                // Si hay bus asignado, está OK (puede o no tener piloto/monitora)
            }
            
            // Enfoque correcto: detectar asignaciones de piloto/monitora en buses
            // que NO están asignados a ninguna ruta
            const assignedBusIds = new Set(Object.values(routeBusAssignments).filter(Boolean));
            
            // Buscar pilotos asignados a buses que no están en ninguna ruta
            Object.entries(pilotAssignments).forEach(([busId, pilotId]) => {
                if (pilotId && !assignedBusIds.has(parseInt(busId))) {
                    const pilot = availablePilots.find(p => p.id === pilotId);
                    const bus = buses.find(b => b.id === parseInt(busId));
                    validationErrors.push(
                        ``
                    );
                }
            });
            
            // Buscar monitoras asignadas a buses que no están en ninguna ruta
            Object.entries(monitorAssignments).forEach(([busId, monitorId]) => {
                if (monitorId && !assignedBusIds.has(parseInt(busId))) {
                    const monitor = availableMonitors.find(m => m.id === monitorId);
                    const bus = buses.find(b => b.id === parseInt(busId));
                    validationErrors.push(
                        ``
                    );
                }
            });
            
            if (validationErrors.length > 0) {
                setSnackbar({ 
                    open: true, 
                    message: `No se puede guardar. ${validationErrors.join('. ')}. Por favor, elimine las asignaciones de piloto/monitora o asigne un bus a esta ruta.`, 
                    severity: 'error' 
                });
                setSaving(false);
                return;
            }
            
            // Obtener el estado actual de buses desde el servidor para comparar
            const currentBusesResp = await api.get('/buses/simple', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const currentBuses = currentBusesResp.data.buses || currentBusesResp.data || [];
            
            // Helper para obtener info del bus por ID
            const getBusPlate = (busId) => {
                const bus = currentBuses.find(b => b.id === busId) || buses.find(b => b.id === busId);
                return bus ? bus.plate : `ID:${busId}`;
            };

            const getBusCurrentAssignment = (busId) => {
                const bus = currentBuses.find(b => b.id === busId);
                if (!bus) return '';
                if (bus.schoolId && bus.school) {
                    return ` (actualmente asignado a colegio: ${bus.school.name || bus.school.shortName || 'ID:' + bus.schoolId})`;
                }
                if (bus.corporationId && bus.corporation) {
                    return ` (actualmente asignado a corporación: ${bus.corporation.name || 'ID:' + bus.corporationId})`;
                }
                if (bus.schoolId) {
                    return ` (actualmente asignado a otro colegio ID:${bus.schoolId})`;
                }
                if (bus.corporationId) {
                    return ` (actualmente asignado a corporación ID:${bus.corporationId})`;
                }
                return '';
            };
            
            // Crear mapa de asignaciones actuales en el servidor
            const serverAssignments = {};
            currentBuses.forEach(bus => {
                if (bus.schoolId === parseInt(schoolId) && bus.routeNumber) {
                    serverAssignments[bus.routeNumber] = {
                        busId: bus.id,
                        pilotId: bus.pilotId,
                        monitoraId: bus.monitoraId
                    };
                }
            });

            // Crear mapa de asignaciones deseadas (UI actual)
            const desiredAssignments = {};
            Object.entries(routeBusAssignments).forEach(([routeNumber, busId]) => {
                if (busId) {
                    desiredAssignments[routeNumber] = {
                        busId: busId,
                        pilotId: pilotAssignments[busId] || null,
                        monitoraId: monitorAssignments[busId] || null
                    };
                }
            });

            const errors = [];
            const successfulChanges = [];

            // Procesar cada ruta que tiene cambios
            for (const routeNumber of schoolRouteNumbers) {
                const serverData = serverAssignments[routeNumber];
                const desiredData = desiredAssignments[routeNumber];

                // Caso 1: La ruta tenía un bus y ahora no tiene ninguno (solo limpiar)
                if (serverData && !desiredData) {
                    try {
                        await api.put(`/buses/${serverData.busId}`, {
                            routeNumber: null,
                            schoolId: null,
                            pilotId: null,
                            monitoraId: null
                        }, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        successfulChanges.push(`Ruta ${routeNumber}: bus ${getBusPlate(serverData.busId)} desasignado`);
                    } catch (err) {
                        const busPlate = getBusPlate(serverData.busId);
                        errors.push(`Error al desasignar bus ${busPlate} de ruta ${routeNumber}: ${err.response?.data?.message || err.message}`);
                    }
                    continue;
                }

                // Caso 2: La ruta no tenía bus y ahora tiene uno (solo asignar)
                if (!serverData && desiredData) {
                    try {
                        await api.put(`/buses/${desiredData.busId}`, {
                            routeNumber: routeNumber,
                            schoolId: parseInt(schoolId),
                            pilotId: desiredData.pilotId,
                            monitoraId: desiredData.monitoraId
                        }, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        successfulChanges.push(`Ruta ${routeNumber}: bus ${getBusPlate(desiredData.busId)} asignado`);
                    } catch (err) {
                        const busPlate = getBusPlate(desiredData.busId);
                        // Si el backend envió un mensaje, usarlo directamente sin agregar información adicional
                        const errorMsg = err.response?.data?.message;
                        if (errorMsg) {
                            errors.push(`Ruta ${routeNumber} - Bus ${busPlate}: ${errorMsg}`);
                        } else {
                            const currentAssignment = getBusCurrentAssignment(desiredData.busId);
                            errors.push(`Error al asignar bus ${busPlate} a ruta ${routeNumber}${currentAssignment}: ${err.message}`);
                        }
                    }
                    continue;
                }

                // Caso 3: La ruta tiene el mismo bus pero cambió piloto/monitora (solo actualizar)
                if (serverData && desiredData && serverData.busId === desiredData.busId) {
                    const needsUpdate = serverData.pilotId !== desiredData.pilotId || 
                                       serverData.monitoraId !== desiredData.monitoraId;
                    if (needsUpdate) {
                        try {
                            await api.put(`/buses/${desiredData.busId}`, {
                                routeNumber: routeNumber,
                                schoolId: parseInt(schoolId),
                                pilotId: desiredData.pilotId,
                                monitoraId: desiredData.monitoraId
                            }, {
                                headers: { Authorization: `Bearer ${auth.token}` }
                            });
                            successfulChanges.push(`Ruta ${routeNumber}: actualizado piloto/monitora`);
                        } catch (err) {
                            const busPlate = getBusPlate(desiredData.busId);
                            errors.push(`Error al actualizar bus ${busPlate} en ruta ${routeNumber}: ${err.response?.data?.message || err.message}`);
                        }
                    }
                    continue;
                }

                // Caso 4: La ruta cambió de bus (asignar el nuevo)
                if (serverData && desiredData && serverData.busId !== desiredData.busId) {
                    // Asignar el nuevo bus a esta ruta
                    // El backend automáticamente liberará el bus anterior mediante reemplazo automático
                    try {
                        await api.put(`/buses/${desiredData.busId}`, {
                            routeNumber: routeNumber,
                            schoolId: parseInt(schoolId),
                            pilotId: desiredData.pilotId,
                            monitoraId: desiredData.monitoraId
                        }, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        
                        // NOTA: NO limpiamos el bus anterior manualmente
                        // El backend ya lo hace automáticamente al asignar el nuevo bus
                        // Esto evita conflictos en escenarios de intercambio de buses
                        
                        successfulChanges.push(`Ruta ${routeNumber}: cambiado de bus ${getBusPlate(serverData.busId)} a ${getBusPlate(desiredData.busId)}`);
                    } catch (err) {
                        // Si falla la asignación del nuevo bus, la ruta mantiene su asignación original
                        const busPlate = getBusPlate(desiredData.busId);
                        // Si el backend envió un mensaje, usarlo directamente sin agregar información adicional
                        const errorMsg = err.response?.data?.message;
                        if (errorMsg) {
                            errors.push(`Ruta ${routeNumber} - Bus ${busPlate}: ${errorMsg}`);
                        } else {
                            const currentAssignment = getBusCurrentAssignment(desiredData.busId);
                            errors.push(`Error al cambiar bus de ruta ${routeNumber} a ${busPlate}${currentAssignment}: ${err.message}`);
                        }
                    }
                    continue;
                }
            }

            // Mostrar resultado
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
            
            fetchBuses(); // Refrescar datos para sincronizar UI con servidor
        } catch (err) {
            console.error('Error saving assignments:', err);
            setSnackbar({ 
                open: true, 
                message: `Error al guardar asignaciones: ${err.response?.data?.message || err.message}`, 
                severity: 'error' 
            });
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

    // Obtener buses disponibles para una ruta específica
    // Excluye buses que ya están asignados a otras rutas en el estado actual (no guardado)
    const getAvailableBusesForRoute = (currentRouteNumber) => {
        // Obtener IDs de buses ya asignados a otras rutas en el estado actual
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
            // Excluir buses ya asignados a otras rutas en el estado actual
            if (busesAssignedToOtherRoutes.has(bus.id)) {
                return false;
            }
            // No excluir buses asignados a otros colegios
            // El backend validará y mostrará un error apropiado si el bus ya está asignado
            return true;
        });
    };

    // Obtener pilotos disponibles para un bus específico
    // Excluye pilotos que ya están asignados a otros buses en el estado actual
    const getAvailablePilotsForBus = (currentBusId) => {
        // Obtener IDs de pilotos ya asignados a otros buses
        const pilotsAssignedToOtherBuses = new Set();
        Object.entries(pilotAssignments).forEach(([busId, pilotId]) => {
            if (parseInt(busId) !== currentBusId && pilotId) {
                pilotsAssignedToOtherBuses.add(pilotId);
            }
        });

        return availablePilots
            .filter(pilot => {
                // Si el piloto está asignado al bus actual, siempre mostrarlo
                if (pilotAssignments[currentBusId] === pilot.id) {
                    return true;
                }
                // Excluir pilotos ya asignados a otros buses
                return !pilotsAssignedToOtherBuses.has(pilot.id);
            })
            .sort((a, b) => {
                const an = (a.name || a.email || '').toLowerCase();
                const bn = (b.name || b.email || '').toLowerCase();
                return an < bn ? -1 : an > bn ? 1 : 0;
            });
    };

    // Obtener monitoras disponibles para un bus específico
    // Excluye monitoras que ya están asignadas a otros buses en el estado actual
    const getAvailableMonitorsForBus = (currentBusId) => {
        // Obtener IDs de monitoras ya asignadas a otros buses
        const monitorsAssignedToOtherBuses = new Set();
        Object.entries(monitorAssignments).forEach(([busId, monitorId]) => {
            if (parseInt(busId) !== currentBusId && monitorId) {
                monitorsAssignedToOtherBuses.add(monitorId);
            }
        });

        return availableMonitors
            .filter(monitor => {
                // Si la monitora está asignada al bus actual, siempre mostrarla
                if (monitorAssignments[currentBusId] === monitor.id) {
                    return true;
                }
                // Excluir monitoras ya asignadas a otros buses
                return !monitorsAssignedToOtherBuses.has(monitor.id);
            })
            .sort((a, b) => {
                const an = (a.name || a.email || '').toLowerCase();
                const bn = (b.name || b.email || '').toLowerCase();
                return an < bn ? -1 : an > bn ? 1 : 0;
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
                                        const availableBusesForThisRoute = getAvailableBusesForRoute(routeNumber);
                                        
                                        // Buscar si hay asignaciones huérfanas (piloto/monitora sin bus)
                                        // Esto puede pasar si el usuario quitó el bus pero dejó piloto/monitora
                                        let orphanBusId = null;
                                        if (!assignedBusId) {
                                            // Buscar en pilotAssignments y monitorAssignments
                                            // un busId que ya no esté asignado a ninguna ruta
                                            const allAssignedBusIds = new Set(Object.values(routeBusAssignments).filter(Boolean));
                                            
                                            // Buscar en pilotAssignments
                                            const orphanPilotEntry = Object.entries(pilotAssignments).find(([busId, pilotId]) => {
                                                return pilotId && !allAssignedBusIds.has(parseInt(busId));
                                            });
                                            
                                            // Buscar en monitorAssignments
                                            const orphanMonitorEntry = Object.entries(monitorAssignments).find(([busId, monitorId]) => {
                                                return monitorId && !allAssignedBusIds.has(parseInt(busId));
                                            });
                                            
                                            // Si encontramos asignaciones huérfanas, usar ese busId
                                            if (orphanPilotEntry) {
                                                orphanBusId = parseInt(orphanPilotEntry[0]);
                                            } else if (orphanMonitorEntry) {
                                                orphanBusId = parseInt(orphanMonitorEntry[0]);
                                            }
                                        }
                                        
                                        // Usar el busId asignado o el busId huérfano para mostrar piloto/monitora
                                        const effectiveBusId = assignedBusId || orphanBusId;
                                        const availablePilotsForThisBus = effectiveBusId ? getAvailablePilotsForBus(effectiveBusId) : [];
                                        const availableMonitorsForThisBus = effectiveBusId ? getAvailableMonitorsForBus(effectiveBusId) : [];
                                        
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
                                                        options={availableBusesForThisRoute}
                                                        getOptionLabel={(option) => option ? `${option.plate} (${option.capacity || 'N/A'})` : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={buses.find(b => b.id === assignedBusId) || null}
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
                                                        disabled={!effectiveBusId}
                                                        options={availablePilotsForThisBus}
                                                        getOptionLabel={(option) => option ? (option.name || option.email) : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={effectiveBusId ? availablePilots.find(p => p.id === pilotAssignments[effectiveBusId]) || null : null}
                                                        onChange={(_, newValue) => effectiveBusId && handlePilotAssignmentChange(effectiveBusId, newValue ? newValue.id : null)}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Seleccionar Piloto"
                                                                variant="outlined"
                                                                error={!assignedBusId && effectiveBusId && pilotAssignments[effectiveBusId]}
                                                                helperText={!assignedBusId && effectiveBusId && pilotAssignments[effectiveBusId] ? 'Sin bus asignado' : ''}
                                                            />
                                                        )}
                                                        clearOnEscape
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Autocomplete
                                                        disabled={!effectiveBusId}
                                                        options={availableMonitorsForThisBus}
                                                        getOptionLabel={(option) => option ? (option.name || option.email) : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={effectiveBusId ? availableMonitors.find(m => m.id === monitorAssignments[effectiveBusId]) || null : null}
                                                        onChange={(_, newValue) => effectiveBusId && handleMonitorAssignmentChange(effectiveBusId, newValue ? newValue.id : null)}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Seleccionar Monitora"
                                                                variant="outlined"
                                                                error={!assignedBusId && effectiveBusId && monitorAssignments[effectiveBusId]}
                                                                helperText={!assignedBusId && effectiveBusId && monitorAssignments[effectiveBusId] ? 'Sin bus asignado' : ''}
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
