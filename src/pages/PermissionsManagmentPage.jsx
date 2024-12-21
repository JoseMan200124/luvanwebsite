// src/pages/PermissionsManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    Paper,
    Checkbox,
    Button,
    Snackbar,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';

const PermissionsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const PermissionsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    const [roles, setRoles] = useState([]);
    const [modules, setModules] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [rolePermissions, setRolePermissions] = useState({});
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        if (auth.token) {
            fetchRoles();
            fetchModules();
        }
    }, [auth.token]);

    const fetchRoles = async () => {
        try {
            const res = await api.get('/permissions/roles', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            setRoles(res.data.roles || []);
        } catch (err) {
            console.error('Error al obtener roles:', err);
        }
    };

    const fetchModules = async () => {
        try {
            const res = await api.get('/permissions/modules', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            setModules(res.data.modules || []);
        } catch (err) {
            console.error('Error al obtener módulos:', err);
        }
    };

    const fetchRolePermissions = async (roleId) => {
        try {
            const res = await api.get(`/permissions/role/${roleId}`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            setRolePermissions(res.data.permissions || {});
        } catch (err) {
            console.error('Error al obtener permisos:', err);
        }
    };

    const handleRoleChange = (e) => {
        const newRoleId = e.target.value;
        setSelectedRoleId(newRoleId);
        if (newRoleId) {
            fetchRolePermissions(newRoleId);
        } else {
            setRolePermissions({});
        }
    };

    // Maneja el cambio de un checkbox (módulo padre o submódulo)
    const handleCheckboxChange = (moduleKey, currentValue) => {
        setRolePermissions((prev) => ({
            ...prev,
            [moduleKey]: !currentValue,
        }));
    };

    const handleSavePermissions = async () => {
        try {
            await api.put(
                `/permissions/role/${selectedRoleId}`,
                { permissions: rolePermissions },
                { headers: { Authorization: `Bearer ${auth.token}` } }
            );
            setSnackbar({ open: true, message: 'Permisos actualizados exitosamente', severity: 'success' });
        } catch (err) {
            console.error('Error al actualizar permisos:', err);
            setSnackbar({ open: true, message: 'Error al actualizar permisos', severity: 'error' });
        }
    };

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    return (
        <PermissionsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Roles y Permisos
            </Typography>
            <FormControl variant="outlined" style={{ minWidth: 200, marginBottom: '16px' }}>
                <InputLabel>Selecciona un Rol</InputLabel>
                <Select
                    value={selectedRoleId}
                    onChange={handleRoleChange}
                    label="Selecciona un Rol"
                >
                    <MenuItem value="">
                        <em>-- Seleccionar --</em>
                    </MenuItem>
                    {roles.map((role) => (
                        <MenuItem key={role.id} value={role.id}>
                            {role.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {selectedRoleId && (
                <>
                    <TableContainer component={Paper} style={{ marginTop: '16px' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Módulo / Submódulo</TableCell>
                                    <TableCell align="center">Acceso</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {modules.map((mod) => {
                                    const parentChecked = !!rolePermissions[mod.key];
                                    return (
                                        <React.Fragment key={mod.key}>
                                            {/* Fila para el MÓDULO padre */}
                                            <TableRow>
                                                <TableCell>
                                                    <strong>{mod.label}</strong>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Checkbox
                                                        checked={parentChecked}
                                                        onChange={() =>
                                                            handleCheckboxChange(mod.key, parentChecked)
                                                        }
                                                    />
                                                </TableCell>
                                            </TableRow>

                                            {/* Filas para los SUBMÓDULOS */}
                                            {mod.submodules && mod.submodules.map((sub) => {
                                                const subKey = sub.key;
                                                const subChecked = !!rolePermissions[subKey];
                                                return (
                                                    <TableRow key={subKey}>
                                                        <TableCell style={{ paddingLeft: '2rem' }}>
                                                            {sub.label}
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Checkbox
                                                                checked={subChecked}
                                                                onChange={() =>
                                                                    handleCheckboxChange(subKey, subChecked)
                                                                }
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Button
                        variant="contained"
                        color="primary"
                        style={{ marginTop: '16px' }}
                        onClick={handleSavePermissions}
                    >
                        Guardar Cambios
                    </Button>
                </>
            )}

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
        </PermissionsContainer>
    );
};

export default PermissionsManagementPage;
