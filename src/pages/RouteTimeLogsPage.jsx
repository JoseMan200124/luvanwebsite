// src/pages/RouteTimeLogsPage.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
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
    Chip,
    IconButton,
    Tooltip,
    TableSortLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { Delete as DeleteIcon } from '@mui/icons-material';
import moment from 'moment-timezone';
import tw from 'twin.macro';
import { getRouteTimeLogs, getAllRouteTimeLogs } from '../services/routeTimeLogService';
import { deleteRouteTimeLog } from '../services/routeTimeLogService';
import ExcelJS from 'exceljs';
import api from '../utils/axiosConfig';
import { getScheduleLabel, getScheduleColor, DEFAULT_SCHEDULE_CODES, getScheduleCodesFromSchool } from '../utils/scheduleConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

// Simple inline Excel-like icon (green box with white X)
const ExcelIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="3" fill="#217346" />
        <path d="M7.5 7.5 L16.5 16.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M16.5 7.5 L7.5 16.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

const RouteTimeLogsPage = () => {
    const [timeLogs, setTimeLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Sorting (client-side)
    const [orderBy, setOrderBy] = useState(''); // column key
    const [order, setOrder] = useState('asc'); // 'asc' | 'desc'

    // Filtros
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
    const [schoolRoutes, setSchoolRoutes] = useState([]);
    const [schoolScheduleCodes, setSchoolScheduleCodes] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState('');
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedSchedule, setSelectedSchedule] = useState('');
    const [selectedDay, setSelectedDay] = useState('');
    const [startDate, setStartDate] = useState(moment().subtract(7, 'days'));
    const [endDate, setEndDate] = useState(moment());

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        averageDuration: 0,
    });
    const [exporting, setExporting] = useState(false);
    // Delete dialog state
    const [deleteId, setDeleteId] = useState(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    // ignoramos la respuesta vieja para que el primer click no "se pierda".
    const timeLogsRequestSeqRef = useRef(0);

    useEffect(() => {
        fetchSchools();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            fetchBusesBySchool(selectedSchool);
            fetchRouteNumbersBySchool(selectedSchool);
            fetchSchoolSchedules(selectedSchool);
        } else {
            setBuses([]);
            setSchoolRoutes([]);
            setSchoolScheduleCodes([]);
        }
    }, [selectedSchool]);

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
            const response = await api.get(`/buses/school/${schoolId}`);
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

    const fetchSchoolSchedules = async (schoolId) => {
        try {
            const response = await api.get(`/schools/${schoolId}`);
            const school = response.data?.school || response.data;
            setSchoolScheduleCodes(getScheduleCodesFromSchool(school?.schedules));
        } catch (error) {
            console.error('Error al cargar horarios del colegio:', error);
            setSchoolScheduleCodes([]);
        }
    };

    const availableScheduleCodes = useMemo(() => {
        if (!selectedSchool) {
            return [...DEFAULT_SCHEDULE_CODES];
        }

        if (schoolScheduleCodes.length > 0) {
            return schoolScheduleCodes
                .map(code => String(code || '').trim().toUpperCase())
                .filter(Boolean);
        }

        return [...DEFAULT_SCHEDULE_CODES];
    }, [selectedSchool, schoolScheduleCodes]);

    useEffect(() => {
        if (selectedSchedule && !availableScheduleCodes.includes(selectedSchedule)) {
            setSelectedSchedule('');
        }
    }, [availableScheduleCodes, selectedSchedule]);

    const fetchTimeLogs = useCallback(async () => {
        const requestSeq = ++timeLogsRequestSeqRef.current;
        setLoading(true);
        try {
            const filters = {
                page: page + 1,
                limit: rowsPerPage,
            };

            // Añadir ordenamiento solicitado al servidor
            if (orderBy) filters.sortBy = orderBy;
            if (order) filters.order = order;

            if (selectedSchool) filters.schoolId = selectedSchool;
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (selectedSchedule) filters.schedule = String(selectedSchedule).trim().toUpperCase();
            if (selectedDay) filters.day = selectedDay;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const data = await getRouteTimeLogs(filters);

            // Si llegó otra request más reciente, ignorar esta respuesta
            if (requestSeq !== timeLogsRequestSeqRef.current) return;

            const logsList = data.timeLogs || data.data || [];
            setTimeLogs(logsList);
            setTotalCount(data.total || 0);

            // Calcular estadísticas
            if (logsList.length > 0) {
                const totalDuration = logsList.reduce((sum, log) => sum + (log.tripDuration || 0), 0);
                const avgDuration = totalDuration / logsList.length;

                setStatistics({
                    total: logsList.length,
                    averageDuration: avgDuration.toFixed(2),
                });
            } else {
                setStatistics({
                    total: 0,
                    averageDuration: 0,
                });
            }
        } catch (error) {
            // Solo entrar si esta request aún es la vigente
            if (requestSeq === timeLogsRequestSeqRef.current) {
                console.error('Error al cargar registros de tiempo:', error);
            }
        } finally {
            if (requestSeq === timeLogsRequestSeqRef.current) {
                setLoading(false);
            }
        }
    }, [
        page,
        rowsPerPage,
        orderBy,
        order,
        selectedSchool,
        selectedPlate,
        selectedRoute,
        selectedSchedule,
        selectedDay,
        startDate,
        endDate,
    ]);

    useEffect(() => {
        fetchTimeLogs();
    }, [fetchTimeLogs]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Register page-level refresh handler for the global refresh control
    useRegisterPageRefresh(fetchTimeLogs);

    const handleOpenDelete = (id) => {
        setDeleteId(id);
        setDeleteOpen(true);
    };

    const handleCancelDelete = () => {
        setDeleteId(null);
        setDeleteOpen(false);
    };

    const handleConfirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteRouteTimeLog(deleteId);
            // refresh list
            setDeleteOpen(false);
            setDeleteId(null);
            fetchTimeLogs();
        } catch (error) {
            console.error('Error al eliminar registro:', error);
            setDeleteOpen(false);
            setDeleteId(null);
        }
    };

    const handleSort = (col) => {
        if (orderBy === col) {
            setOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setOrderBy(col);
            setOrder('asc');
        }
        // reset page to first when changing sort
        setPage(0);
    };

    // Server returns ordered results; use them directly
    const displayedLogs = timeLogs;


    const getDayLabel = (day) => {
        const labels = {
            'monday': 'Lunes',
            'tuesday': 'Martes',
            'wednesday': 'Miércoles',
            'thursday': 'Jueves',
            'friday': 'Viernes',
            'saturday': 'Sábado',
            'sunday': 'Domingo',
        };
        return labels[day] || day;
    };

    const formatTime = (dateTime) => {
        return dateTime ? moment(dateTime).format('hh:mm A') : 'N/A';
    };

    const formatDateOnly = (dateTime) => {
        return dateTime ? moment(dateTime).format('DD/MM/YYYY') : '';
    };

    const formatDuration = (minutes) => {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const handleDownloadExcel = async () => {
        try {
            if (!totalCount || totalCount === 0) {
                window.alert('No hay registros para exportar con los filtros seleccionados.');
                return;
            }
            setExporting(true);

            const filters = {};
            if (selectedSchool) filters.schoolId = selectedSchool;
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (selectedSchedule) filters.schedule = String(selectedSchedule).trim().toUpperCase();
            if (selectedDay) filters.day = selectedDay;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const all = await getAllRouteTimeLogs(filters, 1000);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Luvan';
            workbook.created = new Date();
            const sheet = workbook.addWorksheet('Horarios');

            const headers = [
                'Fecha',
                'Día',
                'Horario',
                'Colegio',
                'Monitora',
                'Placa',
                'Ruta',
                'Salida Colegio',
                'Primera Parada',
                'Última Parada',
                'Llegada Colegio',
                'Duración Total'
            ];

            sheet.addRow(headers);

            // style header (morado)
            const headerRow = sheet.getRow(1);
            headerRow.height = 20;
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A4BCF' } };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDCCFF' } } };
            });

            // add data rows
            all.forEach((log) => {
                const rawRoute = log.routeNumber ?? '';
                const routeValue = (rawRoute !== '' && /^\d+$/.test(String(rawRoute).trim())) ? Number(String(rawRoute).trim()) : (rawRoute || '');

                const rowValues = [
                    log.fecha ? moment(log.fecha).format('DD/MM/YYYY') : '',
                    getDayLabel(log.day),
                    getScheduleLabel(log.schedule),
                    log.school?.name || '',
                    log.monitora?.name || '',
                    log.bus?.plate || '',
                    routeValue,
                    log.schoolDepartureTime ? moment(log.schoolDepartureTime).format('hh:mm A') : '',
                    log.firstStopTime ? moment(log.firstStopTime).format('hh:mm A') : '',
                    log.lastStopTime ? moment(log.lastStopTime).format('hh:mm A') : '',
                    log.schoolArrivalTime ? moment(log.schoolArrivalTime).format('hh:mm A') : '',
                    typeof log.tripDuration === 'number' ? formatDuration(log.tripDuration) : ''
                ];

                sheet.addRow(rowValues);
            });

            // alternating row fill and autosize
            const columnWidths = new Array(headers.length).fill(10);
            sheet.eachRow((row, rowNumber) => {
                // apply a subtle neutral alternating background for readability
                if (rowNumber > 1 && rowNumber % 2 === 0) {
                    row.eachCell((cell) => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    });
                }
                row.eachCell((cell, colNumber) => {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    const v = cell.value ? String(cell.value) : '';
                    columnWidths[colNumber - 1] = Math.max(columnWidths[colNumber - 1] || 10, Math.min(60, v.length + 2));
                });
            });

            sheet.columns.forEach((col, idx) => {
                col.width = columnWidths[idx] || 15;
            });

            sheet.views = [{ state: 'frozen', ySplit: 1 }];
            const lastCol = String.fromCharCode(64 + headers.length);
            sheet.autoFilter = { from: 'A1', to: `${lastCol}1` };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `horarios_rutas_${moment().format('YYYYMMDD_HHmmss')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            console.error('Error generando Excel:', err);
        } finally {
            setExporting(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Horarios de Monitoras en Ruta
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y analiza los registros de tiempos de rutas
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Registros
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.total}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Duración Promedio
                                </Typography>
                                <Box display="flex" alignItems="baseline" gap={2}>
                                    <Box>
                                        <Typography variant="h3" component="span">
                                            {Math.floor(parseFloat(statistics.averageDuration) / 60) || 0}
                                        </Typography>
                                        <Typography variant="h6" component="span" color="textSecondary">
                                            {' h '}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="h3" component="span">
                                            {Math.round(parseFloat(statistics.averageDuration) % 60) || 0}
                                        </Typography>
                                        <Typography variant="h6" component="span" color="textSecondary">
                                            {' min'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filtros */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    value={selectedSchool}
                                    onChange={(e) => {
                                        setSelectedSchool(e.target.value);
                                        setSelectedPlate('');
                                        setSelectedRoute('');
                                        setSelectedSchedule('');
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
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Placa</InputLabel>
                                <Select
                                    value={selectedPlate}
                                    onChange={(e) => setSelectedPlate(e.target.value)}
                                    label="Placa"
                                    disabled={!selectedSchool}
                                    MenuProps={{
                                        anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                                        transformOrigin: { vertical: 'top', horizontal: 'left' },
                                        PaperProps: { style: { maxHeight: 300 } }
                                    }}
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
                                    disabled={!selectedSchool}
                                    MenuProps={{
                                        anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                                        transformOrigin: { vertical: 'top', horizontal: 'left' },
                                        PaperProps: { style: { maxHeight: 300 } }
                                    }}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {(schoolRoutes && schoolRoutes.length > 0 ? [...schoolRoutes] : []).sort((a, b) => {
                                        const na = Number(a);
                                        const nb = Number(b);
                                        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
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
                                <InputLabel>Horario</InputLabel>
                                <Select
                                    value={selectedSchedule}
                                    onChange={(e) => setSelectedSchedule(e.target.value)}
                                    label="Horario"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {availableScheduleCodes.map(code => (
                                        <MenuItem key={code} value={code}>{getScheduleLabel(code)}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={1}>
                            <FormControl fullWidth>
                                <InputLabel>Día</InputLabel>
                                <Select
                                    value={selectedDay}
                                    onChange={(e) => setSelectedDay(e.target.value)}
                                    label="Día"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="monday">Lunes</MenuItem>
                                    <MenuItem value="tuesday">Martes</MenuItem>
                                    <MenuItem value="wednesday">Miércoles</MenuItem>
                                    <MenuItem value="thursday">Jueves</MenuItem>
                                    <MenuItem value="friday">Viernes</MenuItem>
                                    <MenuItem value="saturday">Sábado</MenuItem>
                                    <MenuItem value="sunday">Domingo</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <Grid container spacing={1}>
                                <Grid item xs={6}>
                                    <DatePicker
                                        label="Fecha Inicio"
                                        value={startDate}
                                        onChange={(newValue) => setStartDate(newValue)}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <DatePicker
                                        label="Fecha Fin"
                                        value={endDate}
                                        onChange={(newValue) => setEndDate(newValue)}
                                    />
                                </Grid>
                            </Grid>
                        </Grid>
                        <Grid item xs={12} display="flex" justifyContent="flex-end">
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<ExcelIcon size={18} />}
                                            onClick={() => handleDownloadExcel()}
                                            disabled={exporting || totalCount === 0}
                                            size="small"
                                            sx={{
                                                color: 'success.main',
                                                borderColor: 'success.main',
                                                '&:hover': { backgroundColor: 'rgba(33,115,70,0.08)', borderColor: 'success.dark' }
                                            }}
                                        >
                                            {exporting ? 'Generando...' : 'Generar reporte'}
                                        </Button>
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
                                            <TableCell sortDirection={orderBy === 'fecha' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'fecha'}
                                                    direction={orderBy === 'fecha' ? order : 'asc'}
                                                    onClick={() => handleSort('fecha')}
                                                >
                                                    Fecha
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'day' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'day'}
                                                    direction={orderBy === 'day' ? order : 'asc'}
                                                    onClick={() => handleSort('day')}
                                                >
                                                    Día
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'schedule' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'schedule'}
                                                    direction={orderBy === 'schedule' ? order : 'asc'}
                                                    onClick={() => handleSort('schedule')}
                                                >
                                                    Horario
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'school' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'school'}
                                                    direction={orderBy === 'school' ? order : 'asc'}
                                                    onClick={() => handleSort('school')}
                                                >
                                                    Colegio
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'monitora' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'monitora'}
                                                    direction={orderBy === 'monitora' ? order : 'asc'}
                                                    onClick={() => handleSort('monitora')}
                                                >
                                                    Monitora
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'plate' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'plate'}
                                                    direction={orderBy === 'plate' ? order : 'asc'}
                                                    onClick={() => handleSort('plate')}
                                                >
                                                    Placa
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'routeNumber' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'routeNumber'}
                                                    direction={orderBy === 'routeNumber' ? order : 'asc'}
                                                    onClick={() => handleSort('routeNumber')}
                                                >
                                                    Ruta
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'schoolDepartureTime' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'schoolDepartureTime'}
                                                    direction={orderBy === 'schoolDepartureTime' ? order : 'asc'}
                                                    onClick={() => handleSort('schoolDepartureTime')}
                                                >
                                                    Salida Colegio
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'firstStopTime' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'firstStopTime'}
                                                    direction={orderBy === 'firstStopTime' ? order : 'asc'}
                                                    onClick={() => handleSort('firstStopTime')}
                                                >
                                                    Primera Parada
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'lastStopTime' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'lastStopTime'}
                                                    direction={orderBy === 'lastStopTime' ? order : 'asc'}
                                                    onClick={() => handleSort('lastStopTime')}
                                                >
                                                    Última Parada
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'schoolArrivalTime' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'schoolArrivalTime'}
                                                    direction={orderBy === 'schoolArrivalTime' ? order : 'asc'}
                                                    onClick={() => handleSort('schoolArrivalTime')}
                                                >
                                                    Llegada Colegio
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center" sortDirection={orderBy === 'tripDuration' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'tripDuration'}
                                                    direction={orderBy === 'tripDuration' ? order : 'asc'}
                                                    onClick={() => handleSort('tripDuration')}
                                                >
                                                    Duración Total
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">
                                                Acciones
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {displayedLogs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell>
                                                    {moment(log.fecha).format('DD/MM/YYYY')}
                                                </TableCell>
                                                <TableCell>{getDayLabel(log.day)}</TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={getScheduleLabel(log.schedule)} 
                                                        size="small"
                                                        color={getScheduleColor(log.schedule)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {log.school?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {log.monitora?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {log.bus?.plate || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {log.routeNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div>{formatTime(log.schoolDepartureTime)}</div>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {formatDateOnly(log.schoolDepartureTime)}
                                                        </Typography>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div>{formatTime(log.firstStopTime)}</div>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {formatDateOnly(log.firstStopTime)}
                                                        </Typography>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div>{formatTime(log.lastStopTime)}</div>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {formatDateOnly(log.lastStopTime)}
                                                        </Typography>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div>{formatTime(log.schoolArrivalTime)}</div>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {formatDateOnly(log.schoolArrivalTime)}
                                                        </Typography>
                                                    </div>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Chip 
                                                        label={formatDuration(log.tripDuration)}
                                                        size="small"
                                                        color={
                                                            !log.tripDuration ? 'default' :
                                                            log.tripDuration <= 45 ? 'success' :
                                                            log.tripDuration <= 60 ? 'warning' : 'error'
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Eliminar registro">
                                                        <IconButton onClick={() => handleOpenDelete(log.id)} size="small" color="error">
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {timeLogs.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={13} align="center">
                                                    No se encontraron registros de tiempos de rutas
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
                            <Dialog
                                open={deleteOpen}
                                onClose={handleCancelDelete}
                                aria-labelledby="delete-dialog-title"
                            >
                                <DialogTitle id="delete-dialog-title">Confirmar eliminación</DialogTitle>
                                <DialogContent>
                                    <DialogContentText>
                                        ¿Estás seguro que deseas eliminar este registro? Esta acción no se puede deshacer.
                                    </DialogContentText>
                                </DialogContent>
                                <DialogActions>
                                    <Button onClick={handleCancelDelete}>Cancelar</Button>
                                    <Button onClick={handleConfirmDelete} color="error">Eliminar</Button>
                                </DialogActions>
                            </Dialog>
                        </>
                    )}
                </Paper>
            </Container>
        </LocalizationProvider>
    );
};

export default RouteTimeLogsPage;
