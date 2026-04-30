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
import { Add, Edit, Star } from '@mui/icons-material';
import PermissionGuard from '../components/PermissionGuard';
import {
    createCicloEscolar,
    getCiclosEscolares,
    setDefaultCicloEscolar,
    updateCicloEscolar
} from '../services/cicloEscolarService';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';

const emptyForm = {
    anio: ''
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
            anio: cicloEscolar.anio || ''
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
        if (name === 'anio') {
            const digits = value.replaceAll(/\D/g, '').slice(0, 4);
            setForm((prev) => ({ ...prev, [name]: digits }));
            return;
        }
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const anio = Number.parseInt(form.anio, 10);
        if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
            setSnackbar({ open: true, message: 'Ingresa un año válido entre 2000 y 2100', severity: 'error' });
            return;
        }

        setSaving(true);
        try {
            const payload = {
                anio,
                nombre: String(anio),
                label: `Ciclo Escolar ${anio}`
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

    const handleSetDefault = async (cicloEscolar) => {
        if (!cicloEscolar?.id || cicloEscolar.predeterminado) return;
        setSaving(true);
        try {
            const data = await setDefaultCicloEscolar(cicloEscolar.id);
            const defaultCycle = data.cicloEscolar || cicloEscolar;
            localStorage.setItem('selectedCicloEscolarId', String(defaultCycle.id));
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
                                    <TableCell>Etiqueta</TableCell>
                                    <TableCell>Estado</TableCell>
                                    <TableCell align="right">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {ciclosEscolares.map((cicloEscolar) => (
                                    <TableRow key={cicloEscolar.id} hover>
                                        <TableCell>{cicloEscolar.anio}</TableCell>
                                        <TableCell>{`Ciclo Escolar ${cicloEscolar.anio}`}</TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                {cicloEscolar.predeterminado && <Chip label="Predeterminado" color="primary" size="small" />}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                            <PermissionGuard permission="ciclos-escolares-editar">
                                                <Tooltip title="Editar">
                                                    <IconButton onClick={() => handleOpenEdit(cicloEscolar)}>
                                                        <Edit />
                                                    </IconButton>
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
                                        <TableCell colSpan={4} align="center">No hay ciclos escolares configurados.</TableCell>
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
                    <TextField name="anio" label="Año" value={form.anio} onChange={handleChange} slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
                    <TextField label="Etiqueta" value={form.anio ? `Ciclo Escolar ${form.anio}` : ''} fullWidth disabled />
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