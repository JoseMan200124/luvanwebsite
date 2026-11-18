// src/pages/BusesManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Button,
    TextField,
    IconButton,
    Tooltip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Alert,
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
    FileUpload
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { getCiclosEscolares } from '../services/cicloEscolarService';
import * as XLSX from 'xlsx';
import PermissionGuard from '../components/PermissionGuard';
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
import useTableState from '../hooks/useTableState';
import useIsMobile from '../hooks/useIsMobile';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import { MobileCard, MobileField } from '../components/table/MobileCard';
import RowActions from '../components/table/RowActions';
import { sortRows } from '../utils/tableSort';

const AVAILABILITY_OPTIONS = [
    { value: 'assigned', label: 'Asignados' },
    { value: 'unassigned', label: 'Sin asignar' },
];
const WORKSHOP_OPTIONS = [
    { value: 'in', label: 'En taller' },
    { value: 'out', label: 'Disponible' },
    { value: 'decommissioned', label: 'Dado de baja' },
];

/**
 * Función para formatear fecha/hora (para el nombre del archivo de plantilla, etc.)
 */
const getFormattedDateTime = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

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

    // Paginación y ordenamiento
    const table = useTableState();
    const [loading, setLoading] = useState(false);

    // Removed: Assignment-related state variables (pilots, monitors, schools, route numbers)
    // BusesManagementPage now only handles basic bus fleet management

    // Carga masiva
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    // =================== Efectos y funciones ===================

    const fetchBuses = async () => {
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
        setSelectedBus((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const files = e.target.files;
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > maxSize) {
                    notify.error(`El archivo ${file.name} supera los 5 MB, por favor selecciona uno más pequeño.`);
                    // reset input and stop
                    e.target.value = null;
                    return;
                }
            }
        }

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

        // reset the input so the same file can be selected again if needed
        e.target.value = null;
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
        }
    };

    // file delete endpoint left intentionally out of UI for now (server API exists). Use bus file deletion via server routes if needed.

    // =================== Búsqueda y filtros ===================
    const [clientSchools, setClientSchools] = useState([]);
    const [clientCorporations, setClientCorporations] = useState([]);

    useEffect(() => {
        const loadClients = async () => {
            try {
                const [ciclosData, schoolsResp, corpsResp] = await Promise.all([
                    getCiclosEscolares(),
                    api.get('/schools', { params: { allCycles: true, includeArchived: true } }),
                    api.get('/corporations', { params: { allCycles: true } })
                ]);

                // El selector agrupa los colegios por ciclo: se completa el objeto del ciclo si la respuesta no lo trae
                const ciclosList = ciclosData?.ciclosEscolares || (Array.isArray(ciclosData) ? ciclosData : []);
                const ciclosById = {};
                for (const c of ciclosList) {
                    ciclosById[c.id] = c;
                }

                const schoolsList = schoolsResp.data?.schools || schoolsResp.data || [];
                const corpsList = corpsResp.data?.corporations || corpsResp.data || [];

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

    // ============== CARGA MASIVA ==============
    const handleOpenBulkDialog = () => {
        setBulkFile(null);
        setBulkResults(null);
        setOpenBulkDialog(true);
    };
    const handleCloseBulkDialog = () => {
        setOpenBulkDialog(false);
    };

    const handleBulkFileChange = (e) => {
        const file = e.target.files[0];
        const maxSize = 5 * 1024 * 1024; // 5 MB

        if (file && file.size > maxSize) {
            notify.error(`El archivo ${file.name} supera los 5 MB, por favor selecciona uno más pequeño.`);
            e.target.value = null;
            return;
        }

        setBulkFile(file);
    };

    const handleUploadBulk = async () => {
        if (!bulkFile) {
            return;
        }
        setBulkLoading(true);
        setBulkResults(null);

        const formData = new FormData();
        formData.append('file', bulkFile);

        try {
            const resp = await api.post('/buses/bulk-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${auth.token}`
                }
            });
            setBulkResults(resp.data);
            fetchBuses();
        } catch (error) {
            console.error('Error al subir buses masivamente:', error);
            notify.fromError(error, 'Error al procesar la carga masiva');
        }
        setBulkLoading(false);
    };

    // Función para descargar la plantilla personalizada de buses
    const handleDownloadTemplate = () => {
        // Simple template for basic bus information only
        const headers = [
            "Placa",
            "Capacidad", 
            "Descripción"
        ];
        const exampleRow = [
            "PlacaEjemplo",
            40,
            "Descripción de Ejemplo. Esta fila es solo un ejemplo."
        ];

        const data = [headers, exampleRow];

        // Create the spreadsheet
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Buses");

        // Download the file
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        const fileName = `buses_template_${getFormattedDateTime()}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

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
                    { key: 'bulk', label: 'Carga masiva', group: 'upload', permission: 'buses-carga-masiva', onClick: handleOpenBulkDialog },
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
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedBus?.id ? 'Editar Bus' : 'Añadir Bus'}
                </DialogTitle>
                <DialogContent>
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

                    <input
                        accept="application/pdf,image/jpeg,image/png"
                        style={{ display: 'none' }}
                        id="file-input"
                        multiple
                        type="file"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="file-input">
                        <Button variant="outlined" color="primary" component="span" sx={{ mt: 2 }}>
                            Subir Archivos
                        </Button>
                    </label>

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
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    {hasPermission(selectedBus?.id ? 'buses-editar' : 'buses-crear') && (
                        <Button onClick={handleSave} color="primary" variant="contained">
                            {selectedBus?.id ? 'Guardar Cambios' : 'Crear Bus'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Diálogo para carga masiva */}
            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Buses</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Sube un archivo Excel/CSV con las columnas necesarias (Placa, Capacidad, Descripción). 
                        Usa la plantilla oficial.<br />
                        <br />
                        El límite de archivo es 5 MB.
                    </Typography>

                    <Button
                        variant="outlined"
                        color="success"
                        onClick={handleDownloadTemplate}
                        sx={{ mr: 2 }}
                    >
                        Descargar Plantilla
                    </Button>

                    <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                        Seleccionar Archivo
                        <input
                            type="file"
                            hidden
                            onChange={handleBulkFileChange}
                            accept=".xlsx, .xls, .csv"
                        />
                    </Button>
                    {bulkFile && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {bulkFile.name}
                        </Typography>
                    )}

                    {bulkLoading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                            <CircularProgress size={24} />
                            <Typography variant="body2" sx={{ ml: 2 }}>
                                Procesando archivo...
                            </Typography>
                        </Box>
                    )}

                    {bulkResults && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="info">
                                <Typography>
                                    <strong>Buses creados/actualizados:</strong> {bulkResults.successCount}
                                </Typography>
                                <Typography>
                                    <strong>Errores:</strong> {bulkResults.errorsCount}
                                </Typography>
                                {bulkResults.errorsList && bulkResults.errorsList.length > 0 && (
                                    <ul>
                                        {bulkResults.errorsList.map((err, idx) => (
                                            <li key={idx}>
                                                Fila {err.row}: {err.errorMessage}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Alert>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseBulkDialog}>Cerrar</Button>
                    <PermissionGuard permission="buses-carga-masiva">
                        <Button
                            onClick={handleUploadBulk}
                            variant="contained"
                            color="primary"
                            disabled={!bulkFile || bulkLoading}
                        >
                            Subir
                        </Button>
                    </PermissionGuard>
                </DialogActions>
            </Dialog>

            {/* RouteHistoryModal removed */}
        </PageContainer>
    );
};

export default BusesManagementPage;
