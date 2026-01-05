// src/pages/FuelRecordsPage.jsx

import React, { useEffect, useState } from 'react';
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
    CircularProgress,
    Box,
    Grid,
    Card,
    CardContent,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Autocomplete,
    TextField,
    Chip,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { 
    Refresh as RefreshIcon, 
    Visibility as VisibilityIcon,
    LocalGasStation as GasIcon 
} from '@mui/icons-material';
import moment from 'moment-timezone';
import tw from 'twin.macro';
import { 
    getFuelRecords, 
    getFuelStatistics, 
    getFuelRecordById,
    FUELING_REASONS,
    FUEL_TYPES
} from '../services/fuelRecordService';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const FuelRecordsPage = () => {
    const [fuelRecords, setFuelRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState('');
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedFuelType, setSelectedFuelType] = useState('');
    const [selectedFuelingReason, setSelectedFuelingReason] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);

    // Estadísticas
    const [statistics, setStatistics] = useState({
        totalRecords: 0,
        totalGallons: 0,
        totalAmount: 0,
        averagePrice: 0,
        byReason: {},
    });

    useEffect(() => {
        fetchSchools();
        fetchBusesBySchool();
        fetchStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // No dependemos del colegio para las placas; cargamos todos los buses al montar.

    useEffect(() => {
        fetchFuelRecords();
        fetchStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedPlate, selectedRoute, selectedFuelingReason, selectedFuelType, startDate, endDate]);

    const fetchSchools = async () => {
        try {
            const response = await api.get('/schools');
            const schoolsData = Array.isArray(response.data) ? response.data : (response.data?.schools || []);
            setSchools(schoolsData);
        } catch (error) {
            console.error('Error al cargar colegios:', error);
            setSchools([]);
        }
    };

    const fetchBusesBySchool = async (schoolId) => {
        try {
            // Si no se pasa schoolId, traemos todos los buses para permitir seleccionar placa independientemente.
            const url = schoolId ? `/buses/school/${schoolId}` : '/buses';
            const response = await api.get(url);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    // Opciones de placas: si hay colegio seleccionado, mostrar solo las placas asociadas a ese colegio.
    const plateOptions = selectedSchool
        ? [...new Set(
            buses
                .filter(b => String(b.schoolId) === String(selectedSchool) || String(b.school?.id) === String(selectedSchool))
                .map(b => b.plate)
                .filter(Boolean)
        )].sort()
        : [...new Set(buses.map(b => b.plate).filter(Boolean))].sort();

    useEffect(() => {
        if (selectedPlate && !plateOptions.includes(selectedPlate)) {
            setSelectedPlate('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSchool, buses]);

    const fetchFuelRecords = async () => {
        setLoading(true);
        try {
            const filters = {
                page: page + 1,
                limit: rowsPerPage,
            };

            if (selectedSchool) filters.schoolId = selectedSchool;
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (selectedFuelingReason) filters.fuelingReason = selectedFuelingReason;
            if (selectedFuelType) filters.fuelType = selectedFuelType;
            if (selectedFuelType) filters.fuelType = selectedFuelType;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const response = await getFuelRecords(filters);
            
            // El backend retorna: { success: true, data: [...], pagination: { total, page, limit, totalPages } }
            if (response.success && response.data) {
                setFuelRecords(response.data);
                setTotalCount(response.pagination?.total || 0);
            } else {
                setFuelRecords([]);
                setTotalCount(0);
            }
        } catch (error) {
            console.error('Error al cargar registros de combustible:', error);
            setFuelRecords([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const filters = {};

            if (selectedSchool) filters.schoolId = selectedSchool;
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const response = await getFuelStatistics(filters);
            
            // El backend retorna: { success: true, data: { byFuelType: [...], byBus: [...], totals: {...} } }
            if (response.success && response.data) {
                const totals = response.data.totals || {};
                const byFuelType = response.data.byFuelType || [];
                
                // Organizar por razón de abastecimiento
                const byReason = {};
                byFuelType.forEach(stat => {
                    byReason[stat.fuelingReason] = {
                        count: parseInt(stat.count) || 0,
                        totalGallonage: parseFloat(stat.totalGallonage) || 0,
                        totalAmount: parseFloat(stat.totalAmount) || 0,
                        avgPricePerGallon: parseFloat(stat.avgPricePerGallon) || 0
                    };
                });

                setStatistics({
                    totalRecords: parseInt(totals.totalRecords) || 0,
                    totalGallons: parseFloat(totals.totalGallonage) || 0,
                    totalAmount: parseFloat(totals.totalAmount) || 0,
                    averagePrice: parseFloat(totals.avgPricePerGallon) || 0,
                    byReason: byReason,
                });
            } else {
                setStatistics({
                    totalRecords: 0,
                    totalGallons: 0,
                    totalAmount: 0,
                    averagePrice: 0,
                    byReason: {},
                });
            }
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
            setStatistics({
                totalRecords: 0,
                totalGallons: 0,
                totalAmount: 0,
                averagePrice: 0,
                byReason: {},
            });
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleRefresh = () => {
        fetchFuelRecords();
        fetchStatistics();
    };

    const handleViewDetails = async (recordId) => {
        try {
            const response = await getFuelRecordById(recordId);
            // El backend retorna: { success: true, data: {...} }
            if (response.success && response.data) {
                setSelectedRecord(response.data);
                setDetailsOpen(true);
            }
        } catch (error) {
            console.error('Error al cargar detalles del registro:', error);
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedRecord(null);
    };

    const getFuelingReasonColor = (reason) => {
        const colors = {
            'ruta': 'primary',
            'mecanico': 'warning',
            'excursion': 'info',
            'admin': 'secondary',
        };
        return colors[reason] || 'default';
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
        }).format(amount || 0);
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Registros de Combustible
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y gestiona los registros de abastecimiento de combustible
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <GasIcon color="primary" sx={{ mr: 1 }} />
                                    <Typography color="textSecondary" variant="body2">
                                        Total Registros
                                    </Typography>
                                </Box>
                                <Typography variant="h4">
                                    {statistics.totalRecords}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Total Galones
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.totalGallons.toFixed(2)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Total Gastado
                                </Typography>
                                <Typography variant="h4">
                                    {formatCurrency(statistics.totalAmount)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Precio Promedio/Galón
                                </Typography>
                                <Typography variant="h4">
                                    {formatCurrency(statistics.averagePrice)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filtros */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <FormControl fullWidth sx={{ width: 250 }}>
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    value={selectedSchool}
                                    onChange={(e) => {
                                        setSelectedSchool(e.target.value);
                                        setSelectedRoute('');
                                    }}
                                    label="Colegio"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {schools.map((school) => (
                                        <MenuItem key={school.id} value={school.id}>
                                            {school.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs="auto" sm="auto" md="auto">
                            <FormControl fullWidth sx={{ width: 120 }}>
                                <InputLabel>Ruta</InputLabel>
                                <Select
                                    value={selectedRoute}
                                    onChange={(e) => {
                                        setSelectedRoute(e.target.value);
                                        setSelectedPlate('');
                                    }}
                                    label="Ruta"
                                    disabled={!selectedSchool}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {[...new Set(
                                        (selectedSchool ? buses.filter(b => String(b.schoolId) === String(selectedSchool) || String(b.school?.id) === String(selectedSchool)) : []
                                    ).map(b => b.routeNumber).filter(Boolean))].sort((a, b) => a - b).map((route) => (
                                        <MenuItem key={route} value={route}>
                                            {route}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <Autocomplete
                                options={plateOptions}
                                value={selectedPlate || null}
                                onChange={(e, newValue) => setSelectedPlate(newValue || '')}
                                getOptionLabel={(option) => option || ''}
                                renderInput={(params) => (
                                    <TextField {...params} label="Placa" variant="outlined" />
                                )}
                                fullWidth
                                sx={{ width: 180 }}
                            />
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <FormControl fullWidth sx={{ width: 225 }}>
                                <InputLabel>Razón de Abastecimiento</InputLabel>
                                <Select
                                    value={selectedFuelingReason}
                                    onChange={(e) => setSelectedFuelingReason(e.target.value)}
                                    label="Razón de Abastecimiento"
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {Object.entries(FUELING_REASONS).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <FormControl fullWidth sx={{ width: 180 }}>
                                <InputLabel>Tipo Combustible</InputLabel>
                                <Select
                                    value={selectedFuelType}
                                    onChange={(e) => setSelectedFuelType(e.target.value)}
                                    label="Tipo Combustible"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(FUEL_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <DatePicker
                                label="Fecha Inicio"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                sx={{ width: 180 }}
                            />
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <DatePicker
                                label="Fecha Fin"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                sx={{ width: 180 }}
                            />
                        </Grid>

                        <Grid item xs="auto" display="flex" justifyContent="flex-end" spacing={1}>
                            <Box>
                                <Tooltip title="Limpiar filtros">
                                    <Button onClick={() => {
                                        setSelectedSchool('');
                                        setSelectedPlate('');
                                        setSelectedRoute('');
                                        setSelectedFuelingReason('');
                                        setSelectedFuelType('');
                                        setStartDate(null);
                                        setEndDate(null);
                                        setPage(0);
                                        fetchFuelRecords();
                                        fetchStatistics();
                                    }} variant="outlined" sx={{ mr: 1 }}>
                                        Limpiar
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Actualizar">
                                    <IconButton onClick={handleRefresh} color="primary">
                                        <RefreshIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
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
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Fecha</TableCell>
                                            <TableCell>Colegio</TableCell>
                                            <TableCell>Ruta</TableCell>
                                            <TableCell>Placa</TableCell>
                                            <TableCell>Piloto</TableCell>
                                            <TableCell>Razón</TableCell>
                                            <TableCell>Tipo Combustible</TableCell>
                                            <TableCell align="right">Galones</TableCell>
                                            <TableCell align="right">Precio/Galón</TableCell>
                                            <TableCell align="right">Total</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {fuelRecords.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell>
                                                    {moment(record.recordDate).format('DD/MM/YYYY HH:mm')}
                                                </TableCell>
                                                <TableCell>
                                                    {record.school?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.routeNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.plate || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.pilot?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={FUELING_REASONS[record.fuelingReason] || record.fuelingReason}
                                                        size="small"
                                                        color={getFuelingReasonColor(record.fuelingReason)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {FUEL_TYPES[record.fuelType] || record.fuelType}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {parseFloat(record.gallonage).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {formatCurrency(record.pricePerGallon)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {formatCurrency(record.totalAmount)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Ver detalles">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleViewDetails(record.id)}
                                                            color="primary"
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {fuelRecords.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={11} align="center">
                                                    No se encontraron registros de combustible
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
                    <DialogTitle>Detalles del Registro de Combustible</DialogTitle>
                    <DialogContent dividers>
                        {selectedRecord && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Fecha y Hora
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {moment(selectedRecord.recordDate).format('DD/MM/YYYY HH:mm')}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Placa
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.plate || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Ruta
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.routeNumber || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Piloto
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.pilot?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Colegio
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.school?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Razón de Abastecimiento
                                    </Typography>
                                    <Chip 
                                        label={FUELING_REASONS[selectedRecord.fuelingReason] || selectedRecord.fuelingReason}
                                        color={getFuelingReasonColor(selectedRecord.fuelingReason)}
                                        sx={{ mt: 1 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Tipo de Combustible
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {FUEL_TYPES[selectedRecord.fuelType] || selectedRecord.fuelType}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Galones
                                    </Typography>
                                    <Typography variant="h6" gutterBottom>
                                        {parseFloat(selectedRecord.gallonage).toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Precio por Galón
                                    </Typography>
                                    <Typography variant="h6" gutterBottom>
                                        {formatCurrency(selectedRecord.pricePerGallon)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Total Pagado
                                    </Typography>
                                    <Typography variant="h6" color="primary" gutterBottom>
                                        {formatCurrency(selectedRecord.totalAmount)}
                                    </Typography>
                                </Grid>
                                {selectedRecord.notes && (
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Notas
                                        </Typography>
                                        <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                            <Typography variant="body1">
                                                {selectedRecord.notes}
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                )}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Creado por
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.creator?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDetails} color="primary">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </LocalizationProvider>
    );
};

export default FuelRecordsPage;
