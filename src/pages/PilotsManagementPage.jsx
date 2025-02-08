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
    Box
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

    // Paginación
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
                            return (
                                <Paper key={school} sx={{ mb: 4, p: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Colegio: {school}
                                    </Typography>
                                    {isMobile ? (
                                        // Vista móvil: tarjetas
                                        <>
                                            {data
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
                                                            <MobileValue
                                                                sx={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                                            >
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
                                                            <MobileValue
                                                                sx={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                                            >
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
                                                            <MobileValue>{pilot.kmTraveled ?? 0} km</MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Rutas</MobileLabel>
                                                            <MobileValue>{pilot.routesCount ?? 0}</MobileValue>
                                                        </MobileField>
                                                    </MobileCard>
                                                ))}
                                            <TablePagination
                                                component="div"
                                                count={data.length}
                                                page={page}
                                                onPageChange={handleChangePage}
                                                rowsPerPage={rowsPerPage}
                                                onRowsPerPageChange={handleChangeRowsPerPage}
                                                rowsPerPageOptions={[5, 10, 25]}
                                                labelRowsPerPage="Filas por página"
                                            />
                                        </>
                                    ) : (
                                        // Vista desktop: tabla
                                        <>
                                            <TableContainer>
                                                <Table>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Nombre</TableCell>
                                                            <TableCell>Email</TableCell>
                                                            <TableCell>Incidentes</TableCell>
                                                            <TableCell>Emergencias</TableCell>
                                                            <TableCell>Kilometraje</TableCell>
                                                            <TableCell>Rutas</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {data
                                                            .slice(
                                                                page * rowsPerPage,
                                                                page * rowsPerPage + rowsPerPage
                                                            )
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
                                                                    <TableCell>{pilot.kmTraveled ?? 0} km</TableCell>
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
                                                count={data.length}
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
