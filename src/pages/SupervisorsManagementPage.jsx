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
    Box
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

// Helper para agrupar los pilotos asignados por schoolName
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
                                .map((sup, index) => (
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
                                                    {(!sup.assignedPilots || sup.assignedPilots.length === 0) ? (
                                                        <Typography>
                                                            No hay pilotos asignados a este supervisor.
                                                        </Typography>
                                                    ) : (
                                                        Object.entries(groupBySchool(sup.assignedPilots)).map(
                                                            ([school, pilots]) => (
                                                                <Box key={school} sx={{ mb: 2 }}>
                                                                    <Typography variant="subtitle1">
                                                                        Colegio: {school}
                                                                    </Typography>
                                                                    {pilots.map((p) => (
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
                                                                                <strong>Kilometraje:</strong> {p.kmTraveled ?? 0}
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
                                                                </Box>
                                                            )
                                                        )
                                                    )}
                                                </AccordionDetails>
                                            </Accordion>
                                        </MobileField>
                                    </MobileCard>
                                ))}
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
                                            .map((sup, index) => (
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
                                                                {(!sup.assignedPilots ||
                                                                    sup.assignedPilots.length === 0) ? (
                                                                    <Typography>
                                                                        No hay pilotos asignados a este supervisor.
                                                                    </Typography>
                                                                ) : (
                                                                    Object.entries(groupBySchool(sup.assignedPilots)).map(
                                                                        ([school, pilots]) => (
                                                                            <div key={school} style={{ marginBottom: '16px' }}>
                                                                                <Typography variant="subtitle1">
                                                                                    Colegio: {school}
                                                                                </Typography>
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
                                                                                        {pilots.map((p) => (
                                                                                            <TableRow key={p.email}>
                                                                                                <TableCell>{p.name}</TableCell>
                                                                                                <TableCell>{p.email}</TableCell>
                                                                                                <TableCell>{p.kmTraveled ?? 0}</TableCell>
                                                                                                <TableCell>{p.routesCount ?? 0}</TableCell>
                                                                                                <TableCell>{p.incidentsCount ?? 0}</TableCell>
                                                                                                <TableCell>{p.emergenciesCount ?? 0}</TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </div>
                                                                        )
                                                                    )
                                                                )}
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
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
