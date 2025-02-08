// src/pages/MonitorsManagementPage.jsx

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
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import moment from 'moment-timezone';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

// Contenedor principal
const MonitorsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

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

// Componentes para la vista móvil (tarjetas)
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

const MonitorsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [monitors, setMonitors] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

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

    // Filtrado por texto
    const filteredMonitors = monitors.filter((m) => {
        const search = searchQuery.toLowerCase();
        return (
            (m.name || '').toLowerCase().includes(search) ||
            (m.email || '').toLowerCase().includes(search)
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
        <MonitorsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Monitores
            </Typography>

            {/* Búsqueda */}
            <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap' }}>
                <TextField
                    label="Buscar Monitores"
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
                        <Typography>No se encontraron monitores.</Typography>
                    ) : (
                        schoolKeys.map((school) => {
                            const data = groupedData[school];
                            return (
                                <Paper key={school} sx={{ mb: 4, p: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Colegio: {school}
                                    </Typography>

                                    {isMobile ? (
                                        // Vista móvil: tarjetas
                                        <>
                                            {data
                                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                .map((monitor) => (
                                                    <MobileCard key={monitor.email}>
                                                        <MobileField>
                                                            <MobileLabel>Nombre</MobileLabel>
                                                            <MobileValue>{monitor.name}</MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Email</MobileLabel>
                                                            <MobileValue>{monitor.email}</MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Teléfono</MobileLabel>
                                                            <MobileValue>{monitor.phoneNumber || '—'}</MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Incidentes</MobileLabel>
                                                            <MobileValue style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                                                            </MobileValue>
                                                        </MobileField>
                                                        <MobileField>
                                                            <MobileLabel>Emergencias</MobileLabel>
                                                            <MobileValue style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                                                            </MobileValue>
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
                                                            <TableCell>Teléfono</TableCell>
                                                            <TableCell>Incidentes</TableCell>
                                                            <TableCell>Emergencias</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {data
                                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                            .map((monitor) => (
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
                                                        {data.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={5} align="center">
                                                                    No se encontraron monitores para este colegio.
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
        </MonitorsContainer>
    );
};

export default MonitorsManagementPage;
