// src/pages/SupervisorsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import {
    Typography,
    TextField,
    Paper,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    useTheme,
    useMediaQuery,
    Box,
    Button,
    MenuItem,
    FormControl,
    InputLabel,
    Select
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import styled from 'styled-components';
import tw from 'twin.macro';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

// Container principal con estilos responsivos
const SupervisorsContainer = styled.div`
    ${tw`bg-gray-100 min-h-screen w-full`}
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;

    @media (max-width: 640px) {
        padding: 1rem;
    }

    @media (max-width: 480px) {
        padding: 0.5rem;
    }
`;

// Helper para agrupar los pilotos asignados por organización (colegio o corporación)
// Usa una clave única combinando tipo y ID para evitar colisiones
const groupByOrganization = (arr) => {
    const result = {};
    arr.forEach((item) => {
        // Crear una clave única: "tipo-id-nombre"
        const orgType = item.organizationType || 'school';
        const orgId = item.organizationId || 'none';
        const orgName = item.schoolName || 'Sin Asignar';
        const key = `${orgType}-${orgId}-${orgName}`;
        
        if (!result[key]) {
            result[key] = {
                displayName: orgName,
                type: orgType,
                id: orgId,
                pilots: []
            };
        }
        result[key].pilots.push(item);
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

const PILOTS_PER_PAGE = 5;

const SupervisorsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [supervisors, setSupervisors] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);

    const [expanded, setExpanded] = useState(false);
    const [pilotPages, setPilotPages] = useState({});
    // Nuevo estado para colegio seleccionado por supervisor
    const [selectedSchool, setSelectedSchool] = useState({});

    useEffect(() => {
        fetchSupervisors();
        // eslint-disable-next-line
    }, []);

    const fetchSupervisors = async () => {
        setLoading(true);
        try {
            const res = await api.get('/staff/supervisors', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setSupervisors(res.data.supervisors || []);
        } catch (error) {
            console.error('Error al obtener supervisores:', error);
            setSupervisors([]);
        }
        setLoading(false);
    };

    // Filtrar supervisores
    const filteredSupervisors = supervisors.filter((s) => {
        const search = searchQuery.toLowerCase();
        return (
            (s.name || '').toLowerCase().includes(search) ||
            (s.email || '').toLowerCase().includes(search)
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

    const handleChangeAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    // Helper para manejar la página de pilotos por supervisor y colegio
    const handlePilotPageChange = (supEmail, school, newPage) => {
        setPilotPages(prev => ({
            ...prev,
            [`${supEmail}-${school}`]: newPage
        }));
    };

    // Helper para manejar selección de colegio por supervisor
    const handleSchoolChange = (supEmail, school) => {
        setSelectedSchool(prev => ({
            ...prev,
            [supEmail]: school
        }));
        // Reiniciar paginación al cambiar de colegio
        setPilotPages(prev => ({
            ...prev,
            [`${supEmail}-${school}`]: 0
        }));
    };

    return (
        <SupervisorsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Supervisores
            </Typography>

            <div
                style={{
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}
            >
                <TextField
                    label="Buscar Supervisores"
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
                    {filteredSupervisors.length === 0 ? (
                        <Typography>No se encontraron supervisores.</Typography>
                    ) : isMobile ? (
                        // Vista móvil: renderizar una lista de tarjetas (MobileCard) para cada supervisor
                        <>
                            {filteredSupervisors
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((sup, index) => {
                                    const orgGroups = groupByOrganization(sup.assignedPilots || []);
                                    const orgKeys = Object.keys(orgGroups);
                                    const selected = selectedSchool[sup.email] || orgKeys[0] || '';
                                    const selectedGroup = orgGroups[selected];
                                    const pilots = selectedGroup ? selectedGroup.pilots : [];
                                    const key = `${sup.email}-${selected}`;
                                    const currentPage = pilotPages[key] || 0;
                                    const totalPages = Math.ceil(pilots.length / PILOTS_PER_PAGE);
                                    const pilotsToShow = pilots.slice(
                                        currentPage * PILOTS_PER_PAGE,
                                        (currentPage + 1) * PILOTS_PER_PAGE
                                    );
                                    return (
                                        <MobileCard key={sup.email}>
                                            <MobileField>
                                                <MobileLabel>Nombre</MobileLabel>
                                                <MobileValue>{sup.name}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Email</MobileLabel>
                                                <MobileValue>{sup.email}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Pilotos Asignados</MobileLabel>
                                                <Accordion
                                                    expanded={expanded === `panel-${index}`}
                                                    onChange={handleChangeAccordion(`panel-${index}`)}
                                                >
                                                    <AccordionSummary
                                                        expandIcon={<ExpandMoreIcon />}
                                                        aria-controls={`panel-${index}-content`}
                                                    >
                                                        <Typography>Ver pilotos asignados</Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        {orgKeys.length === 0 ? (
                                                            <Typography>
                                                                No hay pilotos asignados a este supervisor.
                                                            </Typography>
                                                        ) : (
                                                            <>
                                                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                                    <InputLabel>Colegio/Corporación</InputLabel>
                                                                    <Select
                                                                        value={selected}
                                                                        label="Colegio/Corporación"
                                                                        onChange={e => handleSchoolChange(sup.email, e.target.value)}
                                                                    >
                                                                        {orgKeys.map(orgKey => {
                                                                            const org = orgGroups[orgKey];
                                                                            return (
                                                                                <MenuItem key={orgKey} value={orgKey}>
                                                                                    {org.displayName}
                                                                                </MenuItem>
                                                                            );
                                                                        })}
                                                                    </Select>
                                                                </FormControl>
                                                                {pilotsToShow.map((p) => (
                                                                    <Paper
                                                                        key={p.email}
                                                                        variant="outlined"
                                                                        sx={{ p: 1, mb: 1 }}
                                                                    >
                                                                        <Typography variant="body2">
                                                                            <strong>Nombre:</strong> {p.name}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Email:</strong> {p.email}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Kilometraje:</strong> {(p.kmTraveled ?? 0).toFixed(3)}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Rutas:</strong> {p.routesCount ?? 0}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Incidentes:</strong> {p.incidentsCount ?? 0}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Emergencias:</strong> {p.emergenciesCount ?? 0}
                                                                        </Typography>
                                                                    </Paper>
                                                                ))}
                                                                {totalPages > 1 && (
                                                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                                                        <Button
                                                                            size="small"
                                                                            disabled={currentPage === 0}
                                                                            onClick={() => handlePilotPageChange(sup.email, selected, currentPage - 1)}
                                                                        >
                                                                            Anterior
                                                                        </Button>
                                                                        <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                                                                            Página {currentPage + 1} de {totalPages}
                                                                        </Typography>
                                                                        <Button
                                                                            size="small"
                                                                            disabled={currentPage >= totalPages - 1}
                                                                            onClick={() => handlePilotPageChange(sup.email, selected, currentPage + 1)}
                                                                        >
                                                                            Siguiente
                                                                        </Button>
                                                                    </Box>
                                                                )}
                                                            </>
                                                        )}
                                                    </AccordionDetails>
                                                </Accordion>
                                            </MobileField>
                                        </MobileCard>
                                    );
                                })}
                            <TablePagination
                                component="div"
                                count={filteredSupervisors.length}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                rowsPerPageOptions={[5, 10, 25]}
                                labelRowsPerPage="Filas por página"
                            />
                        </>
                    ) : (
                        // Vista desktop: renderizar la tabla original
                        <Paper sx={{ width: '100%', overflowX: 'auto' }}>
                            <TableContainer
                                sx={{ maxHeight: { xs: 400, sm: 'none' }, overflowX: 'auto' }}
                            >
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Nombre</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Pilotos Asignados</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredSupervisors
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((sup, index) => {
                                                const orgGroups = groupByOrganization(sup.assignedPilots || []);
                                                const orgKeys = Object.keys(orgGroups);
                                                const selected = selectedSchool[sup.email] || orgKeys[0] || '';
                                                const selectedGroup = orgGroups[selected];
                                                const pilots = selectedGroup ? selectedGroup.pilots : [];
                                                const key = `${sup.email}-${selected}`;
                                                const currentPage = pilotPages[key] || 0;
                                                const totalPages = Math.ceil(pilots.length / PILOTS_PER_PAGE);
                                                const pilotsToShow = pilots.slice(
                                                    currentPage * PILOTS_PER_PAGE,
                                                    (currentPage + 1) * PILOTS_PER_PAGE
                                                );
                                                return (
                                                    <TableRow key={sup.email}>
                                                        <TableCell>{sup.name}</TableCell>
                                                        <TableCell>{sup.email}</TableCell>
                                                        <TableCell>
                                                            <Accordion
                                                                expanded={expanded === `panel-${index}`}
                                                                onChange={handleChangeAccordion(`panel-${index}`)}
                                                            >
                                                                <AccordionSummary
                                                                    expandIcon={<ExpandMoreIcon />}
                                                                    aria-controls={`panel-${index}-content`}
                                                                >
                                                                    <Typography>Ver pilotos asignados</Typography>
                                                                </AccordionSummary>
                                                                <AccordionDetails>
                                                                    {orgKeys.length === 0 ? (
                                                                        <Typography>
                                                                            No hay pilotos asignados a este supervisor.
                                                                        </Typography>
                                                                    ) : (
                                                                        <>
                                                                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                                                <InputLabel>Colegio/Corporación</InputLabel>
                                                                                <Select
                                                                                    value={selected}
                                                                                    label="Colegio/Corporación"
                                                                                    onChange={e => handleSchoolChange(sup.email, e.target.value)}
                                                                                >
                                                                                    {orgKeys.map(orgKey => {
                                                                                        const org = orgGroups[orgKey];
                                                                                        return (
                                                                                            <MenuItem key={orgKey} value={orgKey}>
                                                                                                {org.displayName}
                                                                                            </MenuItem>
                                                                                        );
                                                                                    })}
                                                                                </Select>
                                                                            </FormControl>
                                                                            <Table size="small" sx={{ overflowX: 'auto' }}>
                                                                                <TableHead>
                                                                                    <TableRow>
                                                                                        <TableCell>Nombre</TableCell>
                                                                                        <TableCell>Email</TableCell>
                                                                                        <TableCell>Km Recorridos</TableCell>
                                                                                        <TableCell>Rutas Hechas</TableCell>
                                                                                        <TableCell>Incidentes</TableCell>
                                                                                        <TableCell>Emergencias</TableCell>
                                                                                    </TableRow>
                                                                                </TableHead>
                                                                                <TableBody>
                                                                                    {pilotsToShow.map((p) => (
                                                                                        <TableRow key={p.email}>
                                                                                            <TableCell>{p.name}</TableCell>
                                                                                            <TableCell>{p.email}</TableCell>
                                                                                            <TableCell>{(p.kmTraveled ?? 0).toFixed(3)}</TableCell>
                                                                                            <TableCell>{p.routesCount ?? 0}</TableCell>
                                                                                            <TableCell>{p.incidentsCount ?? 0}</TableCell>
                                                                                            <TableCell>{p.emergenciesCount ?? 0}</TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                            {totalPages > 1 && (
                                                                                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                                                                    <Button
                                                                                        size="small"
                                                                                        disabled={currentPage === 0}
                                                                                        onClick={() => handlePilotPageChange(sup.email, selected, currentPage - 1)}
                                                                                    >
                                                                                        Anterior
                                                                                    </Button>
                                                                                    <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                                                                                        Página {currentPage + 1} de {totalPages}
                                                                                    </Typography>
                                                                                    <Button
                                                                                        size="small"
                                                                                        disabled={currentPage >= totalPages - 1}
                                                                                        onClick={() => handlePilotPageChange(sup.email, selected, currentPage + 1)}
                                                                                    >
                                                                                        Siguiente
                                                                                    </Button>
                                                                                </Box>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </AccordionDetails>
                                                            </Accordion>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        {filteredSupervisors.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">
                                                    No se encontraron supervisores.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={filteredSupervisors.length}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                rowsPerPageOptions={[5, 10, 25]}
                                labelRowsPerPage="Filas por página"
                            />
                        </Paper>
                    )}
                </>
            )}
        </SupervisorsContainer>
    );
};

export default SupervisorsManagementPage;
