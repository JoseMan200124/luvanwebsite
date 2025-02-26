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

// -- Importar componentes Recharts para análisis
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

const ActivityLogPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Rol Supervisor
    const isSupervisor = auth?.user?.roleId === 6;
    const [loading, setLoading] = useState(false);

    // Datos
    const [buses, setBuses] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [payments, setPayments] = useState([]);

    // Snackbar
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialogs
    const [openBoletasDialog, setOpenBoletasDialog] = useState(false);
    const [currentBoletas, setCurrentBoletas] = useState([]);
    const [currentParentName, setCurrentParentName] = useState('');

    const [openMapDialog, setOpenMapDialog] = useState(false);
    const [selectedCoords, setSelectedCoords] = useState({ lat: null, lng: null });

    // Dialog para incidente
    const [openIncidentDialog, setOpenIncidentDialog] = useState(false);
    // Añadimos "otroFallaDetalle" cuando tipoFalla === 'otro'.
    const [incidentForm, setIncidentForm] = useState({
        busId: null,
        tipoFalla: 'mecánico',
        tipo: 'incidente',
        descripcion: '',
        pudoContinuarRuta: false,
        seUtilizoBusSuplente: false,
        otroFallaDetalle: '' // solo se llena si tipoFalla = 'otro'
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
    const [payRowsPerPage, setPayRowsPerPage] = useState(5);

    useEffect(() => {
        fetchAllData();
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

    const handleChangeAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    const handleViewBoletas = async (fatherId, fatherName) => {
        try {
            setLoading(true);
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
            setLoading(false);
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

    // Reportar Incidente (Novedad)
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
                // Enviamos la descripción extra si es "otro"
                otroFallaDetalle: incidentForm.tipoFalla === 'otro'
                    ? incidentForm.otroFallaDetalle
                    : ''
            });
            setSnackbar({
                open: true,
                message: 'Incidencia reportada correctamente',
                severity: 'success'
            });
            setOpenIncidentDialog(false);

            // Refrescar incidentes
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

    // Filtrado Buses
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
    const busesPaginated = filteredBuses.slice(
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

    // Filtrado Incidentes
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
    const incPaginated = filteredIncidents.slice(
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

    // Filtrado Emergencias
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
    const emePaginated = filteredEmergencies.slice(
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

    // Filtrado Pagos (si no es supervisor)
    const filteredPayments = payments.filter((pay) => {
        if (payDateFrom) {
            const from = moment(payDateFrom, 'YYYY-MM-DD').startOf('day').valueOf();
            const payDateMs = pay.nextPaymentDate
                ? moment.utc(pay.nextPaymentDate).tz('America/Guatemala').valueOf()
                : 0;
            if (payDateMs < from) return false;
        }
        if (payDateTo) {
            const to = moment(payDateTo, 'YYYY-MM-DD').endOf('day').valueOf();
            const payDateMs = pay.nextPaymentDate
                ? moment.utc(pay.nextPaymentDate).tz('America/Guatemala').valueOf()
                : 0;
            if (payDateMs > to) return false;
        }
        if (payBalanceMin) {
            if ((pay.leftover ?? 0) < parseFloat(payBalanceMin)) return false;
        }
        if (payBalanceMax) {
            if ((pay.leftover ?? 0) > parseFloat(payBalanceMax)) return false;
        }
        return true;
    });
    const payPaginated = filteredPayments.slice(
        payPage * payRowsPerPage,
        payPage * payRowsPerPage + payRowsPerPage
    );
    const handleChangePayPage = (event, newPage) => {
        setPayPage(newPage);
    };
    const handleChangePayRowsPerPage = (event) => {
        setPayRowsPerPage(parseInt(event.target.value, 10));
        setPayPage(0);
    };

    // Análisis de pagos (Recharts)
    const totalPayments = payments.length;
    const totalPaidCount = payments.filter((p) => p.finalStatus === 'PAGADO').length;
    const totalPendingCount = payments.filter((p) => p.finalStatus === 'PENDIENTE').length;
    const totalMoraCount = payments.filter((p) => p.finalStatus === 'MORA').length;

    const totalLeftover = payments.reduce((acc, p) => acc + parseFloat(p.leftover), 0);
    const totalDue = payments.reduce((acc, p) => acc + parseFloat(p.totalDue), 0);
    const totalPenalty = payments.reduce(
        (acc, p) => acc + parseFloat(p.accumulatedPenalty),
        0
    );

    const statusData = [
        { name: 'PAGADO', value: totalPaidCount },
        { name: 'PENDIENTE', value: totalPendingCount },
        { name: 'MORA', value: totalMoraCount }
    ];
    const COLORS = ['#4CAF50', '#FFC107', '#F44336']; // Verde, Amarillo, Rojo

    const barData = [
        {
            name: 'Totales',
            'Deuda Pendiente (totalDue)': totalDue,
            'Saldo (leftover)': totalLeftover,
            'Multas (penalty)': totalPenalty
        }
    ];

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

                        {filteredBuses.length === 0 ? (
                            <Typography variant="body2" color="textSecondary">
                                No hay buses registrados con esos filtros.
                            </Typography>
                        ) : (
                            <>
                                {isMobile ? (
                                    // Vista móvil
                                    <>
                                        {busesPaginated.map((bus) => (
                                            <MobileCard key={bus.id}>
                                                {/* ... Lógica previa ... */}
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
                                    // Vista desktop
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

                    {/* Sección Incidentes y Emergencias */}
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
                                                {/* Si la falla es "otro", mostrar su detalle */}
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
                                    <>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableHeaderCell>Fecha</TableHeaderCell>
                                                    <TableHeaderCell>Piloto</TableHeaderCell>
                                                    <TableHeaderCell>Tipo (Gravedad)</TableHeaderCell>
                                                    <TableHeaderCell>Tipo de Falla</TableHeaderCell>
                                                    <TableHeaderCell>Descripción</TableHeaderCell>
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
                                    <>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableHeaderCell>Fecha</TableHeaderCell>
                                                    <TableHeaderCell>Piloto</TableHeaderCell>
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
                                                                    {parseFloat(eme.latitud).toFixed(6)},{' '}
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
                                )}
                            </Grid>
                        </Grid>
                    </SectionPaper>

                    {/* Sección Pagos y Boletas (solo si NO es supervisor) */}
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
                                    onChange={(e) => setPayDateFrom(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                />
                                <TextField
                                    label="Próximo Pago Hasta"
                                    type="date"
                                    value={payDateTo}
                                    onChange={(e) => setPayDateTo(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                />
                                <TextField
                                    label="Saldo Mínimo"
                                    variant="outlined"
                                    size="small"
                                    value={payBalanceMin}
                                    onChange={(e) => setPayBalanceMin(e.target.value)}
                                />
                                <TextField
                                    label="Saldo Máximo"
                                    variant="outlined"
                                    size="small"
                                    value={payBalanceMax}
                                    onChange={(e) => setPayBalanceMax(e.target.value)}
                                />
                            </FiltersRow>

                            {filteredPayments.length === 0 ? (
                                <Typography variant="body2" color="textSecondary">
                                    Aún no hay registros de pagos con esos filtros.
                                </Typography>
                            ) : isMobile ? (
                                <>
                                    {payPaginated.map((pay) => (
                                        <MobileCard key={pay.id}>
                                            <MobileField>
                                                <MobileLabel>Padre (Usuario):</MobileLabel>
                                                <MobileValue>
                                                    {pay.User ? pay.User.name : '—'}
                                                </MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Email:</MobileLabel>
                                                <MobileValue>
                                                    {pay.User ? pay.User.email : '—'}
                                                </MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Estado:</MobileLabel>
                                                <MobileValue>
                                                    {pay.finalStatus || pay.status}
                                                </MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Próximo Pago:</MobileLabel>
                                                <MobileValue>
                                                    {formatGuatemalaDate(pay.nextPaymentDate)}
                                                </MobileValue>
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
                                        count={filteredPayments.length}
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
                                                <TableHeaderCell>Padre (Usuario)</TableHeaderCell>
                                                <TableHeaderCell>Email</TableHeaderCell>
                                                <TableHeaderCell>Estado</TableHeaderCell>
                                                <TableHeaderCell>Próximo Pago</TableHeaderCell>
                                                <TableHeaderCell>Saldo</TableHeaderCell>
                                                <TableHeaderCell>Acciones</TableHeaderCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {payPaginated.map((pay) => (
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
                                        count={filteredPayments.length}
                                        page={payPage}
                                        onPageChange={handleChangePayPage}
                                        rowsPerPage={payRowsPerPage}
                                        onRowsPerPageChange={handleChangePayRowsPerPage}
                                        labelRowsPerPage="Filas por página"
                                    />
                                </>
                            )}

                            {/* Sección Análisis (Recharts) */}
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
                                            {totalPayments}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Pagos completados
                                        </Typography>
                                        <Typography variant="h5" color="success.main">
                                            {totalPaidCount}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Paper elevation={2} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Pagos en Mora
                                        </Typography>
                                        <Typography variant="h5" color="error">
                                            {totalMoraCount}
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
                        {loading ? (
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
                        {/* Tipo de Falla */}
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

                        {/* Tipo de Incidente */}
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

                        {/* Solo mostrar campo "otroFallaDetalle" si es "otro" */}
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

                        {/* ¿Pudo continuar la ruta? */}
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

                        {/* ¿Se utilizó bus suplente? */}
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

                        {/* Descripción */}
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

            {/* Snackbar */}
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
