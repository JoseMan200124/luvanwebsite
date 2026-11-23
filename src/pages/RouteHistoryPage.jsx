// src/pages/RouteHistoryPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Button,
    Chip,
    Card,
    CardContent,
    Divider,
    CircularProgress,
    Pagination,
    Alert,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    useTheme,
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
    PictureAsPdf,
    School as SchoolIcon
} from '@mui/icons-material';
import api from '../utils/axiosConfig';
import { downloadBlob, readBlobError } from '../utils/download';
import { buildFileName } from '../utils/fileName';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F, toRouteOptions } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import useIsMobile from '../hooks/useIsMobile';
import { formatTime, formatDateLong, formatDate } from '../utils/dateFormat';
import { loadCatalog } from '../services/catalogStore';
import { StatCard, StatCardGrid } from '../components/StatCard';

const RouteHistoryPage = () => {
    const [loading, setLoading] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [total, setTotal] = useState(0);
    const [clientBreakdown, setClientBreakdown] = useState({ colegios: 0, corporativos: 0 });
    // Resumen de kilometraje del conjunto filtrado completo (no solo la página)
    const [resumen, setResumen] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState(null);

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

    // Rango de un mes relativo al actual (0 = este mes, hasta hoy; -1 = mes anterior completo)
    const monthRangeFromNow = (offset) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + offset);
        const { start, end } = getMonthRange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        return { from: start || '', to: end || '' };
    };

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
            F.toggle('groupBy', {
                label: 'Agrupar estadísticas por',
                initial: 'route',
                options: [{ value: 'route', label: 'Ruta' }, { value: 'plate', label: 'Placa' }],
            }),
        ],
        presets: [
            { key: 'thisMonth', label: 'Este mes', values: () => ({ dates: monthRangeFromNow(0) }) },
            { key: 'lastMonth', label: 'Mes anterior', values: () => ({ dates: monthRangeFromNow(-1) }) },
        ],
        onApplied: () => setPage(1),
    });
    const historyDraftClient = historyFilters.draft.client;
    const historyDraftCycle = historyFilters.draft.cycle;
    historyDraftClientRef.current = historyDraftClient;
    const historyAppliedCycle = historyFilters.applied.cycle;

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
        groupBy: values.groupBy || 'route',
        // El resumen abarca todo el conjunto filtrado: no cambia al paginar, basta pedirlo en la página 1
        includeResumen: pageNumber === 1 ? '1' : undefined,
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
            // Si la petición pidió resumen, se refleja lo que llegó (también vacío); si no, se conserva el actual
            if (params.includeResumen) {
                setResumen(cached.resumen || null);
            }
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
            routeHistoryCacheRef.current.set(cacheKey, { routes: routesData, total: totalData, clientBreakdown: breakdownData, resumen: responseData.resumen || null });

            const currentPage = Number(params.page || 1);
            const nextPage = currentPage + 1;
            if (totalData > currentPage * pageSize) {
                // Sin resumen: no cambia al paginar, y así la clave coincide con la de la petición real de esa página
                const nextParams = { ...params, page: nextPage, includeResumen: undefined };
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
            if (params.includeResumen) {
                setResumen(responseData.resumen || null);
            }
        } catch (err) {
            console.error('Error fetching route history (page):', err);
            // Sin datos nuevos, las tarjetas no deben seguir mostrando cifras de otro filtro
            setResumen(null);
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
        // El resumen se pide siempre al refrescar, también desde la página 2 en adelante
        await fetchRouteHistory({ ...buildRouteHistoryParams(historyApplied, page), includeResumen: '1' });
    }, [historyApplied, page]);

    useEffect(() => {
        const loadClients = async () => {
            try {
                const [schoolsList, corpsList] = await Promise.all([
                    loadCatalog('schools', { ...getCicloEscolarFilterParams(historyDraftCycle), includeArchived: true }),
                    loadCatalog('corporations', getCicloEscolarFilterParams(historyDraftCycle))
                ]);
                setHistorySchools((Array.isArray(schoolsList) ? schoolsList : []).filter((item) => item && !item.deleted));
                setHistoryCorporations((Array.isArray(corpsList) ? corpsList : []).filter((item) => item && !item.deleted));
            } catch (err) {
                console.error('No se pudieron cargar los clientes (page):', err);
            }
        };
        loadClients();
    }, [historyDraftCycle]);

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
    const isMobile = useIsMobile();

    const softPrimaryBg = alpha(theme.palette.primary.main, 0.04);
    // El PDF usa el endpoint de estadísticas con los mismos filtros que el historial
    const downloadStatsPdfReport = async () => {
        const fallbackRange = monthRangeFromNow(0);
        const params = {
            ...getCicloEscolarFilterParams(historyApplied.cycle),
            ...(historyApplied.client?.type === 'corp' ? { corporationId: historyApplied.client.id } : {}),
            ...(historyApplied.client?.type === 'school' ? { schoolId: historyApplied.client.id } : {}),
            startDate: historyApplied.dates?.from || (historyApplied.dates?.to ? undefined : fallbackRange.from),
            endDate: historyApplied.dates?.to || (historyApplied.dates?.from ? undefined : fallbackRange.to),
            groupBy: historyApplied.groupBy || 'route',
            routeNumber: historyApplied.client && historyApplied.route ? historyApplied.route : undefined,
            plate: historyApplied.bus?.label || undefined,
            busId: historyApplied.bus?.value || undefined,
            pilotoId: historyApplied.pilot?.value || undefined,
            status: historyApplied.status || undefined,
            onlyFailures: historyApplied.onlyFailures ? '1' : undefined,
            startHour: historyApplied.hours?.from || undefined,
            endHour: historyApplied.hours?.to || undefined,
        };
        setPdfError(null);
        try {
            setPdfLoading(true);
            const resp = await api.get('/transportistas/estadisticas-kilometros/reporte', { params, responseType: 'blob' });

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
                setPdfError(message);
                return;
            }

            // Validate PDF magic header
            const headerBuf = await blob.slice(0, 5).arrayBuffer();
            const header = new TextDecoder('utf-8').decode(headerBuf);
            if (header !== '%PDF-') {
                const txt = await blob.text();
                setPdfError((txt || 'El archivo recibido no es un PDF válido.').slice(0, 240));
                return;
            }

            const start = params.startDate || '';
            const end = params.endDate || '';
            const safeStart = start ? String(start).replace(/[^0-9-]/g, '_') : 'sin-inicio';
            const safeEnd = end ? String(end).replace(/[^0-9-]/g, '_') : 'sin-fin';
            // El nombre lleva el rango del reporte en lugar del día de descarga.
            downloadBlob(blob, buildFileName({ object: `reporte kilometros ${params.groupBy}`, date: `${safeStart}_${safeEnd}`, extension: 'pdf' }));
        } catch (err) {
            console.error('Error generando PDF:', err);
            const error = await readBlobError(err);
            setPdfError(error.response?.data?.message || error.message || 'No se pudo generar el PDF');
        } finally {
            setPdfLoading(false);
        }
    };
    // Separador de miles (es-GT: 59,797.59) en las cifras de las tarjetas
    const formatNumber = (value, decimals = 0) => Number(value || 0).toLocaleString('es-GT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    // Rango que usa el PDF cuando no hay fechas (sin límite recorrería desde 1970); se avisa junto al botón
    const pdfFallbackRange = monthRangeFromNow(0);
    const formatKmSummary = (value) => `${formatNumber(value, 2)} km`;
    const groupLabel = resumen?.groupBy === 'plate' ? 'placa' : 'ruta';
    const kpiCards = [
        ...(resumen && resumen.groupsCount > 1 ? [{
            key: 'count',
            label: groupLabel === 'placa' ? 'Placas' : 'Rutas',
            value: formatNumber(resumen.groupsCount),
            hint: `Cantidad de ${groupLabel === 'placa' ? 'placas' : 'rutas'} en el conjunto filtrado`,
            icon: <CheckCircle />,
        }] : []),
        {
            key: 'total',
            label: 'Total kilómetros',
            value: resumen ? formatKmSummary(resumen.totalKm) : '-',
            hint: 'Kilómetros de los recorridos terminados que cumplen los filtros',
            icon: <Speed />,
        },
        {
            key: 'avg',
            label: 'Km promedio/día',
            value: resumen ? formatKmSummary(resumen.avgPerActiveDay) : '-',
            hint: 'Promedio por día activo (día con recorridos)',
            chip: resumen ? `Días activos: ${formatNumber(resumen.activeDays)}` : undefined,
            icon: <CalendarToday />,
        },
        ...(resumen && resumen.groupsCount > 1 && resumen.top ? [{
            key: 'top',
            label: `Top ${groupLabel === 'placa' ? 'Placa' : 'Ruta'}`,
            // Igual que en el PDF: la ruta lleva su cliente ("18 · Colegio"); la placa va sola
            value: groupLabel === 'ruta' && resumen.top.clientName ? `${resumen.top.key} · ${resumen.top.clientName}` : resumen.top.key,
            hint: `${groupLabel === 'placa' ? 'Placa' : 'Ruta'} con mayor kilometraje (${formatKmSummary(resumen.top.totalKm)})`,
            icon: <DirectionsBus />,
        }] : []),
    ];

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.buses}
                title="Historial de Recorridos de Rutas"
            />

            {/* Filtros únicos: aplican al resumen de kilometraje y al listado */}
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FilterBar
                    {...historyFilters.barProps}
                    loading={loading}
                    caption={historyAppliedCycle && historyAppliedCycle !== ALL_CYCLES_VALUE
                        ? 'Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.'
                        : undefined}
                />
                {/* Resumen de kilometraje del conjunto filtrado */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mt: 2, mb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Resumen de kilometraje</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    {!historyApplied.client && (
                        <Typography variant="body2" color="textSecondary">Seleccione un cliente y aplique los filtros para generar el PDF.</Typography>
                    )}
                    {historyApplied.client && !historyApplied.dates?.from && !historyApplied.dates?.to && (
                        <Typography variant="body2" color="textSecondary">
                            Sin fechas, el PDF abarca el mes actual ({pdfFallbackRange.from} a {pdfFallbackRange.to}), no todo el historial.
                        </Typography>
                    )}
                    <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        onClick={downloadStatsPdfReport}
                        disabled={pdfLoading || loading || !resumen || !historyApplied.client}
                        startIcon={pdfLoading ? <CircularProgress size={16} /> : <PictureAsPdf fontSize="small" />}
                        sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                        Generar PDF
                    </Button>
                    </Box>
                </Box>
                {pdfError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setPdfError(null)}>{pdfError}</Alert>}
                <StatCardGrid columns={kpiCards.length} sx={{ mb: 2 }}>
                    {kpiCards.map((kpi) => (
                        <StatCard
                            key={kpi.key}
                            label={kpi.label}
                            value={kpi.value}
                            icon={kpi.icon}
                            hint={(
                                <>
                                    {kpi.hint}
                                    {kpi.chip && (
                                        <Box sx={{ mt: 0.75 }}>
                                            <Chip size="small" color="primary" variant="outlined" label={kpi.chip} sx={{ backgroundColor: softPrimaryBg }} />
                                        </Box>
                                    )}
                                </>
                            )}
                        />
                    ))}
                </StatCardGrid>
                <Divider sx={{ mb: 2 }} />
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
                                                            <Typography variant="caption" color="textSecondary">Registrado el {formatDateLong(route.createdAt)}</Typography>
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
                                                        <TableCell>{formatDate(route.createdAt)}</TableCell>
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
        </PageContainer>
    );
};

export default RouteHistoryPage;
