// src/pages/PilotsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import {
    Typography,
    TextField,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Tooltip,
    useTheme,
    useMediaQuery,
    Box,
    TableSortLabel
} from '@mui/material';
import styled from 'styled-components';
import tw from 'twin.macro';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import moment from 'moment-timezone';

moment.tz.setDefault('America/Guatemala');

const PilotsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

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

// Componentes para vista móvil (tarjetas)
const MobileCard = styled(Paper)`
    padding: 16px;
    margin-bottom: 16px;
`;
const MobileField = styled(Box)`
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
`;
const MobileLabel = styled(Typography)`
    font-weight: bold;
    font-size: 0.875rem;
    color: #555;
`;
const MobileValue = styled(Typography)`
    font-size: 1rem;
`;

/* ========== Bloque de funciones para ordenamiento ========== */
function descendingComparator(a, b, orderBy) {
    const aValue = getFieldValue(a, orderBy);
    const bValue = getFieldValue(b, orderBy);
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

function getComparator(order, orderBy) {
    return order === 'desc'
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
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
/* ========== Fin funciones de ordenamiento ========== */

const PilotsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [pilots, setPilots] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);

    // Estados para ordenamiento
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('');

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

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

    // Filtrado
    const filteredPilots = pilots.filter((p) => {
        const search = searchQuery.toLowerCase();
        return (
            (p.name || '').toLowerCase().includes(search) ||
            (p.email || '').toLowerCase().includes(search)
        );
    });

    // Manejo de paginación
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

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
        <PilotsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Pilotos
            </Typography>

            {/* Búsqueda */}
            <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap' }}>
                <TextField
                    label="Buscar Pilotos"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: isMobile ? '100%' : '33%' }}
                />
            </div>

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
                            // Aplicamos ordenamiento al grupo
                            const sortedData = stableSort(data, getComparator(order, orderBy));
                            return (
                                <Paper key={school} sx={{ mb: 4, p: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Colegio: {school}
                                    </Typography>
                                    {isMobile ? (
                                        // Vista móvil: tarjetas (sin cambios)
                                        <>
                                            {sortedData
                                                .slice(
                                                    page * rowsPerPage,
                                                    page * rowsPerPage + rowsPerPage
                                                )
                                                .map((pilot) => (
                                                    <MobileCard key={pilot.email}>
                                                        <MobileField>
                                                            <MobileLabel>Nombre</MobileLabel>
                                                            <MobileValue>{pilot.name}</MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Email</MobileLabel>
                                                            <MobileValue>{pilot.email}</MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Incidentes</MobileLabel>
                                                            <MobileValue sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                                                            </MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Emergencias</MobileLabel>
                                                            <MobileValue sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                                                            </MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Kilometraje</MobileLabel>
                                                            <MobileValue>
                                                                {(pilot.kmTraveled ?? 0).toFixed(3)} km
                                                            </MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Rutas</MobileLabel>
                                                            <MobileValue>{pilot.routesCount ?? 0}</MobileValue>
                                                        </MobileField>
                                                    </MobileCard>
                                                ))}
                                            <TablePagination
                                                component="div"
                                                count={sortedData.length}
                                                page={page}
                                                onPageChange={handleChangePage}
                                                rowsPerPage={rowsPerPage}
                                                onRowsPerPageChange={handleChangeRowsPerPage}
                                                rowsPerPageOptions={[5, 10, 25]}
                                                labelRowsPerPage="Filas por página"
                                            />
                                        </>
                                    ) : (
                                        // Vista desktop: tabla con ordenamiento
                                        <>
                                            <TableContainer>
                                                <Table>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell sortDirection={orderBy === 'name' ? order : false}>
                                                                <TableSortLabel
                                                                    active={orderBy === 'name'}
                                                                    direction={orderBy === 'name' ? order : 'asc'}
                                                                    onClick={() => handleRequestSort('name')}
                                                                    hideSortIcon={false}
                                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                                >
                                                                    Nombre
                                                                </TableSortLabel>
                                                            </TableCell>
                                                            <TableCell sortDirection={orderBy === 'email' ? order : false}>
                                                                <TableSortLabel
                                                                    active={orderBy === 'email'}
                                                                    direction={orderBy === 'email' ? order : 'asc'}
                                                                    onClick={() => handleRequestSort('email')}
                                                                    hideSortIcon={false}
                                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                                >
                                                                    Email
                                                                </TableSortLabel>
                                                            </TableCell>
                                                            <TableCell sortDirection={orderBy === 'incidentsCount' ? order : false}>
                                                                <TableSortLabel
                                                                    active={orderBy === 'incidentsCount'}
                                                                    direction={orderBy === 'incidentsCount' ? order : 'asc'}
                                                                    onClick={() => handleRequestSort('incidentsCount')}
                                                                    hideSortIcon={false}
                                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                                >
                                                                    Incidentes
                                                                </TableSortLabel>
                                                            </TableCell>
                                                            <TableCell sortDirection={orderBy === 'emergenciesCount' ? order : false}>
                                                                <TableSortLabel
                                                                    active={orderBy === 'emergenciesCount'}
                                                                    direction={orderBy === 'emergenciesCount' ? order : 'asc'}
                                                                    onClick={() => handleRequestSort('emergenciesCount')}
                                                                    hideSortIcon={false}
                                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                                >
                                                                    Emergencias
                                                                </TableSortLabel>
                                                            </TableCell>
                                                            <TableCell sortDirection={orderBy === 'kmTraveled' ? order : false}>
                                                                <TableSortLabel
                                                                    active={orderBy === 'kmTraveled'}
                                                                    direction={orderBy === 'kmTraveled' ? order : 'asc'}
                                                                    onClick={() => handleRequestSort('kmTraveled')}
                                                                    hideSortIcon={false}
                                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                                >
                                                                    Kilometraje
                                                                </TableSortLabel>
                                                            </TableCell>
                                                            <TableCell sortDirection={orderBy === 'routesCount' ? order : false}>
                                                                <TableSortLabel
                                                                    active={orderBy === 'routesCount'}
                                                                    direction={orderBy === 'routesCount' ? order : 'asc'}
                                                                    onClick={() => handleRequestSort('routesCount')}
                                                                    hideSortIcon={false}
                                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                                >
                                                                    Rutas
                                                                </TableSortLabel>
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {stableSort(sortedData, getComparator(order, orderBy))
                                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                            .map((pilot) => (
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
                                            </TableContainer>
                                            <TablePagination
                                                component="div"
                                                count={sortedData.length}
                                                page={page}
                                                onPageChange={handleChangePage}
                                                rowsPerPage={rowsPerPage}
                                                onRowsPerPageChange={handleChangeRowsPerPage}
                                                rowsPerPageOptions={[5, 10, 25]}
                                                labelRowsPerPage="Filas por página"
                                            />
                                        </>
                                    )}
                                </Paper>
                            );
                        })
                    )}
                </>
            )}

            {/* Diálogo Incidentes */}
            <Dialog open={openIncidentsDialog} onClose={handleCloseIncidentsDialog} maxWidth="sm">
                <DialogTitle>Incidentes Reportados</DialogTitle>
                <DialogContent dividers>
                    {incidentsList.length === 0 ? (
                        <Typography variant="body2">No hay incidentes.</Typography>
                    ) : (
                        incidentsList.map((inc, index) => {
                            const formattedDate = moment(inc.date)
                                .tz('America/Guatemala')
                                .format('DD/MM/YYYY HH:mm:ss');
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

            {/* Diálogo Emergencias */}
            <Dialog open={openEmergenciesDialog} onClose={handleCloseEmergenciesDialog} maxWidth="sm">
                <DialogTitle>Emergencias Reportadas</DialogTitle>
                <DialogContent dividers>
                    {emergenciesList.length === 0 ? (
                        <Typography variant="body2">No hay emergencias.</Typography>
                    ) : (
                        emergenciesList.map((eme, index) => {
                            const formattedDate = moment(eme.date)
                                .tz('America/Guatemala')
                                .format('DD/MM/YYYY HH:mm:ss');
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
        </PilotsContainer>
    );
};

export default PilotsManagementPage;
