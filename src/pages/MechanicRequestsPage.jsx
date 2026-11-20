/**
 * pages/MechanicRequestsPage.jsx
 * 
 * Página de gestión de solicitudes de mecánica
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Paper,
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableRow,
    TextField,
    MenuItem,
    Grid,
    Chip,
    Tooltip,
    CircularProgress,
    Card,
    CardContent,
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
    Add as AddIcon,
} from '@mui/icons-material';
import tw from 'twin.macro';
import styled from 'styled-components';
import moment from 'moment-timezone';
import {
    getAllMechanicRequests,
    getMechanicRequestById,
    getMechanicRequestStatistics,
    createMechanicRequest,
    deleteMechanicRequest,
    updateMechanicRequestStatus,
    WORK_TYPES
} from '../services/mechanicRequestService';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import ClientSelector from '../components/ClientSelector';
import { getClientSchoolId, getClientCorporationId } from '../utils/clientValue';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import usePermissions from '../hooks/usePermissions';
import { validate, hasErrors, focusFirstError, clearError } from '../utils/validators';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F, YES_NO_OPTIONS, toRouteOptions } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import { formatDateTime, formatDate } from '../utils/dateFormat';
import { MECHANIC_STATUS, getStatusLabel, getStatusMeta, toStatusOptions } from '../constants/statuses';
import AppDialog from '../components/dialogs/AppDialog';

const StatsCard = styled(Card)`
    ${tw`h-full`}
`;

// Columnas de la tabla de solicitudes
const COLUMNS = [
    { id: 'fechaSolicitud', label: 'Fecha', sortable: true },
    { id: 'tipoTrabajo', label: 'Tipo de Trabajo', sortable: true },
    { id: 'solicitud', label: 'Solicitud' },
    { id: 'placa', label: 'Placa' },
    { id: 'ruta', label: 'Ruta' },
    { id: 'cliente', label: 'Colegio/Corp.' },
    { id: 'solicitante', label: 'Solicitante' },
    { id: 'urgente', label: 'Urgente', sortable: true },
    { id: 'estado', label: 'Estado', sortable: true },
    { id: 'acciones', label: 'Acciones', align: 'center' },
];

// Campos obligatorios de una solicitud nueva.
const CREATE_RULES = { busId: ['required'], solicitud: ['required'] };

const MechanicRequestsPage = () => {
    const notify = useNotify();
    const { hasPermission } = usePermissions();
    const confirm = useConfirm();
    // Estados para datos
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState(null);
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [plateOptions, setPlateOptions] = useState([]);
    const [routeOptions, setRouteOptions] = useState([]);

    // Paginación y orden (en el servidor)
    const table = useTableState({ defaultOrderBy: 'fechaSolicitud', defaultOrder: 'desc' });
    const { page, rowsPerPage, orderBy: sortBy, order: sortOrder } = table;
    const [totalCount, setTotalCount] = useState(0);
    const [clientBreakdown, setClientBreakdown] = useState({ colegios: 0, corporativos: 0 });

    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.client({ schools, corporations }),
            F.plate({ options: [...new Set(plateOptions.map((option) => option.label).filter(Boolean))].map((plateLabel) => ({ value: plateLabel, label: plateLabel })) }),
            F.route({ options: toRouteOptions(routeOptions) }),
            F.select('tipoTrabajo', { label: 'Tipo de trabajo', options: WORK_TYPES }),
            F.select('estado', { label: 'Estado', options: toStatusOptions(MECHANIC_STATUS) }),
            F.select('urgente', { label: 'Urgente', width: 'sm', options: YES_NO_OPTIONS }),
            F.dateRange('dates'),
        ],
        onApplied: table.resetPage,
    });
    const {
        cycle: selectedCicloEscolar,
        client: selectedClient,
        plate,
        route: routeNumber,
        tipoTrabajo,
        estado,
        urgente,
        dates,
    } = pageFilters.applied;
    const startDate = dates.from;
    const endDate = dates.to;
    const schoolId = getClientSchoolId(selectedClient);
    const corporationId = getClientCorporationId(selectedClient);
    const draftCycle = pageFilters.draft.cycle;
    const draftSchoolId = getClientSchoolId(pageFilters.draft.client);
    const draftCorporationId = getClientCorporationId(pageFilters.draft.client);

    // schools alimenta tanto el picker de filtro como el picker del diálogo "Nueva Solicitud" —
    // agrupar por ciclo evita que se elija el año equivocado de un colegio con nombre repetido.
    const isSpecificCicloEscolarSelected = selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE;

    // Estados para modales
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [fechaCompletado, setFechaCompletado] = useState('');
    // Create modal states
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createClient, setCreateClient] = useState(null);
    const createSchoolId = getClientSchoolId(createClient);
    const createCorporationId = getClientCorporationId(createClient);
    const [createBusId, setCreateBusId] = useState('');
    const [createPlateOptions, setCreatePlateOptions] = useState([]);
    const [createTipoTrabajo, setCreateTipoTrabajo] = useState('mecánico');
    const [createOtroTrabajoDetalle, setCreateOtroTrabajoDetalle] = useState('');
    const [createSolicitud, setCreateSolicitud] = useState('');
    const [createUrgente, setCreateUrgente] = useState(false);
    const [createLoadingPlates, setCreateLoadingPlates] = useState(false);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [createErrors, setCreateErrors] = useState({});
    const [statusSaving, setStatusSaving] = useState(false);

    // Cargar colegios y corporaciones
    useEffect(() => {
        const loadFiltersData = async () => {
            try {
                const [schoolsResponse, corpsResponse] = await Promise.all([
                    api.get('/schools', { params: { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true } }),
                    api.get('/corporations', { params: getCicloEscolarFilterParams(draftCycle) })
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
    }, [draftCycle]);

    // Cargar opciones de placas y rutas cuando cambie el cliente seleccionado
    useEffect(() => {
        const loadPlatesAndRoutes = async () => {
            try {
                // Clear previous selections
                setPlateOptions([]);
                setRouteOptions([]);

                const params = {};
                if (draftSchoolId) {
                    params.schoolId = draftSchoolId;
                }
                if (draftCorporationId) {
                    params.corporationId = draftCorporationId;
                }
                params.limit = 200;

                const resp = await api.get('/buses', { params });
                const buses = resp.data?.buses || [];

                const plates = buses.map(b => ({ id: b.id, label: b.plate }));
                const routeNums = Array.from(new Set(buses.map(b => b.routeNumber).filter(r => r)));

                setPlateOptions(plates);
                setRouteOptions(routeNums);
            } catch (error) {
                console.error('Error loading plate/route options:', error);
            }
        };

        // Solo carga con un cliente elegido; al cambiarlo, Placa y Ruta se limpian solas (dependsOn).
        if (draftSchoolId || draftCorporationId) {
            loadPlatesAndRoutes();
        } else {
            setPlateOptions([]);
            setRouteOptions([]);
        }
    }, [draftSchoolId, draftCorporationId]);

    // Función para cargar solicitudes
    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                sortBy,
                sortOrder: sortOrder.toUpperCase(),
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
            };

            if (schoolId) {
                params.schoolId = schoolId;
            }
            if (corporationId) {
                params.corporationId = corporationId;
            }
            if (plate) {
                params.plate = plate;
            }
            if (routeNumber) {
                params.routeNumber = routeNumber;
            }
            if (tipoTrabajo) {
                params.tipoTrabajo = tipoTrabajo;
            }
            if (estado) {
                params.estado = estado;
            }
            if (urgente !== '') {
                params.urgente = urgente;
            }
            if (startDate) {
                params.startDate = startDate;
            }
            if (endDate) {
                params.endDate = endDate;
            }

            const response = await getAllMechanicRequests(params);
            setRequests(response.data || []);
            setTotalCount(response.pagination?.total || 0);
            setClientBreakdown({ colegios: Number(response.clientBreakdown?.colegios || 0), corporativos: Number(response.clientBreakdown?.corporativos || 0) });
        } catch (error) {
            console.error('Error fetching mechanic requests:', error);
            notify.fromError(error, 'Error al cargar las solicitudes de mecánica');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, schoolId, corporationId, plate, routeNumber, tipoTrabajo, estado, urgente, selectedCicloEscolar, startDate, endDate, sortBy, sortOrder, notify]);

    // Función para cargar estadísticas
    const fetchStatistics = useCallback(async () => {
        try {
            const params = {
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
            };
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

            const stats = await getMechanicRequestStatistics(params);
            setStatistics(stats);
        } catch (error) {
            console.error('Error fetching statistics:', error);
        }
    }, [schoolId, corporationId, selectedCicloEscolar, startDate, endDate]);

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

    // Manejadores de filtros: usamos setters individuales abajo en los inputs

    // Abrir modal de detalle
    const handleViewDetail = async (request) => {
        try {
            const detail = await getMechanicRequestById(request.id);
            setSelectedRequest(detail);
            setDetailModalOpen(true);
        } catch (error) {
            console.error('Error fetching request detail:', error);
            notify.fromError(error, 'Error al cargar el detalle de la solicitud');
        }
    };

    // Eliminar con confirmación (muestra bus, tipo y fecha de la solicitud)
    const handleDelete = async (request) => {
        const ok = await confirm({
            title: 'Eliminar solicitud de mecánica',
            message: (
                <>
                    <Typography color="text.secondary">
                        Se eliminará la solicitud de mecánica. Esta acción no se puede deshacer.
                    </Typography>
                    <Box mt={2}>
                        <Typography variant="body2" color="textSecondary">
                            <strong>Bus:</strong> {request.bus?.plate || '-'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            <strong>Tipo:</strong> {WORK_TYPES[request.tipoTrabajo] || request.tipoTrabajo}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            <strong>Fecha:</strong> {formatDateTime(request.fechaSolicitud)}
                        </Typography>
                    </Box>
                </>
            ),
            confirmLabel: 'Eliminar',
            tone: 'danger',
            onConfirm: () => deleteMechanicRequest(request.id),
            errorMessage: 'Error al eliminar la solicitud',
        });
        if (ok) {
            notify.success('Solicitud eliminada');
            fetchRequests();
            fetchStatistics();
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
        if (!selectedRequest) {
            return;
        }
        setStatusSaving(true);
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
            notify.success('Estado actualizado');
        } catch (error) {
            console.error('Error updating status:', error);
            notify.fromError(error, 'Error al actualizar el estado');
        } finally {
            setStatusSaving(false);
        }
    };

    // Create modal handlers
    const handleOpenCreateModal = () => {
        // default to current selected client filters if present
        setCreateClient(selectedClient);
        setCreateBusId('');
        setCreatePlateOptions([]);
        setCreateTipoTrabajo('mecánico');
        setCreateOtroTrabajoDetalle('');
        setCreateSolicitud('');
        setCreateUrgente(false);
        setCreateError(null);
        setCreateErrors({});
        setCreateModalOpen(true);
    };

    const loadCreatePlates = async () => {
        setCreatePlateOptions([]);
        if (!createSchoolId && !createCorporationId) {
            return;
        }
        setCreateLoadingPlates(true);
        try {
            const params = { limit: 200 };
            if (createSchoolId) {
                params.schoolId = createSchoolId;
            }
            if (createCorporationId) {
                params.corporationId = createCorporationId;
            }
            const resp = await api.get('/buses', { params });
            const buses = resp.data?.buses || [];
            const plates = buses.map(b => ({ id: b.id, label: b.plate }));
            setCreatePlateOptions(plates);
        } catch (e) {
            console.error('Error loading create plates:', e);
        } finally {
            setCreateLoadingPlates(false);
        }
    };

    useEffect(() => {
        loadCreatePlates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createSchoolId, createCorporationId]);

    const handleConfirmCreate = async () => {
        setCreateError(null);
        const found = validate({ busId: createBusId, solicitud: createSolicitud }, CREATE_RULES);
        setCreateErrors(found);
        if (hasErrors(found)) {
            focusFirstError(found);
            return;
        }
        setCreateSubmitting(true);
        try {
            const payload = {
                busId: createBusId,
                tipoTrabajo: createTipoTrabajo,
                otroTrabajoDetalle: createOtroTrabajoDetalle || null,
                solicitud: createSolicitud,
                urgente: !!createUrgente
            };
            await createMechanicRequest(payload);
            setCreateModalOpen(false);
            setCreateSubmitting(false);
            fetchRequests();
            fetchStatistics();
            notify.success('Solicitud creada');
        } catch (e) {
            console.error('Error creating mechanic request:', e);
            setCreateError(e?.response?.data?.message || 'Error al crear la solicitud.');
            setCreateSubmitting(false);
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

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.buses}
                title="Solicitudes de Mecánica"
                actions={[{ key: 'create', label: 'Nueva solicitud', icon: <AddIcon />, primary: true, permission: 'mecanica-crear-solicitud', onClick: handleOpenCreateModal }]}
            />

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
                                <Typography variant="caption" color="textSecondary" display="block">
                                    {clientBreakdown.colegios} de colegios · {clientBreakdown.corporativos} corporativos
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
            <FilterBar
                {...pageFilters.barProps}
                loading={loading}
                caption={isSpecificCicloEscolarSelected
                    ? 'Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.'
                    : undefined}
            />

            {/* Tabla */}
            <AppTableContainer component={Paper}>
                {loading ? (
                    <Box display="flex" justifyContent="center" p={4}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <Table size="small" sx={{ minWidth: 1100 }}>
                            <SortableTableHead columns={COLUMNS} {...table.sortProps} />
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
                                                {formatDateTime(request.fechaSolicitud)}
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
                                                    label={getStatusLabel(MECHANIC_STATUS, request.estado)}
                                                    size="small"
                                                    color={getStatusMeta(MECHANIC_STATUS, request.estado).color}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <RowActions
                                                    actions={[
                                                        { key: 'view', kind: 'view', label: 'Ver detalle', icon: <VisibilityIcon fontSize="small" />, onClick: () => handleViewDetail(request) },
                                                        { key: 'status', kind: 'edit', color: 'primary', label: 'Cambiar estado', icon: <EditIcon fontSize="small" />, permission: 'mecanica-actualizar-estado', onClick: () => handleOpenStatusModal(request) },
                                                        { key: 'delete', kind: 'delete', label: 'Eliminar', icon: <DeleteIcon fontSize="small" />, permission: 'mecanica-eliminar-solicitud', onClick: () => handleDelete(request) },
                                                    ]}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <AppTablePagination count={totalCount} {...table.paginationProps} />
                    </>
                )}
            </AppTableContainer>

            {/* Modal de Crear Solicitud */}
            <AppDialog
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                title="Nueva solicitud de mecánica"
                icon={<BuildIcon />}
                size="sm"
                onSubmit={handleConfirmCreate}
                submitLabel="Crear"
                submitting={createSubmitting}
            >
                {createError && (
                    <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>
                )}
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <ClientSelector
                            schools={schools}
                            corporations={corporations}
                            value={createClient}
                            onChange={(client) => { setCreateClient(client); setCreateBusId(''); }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Placa/bus"
                            name="busId"
                            required
                            error={Boolean(createErrors.busId)}
                            helperText={createErrors.busId}
                            value={createBusId}
                            onChange={(e) => { setCreateBusId(e.target.value); setCreateErrors((prev) => clearError(prev, 'busId')); }}
                            disabled={(!createSchoolId && !createCorporationId) || createLoadingPlates}
                        >
                            <MenuItem value="">Seleccione</MenuItem>
                            {createPlateOptions.map((p) => (
                                <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Tipo de trabajo"
                            value={createTipoTrabajo}
                            onChange={(e) => setCreateTipoTrabajo(e.target.value)}
                        >
                            {Object.entries(WORK_TYPES).map(([key, label]) => (
                                <MenuItem key={key} value={key}>{label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    {createTipoTrabajo === 'otro' && (
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Detalle de otro trabajo"
                                value={createOtroTrabajoDetalle}
                                onChange={(e) => setCreateOtroTrabajoDetalle(e.target.value)}
                            />
                        </Grid>
                    )}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Solicitud"
                            name="solicitud"
                            required
                            error={Boolean(createErrors.solicitud)}
                            helperText={createErrors.solicitud}
                            value={createSolicitud}
                            onChange={(e) => { setCreateSolicitud(e.target.value); setCreateErrors((prev) => clearError(prev, 'solicitud')); }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControl fullWidth>
                            <InputLabel>Urgente</InputLabel>
                            <Select
                                value={createUrgente ? 'true' : 'false'}
                                onChange={(e) => setCreateUrgente(e.target.value === 'true')}
                                label="Urgente"
                            >
                                <MenuItem value="false">No</MenuItem>
                                <MenuItem value="true">Sí</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </AppDialog>

            {/* Modal de Detalle */}
            <AppDialog
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title="Detalle de la solicitud de mecánica"
                icon={<BuildIcon />}
                size="md"
                readOnly
            >
                {selectedRequest && (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" color="textSecondary">
                                Fecha de Solicitud
                            </Typography>
                            <Typography>
                                {formatDateTime(selectedRequest.fechaSolicitud)}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" color="textSecondary">
                                Estado
                            </Typography>
                            <Chip
                                icon={getStatusIcon(selectedRequest.estado)}
                                label={getStatusLabel(MECHANIC_STATUS, selectedRequest.estado)}
                                color={getStatusMeta(MECHANIC_STATUS, selectedRequest.estado).color}
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
                                    {formatDate(selectedRequest.fechaCompletado)}
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
            </AppDialog>

            {/* Modal de Cambio de Estado */}
            <AppDialog
                open={statusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                title="Cambiar estado de la solicitud"
                icon={<EditIcon />}
                size="sm"
                onSubmit={handleConfirmStatusChange}
                submitting={statusSaving}
                readOnly={!hasPermission('mecanica-actualizar-estado')}
            >
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <FormControl fullWidth>
                            <InputLabel>Estado</InputLabel>
                            <Select
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    label="Estado"
                                    MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
                                >
                                {toStatusOptions(MECHANIC_STATUS).map(({ value: key, label }) => (
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
                                label="Fecha de completado"
                                value={fechaCompletado}
                                onChange={(e) => setFechaCompletado(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                required
                            />
                        </Grid>
                    )}
                </Grid>
            </AppDialog>
        </PageContainer>
    );
};

export default MechanicRequestsPage;
