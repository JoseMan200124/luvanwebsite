// src/pages/MonitorsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import {
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableRow,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Tooltip,
    Box
} from '@mui/material';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import { matchSearchTokens } from '../utils/clientFilter';
import useTableState from '../hooks/useTableState';
import useIsMobile from '../hooks/useIsMobile';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import { MobileCard, MobileField } from '../components/table/MobileCard';
import { sortRows } from '../utils/tableSort';
import { Visibility as VisibilityIcon } from '@mui/icons-material';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { formatDateTime } from '../utils/dateFormat';

// Contenedor principal
// Helper para agrupar por colegio (school)
const groupBySchool = (arr) => {
    const result = {};
    arr.forEach((item) => {
        const school = item.schoolName || 'Sin Colegio';
        if (!result[school]) {
            result[school] = [];
        }
        result[school].push(item);
    });
    return result;
};

// Columnas de la tabla de monitores
const COLUMNS = [
    { id: 'name', label: 'Nombre', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    { id: 'phoneNumber', label: 'Teléfono', sortable: true },
    { id: 'incidentsCount', label: 'Incidentes', sortable: true },
    { id: 'emergenciesCount', label: 'Emergencias', sortable: true },
];

/**
 * Extrae el valor a ordenar a partir de un monitor según la columna.
 */
function getFieldValue(monitor, field) {
    switch (field) {
        case 'name':
            return monitor.name;
        case 'email':
            return monitor.email;
        case 'phoneNumber':
            return monitor.phoneNumber || '';
        case 'incidentsCount':
            return monitor.incidentsCount || 0;
        case 'emergenciesCount':
            return monitor.emergenciesCount || 0;
        default:
            return '';
    }
}

const MonitorsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const isMobile = useIsMobile();

    const [monitors, setMonitors] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda, paginación y ordenamiento
    const table = useTableState();
    const pageFilters = useFilters({
        fields: [F.search('search', { placeholder: 'Nombre o correo' })],
        onApplied: table.resetPage,
    });
    const { search: searchQuery } = pageFilters.applied;

    // Diálogos para ver detalles de incidentes/emergencias
    const [openIncidentsDialog, setOpenIncidentsDialog] = useState(false);
    const [openEmergenciesDialog, setOpenEmergenciesDialog] = useState(false);

    // Listas detalladas (placeholder)
    const [incidentsList, setIncidentsList] = useState([]);
    const [emergenciesList, setEmergenciesList] = useState([]);

    useEffect(() => {
        fetchMonitors();
        // eslint-disable-next-line
    }, []);

    const fetchMonitors = async () => {
        setLoading(true);
        try {
            const res = await api.get('/staff/monitors', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setMonitors(res.data.monitors || []);
        } catch (error) {
            console.error('Error al obtener monitores:', error);
            setMonitors([]);
        }
        setLoading(false);
    };

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchMonitors();
    }, [fetchMonitors]);

    // Filtrado por texto
    const filteredMonitors = monitors.filter((m) => matchSearchTokens(searchQuery, [m.name, m.email]));

    // Para mostrar el diálogo de incidentes
    const handleViewIncidents = (monitor) => {
        setIncidentsList(monitor.incidentsDetail || []);
        setOpenIncidentsDialog(true);
    };
    const handleCloseIncidentsDialog = () => {
        setOpenIncidentsDialog(false);
        setIncidentsList([]);
    };

    // Para mostrar el diálogo de emergencias
    const handleViewEmergencies = (monitor) => {
        setEmergenciesList(monitor.emergenciesDetail || []);
        setOpenEmergenciesDialog(true);
    };
    const handleCloseEmergenciesDialog = () => {
        setOpenEmergenciesDialog(false);
        setEmergenciesList([]);
    };

    // Agrupar monitores por colegio
    const groupedData = groupBySchool(filteredMonitors);
    const schoolKeys = Object.keys(groupedData);

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.personal}
                title="Gestión de Monitores"
            />

            {/* Búsqueda */}
            <FilterBar {...pageFilters.barProps} loading={loading} />

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {schoolKeys.length === 0 ? (
                        <Typography>No se encontraron monitores.</Typography>
                    ) : (
                        schoolKeys.map((school) => {
                            const data = groupedData[school];
                            // Aplicar ordenamiento y paginación a los monitores del grupo
                            const sortedData = sortRows(data, { orderBy: table.orderBy, order: table.order, getValue: getFieldValue });
                            const pageData = table.paginate(sortedData);
                            return (
                                <Paper key={school} sx={{ mb: 4, p: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Colegio: {school}
                                    </Typography>

                                    {isMobile ? (
                                        // Vista móvil: tarjetas
                                        pageData.map((monitor) => (
                                            <MobileCard key={monitor.email}>
                                                <MobileField label="Nombre">{monitor.name}</MobileField>
                                                <MobileField label="Email">{monitor.email}</MobileField>
                                                <MobileField label="Teléfono">{monitor.phoneNumber || '—'}</MobileField>
                                                <MobileField label="Incidentes">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Tooltip title="Ver detalles de incidentes">
                                                            <IconButton
                                                                onClick={() => handleViewIncidents(monitor)}
                                                                color={monitor.incidentsCount > 0 ? 'error' : 'default'}
                                                                size="small"
                                                            >
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {monitor.incidentsCount || 0}
                                                    </Box>
                                                </MobileField>
                                                <MobileField label="Emergencias">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Tooltip title="Ver detalles de emergencias">
                                                            <IconButton
                                                                onClick={() => handleViewEmergencies(monitor)}
                                                                color={monitor.emergenciesCount > 0 ? 'error' : 'default'}
                                                                size="small"
                                                            >
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {monitor.emergenciesCount || 0}
                                                    </Box>
                                                </MobileField>
                                            </MobileCard>
                                        ))
                                    ) : (
                                        // Vista desktop: tabla
                                        <AppTableContainer>
                                            <Table sx={{ minWidth: 760 }}>
                                                <SortableTableHead columns={COLUMNS} {...table.sortProps} showSortIcons />
                                                <TableBody>
                                                    {pageData.map((monitor) => (
                                                        <TableRow key={monitor.email}>
                                                            <TableCell>{monitor.name}</TableCell>
                                                            <TableCell>{monitor.email}</TableCell>
                                                            <TableCell>{monitor.phoneNumber || '—'}</TableCell>
                                                            <TableCell>
                                                                <Tooltip title="Ver detalles de incidentes">
                                                                    <IconButton
                                                                        onClick={() => handleViewIncidents(monitor)}
                                                                        color={monitor.incidentsCount > 0 ? 'error' : 'default'}
                                                                    >
                                                                        <VisibilityIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                {monitor.incidentsCount || 0}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Tooltip title="Ver detalles de emergencias">
                                                                    <IconButton
                                                                        onClick={() => handleViewEmergencies(monitor)}
                                                                        color={monitor.emergenciesCount > 0 ? 'error' : 'default'}
                                                                    >
                                                                        <VisibilityIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                {monitor.emergenciesCount || 0}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </AppTableContainer>
                                    )}
                                    <AppTablePagination count={sortedData.length} {...table.paginationProps} />
                                </Paper>
                            );
                        })
                    )}
                </>
            )}

            {/* Diálogo de Incidentes */}
            <Dialog open={openIncidentsDialog} onClose={handleCloseIncidentsDialog} maxWidth="sm">
                <DialogTitle>Incidentes Reportados</DialogTitle>
                <DialogContent dividers>
                    {incidentsList.length === 0 ? (
                        <Typography variant="body2">
                            No hay incidentes registrados para este monitor.
                        </Typography>
                    ) : (
                        incidentsList.map((inc, index) => {
                            const formattedDate = formatDateTime(inc.date);
                            return (
                                <div key={index} style={{ marginBottom: '8px' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        <strong>Fecha/Hora:</strong> {formattedDate}
                                    </Typography>
                                    <Typography variant="body2">
                                        {inc.desc || 'Descripción no disponible'}
                                    </Typography>
                                </div>
                            );
                        })
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseIncidentsDialog} variant="outlined">
                        Cerrar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de Emergencias */}
            <Dialog open={openEmergenciesDialog} onClose={handleCloseEmergenciesDialog} maxWidth="sm">
                <DialogTitle>Emergencias Reportadas</DialogTitle>
                <DialogContent dividers>
                    {emergenciesList.length === 0 ? (
                        <Typography variant="body2">
                            No hay emergencias registradas para este monitor.
                        </Typography>
                    ) : (
                        emergenciesList.map((eme, index) => {
                            const formattedDate = formatDateTime(eme.date);
                            return (
                                <div key={index} style={{ marginBottom: '8px' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        <strong>Fecha/Hora:</strong> {formattedDate}
                                    </Typography>
                                    <Typography variant="body2">
                                        {eme.desc || 'Descripción no disponible'}
                                    </Typography>
                                </div>
                            );
                        })
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEmergenciesDialog} variant="outlined">
                        Cerrar
                    </Button>
                </DialogActions>
            </Dialog>
        </PageContainer>
    );
};

export default MonitorsManagementPage;
