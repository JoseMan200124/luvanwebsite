// src/components/school/NivelesEducativosModal.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    Paper, Snackbar, Alert, Stack, TextField, Typography, CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, DragIndicator } from '@mui/icons-material';
import {
    listEducationLevels, createEducationLevel, updateEducationLevel,
    deleteEducationLevel, getEducationLevelUsage,
} from '../../services/educationLevelsService';

/**
 * Gestión del catálogo de niveles educativos del sistema. Se abre desde el
 * botón "Opciones Extra" de CicloEscolarSelectionPage. Los grados que componen
 * cada nivel se asignan por colegio, en "Editar Colegio".
 *
 * El orden se cambia arrastrando cada fila (drag & drop nativo, sin librería).
 */
const NivelesEducativosModal = ({ open, onClose }) => {
    const [levels, setLevels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);   // null | { id?, name }
    const [deleting, setDeleting] = useState(null); // null | { level, usage }
    const [reordering, setReordering] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dragFromRef = useRef(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setLevels(await listEducationLevels());
        } catch (err) {
            console.error('[NivelesEducativos] Error cargando niveles:', err);
            setSnackbar({ open: true, message: 'No se pudieron cargar los niveles.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    const handleSaveLevel = async () => {
        const name = String(editing?.name || '').trim();
        if (!name) {
            setSnackbar({ open: true, message: 'El nombre es requerido.', severity: 'error' });
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
            setSnackbar({ open: true, message: 'Nivel guardado.', severity: 'success' });
        } catch (err) {
            setSnackbar({
                open: true,
                message: err?.response?.data?.message || 'Error al guardar el nivel.',
                severity: 'error',
            });
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
        if (from === null || from === targetIndex) return;

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
            setSnackbar({ open: true, message: 'No se pudo guardar el nuevo orden.', severity: 'error' });
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
            setSnackbar({ open: true, message: 'Nivel eliminado.', severity: 'success' });
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al eliminar el nivel.', severity: 'error' });
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
                            draggable={!reordering}
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
                                cursor: reordering ? 'default' : 'grab',
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
                            <IconButton
                                size="small"
                                onClick={() => setEditing({ id: level.id, name: level.name })}
                            >
                                <Edit fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => openDelete(level)}>
                                <Delete fontSize="small" />
                            </IconButton>
                        </Paper>
                    );
                })}
            </Stack>
        );
    }

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Niveles educativos</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary">
                            Catálogo del sistema. Arrastra cada fila para cambiar el orden. Los grados de cada nivel se definen en cada colegio, en "Editar Colegio".
                        </Typography>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<Add />}
                            onClick={() => setEditing({ name: '' })}
                        >
                            Nuevo nivel
                        </Button>
                    </Box>

                    {levelsList}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{editing?.id ? 'Editar nivel' : 'Nuevo nivel'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField
                        label="Nombre"
                        size="small"
                        value={editing?.name || ''}
                        onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                        autoFocus
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditing(null)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveLevel}>Guardar</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Eliminar nivel</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Se eliminará el nivel <strong>{deleting?.level?.name}</strong>.
                    </Typography>
                    {(deleting?.usage?.count ?? 0) > 0 && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            {deleting.usage.count} colegio(s) tienen grados asignados a este nivel.
                            Esas asignaciones se perderán.
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)}>Cancelar</Button>
                    <Button color="error" variant="contained" onClick={handleDelete}>Eliminar</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default NivelesEducativosModal;
