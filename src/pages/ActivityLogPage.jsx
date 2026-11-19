import React, { useState, useEffect } from 'react';
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
    Grid2,
    Chip,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    AccordionActions,
    Divider,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Box
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
import usePermissions from '../hooks/usePermissions';
import useNotify from '../hooks/useNotify';
import moment from 'moment-timezone';
import useTableState from '../hooks/useTableState';
import useIsMobile from '../hooks/useIsMobile';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import { MobileCard, MobileField } from '../components/table/MobileCard';
import { sortRows } from '../utils/tableSort';
import { formatDateTime, formatDate } from '../utils/dateFormat';
import { formatQ } from '../utils/currency';

// -------------
// Funciones de formateo
// -------------
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

// =================== Valores para ordenamiento ===================
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

// Columnas de la tabla
const BUS_COLUMNS = [
    { id: 'plate', label: 'Placa', sortable: true },
    { id: 'pilot', label: 'Piloto', sortable: true },
    { id: 'monitora', label: 'Monitora', sortable: true },
    { id: 'description', label: 'Descripción', sortable: true },
];

// Columnas de la tabla
const INCIDENT_COLUMNS = [
    { id: 'fecha', label: 'Fecha', sortable: true },
    { id: 'piloto', label: 'Piloto', sortable: true },
    { id: 'tipo_gravedad', label: 'Tipo (Gravedad)' },
    { id: 'tipoFalla', label: 'Tipo de Falla', sortable: true },
    { id: 'descripcion', label: 'Descripción', sortable: true },
    { id: 'continuo', label: '¿Continuó?' },
    { id: 'bus_suplente', label: '¿Bus Suplente?' },
];

// Columnas de la tabla
const EMERGENCY_COLUMNS = [
    { id: 'fecha', label: 'Fecha', sortable: true },
    { id: 'piloto', label: 'Piloto', sortable: true },
    { id: 'mensaje', label: 'Mensaje' },
    { id: 'ubicacion_lat_lng', label: 'Ubicación (Lat,Lng)' },
];

// Columnas de la tabla
const PAYMENT_COLUMNS = [
    { id: 'padre_usuario', label: 'Padre (Usuario)' },
    { id: 'email', label: 'Email' },
    { id: 'finalStatus', label: 'Estado', sortable: true },
    { id: 'nextPaymentDate', label: 'Próximo Pago', sortable: true },
    { id: 'leftover', label: 'Saldo', sortable: true },
    { id: 'acciones', label: 'Acciones' },
];

const ActivityLogPage = () => {
    const isMobile = useIsMobile();

    const { hasPermission } = usePermissions();
    const puedeVerPagos = hasPermission('pagos-listar');
    const puedeVerAnalisisPagos = hasPermission('pagos-ver-analisis');
    const puedeVerBoletas = hasPermission('padres-ver-boletas');
    const puedeMarcarTaller = hasPermission('buses-marcar-taller');
    const puedeCrearIncidente = hasPermission('actividad-crear-incidente');
    const [loading, setLoading] = useState(false);

    const [buses, setBuses] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [payments, setPayments] = useState([]);
    const [totalPaymentsCount, setTotalPaymentsCount] = useState(0);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [loadingBoletas, setLoadingBoletas] = useState(false);

    const notify = useNotify();

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

    const [incDateFrom, setIncDateFrom] = useState('');
    const [incDateTo, setIncDateTo] = useState('');
    const [incPilotFilter, setIncPilotFilter] = useState('');
    const [incDescriptionFilter, setIncDescriptionFilter] = useState('');

    const [emeDateFrom, setEmeDateFrom] = useState('');
    const [emeDateTo, setEmeDateTo] = useState('');
    const [emePilotFilter, setEmePilotFilter] = useState('');

    const [payDateFrom, setPayDateFrom] = useState('');
    const [payDateTo, setPayDateTo] = useState('');
    const [payBalanceMin, setPayBalanceMin] = useState('');
    const [payBalanceMax, setPayBalanceMax] = useState('');
    

    const busTable = useTableState({ defaultOrderBy: 'plate' });
    const incTable = useTableState();
    const emeTable = useTableState();
    const payTable = useTableState();
    const { page: payPage, rowsPerPage: payRowsPerPage, order: payOrder, orderBy: payOrderBy } = payTable;

    useEffect(() => {
        fetchAllData();
        if (puedeVerAnalisisPagos) {
            fetchPaymentsAnalysis();
        }
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

            if (puedeVerPagos) {
                const payResp = await api.get('/payments');
                setPayments(payResp.data.payments || []);
            }
        } catch (error) {
            console.error('Error fetchAllData =>', error);
            notify.error('Error al obtener datos para registro de actividades');
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
            notify.error('Error al obtener pagos');
        } finally {
            setLoadingPayments(false);
        }
    };

    // Llama a fetchPayments cuando cambian filtros, orden o paginación
    useEffect(() => {
        if (puedeVerPagos) {
            fetchPayments();
        }
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
            notify.error('Error al obtener boletas del padre');
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
            notify.success(newValue ? 'Bus marcado como "En Taller".' : 'Bus marcado como disponible.');
            fetchAllData();
        } catch (error) {
            console.error('Error handleToggleBusTaller =>', error);
            notify.error('No se pudo actualizar el estado del bus');
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
            notify.warning('La descripción es obligatoria para el incidente');
            return;
        }
        if (!incidentForm.busId) {
            notify.error('No se encontró el bus para el incidente');
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
            notify.success('Incidencia reportada');
            setOpenIncidentDialog(false);

            const incResp = await api.get('/activity-logs/incidents');
            setIncidents(incResp.data.incidents || []);
        } catch (error) {
            console.error('Error al crear incidente =>', error);
            notify.error('No se pudo reportar el incidente');
        } finally {
            setLoading(false);
        }
    };

    // === Filtrado y Ordenamiento Buses ===
    const filteredBuses = buses.filter((b) => {
        if (busPilotFilter) {
            const pilotName = b?.pilot?.name?.toLowerCase() || '';
            if (!pilotName.includes(busPilotFilter.toLowerCase())) {
                return false;
            }
        }
        if (busMonitoraFilter) {
            const monitoraName = b?.monitora?.name?.toLowerCase() || '';
            if (!monitoraName.includes(busMonitoraFilter.toLowerCase())) {
                return false;
            }
        }
        if (busDescriptionFilter) {
            const desc = b?.description?.toLowerCase() || '';
            if (!desc.includes(busDescriptionFilter.toLowerCase())) {
                return false;
            }
        }
        return true;
    });
    const sortedBuses = sortRows(filteredBuses, { orderBy: busTable.orderBy, order: busTable.order, getValue: (row, field) => getFieldValue(row, field, 'buses') });
    const busesPaginated = busTable.paginate(sortedBuses);


    // === Filtrado y Ordenamiento Incidentes ===
    const filteredIncidents = incidents.filter((inc) => {
        if (incDateFrom) {
            const from = moment(incDateFrom, 'YYYY-MM-DD').startOf('day').valueOf();
            const incDateMs = moment.utc(inc.fecha).tz('America/Guatemala').valueOf();
            if (incDateMs < from) {
                return false;
            }
        }
        if (incDateTo) {
            const to = moment(incDateTo, 'YYYY-MM-DD').endOf('day').valueOf();
            const incDateMs = moment.utc(inc.fecha).tz('America/Guatemala').valueOf();
            if (incDateMs > to) {
                return false;
            }
        }
        if (incPilotFilter) {
            const pilotName = inc?.piloto?.name?.toLowerCase() || '';
            if (!pilotName.includes(incPilotFilter.toLowerCase())) {
                return false;
            }
        }
        if (incDescriptionFilter) {
            const desc = inc?.descripcion?.toLowerCase() || '';
            if (!desc.includes(incDescriptionFilter.toLowerCase())) {
                return false;
            }
        }
        return true;
    });
    const sortedIncidents = sortRows(filteredIncidents, { orderBy: incTable.orderBy, order: incTable.order, getValue: (row, field) => getFieldValue(row, field, 'incidents') });
    const incPaginated = incTable.paginate(sortedIncidents);

    // === Filtrado y Ordenamiento Emergencias ===
    const filteredEmergencies = emergencies.filter((eme) => {
        if (emeDateFrom) {
            const from = moment(emeDateFrom, 'YYYY-MM-DD').startOf('day').valueOf();
            const emeDateMs = moment.utc(eme.fecha).tz('America/Guatemala').valueOf();
            if (emeDateMs < from) {
                return false;
            }
        }
        if (emeDateTo) {
            const to = moment(emeDateTo, 'YYYY-MM-DD').endOf('day').valueOf();
            const emeDateMs = moment.utc(eme.fecha).tz('America/Guatemala').valueOf();
            if (emeDateMs > to) {
                return false;
            }
        }
        if (emePilotFilter) {
            const pilotName = eme?.piloto?.name?.toLowerCase() || '';
            if (!pilotName.includes(emePilotFilter.toLowerCase())) {
                return false;
            }
        }
        return true;
    });
    const sortedEmergencies = sortRows(filteredEmergencies, { orderBy: emeTable.orderBy, order: emeTable.order, getValue: (row, field) => getFieldValue(row, field, 'emergencies') });
    const emePaginated = emeTable.paginate(sortedEmergencies);

    // === Filtrado y Ordenamiento Pagos (no supervisor) ===
    
    // Colores para segmentos: CONFIRMADO, ADELANTADO, EN_PROCESO, PENDIENTE, MORA
        const COLORS = ['#2E7D32', '#1976D2', '#2196f3', '#FFC107', '#F44336'];

    const [totalPaymentsGlobal, setTotalPaymentsGlobal] = useState(0);
    const [totalPaidCountGlobal, setTotalPaidCountGlobal] = useState(0);
    // Contadores desglosados
    const [totalConfirmedCountGlobal, setTotalConfirmedCountGlobal] = useState(0);
    const [totalAdelantadoCountGlobal, setTotalAdelantadoCountGlobal] = useState(0);
    const [totalMoraCountGlobal, setTotalMoraCountGlobal] = useState(0);
    const [totalEnProcesoCountGlobal, setTotalEnProcesoCountGlobal] = useState(0);
    const [totalPendingCountGlobal, setTotalPendingCountGlobal] = useState(0);
    const [totalLeftoverGlobal, setTotalLeftoverGlobal] = useState(0);
    const [totalDueGlobal, setTotalDueGlobal] = useState(0);
    const [totalPenaltyGlobal, setTotalPenaltyGlobal] = useState(0);

    const statusData = [
        { name: 'Pagado', value: totalConfirmedCountGlobal },
        { name: 'ADELANTADO', value: totalAdelantadoCountGlobal },
        { name: 'En Proceso', value: totalEnProcesoCountGlobal },
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

            // Intentamos leer contadores desglosados; si la API sólo devuelve PAGADO, lo tratamos como CONFIRMADO por compatibilidad
            let confirmedCount = res.data.statusDistribution?.find(s => s.finalStatus === 'CONFIRMADO')?.count || 0;
            let adelantadoCount = res.data.statusDistribution?.find(s => s.finalStatus === 'ADELANTADO')?.count || 0;
            const pagadoComposite = res.data.statusDistribution?.find(s => s.finalStatus === 'PAGADO')?.count || 0;

            let totalPaid = confirmedCount;
            if (totalPaid === 0 && pagadoComposite) {
                // fallback: asignar todo a CONFIRMADO si sólo existe la clave PAGADO
                totalPaid = pagadoComposite;
                if (!confirmedCount && !adelantadoCount) {
                    confirmedCount = pagadoComposite;
                }
            }

            setTotalPaidCountGlobal(totalPaid);
            setTotalConfirmedCountGlobal(confirmedCount);
            setTotalAdelantadoCountGlobal(adelantadoCount);
            const enProcesoCount = res.data.statusDistribution?.find(s => s.finalStatus === 'EN_PROCESO')?.count || 0;
            setTotalEnProcesoCountGlobal(enProcesoCount);
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
            notify.error('Error al obtener análisis global de pagos');
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
                                <SortableTableHead columns={BUS_COLUMNS} {...busTable.sortProps} cellSx={{ fontWeight: 600, backgroundColor: '#DCF3FF', color: '#333' }} showSortIcons />
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
                                                <MobileField label="Placa">
                                                    <div>{bus.plate}</div>
                                                </MobileField>
                                                <MobileField label="Piloto">
                                                    <div>
                                                        {bus.pilot ? bus.pilot.name : '—'}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="Monitora">
                                                    <div>
                                                        {bus.monitora ? bus.monitora.name : '—'}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="Número de ruta">
                                                    <div>{bus.routeNumber || '—'}</div>
                                                </MobileField>
                                                <MobileField label="Descripción">
                                                    <div>{bus.description || '—'}</div>
                                                </MobileField>
                                                <MobileField label="Estado de Ruta">
                                                    {!bus.currentRoute && (
                                                        <div>Sin ruta activa</div>
                                                    )}
                                                    {bus.currentRoute && !bus.currentRoute.endTime && (
                                                        <div>
                                                            En Ruta (Inicio:{' '}
                                                            {formatDateTime(bus.currentRoute.startTime, { utc: true })})
                                                        </div>
                                                    )}
                                                    {bus.currentRoute?.endTime && (
                                                        <div>
                                                            Finalizada a las{' '}
                                                            {formatDateTime(bus.currentRoute.endTime, { utc: true })}
                                                        </div>
                                                    )}
                                                </MobileField>
                                                <MobileField label="Paradas">
                                                    {Array.isArray(bus.stops) && bus.stops.length > 0 ? (
                                                        <>
                                                            {bus.stops.map((stop) => (
                                                                <MobileCard
                                                                    key={stop.stopId}
                                                                    sx={{ p: 2, mb: 1 }}
                                                                >
                                                                    <MobileField label="Horario">
                                                                        <div>{stop.time}</div>
                                                                    </MobileField>
                                                                    <MobileField label="Nota">
                                                                        <div>
                                                                            {stop.note || ''}
                                                                        </div>
                                                                    </MobileField>
                                                                    <MobileField label="Padre">
                                                                        <div>
                                                                            {stop.parentName}
                                                                        </div>
                                                                    </MobileField>
                                                                    <MobileField label="Estudiantes">
                                                                        <div>
                                                                            {stop.students}
                                                                        </div>
                                                                    </MobileField>
                                                                </MobileCard>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <div>No hay paradas registradas.</div>
                                                    )}
                                                </MobileField>
                                                <MobileField label="ID Bus">
                                                    <div>{bus.id}</div>
                                                </MobileField>
                                                <MobileField label="Estado Taller">
                                                    <div>
                                                        {bus.inWorkshop ? 'En Taller' : 'Disponible'}
                                                    </div>
                                                </MobileField>

                                                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                    {puedeMarcarTaller && (bus.inWorkshop ? (
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
                                                    ))}
                                                    {puedeCrearIncidente && (
                                                        <Tooltip title="Reportar Incidencia">
                                                            <IconButton
                                                                color="warning"
                                                                onClick={() => handleOpenIncidentDialog(bus)}
                                                            >
                                                                <ReportIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </MobileCard>
                                        ))}
                                        <AppTablePagination count={filteredBuses.length} {...busTable.paginationProps} />
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
                                                    {!bus.currentRoute && (
                                                        <Chip
                                                            label="Sin ruta activa"
                                                            color="default"
                                                            size="small"
                                                            sx={{ ml: 2 }}
                                                        />
                                                    )}
                                                    {bus.currentRoute && !bus.currentRoute.endTime && (
                                                        <Chip
                                                            label={`En Ruta (Inicio: ${formatDateTime(bus.currentRoute.startTime, { utc: true })})`}
                                                            color="primary"
                                                            size="small"
                                                            sx={{ ml: 2 }}
                                                        />
                                                    )}
                                                    {bus.currentRoute?.endTime && (
                                                        <Chip
                                                            label={`Finalizada a las ${formatDateTime(bus.currentRoute.endTime, { utc: true })}`}
                                                            color="secondary"
                                                            size="small"
                                                            sx={{ ml: 2 }}
                                                        />
                                                    )}
                                                </AccordionSummaryStyled>

                                                <AccordionDetails>
                                                    <Grid2 container spacing={2}>
                                                        <Grid2 size={{ xs: 12, md: 6 }}>
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
                                                        </Grid2>
                                                        <Grid2 size={{ xs: 12, md: 6 }}>
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
                                                        </Grid2>
                                                    </Grid2>
                                                </AccordionDetails>

                                                <Divider />
                                                <AccordionActions>
                                                    <Typography variant="caption" color="textSecondary" sx={{ mr: 2 }}>
                                                        ID Bus: {bus.id}
                                                    </Typography>
                                                    {puedeMarcarTaller && (bus.inWorkshop ? (
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
                                                    ))}
                                                    {puedeCrearIncidente && (
                                                        <Tooltip title="Reportar Incidencia">
                                                            <IconButton
                                                                color="warning"
                                                                onClick={() => handleOpenIncidentDialog(bus)}
                                                            >
                                                                <ReportIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </AccordionActions>
                                            </AccordionStyled>
                                        ))}
                                        <AppTablePagination count={filteredBuses.length} {...busTable.paginationProps} />
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

                        <Grid2 container spacing={2} mt={1}>
                            {/* Incidentes */}
                            <Grid2 size={{ xs: 12, md: 6 }}>
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

                                {filteredIncidents.length === 0 && (
                                    <Typography variant="body2" color="textSecondary">
                                        No hay incidentes reportados con esos filtros
                                    </Typography>
                                )}
                                {filteredIncidents.length > 0 && isMobile && (
                                    <>
                                        {incPaginated.map((incident) => (
                                            <MobileCard key={incident.id}>
                                                <MobileField label="Fecha">
                                                    <div>
                                                        {formatDateTime(incident.fecha, { utc: true })}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="Piloto">
                                                    <div>
                                                        {incident.piloto ? incident.piloto.name : '—'}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="Tipo (Gravedad)">
                                                    <div>
                                                        {incident.tipo === 'incidente'
                                                            ? 'Problema menor'
                                                            : 'Problema mayor'}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="Tipo de Falla">
                                                    <div>
                                                        {incident.tipoFalla || '—'}
                                                    </div>
                                                </MobileField>
                                                {incident.tipoFalla === 'otro' && incident.otroFallaDetalle && (
                                                    <MobileField label="Otro (Detalle)">
                                                        <div>{incident.otroFallaDetalle}</div>
                                                    </MobileField>
                                                )}
                                                <MobileField label="Descripción">
                                                    <div>
                                                        {incident.descripcion || '—'}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="¿Pudo continuar la ruta?">
                                                    <div>
                                                        {incident.pudoContinuarRuta ? 'Sí' : 'No'}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="¿Bus Suplente?">
                                                    <div>
                                                        {incident.seUtilizoBusSuplente ? 'Sí' : 'No'}
                                                    </div>
                                                </MobileField>
                                            </MobileCard>
                                        ))}
                                        <AppTablePagination count={filteredIncidents.length} {...incTable.paginationProps} />
                                    </>
                                )}
                                {filteredIncidents.length > 0 && !isMobile && (
                                    <AppTableContainer>
                                        <Table size="small">
                                            <SortableTableHead columns={INCIDENT_COLUMNS} {...incTable.sortProps} cellSx={{ fontWeight: 600, backgroundColor: '#DCF3FF', color: '#333' }} />
                                            <TableBody>
                                                {incPaginated.map((incident) => (
                                                    <TableRow key={incident.id} hover>
                                                        <TableCell>
                                                            {formatDateTime(incident.fecha, { utc: true })}
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
                                    </AppTableContainer>
                                )}
                            </Grid2>

                            {/* Emergencias */}
                            <Grid2 size={{ xs: 12, md: 6 }}>
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

                                {filteredEmergencies.length === 0 && (
                                    <Typography variant="body2" color="textSecondary">
                                        No hay emergencias registradas con esos filtros
                                    </Typography>
                                )}
                                {filteredEmergencies.length > 0 && isMobile && (
                                    <>
                                        {emePaginated.map((eme) => (
                                            <MobileCard key={eme.id}>
                                                <MobileField label="Fecha">
                                                    <div>
                                                        {formatDateTime(eme.fecha, { utc: true })}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="Piloto">
                                                    <div>
                                                        {eme.piloto ? eme.piloto.name : '—'}
                                                    </div>
                                                </MobileField>
                                                <MobileField label="Mensaje">
                                                    <div>{eme.mensaje}</div>
                                                </MobileField>
                                                <MobileField label="Ubicación (Lat,Lng)">
                                                    <div>
                                                        {eme.latitud && eme.longitud
                                                            ? `${Number.parseFloat(eme.latitud).toFixed(6)}, ${Number.parseFloat(eme.longitud).toFixed(6)}`
                                                            : '—'}
                                                    </div>
                                                    {eme.latitud && eme.longitud && (
                                                        <Tooltip title="Ver mapa">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() =>
                                                                    handleOpenMap(
                                                                        Number.parseFloat(eme.latitud),
                                                                        Number.parseFloat(eme.longitud)
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
                                        <AppTablePagination count={filteredEmergencies.length} {...emeTable.paginationProps} />
                                    </>
                                )}
                                {filteredEmergencies.length > 0 && !isMobile && (
                                    <AppTableContainer>
                                        <Table size="small">
                                            <SortableTableHead columns={EMERGENCY_COLUMNS} {...emeTable.sortProps} cellSx={{ fontWeight: 600, backgroundColor: '#DCF3FF', color: '#333' }} />
                                            <TableBody>
                                                {emePaginated.map((eme) => (
                                                    <TableRow key={eme.id} hover>
                                                        <TableCell>
                                                            {formatDateTime(eme.fecha, { utc: true })}
                                                        </TableCell>
                                                        <TableCell>
                                                            {eme.piloto ? eme.piloto.name : '—'}
                                                        </TableCell>
                                                        <TableCell>{eme.mensaje}</TableCell>
                                                        <TableCell>
                                                            {eme.latitud && eme.longitud ? (
                                                                <>
                                                                    {Number.parseFloat(eme.latitud).toFixed(6)},
                                                                    {' '}
                                                                    {Number.parseFloat(eme.longitud).toFixed(6)}
                                                                    <Tooltip title="Ver mapa" sx={{ ml: 1 }}>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() =>
                                                                                handleOpenMap(
                                                                                    Number.parseFloat(eme.latitud),
                                                                                    Number.parseFloat(eme.longitud)
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
                                    </AppTableContainer>
                                )}
                            </Grid2>
                        </Grid2>
                    </SectionPaper>

                    {puedeVerPagos && (
                        <SectionPaper>
                            <SectionTitle variant="h6" gutterBottom>
                                Gestión de pagos
                            </SectionTitle>
                            <FiltersRow>
                                <TextField
                                    label="Próximo Pago Desde"
                                    type="date"
                                    value={payDateFrom}
                                    onChange={(e) => { setPayDateFrom(e.target.value); payTable.resetPage(); }}
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                />
                                <TextField
                                    label="Próximo Pago Hasta"
                                    type="date"
                                    value={payDateTo}
                                    onChange={(e) => { setPayDateTo(e.target.value); payTable.resetPage(); }}
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                />
                                <TextField
                                    label="Saldo Mínimo"
                                    variant="outlined"
                                    size="small"
                                    value={payBalanceMin}
                                    onChange={(e) => { setPayBalanceMin(e.target.value); payTable.resetPage(); }}
                                />
                                <TextField
                                    label="Saldo Máximo"
                                    variant="outlined"
                                    size="small"
                                    value={payBalanceMax}
                                    onChange={(e) => { setPayBalanceMax(e.target.value); payTable.resetPage(); }}
                                />
                            </FiltersRow>

                            {loadingPayments && (
                                <div tw="flex justify-center p-4">
                                    <CircularProgress />
                                </div>
                            )}
                            {!loadingPayments && payments.length === 0 && (
                                <Typography variant="body2" color="textSecondary">
                                    Aún no hay registros de pagos con esos filtros.
                                </Typography>
                            )}
                            {!loadingPayments && payments.length > 0 && isMobile && (
                                <>
                                    {payments.map((pay) => (
                                        <MobileCard key={pay.id}>
                                            <MobileField label="Padre (Usuario)">
                                                <div>{pay.User ? pay.User.name : '—'}</div>
                                            </MobileField>
                                            <MobileField label="Email">
                                                <div>{pay.User ? pay.User.email : '—'}</div>
                                            </MobileField>
                                            <MobileField label="Estado">
                                                <div>{pay.finalStatus || pay.status}</div>
                                            </MobileField>
                                            <MobileField label="Próximo Pago">
                                                <div>{formatDate(pay.nextPaymentDate, { utc: true })}</div>
                                            </MobileField>
                                            <MobileField label="Saldo">
                                                <div>{formatQ(pay.leftover ?? 0)}</div>
                                            </MobileField>
                                            <MobileField label="Acciones">
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
                                    <AppTablePagination count={totalPaymentsCount} {...payTable.paginationProps} />
                                </>
                            )}
                            {!loadingPayments && payments.length > 0 && !isMobile && (
                                <>
                                    <Table size="small">
                                        <SortableTableHead columns={PAYMENT_COLUMNS} {...payTable.sortProps} cellSx={{ fontWeight: 600, backgroundColor: '#DCF3FF', color: '#333' }} />
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
                                                        {formatDate(pay.nextPaymentDate, { utc: true })}
                                                    </TableCell>
                                                    <TableCell>{formatQ(pay.leftover ?? 0)}</TableCell>
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
                                    <AppTablePagination count={totalPaymentsCount} {...payTable.paginationProps} />
                                </>
                            )}

                            <SectionTitle variant="h6" gutterBottom sx={{ mt: 4 }}>
                                Análisis general de Pagos
                            </SectionTitle>
                            <Grid2 container spacing={4}>
                                <Grid2 size={{ xs: 12, md: 4 }}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Total de registros de pago
                                        </Typography>
                                        <Typography variant="h5" color="primary">
                                            {totalPaymentsGlobal}
                                        </Typography>
                                    </Paper>
                                </Grid2>
                                <Grid2 size={{ xs: 12, md: 4 }}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Pagos completados
                                        </Typography>
                                        <Typography variant="h5" color="success.main">
                                            {totalPaidCountGlobal}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                            <strong>Pagado:</strong> {totalConfirmedCountGlobal} &nbsp;·&nbsp;
                                            <strong>Adelantado:</strong> {totalAdelantadoCountGlobal} &nbsp;·&nbsp;
                                            <strong>En Proceso:</strong> {totalEnProcesoCountGlobal}
                                        </Typography>
                                    </Paper>
                                </Grid2>
                                <Grid2 size={{ xs: 12, md: 4 }}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Pagos en Mora
                                        </Typography>
                                        <Typography variant="h5" color="error">
                                            {totalMoraCountGlobal}
                                        </Typography>
                                    </Paper>
                                </Grid2>
                            </Grid2>

                            <Grid2 container spacing={4} sx={{ mt: 2 }}>
                                <Grid2 size={{ xs: 12, md: 6 }}>
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
                                </Grid2>
                                <Grid2 size={{ xs: 12, md: 6 }}>
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
                                </Grid2>
                            </Grid2>
                        </SectionPaper>
                    )}
                </div>
            )}

            {/* Dialog Boletas: requiere la llave de GET /parents/:id/receipts */}
            {puedeVerBoletas && (
                <Dialog
                    open={openBoletasDialog}
                    onClose={handleCloseBoletasDialog}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>Boletas registradas de {currentParentName}</DialogTitle>
                    <DialogContent dividers>
                        {loadingBoletas && (
                            <div tw="flex justify-center p-4">
                                <CircularProgress />
                            </div>
                        )}
                        {!loadingBoletas && currentBoletas.length === 0 && (
                            <Typography>No hay boletas para este padre.</Typography>
                        )}
                        {!loadingBoletas && currentBoletas.length > 0 && (
                            <Grid2 container spacing={2}>
                                {currentBoletas.map((b) => (
                                    <Grid2 size={{ xs: 12, md: 4 }} key={b.id}>
                                        <Paper elevation={2} sx={{ p: 2, borderRadius: '8px' }}>
                                            {String(b.uploadSource || '').toUpperCase() === 'ADMIN' && (
                                                <Chip size="small" variant="outlined" color="primary" label="Administrador" sx={{ mb: 1 }} />
                                            )}
                                            <Typography variant="body2">
                                                <strong>Fecha:</strong>{' '}
                                                {formatDateTime(b.displayDate || b.uploadedAt, { utc: true })}
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
                                    </Grid2>
                                ))}
                            </Grid2>
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
                    <Grid2 container spacing={2}>
                        <Grid2 size={{ xs: 12, sm: 6 }}>
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
                        </Grid2>

                        <Grid2 size={{ xs: 12, sm: 6 }}>
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
                        </Grid2>

                        {incidentForm.tipoFalla === 'otro' && (
                            <Grid2 size={{ xs: 12 }}>
                                <TextField
                                    label="Detalle de la Falla (Otro)"
                                    value={incidentForm.otroFallaDetalle}
                                    onChange={(e) => handleIncidentFormChange('otroFallaDetalle', e.target.value)}
                                    fullWidth
                                />
                            </Grid2>
                        )}

                        <Grid2 size={{ xs: 12 }}>
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
                        </Grid2>

                        <Grid2 size={{ xs: 12 }}>
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
                        </Grid2>

                        <Grid2 size={{ xs: 12 }}>
                            <TextField
                                label="Descripción"
                                value={incidentForm.descripcion}
                                onChange={(e) => handleIncidentFormChange('descripcion', e.target.value)}
                                multiline
                                rows={4}
                                fullWidth
                            />
                        </Grid2>
                    </Grid2>
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" onClick={handleCloseIncidentDialog}>
                        Cancelar
                    </Button>
                    {puedeCrearIncidente && (
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubmitIncident}
                            disabled={loading}
                        >
                            Reportar
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

        </PageContainer>
    );
};

export default ActivityLogPage;
