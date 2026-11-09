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
    Chip,
    Alert
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import styled from 'styled-components';
import tw from 'twin.macro';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';

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

const ClientsList = ({ clients }) => {
    if (clients.length === 0) {
        return <Typography>No hay clientes asignados a este supervisor.</Typography>;
    }
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {clients.map((c) => (
                <Accordion key={`${c.type}-${c.id}`} variant="outlined" disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <Typography variant="body2">
                                {c.name}{' '}
                                <Typography component="span" variant="caption" color="text.secondary">
                                    ({c.type === 'corporation' ? 'Corporación' : 'Colegio'}
                                    {` · ${(c.buses || []).length} ${(c.buses || []).length === 1 ? 'bus' : 'buses'}`})
                                </Typography>
                            </Typography>
                            {c.operating === false && (
                                <Chip size="small" color="error" label="Sin operación" />
                            )}
                            {c.newerCycle && (
                                <Chip size="small" color="warning" label={`Ciclo anterior${c.cycleLabel ? ` (${c.cycleLabel})` : ''}`} />
                            )}
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        {c.operating === false && (
                            <Alert severity="error" sx={{ mb: 1 }}>
                                Este colegio no tiene ningún ciclo operativo. Se muestra el más reciente{c.cycleLabel ? ` (${c.cycleLabel})` : ''}.
                            </Alert>
                        )}
                        {c.newerCycle && (
                            <Alert severity="warning" sx={{ mb: 1 }}>
                                Los buses mostrados son del {c.cycleLabel || 'ciclo anterior'}, que es el que está marcado como operativo.
                                Existe un ciclo más reciente{c.newerCycle.label ? ` (${c.newerCycle.label})` : ''} que aún no está operativo.
                            </Alert>
                        )}
                        {(c.buses || []).length === 0 ? (
                            <Typography variant="body2" color="text.secondary">Sin buses asignados</Typography>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Placa</TableCell>
                                            <TableCell>Ruta</TableCell>
                                            <TableCell>Descripción</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {c.buses.map((b) => (
                                            <TableRow key={b.id}>
                                                <TableCell>{b.plate}</TableCell>
                                                <TableCell>{b.routeNumber || '-'}</TableCell>
                                                <TableCell>{b.description || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
};

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

        // Register page-level refresh handler for global refresh control
        useRegisterPageRefresh(async () => {
            await fetchSupervisors();
        }, [fetchSupervisors]);

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
        setRowsPerPage(Number.parseInt(event.target.value, 10));
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
                                .map((sup, index) => {
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
                                                <MobileLabel>Clientes Asignados</MobileLabel>
                                                <Accordion
                                                    expanded={expanded === `panel-${index}`}
                                                    onChange={handleChangeAccordion(`panel-${index}`)}
                                                >
                                                    <AccordionSummary
                                                        expandIcon={<ExpandMoreIcon />}
                                                        aria-controls={`panel-${index}-content`}
                                                    >
                                                        <Typography>Ver clientes asignados</Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        <ClientsList clients={sup.assignedClients || []} />
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
                                <Table stickyHeader sx={{ minWidth: 760 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Nombre</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Clientes Asignados</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredSupervisors
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((sup, index) => {
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
                                                                    <Typography>Ver clientes asignados</Typography>
                                                                </AccordionSummary>
                                                                <AccordionDetails>
                                                        <ClientsList clients={sup.assignedClients || []} />
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
