import React, { useState, useEffect, useCallback, useContext, useMemo, memo } from 'react';
import {
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Tooltip,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Switch,
    Stack,
    Alert,
    InputAdornment,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

const NIVELES = [
    { value: 'ver', label: 'Ver' },
    { value: 'crear', label: 'Crear' },
    { value: 'editar', label: 'Editar' },
    { value: 'eliminar', label: 'Eliminar' },
];

const sinAcentos = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SX_CHIP = { height: 22 };
const SX_CLAVE = { color: '#999', fontFamily: 'monospace' };

/**
 * Fila de un permiso dentro de su categoría.
 *
 * Memoizada y fuera del componente padre: el catálogo trae más de 400 permisos
 * (aquí se piden también los ocultos), y definirla dentro hacía que React
 * remontara la lista entera con cada interacción.
 */
const FilaCatalogo = memo(function FilaCatalogo({ permiso, grupoKey, onAlternarVisible, onEditar }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1,
                py: 0.8,
                borderRadius: 1,
                opacity: permiso.visible ? 1 : 0.5,
                '&:hover': { bgcolor: '#f5f5f5' },
            }}
        >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2">{permiso.description}</Typography>
                <Typography variant="caption" sx={SX_CLAVE}>
                    {permiso.key}
                </Typography>
            </Box>
            <Chip size="small" label={permiso.level} variant="outlined" sx={SX_CHIP} />
            {permiso.type === 'modulo' && (
                <Chip size="small" label="Módulo" variant="outlined" sx={SX_CHIP} />
            )}
            <Tooltip title={permiso.visible ? 'Visible al asignar' : 'Oculto al asignar'}>
                <Switch
                    size="small"
                    checked={permiso.visible}
                    onChange={() => onAlternarVisible(permiso)}
                />
            </Tooltip>
            <IconButton size="small" onClick={() => onEditar(permiso, grupoKey)}>
                <EditIcon fontSize="small" />
            </IconButton>
        </Box>
    );
});

/**
 * Organiza el catálogo de permisos: categorías, descripciones y visibilidad.
 * Todo se guarda en la base, así que no hace falta tocar código para cambiarlo.
 */
const CatalogOrganizer = ({ onNotify }) => {
    const { auth } = useContext(AuthContext);
    const cabeceras = useMemo(
        () => ({ headers: { Authorization: `Bearer ${auth?.token}` } }),
        [auth?.token]
    );

    const [categorias, setCategorias] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [busquedaInput, setBusquedaInput] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [expandidos, setExpandidos] = useState({});
    const [dialogoCategoria, setDialogoCategoria] = useState(null);
    const [dialogoPermiso, setDialogoPermiso] = useState(null);
    const [guardando, setGuardando] = useState(false);

    /** La búsqueda se aplica solo al pulsar Buscar o Enter, no al escribir. */
    const ejecutarBusqueda = useCallback(() => {
        setBusqueda(busquedaInput.trim());
    }, [busquedaInput]);

    const limpiarBusqueda = useCallback(() => {
        setBusquedaInput('');
        setBusqueda('');
    }, []);

    const alternarExpandido = useCallback((key) => {
        setExpandidos((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const abrirDialogoPermiso = useCallback((permiso, grupoKey) => {
        setDialogoPermiso({ ...permiso, categoryKey: grupoKey });
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [resCat, resCatalogo] = await Promise.all([
                api.get('/permissions/categories', cabeceras),
                api.get('/permissions/catalog?includeHidden=true', cabeceras),
            ]);
            setCategorias(resCat.data.categories || []);
            setGrupos(resCatalogo.data.groups || []);
        } catch (err) {
            console.error('Error al cargar el catálogo:', err);
            onNotify('No se pudo cargar el catálogo', 'error');
        } finally {
            setCargando(false);
        }
    }, [cabeceras, onNotify]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // ------------------------------------------------------------ categorías
    const guardarCategoria = async () => {
        const { id, key, label, description, sortOrder } = dialogoCategoria;
        if (!label?.trim() || (!id && !key?.trim())) {
            onNotify('El nombre y la clave son obligatorios', 'warning');
            return;
        }
        setGuardando(true);
        try {
            if (id) {
                await api.put(`/permissions/categories/${id}`, { label, description, sortOrder }, cabeceras);
                onNotify('Categoría actualizada');
            } else {
                await api.post('/permissions/categories', { key, label, description, sortOrder }, cabeceras);
                onNotify('Categoría creada');
            }
            setDialogoCategoria(null);
            await cargar();
        } catch (err) {
            onNotify(err?.response?.data?.message || 'No se pudo guardar la categoría', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const eliminarCategoria = async (categoria) => {
        const aviso =
            categoria.permissionCount > 0
                ? `"${categoria.label}" tiene ${categoria.permissionCount} permiso(s). Se moverán a "Sin clasificar". ¿Continuar?`
                : `¿Eliminar la categoría "${categoria.label}"?`;
        if (!window.confirm(aviso)) return;
        try {
            const res = await api.delete(`/permissions/categories/${categoria.id}`, cabeceras);
            onNotify(
                res.data.movedPermissions
                    ? `Categoría eliminada. ${res.data.movedPermissions} permiso(s) movidos a Sin clasificar.`
                    : 'Categoría eliminada'
            );
            await cargar();
        } catch (err) {
            onNotify(err?.response?.data?.message || 'No se pudo eliminar', 'error');
        }
    };

    // -------------------------------------------------------------- permisos
    const guardarPermiso = async () => {
        const { key, description, categoryKey, level, visible } = dialogoPermiso;
        setGuardando(true);
        try {
            await api.put(
                `/permissions/catalog/${key}`,
                { description, categoryKey, level, visibleInFrontend: visible },
                cabeceras
            );
            onNotify('Permiso actualizado');
            setDialogoPermiso(null);
            await cargar();
        } catch (err) {
            onNotify(err?.response?.data?.message || 'No se pudo guardar el permiso', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const alternarVisibilidad = useCallback(async (permiso) => {
        try {
            await api.put(
                `/permissions/catalog/${permiso.key}`,
                { visibleInFrontend: !permiso.visible },
                cabeceras
            );
            await cargar();
        } catch (err) {
            onNotify('No se pudo cambiar la visibilidad', 'error');
        }
    }, [cabeceras, cargar, onNotify]);

    // ------------------------------------------------------------ derivados
    const gruposFiltrados = useMemo(() => {
        const t = sinAcentos(busqueda.trim());
        if (!t) return grupos;
        return grupos
            .map((g) => ({
                ...g,
                permissions: g.permissions.filter(
                    (p) => sinAcentos(p.description).includes(t) || sinAcentos(p.key).includes(t)
                ),
            }))
            .filter((g) => g.permissions.length > 0);
    }, [grupos, busqueda]);

    if (cargando) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <Alert severity="info" sx={{ mb: 2 }}>
                Los cambios se guardan en la base de datos y se aplican de inmediato. Ocultar un
                permiso solo lo quita de la pantalla de asignación: <strong>no</strong> cambia quién
                tiene acceso.
            </Alert>

            <Card sx={{ mb: 3, boxShadow: 2 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                            Categorías
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() =>
                                setDialogoCategoria({ key: '', label: '', description: '', sortOrder: 500 })
                            }
                        >
                            Nueva categoría
                        </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={1}>
                        {categorias.map((c) => (
                            <Box
                                key={c.id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    p: 1.5,
                                    borderRadius: 1,
                                    bgcolor: '#fafafa',
                                }}
                            >
                                <Chip size="small" label={c.sortOrder} sx={{ minWidth: 52 }} />
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontWeight: 600 }}>{c.label}</Typography>
                                        {c.isSystem && (
                                            <Tooltip title="Categoría del sistema: no se puede eliminar">
                                                <LockIcon sx={{ fontSize: 15, color: '#999' }} />
                                            </Tooltip>
                                        )}
                                    </Box>
                                    <Typography variant="caption" sx={{ color: '#666' }}>
                                        {c.description || 'Sin descripción'}
                                    </Typography>
                                </Box>
                                <Chip size="small" label={`${c.permissionCount} permisos`} />
                                <IconButton size="small" onClick={() => setDialogoCategoria({ ...c })}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    disabled={c.isSystem}
                                    onClick={() => eliminarCategoria(c)}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ))}
                    </Stack>
                </CardContent>
            </Card>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Buscar un permiso por descripción o clave..."
                    value={busquedaInput}
                    onChange={(e) => setBusquedaInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') ejecutarBusqueda();
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                        endAdornment: (busquedaInput || busqueda) && (
                            <InputAdornment position="end">
                                <Tooltip title="Limpiar búsqueda">
                                    <Button
                                        size="small"
                                        onClick={limpiarBusqueda}
                                        sx={{ minWidth: 0 }}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </Button>
                                </Tooltip>
                            </InputAdornment>
                        ),
                    }}
                />
                <Button
                    variant="contained"
                    onClick={ejecutarBusqueda}
                    disabled={busquedaInput.trim() === busqueda}
                    sx={{ px: 3, flexShrink: 0 }}
                >
                    Buscar
                </Button>
            </Box>

            {gruposFiltrados.map((grupo) => (
                <Accordion
                    key={grupo.key}
                    sx={{ mb: 1 }}
                    expanded={!!expandidos[grupo.key]}
                    onChange={() => alternarExpandido(grupo.key)}
                    TransitionProps={{ unmountOnExit: true }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
                            <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{grupo.label}</Typography>
                            <Chip size="small" label={`${grupo.permissions.length}`} />
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        {grupo.permissions.map((p) => (
                            <FilaCatalogo
                                key={p.key}
                                permiso={p}
                                grupoKey={grupo.key}
                                onAlternarVisible={alternarVisibilidad}
                                onEditar={abrirDialogoPermiso}
                            />
                        ))}
                    </AccordionDetails>
                </Accordion>
            ))}

            {/* ---------------------------------------------- diálogo categoría */}
            <Dialog open={!!dialogoCategoria} onClose={() => setDialogoCategoria(null)} maxWidth="sm" fullWidth>
                <DialogTitle>{dialogoCategoria?.id ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {!dialogoCategoria?.id && (
                            <TextField
                                label="Clave"
                                helperText="Solo minúsculas, números y guiones. No se puede cambiar después."
                                value={dialogoCategoria?.key || ''}
                                onChange={(e) =>
                                    setDialogoCategoria((d) => ({ ...d, key: e.target.value }))
                                }
                                fullWidth
                            />
                        )}
                        <TextField
                            label="Nombre visible"
                            value={dialogoCategoria?.label || ''}
                            onChange={(e) => setDialogoCategoria((d) => ({ ...d, label: e.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label="Descripción"
                            multiline
                            rows={2}
                            value={dialogoCategoria?.description || ''}
                            onChange={(e) =>
                                setDialogoCategoria((d) => ({ ...d, description: e.target.value }))
                            }
                            fullWidth
                        />
                        <TextField
                            label="Orden"
                            type="number"
                            helperText="Menor número aparece primero"
                            value={dialogoCategoria?.sortOrder ?? 0}
                            onChange={(e) =>
                                setDialogoCategoria((d) => ({ ...d, sortOrder: Number(e.target.value) }))
                            }
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogoCategoria(null)}>Cancelar</Button>
                    <Button variant="contained" onClick={guardarCategoria} disabled={guardando}>
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ------------------------------------------------ diálogo permiso */}
            <Dialog open={!!dialogoPermiso} onClose={() => setDialogoPermiso(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Editar permiso</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Clave"
                            value={dialogoPermiso?.key || ''}
                            disabled
                            helperText="La define el código; no se puede cambiar desde aquí."
                            fullWidth
                        />
                        <TextField
                            label="Descripción"
                            multiline
                            rows={2}
                            helperText="Lo que verá quien asigna permisos. Describí qué permite hacer."
                            value={dialogoPermiso?.description || ''}
                            onChange={(e) =>
                                setDialogoPermiso((d) => ({ ...d, description: e.target.value }))
                            }
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Categoría</InputLabel>
                            <Select
                                label="Categoría"
                                value={dialogoPermiso?.categoryKey || ''}
                                onChange={(e) =>
                                    setDialogoPermiso((d) => ({ ...d, categoryKey: e.target.value }))
                                }
                            >
                                {categorias.map((c) => (
                                    <MenuItem key={c.key} value={c.key}>
                                        {c.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Nivel</InputLabel>
                            <Select
                                label="Nivel"
                                value={dialogoPermiso?.level || 'ver'}
                                onChange={(e) => setDialogoPermiso((d) => ({ ...d, level: e.target.value }))}
                            >
                                {NIVELES.map((n) => (
                                    <MenuItem key={n.value} value={n.value}>
                                        {n.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {dialogoPermiso?.level === 'eliminar' && (
                            <Alert severity="warning">
                                Los permisos de nivel <strong>Eliminar</strong> quedan excluidos del
                                botón “Acceso completo” y hay que concederlos uno por uno.
                            </Alert>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Switch
                                checked={!!dialogoPermiso?.visible}
                                onChange={(e) =>
                                    setDialogoPermiso((d) => ({ ...d, visible: e.target.checked }))
                                }
                            />
                            <Typography variant="body2">
                                Mostrar en la pantalla de asignación de permisos
                            </Typography>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogoPermiso(null)}>Cancelar</Button>
                    <Button variant="contained" onClick={guardarPermiso} disabled={guardando}>
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default CatalogOrganizer;
