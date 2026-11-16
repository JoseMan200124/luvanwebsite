import React, { useState, useEffect, useContext } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import moment from 'moment-timezone';
import { getClientSchoolId, getClientCorporationId } from '../utils/clientValue';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';

moment.tz.setDefault('America/Guatemala');

const ASSIGNMENT_TYPE_LABELS = {
    'bus_pilot': 'Bus - Piloto',
    'bus_monitora': 'Bus - Monitora',
    'bus_school': 'Bus - Colegio (con Ruta)',
    'bus_corporation': 'Bus - Corporación (con Ruta)',
    'pilot_school': 'Piloto - Colegio',
    'pilot_corporation': 'Piloto - Corporación',
    'pilot_route': 'Piloto - Ruta',
    'monitora_school': 'Monitora - Colegio',
    'monitora_corporation': 'Monitora - Corporación',
    'monitora_route': 'Monitora - Ruta',
    'school_pilot': 'Colegio - Piloto',
    'school_monitora': 'Colegio - Monitora',
    'corporation_pilot': 'Corporación - Piloto',
    'corporation_monitora': 'Corporación - Monitora',
    'route_pilot': 'Ruta - Piloto',
    'route_monitora': 'Ruta - Monitora'
};

const formatGuatemalaDatetime = (dateString) => {
    if (!dateString) {
        return '—';
    }
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY HH:mm');
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

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

/** "Colegio X — Ruta 5" or just the client name, or just "Ruta 5" */
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

/** "Ruta 5 (Colegio X)" */
const routeLabel = (o) => {
    if (!o?.routeNumber) {
        return null;
    }
    const suffix = o.schoolName || o.corporationName || '';
    const base = `Ruta ${o.routeNumber}`;
    return suffix ? `${base} (${suffix})` : base;
};

// Dispatch map: assignmentType → function that returns { subject, fromText, toText }
const CHANGE_SUMMARY_MAP = {
    bus_pilot: (prev, next, rec) => ({
        subject: `Bus ${prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?'}`,
        fromText: prev.pilotName || null,
        toText: next.pilotName || null,
    }),
    bus_monitora: (prev, next, rec) => ({
        subject: `Bus ${prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?'}`,
        fromText: prev.monitoraName || null,
        toText: next.monitoraName || null,
    }),
    bus_school: (prev, next, rec) => {
        const prevLabel = clientRouteLabel(Object.keys(prev).length ? prev : null);
        const nextLabel = clientRouteLabel(Object.keys(next).length ? next : null);
        // Bus swap on the same route: the bus itself is what changed, not the school/route
        if (prev.busPlate && next.busPlate && prev.busPlate !== next.busPlate && prevLabel === nextLabel) {
            return {
                subject: prevLabel || `Ruta ${rec.routeNumber || '?'}`,
                fromText: `Bus ${prev.busPlate}`,
                toText: `Bus ${next.busPlate}`,
            };
        }
        return {
            subject: `Bus ${prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?'}`,
            fromText: prevLabel,
            toText: nextLabel,
        };
    },
    bus_corporation: (prev, next, rec) => {
        const prevLabel = clientRouteLabel(Object.keys(prev).length ? prev : null);
        const nextLabel = clientRouteLabel(Object.keys(next).length ? next : null);
        // Bus swap on the same route: the bus itself is what changed, not the corporation/route
        if (prev.busPlate && next.busPlate && prev.busPlate !== next.busPlate && prevLabel === nextLabel) {
            return {
                subject: prevLabel || `Ruta ${rec.routeNumber || '?'}`,
                fromText: `Bus ${prev.busPlate}`,
                toText: `Bus ${next.busPlate}`,
            };
        }
        return {
            subject: `Bus ${prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?'}`,
            fromText: prevLabel,
            toText: nextLabel,
        };
    },
    pilot_school: (prev, next, rec) => ({
        subject: prev.pilotName || next.pilotName || rec.user?.name || `Piloto #${rec.userId || '?'}`,
        fromText: prev.schoolName || null,
        toText: next.schoolName || null,
    }),
    pilot_corporation: (prev, next, rec) => ({
        subject: prev.pilotName || next.pilotName || rec.user?.name || `Piloto #${rec.userId || '?'}`,
        fromText: prev.corporationName || null,
        toText: next.corporationName || null,
    }),
    pilot_route: (prev, next, rec) => ({
        subject: prev.pilotName || next.pilotName || rec.user?.name || `Piloto #${rec.userId || '?'}`,
        fromText: routeLabel(prev),
        toText: routeLabel(next),
    }),
    monitora_school: (prev, next, rec) => ({
        subject: prev.monitoraName || next.monitoraName || rec.user?.name || `Monitora #${rec.userId || '?'}`,
        fromText: prev.schoolName || null,
        toText: next.schoolName || null,
    }),
    monitora_corporation: (prev, next, rec) => ({
        subject: prev.monitoraName || next.monitoraName || rec.user?.name || `Monitora #${rec.userId || '?'}`,
        fromText: prev.corporationName || null,
        toText: next.corporationName || null,
    }),
    monitora_route: (prev, next, rec) => ({
        subject: prev.monitoraName || next.monitoraName || rec.user?.name || `Monitora #${rec.userId || '?'}`,
        fromText: routeLabel(prev),
        toText: routeLabel(next),
    }),
    school_pilot: (prev, next, rec) => ({
        subject: prev.schoolName || next.schoolName || rec.school?.name || `Colegio #${rec.schoolId || '?'}`,
        fromText: prev.pilotName || null,
        toText: next.pilotName || null,
    }),
    school_monitora: (prev, next, rec) => ({
        subject: prev.schoolName || next.schoolName || rec.school?.name || `Colegio #${rec.schoolId || '?'}`,
        fromText: prev.monitoraName || null,
        toText: next.monitoraName || null,
    }),
    corporation_pilot: (prev, next, rec) => ({
        subject: prev.corporationName || next.corporationName || rec.corporation?.name || `Corporaci\u00f3n #${rec.corporationId || '?'}`,
        fromText: prev.pilotName || null,
        toText: next.pilotName || null,
    }),
    corporation_monitora: (prev, next, rec) => ({
        subject: prev.corporationName || next.corporationName || rec.corporation?.name || `Corporaci\u00f3n #${rec.corporationId || '?'}`,
        fromText: prev.monitoraName || null,
        toText: next.monitoraName || null,
    }),
    route_pilot: (prev, next, rec) => {
        const client = prev.schoolName || next.schoolName || rec.school?.name ||
            prev.corporationName || next.corporationName || rec.corporation?.name || '';
        const rn = rec.routeNumber || prev.routeNumber || next.routeNumber;
        const routeBase = rn ? `Ruta ${rn}` : 'Ruta';
        return {
            subject: client ? `${routeBase} \u2014 ${client}` : routeBase,
            fromText: prev.pilotName || null,
            toText: next.pilotName || null,
        };
    },
    route_monitora: (prev, next, rec) => {
        const client = prev.schoolName || next.schoolName || rec.school?.name ||
            prev.corporationName || next.corporationName || rec.corporation?.name || '';
        const rn = rec.routeNumber || prev.routeNumber || next.routeNumber;
        const routeBase = rn ? `Ruta ${rn}` : 'Ruta';
        return {
            subject: client ? `${routeBase} \u2014 ${client}` : routeBase,
            fromText: prev.monitoraName || null,
            toText: next.monitoraName || null,
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
    if (ctype === 'assignment') {
        return (
            <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 'medium' }}>
                {toText || '—'}
            </Typography>
        );
    }
    if (ctype === 'unassignment') {
        return (
            <Typography variant="body2" sx={{ color: 'error.main', textDecoration: 'line-through' }}>
                {fromText || '—'}
            </Typography>
        );
    }
    return <Typography variant="body2" color="text.secondary">—</Typography>;
};

const AssignmentHistoryPage = () => {
    const { auth } = useContext(AuthContext);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalRecords, setTotalRecords] = useState(0);
    const [clientBreakdown, setClientBreakdown] = useState({ colegios: 0, corporativos: 0 });

    // Catálogos para filtros
    const [buses, setBuses] = useState([]);
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);

    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.client({ schools, corporations }),
            F.select('assignmentType', { label: 'Tipo de asignación', options: ASSIGNMENT_TYPE_LABELS }),
            F.select('busId', {
                label: 'Bus',
                dependsOn: 'cycle',
                requireParent: false,
                options: buses.map((bus) => ({ value: String(bus.id), label: bus.routeNumber ? `${bus.plate} - Ruta ${bus.routeNumber}` : bus.plate })),
            }),
            F.dateRange('dates'),
        ],
        onApplied: () => setPage(0),
    });
    const { cycle: selectedCicloEscolar, client: selectedClient, assignmentType, busId, dates } = pageFilters.applied;
    const schoolId = getClientSchoolId(selectedClient);
    const corporationId = getClientCorporationId(selectedClient);
    const startDate = dates.from;
    const endDate = dates.to;
    const draftCycle = pageFilters.draft.cycle;
    const assignmentTypeLabels = ASSIGNMENT_TYPE_LABELS;

    const changeTypeLabels = {
        'assignment': 'Asignación',
        'unassignment': 'Desasignación',
        'reassignment': 'Reasignación'
    };

    const changeTypeColors = {
        'assignment': 'success',
        'unassignment': 'error',
        'reassignment': 'warning'
    };

    const isSpecificCicloEscolarSelected = selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE;

    useEffect(() => {
        fetchHistory();
    }, [page, rowsPerPage, assignmentType, busId, schoolId, corporationId, startDate, endDate, selectedCicloEscolar]);

    // Los catálogos siguen al ciclo que se está eligiendo, no se recargan con cada filtro aplicado
    useEffect(() => {
        fetchCatalogs();
    }, [draftCycle]);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                ...getCicloEscolarFilterParams(selectedCicloEscolar)
            };

            if (assignmentType) {
                params.assignmentType = assignmentType;
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
                params.endDate = endDate;
            }

            const response = await api.get('/assignment-history', {
                params,
                headers: { Authorization: `Bearer ${auth.token}` }
            });

            setHistory(response.data.history || []);
            setTotalRecords(response.data.total || 0);
            setClientBreakdown({ colegios: Number(response.data.colegios || 0), corporativos: Number(response.data.corporativos || 0) });
        } catch (err) {
            console.error('Error al cargar historial:', err);
            setError(err.response?.data?.message || 'Error al cargar el historial');
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalogs = async () => {
        try {
            // Cargar buses
            const busesRes = await api.get('/buses/simple', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setBuses(busesRes.data.buses || []);

            // Cargar colegios
            const schoolsRes = await api.get('/schools', {
                params: { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true },
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setSchools(schoolsRes.data.schools || []);

            // Cargar corporaciones
            const corpsRes = await api.get('/corporations', {
                params: getCicloEscolarFilterParams(draftCycle),
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setCorporations(corpsRes.data.corporations || []);

        } catch (err) {
            console.error('Error al cargar catálogos:', err);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(Number.parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Historial de Asignaciones
                </Typography>
                <Tooltip title="Recargar">
                    <IconButton onClick={fetchHistory} color="primary">
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {!loading && (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
                    {totalRecords} registros: {clientBreakdown.colegios} de colegios · {clientBreakdown.corporativos} corporativos
                </Typography>
            )}

            {/* Filtros */}
            <FilterBar
                {...pageFilters.barProps}
                loading={loading}
                caption={isSpecificCicloEscolarSelected
                    ? 'Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.'
                    : undefined}
            />

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Tabla de historial */}
            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 900 }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Fecha</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Sujeto</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Detalle del Cambio</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Modificado Por</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {history.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center">
                                                    <Typography variant="body2" color="textSecondary">
                                                        No hay registros para mostrar
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            history.map((record) => {
                                                const { subject, fromText, toText } = computeChangeSummary(record);
                                                const ctype = record.changeType;
                                                return (
                                                    <TableRow key={record.id} hover>
                                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                            <Typography variant="body2">
                                                                {formatGuatemalaDatetime(record.createdAt)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                                <Chip
                                                                    label={changeTypeLabels[ctype] || ctype}
                                                                    color={changeTypeColors[ctype] || 'default'}
                                                                    size="small"
                                                                    sx={{ width: 'fit-content' }}
                                                                />
                                                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                                                    {assignmentTypeLabels[record.assignmentType] || record.assignmentType}
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {subject}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            {renderChangeDetailCell(ctype, fromText, toText)}
                                                        </TableCell>
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

export default AssignmentHistoryPage;
