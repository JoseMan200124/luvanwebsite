import React, { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Add, CalendarToday, Edit, Star } from '@mui/icons-material';
import {
    createCicloEscolar,
    getCiclosEscolares,
    setDefaultCicloEscolar,
    updateCicloEscolar
} from '../services/cicloEscolarService';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { setSelectedCicloEscolarId } from '../utils/schoolContext';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import useNotify from '../hooks/useNotify';
import AppDialog from '../components/dialogs/AppDialog';
import AppTableContainer from '../components/table/AppTableContainer';
import SortableTableHead from '../components/table/SortableTableHead';
import RowActions from '../components/table/RowActions';
import { MobileCard, MobileField } from '../components/table/MobileCard';
import useIsMobile from '../hooks/useIsMobile';

const emptyForm = {
    anio: ''
};

// Columnas de la tabla de ciclos escolares
const CICLO_COLUMNS = [
    { id: 'anio', label: 'Año' },
    { id: 'etiqueta', label: 'Etiqueta' },
    { id: 'estado', label: 'Estado' },
    { id: 'acciones', label: 'Acciones', align: 'right' },
];

const CiclosEscolaresPage = () => {
    const isMobile = useIsMobile();
    const [ciclosEscolares, setCiclosEscolares] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedCiclo, setSelectedCiclo] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const notify = useNotify();

    const fetchCiclosEscolares = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getCiclosEscolares();
            setCiclosEscolares(Array.isArray(data.ciclosEscolares) ? data.ciclosEscolares : []);
        } catch (error) {
            console.error('Error cargando ciclos escolares:', error);
            notify.error('Error al cargar ciclos escolares');
        } finally {
            setLoading(false);
        }
    }, [notify]);

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
            notify.error('Ingresa un año válido entre 2000 y 2100');
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
                notify.success('Ciclo escolar actualizado');
            } else {
                await createCicloEscolar(payload);
                notify.success('Ciclo escolar creado');
            }
            handleCloseDialog();
            fetchCiclosEscolares();
        } catch (error) {
            console.error('Error guardando ciclo escolar:', error);
            notify.fromError(error, 'Error al guardar ciclo escolar');
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (cicloEscolar) => {
        if (!cicloEscolar?.id || cicloEscolar.predeterminado) {
            return;
        }
        setSaving(true);
        try {
            const data = await setDefaultCicloEscolar(cicloEscolar.id);
            const defaultCycle = data.cicloEscolar || cicloEscolar;
            setSelectedCicloEscolarId(defaultCycle.id);
            notify.success('Ciclo escolar predeterminado actualizado');
            fetchCiclosEscolares();
        } catch (error) {
            console.error('Error marcando ciclo escolar predeterminado:', error);
            notify.fromError(error, 'Error al actualizar ciclo predeterminado');
        } finally {
            setSaving(false);
        }
    };

    // Acciones por fila: editar y marcar como predeterminado, con los mismos permisos de antes.
    const rowActions = (cicloEscolar) => [
        { key: 'edit', kind: 'edit', label: 'Editar', icon: <Edit fontSize="small" />, permission: 'ciclos-escolares-editar', onClick: () => handleOpenEdit(cicloEscolar) },
        {
            key: 'default',
            label: 'Marcar como predeterminado',
            tooltip: cicloEscolar.predeterminado ? 'Ya es predeterminado' : 'Marcar como predeterminado',
            // Como antes: azul en el predeterminado (aunque el botón esté deshabilitado) y gris en los demás.
            icon: <Star fontSize="small" sx={{ color: cicloEscolar.predeterminado ? 'primary.main' : 'text.secondary' }} />,
            permission: 'ciclos-escolares-activar',
            disabled: cicloEscolar.predeterminado || saving,
            onClick: () => handleSetDefault(cicloEscolar),
        },
    ];

    return (
        <PageContainer width="md">
            <PageHeader
                variant="hero"
                tone="school"
                icon={CalendarToday}
                title="Ciclos Escolares"
                subtitle="Administra ciclos habilitados por colegio. El predeterminado se usa como selección inicial."
                actions={[{ key: 'add', label: 'Nuevo ciclo', icon: <Add />, primary: true, permission: 'ciclos-escolares-crear', onClick: handleOpenCreate }]}
            />

            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <CircularProgress />
                        </Box>
                    ) : isMobile ? (
                        <Box>
                            {ciclosEscolares.map((cicloEscolar) => (
                                <MobileCard key={cicloEscolar.id} actions={<RowActions actions={rowActions(cicloEscolar)} />}>
                                    <MobileField label="Año">{cicloEscolar.anio}</MobileField>
                                    <MobileField label="Etiqueta">{`Ciclo Escolar ${cicloEscolar.anio}`}</MobileField>
                                    {cicloEscolar.predeterminado && (
                                        <MobileField label="Estado">
                                            <Chip label="Predeterminado" color="primary" size="small" />
                                        </MobileField>
                                    )}
                                </MobileCard>
                            ))}
                            {ciclosEscolares.length === 0 && (
                                <Typography align="center" color="text.secondary">No hay ciclos escolares configurados.</Typography>
                            )}
                        </Box>
                    ) : (
                        <AppTableContainer>
                            <Table>
                                <SortableTableHead columns={CICLO_COLUMNS} />
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
                                                <RowActions actions={rowActions(cicloEscolar)} />
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
                        </AppTableContainer>
                    )}
                </CardContent>
            </Card>

            <AppDialog
                open={openDialog}
                onClose={handleCloseDialog}
                title={selectedCiclo ? 'Editar ciclo escolar' : 'Nuevo ciclo escolar'}
                size="sm"
                onSubmit={handleSave}
                submitLabel="Guardar"
                submitting={saving}
                contentSx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}
            >
                <TextField name="anio" label="Año" value={form.anio} onChange={handleChange} slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
                <TextField label="Etiqueta" value={form.anio ? `Ciclo Escolar ${form.anio}` : ''} fullWidth disabled />
            </AppDialog>

        </PageContainer>
    );
};

export default CiclosEscolaresPage;