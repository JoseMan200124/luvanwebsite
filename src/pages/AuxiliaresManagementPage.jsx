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
const AuxiliaresContainer = styled.div`
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

const MONITORAS_PER_PAGE = 5;

const AuxiliaresManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [auxiliares, setAuxiliares] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);

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

    // Filtrar auxiliares
    const filteredAuxiliares = auxiliares.filter((a) => {
        const search = searchQuery.toLowerCase();
        return (
            (a.name || '').toLowerCase().includes(search) ||
            (a.email || '').toLowerCase().includes(search)
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
        <AuxiliaresContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Auxiliares
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
                    label="Buscar Auxiliares"
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
                    {filteredAuxiliares.length === 0 ? (
                        <Typography>No se encontraron auxiliares.</Typography>
                    ) : isMobile ? (
                        // Vista móvil: renderizar una lista de tarjetas (MobileCard) para cada auxiliar
                        <>
                            {filteredAuxiliares
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
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
                                            <MobileField>
                                                <MobileLabel>Nombre</MobileLabel>
                                                <MobileValue>{aux.name}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Email</MobileLabel>
                                                <MobileValue>{aux.email}</MobileValue>
                                            </MobileField>
                                            <MobileField>
                                                <MobileLabel>Monitoras Asignadas</MobileLabel>
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
                            <TablePagination
                                component="div"
                                count={filteredAuxiliares.length}
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
                                            <TableCell>Monitoras Asignadas</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredAuxiliares
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
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
                                                                            <Table size="small" sx={{ overflowX: 'auto' }}>
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
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={filteredAuxiliares.length}
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
        </AuxiliaresContainer>
    );
};

export default AuxiliaresManagementPage;