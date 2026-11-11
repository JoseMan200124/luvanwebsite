// src/pages/FailureMappingPage.jsx

import React, { useContext, useEffect, useState } from 'react';
import {
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TableSortLabel,
    CircularProgress,
    Box,
    Grid,
    Card,
    CardContent,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
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
} from '@mui/icons-material';
import moment from 'moment-timezone';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import tw from 'twin.macro';
import { getAllFailureMappings, getFailureMappingById, deleteFailureMapping, FAILURE_TYPES, INCIDENT_EVENT_TYPES } from '../services/failureMappingService';
import api from '../utils/axiosConfig';
import ClientSelector, { getClientSchoolId, getClientCorporationId } from '../components/ClientSelector';
import CicloEscolarFilter, { ALL_CYCLES_VALUE, getCicloEscolarFilterParams, getInitialCicloEscolarFilter } from '../components/CicloEscolarFilter';
import PermissionGuard from '../components/PermissionGuard';
import FailureMappingFormDialog from '../components/FailureMappingFormDialog';
import { AuthContext } from '../context/AuthProvider';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;
const NO_FAILURES_FILTER_VALUE = 'sin_fallas';

const FailureMappingPage = () => {
    const removeDiacritics = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizeLabel = (s = '') => removeDiacritics(String(s)).toLowerCase().trim();

    const { auth } = useContext(AuthContext);
    // Ingreso manual y edición completa: solo Gestor (roleId 1)
    const isGestor = Number(auth?.user?.roleId || 0) === 1;
    const [formOpen, setFormOpen] = useState(false);
    const [formRecord, setFormRecord] = useState(null);
    // Un registro pertenece a un día: la fecha se muestra sin hora (la hora de captura es createdAt).
    const formatFechaRegistro = (r) => moment(r?.fecha, 'YYYY-MM-DD').format('DD/MM/YYYY');

    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [buses, setBuses] = useState([]);
    const [schoolRoutes, setSchoolRoutes] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const selectedSchool = getClientSchoolId(selectedClient);
    const selectedCorporation = getClientCorporationId(selectedClient);
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedTipoFalla, setSelectedTipoFalla] = useState('');
    const [selectedTipo, setSelectedTipo] = useState('');
    const [selectedOperacional, setSelectedOperacional] = useState('');
    const [selectedCicloEscolar, setSelectedCicloEscolar] = useState(getInitialCicloEscolarFilter);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // Ordenamiento
    const [orderBy, setOrderBy] = useState('fecha');
    const [order, setOrder] = useState('desc');

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Modal de eliminación
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

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
    const [pdfModalMonth, setPdfModalMonth] = useState(moment().startOf('month'));
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
    }, [selectedCicloEscolar]);

    useEffect(() => {
        if (selectedSchool) {
            fetchBusesBySchool(selectedSchool);
            fetchRouteNumbersBySchool(selectedSchool);
        } else if (selectedCorporation) {
            fetchBusesByCorporation(selectedCorporation);
            fetchRouteNumbersByCorporation(selectedCorporation);
        } else {
            setBuses([]);
            setSchoolRoutes([]);
        }
    }, [selectedSchool, selectedCorporation]);

    useEffect(() => {
        fetchIncidents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedCorporation, selectedPlate, selectedRoute, selectedTipoFalla, selectedTipo, selectedOperacional, selectedCicloEscolar, startDate, endDate, orderBy, order]);

    const isSpecificCicloEscolarSelected = selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE;

    const fetchSchools = async () => {
        try {
            const response = await api.get('/schools', { params: { ...getCicloEscolarFilterParams(selectedCicloEscolar), includeArchived: true } });
            const schoolsData = Array.isArray(response.data) ? response.data : (response.data?.schools || []);
            setSchools(schoolsData);
        } catch (error) {
            console.error('Error al cargar colegios:', error);
            setSchools([]);
        }
    };

    const fetchCorporations = async () => {
        try {
            const response = await api.get('/corporations', { params: getCicloEscolarFilterParams(selectedCicloEscolar) });
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
            if (selectedOperacional !== '') {
                filters.fueOperacional = selectedOperacional;
            }
            // Mientras se escribe, el selector entrega fechas incompletas (inválidas): no se filtra con ellas
            if (startDate?.isValid()) {
                filters.startDate = startDate.format('YYYY-MM-DD');
            }
            if (endDate?.isValid()) {
                filters.endDate = endDate.format('YYYY-MM-DD');
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
        } finally {
            setLoading(false);
        }
    };

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchIncidents();
    }, [fetchIncidents]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(Number.parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleOpenPdfModal = () => {
        setPdfModalClient(null);
        setPdfModalMonth(moment().startOf('month'));
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
            const response = await api.get('/schools', { params: { allCycles: true, includeArchived: true } });
            const schoolsData = Array.isArray(response.data) ? response.data : (response.data?.schools || []);
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
            alert('Selecciona un cliente para generar el reporte.');
            return;
        }
        if (!pdfModalMonth?.isValid()) {
            alert('Selecciona un mes para generar el reporte.');
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
                alert(`Error generando PDF: ${message}`);
                return;
            }

            // Validate PDF header
            const headerBuf = await blob.slice(0, 5).arrayBuffer();
            const header = new TextDecoder('utf-8').decode(headerBuf);
            if (header !== '%PDF-') {
                const txt = await blob.text();
                alert('El archivo recibido no es un PDF válido. ' + (txt || '').slice(0, 240));
                return;
            }

            const url = window.URL.createObjectURL(blob);
            const clientName = pdfModalSchoolId
                ? (pdfModalSchools.find(s => String(s.id) === pdfModalSchoolId)?.name || 'cliente')
                : (corporations.find(c => String(c.id) === pdfModalCorporationId)?.name || 'cliente');
            const filename = `mapeo_fallas_${clientName.replace(/\s+/g, '_')}_${pdfModalMonth.format('YYYY-MM')}.pdf`;
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setPdfModalOpen(false);
        } catch (error) {
            console.error('Error descargando PDF:', error);
            alert('Error al descargar el PDF. Revisar consola.');
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
            alert('Error al cargar los detalles del mapeo de fallas');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedIncident(null);
    };

    // Los filtros recargan la lista por efecto: basta con restablecer su estado.
    const handleClearFilters = () => {
        setSelectedCicloEscolar(getInitialCicloEscolarFilter());
        setSelectedClient(null);
        setSelectedPlate('');
        setSelectedRoute('');
        setSelectedTipoFalla('');
        setSelectedTipo('');
        setSelectedOperacional('');
        setStartDate(null);
        setEndDate(null);
        setPage(0);
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
        setFormOpen(false);
        setFormRecord(null);
        fetchIncidents();
        if (detailsOpen && selectedIncident?.id) {
            handleViewDetails(selectedIncident.id);
        }
    };

    const handleSort = (column) => {
        const isAsc = orderBy === column && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(column);
    };

    const handleOpenDelete = (id) => {
        setDeleteId(id);
        setDeleteOpen(true);
    };

    const handleCancelDelete = () => {
        setDeleteOpen(false);
        setDeleteId(null);
    };

    const handleConfirmDelete = async () => {
        try {
            await deleteFailureMapping(deleteId);
            setDeleteOpen(false);
            setDeleteId(null);
            fetchIncidents();
        } catch (error) {
            console.error('Error al eliminar mapeo:', error);
            alert('Error al eliminar el mapeo de fallas');
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
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Mapeo de Fallas
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Depuración y registro de fallas reportadas por los supervisores
                    </Typography>
                    <Box
                        mt={2}
                        display="flex"
                        flexWrap="wrap"
                        alignItems="center"
                        gap={1.5}
                    >
                        <Button
                            variant="contained"
                            onClick={handleOpenPdfModal}
                            disabled={exportingPdf}
                            startIcon={<PictureAsPdfIcon />}
                            sx={{
                                borderRadius: 999,
                                px: 2.5,
                                py: 1.1,
                                textTransform: 'none',
                                fontWeight: 800,
                                letterSpacing: 0.2,
                                background: 'linear-gradient(135deg, #1f4e79 0%, #2f6ea8 100%)',
                                boxShadow: '0 10px 24px rgba(31, 78, 121, 0.28)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #173c5d 0%, #255d8f 100%)',
                                    boxShadow: '0 12px 28px rgba(31, 78, 121, 0.34)',
                                },
                                '&:disabled': {
                                    background: 'linear-gradient(135deg, #93b2cb 0%, #b4c9db 100%)',
                                    color: '#fff',
                                }
                            }}
                        >
                            {exportingPdf ? 'Generando PDF...' : 'Generar Reporte PDF'}
                        </Button>
                        <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 460, lineHeight: 1.35 }}>
                            Selecciona el cliente y el mes para generar el reporte mensual.
                        </Typography>
                    </Box>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Registros
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.total}
                                </Typography>
                                <Typography variant="caption" color="textSecondary" display="block">
                                    {statistics.colegios} de colegios · {statistics.corporativos} corporativos
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
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
                        <Card>
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
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Días No Operacionales
                                </Typography>
                                <Typography variant="h4" color="warning.main">
                                    {statistics.noOperacional}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {isSpecificCicloEscolarSelected && (
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
                        Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.
                    </Typography>
                )}

                {/* Filtros */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={1.5}>
                            <CicloEscolarFilter size="medium"
                                value={selectedCicloEscolar}
                                onChange={(value) => {
                                    setSelectedCicloEscolar(value);
                                    setSelectedClient(null);
                                    setSelectedPlate('');
                                    setSelectedRoute('');
                                    setPage(0);
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.5}>
                            <ClientSelector
                                size="medium"
                                schools={schools}
                                corporations={corporations}
                                value={selectedClient}
                                onChange={(client) => {
                                    setSelectedClient(client);
                                    setSelectedPlate('');
                                    setSelectedRoute('');
                                    setPage(0);
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={1.3}>
                            <FormControl fullWidth>
                                <InputLabel>Placa</InputLabel>
                                <Select
                                    value={selectedPlate}
                                    onChange={(e) => setSelectedPlate(e.target.value)}
                                    label="Placa"
                                    MenuProps={{ PaperProps: { style: { maxHeight: 48 * 4.5 } } }}
                                    disabled={!selectedSchool && !selectedCorporation}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {[...new Set(buses.map(b => b.plate))].map((plate) => (
                                        <MenuItem key={plate} value={plate}>
                                            {plate}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={1}>
                            <FormControl fullWidth>
                                <InputLabel>Ruta</InputLabel>
                                <Select
                                    value={selectedRoute}
                                    onChange={(e) => setSelectedRoute(e.target.value)}
                                    label="Ruta"
                                    MenuProps={{ PaperProps: { style: { maxHeight: 48 * 4.5 } } }}
                                    disabled={!selectedSchool && !selectedCorporation}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {(schoolRoutes && schoolRoutes.length > 0 ? [...schoolRoutes] : []).sort((a, b) => {
                                        const na = Number(a);
                                        const nb = Number(b);
                                        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
                                            return na - nb;
                                        }
                                        return String(a).localeCompare(String(b));
                                    }).map((route) => (
                                        <MenuItem key={route} value={route}>
                                            {route}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={1}>
                            <FormControl fullWidth>
                                <InputLabel>Tipo de Falla</InputLabel>
                                <Select
                                    value={selectedTipoFalla}
                                    onChange={(e) => setSelectedTipoFalla(e.target.value)}
                                    label="Tipo de Falla"
                                    MenuProps={{ PaperProps: { style: { maxHeight: 48 * 4.5 } } }}
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value={NO_FAILURES_FILTER_VALUE}>Sin fallas</MenuItem>
                                    {Object.entries(FAILURE_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={1}>
                            <FormControl fullWidth>
                                <InputLabel>Tipo</InputLabel>
                                <Select
                                    value={selectedTipo}
                                    onChange={(e) => setSelectedTipo(e.target.value)}
                                    label="Tipo"
                                    MenuProps={{ PaperProps: { style: { maxHeight: 48 * 4.5 } } }}
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(INCIDENT_EVENT_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={1}>
                            <FormControl fullWidth>
                                <InputLabel>Operacional</InputLabel>
                                <Select
                                    value={selectedOperacional}
                                    onChange={(e) => setSelectedOperacional(e.target.value)}
                                    label="Operacional"
                                    MenuProps={{ PaperProps: { style: { maxHeight: 48 * 4.5 } } }}
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="true">Sí</MenuItem>
                                    <MenuItem value="false">No</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={1.25}>
                            <DatePicker
                                label="Fecha Inicio"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={1.25}>
                            <DatePicker
                                label="Fecha Fin"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Grid>
                        <Grid item xs={12} display="flex" justifyContent="flex-end">
                            <Tooltip title="Limpiar filtros">
                                <Button onClick={handleClearFilters} variant="outlined" sx={{ mr: 1 }}>
                                    Limpiar
                                </Button>
                            </Tooltip>
                            {isGestor && (
                                <PermissionGuard permission="mapeo-fallas-crear">
                                    <Button onClick={handleOpenCreateManual} variant="contained" color="primary">
                                        Nuevo Registro
                                    </Button>
                                </PermissionGuard>
                            )}
                        </Grid>
                    </Grid>
                </Paper>

                {/* Tabla */}
                <Paper>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" p={5}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 1100 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'fecha'}
                                                    direction={orderBy === 'fecha' ? order : 'asc'}
                                                    onClick={() => handleSort('fecha')}
                                                >
                                                    Fecha
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'colegio'}
                                                    direction={orderBy === 'colegio' ? order : 'asc'}
                                                    onClick={() => handleSort('colegio')}
                                                >
                                                    Colegio/Corp.
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'tipo'}
                                                    direction={orderBy === 'tipo' ? order : 'asc'}
                                                    onClick={() => handleSort('tipo')}
                                                >
                                                    Tipo
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'placaBus'}
                                                    direction={orderBy === 'placaBus' ? order : 'asc'}
                                                    onClick={() => handleSort('placaBus')}
                                                >
                                                    Placa
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'numeroRuta'}
                                                    direction={orderBy === 'numeroRuta' ? order : 'asc'}
                                                    onClick={() => handleSort('numeroRuta')}
                                                >
                                                    Ruta
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">
                                                <TableSortLabel
                                                    active={orderBy === 'fueOperacional'}
                                                    direction={orderBy === 'fueOperacional' ? order : 'asc'}
                                                    onClick={() => handleSort('fueOperacional')}
                                                >
                                                    Día Operacional
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'tipoFalla'}
                                                    direction={orderBy === 'tipoFalla' ? order : 'asc'}
                                                    onClick={() => handleSort('tipoFalla')}
                                                >
                                                    Tipo de Falla
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">
                                                <TableSortLabel
                                                    active={orderBy === 'routeAffected'}
                                                    direction={orderBy === 'routeAffected' ? order : 'asc'}
                                                    onClick={() => handleSort('routeAffected')}
                                                >
                                                    Afectó Recorrido
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">
                                                <TableSortLabel
                                                    active={orderBy === 'pudoContinuarRuta'}
                                                    direction={orderBy === 'pudoContinuarRuta' ? order : 'asc'}
                                                    onClick={() => handleSort('pudoContinuarRuta')}
                                                >
                                                    Continuó Ruta
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Registrado por</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {incidents.map((incident) => (
                                            <TableRow key={incident.id}>
                                                <TableCell>
                                                    {formatFechaRegistro(incident)}
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
                                                    <Tooltip title="Ver detalles">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleViewDetails(incident.id)}
                                                            color="primary"
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <PermissionGuard permission="mapeo-fallas-eliminar">
                                                    <Tooltip title="Eliminar" >
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenDelete(incident.id)}
                                                            color="error"
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    </PermissionGuard>
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
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={totalCount}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                labelRowsPerPage="Registros por página:"
                                labelDisplayedRows={({ from, to, count }) =>
                                    `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
                                }
                            />
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
                    <DialogTitle>Detalles del Mapeo de Fallas</DialogTitle>
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
                                            Fecha
                                        </Typography>
                                    </Box>
                                    <>
                                        <Typography variant="body1" gutterBottom>
                                            {formatFechaRegistro(selectedIncident)}
                                            {selectedIncident.esRetroactivo && (
                                                <Chip label="Retroactivo" size="small" color="info" variant="outlined" sx={{ ml: 1 }} />
                                            )}
                                        </Typography>
                                        <Typography variant="caption" display="block" color="textSecondary">
                                            {`Registrado el ${moment(selectedIncident.createdAt).tz('America/Guatemala').format('DD/MM/YYYY hh:mm A')}`}
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
                    </DialogContent>
                    <DialogActions>
                        {selectedIncident && (
                            <PermissionGuard permission="mapeo-fallas-editar">
                                <Button onClick={handleOpenEditFull} startIcon={<EditIcon />} variant="outlined">
                                    Editar registro
                                </Button>
                            </PermissionGuard>
                        )}
                        <Button onClick={handleCloseDetails} color="primary">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Modal Generar PDF */}
                <Dialog open={pdfModalOpen} onClose={handleClosePdfModal} maxWidth="sm" fullWidth>
                    <DialogTitle>Generar Reporte PDF</DialogTitle>
                    <DialogContent dividers>
                        <Box display="flex" flexDirection="column" gap={2} pt={1}>
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
                                                <TextField label="Nombre del indicador" value={pdfAddLabel} onChange={(e) => setPdfAddLabel(e.target.value)} size="small" fullWidth autoFocus />
                                                <TextField label="Valor" value={pdfAddValue} onChange={(e) => setPdfAddValue(e.target.value)} size="small" fullWidth />
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
                                        <TextField label="Nombre de la sección" value={pdfAddLabel} onChange={(e) => setPdfAddLabel(e.target.value)} size="small" fullWidth autoFocus />
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
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClosePdfModal} color="inherit">Cancelar</Button>
                        <Button
                            onClick={handleExportPDF}
                            variant="contained"
                            disabled={exportingPdf || (!pdfModalSchoolId && !pdfModalCorporationId) || !pdfModalMonth}
                            startIcon={exportingPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                        >
                            {exportingPdf ? 'Generando...' : 'Generar PDF'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Modal de Confirmación de Eliminación */}
                <Dialog
                    open={deleteOpen}
                    onClose={handleCancelDelete}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogTitle>Confirmar Eliminación</DialogTitle>
                    <DialogContent>
                        <Typography>
                            ¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCancelDelete} color="inherit">
                            Cancelar
                        </Button>
                        <Button onClick={handleConfirmDelete} color="error" variant="contained">
                            Eliminar
                        </Button>
                    </DialogActions>
                </Dialog>
                <FailureMappingFormDialog
                    open={formOpen}
                    onClose={() => { setFormOpen(false); setFormRecord(null); }}
                    onSaved={handleFormSaved}
                    record={formRecord}
                />
            </Container>
        </LocalizationProvider>
    );
};

export default FailureMappingPage;
