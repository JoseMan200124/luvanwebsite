// src/pages/RouteHistoryPage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    Tooltip,
    Paper,
    Grid,
    TextField,
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
    KeyboardArrowLeft,
    KeyboardArrowRight
} from '@mui/icons-material';
// RouteIcon removed; using a simple numeral adornment for route number filter
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F, toRouteOptions } from '../components/filters/filterFields';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, LabelList, CartesianGrid } from 'recharts';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';

const RouteHistoryPage = () => {
    const [loading, setLoading] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [total, setTotal] = useState(0);
    const [clientBreakdown, setClientBreakdown] = useState({ colegios: 0, corporativos: 0 });

    // ---- Filtros del historial ----
    // Clientes del selector (según el ciclo que se está eligiendo) y números de ruta del cliente elegido
    const [historySchools, setHistorySchools] = useState([]);
    const [historyCorporations, setHistoryCorporations] = useState([]);
    const [availableRoutesList, setAvailableRoutesList] = useState([]);
    const routesCacheRef = React.useRef(new Map());
    const routeHistoryCacheRef = React.useRef(new Map());

    const historyDraftClientRef = React.useRef(null);
    const loadPilotOptions = useCallback(async (text) => {
        const client = historyDraftClientRef.current;
        const params = { limit: 50, query: text };
        if (client?.type === 'school') {
            params.schoolId = client.id;
        } else if (client?.type === 'corp') {
            params.corporationId = client.id;
        }
        const resp = await api.get('/users/pilots', { params });
        const pilots = Array.isArray(resp.data?.users) ? resp.data.users : (resp.data || []);
        return (Array.isArray(pilots) ? pilots : [])
            .map((p) => ({ value: String(p.id || p._id), label: p.name || p.fullName || p.nombre || '' }));
    }, []);
    const loadBusOptions = useCallback(async (text) => {
        const params = { limit: 50, query: text, includeDecommissioned: true };
        const resp = await api.get('/buses/simple', { params });
        const busesList = resp.data?.buses || resp.data || [];
        return (Array.isArray(busesList) ? busesList : [])
            .map((b) => ({ value: String(b.id || b._id), label: b.placa || b.plate || b.licensePlate || '' }));
    }, []);

    const historyFilters = useFilters({
        urlPrefix: 'h_',
        fields: [
            F.cycle(),
            F.client({ schools: historySchools, corporations: historyCorporations }),
            F.select('status', {
                label: 'Estado',
                width: 'sm',
                options: [{ value: 'inprogress', label: 'En progreso' }, { value: 'completed', label: 'Completado' }],
            }),
            F.dateRange('dates'),
            F.switch('onlyFailures', { label: 'Solo fallas' }),
            F.autocomplete('pilot', { label: 'Piloto', advanced: true, loadOptions: loadPilotOptions, dependsOn: 'client', requireParent: false }),
            F.route({ advanced: true, options: toRouteOptions(availableRoutesList.map((route) => route.number)) }),
            F.autocomplete('bus', { label: 'Placa', width: 'sm', advanced: true, loadOptions: loadBusOptions, dependsOn: 'client', requireParent: false }),
            F.timeRange('hours', { advanced: true }),
        ],
        onApplied: () => setPage(1),
    });
    const historyDraftClient = historyFilters.draft.client;
    const historyDraftCycle = historyFilters.draft.cycle;
    historyDraftClientRef.current = historyDraftClient;
    const historyAppliedCycle = historyFilters.applied.cycle;

    // Estadísticas
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(null);
    const [statsData, setStatsData] = useState(null);
    // Clientes y rutas de la barra de estadísticas (según el ciclo y el cliente que se están eligiendo)
    const [statsSchools, setStatsSchools] = useState([]);
    const [statsCorporations, setStatsCorporations] = useState([]);
    const [statsRoutes, setStatsRoutes] = useState([]);
    const [statsShowEmptyDays, setStatsShowEmptyDays] = useState(false);
    // Si se abre con estadísticas aplicadas en la URL (F5 o link), la sección arranca desplegada
    const [statsExpanded, setStatsExpanded] = useState(() => new URLSearchParams(window.location.search).has('s_client'));
    const [statsSelectedKey, setStatsSelectedKey] = useState('');
    const [statsChartStep, setStatsChartStep] = useState(0);
    const [statsLastLoadedGroupBy, setStatsLastLoadedGroupBy] = useState('');
    const [statsTopSortByKm, setStatsTopSortByKm] = useState(false);
    const [statsReportLoading, setStatsReportLoading] = useState(false);
    const [statsLastLoadedParams, setStatsLastLoadedParams] = useState(null);

    const getMonthRange = (monthStr) => {
        // monthStr: 'YYYY-MM'
        if (!monthStr) {
            return { start: undefined, end: undefined };
        }
        const [yyStr, mmStr] = monthStr.split('-');
        const yy = Number.parseInt(yyStr, 10);
        const mm = Number.parseInt(mmStr, 10);
        if (Number.isNaN(yy) || Number.isNaN(mm)) {
            return { start: undefined, end: undefined };
        }

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

    // ---- Filtros de estadísticas ----
    // Rango de un mes relativo al actual (0 = este mes, hasta hoy; -1 = mes anterior completo)
    const monthRangeFromNow = (offset) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + offset);
        const { start, end } = getMonthRange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        return { from: start || '', to: end || '' };
    };

    // La placa se busca entre todos los buses (mismo criterio que en el historial)
    const loadStatsBusOptions = useCallback(async (text) => {
        const resp = await api.get('/buses/simple', { params: { limit: 50, query: text, includeDecommissioned: true } });
        const busesList = resp.data?.buses || resp.data || [];
        return (Array.isArray(busesList) ? busesList : [])
            .map((b) => ({ value: String(b.id || b._id), label: b.placa || b.plate || b.licensePlate || '' }));
    }, []);

    const statsFilters = useFilters({
        urlPrefix: 's_',
        fields: [
            F.cycle(),
            F.client({ schools: statsSchools, corporations: statsCorporations }),
            F.route({ options: toRouteOptions(statsRoutes.map((route) => route.number)) }),
            F.autocomplete('bus', { label: 'Placa', width: 'sm', loadOptions: loadStatsBusOptions, dependsOn: 'client' }),
            F.dateRange('dates', { initial: () => monthRangeFromNow(0) }),
            F.toggle('groupBy', {
                label: 'Agrupar por',
                initial: 'route',
                options: [{ value: 'route', label: 'Ruta' }, { value: 'plate', label: 'Placa' }],
            }),
        ],
        presets: [
            { key: 'thisMonth', label: 'Este mes', values: () => ({ dates: monthRangeFromNow(0) }) },
            { key: 'lastMonth', label: 'Mes anterior', values: () => ({ dates: monthRangeFromNow(-1) }) },
        ],
        validate: (values) => (values.client ? null : 'Seleccione un cliente para cargar las estadísticas.'),
    });
    const statsApplied = statsFilters.applied;
    const statsDraftCycle = statsFilters.draft.cycle;
    const statsDraftClientType = statsFilters.draft.client?.type || '';
    const statsDraftClientId = statsFilters.draft.client?.id || '';

    // Parámetros del historial a partir de los filtros aplicados.
    const buildRouteHistoryParams = (values, pageNumber) => ({
        ...getCicloEscolarFilterParams(values.cycle),
        ...(values.client?.type === 'school' ? { schoolId: values.client.id } : {}),
        ...(values.client?.type === 'corp' ? { corporationId: values.client.id } : {}),
        routeNumber: values.client && values.route ? values.route : undefined,
        startDate: values.dates?.from || undefined,
        endDate: values.dates?.to || undefined,
        pilotoId: values.pilot?.value || undefined,
        busId: values.bus?.value || undefined,
        onlyFailures: values.onlyFailures ? '1' : undefined,
        status: values.status || undefined,
        startHour: values.hours?.from || undefined,
        endHour: values.hours?.to || undefined,
        page: pageNumber,
        pageSize,
    });

    const getRouteHistoryCacheKey = (params) => {
        const normalized = {
            ...params,
            page: Number(params.page || 1),
            pageSize: Number(params.pageSize || pageSize)
        };
        return JSON.stringify(normalized);
    };

    const fetchRouteHistory = async (params) => {
        const cacheKey = getRouteHistoryCacheKey(params);
        const cached = routeHistoryCacheRef.current.get(cacheKey);

        if (cached) {
            setRoutes(cached.routes || []);
            setTotal(cached.total || 0);
            setClientBreakdown(cached.clientBreakdown || { colegios: 0, corporativos: 0 });
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/transportistas/historial-rutas', { params });
            const responseData = response.data || {};
            const routesData = responseData.routes || [];
            const totalData = responseData.total || 0;

            const breakdownData = { colegios: Number(responseData.colegios || 0), corporativos: Number(responseData.corporativos || 0) };
            routeHistoryCacheRef.current.set(cacheKey, { routes: routesData, total: totalData, clientBreakdown: breakdownData });

            const currentPage = Number(params.page || 1);
            const nextPage = currentPage + 1;
            if (totalData > currentPage * pageSize) {
                const nextParams = { ...params, page: nextPage };
                const nextCacheKey = getRouteHistoryCacheKey(nextParams);
                if (!routeHistoryCacheRef.current.has(nextCacheKey)) {
                    api.get('/transportistas/historial-rutas', { params: nextParams })
                        .then((nextResponse) => {
                            const nextData = nextResponse.data || {};
                            routeHistoryCacheRef.current.set(nextCacheKey, {
                                routes: nextData.routes || [],
                                total: nextData.total || 0,
                                clientBreakdown: { colegios: Number(nextData.colegios || 0), corporativos: Number(nextData.corporativos || 0) }
                            });
                        })
                        .catch(() => {});
                }
            }

            setRoutes(routesData);
            setTotal(totalData);
            setClientBreakdown(breakdownData);
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
    const historyApplied = historyFilters.applied;
    useEffect(() => {
        fetchRouteHistory(buildRouteHistoryParams(historyApplied, page));
        // fetchRouteHistory se recrea en cada render; solo deben disparar los filtros aplicados y la página
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historyApplied, page]);

    // El refresco global vuelve a pedir la página actual con los filtros aplicados
    useRegisterPageRefresh(async () => {
        routeHistoryCacheRef.current.clear();
        await fetchRouteHistory(buildRouteHistoryParams(historyApplied, page));
    }, [historyApplied, page]);

    useEffect(() => {
        const loadClients = async () => {
            try {
                const [schoolsResp, corpsResp] = await Promise.all([
                    api.get('/schools', { params: { ...getCicloEscolarFilterParams(historyDraftCycle), includeArchived: true } }),
                    api.get('/corporations', { params: getCicloEscolarFilterParams(historyDraftCycle) })
                ]);
                const schoolsList = schoolsResp.data?.schools || schoolsResp.data || [];
                const corpsList = corpsResp.data?.corporations || corpsResp.data || [];
                setHistorySchools((Array.isArray(schoolsList) ? schoolsList : []).filter((item) => item && !item.deleted));
                setHistoryCorporations((Array.isArray(corpsList) ? corpsList : []).filter((item) => item && !item.deleted));
            } catch (err) {
                console.error('No se pudieron cargar los clientes (page):', err);
            }
        };
        loadClients();
    }, [historyDraftCycle]);

    useEffect(() => {
        const loadStatsClients = async () => {
            try {
                const [schoolsResp, corpsResp] = await Promise.all([
                    api.get('/schools', { params: { ...getCicloEscolarFilterParams(statsDraftCycle), includeArchived: true } }),
                    api.get('/corporations', { params: getCicloEscolarFilterParams(statsDraftCycle) })
                ]);
                const schoolsList = schoolsResp.data?.schools || schoolsResp.data || [];
                const corpsList = corpsResp.data?.corporations || corpsResp.data || [];
                setStatsSchools((Array.isArray(schoolsList) ? schoolsList : []).filter((item) => item && !item.deleted));
                setStatsCorporations((Array.isArray(corpsList) ? corpsList : []).filter((item) => item && !item.deleted));
            } catch (err) {
                console.error('No se pudieron cargar los clientes (stats):', err);
                setStatsSchools([]);
                setStatsCorporations([]);
            }
        };

        loadStatsClients();
    }, [statsDraftCycle]);

    const historyDraftClientType = historyDraftClient?.type || '';
    const historyDraftClientId = historyDraftClient?.id || '';
    useEffect(() => {
        if (!historyDraftClientId) {
            setAvailableRoutesList([]);
            return;
        }

        const cacheKey = `${historyDraftClientType}:${historyDraftClientId}`;
        if (routesCacheRef.current.has(cacheKey)) {
            setAvailableRoutesList(routesCacheRef.current.get(cacheKey));
            return;
        }

        const loadRoutes = async () => {
            try {
                const url = historyDraftClientType === 'corp'
                    ? `/routes/corporation/${historyDraftClientId}/numbers`
                    : `/routes/school/${historyDraftClientId}/numbers`;
                const resp = await api.get(url);
                const nums = resp.data?.routeNumbers || resp.data?.routes || resp.data || [];
                // Normalize to objects { number }
                const opts = (Array.isArray(nums) ? nums : []).map(n => (typeof n === 'object' ? ({ number: n.routeNumber }) : ({ number: String(n) })));
                routesCacheRef.current.set(cacheKey, opts);
                setAvailableRoutesList(opts);
            } catch (err) {
                console.error('Error loading route numbers:', err);
                setAvailableRoutesList([]);
            }
        };

        loadRoutes();
    }, [historyDraftClientType, historyDraftClientId]);

    // Números de ruta del cliente que se está eligiendo en estadísticas (independiente del historial)
    useEffect(() => {
        if (!statsDraftClientId) {
            setStatsRoutes([]);
            return;
        }

        const cacheKey = `${statsDraftCycle}:${statsDraftClientType}:${statsDraftClientId}`;
        if (routesCacheRef.current.has(cacheKey)) {
            setStatsRoutes(routesCacheRef.current.get(cacheKey));
            return;
        }

        const loadStatsRoutes = async () => {
            try {
                const params = getCicloEscolarFilterParams(statsDraftCycle);
                const url = statsDraftClientType === 'corp'
                    ? `/routes/corporation/${statsDraftClientId}/numbers`
                    : `/routes/school/${statsDraftClientId}/numbers`;

                const resp = await api.get(url, { params });
                const nums = resp.data?.routeNumbers || resp.data?.routes || resp.data || [];
                const opts = (Array.isArray(nums) ? nums : []).map((n) => {
                    if (typeof n === 'object' && n) {
                        const number = n.number ?? n.routeNumber ?? n.route ?? n.numero;
                        return { number: String(number ?? '') };
                    }
                    return { number: String(n) };
                }).filter((o) => o.number);

                routesCacheRef.current.set(cacheKey, opts);
                setStatsRoutes(opts);
            } catch (err) {
                console.error('Error loading route numbers (stats):', err);
                setStatsRoutes([]);
            }
        };

        loadStatsRoutes();
    }, [statsDraftCycle, statsDraftClientType, statsDraftClientId]);

    const formatTime = (dateTime) => {
        if (!dateTime) {
            return 'N/A';
        }
        const date = new Date(dateTime);
        return date.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (startTime, endTime) => {
        if (!startTime || !endTime) {
            return 'En progreso';
        }
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

    const overallActiveDaysFallback = useMemo(() => {
        const rows = statsData?.rows || [];
        if (!rows.length) {
            return 0;
        }
        const activeDates = new Set();
        for (const row of rows) {
            const series = row?.daily || [];
            for (const it of series) {
                const date = it?.date;
                const km = Number(it?.km) || 0;
                if (!date || km <= 0) {
                    continue;
                }
                activeDates.add(date);
            }
        }
        return activeDates.size;
    }, [statsData]);

    const overallActiveDaysDisplay = statsData?.overallActiveDays ?? overallActiveDaysFallback;

    // Mientras se recargan estadísticas tras cambiar agrupación, mantenemos labels consistentes
    // con la data actualmente mostrada (la última agrupación cargada).
    const statsEffectiveGroupBy = statsData ? (statsLastLoadedGroupBy || statsApplied.groupBy) : statsApplied.groupBy;

    const statsRowsSortedByKm = useMemo(() => {
        const rows = statsData?.rows || [];
        return rows
            .slice()
            .sort((a, b) => (Number.parseFloat(b?.totalKm || 0) - Number.parseFloat(a?.totalKm || 0)));
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
                if (aOk && bOk) {
                    return an - bn;
                }
                if (aOk && !bOk) {
                    return -1;
                }
                if (!aOk && bOk) {
                    return 1;
                }
            }

            return ak.localeCompare(bk);
        });
    }, [statsData, statsEffectiveGroupBy]);

    const topChartRows = useMemo(() => {
        const topByKm = statsRowsSortedByKm.slice(0, 10);
        if (statsTopSortByKm) {
            return topByKm;
        }

        const toStr = (v) => String(v ?? '');
        const cmp = (a, b) => {
            const ak = toStr(a?.key).trim();
            const bk = toStr(b?.key).trim();
            if (statsEffectiveGroupBy === 'route') {
                const an = Number.parseInt(ak, 10);
                const bn = Number.parseInt(bk, 10);
                const aOk = Number.isFinite(an);
                const bOk = Number.isFinite(bn);
                if (aOk && bOk) {
                    return an - bn;
                }
            }
            return ak.localeCompare(bk);
        };

        return topByKm.slice().sort(cmp);
    }, [statsRowsSortedByKm, statsTopSortByKm, statsEffectiveGroupBy]);

    const statsTopKeyByKm = statsRowsSortedByKm?.[0]?.key ?? '';

    const loadStats = async (values) => {
        setStatsError(null);
        try {
            setStatsLoading(true);
            const groupByToUse = values.groupBy || 'route';
            if (groupByToUse !== statsLastLoadedGroupBy) {
                setStatsSelectedKey('');
                setStatsChartStep(0);
            }

            const fallbackRange = monthRangeFromNow(0);
            const params = {
                ...getCicloEscolarFilterParams(values.cycle),
                ...(values.client?.type === 'corp' ? { corporationId: values.client.id } : { schoolId: values.client?.id }),
                startDate: values.dates?.from || (values.dates?.to ? undefined : fallbackRange.from),
                endDate: values.dates?.to || (values.dates?.from ? undefined : fallbackRange.to),
                groupBy: groupByToUse,
                routeNumber: values.route || undefined,
                plate: values.bus?.label || undefined,
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
            setStatsLastLoadedGroupBy(groupByToUse);
            setStatsLastLoadedParams(params);
        } catch (err) {
            console.error('Error cargando estadísticas:', err);
            setStatsError(err.response?.data?.message || err.message || 'No se pudieron cargar las estadísticas');
        } finally {
            setStatsLoading(false);
        }
    };

    // Estadísticas: se cargan al aplicar filtros con un cliente.
    useEffect(() => {
        if (statsApplied.client) {
            loadStats(statsApplied);
            return;
        }
        setStatsData(null);
        setStatsError(null);
        setStatsLastLoadedParams(null);
        setStatsLastLoadedGroupBy('');
        setStatsSelectedKey('');
        setStatsChartStep(0);
    }, [statsApplied]);

    const downloadStatsPdfReport = async () => {
        if (!statsLastLoadedParams || !statsData) {
            return;
        }
        setStatsError(null);
        try {
            setStatsReportLoading(true);
            const groupByToUse = statsLastLoadedParams.groupBy || statsLastLoadedGroupBy || 'route';

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
        if (statsSelectedKey && keys.has(String(statsSelectedKey))) {
            return;
        }
        setStatsSelectedKey(String((statsRowsSortedByKm[0] || statsData.rows[0]).key));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statsData, statsRowsSortedByKm]);

    const selectedGroupRow = useMemo(() => {
        const rows = statsData?.rows || [];
        if (!rows.length) {
            return null;
        }
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
        if (statsShowEmptyDays) {
            return selectedDailySeriesRaw;
        }
        return selectedDailySeriesRaw.filter((it) => it.km > 0);
    }, [selectedDailySeriesRaw, statsShowEmptyDays]);

    const dailyTickInterval = useMemo(() => {
        const n = selectedDailySeries.length;
        if (n <= 1) {
            return 0;
        }

        // Target a bounded number of visible ticks.
        // When showing empty days, the series grows a lot, so be more aggressive.
        const desiredTicks = statsShowEmptyDays ? 10 : 16;
        if (n <= desiredTicks) {
            return 0;
        }

        // Recharts shows every (interval + 1) tick.
        const interval = Math.ceil(n / desiredTicks) - 1;
        return Math.max(1, interval);
    }, [selectedDailySeries.length, statsShowEmptyDays]);

    const dailyTickFormatter = (value) => {
        const s = String(value || '');
        // YYYY-MM-DD -> MM-DD
        if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
            return s.slice(5, 10);
        }
        return s;
    };

    const formatKmForTooltip = (value) => {
        const num = Number(value) || 0;
        if (num > 0 && num < 0.01) {
            return `${num.toFixed(4)} km`;
        }
        if (num > 0 && num < 0.1) {
            return `${num.toFixed(3)} km`;
        }
        return `${num.toFixed(2)} km`;
    };

    const KmByDayTooltip = useCallback(({ active, label, payload }) => {
        if (!active || !Array.isArray(payload) || payload.length === 0) {
            return null;
        }

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
        if (!active || !Array.isArray(payload) || payload.length === 0) {
            return null;
        }

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
                                            <Typography variant="h4" sx={{ letterSpacing: -0.5 }} noWrap>{statsData ? `${Number.parseFloat(statsData.totalKm || 0).toFixed(2)} km` : '-'}</Typography>
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
                                            <Typography variant="h4" sx={{ letterSpacing: -0.5 }} noWrap>{statsData ? `${Number.parseFloat(statsData.overallAvgPerActiveDay || ((statsData.totalKm || 0) / Math.max(1, statsData.daysCount))).toFixed(2)} km` : '-'}</Typography>
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

                    {/* Filtros de estadísticas */}
                    <Grid item xs={12}>
                        {statsData && hasStatsResults && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
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
                            </Box>
                        )}
                        <FilterBar {...statsFilters.barProps} loading={statsLoading} />
                    </Grid>
                    <Grid item xs={12}>
                        {statsError && <Alert severity="error">{statsError}</Alert>}
                        {!statsData && !statsLoading && !statsError && statsFilters.draft.client && <Typography variant="body2" color="textSecondary">Presione "Aplicar filtros" para cargar las estadísticas.</Typography>}
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
                                                                        <LabelList dataKey="km" position="right" offset={10} formatter={(v) => `${Number.parseFloat(v).toFixed(2)} km`} style={{ pointerEvents: 'none' }} />
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
                <FilterBar
                    {...historyFilters.barProps}
                    loading={loading}
                    caption={historyAppliedCycle && historyAppliedCycle !== ALL_CYCLES_VALUE
                        ? 'Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.'
                        : undefined}
                />
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {total} recorridos: {clientBreakdown.colegios} de colegios · {clientBreakdown.corporativos} corporativos
                </Typography>
                <Grid container spacing={2} alignItems="center">

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
                                                            <Typography variant="body2" fontWeight="medium">{route.kilometraje ? `${Number.parseFloat(route.kilometraje).toFixed(2)} km` : '0.00 km'}</Typography>
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
                                                        <TableCell>{route.kilometraje ? `${Number.parseFloat(route.kilometraje).toFixed(2)} km` : '0.00 km'}</TableCell>
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
                                <Pagination count={Math.max(1, Math.ceil((total || 0) / pageSize))} page={page} onChange={(e, p) => setPage(p)} color="primary" />
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default RouteHistoryPage;
