// src/pages/SchoolsManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    TextField,
    IconButton,
    Tooltip,
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Alert,
    CircularProgress,
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import axios from 'axios';
import styled from 'styled-components';
import tw from 'twin.macro';

const SchoolsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const SchoolsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`, // Asegúrate de que auth.token esté definido
                },
            });
            console.log('Respuesta de la API:', response.data); // Para depuración
            // Asegura que 'schools' sea siempre un array
            setSchools(Array.isArray(response.data.schools) ? response.data.schools : []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching schools:', err);
            setSnackbar({ open: true, message: 'Error al obtener los colegios', severity: 'error' });
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchools();
    }, [auth.token]);

    const handleEditClick = (school) => {
        setSelectedSchool(school);
        setOpenDialog(true);
    };

    const handleDeleteClick = async (schoolId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este colegio?')) {
            try {
                await axios.delete(`/api/schools/${schoolId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Colegio eliminado exitosamente', severity: 'success' });
                fetchSchools();
            } catch (err) {
                console.error('Error deleting school:', err);
                setSnackbar({ open: true, message: 'Error al eliminar el colegio', severity: 'error' });
            }
        }
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedSchool(null);
    };

    const handleInputChange = (e) => {
        setSelectedSchool({
            ...selectedSchool,
            [e.target.name]: e.target.value,
        });
    };

    const handleSave = async () => {
        try {
            if (selectedSchool.id) {
                // Update existing school
                await axios.put(`/api/schools/${selectedSchool.id}`, selectedSchool, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Colegio actualizado exitosamente', severity: 'success' });
            } else {
                // Create new school
                await axios.post('/api/schools', selectedSchool, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Colegio creado exitosamente', severity: 'success' });
            }
            fetchSchools();
            handleDialogClose();
        } catch (err) {
            console.error('Error saving school:', err);
            setSnackbar({ open: true, message: 'Error al guardar el colegio', severity: 'error' });
        }
    };

    const handleAddSchool = () => {
        setSelectedSchool({
            name: '',
            address: '',
            city: '',
            contactPerson: '',
            contactEmail: '',
            contactPhone: '',
        });
        setOpenDialog(true);
    };

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Filtrar colegios basados en la consulta de búsqueda
    const filteredSchools = schools.filter((school) => {
        return (
            school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            school.city.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    return (
        <SchoolsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Colegios
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <TextField
                    label="Buscar colegios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: '300px' }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={handleAddSchool}
                >
                    Añadir Colegio
                </Button>
            </div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Ciudad</TableCell>
                                    <TableCell>Dirección</TableCell>
                                    <TableCell>Contacto</TableCell>
                                    <TableCell>Teléfono</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredSchools.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((school) => (
                                    <TableRow key={school.id}>
                                        <TableCell>{school.name}</TableCell>
                                        <TableCell>{school.city}</TableCell>
                                        <TableCell>{school.address}</TableCell>
                                        <TableCell>{school.contactPerson}</TableCell>
                                        <TableCell>{school.contactPhone}</TableCell>
                                        <TableCell>{school.contactEmail}</TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Editar">
                                                <IconButton onClick={() => handleEditClick(school)}>
                                                    <Edit />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Eliminar">
                                                <IconButton onClick={() => handleDeleteClick(school.id)}>
                                                    <Delete />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredSchools.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            No se encontraron colegios.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredSchools.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}
            {/* Diálogo para Añadir/Editar Colegio */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
                <DialogTitle>{selectedSchool && selectedSchool.id ? 'Editar Colegio' : 'Añadir Colegio'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="name"
                        label="Nombre"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.name : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="city"
                        label="Ciudad"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.city : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="address"
                        label="Dirección"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.address : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="contactPerson"
                        label="Persona de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPerson : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactPhone"
                        label="Teléfono de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPhone : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactEmail"
                        label="Email de Contacto"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactEmail : ''}
                        onChange={handleInputChange}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        color="primary"
                        variant="contained"
                    >
                        {selectedSchool && selectedSchool.id ? 'Guardar Cambios' : 'Crear Colegio'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Snackbar para retroalimentación */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </SchoolsContainer>
    );

};

export default SchoolsManagementPage;
