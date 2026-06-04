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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    // FormControl, InputLabel, Select, MenuItem removed - replaced by Autocomplete
    TextField,
    Autocomplete,
    Chip
} from '@mui/material';
import { DirectionsBus, Save, Clear, ArrowBack, Refresh, ContentCopy } from '@mui/icons-material';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { getCicloEscolarYear } from '../services/cicloEscolarService';
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
    const { cicloEscolarId: routeCicloEscolarId, schoolId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const stateSchool = location.state?.school;
    const stateCicloEscolarId = routeCicloEscolarId || location.state?.cicloEscolarId || stateSchool?.cicloEscolarId || '';

    const [buses, setBuses] = useState([]);
    const [schoolRouteNumbers, setSchoolRouteNumbers] = useState([]);
    const [routeBusAssignments, setRouteBusAssignments] = useState({});
    // Per-route assignments when no bus is selected (routeNumber -> userId)
    const [routePilotAssignments, setRoutePilotAssignments] = useState({});
    const [routeMonitorAssignments, setRouteMonitorAssignments] = useState({});
    const [availablePilots, setAvailablePilots] = useState([]);
    const [availableMonitors, setAvailableMonitors] = useState([]);
    const [schoolData, setSchoolData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [transferPreviewOpen, setTransferPreviewOpen] = useState(false);
    const [previousCycleTransfer, setPreviousCycleTransfer] = useState({
        loading: false,
        transferring: false,
        available: false,
        assignments: [],
        sourceSchool: null,
        transferableCount: 0
    });
    const [crewChangeIntent, setCrewChangeIntent] = useState({});
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const stateCicloEscolar = location.state?.cicloEscolar || stateSchool?.cicloEscolar || stateSchool?.CicloEscolar || null;
    const currentCicloEscolar = schoolData?.cicloEscolar || schoolData?.CicloEscolar || stateCicloEscolar;
    const currentSchool = schoolData || stateSchool;
    const currentCycleLabel = getCicloEscolarYear(currentCicloEscolar);
    const currentSchoolCycleId = String(stateCicloEscolarId || currentSchool?.cicloEscolarId || '').trim();
    const currentOperationStatus = String(currentSchool?.operationStatus || 'ACTIVE').trim().toUpperCase();
    const isPreparationMode = currentOperationStatus !== 'ACTIVE';
    const assignmentModeLabel = isPreparationMode ? 'Preparación sin operación' : 'Operación activa';
    const previousCycleTransferCount = previousCycleTransfer.transferableCount ?? previousCycleTransfer.assignments.length;
    const previousCycleSkippedCount = Math.max(previousCycleTransfer.assignments.length - previousCycleTransferCount, 0);
    const previousCycleLabel = previousCycleTransfer.sourceSchool?.cicloEscolar?.anio
        || previousCycleTransfer.sourceSchool?.cicloEscolar?.label
        || previousCycleTransfer.sourceSchool?.cicloEscolar?.nombre
        || 'anterior';

    const formatTransferUserOutcome = (assignment, userKey) => {
        if (assignment.currentAssignment) return 'Sin cambios';

        const user = assignment[userKey];
        if (!user?.id) return 'Sin asignar';

        const userName = user.name || user.email || `ID:${user.id}`;
        if (user.willBeAssigned) return userName;

        return `${userName} -> Sin asignar`;
    };

    const getTransferStatusLabel = (assignment) => {
        if (assignment.currentAssignment) {
            return `Omitida: ruta ocupada por ${assignment.currentAssignment.plate}`;
        }
        return 'Se transferirá';
    };

    const fetchSchoolData = useCallback(async () => {
        if (!schoolId) return;
        try {
            const resp = await api.get(`/schools/${schoolId}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const school = resp.data.school;
            setSchoolData(school || null);
            if (school?.routeNumbers) {
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
            const respData = resp.data;
            const allBuses = Array.isArray(respData) ? respData : (Array.isArray(respData?.buses) ? respData.buses : []);
            setBuses(allBuses);

            // Construir mapa de asignaciones actuales (routeNumber -> busId)
            const assignments = {};
            const routePilots = {};
            const routeMonitors = {};
            
            allBuses.forEach(bus => {
                if (bus.routeNumber && bus.schoolId === Number.parseInt(schoolId, 10)) {
                    assignments[bus.routeNumber] = bus.id;
                    if (bus.pilotId) {
                        routePilots[bus.routeNumber] = bus.pilotId;
                    }
                    if (bus.monitoraId) {
                        routeMonitors[bus.routeNumber] = bus.monitoraId;
                    }
                }
            });
            setRouteBusAssignments(assignments);
            setRoutePilotAssignments(routePilots);
            setRouteMonitorAssignments(routeMonitors);
        } catch (err) {
            console.error('Error fetching buses:', err);
            setSnackbar({ open: true, message: 'Error al obtener buses', severity: 'error' });
            setBuses([]);
        }
    }, [auth.token, schoolId]);

    const fetchPilots = useCallback(async () => {
        if (!schoolId) return;
        try {
            const cycleParam = currentSchoolCycleId ? `&cicloEscolarId=${encodeURIComponent(currentSchoolCycleId)}` : '';
            const url = `/users/pilots?schoolId=${schoolId}${cycleParam}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const pilots = Array.isArray(response.data.users) ? response.data.users : [];
            setAvailablePilots(pilots);
        } catch (err) {
            console.error('Error fetching pilots:', err);
            setAvailablePilots([]);
        }
    }, [auth.token, schoolId, currentSchoolCycleId]);

    const fetchMonitors = useCallback(async () => {
        if (!schoolId) return;
        try {
            const cycleParam = currentSchoolCycleId ? `&cicloEscolarId=${encodeURIComponent(currentSchoolCycleId)}` : '';
            const url = `/users/monitors?schoolId=${schoolId}${cycleParam}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const monitors = Array.isArray(response.data.users) ? response.data.users : [];
            setAvailableMonitors(monitors);
        } catch (err) {
            console.error('Error fetching monitors:', err);
            setAvailableMonitors([]);
        }
    }, [auth.token, schoolId, currentSchoolCycleId]);

    const fetchRouteAssignments = useCallback(async () => {
        if (!schoolId) return;
        try {
            const cycleParam = currentSchoolCycleId ? `&cicloEscolarId=${encodeURIComponent(currentSchoolCycleId)}` : '';
            const response = await api.get(`/route-assignments?schoolId=${schoolId}${cycleParam}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const assignments = response.data.assignments || response.data || [];
            const routePilots = {};
            const routeMonitors = {};
            assignments.forEach(assignment => {
                if (assignment.routeNumber) {
                    routePilots[assignment.routeNumber] = assignment.pilotId || null;
                    routeMonitors[assignment.routeNumber] = assignment.monitoraId || null;
                }
            });
            setRoutePilotAssignments(prev => ({ ...prev, ...routePilots }));
            setRouteMonitorAssignments(prev => ({ ...prev, ...routeMonitors }));
        } catch (err) {
            console.error('Error fetching route assignments:', err);
        }
    }, [auth.token, schoolId, currentSchoolCycleId]);

    const fetchPreviousCycleAssignments = useCallback(async () => {
        if (!auth.token || !schoolId || !currentSchool || currentOperationStatus !== 'ACTIVE') {
            setPreviousCycleTransfer(prev => ({
                ...prev,
                loading: false,
                available: false,
                assignments: [],
                sourceSchool: null,
                transferableCount: 0
            }));
            return;
        }

        setPreviousCycleTransfer(prev => ({ ...prev, loading: true }));
        try {
            const params = new URLSearchParams();
            if (currentSchoolCycleId) params.set('cicloEscolarId', currentSchoolCycleId);
            if (schoolRouteNumbers.length > 0) params.set('routeNumbers', schoolRouteNumbers.join(','));
            const query = params.toString() ? `?${params.toString()}` : '';
            const response = await api.get(`/buses/school/${schoolId}/previous-cycle-assignments${query}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const data = response.data || {};
            setPreviousCycleTransfer(prev => ({
                ...prev,
                loading: false,
                available: Boolean(data.available),
                assignments: Array.isArray(data.assignments) ? data.assignments : [],
                sourceSchool: data.sourceSchool || null,
                transferableCount: Number(data.transferableCount || 0)
            }));
        } catch (err) {
            console.error('Error fetching previous cycle bus assignments:', err);
            setPreviousCycleTransfer(prev => ({
                ...prev,
                loading: false,
                available: false,
                assignments: [],
                sourceSchool: null,
                transferableCount: 0
            }));
        }
    }, [auth.token, schoolId, currentSchool, currentOperationStatus, currentSchoolCycleId, schoolRouteNumbers]);

    useEffect(() => {
        if (auth.token && schoolId) {
            setLoading(true);
            Promise.all([fetchSchoolData(), fetchBuses(), fetchPilots(), fetchMonitors(), fetchRouteAssignments()])
                .finally(() => setLoading(false));
        }
    }, [auth.token, schoolId, fetchSchoolData, fetchBuses, fetchPilots, fetchMonitors, fetchRouteAssignments]);

    useEffect(() => {
        fetchPreviousCycleAssignments();
    }, [fetchPreviousCycleAssignments]);

    const handleAssignmentChange = (routeNumber, newBusId) => {
        setRouteBusAssignments(prev => ({
            ...prev,
            [routeNumber]: newBusId || null
        }));
    };

    const updateCrewIntent = (routeNumber, updater) => {
        setCrewChangeIntent(prev => ({
            ...prev,
            [routeNumber]: {
                ...(prev[routeNumber]),
                ...updater
            }
        }));
    };

    const handleRoutePilotChange = (routeNumber, pilotId) => {
        if (!pilotId) {
            const confirmed = window.confirm(`Confirma desasignar piloto de la Ruta ${routeNumber}.`);
            if (!confirmed) return;
        }

        setRoutePilotAssignments(prev => ({
            ...prev,
            [routeNumber]: pilotId || null
        }));

        updateCrewIntent(routeNumber, {
            pilotTouched: true,
            unassignPilot: !pilotId
        });
    };

    const handleRouteMonitorChange = (routeNumber, monitorId) => {
        if (!monitorId) {
            const confirmed = window.confirm(`Confirma desasignar monitora de la Ruta ${routeNumber}.`);
            if (!confirmed) return;
        }

        setRouteMonitorAssignments(prev => ({
            ...prev,
            [routeNumber]: monitorId || null
        }));

        updateCrewIntent(routeNumber, {
            monitoraTouched: true,
            unassignMonitora: !monitorId
        });
    };

    const handleSaveAssignments = async () => {
        setSaving(true);
        try {
            const payloadAssignments = schoolRouteNumbers.map((routeNumber) => {
                const intent = crewChangeIntent[routeNumber] || {};
                return {
                    routeNumber,
                    busId: routeBusAssignments[routeNumber] || null,
                    pilotId: routePilotAssignments[routeNumber] || null,
                    monitoraId: routeMonitorAssignments[routeNumber] || null,
                    explicit: {
                        pilotTouched: Boolean(intent.pilotTouched),
                        monitoraTouched: Boolean(intent.monitoraTouched),
                        unassignPilot: Boolean(intent.unassignPilot),
                        unassignMonitora: Boolean(intent.unassignMonitora)
                    }
                };
            });

            const response = await api.post('/route-assignments/commit-batch', {
                schoolId: Number.parseInt(schoolId, 10),
                cicloEscolarId: currentSchoolCycleId || null,
                assignments: payloadAssignments
            }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });

            setSnackbar({
                open: true,
                message: response?.data?.message || (isPreparationMode ? 'Asignaciones de preparación guardadas' : 'Asignaciones guardadas exitosamente'),
                severity: 'success'
            });

            setCrewChangeIntent({});
            await Promise.all([fetchBuses(), fetchRouteAssignments()]);

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

    const handleTransferPreviousCycleAssignments = async () => {
        if (!schoolId || previousCycleTransfer.transferring) return;

        setTransferPreviewOpen(false);
        setPreviousCycleTransfer(prev => ({ ...prev, transferring: true }));
        try {
            const response = await api.post(`/buses/school/${schoolId}/transfer-previous-cycle-assignments`, {
                cicloEscolarId: currentSchoolCycleId || null,
                routeNumbers: schoolRouteNumbers
            }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const transferredCount = Array.isArray(response.data?.transferred) ? response.data.transferred.length : 0;
            const skippedCount = Array.isArray(response.data?.skipped) ? response.data.skipped.length : 0;
            const skippedText = skippedCount > 0 ? ` (${skippedCount} rutas ya tenían asignación y se omitieron)` : '';

            setSnackbar({
                open: true,
                message: transferredCount > 0
                    ? `Se transfirieron ${transferredCount} asignaciones del ciclo anterior${skippedText}.`
                    : (response.data?.message || 'No se transfirieron asignaciones.'),
                severity: transferredCount > 0 ? 'success' : 'info'
            });

            await Promise.all([fetchBuses(), fetchRouteAssignments()]);
            await fetchPreviousCycleAssignments();
        } catch (err) {
            console.error('Error transferring previous cycle bus assignments:', err);
            setSnackbar({
                open: true,
                message: `Error al transferir asignaciones: ${err.response?.data?.message || err.message}`,
                severity: 'error'
            });
        } finally {
            setPreviousCycleTransfer(prev => ({ ...prev, transferring: false }));
        }
    };

    const handleClearAssignments = () => {
        setRouteBusAssignments({});
        setRoutePilotAssignments({});
        setRouteMonitorAssignments({});
        setCrewChangeIntent({});
    };

    const handleRefresh = async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            await Promise.all([fetchSchoolData(), fetchBuses(), fetchPilots(), fetchMonitors(), fetchRouteAssignments()]);
            await fetchPreviousCycleAssignments();
            setCrewChangeIntent({});
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

    // Obtener pilotos disponibles por ruta (tripulación pertenece a la ruta)
    const getAvailablePilotsForRoute = (currentRouteNumber) => {
        const pilotsAssignedToOtherRoutes = new Set();
        Object.entries(routePilotAssignments).forEach(([routeNumber, pilotId]) => {
            if (routeNumber !== String(currentRouteNumber) && pilotId) {
                pilotsAssignedToOtherRoutes.add(Number(pilotId));
            }
        });

        return availablePilots
            .filter((pilot) => {
                if (Number(routePilotAssignments[currentRouteNumber]) === pilot.id) {
                    return true;
                }
                return !pilotsAssignedToOtherRoutes.has(pilot.id);
            })
            .sort((a, b) => {
                const an = (a.name || a.email || '').toLowerCase();
                const bn = (b.name || b.email || '').toLowerCase();
                return an < bn ? -1 : an > bn ? 1 : 0;
            });
    };

    // Obtener monitoras disponibles por ruta (tripulación pertenece a la ruta)
    const getAvailableMonitorsForRoute = (currentRouteNumber) => {
        const monitorsAssignedToOtherRoutes = new Set();
        Object.entries(routeMonitorAssignments).forEach(([routeNumber, monitorId]) => {
            if (routeNumber !== String(currentRouteNumber) && monitorId) {
                monitorsAssignedToOtherRoutes.add(Number(monitorId));
            }
        });

        return availableMonitors
            .filter((monitor) => {
                if (Number(routeMonitorAssignments[currentRouteNumber]) === monitor.id) {
                    return true;
                }
                return !monitorsAssignedToOtherRoutes.has(monitor.id);
            })
            .sort((a, b) => {
                const an = (a.name || a.email || '').toLowerCase();
                const bn = (b.name || b.email || '').toLowerCase();
                return an < bn ? -1 : an > bn ? 1 : 0;
            });
    };

    const getBusInfo = (busId) => {
        const bus = buses.find(b => b.id === Number.parseInt(busId, 10));
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
                            <Typography variant="h4">Asignación de Buses - {currentSchool?.name || 'Cargando...'}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="body2">Ciclo Escolar {currentCycleLabel}</Typography>
                                <Chip
                                    label={assignmentModeLabel}
                                    size="small"
                                    color={isPreparationMode ? 'warning' : 'success'}
                                    variant="filled"
                                    sx={{ bgcolor: isPreparationMode ? 'warning.main' : 'success.main', color: 'white' }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            {isPreparationMode && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Este colegio no está operando. Las asignaciones se guardarán para preparación del ciclo y no deberían usarse como operación vigente.
                </Alert>
            )}

            {!isPreparationMode && previousCycleTransfer.available && previousCycleTransferCount > 0 && (
                <Alert
                    severity="info"
                    sx={{ mb: 2 }}
                    action={(
                        <Button
                            color="inherit"
                            size="small"
                            startIcon={previousCycleTransfer.transferring ? <CircularProgress size={16} color="inherit" /> : <ContentCopy />}
                            onClick={() => setTransferPreviewOpen(true)}
                            disabled={previousCycleTransfer.transferring || saving}
                        >
                            {previousCycleTransfer.transferring ? 'Transfiriendo...' : 'Revisar'}
                        </Button>
                    )}
                >
                    El ciclo {previousCycleLabel} tiene {previousCycleTransferCount} placas asignadas a rutas que pueden transferirse a este ciclo.
                </Alert>
            )}

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
                        <TableContainer component={Paper} sx={{ mt: 2, overflowX: 'auto' }}>
                            <Table sx={{ minWidth: 980 }}>
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
                                        const availablePilotsForThisRoute = getAvailablePilotsForRoute(routeNumber);
                                        const availableMonitorsForThisRoute = getAvailableMonitorsForRoute(routeNumber);
                                        
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
                                                        disabled={false}
                                                        options={availablePilotsForThisRoute}
                                                        getOptionLabel={(option) => option ? (option.name || option.email) : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={routePilotAssignments[routeNumber] ? availablePilots.find(p => p.id === routePilotAssignments[routeNumber]) || null : null}
                                                        onChange={(_, newValue) => handleRoutePilotChange(routeNumber, newValue ? newValue.id : null)}
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
                                                        disabled={false}
                                                        options={availableMonitorsForThisRoute}
                                                        getOptionLabel={(option) => option ? (option.name || option.email) : ''}
                                                        isOptionEqualToValue={(option, value) => option && value && option.id === value.id}
                                                        value={routeMonitorAssignments[routeNumber] ? availableMonitors.find(m => m.id === routeMonitorAssignments[routeNumber]) || null : null}
                                                        onChange={(_, newValue) => handleRouteMonitorChange(routeNumber, newValue ? newValue.id : null)}
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
                                                    {(assignedBusId || routePilotAssignments[routeNumber] || routeMonitorAssignments[routeNumber]) ? (
                                                        <Chip 
                                                            label={isPreparationMode ? 'Preparado' : 'Asignado'}
                                                            color={isPreparationMode ? 'warning' : 'success'}
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
                                • Los pilotos y monitoras se pueden asignar también sin un bus; se guardarán como asignaciones de ruta
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                • Los pilotos y monitoras deben pertenecer al mismo colegio y ciclo escolar
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={transferPreviewOpen}
                onClose={() => setTransferPreviewOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>Confirmar transferencia del ciclo anterior</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Se aplicarán {previousCycleTransferCount} cambios desde el ciclo {previousCycleLabel}. {previousCycleSkippedCount > 0 ? `${previousCycleSkippedCount} rutas se omitirán porque ya tienen una placa asignada.` : ''}
                    </Alert>

                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell><strong>Ruta</strong></TableCell>
                                    <TableCell><strong>Placa que quedará</strong></TableCell>
                                    <TableCell><strong>Piloto que quedará</strong></TableCell>
                                    <TableCell><strong>Monitora que quedará</strong></TableCell>
                                    <TableCell><strong>Resultado</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {previousCycleTransfer.assignments.map((assignment) => (
                                    <TableRow key={`${assignment.routeNumber}-${assignment.busId}`}>
                                        <TableCell>Ruta {assignment.routeNumber}</TableCell>
                                        <TableCell>{assignment.currentAssignment ? assignment.currentAssignment.plate : assignment.plate}</TableCell>
                                        <TableCell>{formatTransferUserOutcome(assignment, 'pilot')}</TableCell>
                                        <TableCell>{formatTransferUserOutcome(assignment, 'monitora')}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={getTransferStatusLabel(assignment)}
                                                color={assignment.currentAssignment ? 'warning' : 'success'}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTransferPreviewOpen(false)} disabled={previousCycleTransfer.transferring}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={previousCycleTransfer.transferring ? <CircularProgress size={16} color="inherit" /> : <ContentCopy />}
                        onClick={handleTransferPreviousCycleAssignments}
                        disabled={previousCycleTransfer.transferring || previousCycleTransferCount === 0}
                    >
                        {previousCycleTransfer.transferring ? 'Transfiriendo...' : 'Aceptar y transferir'}
                    </Button>
                </DialogActions>
            </Dialog>

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
