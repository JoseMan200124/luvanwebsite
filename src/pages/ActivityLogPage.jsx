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
    TablePagination
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Visibility as VisibilityIcon,
    DirectionsBus as DirectionsBusIcon,
    WarningAmber as WarningIcon,
    LocalHospital as HospitalIcon,
    Build as BuildIcon
} from '@mui/icons-material';
import tw, { styled } from 'twin.macro';
import api from '../utils/axiosConfig';
import { AuthContext } from '../context/AuthProvider';
import moment from 'moment-timezone';

// Configuración de moment-timezone para Guatemala
moment.tz.setDefault('America/Guatemala');

const formatGuatemalaDatetime = (dateString) => {
    if (!dateString) return '—';
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY HH:mm');
};

const formatGuatemalaDate = (dateString) => {
    if (!dateString) return '—';
    return moment.utc(dateString).tz('America/Guatemala').format('DD/MM/YYYY');
};

//
// Estilos con twin.macro / styled-components
//
const PageContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const Title = styled(Typography)(() => [
    tw`text-3xl font-bold mb-4`,
    {
        color: '#1C3FAA'
    }
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
    {
        color: '#2563EB'
    }
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

const FiltersRow = tw.div`flex gap-4 mb-4 items-center`;

//
// Componente principal
//
const ActivityLogPage = () => {
    const { auth } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);

    // Estados para cada sección
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

    // Diálogo de boletas
    const [openBoletasDialog, setOpenBoletasDialog] = useState(false);
    const [currentBoletas, setCurrentBoletas] = useState([]);
    const [currentParentName, setCurrentParentName] = useState('');

    // Acordeones
    const [expanded, setExpanded] = useState(false);

    // Filtros & paginación Buses
    const [busPilotFilter, setBusPilotFilter] = useState('');
    const [busMonitoraFilter, setBusMonitoraFilter] = useState('');
    const [busDescriptionFilter, setBusDescriptionFilter] = useState('');
    const [busPage, setBusPage] = useState(0);
    const [busRowsPerPage, setBusRowsPerPage] = useState(5);

    // Filtros & paginación Incidentes
    const [incDateFrom, setIncDateFrom] = useState('');
    const [incDateTo, setIncDateTo] = useState('');
    const [incPilotFilter, setIncPilotFilter] = useState('');
    const [incDescriptionFilter, setIncDescriptionFilter] = useState('');
    const [incPage, setIncPage] = useState(0);
    const [incRowsPerPage, setIncRowsPerPage] = useState(5);

    // Filtros & paginación Emergencias
    const [emeDateFrom, setEmeDateFrom] = useState('');
    const [emeDateTo, setEmeDateTo] = useState('');
    const [emePilotFilter, setEmePilotFilter] = useState('');
    const [emePage, setEmePage] = useState(0);
    const [emeRowsPerPage, setEmeRowsPerPage] = useState(5);

    // Filtros & paginación Pagos
    const [payDateFrom, setPayDateFrom] = useState('');
    const [payDateTo, setPayDateTo] = useState('');
    const [payBalanceMin, setPayBalanceMin] = useState('');
    const [payBalanceMax, setPayBalanceMax] = useState('');
    const [payPage, setPayPage] = useState(0);
    const [payRowsPerPage, setPayRowsPerPage] = useState(5);

    // Cargar data al iniciar
    useEffect(() => {
        fetchAllData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            // <<-- IMPORTANTE: se usa la ruta de activity-logs para obtener los buses con sus paradas -->
            const busResp = await api.get('/activity-logs');
            // Incidentes
            const incResp = await api.get('/activity-logs/incidents');
            // Emergencias
            const emeResp = await api.get('/activity-logs/emergencies');
            // Pagos
            const payResp = await api.get('/payments');

            setBuses(busResp.data || []);
            setIncidents(incResp.data.incidents || []);
            setEmergencies(emeResp.data.emergencies || []);
            setPayments(payResp.data.payments || []);
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

    // Acordeón
    const handleChangeAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    // Ver Boletas (Payments)
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

    // Toggle "En Taller" del Bus
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

    // Filtros & Paginación (Front-End) - Buses
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

    // Filtros & Paginación - Incidentes
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

    // Filtros & Paginación - Emergencias
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

    // Filtros & Paginación - Pagos
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
                    {/* Sección Buses, Pilotos, Monitoras y Paradas */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            <DirectionsBusIcon
                                sx={{ mr: 1, verticalAlign: 'middle', color: '#1976D2' }}
                            />
                            Buses, Pilotos, Monitoras & Paradas
                        </SectionTitle>

                        {/* Filtros para Buses */}
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
                                                    {/* Se muestran las paradas (stops) si existen */}
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
                    </SectionPaper>

                    {/* Sección Incidentes y Emergencias */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            <WarningIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#ED6C02' }} />
                            Incidentes y <HospitalIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#D32F2F' }} />
                            Emergencias
                        </SectionTitle>

                        <Grid container spacing={2} mt={1}>
                            {/* Incidentes */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
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
                                ) : (
                                    <>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableHeaderCell>Fecha</TableHeaderCell>
                                                    <TableHeaderCell>Piloto</TableHeaderCell>
                                                    <TableHeaderCell>Tipo</TableHeaderCell>
                                                    <TableHeaderCell>Descripción</TableHeaderCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {incPaginated.map((incident) => (
                                                    <TableRow key={incident.id} hover>
                                                        <TableCell>{formatGuatemalaDatetime(incident.fecha)}</TableCell>
                                                        <TableCell>{incident.piloto ? incident.piloto.name : '—'}</TableCell>
                                                        <TableCell>{incident.tipo || '—'}</TableCell>
                                                        <TableCell>{incident.descripcion || '—'}</TableCell>
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
                                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
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
                                ) : (
                                    <>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableHeaderCell>Fecha</TableHeaderCell>
                                                    <TableHeaderCell>Piloto</TableHeaderCell>
                                                    <TableHeaderCell>Mensaje</TableHeaderCell>
                                                    <TableHeaderCell>Ubicación</TableHeaderCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {emePaginated.map((eme) => (
                                                    <TableRow key={eme.id} hover>
                                                        <TableCell>{formatGuatemalaDatetime(eme.fecha)}</TableCell>
                                                        <TableCell>{eme.piloto ? eme.piloto.name : '—'}</TableCell>
                                                        <TableCell>{eme.mensaje}</TableCell>
                                                        <TableCell>
                                                            {eme.latitud && eme.longitud
                                                                ? `${eme.latitud}, ${eme.longitud}`
                                                                : '—'}
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

                    {/* Sección Pagos y Boletas */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            Pagos y Boletas
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
                                                <TableCell>{pay.User ? pay.User.name : '—'}</TableCell>
                                                <TableCell>{pay.User ? pay.User.email : '—'}</TableCell>
                                                <TableCell>{pay.finalStatus || pay.status}</TableCell>
                                                <TableCell>{formatGuatemalaDate(pay.nextPaymentDate)}</TableCell>
                                                <TableCell>Q {pay.leftover ?? 0}</TableCell>
                                                <TableCell>
                                                    {pay.User && (
                                                        <Tooltip title="Ver boletas de pago">
                                                            <IconButton
                                                                onClick={() =>
                                                                    handleViewBoletas(pay.User.id, pay.User.name)
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
                    </SectionPaper>
                </div>
            )}

            {/* Dialog para ver Boletas */}
            <Dialog open={openBoletasDialog} onClose={handleCloseBoletasDialog} maxWidth="md" fullWidth>
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
                                            <strong>Subido el:</strong> {formatGuatemalaDatetime(b.uploadedAt)}
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
