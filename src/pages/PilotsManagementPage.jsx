// src/pages/PilotsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import {
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableRow,
    CircularProgress,
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

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { formatDateTime } from '../utils/dateFormat';
import AppDialog from '../components/dialogs/AppDialog';

// Helper para agrupar por colegio
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

// Columnas de la tabla de pilotos
const COLUMNS = [
    { id: 'name', label: 'Nombre', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    { id: 'incidentsCount', label: 'Incidentes', sortable: true },
    { id: 'emergenciesCount', label: 'Emergencias', sortable: true },
    { id: 'kmTraveled', label: 'Kilometraje', sortable: true },
    { id: 'routesCount', label: 'Rutas', sortable: true },
];

/**
 * Extrae el valor a ordenar de un piloto según el campo.
 * Para "kmTraveled" y "routesCount" se espera un valor numérico.
 */
function getFieldValue(pilot, field) {
    switch (field) {
        case 'name':
            return pilot.name;
        case 'email':
            return pilot.email;
        case 'incidentsCount':
            return pilot.incidentsCount || 0;
        case 'emergenciesCount':
            return pilot.emergenciesCount || 0;
        case 'kmTraveled':
            return pilot.kmTraveled || 0;
        case 'routesCount':
            return pilot.routesCount || 0;
        default:
            return '';
    }
}

const PilotsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const isMobile = useIsMobile();

    const [pilots, setPilots] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda, paginación y ordenamiento
    const table = useTableState();
    const pageFilters = useFilters({
        fields: [F.search('search', { placeholder: 'Nombre o correo' })],
        onApplied: table.resetPage,
    });
    const { search: searchQuery } = pageFilters.applied;

    // Diálogos para incidentes/emergencias
    const [openIncidentsDialog, setOpenIncidentsDialog] = useState(false);
    const [openEmergenciesDialog, setOpenEmergenciesDialog] = useState(false);
    const [incidentsList, setIncidentsList] = useState([]);
    const [emergenciesList, setEmergenciesList] = useState([]);

    useEffect(() => {
        fetchPilots();
        // eslint-disable-next-line
    }, []);

    const fetchPilots = async () => {
        setLoading(true);
        try {
            const res = await api.get('/staff/pilots', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setPilots(res.data.pilots || []);
        } catch (error) {
            console.error('Error al obtener pilotos:', error);
            setPilots([]);
        }
        setLoading(false);
    };

        // Register page-level refresh handler for global refresh control
        useRegisterPageRefresh(async () => {
            await fetchPilots();
        }, [fetchPilots]);

    // Filtrado
    const filteredPilots = pilots.filter((p) => matchSearchTokens(searchQuery, [p.name, p.email]));

    // Diálogo incidentes
    const handleViewIncidents = (pilot) => {
        setIncidentsList(pilot.incidentsDetail || []);
        setOpenIncidentsDialog(true);
    };
    const handleCloseIncidentsDialog = () => {
        setOpenIncidentsDialog(false);
        setIncidentsList([]);
    };

    // Diálogo emergencias
    const handleViewEmergencies = (pilot) => {
        setEmergenciesList(pilot.emergenciesDetail || []);
        setOpenEmergenciesDialog(true);
    };
    const handleCloseEmergenciesDialog = () => {
        setOpenEmergenciesDialog(false);
        setEmergenciesList([]);
    };

    // Agrupar pilotos por colegio
    const groupedPilots = groupBySchool(filteredPilots);
    const schoolKeys = Object.keys(groupedPilots);

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.personal}
                title="Gestión de Pilotos"
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
                        <Typography>No se encontraron pilotos.</Typography>
                    ) : (
                        schoolKeys.map((school) => {
                            const data = groupedPilots[school];
                            // Aplicamos ordenamiento y paginación al grupo
                            const sortedData = sortRows(data, { orderBy: table.orderBy, order: table.order, getValue: getFieldValue });
                            const pageData = table.paginate(sortedData);
                            return (
                                <Paper key={school} sx={{ mb: 4, p: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Colegio: {school}
                                    </Typography>
                                    {isMobile ? (
                                        // Vista móvil: tarjetas
                                        pageData.map((pilot) => (
                                            <MobileCard key={pilot.email}>
                                                <MobileField label="Nombre">{pilot.name}</MobileField>
                                                <MobileField label="Email">{pilot.email}</MobileField>
                                                <MobileField label="Incidentes">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Tooltip title="Ver detalles de incidentes">
                                                            <IconButton
                                                                onClick={() => handleViewIncidents(pilot)}
                                                                color={pilot.incidentsCount > 0 ? 'error' : 'default'}
                                                                size="small"
                                                            >
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {pilot.incidentsCount || 0}
                                                    </Box>
                                                </MobileField>
                                                <MobileField label="Emergencias">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Tooltip title="Ver detalles de emergencias">
                                                            <IconButton
                                                                onClick={() => handleViewEmergencies(pilot)}
                                                                color={pilot.emergenciesCount > 0 ? 'error' : 'default'}
                                                                size="small"
                                                            >
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {pilot.emergenciesCount || 0}
                                                    </Box>
                                                </MobileField>
                                                <MobileField label="Kilometraje">
                                                    {(pilot.kmTraveled ?? 0).toFixed(3)} km
                                                </MobileField>
                                                <MobileField label="Rutas">{pilot.routesCount ?? 0}</MobileField>
                                            </MobileCard>
                                        ))
                                    ) : (
                                        // Vista desktop: tabla con ordenamiento
                                        <AppTableContainer>
                                            <Table sx={{ minWidth: 860 }}>
                                                <SortableTableHead columns={COLUMNS} {...table.sortProps} showSortIcons />
                                                <TableBody>
                                                    {pageData.map((pilot) => (
                                                        <TableRow key={pilot.email}>
                                                            <TableCell>{pilot.name}</TableCell>
                                                            <TableCell>{pilot.email}</TableCell>
                                                            <TableCell>
                                                                <Tooltip title="Ver detalles de incidentes">
                                                                    <IconButton
                                                                        onClick={() => handleViewIncidents(pilot)}
                                                                        color={pilot.incidentsCount > 0 ? 'error' : 'default'}
                                                                    >
                                                                        <VisibilityIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                {pilot.incidentsCount || 0}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Tooltip title="Ver detalles de emergencias">
                                                                    <IconButton
                                                                        onClick={() => handleViewEmergencies(pilot)}
                                                                        color={pilot.emergenciesCount > 0 ? 'error' : 'default'}
                                                                    >
                                                                        <VisibilityIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                {pilot.emergenciesCount || 0}
                                                            </TableCell>
                                                            <TableCell>
                                                                {(pilot.kmTraveled ?? 0).toFixed(3)} km
                                                            </TableCell>
                                                            <TableCell>{pilot.routesCount ?? 0}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {data.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={6} align="center">
                                                                No se encontraron pilotos para este colegio.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
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

            {/* Diálogo Incidentes */}
            <AppDialog
                open={openIncidentsDialog}
                onClose={handleCloseIncidentsDialog}
                title="Incidentes reportados"
                size="sm"
                readOnly
            >
                {incidentsList.length === 0 ? (
                    <Typography variant="body2">No hay incidentes.</Typography>
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
            </AppDialog>

            {/* Diálogo Emergencias */}
            <AppDialog
                open={openEmergenciesDialog}
                onClose={handleCloseEmergenciesDialog}
                title="Emergencias reportadas"
                size="sm"
                readOnly
            >
                {emergenciesList.length === 0 ? (
                    <Typography variant="body2">No hay emergencias.</Typography>
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
            </AppDialog>
        </PageContainer>
    );
};

export default PilotsManagementPage;
