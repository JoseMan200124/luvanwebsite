import React, {
    useState,
    useEffect,
    useContext,
    useCallback
} from 'react';
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
    MenuItem,
    CircularProgress
} from '@mui/material';
import tw from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

const PermissionsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const PermissionsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    // Estados relacionados con roles y módulos
    const [roles, setRoles] = useState([]);
    const [modules, setModules] = useState([]);

    // Estado para el rol seleccionado y sus permisos
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [rolePermissions, setRolePermissions] = useState({});

    // Estados de loading / error
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Estado para el snackbar de feedback
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    // --- Funciones de carga de datos, memorizadas con useCallback --- //
    const fetchRoles = useCallback(async () => {
        setError(null);
        try {
            const res = await api.get('/permissions/roles', {
                headers: { Authorization: `Bearer ${auth?.token}` },
            });
            setRoles(res.data.roles || []);
        } catch (err) {
            console.error('Error al obtener roles:', err);
            setError(err.message || 'Error al obtener roles.');
        }
    }, [auth?.token]);

    const fetchModules = useCallback(async () => {
        setError(null);
        try {
            const res = await api.get('/permissions/modules', {
                headers: { Authorization: `Bearer ${auth?.token}` },
            });
            setModules(res.data.modules || []);
        } catch (err) {
            console.error('Error al obtener módulos:', err);
            setError(err.message || 'Error al obtener módulos.');
        }
    }, [auth?.token]);

    const fetchRolePermissions = useCallback(
        async (roleId) => {
            setError(null);
            try {
                const res = await api.get(`/permissions/role/${roleId}`, {
                    headers: { Authorization: `Bearer ${auth?.token}` },
                });
                setRolePermissions(res.data.permissions || {});
            } catch (err) {
                console.error('Error al obtener permisos:', err);
                setError(err.message || 'Error al obtener permisos.');
            }
        },
        [auth?.token]
    );

    // --- useEffect para cargar roles y módulos al inicio (si hay token) --- //
    useEffect(() => {
        if (!auth?.token) {
            // Si no hay token, no hacemos nada
            return;
        }
        (async () => {
            try {
                setIsLoading(true);
                await Promise.all([fetchRoles(), fetchModules()]);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [auth?.token, fetchRoles, fetchModules]);

    // --- useEffect para cargar los permisos del rol al cambiar de rol --- //
    useEffect(() => {
        if (!selectedRoleId || !auth?.token) {
            // Si no hay rol seleccionado o no hay token, limpiamos o no hacemos nada
            setRolePermissions({});
            return;
        }

        (async () => {
            setIsLoading(true);
            try {
                await fetchRolePermissions(selectedRoleId);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [selectedRoleId, auth?.token, fetchRolePermissions]);

    // --- Manejador de cambio de rol --- //
    const handleRoleChange = (e) => {
        setSelectedRoleId(e.target.value);
    };

    // --- Manejador de checkbox (actualiza el estado local) --- //
    const handleCheckboxChange = (moduleKey, e) => {
        const newValue = e.target.checked;
        setRolePermissions((prev) => ({
            ...prev,
            [moduleKey]: newValue,
        }));
    };

    // --- Manejador para guardar permisos en el servidor --- //
    const handleSavePermissions = useCallback(async () => {
        if (!auth?.token || !selectedRoleId) return;

        setError(null);
        setIsLoading(true);
        try {
            await api.put(
                `/permissions/role/${selectedRoleId}`,
                { permissions: rolePermissions },
                {
                    headers: { Authorization: `Bearer ${auth?.token}` },
                }
            );
            setSnackbar({
                open: true,
                message: 'Permisos actualizados exitosamente',
                severity: 'success',
            });
        } catch (err) {
            console.error('Error al actualizar permisos:', err);
            setError(err.message || 'Error al actualizar permisos.');
            setSnackbar({
                open: true,
                message: 'Error al actualizar permisos',
                severity: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    }, [auth?.token, selectedRoleId, rolePermissions]);

    // --- Cierre del Snackbar --- //
    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // --- Render: Si está cargando (o no hay token), muestra spinner o mensaje --- //
    if (!auth?.token) {
        return (
            <PermissionsContainer>
                <Typography variant="h5" color="error">
                    No hay token disponible. Por favor, inicia sesión primero.
                </Typography>
            </PermissionsContainer>
        );
    }

    return (
        <PermissionsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Roles y Permisos
            </Typography>

            {/* Mostrar error global si existe */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Mostrar spinner si isLoading */}
            {isLoading && (
                <div style={{ marginBottom: 16 }}>
                    <CircularProgress size={28} />
                    <span style={{ marginLeft: 8 }}>Cargando datos...</span>
                </div>
            )}

            {/* Selector de Rol */}
            <FormControl
                variant="outlined"
                style={{ minWidth: 200, marginBottom: '16px' }}
            >
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

            {/* Tabla de permisos (solo si hay un rol seleccionado) */}
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
                                            <TableRow hover>
                                                <TableCell>
                                                    <strong>{mod.label}</strong>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Checkbox
                                                        sx={{ pointerEvents: 'auto' }}
                                                        color="primary"
                                                        checked={parentChecked}
                                                        onChange={(e) => handleCheckboxChange(mod.key, e)}
                                                    />
                                                </TableCell>
                                            </TableRow>

                                            {/* Filas para los SUBMÓDULOS */}
                                            {Array.isArray(mod.submodules) &&
                                                mod.submodules.map((sub) => {
                                                    const subChecked = !!rolePermissions[sub.key];
                                                    return (
                                                        <TableRow key={sub.key} hover>
                                                            <TableCell style={{ paddingLeft: '2rem' }}>
                                                                {sub.label}
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Checkbox
                                                                    sx={{ pointerEvents: 'auto' }}
                                                                    color="primary"
                                                                    checked={subChecked}
                                                                    onChange={(e) =>
                                                                        handleCheckboxChange(sub.key, e)
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
                        disabled={isLoading}
                    >
                        Guardar Cambios
                    </Button>
                </>
            )}

            {/* Snackbar de feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </PermissionsContainer>
    );
};

export default PermissionsManagementPage;
