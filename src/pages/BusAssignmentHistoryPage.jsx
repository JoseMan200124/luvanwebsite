import React, { useState, useEffect, useContext } from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Alert,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Typography
} from '@mui/material';
import {
    DirectionsBus as BusIcon,
    Person as PersonIcon,
    Face as FaceIcon,
    School as SchoolIcon,
    Business as BusinessIcon,
} from '@mui/icons-material';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import moment from 'moment-timezone';
import { getClientSchoolId, getClientCorporationId } from '../utils/clientValue';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';

moment.tz.setDefault('America/Guatemala');

const formatGuatemalaDatetime = (dateString) => {
    if (!dateString) {
        return '—';
    }
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY, hh:mm a');
};

const safeParseJson = (v) => {
    if (!v) {
        return {};
    }
    if (typeof v === 'object') {
        return v;
    }
    try {
        const parsed = JSON.parse(v);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
};

/** Helper: "Colegio X — Ruta 5" or just the client name, or just "Ruta 5" */
const clientRouteLabel = (o) => {
    if (!o || Object.keys(o).length === 0) {
        return null;
    }
    const client = o.schoolName || o.corporationName || null;
    const route = o.routeNumber ? `Ruta ${o.routeNumber}` : null;
    if (client && route) {
        return `${client} \u2014 ${route}`;
    }
    return client || route || null;
};

/** Maps for stats rendering */
const STATS_CONFIG = {
    assignment: { icon: '✅', label: 'asignaciones', color: 'success' },
    unassignment: { icon: '❌', label: 'desasignaciones', color: 'error' },
    reassignment: { icon: '🔄', label: 'reasignaciones', color: 'warning' },
};

/** Icon map for assignment types */
const ASSIGNMENT_ICONS = {
    bus_plate: BusIcon,
    bus_pilot: PersonIcon,
    bus_monitora: FaceIcon,
    bus_school: SchoolIcon,
    bus_corporation: BusinessIcon,
};

/** Narrative: bus_pilot changes */
const narrativePilot = (prev, next, plate, ctype) => {
    if (ctype === 'assignment') {
        return `Se asignó ${next.pilotName} como piloto al bus ${plate}`;
    }
    if (ctype === 'unassignment') {
        return `Se retiró al piloto ${prev.pilotName} del bus ${plate}`;
    }
    if (ctype === 'reassignment') {
        return `Cambio de piloto: ${prev.pilotName} → ${next.pilotName} en bus ${plate}`;
    }
    return '';
};

/** Narrative: bus_monitora changes */
const narrativeMonitora = (prev, next, plate, ctype) => {
    if (ctype === 'assignment') {
        return `Se asignó ${next.monitoraName} como monitora al bus ${plate}`;
    }
    if (ctype === 'unassignment') {
        return `Se retiró a la monitora ${prev.monitoraName} del bus ${plate}`;
    }
    if (ctype === 'reassignment') {
        return `Cambio de monitora: ${prev.monitoraName} → ${next.monitoraName} en bus ${plate}`;
    }
    return '';
};

/** Narrative: bus_school / bus_corporation changes */
const narrativeClient = (prev, next, plate, ctype, atype, routeNumber) => {
    const prevLabel = clientRouteLabel(Object.keys(prev).length ? prev : null);
    const nextLabel = clientRouteLabel(Object.keys(next).length ? next : null);
    const isSwap = prev.busPlate && next.busPlate && prev.busPlate !== next.busPlate && prevLabel === nextLabel;
    if (isSwap) {
        const location = prevLabel || 'ruta ' + (routeNumber || '?');
        if (ctype === 'reassignment') {
            return `Cambio de bus: ${prev.busPlate} → ${next.busPlate} en ${location}`;
        }
        if (ctype === 'assignment') {
            return `Se asignó el bus ${next.busPlate} a ${nextLabel}`;
        }
        if (ctype === 'unassignment') {
            return `Se retiró el bus ${prev.busPlate} de ${prevLabel}`;
        }
    }
    if (ctype === 'assignment') {
        return `Se asignó el bus ${plate} a ${nextLabel}`;
    }
    if (ctype === 'unassignment') {
        return `El bus ${plate} ya no está asignado a ${prevLabel}`;
    }
    if (ctype === 'reassignment') {
        return `El bus ${plate} cambió: ${prevLabel} → ${nextLabel}`;
    }
    return '';
};

/** Narrative: bus_plate changes */
const narrativePlate = (prev, next, ctype) => {
    if (ctype === 'reassignment') {
        return `Cambio de placa: ${prev.busPlate || '?'} → ${next.busPlate || '?'}`;
    }
    if (ctype === 'assignment') {
        return `Se registró el bus ${next.busPlate || '?'}`;
    }
    if (ctype === 'unassignment') {
        return `Se dio de baja el bus ${prev.busPlate || '?'}`;
    }
    return '';
};

/** Build a human-readable narrative description of the change */
const buildNarrative = (record) => {
    const prev = safeParseJson(record.previousValue);
    const next = safeParseJson(record.newValue);
    const plate = prev.busPlate || next.busPlate || record.bus?.plate || record.busId || '?';
    const ctype = record.changeType;
    const atype = record.assignmentType;

    if (atype === 'bus_pilot') {
        return narrativePilot(prev, next, plate, ctype);
    }
    if (atype === 'bus_monitora') {
        return narrativeMonitora(prev, next, plate, ctype);
    }
    if (atype === 'bus_school' || atype === 'bus_corporation') {
        return narrativeClient(prev, next, plate, ctype, atype, record.routeNumber);
    }
    if (atype === 'bus_plate') {
        return narrativePlate(prev, next, ctype);
    }
    return '';
};

const ASSIGNMENT_TYPE_LABELS = {
    bus_plate: 'Bus - Placa',
    bus_pilot: 'Bus - Piloto',
    bus_monitora: 'Bus - Monitora',
    bus_school: 'Bus - Colegio (con Ruta)',
    bus_corporation: 'Bus - Corporación (con Ruta)',
};

const CHANGE_TYPE_LABELS = {
    assignment: 'Asignación',
    unassignment: 'Desasignación',
    reassignment: 'Reasignación',
};

const CHANGE_TYPE_COLORS = {
    assignment: 'success',
    unassignment: 'error',
    reassignment: 'warning',
};

const CHANGE_SUMMARY_MAP = {
    bus_pilot: (prev, next, rec) => ({
        subject: prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?',
        routeNumber: rec.routeNumber || prev.routeNumber || next.routeNumber || null,
        fromText: prev.pilotName || null,
        toText: next.pilotName || null,
    }),
    bus_monitora: (prev, next, rec) => ({
        subject: prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?',
        routeNumber: rec.routeNumber || prev.routeNumber || next.routeNumber || null,
        fromText: prev.monitoraName || null,
        toText: next.monitoraName || null,
    }),
    bus_school: (prev, next, rec) => {
        const prevLabel = clientRouteLabel(Object.keys(prev).length ? prev : null);
        const nextLabel = clientRouteLabel(Object.keys(next).length ? next : null);
        // Bus swap on the same route: the bus itself is what changed
        if (prev.busPlate && next.busPlate && prev.busPlate !== next.busPlate && prevLabel === nextLabel) {
            return {
                subject: prevLabel || `Ruta ${rec.routeNumber || '?'}`,
                routeNumber: rec.routeNumber || prev.routeNumber || next.routeNumber || null,
                fromText: `Bus ${prev.busPlate}`,
                toText: `Bus ${next.busPlate}`,
            };
        }
        return {
            subject: prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?',
            routeNumber: rec.routeNumber || prev.routeNumber || next.routeNumber || null,
            fromText: prevLabel,
            toText: nextLabel,
        };
    },
    bus_corporation: (prev, next, rec) => {
        const prevLabel = clientRouteLabel(Object.keys(prev).length ? prev : null);
        const nextLabel = clientRouteLabel(Object.keys(next).length ? next : null);
        // Bus swap on the same route
        if (prev.busPlate && next.busPlate && prev.busPlate !== next.busPlate && prevLabel === nextLabel) {
            return {
                subject: prevLabel || `Ruta ${rec.routeNumber || '?'}`,
                routeNumber: rec.routeNumber || prev.routeNumber || next.routeNumber || null,
                fromText: `Bus ${prev.busPlate}`,
                toText: `Bus ${next.busPlate}`,
            };
        }
        return {
            subject: prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?',
            routeNumber: rec.routeNumber || prev.routeNumber || next.routeNumber || null,
            fromText: prevLabel,
            toText: nextLabel,
        };
    },
    bus_plate: (prev, next, rec) => {
        const formatBus = (bp, rn) => {
            if (!bp) {
                return null;
            }
            return rn ? `${bp} (Ruta ${rn})` : bp;
        };
        return {
            subject: prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?',
            routeNumber: rec.routeNumber || prev.routeNumber || next.routeNumber || null,
            fromText: formatBus(prev.busPlate, prev.routeNumber),
            toText: formatBus(next.busPlate, next.routeNumber),
        };
    },
};

const computeChangeSummary = (record) => {
    const prev = safeParseJson(record.previousValue);
    const next = safeParseJson(record.newValue);
    const handler = CHANGE_SUMMARY_MAP[record.assignmentType];
    if (!handler) {
        return { subject: '\u2014', fromText: null, toText: null };
    }
    return handler(prev, next, record);
};

const renderReassignmentDetail = (fromText, toText) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{
            display: 'inline-flex', alignItems: 'center',
            px: 1, py: 0.25, borderRadius: 1,
            border: '1px solid', borderColor: 'error.light',
            color: 'error.dark', bgcolor: 'rgba(211,47,47,0.07)'
        }}>
            <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
                {fromText || '—'}
            </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" fontWeight="bold">→</Typography>
        <Box sx={{
            display: 'inline-flex', alignItems: 'center',
            px: 1, py: 0.25, borderRadius: 1,
            border: '1px solid', borderColor: 'success.light',
            color: 'success.dark', bgcolor: 'rgba(46,125,50,0.07)'
        }}>
            <Typography variant="body2" fontWeight="medium">
                {toText || '—'}
            </Typography>
        </Box>
    </Box>
);

const renderChangeDetailCell = (ctype, fromText, toText) => {
    if (ctype === 'reassignment') {
        return renderReassignmentDetail(fromText, toText);
    }
    if (ctype === 'assignment') {return (
        <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 'medium' }}>{toText || '—'}</Typography>
    );}
    if (ctype === 'unassignment') {return (
        <Typography variant="body2" sx={{ color: 'error.main', textDecoration: 'line-through' }}>{fromText || '—'}</Typography>
    );}
    return <Typography variant="body2" color="text.secondary">—</Typography>;
};

const BusAssignmentHistoryPage = () => {
    const { auth } = useContext(AuthContext);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalRecords, setTotalRecords] = useState(0);

    const [buses, setBuses] = useState([]);
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [stats, setStats] = useState(null);

    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.client({ schools, corporations }),
            F.autocomplete('bus', {
                label: 'Placa',
                width: 'sm',
                dependsOn: 'cycle',
                requireParent: false,
                options: buses.map((bus) => ({ value: String(bus.id), label: bus.plate })),
            }),
            F.select('changeType', { label: 'Tipo de cambio', options: CHANGE_TYPE_LABELS }),
            F.dateRange('dates'),
        ],
        onApplied: () => setPage(0),
    });
    const { cycle: selectedCicloEscolar, client: selectedClient, changeType: changeTypeFilter, dates } = pageFilters.applied;
    const busId = pageFilters.applied.bus?.value || '';
    const schoolId = getClientSchoolId(selectedClient);
    const corporationId = getClientCorporationId(selectedClient);
    const startDate = dates.from;
    const endDate = dates.to;
    const draftCycle = pageFilters.draft.cycle;

    const isSpecificCicloEscolarSelected = selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE;

    const fetchHistory = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
                assignmentType: ['bus_plate', 'bus_pilot', 'bus_monitora', 'bus_school', 'bus_corporation'].join(','),
            };

            if (changeTypeFilter) {
                params.changeType = changeTypeFilter;
            }
            if (busId) {
                params.busId = busId;
            }
            if (schoolId) {
                params.schoolId = schoolId;
            }
            if (corporationId) {
                params.corporationId = corporationId;
            }
            if (startDate) {
                params.startDate = startDate;
            }
            if (endDate) {
                params.endDate = moment(endDate).endOf('day').toDate().toISOString();
            }

            const response = await api.get('/assignment-history', {
                params,
                headers: { Authorization: `Bearer ${auth.token}` }
            });

            setHistory(response.data.history || []);
            setTotalRecords(response.data.total || 0);
        } catch (err) {
            console.error('Error al cargar historial de buses:', err);
            setError(err.response?.data?.message || 'Error al cargar el historial');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, changeTypeFilter, busId, schoolId, corporationId, startDate, endDate, selectedCicloEscolar, auth.token]);

    const getStatsParams = React.useCallback(() => {
        const params = {
            ...getCicloEscolarFilterParams(selectedCicloEscolar),
            assignmentType: ['bus_plate', 'bus_pilot', 'bus_monitora', 'bus_school', 'bus_corporation'].join(','),
        };
        if (busId) {
            params.busId = busId;
        }
        if (schoolId) {
            params.schoolId = schoolId;
        }
        if (corporationId) {
            params.corporationId = corporationId;
        }
        if (startDate) {
            params.startDate = startDate;
        }
        if (endDate) {
            params.endDate = moment(endDate).endOf('day').toDate().toISOString();
        }
        return params;
    }, [selectedCicloEscolar, busId, schoolId, corporationId, startDate, endDate]);

    const fetchStats = React.useCallback(async () => {
        try {
            const params = getStatsParams();
            const response = await api.get('/assignment-history/stats', {
                params,
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setStats(response.data);
        } catch (err) {
            console.error('Error al cargar estadísticas:', err);
        }
    }, [getStatsParams, auth.token]);

    const fetchCatalogs = React.useCallback(async () => {
        try {
            const busesRes = await api.get('/buses/simple', {
                params: { includeDecommissioned: true },
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setBuses(busesRes.data.buses || []);

            const schoolsRes = await api.get('/schools', {
                params: { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true },
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const schoolsData = Array.isArray(schoolsRes.data) ? schoolsRes.data : (schoolsRes.data?.schools || []);
            setSchools(schoolsData);

            const corpsRes = await api.get('/corporations', {
                params: getCicloEscolarFilterParams(draftCycle),
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const corpsData = Array.isArray(corpsRes.data) ? corpsRes.data : (corpsRes.data?.corporations || []);
            setCorporations(corpsData);
        } catch (err) {
            console.error('Error cargando catálogos de buses:', err);
        }
    }, [auth.token, draftCycle]);

    const handleGlobalRefresh = React.useCallback(async () => {
        await Promise.all([fetchHistory(), fetchCatalogs(), fetchStats()]);
    }, [fetchHistory, fetchCatalogs, fetchStats]);

    useRegisterPageRefresh(handleGlobalRefresh, [handleGlobalRefresh]);

    useEffect(() => {
        fetchHistory();
        fetchStats();
    }, [fetchHistory, fetchStats]);

    // Los catálogos siguen al ciclo que se está eligiendo, no se recargan con cada filtro aplicado
    useEffect(() => {
        fetchCatalogs();
    }, [fetchCatalogs]);

    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => { setRowsPerPage(Number.parseInt(event.target.value, 10)); setPage(0); };

    return (
        <Box sx={{ p: 3 }}>
            {/* Título */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">Historial de Asignaciones — Buses</Typography>
            </Box>

            {/* Barra de resumen */}
            {!loading && stats && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                        <strong>{stats.totalChanges}</strong> registros en total ({Number(stats.colegios || 0)} de colegios · {Number(stats.corporativos || 0)} corporativos)
                    </Typography>
                    {stats.byChangeType.map((item) => {
                        const ct = item.changeType;
                        const cfg = STATS_CONFIG[ct];
                        if (!cfg || Number(item.count) === 0) {
                            return null;
                        }
                        return (
                            <Chip key={ct} icon={<span>{cfg.icon}</span>} label={`${Number(item.count)} ${cfg.label}`} color={cfg.color} size="small" variant="outlined" />
                        );
                    })}
                </Box>
            )}

            {/* Filtros */}
            <FilterBar
                {...pageFilters.barProps}
                loading={loading}
                caption={(isSpecificCicloEscolarSelected || (startDate && endDate)) ? (
                    <>
                        {isSpecificCicloEscolarSelected && 'Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.'}
                        {isSpecificCicloEscolarSelected && startDate && endDate && <br />}
                        {startDate && endDate && (
                            <>Mostrando cambios desde <strong>{moment(startDate).format('DD/MM/YYYY')}</strong> hasta <strong>{moment(endDate).format('DD/MM/YYYY')}</strong></>
                        )}
                    </>
                ) : undefined}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {/* Tabla de historial */}
            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                            <CircularProgress sx={{ mb: 1 }} />
                            <Typography variant="body2" color="text.secondary">Cargando historial de asignaciones...</Typography>
                        </Box>
                    ) : (
                        <>
                            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 1000 }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                                            <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Fecha y hora</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Tipo de cambio</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Bus</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Cambio realizado</TableCell>
                                            <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Quién</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {history.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                                    <Typography variant="body1" color="text.secondary" gutterBottom>
                                                        No hay cambios registrados para los filtros seleccionados
                                                    </Typography>
                                                    <Typography variant="body2" color="text.disabled">
                                                        Intenta ajustar el rango de fechas, seleccionar otro bus o limpiar los filtros.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            history.map((record) => {
                                                const { subject, fromText, toText } = computeChangeSummary(record);
                                                const ctype = record.changeType;
                                                const atype = record.assignmentType;
                                                const IconComponent = ASSIGNMENT_ICONS[atype] || null;
                                                const narrative = buildNarrative(record);

                                                return (
                                                    <TableRow
                                                        key={record.id}
                                                        hover
                                                        sx={{ transition: 'background-color 0.15s ease', '&:hover': { bgcolor: 'action.hover' } }}
                                                    >
                                                        {/* Fecha y hora */}
                                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                            <Typography variant="body2">
                                                                {formatGuatemalaDatetime(record.createdAt)}
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Tipo de cambio */}
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                                {IconComponent && <IconComponent sx={{ fontSize: 18, color: 'text.secondary' }} />}
                                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                                                    <Chip
                                                                        label={CHANGE_TYPE_LABELS[ctype] || ctype}
                                                                        color={CHANGE_TYPE_COLORS[ctype] || 'default'}
                                                                        size="small"
                                                                        sx={{ width: 'fit-content', fontWeight: 500 }}
                                                                    />
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {ASSIGNMENT_TYPE_LABELS[atype] || atype}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </TableCell>

                                                        {/* Bus */}
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={700}>
                                                                {subject}
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Cambio realizado */}
                                                        <TableCell sx={{ maxWidth: 360 }}>
                                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                                {narrative}
                                                            </Typography>
                                                            {renderChangeDetailCell(ctype, fromText, toText)}
                                                        </TableCell>

                                                        {/* Quién */}
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {record.changedByUser?.name || '\u2014'}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={totalRecords}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                                labelRowsPerPage="Filas por página:"
                                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default BusAssignmentHistoryPage;
