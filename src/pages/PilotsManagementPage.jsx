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
    CircularProgress
} from '@mui/material';
import styled from 'styled-components';
import tw from 'twin.macro';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

const PilotsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const PilotsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    const [pilots, setPilots] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

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

    // Filtrado por texto
    const filteredPilots = pilots.filter((p) =>
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchQuery.toLowerCase())
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
        <PilotsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Pilotos
            </Typography>

            {/* Búsqueda */}
            <div tw="mb-4 flex">
                <TextField
                    label="Buscar Pilotos"
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
                                {filteredPilots
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((pilot) => (
                                        <TableRow key={pilot.id}>
                                            <TableCell>{pilot.id}</TableCell>
                                            <TableCell>{pilot.name}</TableCell>
                                            <TableCell>{pilot.email}</TableCell>
                                        </TableRow>
                                    ))}
                                {filteredPilots.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center">
                                            No se encontraron pilotos.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredPilots.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}
        </PilotsContainer>
    );
};

export default PilotsManagementPage;
