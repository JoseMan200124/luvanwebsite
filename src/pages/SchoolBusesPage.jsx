// src/pages/SchoolBusesPage.jsx

import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
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
    TextField,
    Autocomplete,
    Chip,
    Tooltip,
    Tabs,
    Tab
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DirectionsBus, Save, Clear, ArrowBack, Refresh, ContentCopy, Schedule } from '@mui/icons-material';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { getCicloEscolarYear } from '../services/cicloEscolarService';
import { getSchoolSchedules } from '../services/scheduleService';
import { DEFAULT_SCHEDULE_CODES, getScheduleCodesFromSchool, getScheduleColor, getScheduleLabel } from '../utils/scheduleConfig';
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

// Formatea "HH:mm" (24h) a "h:mm AM/PM" para mostrar la hora de clase del colegio de forma legible.
function formatTime12h(hhmm) {
    if (!hhmm) return '';
    const [hoursStr, minutesStr] = String(hhmm).split(':');
    const hours = Number.parseInt(hoursStr, 10);
    if (Number.isNaN(hours)) return hhmm;
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hours12}:${minutesStr} ${period}`;
}

// Extraído para que cambiar de pestaña solo re-renderice este diálogo, no la tabla de rutas completa.
function ScheduleThresholdsDialog({
    open,
    routeNumber,
    scheduleCodes,
    scheduleNames,
    scheduleTimes,
    thresholds,
    onThresholdChange,
    onClose,
    onSave,
    saving
}) {
    const [activeTab, setActiveTab] = useState(0);
    const theme = useTheme();

    useEffect(() => {
        if (open) setActiveTab(0);
    }, [open, routeNumber]);

    const sortedCodes = useMemo(() => {
        const timeToMinutes = (hhmm) => {
            if (!hhmm) return Infinity;
            const [h, m] = hhmm.split(':').map(Number);
            return h * 60 + m;
        };
        return [...scheduleCodes].sort((a, b) => timeToMinutes(scheduleTimes[a]) - timeToMinutes(scheduleTimes[b]));
    }, [scheduleCodes, scheduleTimes]);

    const tabColors = useMemo(() => {
        const map = {};
        sortedCodes.forEach((code) => {
            const colorKey = getScheduleColor(code);
            map[code] = theme.palette[colorKey]?.main || theme.palette.text.primary;
        });
        return map;
    }, [sortedCodes, theme]);

    const activeTabColor = tabColors[sortedCodes[activeTab]] || theme.palette.text.primary;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Horarios de la Ruta {routeNumber}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    Configura estas horas para que el sistema avise automáticamente a los Auxiliares cuando la ruta se atrasa. Deja un campo vacío si no aplica.
                </Typography>
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    TabIndicatorProps={{
                        sx: {
                            transition: 'none',
                            backgroundColor: activeTabColor
                        }
                    }}
                    sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                >
                    {sortedCodes.map((code) => (
                        <Tab
                            key={code}
                            label={code}
                            disableRipple
                            sx={{
                                transition: 'none',
                                '&.Mui-selected': {
                                    color: tabColors[code]
                                }
                            }}
                        />
                    ))}
                </Tabs>
                {sortedCodes.map((code, index) => {
                    if (index !== activeTab) return null;
                    const entry = thresholds[code] || {};
                    const isAM = code === 'AM';
                    return (
                        <Box key={code}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                <Typography variant="subtitle1">{scheduleNames[code] || getScheduleLabel(code)}</Typography>
                                {scheduleTimes[code] && (
                                    <Chip
                                        label={`Hora colegio: ${formatTime12h(scheduleTimes[code])}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                )}
                            </Box>
                            {isAM ? (
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                    <TextField
                                        type="time"
                                        size="small"
                                        fullWidth
                                        label="Hora de inicio (primera parada)"
                                        helperText="Avisa si a esta hora aún no marcan la primera parada."
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ step: 300 }}
                                        value={entry.firstStopTime || ''}
                                        onChange={(e) => onThresholdChange(code, 'firstStopTime', e.target.value)}
                                    />
                                    <TextField
                                        type="time"
                                        size="small"
                                        fullWidth
                                        label="Hora de llegada al colegio"
                                        helperText="Avisa si a esta hora aún no marcan la llegada."
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ step: 300 }}
                                        value={entry.schoolArrivalTime || ''}
                                        onChange={(e) => onThresholdChange(code, 'schoolArrivalTime', e.target.value)}
                                    />
                                </Box>
                            ) : (
                                <Box>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                        <TextField
                                            type="time"
                                            size="small"
                                            fullWidth
                                            label="Hora máxima de salida del colegio"
                                            helperText="Avisa si a esta hora aún no marcan la salida."
                                            InputLabelProps={{ shrink: true }}
                                            inputProps={{ step: 300 }}
                                            value={entry.schoolDepartureMaxTime || ''}
                                            onChange={(e) => onThresholdChange(code, 'schoolDepartureMaxTime', e.target.value)}
                                        />
                                        <TextField
                                            type="number"
                                            size="small"
                                            fullWidth
                                            label="Margen primera parada (min)"
                                            helperText="No es hora fija: minutos de espera después de la salida real."
                                            InputLabelProps={{ shrink: true }}
                                            inputProps={{ min: 0 }}
                                            value={entry.firstStopMarginMinutes || ''}
                                            onChange={(e) => onThresholdChange(code, 'firstStopMarginMinutes', e.target.value)}
                                        />
                                    </Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2.5 }}>
                                        Ejemplo: si el margen es 60 min y el bus marca salida a las 12:00pm, la alerta se dispara si no marcan la primera parada del regreso antes de la 1:00pm.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancelar</Button>
                <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    onClick={onSave}
                    disabled={saving}
                >
                    {saving ? 'Guardando...' : 'Guardar Horarios'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

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
    const [schoolScheduleCodes, setSchoolScheduleCodes] = useState(DEFAULT_SCHEDULE_CODES);
    // Hora de clase del colegio por código (AM/MD/PM/EX), solo como referencia visual en el modal de Horarios
    const [schoolScheduleTimes, setSchoolScheduleTimes] = useState({});
    // Nombre que el colegio le dio a cada horario (AM/MD/PM/EX), para mostrar en las pestañas del modal
    const [schoolScheduleNames, setSchoolScheduleNames] = useState({});
    // Umbrales de horario por ruta: { [routeNumber]: { [scheduleCode]: { firstStopTime, schoolArrivalTime, schoolDepartureMaxTime, firstStopMarginMinutes } } }
    const [routeThresholds, setRouteThresholds] = useState({});
    const [scheduleModalRoute, setScheduleModalRoute] = useState(null);
    const [savingSchedule, setSavingSchedule] = useState(false);
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
            setRoutePilotAssignments(prev => ({ ...prev, ...routePilots }));
            setRouteMonitorAssignments(prev => ({ ...prev, ...routeMonitors }));
        } catch (err) {
            console.error('Error fetching buses:', err);
            setSnackbar({ open: true, message: 'Error al obtener buses', severity: 'error' });
            setBuses([]);
        }
    }, [auth.token, schoolId]);

    const fetchSchoolSchedules = useCallback(async () => {
        if (!schoolId) return;
        try {
            const schedules = await getSchoolSchedules(schoolId);
            setSchoolScheduleCodes(getScheduleCodesFromSchool(schedules));

            const timesByCode = {};
            const namesByCode = {};
            (Array.isArray(schedules) ? schedules : []).forEach((s) => {
                const code = s?.code ? String(s.code).toUpperCase() : null;
                const time = Array.isArray(s?.times) ? s.times[0] : null;
                if (code && time && time !== 'N/A') timesByCode[code] = time;
                if (code && s?.name) namesByCode[code] = s.name;
            });
            setSchoolScheduleTimes(timesByCode);
            setSchoolScheduleNames(namesByCode);
        } catch (err) {
            console.error('Error fetching school schedules:', err);
            setSchoolScheduleCodes(DEFAULT_SCHEDULE_CODES);
            setSchoolScheduleTimes({});
            setSchoolScheduleNames({});
        }
    }, [schoolId]);

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
            const routeThresholdsMap = {};
            assignments.forEach(assignment => {
                if (assignment.routeNumber) {
                    routePilots[assignment.routeNumber] = assignment.pilotId || null;
                    routeMonitors[assignment.routeNumber] = assignment.monitoraId || null;

                    const thresholdsForRoute = {};
                    (assignment.scheduleThresholds || []).forEach((threshold) => {
                        thresholdsForRoute[threshold.scheduleCode] = {
                            firstStopTime: threshold.firstStopTime || '',
                            schoolArrivalTime: threshold.schoolArrivalTime || '',
                            schoolDepartureMaxTime: threshold.schoolDepartureMaxTime || '',
                            firstStopMarginMinutes: threshold.firstStopMarginMinutes != null ? String(threshold.firstStopMarginMinutes) : ''
                        };
                    });
                    routeThresholdsMap[assignment.routeNumber] = thresholdsForRoute;
                }
            });
            setRoutePilotAssignments(prev => ({ ...prev, ...routePilots }));
            setRouteMonitorAssignments(prev => ({ ...prev, ...routeMonitors }));
            setRouteThresholds(prev => ({ ...prev, ...routeThresholdsMap }));
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
            Promise.all([fetchSchoolData(), fetchSchoolSchedules(), fetchBuses(), fetchPilots(), fetchMonitors(), fetchRouteAssignments()])
                .finally(() => setLoading(false));
        }
    }, [auth.token, schoolId, fetchSchoolData, fetchSchoolSchedules, fetchBuses, fetchPilots, fetchMonitors, fetchRouteAssignments]);

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

    const handleThresholdChange = (routeNumber, scheduleCode, field, value) => {
        setRouteThresholds(prev => ({
            ...prev,
            [routeNumber]: {
                ...prev[routeNumber],
                [scheduleCode]: {
                    ...((prev[routeNumber] || {})[scheduleCode] || {}),
                    [field]: value
                }
            }
        }));
    };

    const buildScheduleThresholdsPayload = (routeNumber) => {
        const routeSchedules = routeThresholds[routeNumber] || {};
        return schoolScheduleCodes
            .map((code) => {
                const entry = routeSchedules[code] || {};
                const isAM = code === 'AM';
                const hasValue = isAM
                    ? Boolean(entry.firstStopTime || entry.schoolArrivalTime)
                    : Boolean(entry.schoolDepartureMaxTime || entry.firstStopMarginMinutes);
                if (!hasValue) return null;

                return {
                    code,
                    firstStopTime: isAM ? (entry.firstStopTime || null) : null,
                    schoolArrivalTime: isAM ? (entry.schoolArrivalTime || null) : null,
                    schoolDepartureMaxTime: isAM ? null : (entry.schoolDepartureMaxTime || null),
                    firstStopMarginMinutes: isAM ? null : (entry.firstStopMarginMinutes !== '' ? Number(entry.firstStopMarginMinutes) : null)
                };
            })
            .filter(Boolean);
    };

    // Guarda los horarios de UNA ruta de inmediato, sin tocar placa/piloto/monitora ni depender
    // del botón "Guardar Asignaciones" general.
    const handleSaveScheduleModal = async () => {
        if (!scheduleModalRoute) return;
        setSavingSchedule(true);
        try {
            await api.post('/route-assignments/schedules', {
                schoolId: Number.parseInt(schoolId, 10),
                cicloEscolarId: currentSchoolCycleId || null,
                routeNumber: scheduleModalRoute,
                schedules: buildScheduleThresholdsPayload(scheduleModalRoute)
            }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });

            setSnackbar({ open: true, message: `Horarios de la Ruta ${scheduleModalRoute} guardados`, severity: 'success' });
            setScheduleModalRoute(null);
            await fetchRouteAssignments();
        } catch (err) {
            console.error('Error saving route schedules:', err);
            setSnackbar({
                open: true,
                message: `Error al guardar horarios: ${err.response?.data?.message || err.message}`,
                severity: 'error'
            });
        } finally {
            setSavingSchedule(false);
        }
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
                    },
                    schedules: buildScheduleThresholdsPayload(routeNumber)
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
        setRouteThresholds({});
        setCrewChangeIntent({});
    };

    const handleRefresh = async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            await Promise.all([fetchSchoolData(), fetchSchoolSchedules(), fetchBuses(), fetchPilots(), fetchMonitors(), fetchRouteAssignments()]);
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

    const getBusOccupiedByLabel = (bus) => {
        if (!bus) return null;
        const currentSchoolIdNum = Number.parseInt(schoolId, 10);
        if (bus.schoolId && bus.schoolId !== currentSchoolIdNum) {
            return `Asignado a: ${bus.school?.name || `colegio ID ${bus.schoolId}`}`;
        }
        if (bus.corporationId) {
            return `Asignado a: ${bus.corporation?.name || `corporación ID ${bus.corporationId}`}`;
        }
        return null;
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
                            <Table sx={{ minWidth: 1320 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>Número de Ruta</strong></TableCell>
                                        <TableCell><strong>Bus Asignado</strong></TableCell>
                                        <TableCell><strong>Piloto</strong></TableCell>
                                        <TableCell><strong>Monitora</strong></TableCell>
                                        <TableCell><strong>Horarios</strong></TableCell>
                                        <TableCell><strong>Estado</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {schoolRouteNumbers.map((routeNumber) => {
                                        const assignedBusId = routeBusAssignments[routeNumber];
                                        const availableBusesForThisRoute = getAvailableBusesForRoute(routeNumber);
                                        const availablePilotsForThisRoute = getAvailablePilotsForRoute(routeNumber);
                                        const availableMonitorsForThisRoute = getAvailableMonitorsForRoute(routeNumber);
                                        const configuredScheduleCount = buildScheduleThresholdsPayload(routeNumber).length;

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
                                                        renderOption={(props, option) => {
                                                            const occupiedLabel = getBusOccupiedByLabel(option);
                                                            const optionItem = (
                                                                <li {...props} key={option.id} style={occupiedLabel ? { color: '#d32f2f' } : undefined}>
                                                                    {getBusInfo(option.id)}
                                                                </li>
                                                            );
                                                            return occupiedLabel ? (
                                                                <Tooltip key={option.id} title={occupiedLabel} placement="right">
                                                                    {optionItem}
                                                                </Tooltip>
                                                            ) : optionItem;
                                                        }}
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
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<Schedule />}
                                                        onClick={() => setScheduleModalRoute(routeNumber)}
                                                    >
                                                        Horarios
                                                    </Button>
                                                    {configuredScheduleCount > 0 && (
                                                        <Chip
                                                            label={`${configuredScheduleCount} configurado${configuredScheduleCount > 1 ? 's' : ''}`}
                                                            size="small"
                                                            color="info"
                                                            sx={{ ml: 1 }}
                                                        />
                                                    )}
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
                            <Typography variant="body2" color="textSecondary">
                                • Los horarios definen cuándo se envía una alerta a Auxiliares si la ruta no cumple: en la mañana (AM), hora de inicio de primera parada y hora de llegada al colegio; en los horarios de regreso, hora máxima de salida del colegio y minutos de margen para la primera parada de regreso
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            <ScheduleThresholdsDialog
                open={Boolean(scheduleModalRoute)}
                routeNumber={scheduleModalRoute}
                scheduleCodes={schoolScheduleCodes}
                scheduleNames={schoolScheduleNames}
                scheduleTimes={schoolScheduleTimes}
                thresholds={routeThresholds[scheduleModalRoute] || {}}
                onThresholdChange={(code, field, value) => handleThresholdChange(scheduleModalRoute, code, field, value)}
                onClose={() => setScheduleModalRoute(null)}
                onSave={handleSaveScheduleModal}
                saving={savingSchedule}
            />

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
