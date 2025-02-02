// src/pages/ActivityLogPage.jsx

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

//
// ======= Estilos con twin.macro / styled-components =======
//
const PageContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const Title = styled(Typography)(() => [
    tw`text-3xl font-bold mb-4`,
    {
        color: '#1C3FAA',
    },
]);

// Se deja una altura mínima y scroll para cada sección
const SectionPaper = styled(Paper)(() => [
    tw`p-4 mb-6 rounded-lg`,
    {
        backgroundColor: '#FFFFFF',
        boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
        minHeight: '600px', // altura mínima fija
        overflowY: 'auto',  // scroll si sobrepasa
    },
]);

const SectionTitle = styled(Typography)(() => [
    tw`font-semibold mb-3`,
    {
        color: '#2563EB',
    },
]);

const AccordionStyled = styled(Accordion)(() => [
    tw`border rounded-lg overflow-hidden mb-2`,
    {
        borderColor: '#93C5FD',
        backgroundColor: '#F8FAFF',
    },
]);

const AccordionSummaryStyled = styled(AccordionSummary)(() => [
    tw`transition-colors`,
    {
        backgroundColor: '#E0F2FE',
        '&:hover': {
            backgroundColor: '#BAE6FD',
        },
    },
]);

const TableHeaderCell = styled(TableCell)(() => [
    tw`font-semibold`,
    {
        backgroundColor: '#DCF3FF',
        color: '#333',
    },
]);

// Contenedor para los filtros, para que queden en la misma fila con algo de padding
const FiltersRow = tw.div`flex gap-4 mb-4 items-center`;

//
// ======= Componente principal =======
//
const ActivityLogPage = () => {
    const { auth } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);

    // ======= Data principal =======
    const [buses, setBuses] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [payments, setPayments] = useState([]);

    // ======= Snackbar =======
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info',
    });

    // ======= Diálogo de boletas =======
    const [openBoletasDialog, setOpenBoletasDialog] = useState(false);
    const [currentBoletas, setCurrentBoletas] = useState([]);
    const [currentParentName, setCurrentParentName] = useState('');

    // ======= Acordeones =======
    const [expanded, setExpanded] = useState(false);

    // ============================
    //   Filtros & paginación Buses
    // ============================
    const [busPilotFilter, setBusPilotFilter] = useState('');
    const [busMonitoraFilter, setBusMonitoraFilter] = useState('');
    const [busDescriptionFilter, setBusDescriptionFilter] = useState('');
    const [busPage, setBusPage] = useState(0);
    const [busRowsPerPage, setBusRowsPerPage] = useState(5);

    // ============================
    //   Filtros & paginación Incidentes
    // ============================
    const [incDateFrom, setIncDateFrom] = useState('');
    const [incDateTo, setIncDateTo] = useState('');
    const [incPilotFilter, setIncPilotFilter] = useState('');
    const [incDescriptionFilter, setIncDescriptionFilter] = useState('');
    const [incPage, setIncPage] = useState(0);
    const [incRowsPerPage, setIncRowsPerPage] = useState(5);

    // ============================
    //   Filtros & paginación Emergencias
    // ============================
    const [emeDateFrom, setEmeDateFrom] = useState('');
    const [emeDateTo, setEmeDateTo] = useState('');
    const [emePilotFilter, setEmePilotFilter] = useState('');
    const [emePage, setEmePage] = useState(0);
    const [emeRowsPerPage, setEmeRowsPerPage] = useState(5);

    // ============================
    //   Filtros & paginación Pagos
    // ============================
    const [payDateFrom, setPayDateFrom] = useState('');
    const [payDateTo, setPayDateTo] = useState('');
    const [payBalanceMin, setPayBalanceMin] = useState('');
    const [payBalanceMax, setPayBalanceMax] = useState('');
    const [payPage, setPayPage] = useState(0);
    const [payRowsPerPage, setPayRowsPerPage] = useState(5);

    // ================================================
    // useEffect - Cargar Data
    // ================================================
    useEffect(() => {
        fetchAllData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);

            // Buses
            const busResp = await api.get('/buses');
            // Incidentes
            const incResp = await api.get('/activity-logs/incidents');
            // Emergencias
            const emeResp = await api.get('/activity-logs/emergencies');
            // Pagos
            const payResp = await api.get('/payments');

            setBuses(busResp.data.buses || []);
            setIncidents(incResp.data.incidents || []);
            setEmergencies(emeResp.data.emergencies || []);
            setPayments(payResp.data.payments || []);
        } catch (error) {
            console.error('Error fetchAllData =>', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener datos para registro de actividades',
                severity: 'error',
            });
        } finally {
            setLoading(false);
        }
    };

    // ================================================
    // Acordeón
    // ================================================
    const handleChangeAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    // ================================================
    // Ver Boletas (Payments)
    // ================================================
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
                severity: 'error',
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

    // ================================================
    // Bus "En Taller" (Botón e icono)
    // ================================================
    const handleBusTaller = async (busId) => {
        try {
            setLoading(true);
            // Ejemplo: PUT /buses/:id/taller (o algo así)
            await api.put(`/buses/${busId}/taller`, { inWorkshop: true });
            setSnackbar({
                open: true,
                message: 'Bus actualizado como "En Taller".',
                severity: 'success',
            });
            // Refresca data
            fetchAllData();
        } catch (error) {
            console.error('Error handleBusTaller =>', error);
            setSnackbar({
                open: true,
                message: 'No se pudo actualizar el bus al taller',
                severity: 'error',
            });
        } finally {
            setLoading(false);
        }
    };

    // ================================================
    // Filtros & Paginación (Front-End) - Buses
    // ================================================
    const filteredBuses = buses.filter((b) => {
        // Filtra por Piloto
        if (busPilotFilter) {
            const pilotName = b?.pilot?.name?.toLowerCase() || '';
            if (!pilotName.includes(busPilotFilter.toLowerCase())) {
                return false;
            }
        }
        // Filtra por Monitora
        if (busMonitoraFilter) {
            const monitoraName = b?.monitora?.name?.toLowerCase() || '';
            if (!monitoraName.includes(busMonitoraFilter.toLowerCase())) {
                return false;
            }
        }
        // Filtra por Descripción
        if (busDescriptionFilter) {
            const desc = b?.description?.toLowerCase() || '';
            if (!desc.includes(busDescriptionFilter.toLowerCase())) {
                return false;
            }
        }
        return true;
    });
    // Paginación Buses
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

    // ================================================
    // Filtros & Paginación (Front-End) - Incidentes
    // ================================================
    const filteredIncidents = incidents.filter((inc) => {
        // Filtra por rango de fechas
        if (incDateFrom) {
            const from = new Date(incDateFrom).getTime();
            const incDate = new Date(inc.fecha).getTime();
            if (incDate < from) return false;
        }
        if (incDateTo) {
            const to = new Date(incDateTo).getTime();
            const incDate = new Date(inc.fecha).getTime();
            if (incDate > to) return false;
        }
        // Filtra por Piloto
        if (incPilotFilter) {
            const pilotName = inc?.piloto?.name?.toLowerCase() || '';
            if (!pilotName.includes(incPilotFilter.toLowerCase())) {
                return false;
            }
        }
        // Filtra por descripción (o tipo)
        if (incDescriptionFilter) {
            const desc = inc?.descripcion?.toLowerCase() || '';
            if (!desc.includes(incDescriptionFilter.toLowerCase())) {
                return false;
            }
        }
        return true;
    });
    // Paginación Incidentes
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

    // ================================================
    // Filtros & Paginación (Front-End) - Emergencias
    // ================================================
    const filteredEmergencies = emergencies.filter((eme) => {
        // Filtra por rango de fechas
        if (emeDateFrom) {
            const from = new Date(emeDateFrom).getTime();
            const emeDate = new Date(eme.fecha).getTime();
            if (emeDate < from) return false;
        }
        if (emeDateTo) {
            const to = new Date(emeDateTo).getTime();
            const emeDate = new Date(eme.fecha).getTime();
            if (emeDate > to) return false;
        }
        // Filtra por Piloto
        if (emePilotFilter) {
            const pilotName = eme?.piloto?.name?.toLowerCase() || '';
            if (!pilotName.includes(emePilotFilter.toLowerCase())) {
                return false;
            }
        }
        return true;
    });
    // Paginación Emergencias
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

    // ================================================
    // Filtros & Paginación (Front-End) - Payments
    // ================================================
    const filteredPayments = payments.filter((pay) => {
        // Filtra por rango de fecha "próximo pago" (pay.nextPaymentDate) si aplica
        if (payDateFrom) {
            const from = new Date(payDateFrom).getTime();
            const payDate = pay.nextPaymentDate
                ? new Date(pay.nextPaymentDate).getTime()
                : 0;
            if (payDate < from) return false;
        }
        if (payDateTo) {
            const to = new Date(payDateTo).getTime();
            const payDate = pay.nextPaymentDate
                ? new Date(pay.nextPaymentDate).getTime()
                : 0;
            if (payDate > to) return false;
        }
        // Filtra por rango de saldos (leftover)
        if (payBalanceMin) {
            if ((pay.leftover ?? 0) < parseFloat(payBalanceMin)) return false;
        }
        if (payBalanceMax) {
            if ((pay.leftover ?? 0) > parseFloat(payBalanceMax)) return false;
        }
        return true;
    });
    // Paginación Payments
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
                    {/* ==================== Sección Buses ==================== */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            <DirectionsBusIcon
                                sx={{ mr: 1, verticalAlign: 'middle', color: '#1976D2' }}
                            />
                            Buses, Pilotos, Monitoras & Rutas
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

                        {/* Listado Paginado de Buses */}
                        {filteredBuses.length === 0 && (
                            <Typography variant="body2" color="textSecondary">
                                No hay buses registrados con esos filtros.
                            </Typography>
                        )}
                        {filteredBuses.length > 0 && (
                            <>
                                {busesPaginated.map((bus) => (
                                    <AccordionStyled
                                        key={bus.id}
                                        expanded={expanded === `panel-${bus.id}`}
                                        onChange={handleChangeAccordion(`panel-${bus.id}`)}
                                    >
                                        <AccordionSummaryStyled expandIcon={<ExpandMoreIcon />}>
                                            <Typography
                                                variant="subtitle1"
                                                sx={{ fontWeight: 'bold' }}
                                            >
                                                {bus.plate}
                                            </Typography>
                                            <Chip
                                                label={`Ocupación: ${
                                                    bus.occupation ?? 0
                                                }/${bus.capacity ?? '--'}`}
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
                                                    {Array.isArray(bus.routes) && bus.routes.length > 0 ? (
                                                        <Table size="small">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableHeaderCell>Ruta</TableHeaderCell>
                                                                    <TableHeaderCell>Inicio</TableHeaderCell>
                                                                    <TableHeaderCell>Fin</TableHeaderCell>
                                                                    <TableHeaderCell>Kms</TableHeaderCell>
                                                                    <TableHeaderCell>Paradas</TableHeaderCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {bus.routes.map((rt) => (
                                                                    <TableRow key={rt.id}>
                                                                        <TableCell>{rt.name}</TableCell>
                                                                        <TableCell>
                                                                            {rt.startTime
                                                                                ? new Date(rt.startTime).toLocaleString()
                                                                                : '—'}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {rt.endTime
                                                                                ? new Date(rt.endTime).toLocaleString()
                                                                                : '—'}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {rt.distanceTraveled ?? 0} km
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {Array.isArray(rt.stops)
                                                                                ? rt.stops.length
                                                                                : 0}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    ) : (
                                                        <Typography
                                                            variant="body2"
                                                            color="textSecondary"
                                                        >
                                                            Este bus no tiene rutas registradas.
                                                        </Typography>
                                                    )}
                                                </Grid>
                                            </Grid>
                                        </AccordionDetails>
                                        <Divider />
                                        <AccordionActions>
                                            <Typography
                                                variant="caption"
                                                color="textSecondary"
                                                sx={{ mr: 2 }}
                                            >
                                                ID Bus: {bus.id}
                                            </Typography>
                                            {/* Botón "En Taller" */}
                                            <Tooltip title="Marcar bus en Taller">
                                                <IconButton
                                                    color="primary"
                                                    onClick={() => handleBusTaller(bus.id)}
                                                >
                                                    <BuildIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </AccordionActions>
                                    </AccordionStyled>
                                ))}

                                {/* Paginación de Buses */}
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

                    {/* ==================== Sección Incidentes y Emergencias ==================== */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            <WarningIcon
                                sx={{ mr: 1, verticalAlign: 'middle', color: '#ED6C02' }}
                            />
                            Incidentes y{' '}
                            <HospitalIcon
                                sx={{ mr: 1, verticalAlign: 'middle', color: '#D32F2F' }}
                            />
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

                                {/* Filtros Incidentes */}
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
                                                        <TableCell>
                                                            {new Date(incident.fecha).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            {incident.piloto ? incident.piloto.name : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {incident.tipo || '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {incident.descripcion || '—'}
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

                                {/* Filtros Emergencias */}
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
                                                        <TableCell>
                                                            {new Date(eme.fecha).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            {eme.piloto ? eme.piloto.name : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {eme.mensaje}
                                                        </TableCell>
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

                    {/* ==================== Sección Pagos y Boletas ==================== */}
                    <SectionPaper>
                        <SectionTitle variant="h6" gutterBottom>
                            Pagos y Boletas
                        </SectionTitle>

                        {/* Filtros Pagos */}
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
                                                    {pay.nextPaymentDate
                                                        ? new Date(pay.nextPaymentDate).toLocaleDateString()
                                                        : '—'}
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
                    </SectionPaper>
                </div>
            )}

            {/* ========== Dialog para ver Boletas ========== */}
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
                                    <Paper
                                        elevation={2}
                                        sx={{ p: 2, borderRadius: '8px' }}
                                    >
                                        <Typography variant="body2">
                                            <strong>Subido el:</strong>{' '}
                                            {new Date(b.uploadedAt).toLocaleString()}
                                        </Typography>
                                        <img
                                            src={b.fileUrl}
                                            alt="Boleta"
                                            style={{
                                                maxWidth: '100%',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                marginTop: '8px',
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

            {/* ========== Snackbar ========== */}
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
