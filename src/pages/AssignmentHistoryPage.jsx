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
    InputLabel,
    Grid,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert
} from '@mui/material';
import { Refresh as RefreshIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import moment from 'moment-timezone';

moment.tz.setDefault('America/Guatemala');

const formatGuatemalaDatetime = (dateString) => {
    if (!dateString) return '—';
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY HH:mm');
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

    // Catálogos para filtros
    const [buses, setBuses] = useState([]);
    const [users, setUsers] = useState([]);
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

    useEffect(() => {
        fetchHistory();
        fetchCatalogs();
    }, [page, rowsPerPage, assignmentType, busId, userId, schoolId, corporationId, startDate, endDate]);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage
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
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setSchools(schoolsRes.data.schools || []);

            // Cargar corporaciones
            const corpsRes = await api.get('/corporations', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setCorporations(corpsRes.data.corporations || []);

            // Cargar usuarios (pilotos y monitoras)
            const usersRes = await api.get('/users', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setUsers(usersRes.data.users || []);
        } catch (err) {
            console.error('Error al cargar catálogos:', err);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleClearFilters = () => {
        setAssignmentType('');
        setBusId('');
        setUserId('');
        setSchoolId('');
        setCorporationId('');
        setStartDate('');
        setEndDate('');
        setPage(0);
    };

    const renderChangeDescription = (record) => {
        const type = record.assignmentType;
        const changeType = record.changeType;

        const parseJson = (v) => {
            if (!v) return {};
            if (typeof v === 'object') return v;
            try {
                return JSON.parse(v);
            } catch (e) {
                return {};
            }
        };

        const prev = parseJson(record.previousValue);
        const next = parseJson(record.newValue);

        // Helper para representar un objeto anterior/nuevo de forma amigable
        const friendly = (o) => {
            if (!o || Object.keys(o).length === 0) return '—';
            if (o.pilotName) return `Piloto: ${o.pilotName}`;
            if (o.monitoraName) return `Monitora: ${o.monitoraName}`;
            if (o.busPlate) return `Bus: ${o.busPlate}`;
            if (o.schoolName) return `${o.schoolName}${o.routeNumber ? ` (Ruta ${o.routeNumber})` : ''}`;
            if (o.corporationName) return `${o.corporationName}${o.routeNumber ? ` (Ruta ${o.routeNumber})` : ''}`;
            if (o.routeNumber) return `Ruta ${o.routeNumber}`;
            return '—';
        };

        // Generar descripción simple y directa basada en los datos disponibles
        let entity = '';
        let change = '';

        // Identificar la entidad principal
        if (next.busPlate || prev.busPlate) {
            entity = `Bus: ${next.busPlate || prev.busPlate}`;
        } else if (next.pilotName || prev.pilotName) {
            entity = `Piloto: ${next.pilotName || prev.pilotName}`;
        } else if (next.monitoraName || prev.monitoraName) {
            entity = `Monitora: ${next.monitoraName || prev.monitoraName}`;
        } else if (next.routeNumber || prev.routeNumber) {
            const rNum = next.routeNumber || prev.routeNumber;
            const client = next.schoolName || next.corporationName || prev.schoolName || prev.corporationName;
            entity = client ? `Ruta ${rNum} - ${client}` : `Ruta ${rNum}`;
        } else if (next.schoolName || prev.schoolName) {
            entity = `Colegio: ${next.schoolName || prev.schoolName}`;
        } else if (next.corporationName || prev.corporationName) {
            entity = `Corporación: ${next.corporationName || prev.corporationName}`;
        }

        // Generar descripción del cambio basada en el tipo
        if (changeType === 'assignment') {
            // Asignación nueva
            if (next.pilotName) change = `Piloto asignado: ${next.pilotName}`;
            else if (next.monitoraName) change = `Monitora asignada: ${next.monitoraName}`;
            else if (next.schoolName) {
                const route = next.routeNumber ? ` (Ruta ${next.routeNumber})` : '';
                change = `Colegio asignado: ${next.schoolName}${route}`;
            }
            else if (next.corporationName) {
                const route = next.routeNumber ? ` (Ruta ${next.routeNumber})` : '';
                change = `Corporación asignada: ${next.corporationName}${route}`;
            }
            else if (next.routeNumber) {
                const client = next.schoolName || next.corporationName || '';
                change = `Ruta asignada: ${next.routeNumber}${client ? ` (${client})` : ''}`;
            }
        } else if (changeType === 'unassignment') {
            // Desasignación
            if (prev.pilotName) change = `Piloto removido: ${prev.pilotName}`;
            else if (prev.monitoraName) change = `Monitora removida: ${prev.monitoraName}`;
            else if (prev.schoolName) {
                const route = prev.routeNumber ? ` (Ruta ${prev.routeNumber})` : '';
                change = `Colegio removido: ${prev.schoolName}${route}`;
            }
            else if (prev.corporationName) {
                const route = prev.routeNumber ? ` (Ruta ${prev.routeNumber})` : '';
                change = `Corporación removida: ${prev.corporationName}${route}`;
            }
            else if (prev.routeNumber) {
                const client = prev.schoolName || prev.corporationName || '';
                change = `Ruta removida: ${prev.routeNumber}${client ? ` (${client})` : ''}`;
            }
        } else if (changeType === 'reassignment') {
            // Reasignación
            if (prev.pilotName && next.pilotName) {
                change = `Piloto: ${prev.pilotName} → ${next.pilotName}`;
            } else if (prev.monitoraName && next.monitoraName) {
                change = `Monitora: ${prev.monitoraName} → ${next.monitoraName}`;
            } else if (prev.schoolName && next.schoolName) {
                change = `Colegio: ${prev.schoolName} → ${next.schoolName}`;
            } else if (prev.corporationName && next.corporationName) {
                change = `Corporación: ${prev.corporationName} → ${next.corporationName}`;
            } else if (prev.routeNumber && next.routeNumber) {
                change = `Ruta: ${prev.routeNumber} → ${next.routeNumber}`;
            }
        }

        return {
            entity: entity || '—',
            change: change || '—',
            before: friendly(prev),
            after: friendly(next)
        };
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
                            <FormControl fullWidth size="small">
                                <InputLabel>Tipo de Asignación</InputLabel>
                                <Select
                                    value={assignmentType}
                                    onChange={(e) => setAssignmentType(e.target.value)}
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
                                    onChange={(e) => setBusId(e.target.value)}
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
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    value={schoolId}
                                    onChange={(e) => setSchoolId(e.target.value)}
                                    label="Colegio"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {schools.map((school) => (
                                        <MenuItem key={school.id} value={school.id}>
                                            {school.name}
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
                                    onChange={(e) => setCorporationId(e.target.value)}
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
                            <TableContainer component={Paper} variant="outlined">
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Fecha</TableCell>
                                            <TableCell>Entidad</TableCell>
                                            <TableCell>Tipo de Cambio</TableCell>
                                            <TableCell>Antes</TableCell>
                                            <TableCell>Después</TableCell>
                                            <TableCell>Modificado Por</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {history.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center">
                                                    <Typography variant="body2" color="textSecondary">
                                                        No hay registros para mostrar
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            history.map((record) => {
                                                const description = renderChangeDescription(record);
                                                return (
                                                    <TableRow key={record.id} hover>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {formatGuatemalaDatetime(record.createdAt)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {description.entity}
                                                            </Typography>
                                                        </TableCell>
                                                        {/* JSON debug column removed for end-user view */}
                                                        <TableCell>
                                                            <Chip
                                                                label={changeTypeLabels[record.changeType] || record.changeType}
                                                                color={changeTypeColors[record.changeType] || 'default'}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {description.before}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="medium" color="text.primary">
                                                                {description.after}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {record.changedByUser?.name || '—'}
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
