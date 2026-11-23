// src/pages/FailureMappingPage.jsx

import React, { useContext, useEffect, useState } from 'react';
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
    Chip,
    IconButton,
    Tooltip,
    Button,
    TextField,
    Divider,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
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
    PictureAsPdf as PictureAsPdfIcon,
    Edit as EditIcon,
    Add as AddIcon,
    ReportProblem as ReportProblemIcon,
} from '@mui/icons-material';
import moment from 'moment-timezone';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { getAllFailureMappings, getFailureMappingById, deleteFailureMapping, FAILURE_TYPES, INCIDENT_EVENT_TYPES } from '../services/failureMappingService';
import api from '../utils/axiosConfig';
import ClientSelector from '../components/ClientSelector';
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
import { F, YES_NO_OPTIONS, toPlateOptions, toRouteOptions } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import FailureMappingFormDialog from '../components/FailureMappingFormDialog';
import AppDialog from '../components/dialogs/AppDialog';
import { AuthContext } from '../context/AuthProvider';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { useCurrentDate } from '../hooks/useCurrentDate';
import { downloadBlob, readBlobError } from '../utils/download';
import { buildFileName } from '../utils/fileName';
import { Assignment as AssignmentIcon, AltRoute as AltRouteIcon, EventBusy as EventBusyIcon } from '@mui/icons-material';
import { StatCard, StatCardGrid } from '../components/StatCard';
import { loadCatalog } from '../services/catalogStore';

const NO_FAILURES_FILTER_VALUE = 'sin_fallas';

const FAILURE_TYPE_OPTIONS = [
    { value: NO_FAILURES_FILTER_VALUE, label: 'Sin fallas' },
    ...Object.entries(FAILURE_TYPES).map(([value, label]) => ({ value, label })),
];

// Columnas de la tabla
const COLUMNS = [
    { id: 'fecha', label: 'Fecha', sortable: true },
    { id: 'colegio', label: 'Colegio/Corp.', sortable: true },
    { id: 'tipo', label: 'Tipo', sortable: true },
    { id: 'placaBus', label: 'Placa', sortable: true },
    { id: 'numeroRuta', label: 'Ruta', sortable: true },
    { id: 'fueOperacional', label: 'Día Operacional', sortable: true, align: 'center' },
    { id: 'tipoFalla', label: 'Tipo de Falla', sortable: true },
    { id: 'routeAffected', label: 'Afectó Recorrido', sortable: true, align: 'center' },
    { id: 'pudoContinuarRuta', label: 'Continuó Ruta', sortable: true, align: 'center' },
    { id: 'registrado_por', label: 'Registrado por' },
    { id: 'acciones', label: 'Acciones', align: 'center' },
];

const FailureMappingPage = () => {
    const { currentDate } = useCurrentDate();
    const notify = useNotify();
    const confirm = useConfirm();
    const removeDiacritics = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizeLabel = (s = '') => removeDiacritics(String(s)).toLowerCase().trim();

    const { auth } = useContext(AuthContext);
    // Ingreso manual y edición completa: solo Gestor (roleId 1)
    const isGestor = Number(auth?.user?.roleId || 0) === 1;
    const [formOpen, setFormOpen] = useState(false);
    const [formRecord, setFormRecord] = useState(null);
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

    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.client({ schools, corporations }),
            F.plate({ options: toPlateOptions(buses) }),
            F.route({ options: toRouteOptions(schoolRoutes) }),
            F.select('tipoFalla', { label: 'Tipo de falla', options: FAILURE_TYPE_OPTIONS }),
            F.select('tipo', { label: 'Tipo', options: INCIDENT_EVENT_TYPES }),
            F.select('operacional', { label: 'Operacional', width: 'sm', options: YES_NO_OPTIONS }),
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
        operacional: selectedOperacional,
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

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        byTipoFalla: {},
        byTipo: {},
        withRouteAffected: 0,
        noOperacional: 0,
        colegios: 0,
        corporativos: 0,
    });
    const [exportingPdf, setExportingPdf] = useState(false);

    // Modal PDF
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfModalClient, setPdfModalClient] = useState(null);
    const pdfModalSchoolId = getClientSchoolId(pdfModalClient);
    const pdfModalCorporationId = getClientCorporationId(pdfModalClient);
    const [pdfModalMonth, setPdfModalMonth] = useState(moment(currentDate).startOf('month'));
    const [pdfModalSchools, setPdfModalSchools] = useState([]);

    // Indicadores extra (estructurados por secciones) para Resumen Ejecutivo del PDF
    const [pdfExtraSections, setPdfExtraSections] = useState([]);
    const [pdfAddMode, setPdfAddMode] = useState(null); // null | 'section' | 'indicator'
    const [pdfAddTargetSection, setPdfAddTargetSection] = useState(null); // index of section when adding indicator
    const [pdfAddLabel, setPdfAddLabel] = useState('');
    const [pdfAddValue, setPdfAddValue] = useState('');

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
    }, [page, rowsPerPage, selectedSchool, selectedCorporation, selectedPlate, selectedRoute, selectedTipoFalla, selectedTipo, selectedOperacional, selectedCicloEscolar, dates, orderBy, order]);

    const isSpecificCicloEscolarSelected = selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE;

    const fetchSchools = async () => {
        try {
            const schoolsList = await loadCatalog('schools', { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true });
            const schoolsData = schoolsList;
            setSchools(schoolsData);
        } catch (error) {
            console.error('Error al cargar colegios:', error);
            setSchools([]);
        }
    };

    const fetchCorporations = async () => {
        try {
            const corporationsList = await loadCatalog('corporations', getCicloEscolarFilterParams(draftCycle));
            const corporationsData = corporationsList;
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
            if (selectedOperacional !== '') {
                filters.fueOperacional = selectedOperacional;
            }
            // El rango de fechas del filtro solo entrega fechas completas y válidas (YYYY-MM-DD).
            if (dates.from) {
                filters.startDate = dates.from;
            }
            if (dates.to) {
                filters.endDate = dates.to;
            }
            filters.orderBy = orderBy;
            filters.order = order;

            const data = await getAllFailureMappings(filters);

            const incidentList = data.failureMappings || data.incidents || data.data || [];
            setIncidents(incidentList);
            setTotalCount(data.total || data.totalRecords || 0);

            setStatistics({
                total: Number(data.total || data.totalRecords || incidentList.length),
                byTipoFalla: data.countsByTipoFalla || {},
                byTipo: data.countsByTipo || {},
                withRouteAffected: Number(data.withRouteAffected || 0),
                noOperacional: Number(data.noOperacional || 0),
                colegios: Number(data.colegios || 0),
                corporativos: Number(data.corporativos || 0),
            });
        } catch (error) {
            console.error('Error al cargar mapeos de fallas:', error);
            notify.fromError(error, 'Error al cargar los mapeos de fallas');
        } finally {
            setLoading(false);
        }
    };

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchIncidents();
    }, [fetchIncidents]);


    const handleOpenPdfModal = () => {
        setPdfModalClient(null);
        setPdfModalMonth(moment(currentDate).startOf('month'));
        setPdfModalSchools([]);
        // Initialize default sections (Operación e Incidentes) and default Operación indicators
        setPdfExtraSections([
            { label: 'Operación', items: [ { label: 'Días con servicio', value: '' }, { label: 'Rutas', value: '' } ] },
            { label: 'Incidentes', items: [] }
        ]);
        setPdfAddMode(null);
        setPdfAddTargetSection(null);
        setPdfAddLabel('');
        setPdfAddValue('');
        setPdfModalOpen(true);
    };

    const handlePdfAddConfirm = () => {
        if (!pdfAddLabel.trim()) {
            return;
        }
        if (pdfAddMode === 'section') {
            setPdfExtraSections(prev => [...prev, { label: pdfAddLabel.trim(), items: [] }]);
        } else if (pdfAddMode === 'indicator' && Number.isInteger(pdfAddTargetSection)) {
            setPdfExtraSections(prev => {
                const next = prev.map((s, i) => ({ ...s }));
                const target = next[pdfAddTargetSection];
                if (target) {
                    target.items = [...(target.items || []), { label: pdfAddLabel.trim(), value: pdfAddValue.trim() }];
                }
                return next;
            });
        }
        setPdfAddMode(null);
        setPdfAddTargetSection(null);
        setPdfAddLabel('');
        setPdfAddValue('');
    };

    const handlePdfAddCancel = () => {
        setPdfAddMode(null);
        setPdfAddTargetSection(null);
        setPdfAddLabel('');
        setPdfAddValue('');
    };

    const handlePdfRemoveIndicator = (sectionIndex, indicatorIndex) => {
        setPdfExtraSections(prev => prev.map((s, i) => {
            if (i !== sectionIndex) {
                return s;
            }
            const nextItems = (s.items || []).filter((_, j) => j !== indicatorIndex);
            return { ...s, items: nextItems };
        }));
    };

    const handlePdfRemoveSection = (sectionIndex) => {
        // Prevent removing the two default sections (indices 0 and 1)
        if (sectionIndex === 0 || sectionIndex === 1) {
            return;
        }
        setPdfExtraSections(prev => prev.filter((_, i) => i !== sectionIndex));
    };

    const handleClosePdfModal = () => {
        setPdfModalOpen(false);
    };

    // Colegios de todos los ciclos para el modal: el selector de cliente los agrupa por ciclo
    const fetchPdfModalSchools = async () => {
        try {
            const schoolsList = await loadCatalog('schools', { allCycles: true, includeArchived: true });
            const schoolsData = schoolsList;
            setPdfModalSchools(schoolsData);
        } catch (error) {
            console.error('Error al cargar colegios para modal PDF:', error);
            setPdfModalSchools([]);
        }
    };

    useEffect(() => {
        if (pdfModalOpen) {
            fetchPdfModalSchools();
        }
    }, [pdfModalOpen]);

    const handleExportPDF = async () => {
        if (!pdfModalSchoolId && !pdfModalCorporationId) {
            notify.warning('Selecciona un cliente para generar el reporte');
            return;
        }
        if (!pdfModalMonth?.isValid()) {
            notify.warning('Selecciona un mes para generar el reporte');
            return;
        }
        setExportingPdf(true);
        try {
            const filters = {
                month: pdfModalMonth.format('YYYY-MM'),
            };
            if (pdfModalSchoolId) {
                filters.schoolId = pdfModalSchoolId;
            }
            if (pdfModalCorporationId) {
                filters.corporationId = pdfModalCorporationId;
            }
            if (Array.isArray(pdfExtraSections) && pdfExtraSections.length > 0) {
                filters.extraIndicators = JSON.stringify(pdfExtraSections);
            }

            const resp = await api.get('/reports/bus-incidents/pdf', { params: filters, responseType: 'blob' });
            const contentType = String(resp.headers['content-type'] || '').toLowerCase();

            const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data], { type: contentType || 'application/pdf' });
            if (!contentType.includes('application/pdf')) {
                const txt = await blob.text();
                let message = 'No se pudo generar el PDF.';
                try { const parsed = JSON.parse(txt); message = parsed?.message || parsed?.error || message; } catch (_) { message = (txt || '').slice(0, 240); }
                notify.error(`Error al generar el PDF: ${message}`);
                return;
            }

            // Validate PDF header
            const headerBuf = await blob.slice(0, 5).arrayBuffer();
            const header = new TextDecoder('utf-8').decode(headerBuf);
            if (header !== '%PDF-') {
                const txt = await blob.text();
                console.error('Respuesta del reporte PDF que no es un PDF:', (txt || '').slice(0, 240));
                notify.error('El archivo recibido no es un PDF válido');
                return;
            }

            const clientName = pdfModalSchoolId
                ? (pdfModalSchools.find(s => String(s.id) === pdfModalSchoolId)?.name || 'cliente')
                : (corporations.find(c => String(c.id) === pdfModalCorporationId)?.name || 'cliente');
            downloadBlob(blob, buildFileName({ object: 'mapeo fallas', client: clientName, date: pdfModalMonth.format('YYYY-MM'), extension: 'pdf' }));
            setPdfModalOpen(false);
        } catch (error) {
            console.error('Error descargando PDF:', error);
            notify.fromError(await readBlobError(error), 'Error al descargar el PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    const handleViewDetails = async (incidentId) => {
        setLoadingDetails(true);
        setDetailsOpen(true);
        try {
            const data = await getFailureMappingById(incidentId);
            setSelectedIncident(data);
        } catch (error) {
            console.error('Error al cargar detalles del mapeo:', error);
            notify.fromError(error, 'Error al cargar los detalles del mapeo de fallas');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedIncident(null);
    };

    const handleOpenCreateManual = () => {
        setFormRecord(null);
        setFormOpen(true);
    };

    const handleOpenEditFull = () => {
        setFormRecord(selectedIncident);
        setFormOpen(true);
    };

    const handleFormSaved = () => {
        notify.success(formRecord ? 'Registro actualizado' : 'Registro creado');
        setFormOpen(false);
        setFormRecord(null);
        fetchIncidents();
        if (detailsOpen && selectedIncident?.id) {
            handleViewDetails(selectedIncident.id);
        }
    };


    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Eliminar registro de mapeo de fallas',
            message: 'Se eliminará el registro. Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            tone: 'danger',
            onConfirm: () => deleteFailureMapping(id),
            errorMessage: 'Error al eliminar el mapeo de fallas',
        });
        if (ok) {
            notify.success('Registro eliminado');
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
                    title="Mapeo de Fallas"
                    subtitle="Depuración y registro de fallas reportadas por los supervisores"
                    actions={[
                        { key: 'pdf', label: 'Generar reporte PDF', group: 'download', loading: exportingPdf, tooltip: 'Selecciona el cliente y el mes para generar el reporte mensual.', onClick: handleOpenPdfModal },
                        isGestor && { key: 'create', label: 'Nuevo registro', icon: <AddIcon />, primary: true, permission: 'mapeo-fallas-crear', onClick: handleOpenCreateManual },
                    ]}
                />

                {/* Estadísticas */}
                <StatCardGrid columns={4}>
                    <StatCard
                        label="Total registros"
                        value={statistics.total}
                        icon={<AssignmentIcon />}
                        format="number"
                        hint={`${statistics.colegios} de colegios · ${statistics.corporativos} corporativos`}
                    />
                    <StatCard label="Accidentes" value={statistics.byTipo['accidente'] || 0} icon={<CrashIcon />} valueColor="error" format="number" />
                    <StatCard label="Afectó recorrido" value={statistics.withRouteAffected} icon={<AltRouteIcon />} format="number" />
                    <StatCard label="Días no operacionales" value={statistics.noOperacional} icon={<EventBusyIcon />} valueColor="warning.main" format="number" />
                </StatCardGrid>

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
                                                    {formatDate(incident?.fecha)}
                                                    {incident.esRetroactivo && (
                                                        <Chip label="Retroactivo" size="small" color="info" variant="outlined" sx={{ ml: 1 }} />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.colegio ? `${incident.colegio}${incident.cicloEscolarAnio ? ` ${incident.cicloEscolarAnio}` : ''}` : (incident.corporacion || 'N/A')}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.tipo === null ? (
                                                        <Chip label="N/A" size="small" sx={{ bgcolor: 'grey.300', color: 'text.primary' }} />
                                                    ) : (
                                                        <Chip
                                                            label={INCIDENT_EVENT_TYPES[incident.tipo] || incident.tipo}
                                                            size="small"
                                                            color={getTipoColor(incident.tipo)}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.allBuses ? 'TODOS' : (incident.placaBus || 'N/A')}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.numeroRuta || 'N/A'}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {incident.fueOperacional === false ? (
                                                        <Chip label="No" size="small" color="warning" />
                                                    ) : (
                                                        <Chip label="Sí" size="small" color="success" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.fueOperacional === false ? (
                                                        <Chip label="No aplica" size="small" />
                                                    ) : incident.noFallas ? (
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
                                                <TableCell align="center">
                                                    {incident.routeAffected === null ? (
                                                        <Chip label="N/A" size="small" />
                                                    ) : incident.routeAffected ? (
                                                        <Chip label="Sí" size="small" color="error" />
                                                    ) : (
                                                        <Chip label="No" size="small" color="success" />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {incident.pudoContinuarRuta === null ? (
                                                        <Chip label="N/A" size="small" />
                                                    ) : incident.pudoContinuarRuta ? (
                                                        <CheckCircleIcon color="success" fontSize="small" />
                                                    ) : (
                                                        <CancelIcon color="error" fontSize="small" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.supervisor?.name || incident.creator?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <RowActions
                                                        actions={[
                                                            { key: 'view', kind: 'view', color: 'primary', label: 'Ver detalles', icon: <VisibilityIcon fontSize="small" />, onClick: () => handleViewDetails(incident.id) },
                                                            { key: 'delete', kind: 'delete', label: 'Eliminar', icon: <DeleteIcon fontSize="small" />, permission: 'mapeo-fallas-eliminar', onClick: () => handleDelete(incident.id) },
                                                        ]}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {incidents.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={11} align="center">
                                                    No se encontraron registros
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
                <AppDialog
                    open={detailsOpen}
                    onClose={handleCloseDetails}
                    title="Detalle del mapeo de fallas"
                    icon={<ReportProblemIcon />}
                    size="md"
                    readOnly
                    extraActions={selectedIncident ? (
                        <PermissionGuard permission="mapeo-fallas-editar">
                            <Button onClick={handleOpenEditFull} startIcon={<EditIcon />} variant="outlined">
                                Editar registro
                            </Button>
                        </PermissionGuard>
                    ) : null}
                >
                    {loadingDetails ? (
                        <Box display="flex" justifyContent="center" p={3}>
                            <CircularProgress />
                        </Box>
                    ) : selectedIncident ? (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Fecha
                                    </Typography>
                                </Box>
                                <>
                                    <Typography variant="body1" gutterBottom>
                                        {formatDate(selectedIncident?.fecha)}
                                        {selectedIncident.esRetroactivo && (
                                            <Chip label="Retroactivo" size="small" color="info" variant="outlined" sx={{ ml: 1 }} />
                                        )}
                                    </Typography>
                                    <Typography variant="caption" display="block" color="textSecondary">
                                        {`Registrado el ${formatDateTime(selectedIncident.createdAt)}`}
                                    </Typography>
                                </>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Tipo de Evento
                                </Typography>
                                {selectedIncident.tipo === null ? (
                                    <Chip label="N/A" size="small" sx={{ mt: 1, bgcolor: 'grey.300', color: 'text.primary' }} />
                                ) : (
                                    <Chip
                                        label={INCIDENT_EVENT_TYPES[selectedIncident.tipo] || selectedIncident.tipo}
                                        color={getTipoColor(selectedIncident.tipo)}
                                        sx={{ mt: 1 }}
                                    />
                                )}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Tipo de Falla
                                </Typography>
                                {selectedIncident.fueOperacional === false || selectedIncident.tipoFalla === null ? (
                                    <Chip label="N/A" size="small" sx={{ mt: 1, bgcolor: 'grey.300', color: 'text.primary' }} />
                                ) : selectedIncident.noFallas ? (
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
                                    ¿Fue Operacional? (hubo clases)
                                </Typography>
                                {selectedIncident.fueOperacional === false ? (
                                    <Chip label="No" color="warning" size="small" sx={{ mt: 1 }} />
                                ) : (
                                    <Chip label="Sí" color="success" size="small" sx={{ mt: 1 }} />
                                )}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Placa del Bus
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIncident.allBuses ? 'TODOS' : (selectedIncident.placaBus || 'N/A')}
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
                                    {selectedIncident.colegio ? `${selectedIncident.colegio}${selectedIncident.cicloEscolarAnio ? ` ${selectedIncident.cicloEscolarAnio}` : ''}` : 'N/A'}
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
                                    Supervisor
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIncident.supervisor?.name || 'N/A'}
                                </Typography>
                            </Grid>
                            {selectedIncident.creator && (
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Ingresado manualmente por
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.creator.name}
                                    </Typography>
                                </Grid>
                            )}
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    ¿Afectó el Recorrido?
                                </Typography>
                                {selectedIncident.routeAffected === null ? (
                                    <Chip label="N/A" size="small" sx={{ mt: 1 }} />
                                ) : selectedIncident.routeAffected ? (
                                    <Chip label="Sí" color="error" size="small" sx={{ mt: 1 }} />
                                ) : (
                                    <Chip label="No" color="success" size="small" sx={{ mt: 1 }} />
                                )}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    ¿Pudo Continuar la Ruta?
                                </Typography>
                                {selectedIncident.pudoContinuarRuta === null ? (
                                    <Chip label="N/A" size="small" sx={{ mt: 1 }} />
                                ) : selectedIncident.pudoContinuarRuta ? (
                                    <Chip label="Sí" color="success" size="small" sx={{ mt: 1 }} />
                                ) : (
                                    <Chip label="No" color="error" size="small" sx={{ mt: 1 }} />
                                )}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    ¿Se Utilizó Bus Suplente?
                                </Typography>
                                {selectedIncident.seUtilizoBusSuplente === null ? (
                                    <Chip label="N/A" size="small" sx={{ mt: 1 }} />
                                ) : selectedIncident.seUtilizoBusSuplente ? (
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
                                        Descripción
                                    </Typography>
                                </Box>
                                <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                    <Typography variant="body1">
                                        {selectedIncident.descripcion || 'Sin descripción'}
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    ) : (
                        <Typography align="center" color="textSecondary">
                            No se pudieron cargar los detalles
                        </Typography>
                    )}
                </AppDialog>

                {/* Modal Generar PDF */}
                <AppDialog
                    open={pdfModalOpen}
                    onClose={handleClosePdfModal}
                    title="Generar reporte PDF"
                    icon={<PictureAsPdfIcon />}
                    size="sm"
                    onSubmit={handleExportPDF}
                    submitLabel="Generar PDF"
                    submitting={exportingPdf}
                    submitDisabled={(!pdfModalSchoolId && !pdfModalCorporationId) || !pdfModalMonth}
                >
                    <Box display="flex" flexDirection="column" gap={2}>
                        <ClientSelector
                            size="medium"
                            schools={pdfModalSchools}
                            corporations={corporations}
                            value={pdfModalClient}
                            onChange={setPdfModalClient}
                        />
                        <DatePicker
                            label="Mes del reporte"
                            value={pdfModalMonth}
                            onChange={(val) => setPdfModalMonth(val)}
                            views={['year', 'month']}
                            openTo="month"
                            slotProps={{ textField: { fullWidth: true } }}
                        />

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                Indicadores Resumen Ejecutivo
                            </Typography>
                            <Typography variant="caption" color="textSecondary" display="block" mb={1}>
                                Agrega indicadores dentro de cada sección. Las secciones "Operación" e "Incidentes" siempre aparecen.
                            </Typography>

                            {/* Secciones */}
                            {pdfExtraSections.map((section, sIdx) => (
                                <Box key={sIdx} mb={1}>
                                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} sx={{ bgcolor: '#e8eef7', px: 1.25, py: 0.75, borderRadius: 1 }}>
                                        <Typography variant="body2" fontWeight={700} color="#1f4e79">
                                            {section.label}
                                        </Typography>
                                        <Box display="flex" gap={1}>
                                            <Button size="small" variant="outlined" onClick={() => { setPdfAddMode('indicator'); setPdfAddTargetSection(sIdx); setPdfAddLabel(''); setPdfAddValue(''); }}>
                                                Agregar indicador
                                            </Button>
                                            {sIdx > 1 && (
                                                <Button size="small" color="error" variant="text" onClick={() => handlePdfRemoveSection(sIdx)}>
                                                    Eliminar sección
                                                </Button>
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Indicadores de la sección */}
                                    {(section.items || []).length > 0 && (
                                        <Box display="flex" flexDirection="column" gap={0.5} mt={0.5}>
                                            {section.items.map((it, idx) => {
                                                const isOper = normalizeLabel(section.label) === 'operacion';
                                                const nl = normalizeLabel(it.label);
                                                const isDefaultOpIndicator = isOper && (nl === 'dias con servicio' || nl === 'rutas');
                                                if (isDefaultOpIndicator) {
                                                    return (
                                                        <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ bgcolor: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 1, px: 1.5, py: 0.75 }}>
                                                            <Typography variant="body2" sx={{ minWidth: 180 }}>{it.label}</Typography>
                                                            <TextField
                                                                size="small"
                                                                value={it.value || ''}
                                                                onChange={(e) => {
                                                                    const v = e.target.value;
                                                                    setPdfExtraSections(prev => prev.map((s, i) => {
                                                                        if (i !== sIdx) {
                                                                            return s;
                                                                        }
                                                                        const next = { ...s, items: (s.items || []).map((x, j) => j === idx ? ({ ...x, value: v }) : x) };
                                                                        return next;
                                                                    }));
                                                                }}
                                                                sx={{ flex: 1 }}
                                                            />
                                                        </Box>
                                                    );
                                                }

                                                return (
                                                    <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ bgcolor: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 1, px: 1.5, py: 0.75 }}>
                                                        <Typography variant="body2" flex={1}>
                                                            <strong>{it.label}:</strong>{it.value ? ` ${it.value}` : ''}
                                                        </Typography>
                                                        <Tooltip title="Eliminar">
                                                            <IconButton size="small" onClick={() => handlePdfRemoveIndicator(sIdx, idx)} color="error">
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    )}

                                    {/* Inline add form for this section */}
                                    {pdfAddMode === 'indicator' && pdfAddTargetSection === sIdx && (
                                        <Box display="flex" flexDirection="column" gap={1} mt={1} sx={{ border: '1px dashed #90caf9', borderRadius: 1, p: 1.25 }}>
                                            <TextField label="Nombre del indicador" value={pdfAddLabel} onChange={(e) => setPdfAddLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (pdfAddLabel.trim()) { handlePdfAddConfirm(); } } }} size="small" fullWidth autoFocus />
                                            <TextField label="Valor" value={pdfAddValue} onChange={(e) => setPdfAddValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (pdfAddLabel.trim()) { handlePdfAddConfirm(); } } }} size="small" fullWidth />
                                            <Box display="flex" gap={1}>
                                                <Button size="small" variant="contained" onClick={handlePdfAddConfirm} disabled={!pdfAddLabel.trim()}>
                                                    Agregar
                                                </Button>
                                                <Button size="small" variant="outlined" onClick={handlePdfAddCancel}>
                                                    Cancelar
                                                </Button>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            ))}

                            {/* Agregar nueva sección */}
                            {!pdfAddMode && (
                                <Box display="flex" gap={1} mt={1}>
                                    <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => { setPdfAddMode('section'); setPdfAddLabel(''); }}>
                                        Agregar sección
                                    </Button>
                                </Box>
                            )}

                            {/* Formulario para nueva sección */}
                            {pdfAddMode === 'section' && (
                                <Box display="flex" flexDirection="column" gap={1} mt={1} sx={{ border: '1px dashed #90caf9', borderRadius: 1, p: 1.25 }}>
                                    <TextField label="Nombre de la sección" value={pdfAddLabel} onChange={(e) => setPdfAddLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (pdfAddLabel.trim()) { handlePdfAddConfirm(); } } }} size="small" fullWidth autoFocus />
                                    <Box display="flex" gap={1}>
                                        <Button size="small" variant="contained" onClick={handlePdfAddConfirm} disabled={!pdfAddLabel.trim()}>
                                            Agregar sección
                                        </Button>
                                        <Button size="small" variant="outlined" onClick={handlePdfAddCancel}>
                                            Cancelar
                                        </Button>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </AppDialog>

                <FailureMappingFormDialog
                    open={formOpen}
                    onClose={() => { setFormOpen(false); setFormRecord(null); }}
                    onSaved={handleFormSaved}
                    record={formRecord}
                />
            </PageContainer>
        </LocalizationProvider>
    );
};

export default FailureMappingPage;
