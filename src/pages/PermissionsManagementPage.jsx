import React, { useState, useEffect, useContext, useMemo, useCallback, memo } from 'react';
import {
    Typography,
    Box,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Snackbar,
    Alert,
    CircularProgress,
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Grid,
    TextField,
    InputAdornment,
    Checkbox,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    ButtonGroup,
    Stack,
    Tabs,
    Tab,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Save as SaveIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    PhoneIphone as PhoneIphoneIcon,
    WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import tw from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import usePermissions from '../hooks/usePermissions';
import CatalogOrganizer from '../components/CatalogOrganizer';

const PageContainer = tw.div`p-8 bg-gray-50 min-h-screen`;

/** Grupo que se muestra aparte: no aplica a quien solo usa el sistema web. */
const GRUPO_MOVIL = 'app-movil';

/** Colores y etiquetas de cada nivel de acción. */
const NIVELES = {
    ver: { label: 'Ver', color: '#0277bd', bg: '#e1f5fe' },
    crear: { label: 'Crear', color: '#2e7d32', bg: '#e8f5e9' },
    editar: { label: 'Editar', color: '#ef6c00', bg: '#fff3e0' },
    eliminar: { label: 'Eliminar', color: '#c62828', bg: '#ffebee' },
};

/** Permite que "gestion" encuentre "gestión" y viceversa. */
const sinAcentos = (texto) =>
    (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Al buscar se expanden los grupos, pero solo si el resultado es manejable. */
const LIMITE_AUTOEXPANDIR = 60;

// Estilos constantes: definidos fuera del render para no recrear el objeto
// en cada pasada, que es lo que invalida la memoización interna de MUI.
const SX_CHIP = { height: 22 };
const SX_FILA_BASE = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    px: 1.5,
    py: 1,
    borderRadius: 1,
};

/**
 * Una fila de permiso.
 *
 * Va memoizada y fuera del componente padre a propósito: con ~360 permisos,
 * definirla dentro hacía que React la tratara como un componente nuevo en cada
 * render y desmontara el árbol completo con cada clic. Solo recibe primitivos,
 * así que al marcar una casilla se vuelve a renderizar únicamente esa fila.
 */
const FilaPermiso = memo(function FilaPermiso({ permiso, activo, cambiado, onToggle }) {
    const nivel = NIVELES[permiso.level] || NIVELES.ver;

    return (
        <Box
            sx={{
                ...SX_FILA_BASE,
                borderLeft: cambiado ? '3px solid #ff9800' : '3px solid transparent',
                bgcolor: activo ? '#f1f8e9' : 'transparent',
                '&:hover': { bgcolor: activo ? '#dcedc8' : '#f5f5f5' },
            }}
        >
            <Checkbox size="small" checked={activo} onChange={() => onToggle(permiso.key)} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                    {permiso.description}
                </Typography>
            </Box>
            {permiso.type === 'modulo' && (
                <Chip size="small" label="Módulo" variant="outlined" sx={SX_CHIP} />
            )}
            <Chip
                size="small"
                label={nivel.label}
                sx={{
                    height: 22,
                    color: nivel.color,
                    bgcolor: nivel.bg,
                    fontWeight: 500,
                    minWidth: 68,
                }}
            />
        </Box>
    );
});

/**
 * Tarjeta de un grupo.
 *
 * El contenido se desmonta al colapsar (`unmountOnExit`): sin eso, MUI mantiene
 * montados los ~360 permisos de los 14 grupos al mismo tiempo.
 */
const TarjetaGrupo = memo(function TarjetaGrupo({
    grupo,
    permissions,
    originalPermissions,
    expandido,
    onExpandir,
    onToggle,
    onAplicar,
    onPedirConfirmacion,
}) {
    const activos = useMemo(
        () => grupo.permissions.reduce((n, p) => n + (permissions[p.key] ? 1 : 0), 0),
        [grupo.permissions, permissions]
    );
    const destructivos = useMemo(
        () => grupo.permissions.filter((p) => p.level === 'eliminar').length,
        [grupo.permissions]
    );

    const total = grupo.permissions.length;
    const todos = activos === total;
    const algunos = activos > 0 && !todos;

    return (
        <Accordion
            expanded={expandido}
            onChange={() => onExpandir(grupo.key)}
            sx={{ mb: 1, boxShadow: 1 }}
            TransitionProps={{ unmountOnExit: true }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
                    <Checkbox
                        checked={todos}
                        indeterminate={algunos}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (todos) onAplicar(grupo, 'ninguno');
                            else onPedirConfirmacion(grupo);
                        }}
                        sx={{ mr: 1 }}
                    />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>{grupo.label}</Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                            {grupo.description}
                        </Typography>
                    </Box>
                    {destructivos > 0 && (
                        <Tooltip title={`${destructivos} permiso(s) que eliminan información`}>
                            <Chip
                                size="small"
                                icon={<WarningAmberIcon />}
                                label={destructivos}
                                sx={{ mr: 1, color: '#c62828', bgcolor: '#ffebee' }}
                            />
                        </Tooltip>
                    )}
                    <Chip
                        size="small"
                        label={`${activos} / ${total}`}
                        color={activos > 0 ? 'success' : 'default'}
                    />
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <ButtonGroup size="small" variant="outlined">
                        <Button onClick={() => onAplicar(grupo, 'lectura')}>Solo lectura</Button>
                        <Button onClick={() => onPedirConfirmacion(grupo)}>Acceso completo</Button>
                        <Button onClick={() => onAplicar(grupo, 'ninguno')}>Sin acceso</Button>
                    </ButtonGroup>
                </Stack>
                <Divider sx={{ mb: 1 }} />
                {grupo.permissions.map((permiso) => (
                    <FilaPermiso
                        key={permiso.key}
                        permiso={permiso}
                        activo={!!permissions[permiso.key]}
                        cambiado={!!permissions[permiso.key] !== !!originalPermissions[permiso.key]}
                        onToggle={onToggle}
                    />
                ))}
            </AccordionDetails>
        </Accordion>
    );
});

const PermissionsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const { hasPermission } = usePermissions();
    const puedeOrganizar = hasPermission('permisos-gestionar-catalogo');

    const [pestana, setPestana] = useState('asignar');
    const [roles, setRoles] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [catalog, setCatalog] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [originalPermissions, setOriginalPermissions] = useState({});
    const [busquedaInput, setBusquedaInput] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [expandidos, setExpandidos] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmacion, setConfirmacion] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showSnackbar = useCallback((message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    // ----------------------------------------------------------------- carga
    useEffect(() => {
        const cargar = async () => {
            try {
                const [resRoles, resCatalogo] = await Promise.all([
                    api.get('/permissions/roles', {
                        headers: { Authorization: `Bearer ${auth?.token}` },
                    }),
                    api.get('/permissions/catalog', {
                        headers: { Authorization: `Bearer ${auth?.token}` },
                    }),
                ]);
                setRoles(resRoles.data.roles || []);
                setCatalog(resCatalogo.data.groups || []);
            } catch (err) {
                console.error('Error al cargar el catálogo de permisos:', err);
                showSnackbar('No se pudo cargar el catálogo de permisos', 'error');
            }
        };
        cargar();
    }, [auth?.token, showSnackbar]);

    useEffect(() => {
        const cargarPermisos = async () => {
            if (!selectedRoleId) {
                setPermissions({});
                setOriginalPermissions({});
                return;
            }
            setIsLoading(true);
            try {
                const res = await api.get(`/permissions/role/${selectedRoleId}`, {
                    headers: { Authorization: `Bearer ${auth?.token}` },
                });
                const recibidos = res.data.permissions || {};
                setPermissions(recibidos);
                setOriginalPermissions(recibidos);
            } catch (err) {
                console.error('Error al obtener permisos:', err);
                showSnackbar('Error al cargar los permisos del rol', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        cargarPermisos();
    }, [selectedRoleId, auth?.token, showSnackbar]);

    // ------------------------------------------------------------- derivados
    const clavesCatalogo = useMemo(
        () => catalog.flatMap((g) => g.permissions.map((p) => p.key)),
        [catalog]
    );

    /** Texto normalizado por permiso, calculado una sola vez por catálogo. */
    const indiceBusqueda = useMemo(() => {
        const indice = new Map();
        for (const grupo of catalog) {
            const etiquetaGrupo = sinAcentos(grupo.label);
            for (const permiso of grupo.permissions) {
                indice.set(permiso.key, `${sinAcentos(permiso.description)} ${etiquetaGrupo}`);
            }
        }
        return indice;
    }, [catalog]);

    const cambios = useMemo(() => {
        const lista = [];
        for (const key of clavesCatalogo) {
            const antes = !!originalPermissions[key];
            const ahora = !!permissions[key];
            if (antes !== ahora) lista.push({ key, ahora });
        }
        return lista;
    }, [clavesCatalogo, permissions, originalPermissions]);

    const hayCambios = cambios.length > 0;

    const gruposFiltrados = useMemo(() => {
        const termino = sinAcentos(busqueda.trim());
        if (!termino) return catalog;
        return catalog
            .map((grupo) => ({
                ...grupo,
                permissions: grupo.permissions.filter((p) =>
                    (indiceBusqueda.get(p.key) || '').includes(termino)
                ),
            }))
            .filter((g) => g.permissions.length > 0);
    }, [catalog, busqueda, indiceBusqueda]);

    const totalFiltrado = useMemo(
        () => gruposFiltrados.reduce((n, g) => n + g.permissions.length, 0),
        [gruposFiltrados]
    );

    const gruposWeb = useMemo(
        () => gruposFiltrados.filter((g) => g.key !== GRUPO_MOVIL),
        [gruposFiltrados]
    );
    const grupoMovil = useMemo(
        () => gruposFiltrados.find((g) => g.key === GRUPO_MOVIL),
        [gruposFiltrados]
    );

    // Al buscar se abren los grupos, salvo que el resultado sea tan amplio que
    // abrirlos signifique montar casi todo el catálogo otra vez.
    useEffect(() => {
        if (!busqueda) {
            setExpandidos({});
            return;
        }
        if (totalFiltrado > LIMITE_AUTOEXPANDIR) return;
        const abiertos = {};
        for (const grupo of gruposFiltrados) abiertos[grupo.key] = true;
        setExpandidos(abiertos);
    }, [busqueda, gruposFiltrados, totalFiltrado]);

    useEffect(() => {
        if (!hayCambios) return undefined;
        const avisar = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', avisar);
        return () => window.removeEventListener('beforeunload', avisar);
    }, [hayCambios]);

    // ------------------------------------------------------------- acciones
    // Todos los handlers van con useCallback y referencias estables: son props
    // de componentes memoizados, y recrearlos anularía la memoización.
    const alternarPermiso = useCallback((key) => {
        setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const alternarExpandido = useCallback((key) => {
        setExpandidos((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    /** La búsqueda se aplica solo al pulsar Buscar o Enter, no al escribir. */
    const ejecutarBusqueda = useCallback(() => {
        setBusqueda(busquedaInput.trim());
    }, [busquedaInput]);

    const limpiarBusqueda = useCallback(() => {
        setBusquedaInput('');
        setBusqueda('');
    }, []);

    const aplicarAGrupo = useCallback((grupo, modo) => {
        setPermissions((prev) => {
            const siguiente = { ...prev };
            for (const permiso of grupo.permissions) {
                if (modo === 'ninguno') siguiente[permiso.key] = false;
                else if (modo === 'lectura') siguiente[permiso.key] = permiso.level === 'ver';
                // 'todo' concede el grupo salvo los permisos destructivos, que se
                // activan uno por uno para que sea una decisión consciente.
                else if (modo === 'todo') siguiente[permiso.key] = permiso.level !== 'eliminar';
            }
            return siguiente;
        });
    }, []);

    /**
     * "Acceso completo" concede mucho de una vez: se confirma antes.
     * Depende de `permissions`, pero TarjetaGrupo ya lo recibe como prop y se
     * vuelve a renderizar igual, así que no se pierde memoización por esto.
     */
    const pedirConfirmacion = useCallback(
        (grupo) => {
            const aConceder = grupo.permissions.filter(
                (p) => p.level !== 'eliminar' && !permissions[p.key]
            );
            if (!aConceder.length) {
                showSnackbar('Este grupo ya tiene concedidos todos esos permisos', 'info');
                return;
            }
            const destructivos = grupo.permissions.filter((p) => p.level === 'eliminar');
            setConfirmacion({ grupo, aConceder, destructivos });
        },
        [permissions, showSnackbar]
    );

    const confirmarAccesoCompleto = useCallback(() => {
        if (!confirmacion) return;
        aplicarAGrupo(confirmacion.grupo, 'todo');
        setConfirmacion(null);
    }, [confirmacion, aplicarAGrupo]);

    const descartarCambios = useCallback(() => {
        setPermissions(originalPermissions);
        showSnackbar('Se descartaron los cambios', 'info');
    }, [originalPermissions, showSnackbar]);

    const guardar = async () => {
        if (!selectedRoleId || !hayCambios) return;
        setIsSaving(true);
        try {
            // Se envían únicamente las claves del catálogo. Las filas heredadas
            // que aún viven en la base no se tocan.
            const aEnviar = {};
            for (const key of clavesCatalogo) aEnviar[key] = !!permissions[key];

            const res = await api.put(
                `/permissions/role/${selectedRoleId}`,
                { permissions: aEnviar },
                { headers: { Authorization: `Bearer ${auth?.token}` } }
            );
            setOriginalPermissions({ ...permissions });
            const { granted = 0, revoked = 0 } = res.data || {};
            showSnackbar(`Permisos guardados: ${granted} concedidos, ${revoked} revocados`);
        } catch (err) {
            console.error('Error al actualizar permisos:', err);
            const detalle = err?.response?.data?.unknownPermissions;
            showSnackbar(
                detalle?.length
                    ? `No se guardó: hay permisos desconocidos (${detalle.slice(0, 3).join(', ')})`
                    : 'Error al guardar los permisos',
                'error'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const rolSeleccionado = roles.find((r) => r.id === selectedRoleId);

    // ---------------------------------------------------------------- render
    return (
        <PageContainer>
            <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 10 }}>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#1a237e', mb: 1 }}>
                        Gestión de Permisos
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#666' }}>
                        {pestana === 'asignar'
                            ? 'Elige un rol y define qué puede hacer dentro del sistema.'
                            : 'Organiza cómo se agrupan y describen los permisos.'}
                    </Typography>
                </Box>

                {puedeOrganizar && (
                    <Tabs
                        value={pestana}
                        onChange={(e, v) => {
                            if (
                                hayCambios &&
                                !window.confirm(
                                    'Hay cambios sin guardar. ¿Cambiar de pestaña y descartarlos?'
                                )
                            ) {
                                return;
                            }
                            if (hayCambios) setPermissions(originalPermissions);
                            setPestana(v);
                        }}
                        sx={{ mb: 3, borderBottom: '1px solid #e0e0e0' }}
                    >
                        <Tab value="asignar" label="Permisos por rol" />
                        <Tab value="organizar" label="Organizar catálogo" />
                    </Tabs>
                )}

                {pestana === 'organizar' && puedeOrganizar && (
                    <CatalogOrganizer onNotify={showSnackbar} />
                )}

                {pestana === 'asignar' && (
                    <>
                        <Card sx={{ mb: 3, boxShadow: 2 }}>
                            <CardContent>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={12} md={5}>
                                        <FormControl fullWidth>
                                            <InputLabel>Seleccionar Rol</InputLabel>
                                            <Select
                                                value={selectedRoleId}
                                                onChange={(e) => {
                                                    if (
                                                        hayCambios &&
                                                        !window.confirm(
                                                            'Hay cambios sin guardar. ¿Cambiar de rol y descartarlos?'
                                                        )
                                                    ) {
                                                        return;
                                                    }
                                                    setSelectedRoleId(e.target.value);
                                                }}
                                                label="Seleccionar Rol"
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
                                    </Grid>
                                    <Grid item xs={12} md={7}>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <TextField
                                                fullWidth
                                                placeholder="Buscar un permiso por lo que hace..."
                                                value={busquedaInput}
                                                onChange={(e) => setBusquedaInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') ejecutarBusqueda();
                                                }}
                                                disabled={!selectedRoleId}
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
                                                disabled={
                                                    !selectedRoleId ||
                                                    busquedaInput.trim() === busqueda
                                                }
                                                sx={{ px: 3, flexShrink: 0 }}
                                            >
                                                Buscar
                                            </Button>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        {isLoading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                                <CircularProgress />
                            </Box>
                        )}

                        {!isLoading && !selectedRoleId && (
                            <Card sx={{ boxShadow: 1 }}>
                                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                                    <Typography sx={{ color: '#888' }}>
                                        Selecciona un rol para ver y configurar sus permisos.
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}

                        {!isLoading && selectedRoleId && (
                            <>
                                {busqueda && !gruposFiltrados.length && (
                                    <Card sx={{ boxShadow: 1, mb: 2 }}>
                                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                            <Typography sx={{ color: '#888' }}>
                                                Ningún permiso coincide con “{busqueda}”.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                )}

                                {busqueda && totalFiltrado > LIMITE_AUTOEXPANDIR && (
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        {totalFiltrado} permisos coinciden. Abre el grupo que te
                                        interese o afina la búsqueda.
                                    </Alert>
                                )}

                                {gruposWeb.map((grupo) => (
                                    <TarjetaGrupo
                                        key={grupo.key}
                                        grupo={grupo}
                                        permissions={permissions}
                                        originalPermissions={originalPermissions}
                                        expandido={!!expandidos[grupo.key]}
                                        onExpandir={alternarExpandido}
                                        onToggle={alternarPermiso}
                                        onAplicar={aplicarAGrupo}
                                        onPedirConfirmacion={pedirConfirmacion}
                                    />
                                ))}

                                {grupoMovil && (
                                    <>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                mt: 4,
                                                mb: 1.5,
                                            }}
                                        >
                                            <PhoneIphoneIcon sx={{ mr: 1, color: '#5e35b1' }} />
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                Aplicación Móvil
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" sx={{ color: '#666', mb: 1.5 }}>
                                            Estos permisos solo afectan a la app de pilotos,
                                            monitoras, supervisores y auxiliares. No cambian nada en
                                            el sistema web.
                                        </Typography>
                                        <TarjetaGrupo
                                            grupo={grupoMovil}
                                            permissions={permissions}
                                            originalPermissions={originalPermissions}
                                            expandido={!!expandidos[grupoMovil.key]}
                                            onExpandir={alternarExpandido}
                                            onToggle={alternarPermiso}
                                            onAplicar={aplicarAGrupo}
                                            onPedirConfirmacion={pedirConfirmacion}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </Box>

            {/* Barra fija de guardado: solo aparece cuando hay algo que guardar. */}
            {hayCambios && pestana === 'asignar' && (
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: '#fff',
                        borderTop: '1px solid #e0e0e0',
                        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
                        px: 4,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        zIndex: 1200,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Chip
                            label={`${cambios.length} cambio${cambios.length === 1 ? '' : 's'} sin guardar`}
                            sx={{ bgcolor: '#fff3e0', color: '#ef6c00', fontWeight: 600 }}
                        />
                        <Typography variant="body2" sx={{ color: '#666' }}>
                            {cambios.filter((c) => c.ahora).length} por conceder,{' '}
                            {cambios.filter((c) => !c.ahora).length} por revocar
                            {rolSeleccionado ? ` · rol ${rolSeleccionado.name}` : ''}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button onClick={descartarCambios} disabled={isSaving}>
                            Descartar
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={
                                isSaving ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    <SaveIcon />
                                )
                            }
                            onClick={guardar}
                            disabled={isSaving}
                            sx={{ px: 3, bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
                        >
                            {isSaving ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </Box>
                </Box>
            )}

            <Dialog
                open={!!confirmacion}
                onClose={() => setConfirmacion(null)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Conceder acceso completo</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Se van a conceder <strong>{confirmacion?.aConceder.length}</strong> permisos
                        del grupo <strong>{confirmacion?.grupo.label}</strong>
                        {rolSeleccionado ? ` al rol ${rolSeleccionado.name}` : ''}:
                    </DialogContentText>
                    <Box
                        sx={{
                            maxHeight: 260,
                            overflowY: 'auto',
                            bgcolor: '#fafafa',
                            borderRadius: 1,
                            p: 1.5,
                        }}
                    >
                        {confirmacion?.aConceder.map((p) => (
                            <Typography key={p.key} variant="body2" sx={{ py: 0.3 }}>
                                • {p.description}
                            </Typography>
                        ))}
                    </Box>
                    {!!confirmacion?.destructivos.length && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            {confirmacion.destructivos.length} permiso(s) de este grupo eliminan
                            información y <strong>no</strong> se conceden aquí. Si hacen falta,
                            actívalos uno por uno.
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmacion(null)}>Cancelar</Button>
                    <Button variant="contained" onClick={confirmarAccesoCompleto}>
                        Conceder
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default PermissionsManagementPage;
