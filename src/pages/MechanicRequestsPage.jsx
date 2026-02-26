/**
 * pages/MechanicRequestsPage.jsx
 * 
 * Página de gestión de solicitudes de mecánica
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    MenuItem,
    Grid,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TableSortLabel,
    FormControl,
    InputLabel,
    Select,
    Alert,
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Delete as DeleteIcon,
    Build as BuildIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    HourglassEmpty as PendingIcon,
    Autorenew as InProgressIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import tw from 'twin.macro';
import styled from 'styled-components';
import moment from 'moment-timezone';
import { AuthContext } from '../context/AuthProvider';
import {
    getAllMechanicRequests,
    getMechanicRequestById,
    getMechanicRequestStatistics,
    deleteMechanicRequest,
    updateMechanicRequestStatus,
    WORK_TYPES,
    REQUEST_STATES,
    STATE_COLORS
} from '../services/mechanicRequestService';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';

const PageContainer = styled.div`
    ${tw`p-6`}
`;

const FiltersContainer = styled(Paper)`
    ${tw`p-4 mb-4`}
`;

const StatsCard = styled(Card)`
    ${tw`h-full`}
`;

const MechanicRequestsPage = () => {
    const { auth } = useContext(AuthContext);
    const userRole = auth?.user?.role || auth?.user?.Role?.name;

    // Estados para datos
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState(null);
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);

    // Estados para paginación
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Estados para filtros
    const [filters, setFilters] = useState({
        schoolId: '',
        corporationId: '',
        plate: '',
        routeNumber: '',
        tipoTrabajo: '',
        estado: '',
        urgente: '',
        startDate: '',
        endDate: ''
    });

    // Estados para ordenamiento
    const [sortBy, setSortBy] = useState('fechaSolicitud');
    const [sortOrder, setSortOrder] = useState('desc');

    // Estados para modales
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState(null);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [fechaCompletado, setFechaCompletado] = useState('');

    // Cargar colegios y corporaciones
    useEffect(() => {
        const loadFiltersData = async () => {
            try {
                const [schoolsResponse, corpsResponse] = await Promise.all([
                    api.get('/schools'),
                    api.get('/corporations')
                ]);
                const schoolsData = Array.isArray(schoolsResponse.data) 
                    ? schoolsResponse.data 
                    : (schoolsResponse.data?.schools || []);
                const corpsData = Array.isArray(corpsResponse.data) 
                    ? corpsResponse.data 
                    : (corpsResponse.data?.corporations || []);
                setSchools(schoolsData);
                setCorporations(corpsData);
            } catch (error) {
                console.error('Error loading filters data:', error);
            }
        };
        loadFiltersData();
    }, []);

    // Función para cargar solicitudes
    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                sortBy,
                sortOrder: sortOrder.toUpperCase(),
                ...Object.fromEntries(
                    Object.entries(filters).filter(([_, v]) => v !== '')
                )
            };

            const response = await getAllMechanicRequests(params);
            setRequests(response.data || []);
            setTotalCount(response.pagination?.total || 0);
        } catch (error) {
            console.error('Error fetching mechanic requests:', error);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filters, sortBy, sortOrder]);

    // Función para cargar estadísticas
    const fetchStatistics = useCallback(async () => {
        try {
            const params = {};
            if (filters.schoolId) params.schoolId = filters.schoolId;
            if (filters.corporationId) params.corporationId = filters.corporationId;
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;

            const stats = await getMechanicRequestStatistics(params);
            setStatistics(stats);
        } catch (error) {
            console.error('Error fetching statistics:', error);
        }
    }, [filters.schoolId, filters.corporationId, filters.startDate, filters.endDate]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchRequests();
    }, [fetchRequests]);

    // Manejadores de filtros
    const handleFilterChange = (field) => (event) => {
        setFilters(prev => ({ ...prev, [field]: event.target.value }));
        setPage(0);
    };

    // Manejadores de paginación
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Manejador de ordenamiento
    const handleSort = (column) => {
        const isAsc = sortBy === column && sortOrder === 'asc';
        setSortOrder(isAsc ? 'desc' : 'asc');
        setSortBy(column);
    };

    // Abrir modal de detalle
    const handleViewDetail = async (request) => {
        try {
            const detail = await getMechanicRequestById(request.id);
            setSelectedRequest(detail);
            setDetailModalOpen(true);
        } catch (error) {
            console.error('Error fetching request detail:', error);
        }
    };

    // Abrir modal de eliminar
    const handleOpenDeleteModal = (request) => {
        setRequestToDelete(request);
        setDeleteModalOpen(true);
    };

    // Confirmar eliminación
    const handleConfirmDelete = async () => {
        if (!requestToDelete) return;
        try {
            await deleteMechanicRequest(requestToDelete.id);
            setDeleteModalOpen(false);
            setRequestToDelete(null);
            fetchRequests();
            fetchStatistics();
        } catch (error) {
            console.error('Error deleting request:', error);
        }
    };

    // Abrir modal de cambio de estado
    const handleOpenStatusModal = (request) => {
        setSelectedRequest(request);
        setNewStatus(request.estado);
        setStatusNotes(request.notas || '');
        // Si ya tiene fecha de completado, usarla; sino, fecha actual
        const existingDate = request.fechaCompletado 
            ? moment(request.fechaCompletado).format('YYYY-MM-DD')
            : moment().format('YYYY-MM-DD');
        setFechaCompletado(existingDate);
        setStatusModalOpen(true);
    };

    // Confirmar cambio de estado
    const handleConfirmStatusChange = async () => {
        if (!selectedRequest) return;
        try {
            const updateData = {
                estado: newStatus,
                notas: statusNotes
            };
            // Si es completado, enviar la fecha seleccionada
            if (newStatus === 'completado' && fechaCompletado) {
                updateData.fechaCompletado = fechaCompletado;
            }
            await updateMechanicRequestStatus(selectedRequest.id, updateData);
            setStatusModalOpen(false);
            setSelectedRequest(null);
            setNewStatus('');
            setStatusNotes('');
            setFechaCompletado('');
            fetchRequests();
            fetchStatistics();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    // Obtener icono de estado
    const getStatusIcon = (estado) => {
        switch (estado) {
            case 'pendiente':
                return <PendingIcon fontSize="small" />;
            case 'en_proceso':
                return <InProgressIcon fontSize="small" />;
            case 'completado':
                return <CheckCircleIcon fontSize="small" />;
            case 'cancelado':
                return <CancelIcon fontSize="small" />;
            default:
                return null;
        }
    };

    // Formatear fecha con hora
    const formatDate = (date) => {
        if (!date) return '-';
        return moment(date).tz('America/Guatemala').format('DD/MM/YYYY HH:mm');
    };

    // Formatear solo fecha (sin hora)
    const formatDateOnly = (date) => {
        if (!date) return '-';
        return moment(date).tz('America/Guatemala').format('DD/MM/YYYY');
    };

    // Columnas ordenables
    const sortableColumns = [
        { id: 'fechaSolicitud', label: 'Fecha' },
        { id: 'tipoTrabajo', label: 'Tipo de Trabajo' },
        { id: 'estado', label: 'Estado' },
        { id: 'urgente', label: 'Urgente' }
    ];

    return (
        <PageContainer>
            <Typography variant="h4" gutterBottom>
                <BuildIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Solicitudes de Mecánica
            </Typography>

            {/* Estadísticas */}
            {statistics && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.totalRequests}
                                </Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: '4px solid #ff9800' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Urgentes
                                </Typography>
                                <Typography variant="h4" color="warning.main">
                                    {statistics.urgentRequests}
                                </Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: '4px solid #2196f3' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Pendientes
                                </Typography>
                                <Typography variant="h4" color="info.main">
                                    {statistics.pendingRequests}
                                </Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: '4px solid #9c27b0' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    En Proceso
                                </Typography>
                                <Typography variant="h4" color="secondary.main">
                                    {statistics.inProgressRequests}
                                </Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: '4px solid #4caf50' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Completados
                                </Typography>
                                <Typography variant="h4" color="success.main">
                                    {statistics.completedRequests}
                                </Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Más Solicitudes
                                </Typography>
                                <Typography variant="body1" noWrap>
                                    {statistics.topSchool?.name || statistics.topCorporation?.name || 'N/A'}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    {statistics.topSchool?.count || statistics.topCorporation?.count || 0} solicitudes
                                </Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                </Grid>
            )}

            {/* Filtros */}
            <FiltersContainer elevation={1}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Colegio"
                            value={filters.schoolId}
                            onChange={handleFilterChange('schoolId')}
                        >
                            <MenuItem value="">Todos</MenuItem>
                            {schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                    {school.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Corporación"
                            value={filters.corporationId}
                            onChange={handleFilterChange('corporationId')}
                        >
                            <MenuItem value="">Todas</MenuItem>
                            {corporations.map((corp) => (
                                <MenuItem key={corp.id} value={corp.id}>
                                    {corp.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={1.5}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Placa"
                            value={filters.plate}
                            onChange={handleFilterChange('plate')}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={1.5}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Ruta"
                            value={filters.routeNumber}
                            onChange={handleFilterChange('routeNumber')}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={1.5}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Tipo Trabajo"
                            value={filters.tipoTrabajo}
                            onChange={handleFilterChange('tipoTrabajo')}
                        >
                            <MenuItem value="">Todos</MenuItem>
                            {Object.entries(WORK_TYPES).map(([key, label]) => (
                                <MenuItem key={key} value={key}>
                                    {label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={1.5}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Estado"
                            value={filters.estado}
                            onChange={handleFilterChange('estado')}
                        >
                            <MenuItem value="">Todos</MenuItem>
                            {Object.entries(REQUEST_STATES).map(([key, label]) => (
                                <MenuItem key={key} value={key}>
                                    {label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={1}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Urgente"
                            value={filters.urgente}
                            onChange={handleFilterChange('urgente')}
                        >
                            <MenuItem value="">Todos</MenuItem>
                            <MenuItem value="true">Sí</MenuItem>
                            <MenuItem value="false">No</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={1.5}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Fecha Inicio"
                            value={filters.startDate}
                            onChange={handleFilterChange('startDate')}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={1.5}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Fecha Fin"
                            value={filters.endDate}
                            onChange={handleFilterChange('endDate')}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                </Grid>
            </FiltersContainer>

            {/* Tabla */}
            <TableContainer component={Paper}>
                {loading ? (
                    <Box display="flex" justifyContent="center" p={4}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <TableSortLabel
                                            active={sortBy === 'fechaSolicitud'}
                                            direction={sortBy === 'fechaSolicitud' ? sortOrder : 'asc'}
                                            onClick={() => handleSort('fechaSolicitud')}
                                        >
                                            Fecha
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={sortBy === 'tipoTrabajo'}
                                            direction={sortBy === 'tipoTrabajo' ? sortOrder : 'asc'}
                                            onClick={() => handleSort('tipoTrabajo')}
                                        >
                                            Tipo de Trabajo
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>Solicitud</TableCell>
                                    <TableCell>Placa</TableCell>
                                    <TableCell>Ruta</TableCell>
                                    <TableCell>Colegio/Corp.</TableCell>
                                    <TableCell>Solicitante</TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={sortBy === 'urgente'}
                                            direction={sortBy === 'urgente' ? sortOrder : 'asc'}
                                            onClick={() => handleSort('urgente')}
                                        >
                                            Urgente
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={sortBy === 'estado'}
                                            direction={sortBy === 'estado' ? sortOrder : 'asc'}
                                            onClick={() => handleSort('estado')}
                                        >
                                            Estado
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {requests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center">
                                            No se encontraron solicitudes de mecánica
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.map((request) => (
                                        <TableRow key={request.id} hover>
                                            <TableCell>
                                                {formatDate(request.fechaSolicitud)}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={WORK_TYPES[request.tipoTrabajo] || request.tipoTrabajo}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={request.solicitud}>
                                                    <Typography noWrap sx={{ maxWidth: 200 }}>
                                                        {request.solicitud}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                {request.bus?.plate || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {request.routeNumber || request.bus?.routeNumber || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {request.school?.name || request.corporation?.name || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {request.supervisorId 
                                                    ? `${request.supervisor?.name || '-'} (Supervisor)`
                                                    : `${request.pilot?.name || '-'} (Piloto)`}
                                            </TableCell>
                                            <TableCell>
                                                {request.urgente ? (
                                                    <Chip
                                                        icon={<WarningIcon />}
                                                        label="Sí"
                                                        size="small"
                                                        color="error"
                                                    />
                                                ) : (
                                                    <Chip label="No" size="small" variant="outlined" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={getStatusIcon(request.estado)}
                                                    label={REQUEST_STATES[request.estado] || request.estado}
                                                    size="small"
                                                    color={STATE_COLORS[request.estado] || 'default'}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Ver Detalle">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleViewDetail(request)}
                                                    >
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Cambiar Estado">
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        onClick={() => handleOpenStatusModal(request)}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {(userRole === 'Administrador' || userRole === 'Gestor') && (
                                                    <Tooltip title="Eliminar">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleOpenDeleteModal(request)}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <TablePagination
                            component="div"
                            count={totalCount}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            rowsPerPageOptions={[5, 10, 25, 50]}
                            labelRowsPerPage="Filas por página"
                            labelDisplayedRows={({ from, to, count }) =>
                                `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
                            }
                        />
                    </>
                )}
            </TableContainer>

            {/* Modal de Detalle */}
            <Dialog
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <BuildIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Detalle de Solicitud de Mecánica
                </DialogTitle>
                <DialogContent dividers>
                    {selectedRequest && (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Fecha de Solicitud
                                </Typography>
                                <Typography>
                                    {formatDate(selectedRequest.fechaSolicitud)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Estado
                                </Typography>
                                <Chip
                                    icon={getStatusIcon(selectedRequest.estado)}
                                    label={REQUEST_STATES[selectedRequest.estado] || selectedRequest.estado}
                                    color={STATE_COLORS[selectedRequest.estado] || 'default'}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Tipo de Trabajo
                                </Typography>
                                <Typography>
                                    {WORK_TYPES[selectedRequest.tipoTrabajo] || selectedRequest.tipoTrabajo}
                                    {selectedRequest.tipoTrabajo === 'otro' && selectedRequest.otroTrabajoDetalle && (
                                        <span> - {selectedRequest.otroTrabajoDetalle}</span>
                                    )}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Urgente
                                </Typography>
                                {selectedRequest.urgente ? (
                                    <Chip icon={<WarningIcon />} label="Sí" size="small" color="error" />
                                ) : (
                                    <Chip label="No" size="small" variant="outlined" />
                                )}
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Solicitud
                                </Typography>
                                <Typography>{selectedRequest.solicitud}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Bus
                                </Typography>
                                <Typography>
                                    {selectedRequest.bus?.plate || '-'}
                                    {selectedRequest.bus?.description && ` - ${selectedRequest.bus.description}`}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Ruta
                                </Typography>
                                <Typography>
                                    {selectedRequest.routeNumber || selectedRequest.bus?.routeNumber || '-'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Colegio
                                </Typography>
                                <Typography>{selectedRequest.school?.name || '-'}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Corporación
                                </Typography>
                                <Typography>{selectedRequest.corporation?.name || '-'}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Piloto del Bus
                                </Typography>
                                <Typography>
                                    {selectedRequest.pilot?.name || '-'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Solicitante
                                </Typography>
                                <Typography>
                                    {selectedRequest.supervisorId 
                                        ? `${selectedRequest.supervisor?.name || '-'} (Supervisor)`
                                        : `${selectedRequest.pilot?.name || '-'} (Piloto)`}
                                </Typography>
                            </Grid>
                            {selectedRequest.fechaCompletado && (
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Fecha de Completado
                                    </Typography>
                                    <Typography>
                                        {formatDateOnly(selectedRequest.fechaCompletado)}
                                    </Typography>
                                </Grid>
                            )}
                            {selectedRequest.notas && (
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Notas
                                    </Typography>
                                    <Typography>{selectedRequest.notas}</Typography>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailModalOpen(false)}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Modal de Cambio de Estado */}
            <Dialog
                open={statusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Cambiar Estado de Solicitud
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Estado</InputLabel>
                                <Select
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    label="Estado"
                                >
                                    {Object.entries(REQUEST_STATES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Notas"
                                value={statusNotes}
                                onChange={(e) => setStatusNotes(e.target.value)}
                                placeholder="Agregar notas sobre el cambio de estado..."
                            />
                        </Grid>
                        {newStatus === 'completado' && (
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Fecha de Completado"
                                    value={fechaCompletado}
                                    onChange={(e) => setFechaCompletado(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    required
                                />
                            </Grid>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStatusModalOpen(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleConfirmStatusChange}
                    >
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de Confirmación de Eliminación */}
            <Dialog
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
            >
                <DialogTitle>Confirmar Eliminación</DialogTitle>
                <DialogContent>
                    <Typography>
                        ¿Está seguro de que desea eliminar esta solicitud de mecánica?
                    </Typography>
                    {requestToDelete && (
                        <Box mt={2}>
                            <Typography variant="body2" color="textSecondary">
                                <strong>Bus:</strong> {requestToDelete.bus?.plate || '-'}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                <strong>Tipo:</strong> {WORK_TYPES[requestToDelete.tipoTrabajo] || requestToDelete.tipoTrabajo}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                <strong>Fecha:</strong> {formatDate(requestToDelete.fechaSolicitud)}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleConfirmDelete}
                    >
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>
        </PageContainer>
    );
};

export default MechanicRequestsPage;
