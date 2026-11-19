// src/pages/BusIncidentsPage.jsx

import React, { useEffect, useState } from 'react';
import {
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableRow,
    CircularProgress,
    Box,
    Grid,
    Card,
    CardContent,
    Chip,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
} from '@mui/material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import {
    Visibility as VisibilityIcon,
    Delete as DeleteIcon,
    Warning as WarningIcon,
    Build as BuildIcon,
    ElectricalServices as ElectricalIcon,
    CarCrash as CrashIcon,
    HelpOutline as OtherIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import moment from 'moment-timezone';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { getAllBusIncidents, getBusIncidentById, deleteBusIncident, updateBusIncident, FAILURE_TYPES, INCIDENT_EVENT_TYPES } from '../services/busIncidentService';
import api from '../utils/axiosConfig';
import { getClientSchoolId, getClientCorporationId } from '../utils/clientValue';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import PermissionGuard from '../components/PermissionGuard';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F, toPlateOptions, toRouteOptions } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import { formatDateTime } from '../utils/dateFormat';

const NO_FAILURES_FILTER_VALUE = 'sin_fallas';

const FAILURE_TYPE_OPTIONS = [
    { value: NO_FAILURES_FILTER_VALUE, label: 'Sin fallas' },
    ...Object.entries(FAILURE_TYPES).map(([value, label]) => ({ value, label })),
];

// Columnas de la tabla
const COLUMNS = [
    { id: 'fecha', label: 'Fecha', sortable: true },
    { id: 'tipo', label: 'Tipo', sortable: true },
    { id: 'tipoFalla', label: 'Tipo de Falla', sortable: true },
    { id: 'placaBus', label: 'Placa', sortable: true },
    { id: 'numeroRuta', label: 'Ruta', sortable: true },
    { id: 'colegio', label: 'Colegio/Corp.', sortable: true },
    { id: 'piloto', label: 'Piloto' },
    { id: 'routeAffected', label: 'Afectó Recorrido', sortable: true, align: 'center' },
    { id: 'pudoContinuarRuta', label: 'Continuó Ruta', sortable: true, align: 'center' },
    { id: 'acciones', label: 'Acciones', align: 'center' },
];

const BusIncidentsPage = () => {
    const notify = useNotify();
    const confirm = useConfirm();
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    // Paginación y orden (en el servidor)
    const table = useTableState({ defaultOrderBy: 'fecha', defaultOrder: 'desc' });
    const { page, rowsPerPage, orderBy, order } = table;
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [buses, setBuses] = useState([]);
    const [schoolRoutes, setSchoolRoutes] = useState([]);

    // Los filtros solo consultan al aplicar; las opciones (colegios, placas, rutas) siguen al borrador.
    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.client({ schools, corporations }),
            F.plate({ options: toPlateOptions(buses) }),
            F.route({ options: toRouteOptions(schoolRoutes) }),
            F.select('tipoFalla', { label: 'Tipo de falla', options: FAILURE_TYPE_OPTIONS }),
            F.select('tipo', { label: 'Tipo', options: INCIDENT_EVENT_TYPES }),
            F.dateRange('dates'),
        ],
        onApplied: table.resetPage,
    });
    const {
        cycle: selectedCicloEscolar,
        client: selectedClient,
        plate: selectedPlate,
        route: selectedRoute,
        tipoFalla: selectedTipoFalla,
        tipo: selectedTipo,
        dates,
    } = pageFilters.applied;
    const selectedSchool = getClientSchoolId(selectedClient);
    const selectedCorporation = getClientCorporationId(selectedClient);
    const draftCycle = pageFilters.draft.cycle;
    const draftSchoolId = getClientSchoolId(pageFilters.draft.client);
    const draftCorporationId = getClientCorporationId(pageFilters.draft.client);

    // Ordenamiento

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Modal de eliminación

    // Edición de descripción
    const [editingDescription, setEditingDescription] = useState(false);
    const [descriptionValue, setDescriptionValue] = useState('');
    const [savingDescription, setSavingDescription] = useState(false);

    // Edición de fecha
    const [editingFecha, setEditingFecha] = useState(false);
    const [fechaValue, setFechaValue] = useState(null);
    const [savingFecha, setSavingFecha] = useState(false);

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        byTipoFalla: {},
        byTipo: {},
        withImpact: 0,
        colegios: 0,
        corporativos: 0,
    });

    useEffect(() => {
        fetchSchools();
        fetchCorporations();
    }, [draftCycle]);

    useEffect(() => {
        if (draftSchoolId) {
            fetchBusesBySchool(draftSchoolId);
            fetchRouteNumbersBySchool(draftSchoolId);
        } else if (draftCorporationId) {
            fetchBusesByCorporation(draftCorporationId);
            fetchRouteNumbersByCorporation(draftCorporationId);
        } else {
            setBuses([]);
            setSchoolRoutes([]);
        }
    }, [draftSchoolId, draftCorporationId]);

    useEffect(() => {
        fetchIncidents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedCorporation, selectedPlate, selectedRoute, selectedTipoFalla, selectedTipo, selectedCicloEscolar, dates, orderBy, order]);

    const fetchSchools = async () => {
        try {
            const response = await api.get('/schools', { params: { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true } });
            const schoolsData = Array.isArray(response.data) ? response.data : (response.data?.schools || []);
            setSchools(schoolsData);
        } catch (error) {
            console.error('Error al cargar colegios:', error);
            setSchools([]);
        }
    };

    const isSpecificCicloEscolarSelected = selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE;

    const fetchCorporations = async () => {
        try {
            const response = await api.get('/corporations', { params: getCicloEscolarFilterParams(draftCycle) });
            const corporationsData = Array.isArray(response.data) ? response.data : (response.data?.corporations || []);
            setCorporations(corporationsData);
        } catch (error) {
            console.error('Error al cargar corporaciones:', error);
            setCorporations([]);
        }
    };

    const fetchBusesBySchool = async (schoolId) => {
        try {
            const response = await api.get(`/buses/school/${schoolId}`);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    const fetchBusesByCorporation = async (corporationId) => {
        try {
            const response = await api.get(`/buses/corporation/${corporationId}`);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    const fetchRouteNumbersBySchool = async (schoolId) => {
        try {
            const response = await api.get(`/routes/school/${schoolId}/numbers`);
            const numbers = Array.isArray(response.data?.routeNumbers) ? response.data.routeNumbers : (response.data?.routeNumbers || []);
            setSchoolRoutes(numbers);
        } catch (error) {
            console.error('Error al cargar números de ruta:', error);
            setSchoolRoutes([]);
        }
    };

    const fetchRouteNumbersByCorporation = async (corporationId) => {
        try {
            const response = await api.get(`/routes/corporation/${corporationId}/numbers`);
            const numbers = Array.isArray(response.data?.routeNumbers) ? response.data.routeNumbers : (response.data?.routeNumbers || []);
            setSchoolRoutes(numbers);
        } catch (error) {
            console.error('Error al cargar números de ruta:', error);
            setSchoolRoutes([]);
        }
    };

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const filters = {
                page: page + 1,
                limit: rowsPerPage,
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
            };

            if (selectedSchool) {
                filters.schoolId = selectedSchool;
            }
            if (selectedCorporation) {
                filters.corporationId = selectedCorporation;
            }
            if (selectedPlate) {
                filters.plate = selectedPlate;
            }
            if (selectedRoute) {
                filters.routeNumber = selectedRoute;
            }
            if (selectedTipoFalla) {
                if (selectedTipoFalla === NO_FAILURES_FILTER_VALUE) {
                    filters.noFallas = true;
                } else {
                    filters.tipoFalla = selectedTipoFalla;
                }
            }
            if (selectedTipo) {
                filters.tipo = selectedTipo;
            }
            if (dates.from) {
                filters.startDate = dates.from;
            }
            if (dates.to) {
                filters.endDate = dates.to;
            }
            filters.orderBy = orderBy;
            filters.order = order;

            const data = await getAllBusIncidents(filters);

            const incidentList = data.incidents || data.data || [];
            setIncidents(incidentList);
            setTotalCount(data.total || data.totalIncidents || 0);

            // Calcular estadísticas
            if (data.countsByTipoFalla || data.countsByTipo || data.withImpact !== undefined) {
                setStatistics({
                    total: Number(data.totalIncidents || data.total || incidentList.length),
                    byTipoFalla: data.countsByTipoFalla || {},
                    byTipo: data.countsByTipo || {},
                    withRouteAffected: Number(data.withRouteAffected || 0),
                    colegios: Number(data.colegios || 0),
                    corporativos: Number(data.corporativos || 0),
                });
            } else {
                // Fallback: calcular desde la página
                if (incidentList.length > 0) {
                    const byTipoFalla = {};
                    const byTipo = {};
                    let withRouteAffected = 0;

                    incidentList.forEach(incident => {
                        const tipoFalla = incident.tipoFalla || 'sin_falla';
                        const tipo = incident.tipo || 'incidente';

                        byTipoFalla[tipoFalla] = (byTipoFalla[tipoFalla] || 0) + 1;
                        byTipo[tipo] = (byTipo[tipo] || 0) + 1;

                        if (incident.routeAffected) {
                            withRouteAffected++;
                        }
                    });

                    setStatistics({
                        total: data.total || incidentList.length,
                        byTipoFalla,
                        byTipo,
                        withRouteAffected,
                    });
                } else {
                    setStatistics({
                        total: 0,
                        byTipoFalla: {},
                        byTipo: {},
                        withImpact: 0,
                    });
                }
            }
        } catch (error) {
            console.error('Error al cargar incidentes:', error);
            notify.fromError(error, 'Error al cargar los incidentes');
        } finally {
            setLoading(false);
        }
    };

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchIncidents();
    }, [fetchIncidents]);


    const handleViewDetails = async (incidentId) => {
        setLoadingDetails(true);
        setDetailsOpen(true);
        try {
            const data = await getBusIncidentById(incidentId);
            setSelectedIncident(data);
        } catch (error) {
            console.error('Error al cargar detalles del incidente:', error);
            notify.fromError(error, 'Error al cargar los detalles del incidente');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedIncident(null);
        setEditingDescription(false);
        setDescriptionValue('');
        setEditingFecha(false);
        setFechaValue(null);
    };

    const handleStartEditDescription = () => {
        setDescriptionValue(selectedIncident?.descripcion || '');
        setEditingDescription(true);
    };

    const handleStartEditFecha = () => {
        setFechaValue(selectedIncident?.fecha ? moment(selectedIncident.fecha) : moment());
        setEditingFecha(true);
    };

    const handleCancelEditFecha = () => {
        setEditingFecha(false);
        setFechaValue(null);
    };

    const handleSaveFecha = async () => {
        if (!selectedIncident || !fechaValue) {
            return;
        }
        setSavingFecha(true);
        try {
            await updateBusIncident(selectedIncident.id, { fecha: fechaValue.toISOString() });
            setSelectedIncident(prev => ({ ...prev, fecha: fechaValue.toISOString() }));
            setEditingFecha(false);
            setFechaValue(null);
            notify.success('Fecha guardada');
        } catch (error) {
            console.error('Error al guardar fecha:', error);
            notify.fromError(error, 'Error al guardar la fecha');
        } finally {
            setSavingFecha(false);
        }
    };

    const handleCancelEditDescription = () => {
        setEditingDescription(false);
        setDescriptionValue('');
    };

    const handleSaveDescription = async () => {
        if (!selectedIncident) {
            return;
        }
        setSavingDescription(true);
        try {
            await updateBusIncident(selectedIncident.id, { descripcion: descriptionValue });
            setSelectedIncident(prev => ({ ...prev, descripcion: descriptionValue }));
            setEditingDescription(false);
            setDescriptionValue('');
            notify.success('Descripción guardada');
        } catch (error) {
            console.error('Error al guardar descripción:', error);
            notify.fromError(error, 'Error al guardar la descripción');
        } finally {
            setSavingDescription(false);
        }
    };


    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Eliminar incidente',
            message: 'Se eliminará el incidente. Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            tone: 'danger',
            onConfirm: () => deleteBusIncident(id),
            errorMessage: 'Error al eliminar el incidente',
        });
        if (ok) {
            notify.success('Incidente eliminado');
            fetchIncidents();
        }
    };

    const getTipoFallaIcon = (tipoFalla) => {
        switch (tipoFalla) {
            case 'mecánico':
                return <BuildIcon fontSize="small" />;
            case 'eléctrico':
                return <ElectricalIcon fontSize="small" />;
            case 'choque':
                return <CrashIcon fontSize="small" />;
            case 'otro':
                return <OtherIcon fontSize="small" />;
            default:
                return <WarningIcon fontSize="small" />;
        }
    };

    const getTipoFallaColor = (tipoFalla) => {
        switch (tipoFalla) {
            case 'mecánico':
                return 'warning';
            case 'eléctrico':
                return 'info';
            case 'choque':
                return 'error';
            case 'otro':
                return 'default';
            default:
                return 'default';
        }
    };

    const getTipoColor = (tipo) => {
        return tipo === 'accidente' ? 'error' : 'warning';
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <PageContainer width="xl">
                <PageHeader
                    eyebrow={MODULE_GROUPS.buses}
                    title="Incidentes de Pilotos"
                    subtitle="Visualiza y analiza los incidentes y accidentes reportados por los pilotos"
                />

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Incidentes
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.total}
                                </Typography>
                                <Typography variant="caption" color="textSecondary" display="block">
                                    {statistics.colegios || 0} de colegios · {statistics.corporativos || 0} corporativos
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Tipo de Falla Más Común
                                </Typography>
                                <Typography variant="h6">
                                    {Object.keys(statistics.byTipoFalla).length > 0
                                        ? FAILURE_TYPES[Object.keys(statistics.byTipoFalla).reduce((a, b) => 
                                            statistics.byTipoFalla[a] > statistics.byTipoFalla[b] ? a : b
                                        )] || 'Sin Falla'
                                        : 'N/A'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Accidentes
                                </Typography>
                                <Typography variant="h4" color="error">
                                    {statistics.byTipo['accidente'] || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Afectó Recorrido
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.withRouteAffected}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filtros */}
                <FilterBar
                    {...pageFilters.barProps}
                    loading={loading}
                    caption={isSpecificCicloEscolarSelected
                        ? 'Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.'
                        : undefined}
                />

                {/* Tabla */}
                <Paper>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" p={5}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <AppTableContainer>
                                <Table sx={{ minWidth: 1100 }}>
                                    <SortableTableHead columns={COLUMNS} {...table.sortProps} />
                                    <TableBody>
                                        {incidents.map((incident) => (
                                            <TableRow key={incident.id}>
                                                <TableCell>
                                                    {formatDateTime(incident.fecha)}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={INCIDENT_EVENT_TYPES[incident.tipo] || incident.tipo}
                                                        size="small"
                                                        color={getTipoColor(incident.tipo)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {incident.noFallas ? (
                                                        <Chip 
                                                            label="Sin Fallas"
                                                            size="small"
                                                            color="success"
                                                            icon={<CheckCircleIcon />}
                                                        />
                                                    ) : (
                                                        <Chip 
                                                            label={incident.tipoFalla === 'otro' && incident.otroFallaDetalle 
                                                                ? `Otro: ${incident.otroFallaDetalle}`
                                                                : FAILURE_TYPES[incident.tipoFalla] || incident.tipoFalla}
                                                            size="small"
                                                            color={getTipoFallaColor(incident.tipoFalla)}
                                                            icon={getTipoFallaIcon(incident.tipoFalla)}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.placaBus || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.numeroRuta || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.colegio || incident.corporacion || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.piloto?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {incident.routeAffected ? (
                                                        <Chip label="Sí" size="small" color="error" />
                                                    ) : (
                                                        <Chip label="No" size="small" color="success" />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {incident.pudoContinuarRuta ? (
                                                        <CheckCircleIcon color="success" fontSize="small" />
                                                    ) : (
                                                        <CancelIcon color="error" fontSize="small" />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <RowActions
                                                        actions={[
                                                            { key: 'view', kind: 'view', color: 'primary', label: 'Ver detalles', icon: <VisibilityIcon fontSize="small" />, onClick: () => handleViewDetails(incident.id) },
                                                            { key: 'delete', kind: 'delete', label: 'Eliminar', icon: <DeleteIcon fontSize="small" />, permission: 'incidentes-buses-eliminar', onClick: () => handleDelete(incident.id) },
                                                        ]}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {incidents.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={10} align="center">
                                                    No se encontraron incidentes
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </AppTableContainer>
                            <AppTablePagination count={totalCount} {...table.paginationProps} />
                        </>
                    )}
                </Paper>

                {/* Modal de Detalles */}
                <Dialog
                    open={detailsOpen}
                    onClose={handleCloseDetails}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>Detalles del Incidente</DialogTitle>
                    <DialogContent dividers>
                        {loadingDetails ? (
                            <Box display="flex" justifyContent="center" p={3}>
                                <CircularProgress />
                            </Box>
                        ) : selectedIncident ? (
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Fecha y Hora
                                        </Typography>
                                        {!editingFecha && (
                                            <PermissionGuard permission="incidentes-buses-editar">
                                                <Tooltip title="Editar fecha y hora">
                                                    <IconButton size="small" onClick={handleStartEditFecha}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </PermissionGuard>
                                        )}
                                    </Box>
                                    {editingFecha ? (
                                        <Box mt={1}>
                                            <LocalizationProvider dateAdapter={AdapterMoment}>
                                                <DateTimePicker
                                                    value={fechaValue}
                                                    onChange={(val) => setFechaValue(val)}
                                                    disabled={savingFecha}
                                                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                                    ampm
                                                />
                                            </LocalizationProvider>
                                            <Box display="flex" gap={1} mt={1}>
                                                <PermissionGuard permission="incidentes-buses-editar">
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={savingFecha ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                                                        onClick={handleSaveFecha}
                                                        disabled={savingFecha || !fechaValue}
                                                    >
                                                        Guardar
                                                    </Button>
                                                </PermissionGuard>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<CancelIcon />}
                                                    onClick={handleCancelEditFecha}
                                                    disabled={savingFecha}
                                                >
                                                    Cancelar
                                                </Button>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Typography variant="body1" gutterBottom>
                                            {formatDateTime(selectedIncident.fecha)}
                                        </Typography>
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Tipo de Evento
                                    </Typography>
                                    <Chip 
                                        label={INCIDENT_EVENT_TYPES[selectedIncident.tipo] || selectedIncident.tipo}
                                        color={getTipoColor(selectedIncident.tipo)}
                                        sx={{ mt: 1 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Tipo de Falla
                                    </Typography>
                                    {selectedIncident.noFallas ? (
                                        <Chip 
                                            label="Sin Fallas Reportadas"
                                            color="success"
                                            icon={<CheckCircleIcon />}
                                            sx={{ mt: 1 }}
                                        />
                                    ) : (
                                        <Chip 
                                            label={selectedIncident.tipoFalla === 'otro' && selectedIncident.otroFallaDetalle 
                                                ? `Otro: ${selectedIncident.otroFallaDetalle}`
                                                : FAILURE_TYPES[selectedIncident.tipoFalla] || selectedIncident.tipoFalla}
                                            color={getTipoFallaColor(selectedIncident.tipoFalla)}
                                            icon={getTipoFallaIcon(selectedIncident.tipoFalla)}
                                            sx={{ mt: 1 }}
                                        />
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Placa del Bus
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.placaBus || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Número de Ruta
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.numeroRuta || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Colegio
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.colegio || 'N/A'}
                                    </Typography>
                                </Grid>
                                {selectedIncident.corporacion && (
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Corporación
                                        </Typography>
                                        <Typography variant="body1" gutterBottom>
                                            {selectedIncident.corporacion}
                                        </Typography>
                                    </Grid>
                                )}
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Piloto
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.piloto?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        ¿Afectó el Recorrido?
                                    </Typography>
                                    {selectedIncident.routeAffected ? (
                                        <Chip label="Sí" color="error" size="small" sx={{ mt: 1 }} />
                                    ) : (
                                        <Chip label="No" color="success" size="small" sx={{ mt: 1 }} />
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        ¿Pudo Continuar la Ruta?
                                    </Typography>
                                    {selectedIncident.pudoContinuarRuta ? (
                                        <Chip label="Sí" color="success" size="small" sx={{ mt: 1 }} />
                                    ) : (
                                        <Chip label="No" color="error" size="small" sx={{ mt: 1 }} />
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        ¿Se Utilizó Bus Suplente?
                                    </Typography>
                                    {selectedIncident.seUtilizoBusSuplente ? (
                                        <Chip label="Sí" color="warning" size="small" sx={{ mt: 1 }} />
                                    ) : (
                                        <Chip label="No" color="default" size="small" sx={{ mt: 1 }} />
                                    )}
                                </Grid>
                                {selectedIncident.allBuses && (
                                    <Grid item xs={12}>
                                        <Chip 
                                            label="Aplica para todos los buses" 
                                            color="info" 
                                            sx={{ mt: 1 }} 
                                        />
                                    </Grid>
                                )}
                                <Grid item xs={12}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Descripción del Incidente
                                        </Typography>
                                        {!editingDescription && (
                                            <PermissionGuard permission="incidentes-buses-editar">
                                                <Tooltip title="Editar descripción">
                                                    <IconButton size="small" onClick={handleStartEditDescription}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </PermissionGuard>
                                        )}
                                    </Box>
                                    {editingDescription ? (
                                        <Box mt={1}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                minRows={3}
                                                value={descriptionValue}
                                                onChange={(e) => setDescriptionValue(e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                disabled={savingDescription}
                                            />
                                            <Box display="flex" gap={1} mt={1}>
                                                <PermissionGuard permission="incidentes-buses-editar">
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={savingDescription ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                                                        onClick={handleSaveDescription}
                                                        disabled={savingDescription}
                                                    >
                                                        Guardar
                                                    </Button>
                                                </PermissionGuard>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<CancelIcon />}
                                                    onClick={handleCancelEditDescription}
                                                    disabled={savingDescription}
                                                >
                                                    Cancelar
                                                </Button>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                            <Typography variant="body1">
                                                {selectedIncident.descripcion || 'Sin descripción'}
                                            </Typography>
                                        </Paper>
                                    )}
                                </Grid>
                            </Grid>
                        ) : (
                            <Typography align="center" color="textSecondary">
                                No se pudieron cargar los detalles
                            </Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDetails} color="primary">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>
            </PageContainer>
        </LocalizationProvider>
    );
};

export default BusIncidentsPage;
