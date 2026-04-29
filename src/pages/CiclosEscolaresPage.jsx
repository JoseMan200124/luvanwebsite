import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Snackbar,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { Add, CheckCircle, Edit, Star } from '@mui/icons-material';
import PermissionGuard from '../components/PermissionGuard';
import {
    activateCicloEscolar,
    createCicloEscolar,
    getCicloEscolarOptionLabel,
    getCiclosEscolares,
    setDefaultCicloEscolar,
    updateCicloEscolar
} from '../services/cicloEscolarService';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';

const emptyForm = {
    anio: '',
    nombre: '',
    label: '',
    descripcion: ''
};

const CiclosEscolaresPage = () => {
    const [ciclosEscolares, setCiclosEscolares] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedCiclo, setSelectedCiclo] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const fetchCiclosEscolares = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getCiclosEscolares();
            setCiclosEscolares(Array.isArray(data.ciclosEscolares) ? data.ciclosEscolares : []);
        } catch (error) {
            console.error('Error cargando ciclos escolares:', error);
            setSnackbar({ open: true, message: 'Error al cargar ciclos escolares', severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCiclosEscolares();
    }, [fetchCiclosEscolares]);

    useRegisterPageRefresh(async () => {
        await fetchCiclosEscolares();
    }, [fetchCiclosEscolares]);

    const handleOpenCreate = () => {
        setSelectedCiclo(null);
        setForm(emptyForm);
        setOpenDialog(true);
    };

    const handleOpenEdit = (cicloEscolar) => {
        setSelectedCiclo(cicloEscolar);
        setForm({
            anio: cicloEscolar.anio || '',
            nombre: cicloEscolar.nombre || '',
            label: cicloEscolar.label || '',
            descripcion: cicloEscolar.descripcion || ''
        });
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedCiclo(null);
        setForm(emptyForm);
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const anio = Number.parseInt(form.anio, 10);
        if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
            setSnackbar({ open: true, message: 'Ingresa un año válido entre 2000 y 2100', severity: 'error' });
            return;
        }
        if (!String(form.nombre || '').trim()) {
            setSnackbar({ open: true, message: 'El nombre del ciclo escolar es obligatorio', severity: 'error' });
            return;
        }

        setSaving(true);
        try {
            const payload = {
                anio,
                nombre: form.nombre.trim(),
                label: form.label.trim() || null,
                descripcion: form.descripcion.trim() || null
            };

            if (selectedCiclo?.id) {
                await updateCicloEscolar(selectedCiclo.id, payload);
                setSnackbar({ open: true, message: 'Ciclo escolar actualizado', severity: 'success' });
            } else {
                await createCicloEscolar(payload);
                setSnackbar({ open: true, message: 'Ciclo escolar creado', severity: 'success' });
            }
            handleCloseDialog();
            fetchCiclosEscolares();
        } catch (error) {
            console.error('Error guardando ciclo escolar:', error);
            setSnackbar({ open: true, message: error.response?.data?.message || 'Error al guardar ciclo escolar', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async (cicloEscolar) => {
        if (!cicloEscolar?.id || cicloEscolar.activo) return;
        setSaving(true);
        try {
            await activateCicloEscolar(cicloEscolar.id);
            setSnackbar({ open: true, message: 'Ciclo escolar habilitado', severity: 'success' });
            fetchCiclosEscolares();
        } catch (error) {
            console.error('Error habilitando ciclo escolar:', error);
            setSnackbar({ open: true, message: error.response?.data?.message || 'Error al habilitar ciclo escolar', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (cicloEscolar) => {
        if (!cicloEscolar?.id || cicloEscolar.predeterminado) return;
        setSaving(true);
        try {
            const data = await setDefaultCicloEscolar(cicloEscolar.id);
            const defaultCycle = data.cicloEscolar || cicloEscolar;
            localStorage.setItem('selectedCicloEscolarId', String(defaultCycle.id));
            localStorage.setItem('selectedSchoolYear', String(defaultCycle.anio));
            setSnackbar({ open: true, message: 'Ciclo escolar predeterminado actualizado', severity: 'success' });
            fetchCiclosEscolares();
        } catch (error) {
            console.error('Error marcando ciclo escolar predeterminado:', error);
            setSnackbar({ open: true, message: error.response?.data?.message || 'Error al actualizar ciclo predeterminado', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Ciclos Escolares
                            </Typography>
                            <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                Administra ciclos habilitados por colegio. El predeterminado se usa como selección inicial.
                            </Typography>
                        </Box>
                        <PermissionGuard permission="ciclos-escolares-crear">
                            <Button variant="contained" color="inherit" startIcon={<Add />} onClick={handleOpenCreate} sx={{ color: '#4f46e5' }}>
                                Nuevo Ciclo
                            </Button>
                        </PermissionGuard>
                    </Box>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Año</TableCell>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Etiqueta</TableCell>
                                    <TableCell>Estado</TableCell>
                                    <TableCell>Descripción</TableCell>
                                    <TableCell align="right">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {ciclosEscolares.map((cicloEscolar) => (
                                    <TableRow key={cicloEscolar.id} hover>
                                        <TableCell>{cicloEscolar.anio}</TableCell>
                                        <TableCell>{cicloEscolar.nombre}</TableCell>
                                        <TableCell>{getCicloEscolarOptionLabel(cicloEscolar)}</TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                <Chip label={cicloEscolar.activo ? 'Habilitado' : 'Deshabilitado'} color={cicloEscolar.activo ? 'success' : 'default'} size="small" />
                                                {cicloEscolar.predeterminado && <Chip label="Predeterminado" color="primary" size="small" />}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{cicloEscolar.descripcion || '-'}</TableCell>
                                        <TableCell align="right">
                                            <PermissionGuard permission="ciclos-escolares-editar">
                                                <Tooltip title="Editar">
                                                    <IconButton onClick={() => handleOpenEdit(cicloEscolar)}>
                                                        <Edit />
                                                    </IconButton>
                                                </Tooltip>
                                            </PermissionGuard>
                                            <PermissionGuard permission="ciclos-escolares-activar">
                                                <Tooltip title={cicloEscolar.activo ? 'Ya está habilitado' : 'Habilitar'}>
                                                    <span>
                                                        <IconButton disabled={cicloEscolar.activo || saving} color="success" onClick={() => handleActivate(cicloEscolar)}>
                                                            <CheckCircle />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </PermissionGuard>
                                            <PermissionGuard permission="ciclos-escolares-activar">
                                                <Tooltip title={cicloEscolar.predeterminado ? 'Ya es predeterminado' : 'Marcar como predeterminado'}>
                                                    <span>
                                                        <IconButton disabled={cicloEscolar.predeterminado || saving} color="primary" onClick={() => handleSetDefault(cicloEscolar)}>
                                                            <Star />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </PermissionGuard>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {ciclosEscolares.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">No hay ciclos escolares configurados.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{selectedCiclo ? 'Editar Ciclo Escolar' : 'Nuevo Ciclo Escolar'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField name="anio" label="Año" type="number" value={form.anio} onChange={handleChange} slotProps={{ htmlInput: { min: 2000, max: 2100 } }} fullWidth />
                    <TextField name="nombre" label="Nombre" value={form.nombre} onChange={handleChange} fullWidth placeholder="2026" />
                    <TextField name="label" label="Etiqueta" value={form.label} onChange={handleChange} fullWidth placeholder="Ciclo Escolar 2026" />
                    <TextField name="descripcion" label="Descripción" value={form.descripcion} onChange={handleChange} fullWidth multiline rows={3} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancelar</Button>
                    <Button onClick={handleSave} variant="contained" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default CiclosEscolaresPage;