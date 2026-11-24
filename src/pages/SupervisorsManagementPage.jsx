// src/pages/SupervisorsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import {
    Paper,
    Typography,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Chip,
    Alert
} from '@mui/material';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import { matchSearchTokens } from '../utils/clientFilter';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import useTableState from '../hooks/useTableState';
import useIsMobile from '../hooks/useIsMobile';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import { MobileCard, MobileField } from '../components/table/MobileCard';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';

// Columnas de la tabla de supervisores
const COLUMNS = [
    { id: 'name', label: 'Nombre' },
    { id: 'email', label: 'Email' },
    { id: 'clients', label: 'Clientes Asignados' },
];

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
    const isMobile = useIsMobile();

    const [supervisors, setSupervisors] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const table = useTableState();
    const pageFilters = useFilters({
        fields: [F.search('search', { placeholder: 'Nombre o correo' })],
        onApplied: table.resetPage,
    });
    const { search: searchQuery } = pageFilters.applied;

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
    const filteredSupervisors = supervisors.filter((s) => matchSearchTokens(searchQuery, [s.name, s.email]));

    const pageSupervisors = table.paginate(filteredSupervisors);

    const handleChangeAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.personal}
                title="Gestión de Supervisores"
            />

            <FilterBar {...pageFilters.barProps} loading={loading} />

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
                            {pageSupervisors
                                .map((sup, index) => {
                                    return (
                                        <MobileCard key={sup.email}>
                                            <MobileField label="Nombre">{sup.name}</MobileField>
                                            <MobileField label="Email">{sup.email}</MobileField>
                                            <MobileField label="Clientes Asignados">
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
                            <AppTablePagination count={filteredSupervisors.length} {...table.paginationProps} />
                        </>
                    ) : (
                        // Vista desktop: renderizar la tabla original
                        <Paper sx={{ width: '100%', overflowX: 'auto' }}>
                            <AppTableContainer>
                                <Table stickyHeader sx={{ minWidth: 760 }}>
                                    <SortableTableHead columns={COLUMNS} />
                                    <TableBody>
                                        {pageSupervisors
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
                            </AppTableContainer>
                            <AppTablePagination count={filteredSupervisors.length} {...table.paginationProps} />
                        </Paper>
                    )}
                </>
            )}
        </PageContainer>
    );
};

export default SupervisorsManagementPage;
