// src/pages/StudentIncidentsPage.jsx

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
    Chip,
} from '@mui/material';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { getAllStudentIncidents, getStudentIncidentById, INCIDENT_TYPES } from '../services/studentIncidentService';
import api from '../utils/axiosConfig';
import { getScheduleLabel, getScheduleColor, DEFAULT_SCHEDULE_CODES, SCHEDULE_LABELS } from '../utils/scheduleConfig';
import { getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import { getClientSchoolId } from '../utils/clientValue';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F, toPlateOptions, toRouteOptions } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import useNotify from '../hooks/useNotify';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import { formatDateTime } from '../utils/dateFormat';
import AppDialog from '../components/dialogs/AppDialog';
import { ReportProblem as ReportIcon, Category as CategoryIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { StatCard, StatCardGrid } from '../components/StatCard';
import { loadCatalog } from '../services/catalogStore';

const SCHEDULE_OPTIONS = DEFAULT_SCHEDULE_CODES.map((code) => ({ value: code, label: SCHEDULE_LABELS[code] || code }));

// Columnas de la tabla
const COLUMNS = [
    { id: 'fecha', label: 'Fecha' },
    { id: 'estudiante', label: 'Estudiante' },
    { id: 'tipo_de_incidente', label: 'Tipo de Incidente' },
    { id: 'horario', label: 'Horario' },
    { id: 'monitora', label: 'Monitora' },
    { id: 'placa', label: 'Placa' },
    { id: 'ruta', label: 'Ruta' },
    { id: 'colegio', label: 'Colegio' },
    { id: 'acciones', label: 'Acciones', align: 'center' },
];

const StudentIncidentsPage = () => {
    const notify = useNotify();
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    // Paginación (en el servidor)
    const table = useTableState();
    const { page, rowsPerPage } = table;
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
    const [schoolRoutes, setSchoolRoutes] = useState([]);

    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.client({ label: 'Colegio', schools, corporations: [] }),
            F.plate({ options: toPlateOptions(buses) }),
            F.route({ options: toRouteOptions(schoolRoutes) }),
            F.select('incidentType', { label: 'Tipo de incidente', options: INCIDENT_TYPES }),
            F.schedule({ options: SCHEDULE_OPTIONS }),
            F.search('studentName', { label: 'Buscar estudiante', width: 'md' }),
            F.dateRange('dates'),
        ],
        onApplied: table.resetPage,
    });
    const {
        cycle: selectedCicloEscolar,
        client: selectedClient,
        plate: selectedPlate,
        route: selectedRoute,
        incidentType: selectedIncidentType,
        schedule: selectedScheduleType,
        studentName: selectedStudentName,
        dates,
    } = pageFilters.applied;
    const selectedSchool = getClientSchoolId(selectedClient);
    const draftCycle = pageFilters.draft.cycle;
    const draftSchoolId = getClientSchoolId(pageFilters.draft.client);

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        byType: {},
        bySchedule: {},
    });

    useEffect(() => {
        fetchSchools();
    }, [draftCycle]);

    useEffect(() => {
        if (draftSchoolId) {
            fetchBusesBySchool(draftSchoolId);
            fetchRouteNumbersBySchool(draftSchoolId);
        } else {
            setBuses([]);
            setSchoolRoutes([]);
        }
    }, [draftSchoolId]);

    useEffect(() => {
        fetchIncidents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedPlate, selectedRoute, selectedIncidentType, selectedScheduleType, selectedCicloEscolar, dates, selectedStudentName]);

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
                if (selectedPlate) {
                    filters.plate = selectedPlate;
                }
                if (selectedRoute) {
                    filters.routeNumber = selectedRoute;
                }
                if (selectedIncidentType) {
                    filters.incidentType = selectedIncidentType;
                }
                if (selectedScheduleType) {
                    filters.scheduleType = selectedScheduleType;
                }
                if (dates.from) {
                    filters.startDate = dates.from;
                }
                if (dates.to) {
                    filters.endDate = dates.to;
                }
                if (selectedStudentName) {
                    filters.studentName = selectedStudentName;
                }

            const data = await getAllStudentIncidents(filters);
            
            const incidentList = data.incidents || data.data || [];
            setIncidents(incidentList);
            setTotalCount(data.total || 0);

            // Calcular estadísticas 
            const byType = data.countsByType !== undefined ? data.countsByType : (incidentList.reduce((acc, incident) => {
                const t = incident.incidentType || 'unknown';
                acc[t] = (acc[t] || 0) + 1;
                return acc;
            }, {}));

            const bySchedule = data.countsBySchedule !== undefined ? data.countsBySchedule : (incidentList.reduce((acc, incident) => {
                const s = incident.scheduleType || 'unknown';
                acc[s] = (acc[s] || 0) + 1;
                return acc;
            }, {}));

            const total = data.totalIncidents !== undefined ? data.totalIncidents : (data.total || incidentList.length);

            setStatistics({
                total,
                byType,
                bySchedule,
            });
        } catch (error) {
            console.error('Error al cargar incidentes:', error);
            notify.fromError(error, 'Error al cargar los reportes de conducta');
        } finally {
            setLoading(false);
        }
    };

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchIncidents();
    }, [fetchIncidents]);

    const handleViewDetails = async (incidentId) => {
        try {
            console.log('Cargando detalles del incidente:', incidentId);
            const data = await getStudentIncidentById(incidentId);
            console.log('Datos del incidente:', data);
            setSelectedIncident(data);
            setDetailsOpen(true);
        } catch (error) {
            console.error('Error al cargar detalles del incidente:', error);
            notify.fromError(error, 'Error al cargar los detalles del reporte');
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedIncident(null);
    };


    return (
            <PageContainer width="xl">
                <PageHeader
                    eyebrow={MODULE_GROUPS.monitoras}
                    title="Reportes de Conducta de Alumnos"
                    subtitle="Visualiza y analiza los incidentes reportados por las monitoras"
                />

                {/* Estadísticas */}
                <StatCardGrid columns={3}>
                    <StatCard label="Total incidentes" value={statistics.total} icon={<ReportIcon />} format="number" />
                    <StatCard label="Tipo más común" icon={<CategoryIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                            {Object.keys(statistics.byType).length > 0
                                ? INCIDENT_TYPES[Object.keys(statistics.byType).reduce((a, b) => (
                                    statistics.byType[a] > statistics.byType[b] ? a : b
                                ))]
                                : 'N/A'}
                        </Typography>
                    </StatCard>
                    <StatCard label="Horario con más incidentes" icon={<ScheduleIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                            {Object.keys(statistics.bySchedule).length > 0
                                ? getScheduleLabel(Object.keys(statistics.bySchedule).reduce((a, b) => (
                                    statistics.bySchedule[a] > statistics.bySchedule[b] ? a : b
                                )))
                                : 'N/A'}
                        </Typography>
                    </StatCard>
                </StatCardGrid>

                {/* Filtros */}
                <FilterBar {...pageFilters.barProps} loading={loading} />

                {/* Tabla */}
                <Paper>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" p={5}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <AppTableContainer>
                                <Table>
                                    <SortableTableHead columns={COLUMNS} />
                                    <TableBody>
                                        {incidents.map((incident) => (
                                            <TableRow key={incident.id}>
                                                <TableCell>
                                                    {formatDateTime(incident.fecha)}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.student ? (incident.student.fullName || 'N/A') : 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={incident.incidentType === 'otro' && incident.customIncidentType 
                                                            ? `Otro: ${incident.customIncidentType}`
                                                            : INCIDENT_TYPES[incident.incidentType]}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={getScheduleLabel(incident.scheduleType)} 
                                                        size="small"
                                                        color={getScheduleColor(incident.scheduleType)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {incident.monitora?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.bus?.plate || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.routeNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.school?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <RowActions
                                                        actions={[
                                                            { key: 'view', kind: 'view', color: 'primary', label: 'Ver detalles', icon: <VisibilityIcon fontSize="small" />, onClick: () => handleViewDetails(incident.id) },
                                                        ]}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {incidents.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center">
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
                <AppDialog
                    open={detailsOpen}
                    onClose={handleCloseDetails}
                    title="Detalles del incidente"
                    size="md"
                    readOnly
                >
                    {selectedIncident && (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Fecha y Hora
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {formatDateTime(selectedIncident.fecha)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Estudiante
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIncident.student ? (selectedIncident.student.fullName || 'N/A') : 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Tipo de Incidente
                                </Typography>
                                <Chip 
                                    label={selectedIncident.incidentType === 'otro' && selectedIncident.customIncidentType 
                                        ? `Otro: ${selectedIncident.customIncidentType}`
                                        : INCIDENT_TYPES[selectedIncident.incidentType]}
                                    sx={{ mt: 1 }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Horario
                                </Typography>
                                <Chip 
                                    label={getScheduleLabel(selectedIncident.scheduleType)}
                                    color={getScheduleColor(selectedIncident.scheduleType)}
                                    sx={{ mt: 1 }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Monitora
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIncident.monitora?.name || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Placa
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIncident.bus?.plate || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Ruta
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIncident.routeNumber || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Colegio
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIncident.school?.name || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Descripción del Incidente
                                </Typography>
                                <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                    <Typography variant="body1">
                                        {selectedIncident.description}
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </AppDialog>
            </PageContainer>
    );
};

export default StudentIncidentsPage;
