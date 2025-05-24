import React, { useState, useEffect, useContext } from 'react';
import {
    Typography,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    CircularProgress,
    Grid,
    Chip,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Snackbar,
    Alert,
    AccordionActions,
    Divider,
    TextField,
    TablePagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    useTheme,
    useMediaQuery,
    Box,
    TableSortLabel,
    TableContainer
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Visibility as VisibilityIcon,
    DirectionsBus as DirectionsBusIcon,
    WarningAmber as WarningIcon,
    LocalHospital as HospitalIcon,
    Build as BuildIcon,
    LocationOn as LocationOnIcon,
    Report as ReportIcon
} from '@mui/icons-material';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    PieChart,
    Pie,
    Tooltip as RechartsTooltip,
    Legend,
    Cell
} from 'recharts';

import tw, { styled } from 'twin.macro';
import api from '../utils/axiosConfig';
import { AuthContext } from '../context/AuthProvider';
import moment from 'moment-timezone';

moment.tz.setDefault('America/Guatemala');

// -------------
// Funciones de formateo
// -------------
const formatGuatemalaDatetime = (dateString) => {
    if (!dateString) return '—';
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY HH:mm');
};

const formatGuatemalaDate = (dateString) => {
    if (!dateString) return '—';
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY');
};

// -------------
// Estilos con twin.macro
// -------------
const PageContainer = tw.div`
    p-8
    bg-gray-100
    min-h-screen
`;

const Title = styled(Typography)(() => [
    tw`text-3xl font-bold mb-4`,
    { color: '#1C3FAA' }
]);

const SectionPaper = styled(Paper)(() => [
    tw`p-4 mb-6 rounded-lg`,
    {
        backgroundColor: '#FFFFFF',
        boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
        minHeight: '600px',
        overflowY: 'auto'
    }
]);

const SectionTitle = styled(Typography)(() => [
    tw`font-semibold mb-3`,
    { color: '#2563EB' }
]);

const AccordionStyled = styled((props) => <Accordion disableGutters {...props} />)(() => [
    tw`border rounded-lg overflow-hidden mb-2`,
    {
        borderColor: '#93C5FD',
        backgroundColor: '#F8FAFF'
    }
]);

const AccordionSummaryStyled = styled(AccordionSummary)(() => [
    tw`transition-colors`,
    {
        backgroundColor: '#E0F2FE',
        '&:hover': {
            backgroundColor: '#BAE6FD'
        }
    }
]);

const TableHeaderCell = styled(TableCell)(() => [
    tw`font-semibold`,
    {
        backgroundColor: '#DCF3FF',
        color: '#333'
    }
]);

const FiltersRow = tw.div`
    flex 
    gap-4 
    mb-4 
    items-center
`;

const MobileCard = styled(Paper)(() => [
    tw`p-4 mb-4`,
    { backgroundColor: '#fff' }
]);
const MobileField = styled(Box)(() => [
    tw`mb-2`
]);
const MobileLabel = styled(Typography)(() => [
    tw`font-bold text-sm`,
    { color: '#555' }
]);
const MobileValue = styled(Typography)(() => [
    tw`text-base`
]);

// =================== Código para ordenamiento ===================
function descendingComparator(a, b, orderBy, type) {
    const aValue = getFieldValue(a, orderBy, type);
    const bValue = getFieldValue(b, orderBy, type);

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
        return bValue.localeCompare(aValue);
    }
    if (bValue < aValue) return -1;
    if (bValue > aValue) return 1;
    return 0;
}

function getComparator(order, orderBy, type) {
    return order === 'desc'
        ? (a, b) => descendingComparator(a, b, orderBy, type)
        : (a, b) => -descendingComparator(a, b, orderBy, type);
}

function stableSort(array, comparator) {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
}

function getFieldValue(item, field, type) {
    if (type === 'buses') {
        switch (field) {
            case 'plate':
                return item?.plate || '';
            case 'pilot':
                return item?.pilot?.name || '';
            case 'monitora':
                return item?.monitora?.name || '';
            case 'description':
                return item?.description || '';
            default:
                return '';
        }
    } else if (type === 'incidents') {
        switch (field) {
            case 'fecha':
                return item.fecha
                    ? moment.utc(item.fecha).tz('America/Guatemala').valueOf()
                    : null;
            case 'piloto':
                return item?.piloto?.name || '';
            case 'tipoFalla':
                return item?.tipoFalla || '';
            case 'descripcion':
                return item?.descripcion || '';
            default:
                return '';
        }
    } else if (type === 'emergencies') {
        switch (field) {
            case 'fecha':
                return item.fecha
                    ? moment.utc(item.fecha).tz('America/Guatemala').valueOf()
                    : null;
            case 'piloto':
                return item?.piloto?.name || '';
            default:
                return '';
        }
    } else if (type === 'payments') {
        switch (field) {
            case 'userName':
                return item?.User?.name || '';
            case 'userEmail':
                return item?.User?.email || '';
            case 'finalStatus':
                return item?.finalStatus || item?.status || '';
            case 'nextPaymentDate':
                return item.nextPaymentDate
                    ? moment.utc(item.nextPaymentDate).tz('America/Guatemala').valueOf()
                    : null;
            case 'leftover':
                return item.leftover ?? 0;
            default:
                return '';
        }
    }
    return '';
}
// =================== Fin código para ordenamiento ===================

const ActivityLogPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const isSupervisor = auth?.user?.roleId === 6;
    const [loading, setLoading] = useState(false);

    const [buses, setBuses] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [payments, setPayments] = useState([]);
    const [totalPaymentsCount, setTotalPaymentsCount] = useState(0);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [loadingBoletas, setLoadingBoletas] = useState(false);

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    const [openBoletasDialog, setOpenBoletasDialog] = useState(false);
    const [currentBoletas, setCurrentBoletas] = useState([]);
    const [currentParentName, setCurrentParentName] = useState('');

    const [openMapDialog, setOpenMapDialog] = useState(false);
    const [selectedCoords, setSelectedCoords] = useState({ lat: null, lng: null });

    const [openIncidentDialog, setOpenIncidentDialog] = useState(false);
    const [incidentForm, setIncidentForm] = useState({
        busId: null,
        tipoFalla: 'mecánico',
        tipo: 'incidente',
        descripcion: '',
        pudoContinuarRuta: false,
        seUtilizoBusSuplente: false,
        otroFallaDetalle: ''
    });

    const [expanded, setExpanded] = useState(false);

    // Filtros & Paginación
    const [busPilotFilter, setBusPilotFilter] = useState('');
    const [busMonitoraFilter, setBusMonitoraFilter] = useState('');
    const [busDescriptionFilter, setBusDescriptionFilter] = useState('');
    const [busPage, setBusPage] = useState(0);
    const [busRowsPerPage, setBusRowsPerPage] = useState(5);

    const [incDateFrom, setIncDateFrom] = useState('');
    const [incDateTo, setIncDateTo] = useState('');
    const [incPilotFilter, setIncPilotFilter] = useState('');
    const [incDescriptionFilter, setIncDescriptionFilter] = useState('');
    const [incPage, setIncPage] = useState(0);
    const [incRowsPerPage, setIncRowsPerPage] = useState(5);

    const [emeDateFrom, setEmeDateFrom] = useState('');
    const [emeDateTo, setEmeDateTo] = useState('');
    const [emePilotFilter, setEmePilotFilter] = useState('');
    const [emePage, setEmePage] = useState(0);
    const [emeRowsPerPage, setEmeRowsPerPage] = useState(5);

    const [payDateFrom, setPayDateFrom] = useState('');
    const [payDateTo, setPayDateTo] = useState('');
    const [payBalanceMin, setPayBalanceMin] = useState('');
    const [payBalanceMax, setPayBalanceMax] = useState('');
    const [payPage, setPayPage] = useState(0);
    const [payRowsPerPage, setPayRowsPerPage] = useState(10);
    

    // Orden Buses
    const [busOrder, setBusOrder] = useState('asc');
    const [busOrderBy, setBusOrderBy] = useState('plate');
    const handleRequestBusSort = (property) => {
        const isAsc = busOrderBy === property && busOrder === 'asc';
        setBusOrder(isAsc ? 'desc' : 'asc');
        setBusOrderBy(property);
    };

    // Orden Incidentes
    const [incOrder, setIncOrder] = useState('asc');
    const [incOrderBy, setIncOrderBy] = useState('');
    const handleRequestIncSort = (property) => {
        const isAsc = incOrderBy === property && incOrder === 'asc';
        setIncOrder(isAsc ? 'desc' : 'asc');
        setIncOrderBy(property);
    };

    // Orden Emergencias
    const [emeOrder, setEmeOrder] = useState('asc');
    const [emeOrderBy, setEmeOrderBy] = useState('');
    const handleRequestEmeSort = (property) => {
        const isAsc = emeOrderBy === property && emeOrder === 'asc';
        setEmeOrder(isAsc ? 'desc' : 'asc');
        setEmeOrderBy(property);
    };

    // Orden Pagos
    const [payOrder, setPayOrder] = useState('asc');
    const [payOrderBy, setPayOrderBy] = useState('');
    const handleRequestPaySort = (property) => {
        const isAsc = payOrderBy === property && payOrder === 'asc';
        setPayOrder(isAsc ? 'desc' : 'asc');
        setPayOrderBy(property);
    };

    useEffect(() => {
        fetchAllData();
        if (!isSupervisor) fetchPaymentsAnalysis();
        // eslint-disable-next-line
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const busResp = await api.get('/activity-logs');
            const incResp = await api.get('/activity-logs/incidents');
            const emeResp = await api.get('/activity-logs/emergencies');

            setBuses(busResp.data || []);
            setIncidents(incResp.data.incidents || []);
            setEmergencies(emeResp.data.emergencies || []);

            if (!isSupervisor) {
                const payResp = await api.get('/payments');
                setPayments(payResp.data.payments || []);
            }
        } catch (error) {
            console.error('Error fetchAllData =>', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener datos para registro de actividades',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchPayments = async () => {
        try {
            const params = {
                page: payPage + 1,
                limit: payRowsPerPage,
                order: payOrder,
                orderBy: payOrderBy,
                dateFrom: payDateFrom,
                dateTo: payDateTo,
                balanceMin: payBalanceMin,
                balanceMax: payBalanceMax
            };
            const res = await api.get('/payments', { params });
            setPayments(res.data.payments || []);
            setTotalPaymentsCount(res.data.totalCount || 0);
        } catch (error) {
            setSnackbar({ open: true, message: 'Error al obtener pagos', severity: 'error' });
        } finally {
            setLoadingPayments(false);
        }
    };

    // Llama a fetchPayments cuando cambian filtros, orden o paginación
    useEffect(() => {
        if (!isSupervisor) fetchPayments();
        // eslint-disable-next-line
    }, [payPage, payRowsPerPage, payOrder, payOrderBy, payDateFrom, payDateTo, payBalanceMin, payBalanceMax]);

    const handleChangeAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    const handleViewBoletas = async (fatherId, fatherName) => {
        try {
            setLoadingBoletas(true); // Solo para boletas
            const resp = await api.get(`/parents/${fatherId}/receipts`);
            const boletas = resp.data.receipts || [];
            setCurrentBoletas(boletas);
            setCurrentParentName(fatherName);
            setOpenBoletasDialog(true);
        } catch (error) {
            console.error('Error handleViewBoletas =>', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener boletas del padre',
                severity: 'error'
            });
        } finally {
            setLoadingBoletas(false); // Solo para boletas
        }
    };
    const handleCloseBoletasDialog = () => {
        setOpenBoletasDialog(false);
        setCurrentBoletas([]);
        setCurrentParentName('');
    };

    const handleOpenMap = (lat, lng) => {
        setSelectedCoords({ lat, lng });
        setOpenMapDialog(true);
    };
    const handleCloseMap = () => {
        setOpenMapDialog(false);
        setSelectedCoords({ lat: null, lng: null });
    };

    const handleToggleBusTaller = async (bus, newValue) => {
        try {
            setLoading(true);
            await api.put(`/buses/${bus.id}/taller`, { inWorkshop: newValue });
            setSnackbar({
                open: true,
                message: newValue
                    ? 'Bus marcado como "En Taller".'
                    : 'Bus marcado como disponible.',
                severity: 'success'
            });
            fetchAllData();
        } catch (error) {
            console.error('Error handleToggleBusTaller =>', error);
            setSnackbar({
                open: true,
                message: 'No se pudo actualizar el estado del bus',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenIncidentDialog = (bus) => {
        setIncidentForm({
            busId: bus.id,
            tipoFalla: 'mecánico',
            tipo: 'incidente',
            descripcion: '',
            pudoContinuarRuta: false,
            seUtilizoBusSuplente: false,
            otroFallaDetalle: ''
        });
        setOpenIncidentDialog(true);
    };

    const handleCloseIncidentDialog = () => {
        setOpenIncidentDialog(false);
    };

    const handleIncidentFormChange = (field, value) => {
        setIncidentForm((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmitIncident = async () => {
        if (!incidentForm.descripcion) {
            setSnackbar({
                open: true,
                message: 'La descripción es obligatoria para el incidente',
                severity: 'warning'
            });
            return;
        }
        if (!incidentForm.busId) {
            setSnackbar({
                open: true,
                message: 'No se encontró el bus para el incidente.',
                severity: 'error'
            });
            return;
        }

        try {
            setLoading(true);
            await api.post('/activity-logs/incidents', {
                busId: incidentForm.busId,
                tipoFalla: incidentForm.tipoFalla,
                tipo: incidentForm.tipo,
                descripcion: incidentForm.descripcion,
                pudoContinuarRuta: incidentForm.pudoContinuarRuta,
                seUtilizoBusSuplente: incidentForm.seUtilizoBusSuplente,
                otroFallaDetalle:
                    incidentForm.tipoFalla === 'otro'
                        ? incidentForm.otroFallaDetalle
                        : ''
            });
            setSnackbar({
                open: true,
                message: 'Incidencia reportada correctamente',
                severity: 'success'
            });
            setOpenIncidentDialog(false);

            const incResp = await api.get('/activity-logs/incidents');
            setIncidents(incResp.data.incidents || []);
        } catch (error) {
            console.error('Error al crear incidente =>', error);
            setSnackbar({
                open: true,
                message: 'No se pudo reportar el incidente.',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // === Filtrado y Ordenamiento Buses ===
    const filteredBuses = buses.filter((b) => {
        if (busPilotFilter) {
            const pilotName = b?.pilot?.name?.toLowerCase() || '';
            if (!pilotName.includes(busPilotFilter.toLowerCase())) return false;
        }
        if (busMonitoraFilter) {
            const monitoraName = b?.monitora?.name?.toLowerCase() || '';
            if (!monitoraName.includes(busMonitoraFilter.toLowerCase())) return false;
        }
        if (busDescriptionFilter) {
            const desc = b?.description?.toLowerCase() || '';
            if (!desc.includes(busDescriptionFilter.toLowerCase())) return false;
        }
        return true;
    });
    const sortedBuses = stableSort(
        filteredBuses,
        getComparator(busOrder, busOrderBy, 'buses')
    );
    const busesPaginated = sortedBuses.slice(
        busPage * busRowsPerPage,
        busPage * busRowsPerPage + busRowsPerPage
    );

    const handleChangeBusPage = (event, newPage) => {
        setBusPage(newPage);
    };
    const handleChangeBusRowsPerPage = (event) => {
        setBusRowsPerPage(parseInt(event.target.value, 10));
        setBusPage(0);
    };

    // === Filtrado y Ordenamiento Incidentes ===
    const filteredIncidents = incidents.filter((inc) => {
        if (incDateFrom) {
            const from = moment(incDateFrom, 'YYYY-MM-DD').startOf('day').valueOf();
            const incDateMs = moment.utc(inc.fecha).tz('America/Guatemala').valueOf();
            if (incDateMs < from) return false;
        }
        if (incDateTo) {
            const to = moment(incDateTo, 'YYYY-MM-DD').endOf('day').valueOf();
            const incDateMs = moment.utc(inc.fecha).tz('America/Guatemala').valueOf();
            if (incDateMs > to) return false;
        }
        if (incPilotFilter) {
            const pilotName = inc?.piloto?.name?.toLowerCase() || '';
            if (!pilotName.includes(incPilotFilter.toLowerCase())) return false;
        }
        if (incDescriptionFilter) {
            const desc = inc?.descripcion?.toLowerCase() || '';
            if (!desc.includes(incDescriptionFilter.toLowerCase())) return false;
        }
        return true;
    });
    const sortedIncidents = stableSort(
        filteredIncidents,
        getComparator(incOrder, incOrderBy, 'incidents')
    );
    const incPaginated = sortedIncidents.slice(
        incPage * incRowsPerPage,
        incPage * incRowsPerPage + incRowsPerPage
    );
    const handleChangeIncPage = (event, newPage) => {
        setIncPage(newPage);
    };
    const handleChangeIncRowsPerPage = (event) => {
        setIncRowsPerPage(parseInt(event.target.value, 10));
        setIncPage(0);
    };

    // === Filtrado y Ordenamiento Emergencias ===
    const filteredEmergencies = emergencies.filter((eme) => {
        if (emeDateFrom) {
            const from = moment(emeDateFrom, 'YYYY-MM-DD').startOf('day').valueOf();
            const emeDateMs = moment.utc(eme.fecha).tz('America/Guatemala').valueOf();
            if (emeDateMs < from) return false;
        }
        if (emeDateTo) {
            const to = moment(emeDateTo, 'YYYY-MM-DD').endOf('day').valueOf();
            const emeDateMs = moment.utc(eme.fecha).tz('America/Guatemala').valueOf();
            if (emeDateMs > to) return false;
        }
        if (emePilotFilter) {
            const pilotName = eme?.piloto?.name?.toLowerCase() || '';
            if (!pilotName.includes(emePilotFilter.toLowerCase())) return false;
        }
        return true;
    });
    const sortedEmergencies = stableSort(
        filteredEmergencies,
        getComparator(emeOrder, emeOrderBy, 'emergencies')
    );
    const emePaginated = sortedEmergencies.slice(
        emePage * emeRowsPerPage,
        emePage * emeRowsPerPage + emeRowsPerPage
    );
    const handleChangeEmePage = (event, newPage) => {
        setEmePage(newPage);
    };
    const handleChangeEmeRowsPerPage = (event) => {
        setEmeRowsPerPage(parseInt(event.target.value, 10));
        setEmePage(0);
    };

    // === Filtrado y Ordenamiento Pagos (no supervisor) ===
    const handleChangePayPage = (event, newPage) => {
        setPayPage(newPage);
    };
    const handleChangePayRowsPerPage = (event) => {
        setPayRowsPerPage(parseInt(event.target.value, 10));
        setPayPage(0);
    };
    
    const COLORS = ['#4CAF50', '#FFC107', '#F44336'];

    const [totalPaymentsGlobal, setTotalPaymentsGlobal] = useState(0);
    const [totalPaidCountGlobal, setTotalPaidCountGlobal] = useState(0);
    const [totalMoraCountGlobal, setTotalMoraCountGlobal] = useState(0);
    const [totalPendingCountGlobal, setTotalPendingCountGlobal] = useState(0);
    const [totalLeftoverGlobal, setTotalLeftoverGlobal] = useState(0);
    const [totalDueGlobal, setTotalDueGlobal] = useState(0);
    const [totalPenaltyGlobal, setTotalPenaltyGlobal] = useState(0);

    const statusData = [
        { name: 'PAGADO', value: totalPaidCountGlobal },
        { name: 'PENDIENTE', value: totalPendingCountGlobal },
        { name: 'MORA', value: totalMoraCountGlobal }
    ];

    const barData = [
        {
            name: 'Totales',
            'Deuda Pendiente (totalDue)': totalDueGlobal,
            'Saldo (leftover)': totalLeftoverGlobal,
            'Multas (penalty)': totalPenaltyGlobal
        }
    ];

    const fetchPaymentsAnalysis = async () => {
        try {
            const res = await api.get('/payments/analysis');
            setTotalPaymentsGlobal(res.data.totalPayments || 0);
            setTotalPaidCountGlobal(
                res.data.statusDistribution?.find(s => s.finalStatus === 'PAGADO')?.count || 0
            );
            setTotalPendingCountGlobal(
                res.data.statusDistribution?.find(s => s.finalStatus === 'PENDIENTE')?.count || 0
            );
            setTotalMoraCountGlobal(
                res.data.statusDistribution?.find(s => s.finalStatus === 'MORA')?.count || 0
            );
            setTotalLeftoverGlobal(res.data.sumLeftover || 0);
            setTotalDueGlobal(res.data.sumTotalDue || 0);
            setTotalPenaltyGlobal(res.data.sumPenalty || 0);
        } catch (error) {
            setSnackbar({ open: true, message: 'Error al obtener análisis global de pagos', severity: 'error' });
        }
    };

    return (
        <PageContainer>
            <Title variant="h4" gutterBottom>
                Registro de Actividades
            </Title>

            {loading ? (
                <div tw="flex justify-center p-4">
                    <CircularProgress />
                </div>
            ) : (
                <div tw="space-y-6">
                    {/* Sección Buses */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            <DirectionsBusIcon
                                sx={{ mr: 1, verticalAlign: 'middle', color: '#1976D2' }}
                            />
                            Buses, Pilotos, Monitoras & Paradas
                        </SectionTitle>

                        {/* Filtros Buses */}
                        <FiltersRow>
                            <TextField
                                label="Filtrar por Piloto"
                                variant="outlined"
                                size="small"
                                value={busPilotFilter}
                                onChange={(e) => setBusPilotFilter(e.target.value)}
                            />
                            <TextField
                                label="Filtrar por Monitora"
                                variant="outlined"
                                size="small"
                                value={busMonitoraFilter}
                                onChange={(e) => setBusMonitoraFilter(e.target.value)}
                            />
                            <TextField
                                label="Filtrar por Descripción"
                                variant="outlined"
                                size="small"
                                value={busDescriptionFilter}
                                onChange={(e) => setBusDescriptionFilter(e.target.value)}
                            />
                        </FiltersRow>

                        {!isMobile && filteredBuses.length > 0 && (
                            <Table size="small" sx={{ mb: 2 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableHeaderCell sortDirection={busOrderBy === 'plate' ? busOrder : false}>
                                            <TableSortLabel
                                                active={busOrderBy === 'plate'}
                                                direction={busOrderBy === 'plate' ? busOrder : 'asc'}
                                                onClick={() => handleRequestBusSort('plate')}
                                                hideSortIcon={false}
                                                sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                            >
                                                Placa
                                            </TableSortLabel>
                                        </TableHeaderCell>
                                        <TableHeaderCell sortDirection={busOrderBy === 'pilot' ? busOrder : false}>
                                            <TableSortLabel
                                                active={busOrderBy === 'pilot'}
                                                direction={busOrderBy === 'pilot' ? busOrder : 'asc'}
                                                onClick={() => handleRequestBusSort('pilot')}
                                                hideSortIcon={false}
                                                sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                            >
                                                Piloto
                                            </TableSortLabel>
                                        </TableHeaderCell>
                                        <TableHeaderCell sortDirection={busOrderBy === 'monitora' ? busOrder : false}>
                                            <TableSortLabel
                                                active={busOrderBy === 'monitora'}
                                                direction={busOrderBy === 'monitora' ? busOrder : 'asc'}
                                                onClick={() => handleRequestBusSort('monitora')}
                                                hideSortIcon={false}
                                                sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                            >
                                                Monitora
                                            </TableSortLabel>
                                        </TableHeaderCell>
                                        <TableHeaderCell sortDirection={busOrderBy === 'description' ? busOrder : false}>
                                            <TableSortLabel
                                                active={busOrderBy === 'description'}
                                                direction={busOrderBy === 'description' ? busOrder : 'asc'}
                                                onClick={() => handleRequestBusSort('description')}
                                                hideSortIcon={false}
                                                sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                            >
                                                Descripción
                                            </TableSortLabel>
                                        </TableHeaderCell>
                                    </TableRow>
                                </TableHead>
                            </Table>
                        )}

                        {filteredBuses.length === 0 ? (
                            <Typography variant="body2" color="textSecondary">
                                No hay buses registrados con esos filtros.
                            </Typography>
                        ) : (
                            <>
                                {isMobile ? (
                                    <>
                                        {busesPaginated.map((bus) => (
                                            <MobileCard key={bus.id}>
                                                <MobileField>
                                                    <MobileLabel>Placa:</MobileLabel>
                                                    <MobileValue>{bus.plate}</MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Piloto:</MobileLabel>
                                                    <MobileValue>
                                                        {bus.pilot ? bus.pilot.name : '—'}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Monitora:</MobileLabel>
                                                    <MobileValue>
                                                        {bus.monitora ? bus.monitora.name : '—'}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Número de ruta:</MobileLabel>
                                                    <MobileValue>{bus.routeNumber || '—'}</MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Descripción:</MobileLabel>
                                                    <MobileValue>{bus.description || '—'}</MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Estado de Ruta:</MobileLabel>
                                                    {bus.currentRoute ? (
                                                        !bus.currentRoute.endTime ? (
                                                            <MobileValue>
                                                                En Ruta (Inicio:{' '}
                                                                {formatGuatemalaDatetime(bus.currentRoute.startTime)})
                                                            </MobileValue>
                                                        ) : (
                                                            <MobileValue>
                                                                Finalizada a las{' '}
                                                                {formatGuatemalaDatetime(bus.currentRoute.endTime)}
                                                            </MobileValue>
                                                        )
                                                    ) : (
                                                        <MobileValue>Sin ruta activa</MobileValue>
                                                    )}
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Paradas:</MobileLabel>
                                                    {Array.isArray(bus.stops) && bus.stops.length > 0 ? (
                                                        <>
                                                            {bus.stops.map((stop) => (
                                                                <MobileCard
                                                                    key={stop.stopId}
                                                                    sx={{ p: 2, mb: 1 }}
                                                                >
                                                                    <MobileField>
                                                                        <MobileLabel>Horario:</MobileLabel>
                                                                        <MobileValue>{stop.time}</MobileValue>
                                                                    </MobileField>
                                                                    <MobileField>
                                                                        <MobileLabel>Nota:</MobileLabel>
                                                                        <MobileValue>
                                                                            {stop.note || ''}
                                                                        </MobileValue>
                                                                    </MobileField>
                                                                    <MobileField>
                                                                        <MobileLabel>Padre:</MobileLabel>
                                                                        <MobileValue>
                                                                            {stop.parentName}
                                                                        </MobileValue>
                                                                    </MobileField>
                                                                    <MobileField>
                                                                        <MobileLabel>Estudiantes:</MobileLabel>
                                                                        <MobileValue>
                                                                            {stop.students}
                                                                        </MobileValue>
                                                                    </MobileField>
                                                                </MobileCard>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <MobileValue>No hay paradas registradas.</MobileValue>
                                                    )}
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>ID Bus:</MobileLabel>
                                                    <MobileValue>{bus.id}</MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Estado Taller:</MobileLabel>
                                                    <MobileValue>
                                                        {bus.inWorkshop ? 'En Taller' : 'Disponible'}
                                                    </MobileValue>
                                                </MobileField>

                                                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                    {bus.inWorkshop ? (
                                                        <Tooltip title="Marcar como Disponible">
                                                            <IconButton
                                                                color="primary"
                                                                onClick={() =>
                                                                    handleToggleBusTaller(bus, false)
                                                                }
                                                            >
                                                                <BuildIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Marcar bus en Taller">
                                                            <IconButton
                                                                color="primary"
                                                                onClick={() =>
                                                                    handleToggleBusTaller(bus, true)
                                                                }
                                                            >
                                                                <BuildIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Reportar Incidencia">
                                                        <IconButton
                                                            color="warning"
                                                            onClick={() => handleOpenIncidentDialog(bus)}
                                                        >
                                                            <ReportIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </MobileCard>
                                        ))}
                                        <TablePagination
                                            component="div"
                                            count={filteredBuses.length}
                                            page={busPage}
                                            onPageChange={handleChangeBusPage}
                                            rowsPerPage={busRowsPerPage}
                                            onRowsPerPageChange={handleChangeBusRowsPerPage}
                                            labelRowsPerPage="Filas por página"
                                        />
                                    </>
                                ) : (
                                    <>
                                        {busesPaginated.map((bus) => (
                                            <AccordionStyled
                                                key={bus.id}
                                                expanded={expanded === `panel-${bus.id}`}
                                                onChange={handleChangeAccordion(`panel-${bus.id}`)}
                                            >
                                                <AccordionSummaryStyled expandIcon={<ExpandMoreIcon />}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                                        {bus.plate}
                                                    </Typography>
                                                    {bus.inWorkshop && (
                                                        <Chip
                                                            label="En Taller"
                                                            color="error"
                                                            size="small"
                                                            sx={{ ml: 2 }}
                                                        />
                                                    )}
                                                    <Chip
                                                        label={`Ocupación: ${bus.occupation ?? 0}/${bus.capacity ?? '--'}`}
                                                        size="small"
                                                        color="success"
                                                        sx={{ ml: 2 }}
                                                    />
                                                    {bus.currentRoute ? (
                                                        !bus.currentRoute.endTime ? (
                                                            <Chip
                                                                label={`En Ruta (Inicio: ${formatGuatemalaDatetime(
                                                                    bus.currentRoute.startTime
                                                                )})`}
                                                                color="primary"
                                                                size="small"
                                                                sx={{ ml: 2 }}
                                                            />
                                                        ) : (
                                                            <Chip
                                                                label={`Finalizada a las ${formatGuatemalaDatetime(
                                                                    bus.currentRoute.endTime
                                                                )}`}
                                                                color="secondary"
                                                                size="small"
                                                                sx={{ ml: 2 }}
                                                            />
                                                        )
                                                    ) : (
                                                        <Chip
                                                            label="Sin ruta activa"
                                                            color="default"
                                                            size="small"
                                                            sx={{ ml: 2 }}
                                                        />
                                                    )}
                                                </AccordionSummaryStyled>

                                                <AccordionDetails>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={12} md={6}>
                                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                                <strong>Piloto: </strong>
                                                                {bus.pilot ? bus.pilot.name : '—'}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                                <strong>Monitora: </strong>
                                                                {bus.monitora ? bus.monitora.name : '—'}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                                <strong>Número de ruta: </strong>
                                                                {bus.routeNumber || '—'}
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                <strong>Descripción: </strong>
                                                                {bus.description || '—'}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12} md={6}>
                                                            {Array.isArray(bus.stops) && bus.stops.length > 0 ? (
                                                                <Table size="small">
                                                                    <TableHead>
                                                                        <TableRow>
                                                                            <TableHeaderCell>Horario</TableHeaderCell>
                                                                            <TableHeaderCell>Nota</TableHeaderCell>
                                                                            <TableHeaderCell>Padre</TableHeaderCell>
                                                                            <TableHeaderCell>Estudiantes</TableHeaderCell>
                                                                        </TableRow>
                                                                    </TableHead>
                                                                    <TableBody>
                                                                        {bus.stops.map((stop) => (
                                                                            <TableRow key={stop.stopId}>
                                                                                <TableCell>{stop.time}</TableCell>
                                                                                <TableCell>{stop.note || ''}</TableCell>
                                                                                <TableCell>{stop.parentName}</TableCell>
                                                                                <TableCell>{stop.students}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            ) : (
                                                                <Typography variant="body2" color="textSecondary">
                                                                    No hay paradas registradas.
                                                                </Typography>
                                                            )}
                                                        </Grid>
                                                    </Grid>
                                                </AccordionDetails>

                                                <Divider />
                                                <AccordionActions>
                                                    <Typography variant="caption" color="textSecondary" sx={{ mr: 2 }}>
                                                        ID Bus: {bus.id}
                                                    </Typography>
                                                    {bus.inWorkshop ? (
                                                        <Tooltip title="Marcar como Disponible">
                                                            <IconButton
                                                                color="primary"
                                                                onClick={() => handleToggleBusTaller(bus, false)}
                                                            >
                                                                <BuildIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Marcar bus en Taller">
                                                            <IconButton
                                                                color="primary"
                                                                onClick={() => handleToggleBusTaller(bus, true)}
                                                            >
                                                                <BuildIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Reportar Incidencia">
                                                        <IconButton
                                                            color="warning"
                                                            onClick={() => handleOpenIncidentDialog(bus)}
                                                        >
                                                            <ReportIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </AccordionActions>
                                            </AccordionStyled>
                                        ))}
                                        <TablePagination
                                            component="div"
                                            count={filteredBuses.length}
                                            page={busPage}
                                            onPageChange={handleChangeBusPage}
                                            rowsPerPage={busRowsPerPage}
                                            onRowsPerPageChange={handleChangeBusRowsPerPage}
                                            labelRowsPerPage="Filas por página"
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </SectionPaper>

                    {/* Incidentes & Emergencias */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            <WarningIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#ED6C02' }} />
                            Incidentes y{' '}
                            <HospitalIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#D32F2F' }} />
                            Emergencias
                        </SectionTitle>

                        <Grid container spacing={2} mt={1}>
                            {/* Incidentes */}
                            <Grid item xs={12} md={6}>
                                <Typography
                                    variant="subtitle1"
                                    gutterBottom
                                    sx={{ fontWeight: 'bold', mb: 2 }}
                                >
                                    Incidentes
                                </Typography>

                                <FiltersRow>
                                    <TextField
                                        label="Fecha desde"
                                        type="date"
                                        value={incDateFrom}
                                        onChange={(e) => setIncDateFrom(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        size="small"
                                    />
                                    <TextField
                                        label="Fecha hasta"
                                        type="date"
                                        value={incDateTo}
                                        onChange={(e) => setIncDateTo(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        size="small"
                                    />
                                    <TextField
                                        label="Filtrar por Piloto"
                                        variant="outlined"
                                        size="small"
                                        value={incPilotFilter}
                                        onChange={(e) => setIncPilotFilter(e.target.value)}
                                    />
                                    <TextField
                                        label="Filtrar por Descripción"
                                        variant="outlined"
                                        size="small"
                                        value={incDescriptionFilter}
                                        onChange={(e) => setIncDescriptionFilter(e.target.value)}
                                    />
                                </FiltersRow>

                                {filteredIncidents.length === 0 ? (
                                    <Typography variant="body2" color="textSecondary">
                                        No hay incidentes reportados con esos filtros
                                    </Typography>
                                ) : isMobile ? (
                                    <>
                                        {incPaginated.map((incident) => (
                                            <MobileCard key={incident.id}>
                                                <MobileField>
                                                    <MobileLabel>Fecha:</MobileLabel>
                                                    <MobileValue>
                                                        {formatGuatemalaDatetime(incident.fecha)}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Piloto:</MobileLabel>
                                                    <MobileValue>
                                                        {incident.piloto ? incident.piloto.name : '—'}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Tipo (Gravedad):</MobileLabel>
                                                    <MobileValue>
                                                        {incident.tipo === 'incidente'
                                                            ? 'Problema menor'
                                                            : 'Problema mayor'}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Tipo de Falla:</MobileLabel>
                                                    <MobileValue>
                                                        {incident.tipoFalla || '—'}
                                                    </MobileValue>
                                                </MobileField>
                                                {incident.tipoFalla === 'otro' && incident.otroFallaDetalle && (
                                                    <MobileField>
                                                        <MobileLabel>Otro (Detalle):</MobileLabel>
                                                        <MobileValue>{incident.otroFallaDetalle}</MobileValue>
                                                    </MobileField>
                                                )}
                                                <MobileField>
                                                    <MobileLabel>Descripción:</MobileLabel>
                                                    <MobileValue>
                                                        {incident.descripcion || '—'}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>¿Pudo continuar la ruta?</MobileLabel>
                                                    <MobileValue>
                                                        {incident.pudoContinuarRuta ? 'Sí' : 'No'}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>¿Bus Suplente?</MobileLabel>
                                                    <MobileValue>
                                                        {incident.seUtilizoBusSuplente ? 'Sí' : 'No'}
                                                    </MobileValue>
                                                </MobileField>
                                            </MobileCard>
                                        ))}
                                        <TablePagination
                                            component="div"
                                            count={filteredIncidents.length}
                                            page={incPage}
                                            onPageChange={handleChangeIncPage}
                                            rowsPerPage={incRowsPerPage}
                                            onRowsPerPageChange={handleChangeIncRowsPerPage}
                                            labelRowsPerPage="Filas por página"
                                        />
                                    </>
                                ) : (
                                    <TableContainer sx={{ overflowX: 'auto' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableHeaderCell sortDirection={incOrderBy === 'fecha' ? incOrder : false}>
                                                        <TableSortLabel
                                                            active={incOrderBy === 'fecha'}
                                                            direction={incOrderBy === 'fecha' ? incOrder : 'asc'}
                                                            onClick={() => handleRequestIncSort('fecha')}
                                                            hideSortIcon={false}
                                                            sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                        >
                                                            Fecha
                                                        </TableSortLabel>
                                                    </TableHeaderCell>
                                                    <TableHeaderCell sortDirection={incOrderBy === 'piloto' ? incOrder : false}>
                                                        <TableSortLabel
                                                            active={incOrderBy === 'piloto'}
                                                            direction={incOrderBy === 'piloto' ? incOrder : 'asc'}
                                                            onClick={() => handleRequestIncSort('piloto')}
                                                            hideSortIcon={false}
                                                            sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                        >
                                                            Piloto
                                                        </TableSortLabel>
                                                    </TableHeaderCell>
                                                    <TableHeaderCell>Tipo (Gravedad)</TableHeaderCell>
                                                    <TableHeaderCell sortDirection={incOrderBy === 'tipoFalla' ? incOrder : false}>
                                                        <TableSortLabel
                                                            active={incOrderBy === 'tipoFalla'}
                                                            direction={incOrderBy === 'tipoFalla' ? incOrder : 'asc'}
                                                            onClick={() => handleRequestIncSort('tipoFalla')}
                                                            hideSortIcon={false}
                                                            sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                        >
                                                            Tipo de Falla
                                                        </TableSortLabel>
                                                    </TableHeaderCell>
                                                    <TableHeaderCell sortDirection={incOrderBy === 'descripcion' ? incOrder : false}>
                                                        <TableSortLabel
                                                            active={incOrderBy === 'descripcion'}
                                                            direction={incOrderBy === 'descripcion' ? incOrder : 'asc'}
                                                            onClick={() => handleRequestIncSort('descripcion')}
                                                            hideSortIcon={false}
                                                            sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                        >
                                                            Descripción
                                                        </TableSortLabel>
                                                    </TableHeaderCell>
                                                    <TableHeaderCell>¿Continuó?</TableHeaderCell>
                                                    <TableHeaderCell>¿Bus Suplente?</TableHeaderCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {incPaginated.map((incident) => (
                                                    <TableRow key={incident.id} hover>
                                                        <TableCell>
                                                            {formatGuatemalaDatetime(incident.fecha)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {incident.piloto ? incident.piloto.name : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {incident.tipo === 'incidente'
                                                                ? 'Problema menor'
                                                                : 'Problema mayor'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {incident.tipoFalla}
                                                            {incident.tipoFalla === 'otro' &&
                                                            incident.otroFallaDetalle
                                                                ? ` (${incident.otroFallaDetalle})`
                                                                : ''}
                                                        </TableCell>
                                                        <TableCell>{incident.descripcion || '—'}</TableCell>
                                                        <TableCell>
                                                            {incident.pudoContinuarRuta ? 'Sí' : 'No'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {incident.seUtilizoBusSuplente ? 'Sí' : 'No'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Grid>

                            {/* Emergencias */}
                            <Grid item xs={12} md={6}>
                                <Typography
                                    variant="subtitle1"
                                    gutterBottom
                                    sx={{ fontWeight: 'bold', mb: 2 }}
                                >
                                    Emergencias
                                </Typography>

                                <FiltersRow>
                                    <TextField
                                        label="Fecha desde"
                                        type="date"
                                        value={emeDateFrom}
                                        onChange={(e) => setEmeDateFrom(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        size="small"
                                    />
                                    <TextField
                                        label="Fecha hasta"
                                        type="date"
                                        value={emeDateTo}
                                        onChange={(e) => setEmeDateTo(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        size="small"
                                    />
                                    <TextField
                                        label="Filtrar por Piloto"
                                        variant="outlined"
                                        size="small"
                                        value={emePilotFilter}
                                        onChange={(e) => setEmePilotFilter(e.target.value)}
                                    />
                                </FiltersRow>

                                {filteredEmergencies.length === 0 ? (
                                    <Typography variant="body2" color="textSecondary">
                                        No hay emergencias registradas con esos filtros
                                    </Typography>
                                ) : isMobile ? (
                                    <>
                                        {emePaginated.map((eme) => (
                                            <MobileCard key={eme.id}>
                                                <MobileField>
                                                    <MobileLabel>Fecha:</MobileLabel>
                                                    <MobileValue>
                                                        {formatGuatemalaDatetime(eme.fecha)}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Piloto:</MobileLabel>
                                                    <MobileValue>
                                                        {eme.piloto ? eme.piloto.name : '—'}
                                                    </MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Mensaje:</MobileLabel>
                                                    <MobileValue>{eme.mensaje}</MobileValue>
                                                </MobileField>
                                                <MobileField>
                                                    <MobileLabel>Ubicación (Lat,Lng):</MobileLabel>
                                                    <MobileValue>
                                                        {eme.latitud && eme.longitud
                                                            ? `${parseFloat(eme.latitud).toFixed(6)}, ${parseFloat(eme.longitud).toFixed(6)}`
                                                            : '—'}
                                                    </MobileValue>
                                                    {eme.latitud && eme.longitud && (
                                                        <Tooltip title="Ver mapa">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() =>
                                                                    handleOpenMap(
                                                                        parseFloat(eme.latitud),
                                                                        parseFloat(eme.longitud)
                                                                    )
                                                                }
                                                            >
                                                                <LocationOnIcon color="primary" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </MobileField>
                                            </MobileCard>
                                        ))}
                                        <TablePagination
                                            component="div"
                                            count={filteredEmergencies.length}
                                            page={emePage}
                                            onPageChange={handleChangeEmePage}
                                            rowsPerPage={emeRowsPerPage}
                                            onRowsPerPageChange={handleChangeEmeRowsPerPage}
                                            labelRowsPerPage="Filas por página"
                                        />
                                    </>
                                ) : (
                                    <TableContainer sx={{ overflowX: 'auto' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableHeaderCell sortDirection={emeOrderBy === 'fecha' ? emeOrder : false}>
                                                        <TableSortLabel
                                                            active={emeOrderBy === 'fecha'}
                                                            direction={emeOrderBy === 'fecha' ? emeOrder : 'asc'}
                                                            onClick={() => handleRequestEmeSort('fecha')}
                                                            hideSortIcon={false}
                                                            sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                        >
                                                            Fecha
                                                        </TableSortLabel>
                                                    </TableHeaderCell>
                                                    <TableHeaderCell sortDirection={emeOrderBy === 'piloto' ? emeOrder : false}>
                                                        <TableSortLabel
                                                            active={emeOrderBy === 'piloto'}
                                                            direction={emeOrderBy === 'piloto' ? emeOrder : 'asc'}
                                                            onClick={() => handleRequestEmeSort('piloto')}
                                                            hideSortIcon={false}
                                                            sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                        >
                                                            Piloto
                                                        </TableSortLabel>
                                                    </TableHeaderCell>
                                                    <TableHeaderCell>Mensaje</TableHeaderCell>
                                                    <TableHeaderCell>Ubicación (Lat,Lng)</TableHeaderCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {emePaginated.map((eme) => (
                                                    <TableRow key={eme.id} hover>
                                                        <TableCell>
                                                            {formatGuatemalaDatetime(eme.fecha)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {eme.piloto ? eme.piloto.name : '—'}
                                                        </TableCell>
                                                        <TableCell>{eme.mensaje}</TableCell>
                                                        <TableCell>
                                                            {eme.latitud && eme.longitud ? (
                                                                <>
                                                                    {parseFloat(eme.latitud).toFixed(6)},
                                                                    {' '}
                                                                    {parseFloat(eme.longitud).toFixed(6)}
                                                                    <Tooltip title="Ver mapa" sx={{ ml: 1 }}>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() =>
                                                                                handleOpenMap(
                                                                                    parseFloat(eme.latitud),
                                                                                    parseFloat(eme.longitud)
                                                                                )
                                                                            }
                                                                        >
                                                                            <LocationOnIcon color="primary" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Grid>
                        </Grid>
                    </SectionPaper>

                    {/* Sección Pagos (no supervisor) */}
                    {!isSupervisor && (
                        <SectionPaper>
                            <SectionTitle variant="h6" gutterBottom>
                                Gestión de pagos
                            </SectionTitle>
                            <FiltersRow>
                                <TextField
                                    label="Próximo Pago Desde"
                                    type="date"
                                    value={payDateFrom}
                                    onChange={(e) => { setPayDateFrom(e.target.value); setPayPage(0); }}
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                />
                                <TextField
                                    label="Próximo Pago Hasta"
                                    type="date"
                                    value={payDateTo}
                                    onChange={(e) => { setPayDateTo(e.target.value); setPayPage(0); }}
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                />
                                <TextField
                                    label="Saldo Mínimo"
                                    variant="outlined"
                                    size="small"
                                    value={payBalanceMin}
                                    onChange={(e) => { setPayBalanceMin(e.target.value); setPayPage(0); }}
                                />
                                <TextField
                                    label="Saldo Máximo"
                                    variant="outlined"
                                    size="small"
                                    value={payBalanceMax}
                                    onChange={(e) => { setPayBalanceMax(e.target.value); setPayPage(0); }}
                                />
                            </FiltersRow>

                            {loadingPayments ? (
                                <div tw="flex justify-center p-4">
                                    <CircularProgress />
                                </div>
                            ) : payments.length === 0 ? (
                                <Typography variant="body2" color="textSecondary">
                                    Aún no hay registros de pagos con esos filtros.
                                </Typography>
                            ) : isMobile ? (
                                <>
                                    {payments.map((pay) => (
                                        <MobileCard key={pay.id}>
                                            <MobileField>
                                                <MobileLabel>Padre (Usuario):</MobileLabel>
                                                <MobileValue>{pay.User ? pay.User.name : '—'}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Email:</MobileLabel>
                                                <MobileValue>{pay.User ? pay.User.email : '—'}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Estado:</MobileLabel>
                                                <MobileValue>{pay.finalStatus || pay.status}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Próximo Pago:</MobileLabel>
                                                <MobileValue>{formatGuatemalaDate(pay.nextPaymentDate)}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Saldo:</MobileLabel>
                                                <MobileValue>Q {pay.leftover ?? 0}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Acciones:</MobileLabel>
                                                {pay.User && (
                                                    <Tooltip title="Ver boletas de pago">
                                                        <IconButton
                                                            onClick={() =>
                                                                handleViewBoletas(
                                                                    pay.User.id,
                                                                    pay.User.name
                                                                )
                                                            }
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </MobileField>
                                        </MobileCard>
                                    ))}
                                    <TablePagination
                                        component="div"
                                        count={totalPaymentsCount}
                                        page={payPage}
                                        onPageChange={handleChangePayPage}
                                        rowsPerPage={payRowsPerPage}
                                        onRowsPerPageChange={handleChangePayRowsPerPage}
                                        labelRowsPerPage="Filas por página"
                                    />
                                </>
                            ) : (
                                <>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableHeaderCell sortDirection={payOrderBy === 'userName' ? payOrder : false}>
                                                    <TableSortLabel>
                                                        Padre (Usuario)
                                                    </TableSortLabel>
                                                </TableHeaderCell>
                                                <TableHeaderCell sortDirection={payOrderBy === 'userEmail' ? payOrder : false}>
                                                    <TableSortLabel>
                                                        Email
                                                    </TableSortLabel>
                                                </TableHeaderCell>
                                                <TableHeaderCell sortDirection={payOrderBy === 'finalStatus' ? payOrder : false}>
                                                    <TableSortLabel
                                                        active={payOrderBy === 'finalStatus'}
                                                        direction={payOrderBy === 'finalStatus' ? payOrder : 'asc'}
                                                        onClick={() => handleRequestPaySort('finalStatus')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Estado
                                                    </TableSortLabel>
                                                </TableHeaderCell>
                                                <TableHeaderCell sortDirection={payOrderBy === 'nextPaymentDate' ? payOrder : false}>
                                                    <TableSortLabel
                                                        active={payOrderBy === 'nextPaymentDate'}
                                                        direction={payOrderBy === 'nextPaymentDate' ? payOrder : 'asc'}
                                                        onClick={() => handleRequestPaySort('nextPaymentDate')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Próximo Pago
                                                    </TableSortLabel>
                                                </TableHeaderCell>
                                                <TableHeaderCell sortDirection={payOrderBy === 'leftover' ? payOrder : false}>
                                                    <TableSortLabel
                                                        active={payOrderBy === 'leftover'}
                                                        direction={payOrderBy === 'leftover' ? payOrder : 'asc'}
                                                        onClick={() => handleRequestPaySort('leftover')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Saldo
                                                    </TableSortLabel>
                                                </TableHeaderCell>
                                                <TableHeaderCell>Acciones</TableHeaderCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {payments.map((pay) => (
                                                <TableRow key={pay.id} hover>
                                                    <TableCell>
                                                        {pay.User ? pay.User.name : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {pay.User ? pay.User.email : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {pay.finalStatus || pay.status}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatGuatemalaDate(pay.nextPaymentDate)}
                                                    </TableCell>
                                                    <TableCell>Q {pay.leftover ?? 0}</TableCell>
                                                    <TableCell>
                                                        {pay.User && (
                                                            <Tooltip title="Ver boletas de pago">
                                                                <IconButton
                                                                    onClick={() =>
                                                                        handleViewBoletas(
                                                                            pay.User.id,
                                                                            pay.User.name
                                                                        )
                                                                    }
                                                                >
                                                                    <VisibilityIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <TablePagination
                                        component="div"
                                        count={totalPaymentsCount}
                                        page={payPage}
                                        onPageChange={handleChangePayPage}
                                        rowsPerPage={payRowsPerPage}
                                        onRowsPerPageChange={handleChangePayRowsPerPage}
                                        labelRowsPerPage="Filas por página"
                                    />
                                </>
                            )}

                            <SectionTitle variant="h6" gutterBottom sx={{ mt: 4 }}>
                                Análisis general de Pagos
                            </SectionTitle>
                            <Grid container spacing={4}>
                                <Grid item xs={12} md={4}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Total de registros de pago
                                        </Typography>
                                        <Typography variant="h5" color="primary">
                                            {totalPaymentsGlobal}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Pagos completados
                                        </Typography>
                                        <Typography variant="h5" color="success.main">
                                            {totalPaidCountGlobal}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Pagos en Mora
                                        </Typography>
                                        <Typography variant="h5" color="error">
                                            {totalMoraCountGlobal}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>

                            <Grid container spacing={4} sx={{ mt: 2 }}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Distribución por Estatus
                                    </Typography>
                                    <PieChart width={350} height={300}>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            label
                                            dataKey="value"
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={COLORS[index % COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                        <Legend />
                                    </PieChart>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Montos Globales
                                    </Typography>
                                    <BarChart
                                        width={350}
                                        height={300}
                                        data={barData}
                                        margin={{
                                            top: 20,
                                            right: 20,
                                            left: 10,
                                            bottom: 5
                                        }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Bar dataKey="Deuda Pendiente (totalDue)" fill="#8884d8" />
                                        <Bar dataKey="Saldo (leftover)" fill="#82ca9d" />
                                        <Bar dataKey="Multas (penalty)" fill="#ffc658" />
                                    </BarChart>
                                </Grid>
                            </Grid>
                        </SectionPaper>
                    )}
                </div>
            )}

            {/* Dialog Boletas */}
            {!isSupervisor && (
                <Dialog
                    open={openBoletasDialog}
                    onClose={handleCloseBoletasDialog}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>Boletas registradas de {currentParentName}</DialogTitle>
                    <DialogContent dividers>
                        {loadingBoletas ? (
                            <div tw="flex justify-center p-4">
                                <CircularProgress />
                            </div>
                        ) : currentBoletas.length === 0 ? (
                            <Typography>No hay boletas para este padre.</Typography>
                        ) : (
                            <Grid container spacing={2}>
                                {currentBoletas.map((b) => (
                                    <Grid item xs={12} md={4} key={b.id}>
                                        <Paper elevation={2} sx={{ p: 2, borderRadius: '8px' }}>
                                            <Typography variant="body2">
                                                <strong>Subido el:</strong>{' '}
                                                {formatGuatemalaDatetime(b.uploadedAt)}
                                            </Typography>
                                            <img
                                                src={b.fileUrl}
                                                alt="Boleta"
                                                style={{
                                                    maxWidth: '100%',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px',
                                                    marginTop: '8px'
                                                }}
                                            />
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseBoletasDialog} variant="outlined">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* Dialog ver Mapa */}
            <Dialog open={openMapDialog} onClose={handleCloseMap} maxWidth="md" fullWidth>
                <DialogTitle>Ubicación en Mapa</DialogTitle>
                <DialogContent dividers>
                    {selectedCoords.lat && selectedCoords.lng ? (
                        <iframe
                            title={`Map showing location at ${selectedCoords.lat}, ${selectedCoords.lng}`}
                            width="100%"
                            height="450"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            src={`https://www.google.com/maps?q=${selectedCoords.lat},${selectedCoords.lng}&z=15&output=embed`}
                        />
                    ) : (
                        <Typography>Coordenadas no disponibles</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" onClick={handleCloseMap}>
                        Cerrar
                    </Button>
                    {selectedCoords.lat && selectedCoords.lng && (
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                if (navigator.geolocation) {
                                    navigator.geolocation.getCurrentPosition(
                                        (pos) => {
                                            const userLat = pos.coords.latitude;
                                            const userLng = pos.coords.longitude;
                                            window.open(
                                                `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${selectedCoords.lat},${selectedCoords.lng}`,
                                                '_blank'
                                            );
                                        },
                                        (err) => {
                                            console.error('No se pudo obtener geolocalización =>', err);
                                            window.open(
                                                `https://www.google.com/maps/dir/?api=1&destination=${selectedCoords.lat},${selectedCoords.lng}`,
                                                '_blank'
                                            );
                                        },
                                        {
                                            enableHighAccuracy: true,
                                            timeout: 10000,
                                            maximumAge: 0
                                        }
                                    );
                                } else {
                                    window.open(
                                        `https://www.google.com/maps/dir/?api=1&destination=${selectedCoords.lat},${selectedCoords.lng}`,
                                        '_blank'
                                    );
                                }
                            }}
                        >
                            Trazar ruta
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Dialog Reportar Incidente */}
            <Dialog
                open={openIncidentDialog}
                onClose={handleCloseIncidentDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Reportar Incidente</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth margin="normal">
                                <InputLabel id="tipo-falla-label">Tipo de Falla</InputLabel>
                                <Select
                                    labelId="tipo-falla-label"
                                    label="Tipo de Falla"
                                    value={incidentForm.tipoFalla}
                                    onChange={(e) => handleIncidentFormChange('tipoFalla', e.target.value)}
                                >
                                    <MenuItem value="mecánico">Mecánico</MenuItem>
                                    <MenuItem value="eléctrico">Eléctrico</MenuItem>
                                    <MenuItem value="choque">Choque</MenuItem>
                                    <MenuItem value="otro">Otro</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth margin="normal">
                                <InputLabel id="tipo-incidente-label">Tipo de Incidente</InputLabel>
                                <Select
                                    labelId="tipo-incidente-label"
                                    label="Tipo de Incidente"
                                    value={incidentForm.tipo}
                                    onChange={(e) => handleIncidentFormChange('tipo', e.target.value)}
                                >
                                    <MenuItem value="incidente">Problema menor</MenuItem>
                                    <MenuItem value="accidente">Problema mayor</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {incidentForm.tipoFalla === 'otro' && (
                            <Grid item xs={12}>
                                <TextField
                                    label="Detalle de la Falla (Otro)"
                                    value={incidentForm.otroFallaDetalle}
                                    onChange={(e) => handleIncidentFormChange('otroFallaDetalle', e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                        )}

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={incidentForm.pudoContinuarRuta}
                                        onChange={(e) =>
                                            handleIncidentFormChange('pudoContinuarRuta', e.target.checked)
                                        }
                                    />
                                }
                                label="¿Pudo continuar la ruta?"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={incidentForm.seUtilizoBusSuplente}
                                        onChange={(e) =>
                                            handleIncidentFormChange('seUtilizoBusSuplente', e.target.checked)
                                        }
                                    />
                                }
                                label="¿Se utilizó bus suplente?"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Descripción"
                                value={incidentForm.descripcion}
                                onChange={(e) => handleIncidentFormChange('descripcion', e.target.value)}
                                multiline
                                rows={4}
                                fullWidth
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" onClick={handleCloseIncidentDialog}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmitIncident}
                        disabled={loading}
                    >
                        Reportar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={5000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default ActivityLogPage;
