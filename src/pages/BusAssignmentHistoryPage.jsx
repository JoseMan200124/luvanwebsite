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
    ListSubheader,
    InputLabel,
    Grid,
    CircularProgress,
    Alert
} from '@mui/material';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import moment from 'moment-timezone';
import CicloEscolarFilter, { ALL_CYCLES_VALUE, getCicloEscolarFilterParams, getInitialCicloEscolarFilter } from '../components/CicloEscolarFilter';
import { getCicloEscolarOptionLabel } from '../services/cicloEscolarService';

moment.tz.setDefault('America/Guatemala');

const formatGuatemalaDatetime = (dateString) => {
    if (!dateString) return '—';
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY HH:mm');
};

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
    bus_school: (prev, next, rec) => ({
        subject: `Bus ${prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?'}`,
        fromText: prev.schoolName || (prev.busPlate ? (prev.routeNumber ? `${prev.busPlate} (Ruta ${prev.routeNumber})` : prev.busPlate) : null),
        toText: next.schoolName || (next.busPlate ? (next.routeNumber ? `${next.busPlate} (Ruta ${next.routeNumber})` : next.busPlate) : null),
    }),
    bus_corporation: (prev, next, rec) => ({
        subject: `Bus ${prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?'}`,
        fromText: prev.corporationName || (prev.busPlate ? (prev.routeNumber ? `${prev.busPlate} (Ruta ${prev.routeNumber})` : prev.busPlate) : (prev.routeNumber ? `Ruta ${prev.routeNumber}` : null)),
        toText: next.corporationName || (next.busPlate ? (next.routeNumber ? `${next.busPlate} (Ruta ${next.routeNumber})` : next.busPlate) : (next.routeNumber ? `Ruta ${next.routeNumber}` : null)),
    }),
    bus_plate: (prev, next, rec) => ({
        subject: `Bus ${prev.busPlate || next.busPlate || rec.bus?.plate || rec.busId || '?'}`,
        fromText: prev.busPlate ? (prev.routeNumber ? `${prev.busPlate} (Ruta ${prev.routeNumber})` : prev.busPlate) : null,
        toText: next.busPlate ? (next.routeNumber ? `${next.busPlate} (Ruta ${next.routeNumber})` : next.busPlate) : null,
    }),
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
    if (ctype === 'reassignment') return renderReassignmentDetail(fromText, toText);
    if (ctype === 'assignment') return (
        <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 'medium' }}>{toText || '—'}</Typography>
    );
    if (ctype === 'unassignment') return (
        <Typography variant="body2" sx={{ color: 'error.main', textDecoration: 'line-through' }}>{fromText || '—'}</Typography>
    );
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

    // filtros
    const [assignmentType, setAssignmentType] = useState('');
    const [busId, setBusId] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [corporationId, setCorporationId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCicloEscolar, setSelectedCicloEscolar] = useState(getInitialCicloEscolarFilter);

    const [buses, setBuses] = useState([]);
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);

    const assignmentTypeLabels = {
        'bus_plate': 'Bus - Placa',
        'bus_pilot': 'Bus - Piloto',
        'bus_monitora': 'Bus - Monitora',
        'bus_school': 'Bus - Colegio (con Ruta)',
        'bus_corporation': 'Bus - Corporación (con Ruta)'
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

    const groupedSchools = React.useMemo(() => {
        if (isSpecificCicloEscolarSelected) return [];
        const map = new Map();
        schools.forEach((s) => {
            const cycleLabel = getCicloEscolarOptionLabel(s.cicloEscolar) || (s.cicloEscolarId ? `Ciclo ${s.cicloEscolarId}` : 'Sin ciclo escolar');
            const key = cycleLabel || 'Sin ciclo escolar';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(s);
        });
        return Array.from(map.entries()).map(([cycleLabel, schools]) => ({ cycleLabel, schools }));
    }, [schools, isSpecificCicloEscolarSelected]);

    const groupedCorporations = React.useMemo(() => {
        if (isSpecificCicloEscolarSelected) return [];
        const map = new Map();
        corporations.forEach((c) => {
            const cycleLabel = getCicloEscolarOptionLabel(c.cicloEscolar) || (c.cicloEscolarId ? `Ciclo ${c.cicloEscolarId}` : 'Sin ciclo escolar');
            const key = cycleLabel || 'Sin ciclo escolar';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(c);
        });
        return Array.from(map.entries()).map(([cycleLabel, corps]) => ({ cycleLabel, corporations: corps }));
    }, [corporations, isSpecificCicloEscolarSelected]);


    const fetchHistory = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                ...getCicloEscolarFilterParams(selectedCicloEscolar)
            };

            if (assignmentType) params.assignmentType = assignmentType;
            else params.assignmentType = ['bus_plate','bus_pilot','bus_monitora','bus_school','bus_corporation'].join(',');
            if (busId) params.busId = busId;
            if (schoolId) params.schoolId = schoolId;
            if (corporationId) params.corporationId = corporationId;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = moment(endDate).endOf('day').toDate().toISOString();

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
    }, [page, rowsPerPage, assignmentType, busId, schoolId, corporationId, startDate, endDate, selectedCicloEscolar, auth.token]);

    const fetchCatalogs = React.useCallback(async () => {
        try {
            const busesRes = await api.get('/buses/simple', {
                params: { includeDecommissioned: true },
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setBuses(busesRes.data.buses || []);

            const schoolsRes = await api.get('/schools', {
                params: { ...getCicloEscolarFilterParams(selectedCicloEscolar), includeArchived: true },
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            // schools may be returned as array or in { schools: [] }
            const schoolsData = Array.isArray(schoolsRes.data) ? schoolsRes.data : (schoolsRes.data?.schools || []);
            setSchools(schoolsData);

            const corpsRes = await api.get('/corporations', {
                params: getCicloEscolarFilterParams(selectedCicloEscolar),
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const corpsData = Array.isArray(corpsRes.data) ? corpsRes.data : (corpsRes.data?.corporations || []);
            setCorporations(corpsData);
        } catch (err) {
            console.error('Error cargando catálogos de buses:', err);
        }
    }, [auth.token, selectedCicloEscolar]);

    const handleGlobalRefresh = React.useCallback(async () => {
        await Promise.all([fetchHistory(), fetchCatalogs()]);
    }, [fetchHistory, fetchCatalogs]);

    useRegisterPageRefresh(handleGlobalRefresh, [page, rowsPerPage, assignmentType, busId, schoolId, corporationId, startDate, endDate, selectedCicloEscolar]);

    useEffect(() => {
        fetchHistory();
        fetchCatalogs();
    }, [fetchHistory, fetchCatalogs]);

    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => { setRowsPerPage(Number.parseInt(event.target.value, 10)); setPage(0); };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">Historial de Asignaciones — Buses</Typography>
            </Box>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Filtros</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <CicloEscolarFilter
                                value={selectedCicloEscolar}
                                onChange={(value) => { setSelectedCicloEscolar(value); setBusId(''); setSchoolId(''); setCorporationId(''); setPage(0); }}
                                label="Ciclo escolar de colegios"
                                allLabel="Todos los ciclos"
                                size="small"
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Bus</InputLabel>
                                <Select
                                    value={busId}
                                    onChange={(e) => { setBusId(e.target.value); setPage(0); }}
                                    label="Bus"
                                    MenuProps={{ PaperProps: { style: { maxHeight: 320, width: 360 } } }}
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {buses.map((bus) => (
                                        <MenuItem key={bus.id} value={bus.id}>{bus.plate} {bus.routeNumber ? `- Ruta ${bus.routeNumber}` : ''}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    value={schoolId}
                                    onChange={(e) => { setSchoolId(e.target.value); setPage(0); }}
                                    label="Colegio"
                                >
                                    <MenuItem value="">{isSpecificCicloEscolarSelected ? 'Todos los colegios del ciclo' : 'Todos los colegios'}</MenuItem>
                                    {isSpecificCicloEscolarSelected ? (
                                        schools.map((school) => (
                                            <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                                        ))
                                    ) : (
                                        groupedSchools.map((group) => [
                                            <ListSubheader key={`header-${group.cycleLabel}`} disableSticky sx={{ lineHeight: 1.6, color: '#1976d2', fontWeight: 800, bgcolor: 'background.paper' }}>
                                                {group.cycleLabel}
                                            </ListSubheader>,
                                            ...group.schools.map((s) => (
                                                <MenuItem key={s.id} value={s.id} sx={{ pl: 3 }}>{s.name}</MenuItem>
                                            )),
                                        ])
                                    )}
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
                                <InputLabel>Tipo</InputLabel>
                                <Select value={assignmentType} onChange={(e) => { setAssignmentType(e.target.value); setPage(0); }} label="Tipo">
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(assignmentTypeLabels).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>{label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Corporación</InputLabel>
                                <Select value={corporationId} onChange={(e) => { setCorporationId(e.target.value); setPage(0); }} label="Corporación">
                                    <MenuItem value="">Todas</MenuItem>
                                    {isSpecificCicloEscolarSelected ? (
                                        corporations.map((corp) => (
                                            <MenuItem key={corp.id} value={corp.id}>{corp.name}</MenuItem>
                                        ))
                                    ) : (
                                        groupedCorporations.map((group) => [
                                            <ListSubheader key={`header-corp-${group.cycleLabel}`} disableSticky sx={{ lineHeight: 1.6, color: '#1976d2', fontWeight: 800, bgcolor: 'background.paper' }}>
                                                {group.cycleLabel}
                                            </ListSubheader>,
                                            ...group.corporations.map((c) => (
                                                <MenuItem key={c.id} value={c.id} sx={{ pl: 3 }}>{c.name}</MenuItem>
                                            )),
                                        ])
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <TextField fullWidth size="small" type="date" label="Desde" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <TextField fullWidth size="small" type="date" label="Hasta" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
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
                                                    <Typography variant="body2" color="textSecondary">No hay registros para mostrar</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            history.map((record) => {
                                                const { subject, fromText, toText } = computeChangeSummary(record);
                                                const ctype = record.changeType;
                                                return (
                                                    <TableRow key={record.id} hover>
                                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatGuatemalaDatetime(record.createdAt)}</TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                                <Chip label={changeTypeLabels[ctype] || ctype} color={changeTypeColors[ctype] || 'default'} size="small" sx={{ width: 'fit-content' }} />
                                                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{assignmentTypeLabels[record.assignmentType] || record.assignmentType}</Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell><Typography variant="body2" fontWeight="medium">{subject}</Typography></TableCell>
                                                        <TableCell>{renderChangeDetailCell(ctype, fromText, toText)}</TableCell>
                                                        <TableCell><Typography variant="body2">{record.changedByUser?.name || '\u2014'}</Typography></TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination component="div" count={totalRecords} page={page} onPageChange={handleChangePage} rowsPerPage={rowsPerPage} onRowsPerPageChange={handleChangeRowsPerPage} rowsPerPageOptions={[10,25,50,100]} labelRowsPerPage="Filas por página:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
                        </>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default BusAssignmentHistoryPage;
