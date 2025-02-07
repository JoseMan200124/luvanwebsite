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
    AccordionDetails
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import styled from 'styled-components';
import tw from 'twin.macro';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

// Ajustes para hacerlo más responsivo
const SupervisorsContainer = styled.div`
    ${tw`bg-gray-100 min-h-screen w-full`}
    padding: 2rem;

    max-width: 1200px;
    margin: 0 auto;

    @media (max-width: 640px) {
        padding: 1rem;
    }

    // Para pantallas muy pequeñas, centramos y damos espacio
    @media (max-width: 480px) {
        padding: 0.5rem;
    }
`;

// Helper para agrupar a los pilotos asignados por schoolName
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

const SupervisorsManagementPage = () => {
    const { auth } = useContext(AuthContext);

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

    // Filtrar
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

            <div tw="mb-4 flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                <TextField
                    label="Buscar Supervisores"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    tw="w-full sm:w-1/3"
                />
            </div>

            {loading ? (
                <div tw="flex justify-center p-4">
                    <CircularProgress />
                </div>
            ) : (
                <Paper
                    // Se agrega overflowX: auto para pantallas pequeñas
                    sx={{ width: '100%', overflowX: 'auto' }}
                >
                    <TableContainer
                        // Para asegurar que en móviles el scroll horizontal funcione bien
                        sx={{
                            maxHeight: { xs: 400, sm: 'none' },
                            overflowX: 'auto'
                        }}
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
                                                {/* Acordeón con el detalle de sus pilotos */}
                                                <Accordion
                                                    expanded={expanded === `panel-${index}`}
                                                    onChange={handleChangeAccordion(`panel-${index}`)}
                                                >
                                                    <AccordionSummary
                                                        expandIcon={<ExpandMoreIcon />}
                                                        aria-controls={`panel-${index}-content`}
                                                    >
                                                        <Typography>
                                                            Ver pilotos asignados
                                                        </Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        {(!sup.assignedPilots ||
                                                            sup.assignedPilots.length === 0) && (
                                                            <Typography>
                                                                No hay pilotos asignados a este supervisor.
                                                            </Typography>
                                                        )}
                                                        {sup.assignedPilots &&
                                                            sup.assignedPilots.length > 0 && (
                                                                <>
                                                                    {Object.entries(
                                                                        groupBySchool(sup.assignedPilots)
                                                                    ).map(([school, pilots]) => (
                                                                        <div
                                                                            key={school}
                                                                            style={{ marginBottom: '16px' }}
                                                                        >
                                                                            <Typography variant="subtitle1">
                                                                                Colegio: {school}
                                                                            </Typography>
                                                                            <Table
                                                                                size="small"
                                                                                // Para forzar scroll horizontal si hay muchas columnas
                                                                                sx={{ overflowX: 'auto' }}
                                                                            >
                                                                                <TableHead>
                                                                                    <TableRow>
                                                                                        <TableCell>Nombre</TableCell>
                                                                                        <TableCell>Email</TableCell>
                                                                                        <TableCell>
                                                                                            Km Recorridos
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                            Rutas Hechas
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                            Incidentes
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                            Emergencias
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                </TableHead>
                                                                                <TableBody>
                                                                                    {pilots.map((p) => (
                                                                                        <TableRow key={p.email}>
                                                                                            <TableCell>
                                                                                                {p.name}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {p.email}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {p.kmTraveled ?? 0}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {p.routesCount ?? 0}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {p.incidentsCount ?? 0}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {p.emergenciesCount ?? 0}
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    ))}
                                                                </>
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
        </SupervisorsContainer>
    );
};

export default SupervisorsManagementPage;
