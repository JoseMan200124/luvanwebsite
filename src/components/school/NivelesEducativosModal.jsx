// src/components/school/NivelesEducativosModal.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box, Button, IconButton,
    Paper, Alert, Stack, TextField, Typography, CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, DragIndicator, School } from '@mui/icons-material';
import {
    listEducationLevels, createEducationLevel, updateEducationLevel,
    deleteEducationLevel, getEducationLevelUsage,
} from '../../services/educationLevelsService';
import PermissionGuard from '../PermissionGuard';
import usePermissions from '../../hooks/usePermissions';
import useNotify from '../../hooks/useNotify';
import AppDialog from '../dialogs/AppDialog';

/**
 * Gestión del catálogo de niveles educativos del sistema. Se abre desde el
 * botón "Opciones Extra" de CicloEscolarSelectionPage. Los grados que componen
 * cada nivel se asignan por colegio, en "Editar Colegio".
 *
 * El orden se cambia arrastrando cada fila (drag & drop nativo, sin librería).
 */
const NivelesEducativosModal = ({ open, onClose }) => {
    const { hasPermission } = usePermissions();
    // Reordenar arrastrando hace PUT /education-levels/:id, igual que editar.
    const puedeEditarNiveles = hasPermission('niveles-editar');
    const [levels, setLevels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);   // null | { id?, name }
    const [deleting, setDeleting] = useState(null); // null | { level, usage }
    const [reordering, setReordering] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dragFromRef = useRef(null);
    const notify = useNotify();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setLevels(await listEducationLevels());
        } catch (err) {
            console.error('[NivelesEducativos] Error cargando niveles:', err);
            notify.error('No se pudieron cargar los niveles');
        } finally {
            setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        if (open) {
            load();
        }
    }, [open, load]);

    const handleSaveLevel = async () => {
        const name = String(editing?.name || '').trim();
        if (!name) {
            notify.error('El nombre es requerido');
            return;
        }
        try {
            if (editing.id) {
                await updateEducationLevel(editing.id, { name });
            } else {
                // El nivel nuevo entra al final; el orden se ajusta arrastrando.
                await createEducationLevel({ name, order: levels.length + 1 });
            }
            setEditing(null);
            await load();
            notify.success('Nivel guardado');
        } catch (err) {
            notify.fromError(err, 'Error al guardar el nivel.');
        }
    };

    const resetDrag = () => {
        dragFromRef.current = null;
        setDragIndex(null);
        setDragOverIndex(null);
    };

    /**
     * Suelta el nivel arrastrado en la posición `targetIndex`. Renumera todo
     * optimista y persiste las filas cuyo lugar cambió; si algo falla, recarga
     * el estado del servidor.
     */
    const handleDrop = async (targetIndex) => {
        const from = dragFromRef.current;
        resetDrag();
        if (from === null || from === targetIndex) {
            return;
        }

        const before = levels;
        const reordered = [...before];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(targetIndex, 0, moved);
        const withOrder = reordered.map((level, i) => ({ ...level, order: i + 1 }));

        setLevels(withOrder);
        setReordering(true);
        try {
            const changed = withOrder.filter((level, i) => before[i]?.id !== level.id);
            await Promise.all(changed.map((level) => updateEducationLevel(level.id, { order: level.order })));
        } catch (err) {
            notify.error('No se pudo guardar el nuevo orden');
            await load();
        } finally {
            setReordering(false);
        }
    };

    const openDelete = async (level) => {
        try {
            const usage = await getEducationLevelUsage(level.id);
            setDeleting({ level, usage });
        } catch (err) {
            // Sin el conteo igual se puede borrar; solo se pierde la advertencia.
            setDeleting({ level, usage: { count: 0, schools: [] } });
        }
    };

    const handleDelete = async () => {
        try {
            await deleteEducationLevel(deleting.level.id);
            setDeleting(null);
            await load();
            notify.success('Nivel eliminado');
        } catch (err) {
            notify.error('Error al eliminar el nivel');
        }
    };

    let levelsList;
    if (loading) {
        levelsList = (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Cargando niveles...</Typography>
            </Box>
        );
    } else if (levels.length === 0) {
        levelsList = (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No hay niveles registrados.
            </Typography>
        );
    } else {
        levelsList = (
            <Stack spacing={1}>
                {levels.map((level, index) => {
                    const isOver = dragOverIndex === index && dragIndex !== index;
                    return (
                        <Paper
                            key={level.id}
                            variant="outlined"
                            draggable={!reordering && puedeEditarNiveles}
                            onDragStart={(e) => {
                                dragFromRef.current = index;
                                setDragIndex(index);
                                e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnter={() => setDragOverIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(index)}
                            onDragEnd={resetDrag}
                            sx={{
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                cursor: (reordering || !puedeEditarNiveles) ? 'default' : 'grab',
                                opacity: dragIndex === index ? 0.4 : 1,
                                borderTop: isOver ? '2px solid' : '1px solid',
                                borderTopColor: isOver ? 'primary.main' : 'divider',
                                transition: 'opacity 0.15s',
                            }}
                        >
                            <DragIndicator fontSize="small" sx={{ color: 'text.disabled' }} />
                            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 20, textAlign: 'right' }}>
                                {index + 1}
                            </Typography>
                            <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                {level.name}
                            </Typography>
                            <PermissionGuard permission="niveles-editar">
                                <IconButton
                                    size="small"
                                    onClick={() => setEditing({ id: level.id, name: level.name })}
                                >
                                    <Edit fontSize="small" />
                                </IconButton>
                            </PermissionGuard>
                            <PermissionGuard permission="niveles-eliminar">
                                <IconButton size="small" color="error" onClick={() => openDelete(level)}>
                                    <Delete fontSize="small" />
                                </IconButton>
                            </PermissionGuard>
                        </Paper>
                    );
                })}
            </Stack>
        );
    }

    return (
        <>
            <AppDialog
                open={open}
                onClose={onClose}
                title="Niveles educativos"
                icon={<School />}
                size="sm"
                readOnly
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary">
                        Catálogo del sistema. Arrastra cada fila para cambiar el orden. Los grados de cada nivel se definen en cada colegio, en "Editar Colegio".
                    </Typography>
                    <PermissionGuard permission="niveles-crear">
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<Add />}
                            onClick={() => setEditing({ name: '' })}
                        >
                            Nuevo nivel
                        </Button>
                    </PermissionGuard>
                </Box>

                {levelsList}
            </AppDialog>

            <AppDialog
                open={Boolean(editing)}
                onClose={() => setEditing(null)}
                title={editing?.id ? 'Editar nivel' : 'Nuevo nivel'}
                size="xs"
                onSubmit={handleSaveLevel}
                submitLabel="Guardar"
                readOnly={!(hasPermission(editing?.id ? 'niveles-editar' : 'niveles-crear'))}
                contentSx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}
            >
                <TextField
                    label="Nombre"
                    size="small"
                    value={editing?.name || ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                    autoFocus
                />
            </AppDialog>

            <AppDialog
                open={Boolean(deleting)}
                onClose={() => setDeleting(null)}
                title="Eliminar nivel"
                icon={<Delete />}
                tone="danger"
                size="xs"
                onSubmit={handleDelete}
                submitLabel="Eliminar"
                readOnly={!hasPermission('niveles-eliminar')}
            >
                <Typography variant="body2">
                    Se eliminará el nivel <strong>{deleting?.level?.name}</strong>.
                </Typography>
                {(deleting?.usage?.count ?? 0) > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        {deleting.usage.count} colegio(s) tienen grados asignados a este nivel.
                        Esas asignaciones se perderán.
                    </Alert>
                )}
            </AppDialog>

        </>
    );
};

export default NivelesEducativosModal;
