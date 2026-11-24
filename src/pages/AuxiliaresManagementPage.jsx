import React, { useEffect, useState, useContext } from 'react';
import {
    Typography,
    Paper,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Button,
    MenuItem,
    FormControl,
    InputLabel,
    Select
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

// Container principal con estilos responsivos
// Helper para agrupar las monitoras asignadas por organización (colegio o corporación)
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
                monitoras: []
            };
        }
        result[key].monitoras.push(item);
    });
    return result;
};

// Columnas de la tabla de auxiliares
const COLUMNS = [
    { id: 'name', label: 'Nombre' },
    { id: 'email', label: 'Email' },
    { id: 'monitoras', label: 'Monitoras Asignadas' },
];

const MONITORAS_PER_PAGE = 5;

const AuxiliaresManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const isMobile = useIsMobile();

    const [auxiliares, setAuxiliares] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const table = useTableState();
    const pageFilters = useFilters({
        fields: [F.search('search', { placeholder: 'Nombre o correo' })],
        onApplied: table.resetPage,
    });
    const { search: searchQuery } = pageFilters.applied;

    const [expanded, setExpanded] = useState(false);
    const [monitoraPages, setMonitoraPages] = useState({});
    // Estado para colegio seleccionado por auxiliar
    const [selectedSchool, setSelectedSchool] = useState({});

    useEffect(() => {
        fetchAuxiliares();
        // eslint-disable-next-line
    }, []);

    const fetchAuxiliares = async () => {
        setLoading(true);
        try {
            const res = await api.get('/staff/auxiliares', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setAuxiliares(res.data.auxiliares || []);
        } catch (error) {
            console.error('Error al obtener auxiliares:', error);
            setAuxiliares([]);
        }
        setLoading(false);
    };

        // Register page-level refresh handler for global refresh control
        useRegisterPageRefresh(async () => {
            await fetchAuxiliares();
        }, [fetchAuxiliares]);

    // Filtrar auxiliares
    const filteredAuxiliares = auxiliares.filter((a) => matchSearchTokens(searchQuery, [a.name, a.email]));

    const pageAuxiliares = table.paginate(filteredAuxiliares);

    const handleChangeAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    // Helper para manejar la página de monitoras por auxiliar y colegio
    const handleMonitoraPageChange = (auxEmail, school, newPage) => {
        setMonitoraPages(prev => ({
            ...prev,
            [`${auxEmail}-${school}`]: newPage
        }));
    };

    // Helper para manejar selección de colegio por auxiliar
    const handleSchoolChange = (auxEmail, school) => {
        setSelectedSchool(prev => ({
            ...prev,
            [auxEmail]: school
        }));
        // Reiniciar paginación al cambiar de colegio
        setMonitoraPages(prev => ({
            ...prev,
            [`${auxEmail}-${school}`]: 0
        }));
    };

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.personal}
                title="Gestión de Auxiliares"
            />

            <FilterBar {...pageFilters.barProps} loading={loading} />

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {filteredAuxiliares.length === 0 ? (
                        <Typography>No se encontraron auxiliares.</Typography>
                    ) : isMobile ? (
                        // Vista móvil: renderizar una lista de tarjetas (MobileCard) para cada auxiliar
                        <>
                            {pageAuxiliares
                                .map((aux, index) => {
                                    const orgGroups = groupByOrganization(aux.assignedMonitoras || []);
                                    const orgKeys = Object.keys(orgGroups);
                                    const selected = selectedSchool[aux.email] || orgKeys[0] || '';
                                    const selectedGroup = orgGroups[selected];
                                    const monitoras = selectedGroup ? selectedGroup.monitoras : [];
                                    const key = `${aux.email}-${selected}`;
                                    const currentPage = monitoraPages[key] || 0;
                                    const totalPages = Math.ceil(monitoras.length / MONITORAS_PER_PAGE);
                                    const monitorasToShow = monitoras.slice(
                                        currentPage * MONITORAS_PER_PAGE,
                                        (currentPage + 1) * MONITORAS_PER_PAGE
                                    );
                                    return (
                                        <MobileCard key={aux.email || index}>
                                            <MobileField label="Nombre">{aux.name}</MobileField>
                                            <MobileField label="Email">{aux.email}</MobileField>
                                            <MobileField label="Monitoras Asignadas">
                                                <Accordion
                                                    expanded={expanded === `panel-${index}`}
                                                    onChange={handleChangeAccordion(`panel-${index}`)}
                                                >
                                                    <AccordionSummary
                                                        expandIcon={<ExpandMoreIcon />}
                                                        aria-controls={`panel-${index}-content`}
                                                    >
                                                        <Typography>Ver monitoras asignadas</Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        {orgKeys.length === 0 ? (
                                                            <Typography>
                                                                No hay monitoras asignadas a este auxiliar.
                                                            </Typography>
                                                        ) : (
                                                            <>
                                                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                                    <InputLabel>Colegio/Corporación</InputLabel>
                                                                    <Select
                                                                        value={selected}
                                                                        label="Colegio/Corporación"
                                                                        onChange={e => handleSchoolChange(aux.email, e.target.value)}
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
                                                                {monitorasToShow.map((m, idx) => (
                                                                    <Paper
                                                                        key={`${m.email}-${idx}`}
                                                                        variant="outlined"
                                                                        sx={{ p: 1, mb: 1 }}
                                                                    >
                                                                        <Typography variant="body2">
                                                                            <strong>Nombre:</strong> {m.name}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Email:</strong> {m.email}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Incidentes:</strong> {m.incidentsCount ?? 0}
                                                                        </Typography>
                                                                        <Typography variant="body2">
                                                                            <strong>Emergencias:</strong> {m.emergenciesCount ?? 0}
                                                                        </Typography>
                                                                    </Paper>
                                                                ))}
                                                                {totalPages > 1 && (
                                                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                                                        <Button
                                                                            size="small"
                                                                            disabled={currentPage === 0}
                                                                            onClick={() => handleMonitoraPageChange(aux.email, selected, currentPage - 1)}
                                                                        >
                                                                            Anterior
                                                                        </Button>
                                                                        <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                                                                            Página {currentPage + 1} de {totalPages}
                                                                        </Typography>
                                                                        <Button
                                                                            size="small"
                                                                            disabled={currentPage >= totalPages - 1}
                                                                            onClick={() => handleMonitoraPageChange(aux.email, selected, currentPage + 1)}
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
                            <AppTablePagination count={filteredAuxiliares.length} {...table.paginationProps} />
                        </>
                    ) : (
                        // Vista desktop: renderizar la tabla original
                        <Paper sx={{ width: '100%', overflowX: 'auto' }}>
                            <AppTableContainer>
                                <Table stickyHeader sx={{ minWidth: 760 }}>
                                    <SortableTableHead columns={COLUMNS} />
                                    <TableBody>
                                        {pageAuxiliares
                                            .map((aux, index) => {
                                                const orgGroups = groupByOrganization(aux.assignedMonitoras || []);
                                                const orgKeys = Object.keys(orgGroups);
                                                const selected = selectedSchool[aux.email] || orgKeys[0] || '';
                                                const selectedGroup = orgGroups[selected];
                                                const monitoras = selectedGroup ? selectedGroup.monitoras : [];
                                                const key = `${aux.email}-${selected}`;
                                                const currentPage = monitoraPages[key] || 0;
                                                const totalPages = Math.ceil(monitoras.length / MONITORAS_PER_PAGE);
                                                const monitorasToShow = monitoras.slice(
                                                    currentPage * MONITORAS_PER_PAGE,
                                                    (currentPage + 1) * MONITORAS_PER_PAGE
                                                );
                                                return (
                                                    <TableRow key={aux.email || index}>
                                                        <TableCell>{aux.name}</TableCell>
                                                        <TableCell>{aux.email}</TableCell>
                                                        <TableCell>
                                                            <Accordion
                                                                expanded={expanded === `panel-${index}`}
                                                                onChange={handleChangeAccordion(`panel-${index}`)}
                                                            >
                                                                <AccordionSummary
                                                                    expandIcon={<ExpandMoreIcon />}
                                                                    aria-controls={`panel-${index}-content`}
                                                                >
                                                                    <Typography>Ver monitoras asignadas</Typography>
                                                                </AccordionSummary>
                                                                <AccordionDetails>
                                                                    {orgKeys.length === 0 ? (
                                                                        <Typography>
                                                                            No hay monitoras asignadas a este auxiliar.
                                                                        </Typography>
                                                                    ) : (
                                                                        <>
                                                                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                                                <InputLabel>Colegio/Corporación</InputLabel>
                                                                                <Select
                                                                                    value={selected}
                                                                                    label="Colegio/Corporación"
                                                                                    onChange={e => handleSchoolChange(aux.email, e.target.value)}
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
                                                                            <Table size="small" sx={{ minWidth: 620 }}>
                                                                                <TableHead>
                                                                                    <TableRow>
                                                                                        <TableCell>Nombre</TableCell>
                                                                                        <TableCell>Email</TableCell>
                                                                                        <TableCell>Incidentes</TableCell>
                                                                                        <TableCell>Emergencias</TableCell>
                                                                                    </TableRow>
                                                                                </TableHead>
                                                                                <TableBody>
                                                                                    {monitorasToShow.map((m, idx) => (
                                                                                        <TableRow key={`${m.email}-${idx}`}>
                                                                                            <TableCell>{m.name}</TableCell>
                                                                                            <TableCell>{m.email}</TableCell>
                                                                                            <TableCell>{m.incidentsCount ?? 0}</TableCell>
                                                                                            <TableCell>{m.emergenciesCount ?? 0}</TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                    {monitorasToShow.length === 0 && (
                                                                                        <TableRow>
                                                                                            <TableCell colSpan={4} align="center">
                                                                                                No hay monitoras asignadas en esta organización.
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    )}
                                                                                </TableBody>
                                                                            </Table>
                                                                            {totalPages > 1 && (
                                                                                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                                                                    <Button
                                                                                        size="small"
                                                                                        disabled={currentPage === 0}
                                                                                        onClick={() => handleMonitoraPageChange(aux.email, selected, currentPage - 1)}
                                                                                    >
                                                                                        Anterior
                                                                                    </Button>
                                                                                    <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                                                                                        Página {currentPage + 1} de {totalPages}
                                                                                    </Typography>
                                                                                    <Button
                                                                                        size="small"
                                                                                        disabled={currentPage >= totalPages - 1}
                                                                                        onClick={() => handleMonitoraPageChange(aux.email, selected, currentPage + 1)}
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
                                        {filteredAuxiliares.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">
                                                    No se encontraron auxiliares.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </AppTableContainer>
                            <AppTablePagination count={filteredAuxiliares.length} {...table.paginationProps} />
                        </Paper>
                    )}
                </>
            )}
        </PageContainer>
    );
};

export default AuxiliaresManagementPage;