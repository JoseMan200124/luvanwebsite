// src/pages/BusesManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableRow,
    TextField,
    IconButton,
    Tooltip,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    Link,
    Box,
    FormControlLabel,
    Switch
} from '@mui/material';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import {
    Edit,
    Delete,
    Add,
    InsertDriveFile,
    Image as ImageIcon,
    DirectionsBus as DirectionsBusIcon
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { getCiclosEscolares } from '../services/cicloEscolarService';
import usePermissions from '../hooks/usePermissions';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import { matchSearchTokens } from '../utils/clientFilter';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import { validate, hasErrors, focusFirstError, clearError } from '../utils/validators';
import useTableState from '../hooks/useTableState';
import useIsMobile from '../hooks/useIsMobile';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import { MobileCard, MobileField } from '../components/table/MobileCard';
import RowActions from '../components/table/RowActions';
import { sortRows } from '../utils/tableSort';
import AppDialog from '../components/dialogs/AppDialog';
import BulkUploadDialog from '../components/dialogs/BulkUploadDialog';
import FileField from '../components/form/FileField';
import { buildWorkbook } from '../utils/excel';
import { loadCatalog, invalidateCatalog } from '../services/catalogStore';

// Campos obligatorios del formulario de bus.
const BUS_RULES = { plate: ['required'] };

const AVAILABILITY_OPTIONS = [
    { value: 'assigned', label: 'Asignados' },
    { value: 'unassigned', label: 'Sin asignar' },
];
const WORKSHOP_OPTIONS = [
    { value: 'in', label: 'En taller' },
    { value: 'out', label: 'Disponible' },
    { value: 'decommissioned', label: 'Dado de baja' },
];

// Plantilla de la carga masiva de buses.
const buildBusesTemplate = () => buildWorkbook({
    sheets: [{
        name: 'Buses',
        columns: [
            { header: 'Placa', key: 'placa' },
            { header: 'Capacidad', key: 'capacidad' },
            { header: 'Descripción', key: 'descripcion' },
        ],
        rows: [{ placa: 'PlacaEjemplo', capacidad: 40, descripcion: 'Descripción de ejemplo. Esta fila es solo un ejemplo.' }],
    }],
});

// Columnas de la tabla de buses
const COLUMNS = [
    { id: 'plate', label: 'Placa', sortable: true },
    { id: 'capacity', label: 'Capacidad', sortable: true },
    { id: 'description', label: 'Descripción', sortable: true },
    { id: 'totalDistanceTraveled', label: 'Km acumulados', sortable: true },
    { id: 'assignment', label: 'Asignación' },
    { id: 'status', label: 'Estado' },
    { id: 'files', label: 'Archivos', width: 200 },
    { id: 'actions', label: 'Acciones', align: 'center' },
];

function getFieldValue(bus, field) {
    switch (field) {
        case 'plate':
            return bus.plate;
        case 'capacity':
            return bus.capacity;
        case 'description':
            return bus.description;
        case 'totalDistanceTraveled':
            return Number(bus.totalDistanceTraveled) || 0;
        default:
            return '';
    }
}

// Devuelve una cadena representando la asignación del bus (colegio/corporación y número de ruta)
function getAssignmentText(bus) {
    if (!bus) {
        return 'Sin asignar';
    }
    const schoolName =
        bus.school?.name || bus.corporation?.name || '';
    const routeNumber = bus.routeNumber || bus.route || bus.route_num || '';
    if (!schoolName && !routeNumber) {
        return 'Sin asignar';
    }
    if (schoolName && routeNumber) {
        return `${schoolName} — Ruta ${routeNumber}`;
    }
    if (schoolName) {
        return schoolName;
    }
    return `Ruta ${routeNumber}`;
}

const BusesManagementPage = () => {
    const isMobile = useIsMobile();
    const { hasPermission } = usePermissions();
    const notify = useNotify();
    const confirm = useConfirm();

    const { auth } = useContext(AuthContext);

    const [buses, setBuses] = useState([]);
    const [selectedBus, setSelectedBus] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [busErrors, setBusErrors] = useState({});
    const [savingBus, setSavingBus] = useState(false);

    // Paginación y ordenamiento
    const table = useTableState();
    const [loading, setLoading] = useState(false);

    // Removed: Assignment-related state variables (pilots, monitors, schools, route numbers)
    // BusesManagementPage now only handles basic bus fleet management

    // Carga masiva
    const [bulkOpen, setBulkOpen] = useState(false);

    // =================== Efectos y funciones ===================

    const fetchBuses = async () => {
        invalidateCatalog('buses');
        setLoading(true);
        try {
            const response = await api.get('/buses?includeDecommissioned=true', {
                skipSchoolCycleContext: true,
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const data = response.data;
            setBuses(Array.isArray(data.buses) ? data.buses : []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching buses:', err);
            notify.fromError(err, 'Error al obtener los buses');
            setLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch buses at mount
        fetchBuses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.token]);

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchBuses();
    }, [fetchBuses]);

    // Schedules are now tied to the Bus (school) and are fetched when the bus's school is selected

    // =================== CRUD Buses ===================
    const handleAddBus = () => {
        setSelectedBus({
            plate: '',
            capacity: '',
            description: '',
            files: [],
            inWorkshop: false,
            decommissioned: false
        });
        setBusErrors({});
        setOpenDialog(true);
    };

    const handleEditClick = (bus) => {
        setSelectedBus({
            id: bus.id,
            plate: bus.plate,
            capacity: bus.capacity || '',
            description: bus.description || '',
            files: bus.files || [],
            inWorkshop: bus.inWorkshop || false,
            decommissioned: bus.decommissioned || false,
            school: bus.school || null,
            corporation: bus.corporation || null,
            routeNumber: bus.routeNumber || bus.route || bus.route_num || ''
        });
        setBusErrors({});
        setOpenDialog(true);
    };

    const handleDeleteClick = async (bus) => {
        const ok = await confirm({
            title: 'Eliminar bus',
            message: `Se eliminará el bus ${bus.plate}. Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            onConfirm: () => api.delete(`/buses/${bus.id}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            }),
            errorMessage: 'Error al eliminar el bus',
        });
        if (ok) {
            notify.success('Bus eliminado');
            fetchBuses();
        }
    };

    

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedBus(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setBusErrors((prev) => clearError(prev, name));
        setSelectedBus((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    // FileField ya valida el límite de 5 MB por archivo.
    const handleFileChange = (files) => {
        // Append newly selected files to existing ones so they don't disappear from the list
        setSelectedBus((prev) => {
            const existing = prev?.files ? Array.from(prev.files) : [];
            // Convert FileList to array and filter duplicates by name+size
            const newFiles = Array.from(files).filter((nf) => {
                return !existing.some((ef) => ef.name === nf.name && ef.size === nf.size);
            });
            return {
                ...prev,
                files: [...existing, ...newFiles]
            };
        });
    };

    // Pide confirmación y quita un archivo del bus. Si ya está en el servidor, lo elimina primero de ahí.
    const handleRemoveFile = async (file, index) => {
        if (!file) {
            return;
        }
        const onServer = Boolean(file.id);
        if (onServer && !hasPermission('buses-eliminar-archivo')) {
            notify.warning('No tiene permiso para eliminar archivos del bus');
            return;
        }
        // backend expects a busId in the route: DELETE /buses/:busId/files/:fileId
        if (onServer && !selectedBus?.id) {
            notify.error('No se pudo determinar el bus para eliminar el archivo');
            return;
        }
        const fileLabel = file.fileName ? file.fileName.split('/').pop() : file.name;
        const ok = await confirm({
            title: 'Eliminar archivo',
            message: `Se eliminará el archivo ${fileLabel}.${onServer ? ' Esta acción no se puede deshacer.' : ''}`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            onConfirm: onServer
                ? () => api.delete(`/buses/${selectedBus.id}/files/${file.id}`, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                })
                : undefined,
            errorMessage: 'No se pudo eliminar el archivo en el servidor',
        });
        if (!ok) {
            return;
        }
        if (onServer) {
            notify.success('Archivo eliminado');
            // refresh the buses list so outer view stays in sync
            fetchBuses();
        }

        // Remove locally (works for both existing and newly added files)
        setSelectedBus((prev) => {
            if (!prev) {
                return prev;
            }
            const filesArr = prev.files ? Array.from(prev.files) : [];
            if (typeof index === 'number') {
                filesArr.splice(index, 1);
            } else {
                const idx = filesArr.findIndex((f) => f === file || (f.id && file.id && file.id === f.id));
                if (idx !== -1) {
                    filesArr.splice(idx, 1);
                }
            }
            return { ...prev, files: filesArr };
        });
    };

    const handleSave = async () => {
        const found = validate(selectedBus, BUS_RULES);
        setBusErrors(found);
        if (hasErrors(found)) {
            focusFirstError(found);
            return;
        }
        setSavingBus(true);
        try {
            const formData = new FormData();
            formData.append('plate', selectedBus.plate);
            formData.append('capacity', selectedBus.capacity);
            formData.append('description', selectedBus.description);
            formData.append('inWorkshop', selectedBus.inWorkshop);
            formData.append('decommissioned', selectedBus.decommissioned);

            if (selectedBus.files && selectedBus.files.length > 0) {
                Array.from(selectedBus.files).forEach((file) => {
                    if (!file.id) {
                        formData.append('files', file);
                    }
                });
            }

            if (selectedBus.id) {
                await api.put(`/buses/${selectedBus.id}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`
                    }
                });
                notify.success('Bus actualizado');
            } else {
                await api.post('/buses', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`
                    }
                });
                notify.success('Bus creado');
            }

            fetchBuses();
            handleDialogClose();
        } catch (err) {
            console.error('Error saving bus:', err);
            notify.fromError(err, 'Error al guardar el bus');
        } finally {
            setSavingBus(false);
        }
    };

    // file delete endpoint left intentionally out of UI for now (server API exists). Use bus file deletion via server routes if needed.

    // =================== Búsqueda y filtros ===================
    const [clientSchools, setClientSchools] = useState([]);
    const [clientCorporations, setClientCorporations] = useState([]);

    useEffect(() => {
        const loadClients = async () => {
            try {
                const [ciclosData, schoolsList, corpsList] = await Promise.all([
                    getCiclosEscolares(),
                    loadCatalog('schools', { allCycles: true, includeArchived: true }),
                    loadCatalog('corporations', { allCycles: true })
                ]);

                // El selector agrupa los colegios por ciclo: se completa el objeto del ciclo si la respuesta no lo trae
                const ciclosList = ciclosData?.ciclosEscolares || (Array.isArray(ciclosData) ? ciclosData : []);
                const ciclosById = {};
                for (const c of ciclosList) {
                    ciclosById[c.id] = c;
                }


                setClientSchools((Array.isArray(schoolsList) ? schoolsList : [])
                    .filter((school) => school && !school.deleted)
                    .map((school) => ({ ...school, cicloEscolar: school.cicloEscolar || ciclosById[school.cicloEscolarId] })));
                setClientCorporations((Array.isArray(corpsList) ? corpsList : [])
                    .filter((corporation) => corporation && !corporation.deleted));
            } catch (err) {
                console.error('Error loading clients for filters:', err);
            }
        };

        loadClients();
    }, [auth.token]);

    const pageFilters = useFilters({
        fields: [
            F.search('search', { placeholder: 'Placa o descripción' }),
            F.client({ schools: clientSchools, corporations: clientCorporations }),
            F.select('availability', { label: 'Disponibilidad', width: 'sm', options: AVAILABILITY_OPTIONS }),
            F.select('workshop', { label: 'Estado', width: 'sm', options: WORKSHOP_OPTIONS }),
        ],
        onApplied: table.resetPage,
    });
    const {
        search: searchQuery,
        client: clientFilter,
        availability: availabilityFilter,
        workshop: inWorkshopFilter,
    } = pageFilters.applied;

    const filteredBuses = buses.filter((bus) => {
        if (!matchSearchTokens(searchQuery, [bus.plate, bus.description])) {
            return false;
        }

        // Client filter (match both id and type)
        if (clientFilter) {
            if (clientFilter.type === 'school') {
                const s = bus.school;
                if (!s) {
                    return false;
                }
                const sid = s.id || s._id;
                if (String(sid) !== String(clientFilter.id)) {
                    return false;
                }
            } else if (clientFilter.type === 'corp') {
                const c = bus.corporation;
                if (!c) {
                    return false;
                }
                const cid = c.id || c._id;
                if (String(cid) !== String(clientFilter.id)) {
                    return false;
                }
            } else {
                return false;
            }
        }

        // availability: consider a bus 'assigned' if it has school/corporation or route
        const assigned = Boolean(bus.school || bus.corporation || bus.routeNumber || bus.route || bus.route_num);
        if (availabilityFilter === 'assigned' && !assigned) {
            return false;
        }
        if (availabilityFilter === 'unassigned' && assigned) {
            return false;
        }

        // state filter
        if (inWorkshopFilter === 'in' && !bus.inWorkshop) {
            return false;
        }
        if (inWorkshopFilter === 'out' && (bus.inWorkshop || bus.decommissioned)) {
            return false;
        }
        if (inWorkshopFilter === 'decommissioned' && !bus.decommissioned) {
            return false;
        }

        return true;
    });

    // Aplicar ordenamiento y paginación
    const sortedBuses = sortRows(filteredBuses, { orderBy: table.orderBy, order: table.order, getValue: getFieldValue });
    const pageBuses = table.paginate(sortedBuses);

    // Acciones por fila
    const rowActions = (bus) => [
        { key: 'edit', kind: 'edit', label: 'Editar', icon: <Edit fontSize="small" />, permission: 'buses-editar', onClick: () => handleEditClick(bus) },
        { key: 'delete', kind: 'delete', label: 'Eliminar', icon: <Delete fontSize="small" />, permission: 'buses-eliminar', onClick: () => handleDeleteClick(bus) },
    ];

    // =================== RENDER ===================
    const selectedBusHasAssignment = Boolean(
        selectedBus?.school ||
        selectedBus?.corporation ||
        selectedBus?.routeNumber ||
        selectedBus?.route ||
        selectedBus?.route_num
    );

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.buses}
                title="Gestión de Buses"
                actions={[
                    { key: 'bulk', label: 'Carga masiva', group: 'upload', permission: 'buses-carga-masiva', onClick: () => setBulkOpen(true) },
                    { key: 'add', label: 'Añadir bus', icon: <Add />, primary: true, permission: 'buses-crear', onClick: handleAddBus },
                ]}
            />
            {/* Filtros */}
            <FilterBar {...pageFilters.barProps} loading={loading} />

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {isMobile ? (
                        <>
                            {pageBuses.map((bus) => (
                                <MobileCard key={bus.id} elevation={3} actions={<RowActions actions={rowActions(bus)} />}>
                                    <MobileField label="Placa">{bus.plate}</MobileField>
                                    <MobileField label="Capacidad">{bus.capacity}</MobileField>
                                    <MobileField label="Descripción">{bus.description}</MobileField>
                                    <MobileField label="Asignación">{getAssignmentText(bus)}</MobileField>
                                    <MobileField label="Estado">
                                        {bus.decommissioned ? (
                                            <Typography sx={{ color: 'black', fontWeight: 'bold' }}>
                                                DADO DE BAJA
                                            </Typography>
                                        ) : bus.inWorkshop ? (
                                            <Typography sx={{ color: 'red', fontWeight: 'bold' }}>
                                                EN TALLER
                                            </Typography>
                                        ) : (
                                            <Typography sx={{ color: 'green', fontWeight: 'bold' }}>
                                                DISPONIBLE
                                            </Typography>
                                        )}
                                    </MobileField>
                                    <MobileField label="Kilómetros acumulados">{Number(bus.totalDistanceTraveled || 0).toFixed(3)} km</MobileField>
                                    <MobileField label="Archivos">
                                        {bus.files && bus.files.length > 0 ? (
                                            <List disablePadding>
                                                {bus.files.map((file) => {
                                                    const fileLabel = file.fileName.split('/').pop();
                                                    return (
                                                        <ListItem key={file.id} disableGutters sx={{ p: 0 }}>
                                                            {file.fileType === 'application/pdf' ? (
                                                                <InsertDriveFile sx={{ mr: 1 }} />
                                                            ) : (
                                                                <ImageIcon sx={{ mr: 1 }} />
                                                            )}
                                                            <Link
                                                                href={file.fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                underline="hover"
                                                                variant="body2"
                                                            >
                                                                {fileLabel}
                                                            </Link>
                                                        </ListItem>
                                                    );
                                                })}
                                            </List>
                                        ) : (
                                            'No hay archivos.'
                                        )}
                                    </MobileField>
                                </MobileCard>
                            ))}
                            <AppTablePagination count={sortedBuses.length} {...table.paginationProps} />
                        </>
                    ) : (
                        <Paper>
                            <AppTableContainer>
                                <Table stickyHeader sx={{ minWidth: 900 }}>
                                    <SortableTableHead columns={COLUMNS} {...table.sortProps} showSortIcons />
                                    <TableBody>
                                        {pageBuses.map((bus) => (
                                            <TableRow key={bus.id}>
                                                <TableCell>{bus.plate}</TableCell>
                                                <TableCell>{bus.capacity}</TableCell>
                                                <TableCell>{bus.description}</TableCell>
                                                <TableCell>{Number(bus.totalDistanceTraveled || 0).toFixed(3)} km</TableCell>
                                                <TableCell>{getAssignmentText(bus)}</TableCell>
                                                <TableCell>
                                                    {bus.decommissioned ? (
                                                        <Typography sx={{ color: 'black', fontWeight: 'bold' }}>
                                                            DADO DE BAJA
                                                        </Typography>
                                                    ) : bus.inWorkshop ? (
                                                        <Typography sx={{ color: 'red', fontWeight: 'bold' }}>
                                                            EN TALLER
                                                        </Typography>
                                                    ) : (
                                                        <Typography sx={{ color: 'green', fontWeight: 'bold' }}>
                                                            DISPONIBLE
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 200, verticalAlign: 'top' }}>
                                                    <List disablePadding>
                                                        {bus.files.map((file) => {
                                                            const fileLabel = file.fileName.split('/').pop();
                                                            return (
                                                                <ListItem key={file.id} disableGutters sx={{ p: 0 }}>
                                                                    {file.fileType === 'application/pdf' ? (
                                                                        <InsertDriveFile sx={{ mr: 1 }} />
                                                                    ) : (
                                                                        <ImageIcon sx={{ mr: 1 }} />
                                                                    )}
                                                                    <Tooltip title={fileLabel}>
                                                                        <ListItemText
                                                                            primary={
                                                                                <Link
                                                                                    href={file.fileUrl}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                >
                                                                                    {fileLabel}
                                                                                </Link>
                                                                            }
                                                                            primaryTypographyProps={{
                                                                                noWrap: true,
                                                                                sx: {
                                                                                    overflow: 'hidden',
                                                                                    textOverflow: 'ellipsis',
                                                                                    maxWidth: '140px'
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Tooltip>
                                                                </ListItem>
                                                            );
                                                        })}
                                                        {bus.files.length === 0 && (
                                                            <Typography
                                                                variant="body2"
                                                                color="textSecondary"
                                                                sx={{ fontStyle: 'italic' }}
                                                            >
                                                                No hay archivos.
                                                            </Typography>
                                                        )}
                                                    </List>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <RowActions actions={rowActions(bus)} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {sortedBuses.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center">
                                                    No se encontraron buses.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </AppTableContainer>
                            <AppTablePagination count={sortedBuses.length} {...table.paginationProps} />
                        </Paper>
                    )}
                </>
            )}

            {/* Diálogo para crear/editar un bus */}
            <AppDialog
                open={openDialog}
                onClose={handleDialogClose}
                title={selectedBus?.id ? 'Editar bus' : 'Nuevo bus'}
                icon={<DirectionsBusIcon />}
                size="sm"
                onSubmit={handleSave}
                submitLabel={selectedBus?.id ? 'Guardar cambios' : 'Crear bus'}
                submitting={savingBus}
                readOnly={!hasPermission(selectedBus?.id ? 'buses-editar' : 'buses-crear')}
            >
                <TextField
                    autoFocus
                    margin="dense"
                    name="plate"
                    label="Placa"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={selectedBus ? selectedBus.plate : ''}
                    onChange={handleInputChange}
                    required
                    error={Boolean(busErrors.plate)}
                    helperText={busErrors.plate}
                />
                <TextField
                    margin="dense"
                    name="capacity"
                    label="Capacidad"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={selectedBus ? selectedBus.capacity : ''}
                    onChange={handleInputChange}
                />
                <TextField
                    margin="dense"
                    name="description"
                    label="Descripción"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={selectedBus ? selectedBus.description : ''}
                    onChange={handleInputChange}
                />

                {/* Switch para inWorkshop */}
                <FormControlLabel
                    control={
                        <Switch
                            checked={selectedBus ? selectedBus.inWorkshop : false}
                            onChange={(e) =>
                                setSelectedBus((prev) => ({
                                    ...prev,
                                    inWorkshop: e.target.checked,
                                    decommissioned: e.target.checked ? false : prev.decommissioned
                                }))
                            }
                            color="primary"
                        />
                    }
                    label="¿En taller?"
                    sx={{ mt: 1 }}
                />

                {/* Switch para dar de baja */}
                <FormControlLabel
                    control={
                        <Switch
                            checked={selectedBus ? selectedBus.decommissioned : false}
                            disabled={selectedBusHasAssignment}
                            onChange={(e) =>
                                setSelectedBus((prev) => ({
                                    ...prev,
                                    decommissioned: e.target.checked,
                                    inWorkshop: e.target.checked ? false : prev.inWorkshop
                                }))
                            }
                            color="error"
                        />
                    }
                    label="Dar de baja"
                    sx={{ mt: 1 }}
                />
                {selectedBusHasAssignment && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Este bus tiene una asignación activa. Para darlo de baja no debe tener una asignación.
                    </Typography>
                )}

                <Box sx={{ mt: 2 }}>
                    <FileField
                        accept="pdfOImagen"
                        multiple
                        hideSelection
                        label="Subir archivos"
                        onChange={handleFileChange}
                    />
                </Box>

                {selectedBus?.files && selectedBus.files.length > 0 && (
                    <List sx={{ mt: 2 }}>
                        {[...selectedBus.files].map((file, index) => {
                            const isServerFile = !!file.id;
                            const label = isServerFile ? file.fileName.split('/').pop() : file.name;
                            return (
                                <ListItem key={isServerFile ? `sf-${file.id}` : `nf-${index}`} disableGutters sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {isServerFile && file.fileType === 'application/pdf' ? (
                                            <InsertDriveFile />
                                        ) : !isServerFile && file.type === 'application/pdf' ? (
                                            <InsertDriveFile />
                                        ) : (
                                            <ImageIcon />
                                        )}
                                        {isServerFile ? (
                                            <ListItemText>
                                                <Link href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    {label}
                                                </Link>
                                            </ListItemText>
                                        ) : (
                                            <ListItemText primary={label} />
                                        )}
                                    </Box>
                                    <Box>
                                        {/* Un archivo sin id todavía no está en el servidor: quitarlo es
                                            local y no exige permiso. Borrar uno guardado hace
                                            DELETE /buses/:id/files/:id. */}
                                        {(!file?.id || hasPermission('buses-eliminar-archivo')) && (
                                            <IconButton size="small" onClick={() => handleRemoveFile(file, index)} aria-label="Eliminar archivo">
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Box>
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </AppDialog>

            <BulkUploadDialog
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                title="Carga masiva de buses"
                description="Sube un archivo Excel o CSV con las columnas Placa, Capacidad y Descripción, usando la plantilla."
                templateObject="buses"
                successLabel="Buses creados o actualizados"
                buildTemplate={buildBusesTemplate}
                upload={async (file) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await api.post('/buses/bulk-upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    return response.data;
                }}
                onUploaded={() => fetchBuses()}
            />

            {/* RouteHistoryModal removed */}
        </PageContainer>
    );
};

export default BusesManagementPage;
