// src/pages/SupervisorsManagementPage.jsx
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

const SupervisorsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const SupervisorsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    const [supervisors, setSupervisors] = useState([]);
    const [loading, setLoading] = useState(false);

    // Para búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

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

    // Filtrado por texto
    const filteredSupervisors = supervisors.filter((s) =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
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
        <SupervisorsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Supervisores
            </Typography>

            {/* Búsqueda */}
            <div tw="mb-4 flex">
                <TextField
                    label="Buscar Supervisores"
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
                                {filteredSupervisors
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((sup) => (
                                        <TableRow key={sup.id}>
                                            <TableCell>{sup.id}</TableCell>
                                            <TableCell>{sup.name}</TableCell>
                                            <TableCell>{sup.email}</TableCell>
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
