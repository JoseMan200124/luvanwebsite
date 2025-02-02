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
    CircularProgress
} from '@mui/material';
import styled from 'styled-components';
import tw from 'twin.macro';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

const MonitorsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const MonitorsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    const [monitors, setMonitors] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

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
    const filteredMonitors = monitors.filter((m) =>
        (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Manejo de paginación
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <MonitorsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Monitores
            </Typography>

            {/* Búsqueda */}
            <div tw="mb-4 flex">
                <TextField
                    label="Buscar Monitores"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    tw="w-1/3"
                />
            </div>

            {loading ? (
                <div tw="flex justify-center p-4">
                    <CircularProgress />
                </div>
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Email</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredMonitors
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((monitor) => (
                                        <TableRow key={monitor.id}>
                                            <TableCell>{monitor.id}</TableCell>
                                            <TableCell>{monitor.name}</TableCell>
                                            <TableCell>{monitor.email}</TableCell>
                                        </TableRow>
                                    ))}
                                {filteredMonitors.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center">
                                            No se encontraron monitores.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredMonitors.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}
        </MonitorsContainer>
    );
};

export default MonitorsManagementPage;
