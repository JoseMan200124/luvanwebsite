// src/pages/RouteHistoryPage.jsx

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    Tooltip,
    Paper,
    Grid,
    TextField,
    Autocomplete,
    InputAdornment,
    Button,
    FormControlLabel,
    Checkbox,
    Collapse,
    Chip,
    Card,
    CardContent,
    Divider,
    CircularProgress,
    IconButton,
    Pagination,
    Alert,
    Popover,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    useTheme,
    useMediaQuery,
    MobileStepper,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    DirectionsBus,
    Person,
    AccessTime,
    Speed,
    Warning,
    CheckCircle,
    CalendarToday,
    InfoOutlined,
    PictureAsPdf,
    School as SchoolIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    KeyboardArrowLeft,
    KeyboardArrowRight
} from '@mui/icons-material';
// RouteIcon removed; using a simple numeral adornment for route number filter
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, LabelList, CartesianGrid } from 'recharts';

const RouteHistoryPage = () => {
    const { auth } = useContext(AuthContext);
    const [searchParams] = useSearchParams();

    const statsMonthsShortEs = useMemo(
        () => ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'],
        []
    );

    const initialRouteNumber = searchParams.get('routeNumber') || '';
    const initialClientId = searchParams.get('clientId') || null;

    const [loading, setLoading] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [total, setTotal] = useState(0);

    // filtros
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pilotoFilter, setPilotoFilter] = useState('');
    const [busFilter, setBusFilter] = useState('');
    const [onlyFailures, setOnlyFailures] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [startHour, setStartHour] = useState('');
    const [endHour, setEndHour] = useState('');
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientTouched, setClientTouched] = useState(false);
    const [availablePilots, setAvailablePilots] = useState([]);
    const [pilotSelected, setPilotSelected] = useState(null);
    const [availableBuses, setAvailableBuses] = useState([]);
    const [busSelected, setBusSelected] = useState(null);
    const [availableRoutesList, setAvailableRoutesList] = useState([]);
    const [routeSelected, setRouteSelected] = useState(null);
    const [loadingRoutes, setLoadingRoutes] = useState(false);
    const routesCacheRef = React.useRef(new Map());
    const [pilotInput, setPilotInput] = useState('');
    const [busInput, setBusInput] = useState('');
    const [loadingPilots, setLoadingPilots] = useState(false);
    const [loadingBuses, setLoadingBuses] = useState(false);
    const pilotsCacheRef = React.useRef(new Map());
    const busesCacheRef = React.useRef(new Map());
    const pilotTimerRef = React.useRef(null);
    const busTimerRef = React.useRef(null);
    const [initialFetchDone, setInitialFetchDone] = useState(false);
    const [dateAnchorEl, setDateAnchorEl] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [routeNumber, setRouteNumber] = useState(initialRouteNumber);
    const [clientId, ] = useState(initialClientId);
    // Estadísticas
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(null);
    const [statsGroupBy, setStatsGroupBy] = useState('route'); // 'route' | 'plate'
    const [statsData, setStatsData] = useState(null);
    const [statsSelectedClient, setStatsSelectedClient] = useState(null);
    const [statsClientTouched, setStatsClientTouched] = useState(false);
    const [statsStartDate, setStatsStartDate] = useState('');
    const [statsEndDate, setStatsEndDate] = useState('');
    const [statsMonth, setStatsMonth] = useState('');
    const [statsRouteNumber, setStatsRouteNumber] = useState('');
    const [statsRouteSelected, setStatsRouteSelected] = useState(null);
    const [statsAvailableRoutesList, setStatsAvailableRoutesList] = useState([]);
    const [statsLoadingRoutes, setStatsLoadingRoutes] = useState(false);
    const [statsPlate, setStatsPlate] = useState('');
    const [statsBusSelected, setStatsBusSelected] = useState(null);
    const [statsBusInput, setStatsBusInput] = useState('');
    const [statsAvailableBuses, setStatsAvailableBuses] = useState([]);
    const [statsLoadingBuses, setStatsLoadingBuses] = useState(false);
    const statsBusTimerRef = React.useRef(null);
    const [statsShowEmptyDays, setStatsShowEmptyDays] = useState(false);
    const [statsExpanded, setStatsExpanded] = useState(false);
    const [statsDateAnchorEl, setStatsDateAnchorEl] = useState(null);
    const [statsMonthAnchorEl, setStatsMonthAnchorEl] = useState(null);
    const [statsMonthViewYear, setStatsMonthViewYear] = useState(new Date().getFullYear());
    const [statsSelectedKey, setStatsSelectedKey] = useState('');
    const [statsChartStep, setStatsChartStep] = useState(0);
    const [statsHasLoadedOnce, setStatsHasLoadedOnce] = useState(false);
    const [statsLastLoadedGroupBy, setStatsLastLoadedGroupBy] = useState('');
    const [statsFiltersDirty, setStatsFiltersDirty] = useState(false);
    const [statsTopSortByKm, setStatsTopSortByKm] = useState(false);
    const [statsReportLoading, setStatsReportLoading] = useState(false);
    const [statsLastLoadedParams, setStatsLastLoadedParams] = useState(null);

    const getMonthRange = (monthStr) => {
        // monthStr: 'YYYY-MM'
        if (!monthStr) return { start: undefined, end: undefined };
        const [yyStr, mmStr] = monthStr.split('-');
        const yy = parseInt(yyStr, 10);
        const mm = parseInt(mmStr, 10);
        if (Number.isNaN(yy) || Number.isNaN(mm)) return { start: undefined, end: undefined };

        const start = `${monthStr}-01`;

        const now = new Date();
        const isCurrentMonth = (now.getFullYear() === yy) && ((now.getMonth() + 1) === mm);
        if (isCurrentMonth) {
            const yyyy = now.getFullYear();
            const m2 = String(now.getMonth() + 1).padStart(2, '0');
            const d2 = String(now.getDate()).padStart(2, '0');
            return { start, end: `${yyyy}-${m2}-${d2}` };
        }

        const lastDay = new Date(yy, mm, 0).getDate();
        return { start, end: `${monthStr}-${String(lastDay).padStart(2, '0')}` };
    };

    const fetchRouteHistory = async (opts = {}) => {
        setLoading(true);
        setError(null);
        try {
            const selectedClientId = (selectedClient && (selectedClient.id || selectedClient.value || selectedClient._id)) || clientId || null;
            const selectedClientType = selectedClient?.type || null;

            // Require a selected client (or clientId param) before fetching
            if (!selectedClientId) {
                setLoading(false);
                setError('Seleccione un cliente antes de aplicar los filtros.');
                return;
            }

            const clientParam = {};
            if (selectedClientType === 'school') {
                clientParam.schoolId = selectedClientId;
            } else if (selectedClientType === 'corporation') {
                clientParam.corporationId = selectedClientId;
            } else {
                clientParam.schoolId = selectedClientId;
            }

            const params = {
                ...clientParam,
                routeNumber: routeNumber,
                page,
                pageSize,
                ...opts
            };

            const response = await api.get('/transportistas/historial-rutas', { params });

            setRoutes(response.data.routes || []);
            setTotal(response.data.total || 0);
            setInitialFetchDone(true);
        } catch (err) {
            console.error('Error fetching route history (page):', err);
            const serverMessage = err?.response?.data?.message || err?.response?.data || err?.response?.statusText;
            const status = err?.response?.status;
            if (status || serverMessage) {
                setError(`Error ${status || ''}${serverMessage ? ` - ${serverMessage}` : ''}`);
            } else {
                setError(err.message || 'No se pudo cargar el historial de rutas');
            }
        } finally {
            setLoading(false);
        }
    };
    // Register page-level refresh handler for global refresh control
    // Ensure we pass the current filters so the global refresh respects them
    useRegisterPageRefresh(async () => {
        setPage(1);
        await fetchRouteHistory({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            pilotoName: pilotoFilter || undefined,
            busPlaca: busFilter || undefined,
            onlyFailures: onlyFailures ? '1' : undefined,
            status: statusFilter || undefined,
            startHour: startHour || undefined,
            endHour: endHour || undefined,
            routeNumber: routeNumber || undefined,
            page: 1
        });
    }, [fetchRouteHistory, startDate, endDate, pilotoFilter, busFilter, onlyFailures, statusFilter, startHour, endHour, routeNumber]);

    useEffect(() => {
        if (!initialFetchDone && (selectedClient || clientId)) {
            setPage(1);
            fetchRouteHistory({ page: 1 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClient, clientId]);

    useEffect(() => {
        // load clients when mounted
                const loadClients = async () => {
                    try {
                        const [schoolsResp, corpsResp] = await Promise.all([
                            api.get('/schools'),
                            api.get('/corporations')
                        ]);

                        const schoolsList = schoolsResp.data?.schools || schoolsResp.data || [];
                        const corpsList = corpsResp.data?.corporations || corpsResp.data || [];

                        // Build grouped options: Colegios, Corporaciones (no 'Todos' ni 'Sin afiliación')
                        const combined = [];
                        const pushIfValid = (item, type) => {
                            if (!item) return;
                            if (item.deleted) return;
                            const id = item.id || item._id || item.value || item.uuid || item.name;
                            const name = item.name || item.nombre || item.label || String(id);
                            const group = type === 'school' ? 'Colegios' : 'Corporaciones';
                            combined.push({ id, name, _raw: item, type, group });
                        };

                        (Array.isArray(schoolsList) ? schoolsList : []).forEach((s) => pushIfValid(s, 'school'));
                        (Array.isArray(corpsList) ? corpsList : []).forEach((c) => pushIfValid(c, 'corporation'));

                        setClients(combined);

                        // select default: if clientId provided try to find it, otherwise default to first client
                        const found = clientId ? combined.find(s => String(s.id) === String(clientId)) : null;
                        setSelectedClient(found || (combined.length > 0 ? combined[0] : null));

                        // Estadísticas: cliente independiente (sin selección por defecto)
                        setStatsSelectedClient(null);
                        setStatsClientTouched(false);
                    } catch (err) {
                        console.error('No se pudieron cargar los clientes (page):', err);
                    }
                };
        loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced server-side search for pilots
    useEffect(() => {
        if (!selectedClient) {
            setAvailablePilots([]);
            return;
        }

        // clear previous timer
        if (pilotTimerRef.current) clearTimeout(pilotTimerRef.current);

        // require at least 2 chars to search
        if (!pilotInput || pilotInput.length < 2) {
            setAvailablePilots([]);
            return;
        }

        const cacheKey = `${selectedClient.type}:${selectedClient.id}:` + pilotInput;
        if (pilotsCacheRef.current.has(cacheKey)) {
            setAvailablePilots(pilotsCacheRef.current.get(cacheKey));
            return;
        }

        pilotTimerRef.current = setTimeout(async () => {
            setLoadingPilots(true);
            try {
                let url = `/users/pilots?query=${encodeURIComponent(pilotInput)}`;
                if (selectedClient.type === 'school') url += `&schoolId=${selectedClient.id}`;
                if (selectedClient.type === 'corporation') url += `&corporationId=${selectedClient.id}`;
                const resp = await api.get(url);
                const pilots = Array.isArray(resp.data?.users) ? resp.data.users : (resp.data || []);
                const pilotsOpts = pilots.map(p => ({ id: p.id || p._id, name: p.name || p.fullName || p.nombre }));
                pilotsCacheRef.current.set(cacheKey, pilotsOpts);
                setAvailablePilots(pilotsOpts);
            } catch (err) {
                console.error('Error searching pilots:', err);
                setAvailablePilots([]);
            } finally {
                setLoadingPilots(false);
            }
        }, 300);

        return () => { if (pilotTimerRef.current) clearTimeout(pilotTimerRef.current); };
    }, [pilotInput, selectedClient, auth.token]);

    // Debounced server-side search for buses
    useEffect(() => {
        if (!selectedClient) {
            setAvailableBuses([]);
            return;
        }

        if (busTimerRef.current) clearTimeout(busTimerRef.current);

        if (!busInput || busInput.length < 2) {
            setAvailableBuses([]);
            return;
        }

        const cacheKey = `${selectedClient.type}:${selectedClient.id}:` + busInput;
        if (busesCacheRef.current.has(cacheKey)) {
            setAvailableBuses(busesCacheRef.current.get(cacheKey));
            return;
        }

        busTimerRef.current = setTimeout(async () => {
            setLoadingBuses(true);
            try {
                let url = `/buses?query=${encodeURIComponent(busInput)}`;
                if (selectedClient.type === 'school') url += `&schoolId=${selectedClient.id}`;
                if (selectedClient.type === 'corporation') url += `&corporationId=${selectedClient.id}`;
                const resp = await api.get(url);
                const busesList = resp.data?.buses || resp.data || [];
                const busesOpts = (Array.isArray(busesList) ? busesList : []).map(b => ({ id: b.id || b._id, placa: b.placa || b.plate || b.licensePlate }));
                busesCacheRef.current.set(cacheKey, busesOpts);
                setAvailableBuses(busesOpts);
            } catch (err) {
                console.error('Error searching buses:', err);
                setAvailableBuses([]);
            } finally {
                setLoadingBuses(false);
            }
        }, 300);

        return () => { if (busTimerRef.current) clearTimeout(busTimerRef.current); };
    }, [busInput, selectedClient, auth.token]);

    // Debounced server-side search for buses (stats)
    useEffect(() => {
        if (!statsSelectedClient) {
            setStatsAvailableBuses([]);
            return;
        }

        if (statsBusTimerRef.current) clearTimeout(statsBusTimerRef.current);

        if (!statsBusInput || statsBusInput.length < 2) {
            setStatsAvailableBuses([]);
            return;
        }

        const cacheKey = `${statsSelectedClient.type}:${statsSelectedClient.id}:` + statsBusInput;
        if (busesCacheRef.current.has(cacheKey)) {
            setStatsAvailableBuses(busesCacheRef.current.get(cacheKey));
            return;
        }

        statsBusTimerRef.current = setTimeout(async () => {
            setStatsLoadingBuses(true);
            try {
                let url = `/buses?query=${encodeURIComponent(statsBusInput)}`;
                if (statsSelectedClient.type === 'school') url += `&schoolId=${statsSelectedClient.id}`;
                if (statsSelectedClient.type === 'corporation') url += `&corporationId=${statsSelectedClient.id}`;
                const resp = await api.get(url);
                const busesList = resp.data?.buses || resp.data || [];
                const busesOpts = (Array.isArray(busesList) ? busesList : []).map(b => ({ id: b.id || b._id, placa: b.placa || b.plate || b.licensePlate }));
                busesCacheRef.current.set(cacheKey, busesOpts);
                setStatsAvailableBuses(busesOpts);
            } catch (err) {
                console.error('Error searching buses (stats):', err);
                setStatsAvailableBuses([]);
            } finally {
                setStatsLoadingBuses(false);
            }
        }, 300);

        return () => { if (statsBusTimerRef.current) clearTimeout(statsBusTimerRef.current); };
    }, [statsBusInput, statsSelectedClient, auth.token]);

    // Load route numbers for selected client (no debounce; small payload)
    useEffect(() => {
        if (!selectedClient) {
            setAvailableRoutesList([]);
            return;
        }

        const cacheKey = `${selectedClient.type}:${selectedClient.id}`;
        if (routesCacheRef.current.has(cacheKey)) {
            setAvailableRoutesList(routesCacheRef.current.get(cacheKey));
            return;
        }

        const loadRoutes = async () => {
            setLoadingRoutes(true);
            try {
                let url = '';
                if (selectedClient.type === 'school') {
                    url = `/routes/school/${selectedClient.id}/numbers`;
                } else if (selectedClient.type === 'corporation') {
                    url = `/routes/corporation/${selectedClient.id}/numbers`;
                } else {
                    // fallback: try school endpoint
                    url = `/routes/school/${selectedClient.id}/numbers`;
                }

                const resp = await api.get(url);
                const nums = resp.data?.routeNumbers || resp.data?.routes || resp.data || [];
                // Normalize to objects { number }
                const opts = (Array.isArray(nums) ? nums : []).map(n => (typeof n === 'object' ? ({ number: n.routeNumber || n.routeNumber || n.routeNumber }) : ({ number: String(n) })));
                routesCacheRef.current.set(cacheKey, opts);
                setAvailableRoutesList(opts);
            } catch (err) {
                console.error('Error loading route numbers:', err);
                setAvailableRoutesList([]);
            } finally {
                setLoadingRoutes(false);
            }
        };

        loadRoutes();
    }, [selectedClient, auth.token]);

    // Load route numbers for stats selected client (independent from history)
    useEffect(() => {
        if (!statsSelectedClient) {
            setStatsAvailableRoutesList([]);
            setStatsRouteSelected(null);
            setStatsRouteNumber('');
            setStatsBusSelected(null);
            setStatsBusInput('');
            setStatsPlate('');
            return;
        }

        const cacheKey = `${statsSelectedClient.type}:${statsSelectedClient.id}`;
        if (routesCacheRef.current.has(cacheKey)) {
            setStatsAvailableRoutesList(routesCacheRef.current.get(cacheKey));
            return;
        }

        const loadStatsRoutes = async () => {
            setStatsLoadingRoutes(true);
            try {
                let url = '';
                if (statsSelectedClient.type === 'school') {
                    url = `/routes/school/${statsSelectedClient.id}/numbers`;
                } else if (statsSelectedClient.type === 'corporation') {
                    url = `/routes/corporation/${statsSelectedClient.id}/numbers`;
                } else {
                    url = `/routes/school/${statsSelectedClient.id}/numbers`;
                }

                const resp = await api.get(url);
                const nums = resp.data?.routeNumbers || resp.data?.routes || resp.data || [];
                const opts = (Array.isArray(nums) ? nums : []).map((n) => {
                    if (typeof n === 'object' && n) {
                        const number = n.number ?? n.routeNumber ?? n.route ?? n.numero;
                        return { number: String(number ?? '') };
                    }
                    return { number: String(n) };
                }).filter((o) => o.number);

                routesCacheRef.current.set(cacheKey, opts);
                setStatsAvailableRoutesList(opts);
            } catch (err) {
                console.error('Error loading route numbers (stats):', err);
                setStatsAvailableRoutesList([]);
            } finally {
                setStatsLoadingRoutes(false);
            }
        };

        loadStatsRoutes();
    }, [statsSelectedClient, auth.token]);

    const formatTime = (dateTime) => {
        if (!dateTime) return 'N/A';
        const date = new Date(dateTime);
        return date.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return 'En progreso';
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        return `${diffHrs}h ${diffMins}m`;
    };

    const contentMinHeight = 320;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const chartPrimary = theme.palette.primary.main;
    const chartPrimaryLight = theme.palette.primary.light;

    const softPrimaryBg = alpha(theme.palette.primary.main, 0.04);
    const softerPrimaryBg = alpha(theme.palette.primary.main, 0.02);
    const softPrimaryRing = alpha(theme.palette.primary.main, 0.10);
    const activeFieldSx = {
        backgroundColor: softPrimaryBg,
        borderRadius: 1,
        '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: 'primary.main', borderWidth: 1 },
            '&:hover fieldset': { borderColor: 'primary.dark' },
        },
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.08)}`,
    };

    const overallActiveDaysFallback = useMemo(() => {
        const rows = statsData?.rows || [];
        if (!rows.length) return 0;
        const activeDates = new Set();
        for (const row of rows) {
            const series = row?.daily || [];
            for (const it of series) {
                const date = it?.date;
                const km = Number(it?.km) || 0;
                if (!date || km <= 0) continue;
                activeDates.add(date);
            }
        }
        return activeDates.size;
    }, [statsData]);

    const overallActiveDaysDisplay = statsData?.overallActiveDays ?? overallActiveDaysFallback;

    // Mientras se recargan estadísticas tras cambiar agrupación, mantenemos labels consistentes
    // con la data actualmente mostrada (la última agrupación cargada).
    const statsEffectiveGroupBy = statsData ? (statsLastLoadedGroupBy || statsGroupBy) : statsGroupBy;

    const statsRowsSortedByKm = useMemo(() => {
        const rows = statsData?.rows || [];
        return rows
            .slice()
            .sort((a, b) => (parseFloat(b?.totalKm || 0) - parseFloat(a?.totalKm || 0)));
    }, [statsData]);

    const statsRowsSortedForSelector = useMemo(() => {
        const rows = statsData?.rows || [];
        const toStr = (v) => String(v ?? '').trim();

        return rows.slice().sort((a, b) => {
            const ak = toStr(a?.key);
            const bk = toStr(b?.key);

            if (statsEffectiveGroupBy === 'route') {
                const an = Number.parseInt(ak, 10);
                const bn = Number.parseInt(bk, 10);
                const aOk = Number.isFinite(an);
                const bOk = Number.isFinite(bn);
                if (aOk && bOk) return an - bn;
                if (aOk && !bOk) return -1;
                if (!aOk && bOk) return 1;
            }

            return ak.localeCompare(bk);
        });
    }, [statsData, statsEffectiveGroupBy]);

    const topChartRows = useMemo(() => {
        const topByKm = statsRowsSortedByKm.slice(0, 10);
        if (statsTopSortByKm) return topByKm;

        const toStr = (v) => String(v ?? '');
        const cmp = (a, b) => {
            const ak = toStr(a?.key).trim();
            const bk = toStr(b?.key).trim();
            if (statsEffectiveGroupBy === 'route') {
                const an = Number.parseInt(ak, 10);
                const bn = Number.parseInt(bk, 10);
                const aOk = Number.isFinite(an);
                const bOk = Number.isFinite(bn);
                if (aOk && bOk) return an - bn;
            }
            return ak.localeCompare(bk);
        };

        return topByKm.slice().sort(cmp);
    }, [statsRowsSortedByKm, statsTopSortByKm, statsEffectiveGroupBy]);

    const statsTopKeyByKm = statsRowsSortedByKm?.[0]?.key ?? '';

    const loadStats = async (groupByOverride) => {
        setStatsError(null);
        try {
            setStatsLoading(true);
            const selectedStatsClientId = (statsSelectedClient && (statsSelectedClient.id || statsSelectedClient.value || statsSelectedClient._id)) || null;
            if (!selectedStatsClientId) {
                setStatsClientTouched(true);
                setStatsError('Seleccione un cliente en los filtros de estadísticas antes de cargar.');
                setStatsLoading(false);
                return;
            }

            const clientParam = {};
            if (statsSelectedClient?.type === 'school') clientParam.schoolId = selectedStatsClientId;
            else if (statsSelectedClient?.type === 'corporation') clientParam.corporationId = selectedStatsClientId;
            else clientParam.schoolId = selectedStatsClientId;

            const groupByToUse = groupByOverride || statsGroupBy;

            let startDateParam = statsStartDate || undefined;
            let endDateParam = statsEndDate || undefined;

            // Si no se especifica mes ni rango, por defecto usar mes actual (evita rangos enormes y gráficas pesadas)
            if (!statsMonth && !startDateParam && !endDateParam) {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const currentMonth = `${yyyy}-${mm}`;
                const { start, end } = getMonthRange(currentMonth);
                startDateParam = start || startDateParam;
                endDateParam = end || endDateParam;
                setStatsMonth(currentMonth);
                setStatsStartDate(startDateParam || '');
                setStatsEndDate(endDateParam || '');
            } else if (statsMonth) {
                const { start, end } = getMonthRange(statsMonth);
                startDateParam = start || startDateParam;
                endDateParam = end || endDateParam;
            }

            const params = {
                ...clientParam,
                startDate: startDateParam,
                endDate: endDateParam,
                groupBy: groupByToUse,
                routeNumber: statsRouteNumber || undefined,
                plate: statsPlate || undefined,
            };

            const resp = await api.get('/transportistas/estadisticas-kilometros', { params });
            const groups = resp.data?.groups || [];
            const overall = resp.data?.overallTotalKm || 0;
            const dateArray = resp.data?.dateArray || [];

            const rows = (groups || [])
                .slice()
                .map(g => ({
                    key: g.key,
                    totalKm: g.totalKm,
                    recorridos: g.recorridos,
                    kmDia: g.avgPerActiveDay || g.avgPerDayOverall || 0,
                    daily: g.daily,
                    activeDays: g.activeDays,
                    daysCount: g.daysCount
                }));

            setStatsData({
                rows,
                totalKm: overall,
                daysCount: dateArray.length,
                dateArray,
                overallActiveDays: resp.data?.overallActiveDays,
                overallAvgPerActiveDay: resp.data?.overallAvgPerActiveDay
            });
            setStatsHasLoadedOnce(true);
            setStatsLastLoadedGroupBy(groupByToUse);
            setStatsLastLoadedParams(params);
            setStatsFiltersDirty(false);
        } catch (err) {
            console.error('Error cargando estadísticas:', err);
            setStatsError(err.response?.data?.message || err.message || 'No se pudieron cargar las estadísticas');
        } finally {
            setStatsLoading(false);
        }
    };

    const downloadStatsPdfReport = async () => {
        if (!statsLastLoadedParams || !statsData) return;
        setStatsError(null);
        try {
            setStatsReportLoading(true);
            const groupByToUse = statsLastLoadedParams.groupBy || statsLastLoadedGroupBy || statsGroupBy;

            const resp = await api.get('/transportistas/estadisticas-kilometros/reporte', {
                params: statsLastLoadedParams,
                responseType: 'blob',
            });

            const contentType = String(resp.headers?.['content-type'] || '').toLowerCase();
            const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data], { type: contentType || 'application/octet-stream' });

            // If backend returned an error JSON/HTML, do not download it as a PDF.
            if (!contentType.includes('application/pdf')) {
                const txt = await blob.text();
                let message = 'No se pudo generar el PDF.';
                try {
                    const parsed = JSON.parse(txt);
                    message = parsed?.message || parsed?.error || message;
                } catch (_) {
                    message = (txt || '').trim().slice(0, 240) || message;
                }
                setStatsError(message);
                return;
            }

            // Validate PDF magic header
            const headerBuf = await blob.slice(0, 5).arrayBuffer();
            const header = new TextDecoder('utf-8').decode(headerBuf);
            if (header !== '%PDF-') {
                const txt = await blob.text();
                setStatsError((txt || 'El archivo recibido no es un PDF válido.').slice(0, 240));
                return;
            }

            const url = window.URL.createObjectURL(blob);

            const start = statsLastLoadedParams.startDate || '';
            const end = statsLastLoadedParams.endDate || '';
            const safeStart = start ? String(start).replace(/[^0-9-]/g, '_') : 'sin-inicio';
            const safeEnd = end ? String(end).replace(/[^0-9-]/g, '_') : 'sin-fin';
            const filename = `reporte_kilometros_${groupByToUse}_${safeStart}_${safeEnd}.pdf`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error generando PDF:', err);
            setStatsError(err.response?.data?.message || err.message || 'No se pudo generar el PDF');
        } finally {
            setStatsReportLoading(false);
        }
    };

    useEffect(() => {
        if (!statsData?.rows?.length) {
            setStatsSelectedKey('');
            return;
        }
        const keys = new Set(statsData.rows.map(r => String(r.key)));
        if (statsSelectedKey && keys.has(String(statsSelectedKey))) return;
        setStatsSelectedKey(String((statsRowsSortedByKm[0] || statsData.rows[0]).key));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statsData, statsRowsSortedByKm]);

    const selectedGroupRow = useMemo(() => {
        const rows = statsData?.rows || [];
        if (!rows.length) return null;
        const selected = rows.find(r => String(r.key) === String(statsSelectedKey));
        return selected || rows[0] || null;
    }, [statsData, statsSelectedKey]);

    const selectedDailySeriesRaw = useMemo(() => {
        const series = selectedGroupRow?.daily || [];
        return (Array.isArray(series) ? series : [])
            .map((it) => {
                const kmVal = Number(it?.km) || 0;
                return {
                    date: (it?.date ? String(it.date).slice(0, 10) : ''),
                    km: kmVal,
                    // Para no dibujar barras en días sin recorrido cuando se incluyen días vacíos.
                    // El tooltip seguirá mostrando `km` (0.00).
                    kmBar: kmVal > 0 ? kmVal : null,
                    // Capa invisible para que el tooltip funcione incluso con 0 km.
                    kmHover: kmVal > 0 ? kmVal : 1e-9,
                };
            })
            .filter((it) => it.date)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }, [selectedGroupRow]);

    const selectedDailySeries = useMemo(() => {
        if (statsShowEmptyDays) return selectedDailySeriesRaw;
        return selectedDailySeriesRaw.filter((it) => it.km > 0);
    }, [selectedDailySeriesRaw, statsShowEmptyDays]);

    const dailyTickInterval = useMemo(() => {
        const n = selectedDailySeries.length;
        if (n <= 1) return 0;

        // Target a bounded number of visible ticks.
        // When showing empty days, the series grows a lot, so be more aggressive.
        const desiredTicks = statsShowEmptyDays ? 10 : 16;
        if (n <= desiredTicks) return 0;

        // Recharts shows every (interval + 1) tick.
        const interval = Math.ceil(n / desiredTicks) - 1;
        return Math.max(1, interval);
    }, [selectedDailySeries.length, statsShowEmptyDays]);

    const dailyTickFormatter = (value) => {
        const s = String(value || '');
        // YYYY-MM-DD -> MM-DD
        if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(5, 10);
        return s;
    };

    const formatKmForTooltip = (value) => {
        const num = Number(value) || 0;
        if (num > 0 && num < 0.01) return `${num.toFixed(4)} km`;
        if (num > 0 && num < 0.1) return `${num.toFixed(3)} km`;
        return `${num.toFixed(2)} km`;
    };

    const KmByDayTooltip = useCallback(({ active, label, payload }) => {
        if (!active || !Array.isArray(payload) || payload.length === 0) return null;

        const base = payload[0]?.payload || {};
        const km = Number(base?.km) || 0;

        return (
            <Paper elevation={3} sx={{ p: 1.25, pointerEvents: 'none' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {`Fecha: ${label}`}
                </Typography>
                <Typography variant="body2" sx={{ color: 'primary.main' }}>
                    {`Kilómetros : ${formatKmForTooltip(km)}`}
                </Typography>
            </Paper>
        );
    }, []);

    const TopKmTooltip = useCallback(({ active, label, payload }) => {
        if (!active || !Array.isArray(payload) || payload.length === 0) return null;

        const base = payload[0]?.payload || {};
        const km = Number(base?.km ?? payload[0]?.value) || 0;
        const groupLabel = statsEffectiveGroupBy === 'plate' ? 'Placa' : 'Ruta';

        return (
            <Paper elevation={3} sx={{ p: 1.25, pointerEvents: 'none' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {`${groupLabel}: ${label}`}
                </Typography>
                <Typography variant="body2" sx={{ color: 'primary.main' }}>
                    {`Kilómetros : ${formatKmForTooltip(km)}`}
                </Typography>
            </Paper>
        );
    }, [statsEffectiveGroupBy]);

    const statsRowsCount = statsData?.rows?.length || 0;
    const hasStatsResults = statsRowsCount > 0;
    
    const hasMultipleGroups = statsRowsCount > 1;
    const statsShowCountKpi = !statsData || hasMultipleGroups;
    const statsShowTopKpi = !statsData || hasMultipleGroups;
    const chartSteps = hasMultipleGroups ? 2 : 1;

    useEffect(() => {
        if (chartSteps === 1 && statsChartStep !== 0) {
            setStatsChartStep(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartSteps]);

    return (
        <Box sx={{ p: 4, backgroundColor: 'background.default', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DirectionsBus />
                    <Typography variant="h5">Historial de Recorridos de Rutas</Typography>
                </Box>
            </Box>

            {/* Estadísticas: tarjetas resumen + controles */}
            <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, border: 1, borderColor: 'divider', backgroundColor: 'background.paper' }} elevation={0}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: statsExpanded ? 2 : 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, backgroundColor: softPrimaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Speed fontSize="small" color="primary" />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Estadísticas</Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.2 }}>Resumen del kilometraje según los filtros aplicados</Typography>
                        </Box>
                    </Box>

                    <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => setStatsExpanded((s) => !s)}
                        endIcon={<ExpandMoreIcon sx={{ transform: statsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }} />}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            backgroundColor: softPrimaryBg,
                            borderColor: softPrimaryRing,
                            '&:hover': { backgroundColor: softPrimaryBg, borderColor: 'primary.main' },
                            whiteSpace: 'nowrap',
                        }}
                        aria-label={statsExpanded ? 'Ocultar estadísticas' : 'Mostrar estadísticas'}
                    >
                        {statsExpanded ? 'Ocultar' : 'Mostrar'}
                    </Button>
                </Box>

                <Collapse in={statsExpanded} timeout="auto" unmountOnExit>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12}>
                        <Grid container spacing={2} alignItems="stretch">
                            {statsShowCountKpi && (
                            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'divider', backgroundColor: softerPrimaryBg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="caption" color="textSecondary">{statsEffectiveGroupBy === 'plate' ? 'Placas' : 'Rutas'}</Typography>
                                            <Typography variant="h4" sx={{ letterSpacing: -0.5 }} noWrap>{statsData ? statsData.rows.length : '-'}</Typography>
                                        </Box>
                                        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, backgroundColor: softPrimaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <CheckCircle fontSize="small" color="primary" />
                                        </Box>
                                    </Box>
                                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                        Cantidad de {statsEffectiveGroupBy === 'plate' ? 'placas' : 'rutas'} en el conjunto filtrado
                                    </Typography>
                                </Paper>
                            </Grid>
                            )}
                            <Grid item xs={12} sm={6} md={statsShowCountKpi && statsShowTopKpi ? 3 : 6} sx={{ display: 'flex' }}>
                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'divider', backgroundColor: softerPrimaryBg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="caption" color="textSecondary">Total Kilómetros</Typography>
                                            <Typography variant="h4" sx={{ letterSpacing: -0.5 }} noWrap>{statsData ? `${parseFloat(statsData.totalKm || 0).toFixed(2)} km` : '-'}</Typography>
                                        </Box>
                                        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, backgroundColor: softPrimaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Speed fontSize="small" color="primary" />
                                        </Box>
                                    </Box>
                                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Total de kilómetros del rango seleccionado</Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} sm={6} md={statsShowCountKpi && statsShowTopKpi ? 3 : 6} sx={{ display: 'flex' }}>
                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'divider', backgroundColor: softerPrimaryBg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography variant="caption" color="textSecondary">Km Promedio/Día</Typography>
                                                <Tooltip
                                                    placement="top"
                                                    title={
                                                        <Box sx={{ p: 0.5 }}>
                                                            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>¿Qué significa?</Typography>
                                                            <Typography variant="body2">
                                                                Este indicador obtiene el kilometraje promedio por día dentro del rango y filtros seleccionados.
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 700 }}>
                                                                Días activos
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                Son los días del rango en los que se registraron recorridos.
                                                            </Typography>
                                                        </Box>
                                                    }
                                                >
                                                    <IconButton size="small" sx={{ p: 0.25 }} aria-label="Ayuda: Km Promedio/Día">
                                                        <InfoOutlined fontSize="inherit" color="action" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                            <Typography variant="h4" sx={{ letterSpacing: -0.5 }} noWrap>{statsData ? `${parseFloat(statsData.overallAvgPerActiveDay || ((statsData.totalKm || 0) / Math.max(1, statsData.daysCount))).toFixed(2)} km` : '-'}</Typography>
                                        </Box>
                                        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, backgroundColor: softPrimaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <CalendarToday fontSize="small" color="primary" />
                                        </Box>
                                    </Box>
                                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Promedio por día activo</Typography>
                                    {statsData && (
                                        <Box sx={{ mt: 1.25 }}>
                                            <Chip
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                                label={`Días activos: ${overallActiveDaysDisplay}`}
                                                sx={{ backgroundColor: softPrimaryBg }}
                                            />
                                        </Box>
                                    )}
                                </Paper>
                            </Grid>
                            {statsShowTopKpi && (
                            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'divider', backgroundColor: softerPrimaryBg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="caption" color="textSecondary">Top {statsEffectiveGroupBy === 'plate' ? 'Placa' : 'Ruta'}</Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} noWrap>
                                                {statsRowsSortedByKm[0] ? statsRowsSortedByKm[0].key : '-'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, backgroundColor: softPrimaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <DirectionsBus fontSize="small" color="primary" />
                                        </Box>
                                    </Box>
                                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                        {statsEffectiveGroupBy === 'plate' ? 'Placa' : 'Ruta'} con mayor kilometraje
                                    </Typography>
                                </Paper>
                            </Grid>
                            )}
                        </Grid>
                    </Grid>

                    {/* Barra de filtros (estilo registros de combustible) */}
                    <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'divider', backgroundColor: alpha(theme.palette.primary.main, 0.01) }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={2}>
                                    <Autocomplete
                                        size="small"
                                        options={clients}
                                        groupBy={(option) => option.group || ''}
                                        getOptionLabel={(opt) => opt ? (opt.name || opt.nombre || opt.label || String(opt.id || opt.value || opt._id)) : ''}
                                        value={statsSelectedClient}
                                        onChange={(_, newValue) => {
                                            setStatsClientTouched(true);
                                            setStatsSelectedClient(newValue);
                                            setStatsFiltersDirty(true);
                                        }}
                                        isOptionEqualToValue={(opt, val) => String(opt?.id) === String(val?.id) && String(opt?.type) === String(val?.type)}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Cliente"
                                                error={statsClientTouched && !statsSelectedClient}
                                                helperText={(statsClientTouched && !statsSelectedClient) ? 'Seleccione un cliente' : ''}
                                                sx={statsSelectedClient ? activeFieldSx : {}}
                                            />
                                        )}
                                    />
                                </Grid>

                                <Grid item xs={12} md={1}>
                                    <Autocomplete
                                        size="small"
                                        options={statsAvailableRoutesList}
                                        getOptionLabel={(opt) => opt ? (opt.number || String(opt)) : ''}
                                        value={statsRouteSelected}
                                        onChange={(_, newVal) => {
                                            setStatsRouteSelected(newVal);
                                            setStatsRouteNumber(newVal?.number ? String(newVal.number) : '');
                                            setStatsFiltersDirty(true);
                                        }}
                                        loading={statsLoadingRoutes}
                                        disabled={!statsSelectedClient}
                                        isOptionEqualToValue={(opt, val) => String(opt?.number) === String(val?.number)}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Ruta"
                                                placeholder="Número"
                                                fullWidth
                                                InputProps={{
                                                    ...params.InputProps,
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>#</Box>
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <>
                                                            {statsLoadingRoutes ? <CircularProgress color="inherit" size={16} /> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
                                                sx={statsRouteNumber ? activeFieldSx : {}}
                                            />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>

                                <Grid item xs={12} md={1.5}>
                                    <Autocomplete
                                        size="small"
                                        options={statsAvailableBuses}
                                        getOptionLabel={(opt) => opt ? (opt.placa || '') : ''}
                                        value={statsBusSelected}
                                        inputValue={statsBusInput}
                                        onInputChange={(_, v) => setStatsBusInput(v)}
                                        onChange={(_, newVal) => {
                                            setStatsBusSelected(newVal);
                                            setStatsPlate(newVal?.placa ? String(newVal.placa) : '');
                                            setStatsFiltersDirty(true);
                                        }}
                                        loading={statsLoadingBuses}
                                        disabled={!statsSelectedClient}
                                        isOptionEqualToValue={(opt, val) => String(opt?.id) === String(val?.id)}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Placa"
                                                placeholder={statsSelectedClient ? 'Buscar placa' : 'Seleccione cliente'}
                                                fullWidth
                                                InputProps={{
                                                    ...params.InputProps,
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <DirectionsBus fontSize="small" color="action" />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <>
                                                            {statsLoadingBuses ? <CircularProgress color="inherit" size={16} /> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
                                                sx={statsPlate ? activeFieldSx : {}}
                                            />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>

                                <Grid item xs={12} md={1.5}>
                                    <TextField
                                        size="small"
                                        label="Mes"
                                        fullWidth
                                        value={(() => {
                                            if (!statsMonth) return '';
                                            const [yyStr, mmStr] = statsMonth.split('-');
                                            const yy = parseInt(yyStr, 10);
                                            const mm = parseInt(mmStr, 10);
                                            if (Number.isNaN(yy) || Number.isNaN(mm)) return statsMonth;

                                            const dt = new Date(Date.UTC(yy, mm - 1, 1));
                                            return new Intl.DateTimeFormat('es-ES', {
                                                month: 'long',
                                                year: 'numeric',
                                                timeZone: 'UTC',
                                            }).format(dt);
                                        })()}
                                        onClick={(e) => {
                                            setStatsMonthAnchorEl(e.currentTarget);
                                            const base = statsMonth ? `${statsMonth}-01` : undefined;
                                            if (base) {
                                                const [yyStr] = base.split('-');
                                                const yy = parseInt(yyStr, 10);
                                                if (!Number.isNaN(yy)) setStatsMonthViewYear(yy);
                                            } else {
                                                setStatsMonthViewYear(new Date().getFullYear());
                                            }
                                        }}
                                        InputProps={{ readOnly: true }}
                                        InputLabelProps={{ shrink: true }}
                                        placeholder="Seleccionar"
                                        sx={statsMonth ? activeFieldSx : {}}
                                    />

                                    <Popover
                                        open={Boolean(statsMonthAnchorEl)}
                                        anchorEl={statsMonthAnchorEl}
                                        onClose={() => setStatsMonthAnchorEl(null)}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    >
                                        <Box
                                            sx={{
                                                p: 1.25,
                                                minWidth: 260,
                                                borderRadius: 2,
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setStatsMonthViewYear((y) => y - 1)}
                                                    aria-label="Año anterior"
                                                    sx={{
                                                        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                                        borderRadius: 2,
                                                    }}
                                                >
                                                    <KeyboardArrowLeft fontSize="small" />
                                                </IconButton>

                                                <Box sx={{ textAlign: 'center', px: 1 }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }}>
                                                        Seleccionar mes
                                                    </Typography>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                                        {statsMonthViewYear}
                                                    </Typography>
                                                </Box>

                                                <IconButton
                                                    size="small"
                                                    onClick={() => setStatsMonthViewYear((y) => y + 1)}
                                                    aria-label="Año siguiente"
                                                    sx={{
                                                        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                                        borderRadius: 2,
                                                    }}
                                                >
                                                    <KeyboardArrowRight fontSize="small" />
                                                </IconButton>
                                            </Box>

                                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
                                                {statsMonthsShortEs.map((label, idx) => {
                                                    const monthIndex = idx + 1;
                                                    const monthStr = `${statsMonthViewYear}-${String(monthIndex).padStart(2, '0')}`;
                                                    const selected = statsMonth === monthStr;
                                                    return (
                                                        <Button
                                                            key={monthStr}
                                                            size="small"
                                                            variant={selected ? 'contained' : 'outlined'}
                                                            onClick={() => {
                                                                setStatsMonth(monthStr);
                                                                setStatsFiltersDirty(true);
                                                                const { start, end } = getMonthRange(monthStr);
                                                                setStatsStartDate(start || '');
                                                                setStatsEndDate(end || '');
                                                                setStatsMonthAnchorEl(null);
                                                            }}
                                                            sx={{
                                                                minWidth: 0,
                                                                py: 0.75,
                                                                borderRadius: 2,
                                                                textTransform: 'capitalize',
                                                                fontWeight: selected ? 700 : 600,
                                                                borderColor: selected ? undefined : alpha(theme.palette.primary.main, 0.35),
                                                                '&:hover': {
                                                                    borderColor: selected ? undefined : alpha(theme.palette.primary.main, 0.55),
                                                                },
                                                            }}
                                                        >
                                                            {label}
                                                        </Button>
                                                    );
                                                })}
                                            </Box>

                                            <Divider sx={{ my: 1 }} />

                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.75 }}>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={() => {
                                                        setStatsMonth('');
                                                        setStatsFiltersDirty(true);
                                                        setStatsMonthAnchorEl(null);
                                                    }}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    Limpiar
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={() => {
                                                        const now = new Date();
                                                        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                                        setStatsMonthViewYear(now.getFullYear());
                                                        setStatsMonth(monthStr);
                                                        setStatsFiltersDirty(true);
                                                        const { start, end } = getMonthRange(monthStr);
                                                        setStatsStartDate(start || '');
                                                        setStatsEndDate(end || '');
                                                        setStatsMonthAnchorEl(null);
                                                    }}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    Hoy
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Popover>
                                </Grid>

                                <Grid item xs={12} md={2}>
                                    <TextField
                                        size="small"
                                        variant="outlined"
                                        label="Rango de fechas"
                                        fullWidth
                                        value={statsStartDate && statsEndDate ? `${statsStartDate} — ${statsEndDate}` : (statsStartDate ? `${statsStartDate} —` : (statsEndDate ? `— ${statsEndDate}` : ''))}
                                        onClick={(e) => setStatsDateAnchorEl(e.currentTarget)}
                                        InputProps={{ readOnly: true, startAdornment: (<InputAdornment position="start"><CalendarToday fontSize="small" color="action"/></InputAdornment>) }}
                                        sx={ (statsStartDate || statsEndDate) ? activeFieldSx : {} }
                                    />
                                    <Popover
                                        open={Boolean(statsDateAnchorEl)}
                                        anchorEl={statsDateAnchorEl}
                                        onClose={() => setStatsDateAnchorEl(null)}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    >
                                        <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center', minWidth: 360 }}>
                                            <TextField
                                                size="small"
                                                label="Fecha inicio"
                                                type="date"
                                                value={statsStartDate}
                                                onChange={(e) => { setStatsStartDate(e.target.value); setStatsMonth(''); setStatsFiltersDirty(true); }}
                                                InputLabelProps={{ shrink: true }}
                                                sx={{ flex: 1 }}
                                            />
                                            <TextField
                                                size="small"
                                                label="Fecha fin"
                                                type="date"
                                                value={statsEndDate}
                                                onChange={(e) => { setStatsEndDate(e.target.value); setStatsMonth(''); setStatsFiltersDirty(true); }}
                                                InputLabelProps={{ shrink: true }}
                                                sx={{ flex: 1 }}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                                            <Button size="small" onClick={() => { setStatsStartDate(''); setStatsEndDate(''); setStatsMonth(''); setStatsFiltersDirty(true); setStatsDateAnchorEl(null); }}>Limpiar</Button>
                                            <Button size="small" variant="contained" onClick={() => { setStatsDateAnchorEl(null); }} sx={{ ml: 1 }}>Aplicar</Button>
                                        </Box>
                                    </Popover>
                                </Grid>

                                <Grid item xs={12} md={1}>
                                    <TextField
                                        size="small"
                                        select
                                        fullWidth
                                        SelectProps={{ native: true }}
                                        value={statsGroupBy}
                                        onChange={(e) => {
                                            const newGroupBy = e.target.value;
                                            setStatsGroupBy(newGroupBy);

                                            setStatsSelectedKey('');
                                            setStatsChartStep(0);
                                            setStatsError(null);

                                            // Auto-recarga solo si ya se cargaron estadísticas antes y
                                            // NO se han cambiado otros filtros desde la última carga.
                                            if (statsHasLoadedOnce && !statsFiltersDirty) {
                                                loadStats(newGroupBy);
                                            } else {
                                                // Evita que quede data vieja con una agrupación distinta seleccionada.
                                                setStatsData(null);
                                                setStatsLastLoadedGroupBy('');
                                            }
                                        }}
                                        label="Agrupar"
                                        InputLabelProps={{ shrink: true }}
                                        sx={statsGroupBy ? { '& .MuiOutlinedInput-root fieldset': { borderColor: 'divider' } } : {}}
                                    >
                                        <option value="route">Ruta</option>
                                        <option value="plate">Placa</option>
                                    </TextField>
                                </Grid>

                                {/* Selector de serie diaria se muestra dentro del carrusel, en la vista de "Km por día" */}

                                <Grid item xs={12} md={3}>
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => {
                                                setStatsData(null);
                                                setStatsError(null);
                                                setStatsLoading(false);
                                                setStatsHasLoadedOnce(false);
                                                setStatsLastLoadedGroupBy('');
                                                setStatsFiltersDirty(false);
                                                setStatsSelectedKey('');
                                                setStatsChartStep(0);
                                                setStatsMonth('');
                                                setStatsStartDate('');
                                                setStatsEndDate('');
                                                setStatsRouteNumber('');
                                                setStatsRouteSelected(null);
                                                setStatsPlate('');
                                                setStatsBusSelected(null);
                                                setStatsBusInput('');
                                            }}
                                        >
                                            Limpiar
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() => loadStats()}
                                        >
                                            Cargar estadísticas
                                        </Button>
                                        {statsData && hasStatsResults && (
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="secondary"
                                                onClick={downloadStatsPdfReport}
                                                disabled={statsReportLoading || statsLoading || !statsLastLoadedParams}
                                                startIcon={statsReportLoading ? <CircularProgress size={16} /> : <PictureAsPdf fontSize="small" />}
                                                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                                            >
                                                Generar PDF
                                            </Button>
                                        )}
                                    </Box>
                                </Grid>


                            </Grid>
                        </Paper>
                    </Grid>

                    <Grid item xs={12}>
                        {statsError && <Alert severity="error">{statsError}</Alert>}
                        {!statsData && !statsLoading && !statsError && <Typography variant="body2" color="textSecondary">Seleccione un cliente y rango, luego presione "Cargar estadísticas".</Typography>}
                        {statsData && (
                            <Box sx={{ mt: 2 }}>
                                <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider', backgroundColor: 'background.default', position: 'relative' }}>
                                    {statsLoading && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                inset: 0,
                                                zIndex: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: alpha(theme.palette.background.paper, 0.55),
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1.25,
                                                    px: 2,
                                                    py: 1.25,
                                                    borderRadius: 2,
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    backgroundColor: alpha(theme.palette.background.paper, 0.9),
                                                }}
                                            >
                                                <CircularProgress size={20} />
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>Cargando</Typography>
                                            </Box>
                                        </Box>
                                    )}
                                    <Box sx={{ p: 1.5 }}>
                                        {statsChartStep === 0 && (
                                            <>
                                                {!hasStatsResults ? (
                                                    <Box sx={{ py: 6, textAlign: 'center' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Sin resultados</Typography>
                                                        <Typography variant="body2" color="textSecondary">
                                                            No se encontraron recorridos para los filtros seleccionados.
                                                        </Typography>
                                                    </Box>
                                                ) : hasMultipleGroups ? (
                                                    <>
                                                        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                                {statsEffectiveGroupBy === 'plate' ? 'Placas' : 'Rutas'} con más kilómetros
                                                            </Typography>
                                                            <FormControlLabel
                                                                control={(
                                                                    <Checkbox
                                                                        size="small"
                                                                        checked={statsTopSortByKm}
                                                                        onChange={(e) => setStatsTopSortByKm(e.target.checked)}
                                                                    />
                                                                )}
                                                                label={<Typography variant="body2" color="textSecondary">Ordenar por mayor km</Typography>}
                                                                sx={{ m: 0 }}
                                                            />
                                                        </Box>
                                                        <Box sx={{ width: '100%', height: 320 }}>
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart layout="vertical" data={topChartRows.map(r => ({ name: r.key, km: Number(r.totalKm) || 0 }))} margin={{ top: 10, right: 90, left: 24, bottom: 10 }}>
                                                                    <XAxis type="number" hide domain={[0, (dataMax) => Math.max(1, dataMax) * 1.15]} />
                                                                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                                                                    <RechartsTooltip
                                                                        isAnimationActive={false}
                                                                        cursor={false}
                                                                        allowEscapeViewBox={{ x: true, y: true }}
                                                                        offset={10}
                                                                        wrapperStyle={{ pointerEvents: 'none' }}
                                                                        content={TopKmTooltip}
                                                                    />
                                                                    <Bar dataKey="km" radius={[6,6,6,6]} isAnimationActive={false} maxBarSize={28} activeBar={false}>
                                                                        <LabelList dataKey="km" position="right" offset={10} formatter={(v) => `${parseFloat(v).toFixed(2)} km`} style={{ pointerEvents: 'none' }} />
                                                                        {topChartRows.map((entry, index) => (
                                                                            <Cell
                                                                                key={`cell-${index}`}
                                                                                fill={String(entry?.key) === String(statsTopKeyByKm) ? chartPrimary : chartPrimaryLight}
                                                                            />
                                                                        ))}
                                                                    </Bar>
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </Box>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Km por día (barras)</Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                <FormControlLabel
                                                                    control={(
                                                                        <Checkbox
                                                                            size="small"
                                                                            checked={statsShowEmptyDays}
                                                                            onChange={(e) => setStatsShowEmptyDays(e.target.checked)}
                                                                        />
                                                                    )}
                                                                    label={<Typography variant="body2" color="textSecondary">Incluir días sin recorridos</Typography>}
                                                                    sx={{ m: 0 }}
                                                                />
                                                                {selectedGroupRow ? (
                                                                    <Chip
                                                                        size="small"
                                                                        color="primary"
                                                                        variant="outlined"
                                                                        label={`${statsEffectiveGroupBy === 'plate' ? 'Placa' : 'Ruta'}: ${selectedGroupRow.key}`}
                                                                        sx={{ backgroundColor: softPrimaryBg, fontWeight: 700 }}
                                                                    />
                                                                ) : (
                                                                    <Typography variant="body2" color="textSecondary">Distribución diaria</Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                        <Box sx={{ width: '100%', height: 320 }}>
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart tooltipEventType="axis" data={selectedDailySeries} margin={{ top: 10, right: 16, left: 8, bottom: 10 }}>
                                                                    <CartesianGrid stroke={alpha(theme.palette.text.primary, 0.06)} vertical={false} />
                                                                    <XAxis type="category" dataKey="date" tick={{ fontSize: 12 }} interval={dailyTickInterval} tickFormatter={dailyTickFormatter} minTickGap={20} />
                                                                    <YAxis tick={{ fontSize: 12 }} />
                                                                    <RechartsTooltip
                                                                        shared
                                                                        isAnimationActive={false}
                                                                        wrapperStyle={{ pointerEvents: 'none', willChange: 'transform', transition: 'transform 140ms ease-out' }}
                                                                        content={KmByDayTooltip}
                                                                    />
                                                                    <Bar dataKey="km" radius={[6,6,0,0]} isAnimationActive={false} fill={chartPrimaryLight} maxBarSize={56} minPointSize={statsShowEmptyDays ? 8 : 3} activeBar={false}>
                                                                        {selectedDailySeries.map((entry, idx) => (
                                                                            <Cell
                                                                                key={`cell-day-${idx}`}
                                                                                fill={chartPrimaryLight}
                                                                                fillOpacity={entry.km > 0 ? 1 : 0}
                                                                                stroke={entry.km > 0 ? 'none' : 'transparent'}
                                                                            />
                                                                        ))}
                                                                    </Bar>
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </Box>
                                                    </>
                                                )}
                                            </>
                                        )}

                                        {hasMultipleGroups && statsChartStep === 1 && (
                                            <>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Km por día</Typography>
                                                        <Typography variant="body2" color="textSecondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {selectedGroupRow ? `Kilómetros diarios de ${statsEffectiveGroupBy === 'plate' ? 'placa' : 'ruta'}: ${selectedGroupRow.key}` : 'Serie diaria del elemento seleccionado'}
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <FormControlLabel
                                                            control={(
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={statsShowEmptyDays}
                                                                    onChange={(e) => setStatsShowEmptyDays(e.target.checked)}
                                                                />
                                                            )}
                                                            label={<Typography variant="body2" color="textSecondary">Incluir días sin recorridos</Typography>}
                                                            sx={{ m: 0 }}
                                                        />
                                                        {statsData?.rows?.length > 0 && (
                                                            <TextField
                                                                size="small"
                                                                select
                                                                SelectProps={{ native: true }}
                                                                value={statsSelectedKey}
                                                                onChange={(e) => setStatsSelectedKey(e.target.value)}
                                                                label={statsEffectiveGroupBy === 'plate' ? 'Placa' : 'Ruta'}
                                                                InputLabelProps={{ shrink: true }}
                                                                sx={{ minWidth: 120, backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' }}
                                                            >
                                                                {(statsRowsSortedForSelector || []).slice(0, 100).map((r) => (
                                                                    <option key={String(r.key)} value={String(r.key)}>{r.key}</option>
                                                                ))}
                                                            </TextField>
                                                        )}
                                                    </Box>
                                                </Box>

                                                <Box sx={{ width: '100%', height: 280 }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart tooltipEventType="axis" data={selectedDailySeries} margin={{ top: 10, right: 16, left: 8, bottom: 10 }}>
                                                            <CartesianGrid stroke={alpha(theme.palette.text.primary, 0.06)} vertical={false} />
                                                            <XAxis type="category" dataKey="date" tick={{ fontSize: 12 }} interval={dailyTickInterval} tickFormatter={dailyTickFormatter} minTickGap={20} />
                                                            <YAxis tick={{ fontSize: 12 }} />
                                                            <RechartsTooltip
                                                                shared
                                                                isAnimationActive={false}
                                                                wrapperStyle={{ pointerEvents: 'none', willChange: 'transform', transition: 'transform 140ms ease-out' }}
                                                                content={KmByDayTooltip}
                                                            />
                                                            <Bar dataKey="km" radius={[6, 6, 0, 0]} isAnimationActive={false} fill={chartPrimaryLight} maxBarSize={56} minPointSize={statsShowEmptyDays ? 8 : 3} activeBar={false}>
                                                                {selectedDailySeries.map((entry, idx) => (
                                                                    <Cell
                                                                        key={`cell-day-2-${idx}`}
                                                                        fill={chartPrimaryLight}
                                                                        fillOpacity={entry.km > 0 ? 1 : 0}
                                                                        stroke={entry.km > 0 ? 'none' : 'transparent'}
                                                                    />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </Box>
                                            </>
                                        )}
                                    </Box>

                                    {chartSteps > 1 && (
                                        <>
                                            <Divider />
                                            <MobileStepper
                                                variant="dots"
                                                steps={chartSteps}
                                                position="static"
                                                activeStep={statsChartStep}
                                                backButton={
                                                    <Button size="small" onClick={() => setStatsChartStep((s) => Math.max(0, s - 1))} disabled={statsChartStep === 0} startIcon={<KeyboardArrowLeft />}>
                                                        Anterior
                                                    </Button>
                                                }
                                                nextButton={
                                                    <Button size="small" onClick={() => setStatsChartStep((s) => Math.min(chartSteps - 1, s + 1))} disabled={statsChartStep >= chartSteps - 1} endIcon={<KeyboardArrowRight />}>
                                                        Siguiente
                                                    </Button>
                                                }
                                                sx={{ backgroundColor: 'transparent' }}
                                            />
                                        </>
                                    )}
                                </Paper>
                            </Box>
                        )}
                    </Grid>
                </Grid>
                </Collapse>
            </Paper>

            {/* Historial: transferido desde RouteHistoryModal */}
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
                        <Autocomplete
                            size="small"
                            options={clients}
                            groupBy={(option) => option.group || ''}
                            getOptionLabel={(opt) => opt ? (opt.name || opt.nombre || opt.label || String(opt.id || opt.value || opt._id)) : ''}
                            value={selectedClient}
                            onChange={(e, newVal) => { setSelectedClient(newVal); setClientTouched(true); }}
                            isOptionEqualToValue={(option, value) => {
                                if (!value) return false;
                                return String(option.id) === String(value.id) && option.type === value.type;
                            }}
                            renderInput={(params) => (
                                <TextField {...params} label="Cliente (Todos/Colegios/Corporaciones)" variant="outlined" InputProps={{ ...params.InputProps, startAdornment: (<InputAdornment position="start"><SchoolIcon fontSize="small" color="action"/></InputAdornment>) }} sx={ clientTouched ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                            )}
                            renderOption={(props, option) => (
                                <li {...props} key={`${option.type}-${option.id || option.value || option._id}`}>
                                    {option.name || option.nombre || option.label}
                                </li>
                            )}
                                autoHighlight
                                selectOnFocus
                                clearOnEscape
                        />
                    </Grid>

                        <Grid item xs={12} md={3}>
                        <TextField size="small" variant="outlined" label="Estado" select fullWidth InputLabelProps={{ shrink: true }} SelectProps={{ native: true }} value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} sx={ statusFilter ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} }>
                            <option value="">Todos</option>
                            <option value="inprogress">En progreso</option>
                            <option value="completed">Completado</option>
                        </TextField>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <TextField
                            size="small"
                            variant="outlined"
                            label="Rango de fechas"
                            fullWidth
                            value={startDate && endDate ? `${startDate} — ${endDate}` : (startDate ? `${startDate} —` : (endDate ? `— ${endDate}` : ''))}
                            onClick={(e) => setDateAnchorEl(e.currentTarget)}
                            InputProps={{ readOnly: true, startAdornment: (<InputAdornment position="start"><CalendarToday fontSize="small" color="action"/></InputAdornment>) }}
                            sx={ (startDate || endDate) ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} }
                        />
                        <Popover
                            open={Boolean(dateAnchorEl)}
                            anchorEl={dateAnchorEl}
                            onClose={() => setDateAnchorEl(null)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                            <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center', minWidth: 360 }}>
                                <TextField
                                    size="small"
                                    label="Fecha inicio"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1 }}
                                />
                                <TextField
                                    size="small"
                                    label="Fecha fin"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1 }}
                                />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                                <Button size="small" onClick={() => { setStartDate(''); setEndDate(''); setDateAnchorEl(null); setPage(1); }}>Limpiar</Button>
                                <Button size="small" variant="contained" onClick={() => { setDateAnchorEl(null); setPage(1); }} sx={{ ml: 1 }}>Aplicar</Button>
                            </Box>
                        </Popover>
                    </Grid>

                    <Grid item xs={12} md={1}>
                        <FormControlLabel
                            control={<Checkbox checked={onlyFailures} onChange={(e)=>setOnlyFailures(e.target.checked)} />}
                            label="Solo fallas"
                            sx={{ '& .MuiFormControlLabel-label': { whiteSpace: 'nowrap' } }}
                        />
                    </Grid>

                    <Grid item xs={12} md={12}>
                        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2 }}>
                            <Box>
                                <Button size="small" startIcon={<ExpandMoreIcon sx={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }} />} onClick={()=>setShowAdvanced(s=>!s)}>MÁS FILTROS</Button>
                            </Box>
                            <Box sx={{ display:'flex', gap:1 }}>
                                        <Button size="small" variant="outlined" color="inherit" startIcon={<ClearIcon />} onClick={() => { setStartDate(''); setEndDate(''); setPilotoFilter(''); setBusFilter(''); setPilotSelected(null); setBusSelected(null); setRouteNumber(''); setRouteSelected(null); /* preserve selectedClient for comparison */ setOnlyFailures(false); setStatusFilter(''); setStartHour(''); setEndHour(''); setPage(1); }}>LIMPIAR</Button>
                                <Button size="small" variant="contained" color="primary" startIcon={<SearchIcon />} onClick={() => { setPage(1); fetchRouteHistory({ startDate: startDate||undefined, endDate: endDate||undefined, pilotoName: pilotoFilter||undefined, busPlaca: busFilter||undefined, onlyFailures: onlyFailures?'1':undefined, status: statusFilter||undefined, startHour: startHour||undefined, endHour: endHour||undefined, page: 1 }); }}>APLICAR FILTROS</Button>
                            </Box>
                        </Box>
                    </Grid>

                            
                    

                    <Grid item xs={12}>
                        <Collapse in={showAdvanced} timeout="auto" unmountOnExit>
                            <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={6} md={2}>
                                    <Autocomplete
                                        size="small"
                                        options={availablePilots}
                                        getOptionLabel={(opt) => opt ? (opt.name || '') : ''}
                                        value={pilotSelected}
                                        inputValue={pilotInput}
                                        onInputChange={(e, v) => setPilotInput(v)}
                                        onChange={(e, newVal) => { setPilotSelected(newVal); setPilotoFilter(newVal ? newVal.name : ''); }}
                                        loading={loadingPilots}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Piloto" placeholder="Nombre piloto" fullWidth InputProps={{ ...params.InputProps, startAdornment:(<InputAdornment position="start"><Person fontSize="small" color="action"/></InputAdornment>), endAdornment: (loadingPilots ? <CircularProgress color="inherit" size={16} /> : params.InputProps.endAdornment) }} sx={ pilotoFilter ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>
                                        <Grid item xs={12} sm={6} md={2}>
                                    <Autocomplete
                                        size="small"
                                        options={availableRoutesList}
                                        getOptionLabel={(opt) => opt ? (opt.number || String(opt)) : ''}
                                        value={routeSelected}
                                        onChange={(e, newVal) => { setRouteSelected(newVal); setRouteNumber(newVal ? (newVal.number || String(newVal)) : ''); }}
                                        loading={loadingRoutes}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Número de ruta" placeholder="Número de ruta" fullWidth InputProps={{ ...params.InputProps, startAdornment: (<InputAdornment position="start"><Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>#</Box></InputAdornment>), endAdornment: (loadingRoutes ? <CircularProgress color="inherit" size={16} /> : params.InputProps.endAdornment) }} sx={ routeNumber ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    <Autocomplete
                                        size="small"
                                        options={availableBuses}
                                        getOptionLabel={(opt) => opt ? (opt.placa || '') : ''}
                                        value={busSelected}
                                        inputValue={busInput}
                                        onInputChange={(e, v) => setBusInput(v)}
                                        onChange={(e, newVal) => { setBusSelected(newVal); setBusFilter(newVal ? newVal.placa : ''); }}
                                        loading={loadingBuses}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Bus (Placa)" placeholder="Placa" fullWidth InputProps={{ ...params.InputProps, startAdornment:(<InputAdornment position="start"><DirectionsBus fontSize="small" color="action"/></InputAdornment>), endAdornment: (loadingBuses ? <CircularProgress color="inherit" size={16} /> : params.InputProps.endAdornment) }} sx={ busFilter ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField size="small" label="Hora inicio" type="time" fullWidth InputLabelProps={{ shrink:true }} value={startHour} onChange={(e)=>setStartHour(e.target.value)} sx={ startHour ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField size="small" label="Hora fin" type="time" fullWidth InputLabelProps={{ shrink:true }} value={endHour} onChange={(e)=>setEndHour(e.target.value)} sx={ endHour ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                </Grid>
                            </Grid>
                        </Collapse>
                    </Grid>

                    <Grid item xs={12}>
                        {/* Content area */}
                        {loading && (!routes || routes.length === 0) ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, minHeight: contentMinHeight }}>
                                <CircularProgress />
                            </Box>
                        ) : error ? (
                            <Alert severity="error" sx={{ mb: 2, minHeight: contentMinHeight }}>{error}</Alert>
                        ) : (!routes || routes.length === 0) ? (
                            <Box sx={{ textAlign: 'center', py: 4, minHeight: contentMinHeight }}>
                                <DirectionsBus sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                                <Typography variant="h6" color="textSecondary">No hay historial de rutas disponible</Typography>
                                <Typography variant="body2" color="textSecondary">Esta ruta aún no ha sido utilizada</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ position: 'relative', minHeight: contentMinHeight }}>
                                {isMobile ? (
                                    <Grid container spacing={2}>
                                        {routes.map((route, index) => (
                                            <Grid item xs={12} key={route.id || index}>
                                                <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: route.reporteFalla ? '4px solid #f44336' : '4px solid #4caf50', transition: 'all 0.3s', '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' } }}>
                                                    <CardContent>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <DirectionsBus color="primary" />
                                                                <Typography variant="h6" fontWeight="bold">{route.placa || 'Sin placa'}</Typography>
                                                            </Box>
                                                            <Chip icon={route.reporteFalla ? <Warning /> : <CheckCircle />} label={route.reporteFalla ? 'Con falla' : 'Sin falla'} color={route.reporteFalla ? 'error' : 'success'} size="small" />
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                            <Typography variant="body2" color="textSecondary">Ruta:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.routeNumber || route.number || '—'}</Typography>
                                                        </Box>

                                                        <Divider sx={{ mb: 2 }} />

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <Person color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Piloto:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.piloto || 'N/A'}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <SchoolIcon color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Cliente:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.colegio || 'N/A'}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <AccessTime color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Hora inicio:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{formatTime(route.startTime)}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <AccessTime color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Hora fin:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.endTime ? formatTime(route.endTime) : 'En progreso'}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <AccessTime color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Duración:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{formatDuration(route.startTime, route.endTime)}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Speed color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Kilometraje:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.kilometraje ? `${parseFloat(route.kilometraje).toFixed(2)} km` : '0.00 km'}</Typography>
                                                        </Box>

                                                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                                            <Typography variant="caption" color="textSecondary">Registrado el {new Date(route.createdAt).toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })}</Typography>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                ) : (
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Fecha</TableCell>
                                                    <TableCell align="center">Número de ruta</TableCell>
                                                    <TableCell>Placa</TableCell>
                                                    <TableCell>Piloto</TableCell>
                                                    <TableCell>Cliente</TableCell>
                                                    <TableCell>Hora inicio</TableCell>
                                                    <TableCell>Hora fin</TableCell>
                                                    <TableCell>Duración</TableCell>
                                                    <TableCell>Kilometraje</TableCell>
                                                    <TableCell>Estado</TableCell>
                                                    {/* Acciones removidas: vista solo lectura */}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {routes.map((route, idx) => (
                                                    <TableRow key={route.id || idx} hover>
                                                        <TableCell>{new Date(route.createdAt).toLocaleDateString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                                                        <TableCell align="center">{route.routeNumber || route.number || '—'}</TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <DirectionsBus fontSize="small" />
                                                                <Typography variant="body2">{route.placa || 'Sin placa'}</Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>{route.piloto || 'N/A'}</TableCell>
                                                        <TableCell>{route.colegio || 'N/A'}</TableCell>
                                                        <TableCell>{formatTime(route.startTime)}</TableCell>
                                                        <TableCell>{route.endTime ? formatTime(route.endTime) : 'En progreso'}</TableCell>
                                                        <TableCell>{formatDuration(route.startTime, route.endTime)}</TableCell>
                                                        <TableCell>{route.kilometraje ? `${parseFloat(route.kilometraje).toFixed(2)} km` : '0.00 km'}</TableCell>
                                                        <TableCell>
                                                            <Chip icon={route.reporteFalla ? <Warning /> : <CheckCircle />} label={route.reporteFalla ? 'Con falla' : 'Sin falla'} color={route.reporteFalla ? 'error' : 'success'} size="small" />
                                                        </TableCell>
                                                        {/* Acciones removidas: no hay botones en historial */}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}

                                {loading && (
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }}>
                                        <CircularProgress />
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Grid>

                    <Grid item xs={12}>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap' }}>
                            <Box sx={{ width: 56 }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflowX: 'auto' }}>
                                <Pagination count={Math.max(1, Math.ceil((total || 0) / pageSize))} page={page} onChange={(e, p) => { setPage(p); fetchRouteHistory({ startDate: startDate || undefined, endDate: endDate || undefined, pilotoName: pilotoFilter || undefined, busPlaca: busFilter || undefined, onlyFailures: onlyFailures ? '1' : undefined, status: statusFilter || undefined, startHour: startHour || undefined, endHour: endHour || undefined, page: p }); }} color="primary" />
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default RouteHistoryPage;
