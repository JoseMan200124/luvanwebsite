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
    TextField,
    MenuItem,
    Select,
    FormControl,
    FormHelperText,
    InputLabel,
    Grid,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import moment from 'moment-timezone';
import CicloEscolarFilter, { ALL_CYCLES_VALUE, getCicloEscolarFilterParams, getInitialCicloEscolarFilter } from '../components/CicloEscolarFilter';

moment.tz.setDefault('America/Guatemala');

const formatGuatemalaDatetime = (dateString) => {
    if (!dateString) return '—';
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY HH:mm');
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

const safeParseJson = (v) => {
    if (!v) return {};
    if (typeof v === 'object') return v;
    try {
        const parsed = JSON.parse(v);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
};

/** "Colegio X — Ruta 5" or just the client name, or just "Ruta 5" */
const clientRouteLabel = (o) => {
    if (!o || Object.keys(o).length === 0) return null;
    const client = o.schoolName || o.corporationName || null;
    const route = o.routeNumber ? `Ruta ${o.routeNumber}` : null;
    if (client && route) return `${client} \u2014 ${route}`;
    return client || route || null;
};

/** "Ruta 5 (Colegio X)" */
const routeLabel = (o) => {
    if (!o?.routeNumber) return null;
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
    if (!handler) return { subject: '\u2014', fromText: null, toText: null };
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

    // Filtros
    const [assignmentType, setAssignmentType] = useState('');
    const [busId, setBusId] = useState('');
    const [userId, setUserId] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [corporationId, setCorporationId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCicloEscolar, setSelectedCicloEscolar] = useState(getInitialCicloEscolarFilter);

    // Catálogos para filtros
    const [buses, setBuses] = useState([]);
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);

    const assignmentTypeLabels = {
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
        fetchCatalogs();
    }, [page, rowsPerPage, assignmentType, busId, userId, schoolId, corporationId, startDate, endDate, selectedCicloEscolar]);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                ...getCicloEscolarFilterParams(selectedCicloEscolar)
            };

            if (assignmentType) params.assignmentType = assignmentType;
            if (busId) params.busId = busId;
            if (userId) params.userId = userId;
            if (schoolId) params.schoolId = schoolId;
            if (corporationId) params.corporationId = corporationId;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const response = await api.get('/assignment-history', {
                params,
                headers: { Authorization: `Bearer ${auth.token}` }
            });

            setHistory(response.data.history || []);
            setTotalRecords(response.data.total || 0);
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
                params: { ...getCicloEscolarFilterParams(selectedCicloEscolar), includeArchived: true },
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setSchools(schoolsRes.data.schools || []);

            // Cargar corporaciones
            const corpsRes = await api.get('/corporations', {
                params: getCicloEscolarFilterParams(selectedCicloEscolar),
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

            {/* Filtros */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Filtros
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <CicloEscolarFilter
                                value={selectedCicloEscolar}
                                onChange={(value) => {
                                    setSelectedCicloEscolar(value);
                                    setBusId('');
                                    setUserId('');
                                    setSchoolId('');
                                    setCorporationId('');
                                    setPage(0);
                                }}
                                label="Ciclo escolar de colegios"
                                allLabel="Todos los ciclos"
                                size="small"
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    value={schoolId}
                                    onChange={(e) => {
                                        setSchoolId(e.target.value);
                                        setPage(0);
                                    }}
                                    label="Colegio"
                                >
                                    <MenuItem value="">
                                        {isSpecificCicloEscolarSelected ? 'Todos los colegios del ciclo' : 'Todos los colegios'}
                                    </MenuItem>
                                    {schools.map((school) => (
                                        <MenuItem key={school.id} value={school.id}>
                                            {school.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>
                                    {isSpecificCicloEscolarSelected && !schoolId
                                        ? 'Se tomarán en cuenta todos los colegios del ciclo seleccionado.'
                                        : 'Las opciones dependen del ciclo escolar seleccionado.'}
                                </FormHelperText>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Tipo de Asignación</InputLabel>
                                <Select
                                    value={assignmentType}
                                    onChange={(e) => {
                                        setAssignmentType(e.target.value);
                                        setPage(0);
                                    }}
                                    label="Tipo de Asignación"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(assignmentTypeLabels).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>{label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Bus</InputLabel>
                                <Select
                                    value={busId}
                                    onChange={(e) => {
                                        setBusId(e.target.value);
                                        setPage(0);
                                    }}
                                    label="Bus"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {buses.map((bus) => (
                                        <MenuItem key={bus.id} value={bus.id}>
                                            {bus.plate} {bus.routeNumber ? `- Ruta ${bus.routeNumber}` : ''}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Corporación</InputLabel>
                                <Select
                                    value={corporationId}
                                    onChange={(e) => {
                                        setCorporationId(e.target.value);
                                        setPage(0);
                                    }}
                                    label="Corporación"
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {corporations.map((corp) => (
                                        <MenuItem key={corp.id} value={corp.id}>
                                            {corp.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="Desde"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="Hasta"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

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
