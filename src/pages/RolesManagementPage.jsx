import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Paper,
    DialogContentText,
    CircularProgress,
    Grid,
    Box,
    // Link,
    Chip,
    Checkbox,
    FormControl,
    FormHelperText,
    InputLabel,
    Select,
    MenuItem,
    TextField
} from '@mui/material';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import { matchSearchTokens } from '../utils/clientFilter';
import { Autocomplete } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Edit, Delete, Add, Lock, PersonAdd as PersonAddIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
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
import usePermissions from '../hooks/usePermissions';
import useManageableRoles from '../hooks/useManageableRoles';
import { formatDateTime } from '../utils/dateFormat';
import AppDialog from '../components/dialogs/AppDialog';
import EntitySelect from '../components/form/EntitySelect';
import BulkUploadDialog from '../components/dialogs/BulkUploadDialog';
import { buildWorkbook } from '../utils/excel';
import { buildFileName } from '../utils/fileName';
import { todayForFileName, downloadFromApi } from '../utils/download';
import { loadCatalog, invalidateCatalog } from '../services/catalogStore';
import {
    buildStaffSchoolCatalog,
    toCanonicalSchoolIds,
    visibleStaffSchoolOptions,
    staffSchoolLabel,
    staffSchoolsSummary
} from '../utils/staffSchoolCatalog';
import { userClients, userClientNames } from '../utils/userClients';
import UserClientsCell from '../components/UserClientsCell';

// Fallback static role list (used as initial value, backend will provide authoritative list)
const roleOptionsStatic = [
    { id: 1, name: 'Gestor' },
    { id: 2, name: 'Administrador' },
    { id: 4, name: 'Monitora' },
    { id: 5, name: 'Piloto' },
    { id: 6, name: 'Supervisor' },
    { id: 7, name: 'Auxiliar' },
    { id: 9, name: 'Invitado' }
];

// Roles con hoja en la plantilla de carga masiva (nombre de hoja → roleId). Cada hoja de
// buildUserTemplate se busca aquí por su nombre: solo se generan las de roles que el
// actor puede gestionar, y una hoja cuyo nombre no esté en esta lista no se genera.
const BULK_SHEET_ROLE_IDS = Object.freeze({
    Gestor: 1,
    Administrador: 2,
    Monitora: 4,
    Piloto: 5,
    Supervisor: 6,
    Auxiliar: 7
});

// Columnas de la tabla de usuarios
const COLUMNS = [
    { id: 'familyLastName', label: 'Apellido Familia', sortable: true },
    { id: 'name', label: 'Nombre', sortable: true },
    { id: 'email', label: 'Correo', sortable: true },
    { id: 'role', label: 'Rol', sortable: true },
    { id: 'client', label: 'Cliente', sortable: true },
    { id: 'updatedAt', label: 'Actualizado el', sortable: true },
    { id: 'actions', label: 'Acciones', align: 'center' },
];

// Helper para saber si un usuario es "nuevo" (basado en fecha de creación)
function isUserNew(user) {
    if (!user?.createdAt) {
        return false;
    }
    const createdAt = new Date(user.createdAt);
    const now = new Date();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    return diffDays <= 21;
}

function getFieldValue(user, field) {
    switch (field) {
        case 'familyLastName':
            return user.lastName;
        case 'name':
            return user.name;
        case 'email':
            return user.email;
        case 'role':
            return user.Role ? user.Role.name : '';
        case 'school':
            return user.School ? user.School.name : '';
        case 'updatedAt':
            return user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
        default:
            return '';
    }
}


const NO_AFFILIATION_OPTION = { type: 'none', id: 'none', label: 'Sin afiliación', groupLabel: 'Opciones' };

const RolesManagementPage = () => {
    const isMobile = useIsMobile();
    useContext(AuthContext);
    const { hasPermission } = usePermissions();
    const { loaded: manageableRolesLoaded, canManageRoleId, isSelf, canManageUser, canEditUser } = useManageableRoles();

    const [users, setUsers] = useState([]);
    const [schools, setSchools] = useState([]);
    // Colegios asignables a Supervisor/Auxiliar: uno por grupo (schoolGroupId), con el id canónico
    // que también usa el backend. No depende del filtro de ciclo: la asignación es global.
    const [assignableSchools, setAssignableSchools] = useState([]);
    // 'cargando' | 'listo' | 'error': sin catálogo el selector no puede nombrar los colegios.
    const [assignableSchoolsState, setAssignableSchoolsState] = useState('cargando');
    // Map<schoolId, idCanónico>: lleva cualquier fila-ciclo a la opción del selector.
    const [canonicalSchoolIdById, setCanonicalSchoolIdById] = useState(new Map());
    // Colegios que el usuario tenía al abrir el diálogo: los archivados solo se ofrecen si están aquí.
    const [initialStaffSchoolIds, setInitialStaffSchoolIds] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [roleOptions, setRoleOptions] = useState(roleOptionsStatic);
    // Buses no longer needed for route report generation (slots carry routeNumber)
    const [selectedUser, setSelectedUser] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    // Editándose a sí mismo: solo datos básicos (nombre, correo, teléfono, contraseña)
    const isSelfEdit = Boolean(selectedUser?.id) && isSelf(selectedUser);
    

    // Se elimina la gestión de contrato en el diálogo de edición
    // const [selectedContractUuid, setSelectedContractUuid] = useState('');

    const notify = useNotify();
    const confirm = useConfirm();
    // Paginación en el servidor; el orden se aplica sobre la página actual
    const table = useTableState();
    const { page, rowsPerPage } = table;
    const [totalUsers, setTotalUsers] = useState(0);
    const [loading, setLoading] = useState(false);

    const [allPilots, setAllPilots] = useState([]);
    const [selectedSupervisorSchools, setSelectedSupervisorSchools] = useState([]);
    const [selectedSupervisorCorporations, setSelectedSupervisorCorporations] = useState([]);

    const [allMonitoras, setAllMonitoras] = useState([]);
    const [selectedAuxiliarSchools, setSelectedAuxiliarSchools] = useState([]);
    const [selectedAuxiliarCorporations, setSelectedAuxiliarCorporations] = useState([]);
    const [userErrors, setUserErrors] = useState({});
    const [savingUser, setSavingUser] = useState(false);
    const userInitialRef = useRef('');
    const userFormSnapshot = JSON.stringify([
        selectedUser,
        selectedSupervisorSchools,
        selectedSupervisorCorporations,
        selectedAuxiliarSchools,
        selectedAuxiliarCorporations,
    ]);
    useEffect(() => {
        if (openDialog) {
            userInitialRef.current = userFormSnapshot;
            setUserErrors({});
        }
    }, [openDialog]);

    const [bulkOpen, setBulkOpen] = useState(false);

    // bulk editors removed


    // Dialog para descargar usuarios
    const [downloadAllDialogOpen, setDownloadAllDialogOpen] = useState(false);
    const [downloadCategory, setDownloadCategory] = useState(''); // 'Colegios' | 'Corporaciones' | 'Sin afiliación'
    const [selectedClientForDownload, setSelectedClientForDownload] = useState(null); // object from schools or corporations

    // (Reporte de rutas removido de la página)

    // Colegios del filtro de cliente y de la descarga: los mismos ids canónicos que manda el backend en
    // attachedSupervisorSchools/attachedAuxiliarSchools, archivados incluidos y marcados.
    const clientFilterSchools = assignableSchools.map(s => ({ id: s.id, name: staffSchoolLabel(assignableSchools, s.id) }));

    // Clientes de un usuario para la columna "Cliente", su orden, la tarjeta móvil y el Excel.
    const clientsOf = (user) => userClients(user, {
        schools: assignableSchools,
        corporations,
        catalogReady: assignableSchoolsState !== 'cargando'
    });

    // Filtros: el cliente es { type: 'school' | 'corp' | 'none', id } o null (todos)
    const pageFilters = useFilters({
        fields: [
            F.search('search', { placeholder: 'Nombre o correo' }),
            F.select('roleId', {
                label: 'Rol',
                width: 'sm',
                options: roleOptions
                    .filter(r => {
                        const n = String(r.name || '').toLowerCase();
                        return n !== 'padre' && n !== 'colaborador';
                    })
                    .map(r => ({ value: String(r.id), label: r.name })),
            }),
            F.client({ schools: clientFilterSchools, corporations, extraOptions: [NO_AFFILIATION_OPTION], schoolsGroupLabel: 'Colegios' }),
        ],
        onApplied: table.resetPage,
    });
    const { search: searchQuery, roleId: roleFilter, client: clientFilter } = pageFilters.applied;

    // Roles que se pueden asignar desde este diálogo, al crear y al editar. Padre y Colaborador
    const assignableRoles = new Set(['gestor', 'administrador', 'monitora', 'piloto', 'supervisor', 'auxiliar', 'invitado', 'mecanica']);
    // Pirámide de roles: sin ningún rol gestionable que crear aquí, no se ofrecen el alta ni la carga masiva
    const puedeCrearAlgunRol = roleOptions.some(r => assignableRoles.has(String(r.name).toLowerCase()) && canManageRoleId(r.id));
    const puedeCargaMasiva = Object.values(BULK_SHEET_ROLE_IDS).some(canManageRoleId);
    // Roles that should NOT be assigned a school or corporation
    // (Mecanica ve todos los clientes: no se le asigna uno)
    const rolesWithoutSchoolOrCorp = new Set(['administrador', 'supervisor', 'auxiliar', 'mecanica']);

    const roleDisablesSchoolOrCorp = (roleId) => {
        if (!roleId) {
            return false;
        }
        const r = roleOptions.find(ro => Number(ro.id) === Number(roleId));
        if (!r?.name) {
            return false;
        }
        return rolesWithoutSchoolOrCorp.has(String(r.name).toLowerCase());
    };

    useEffect(() => {
        // Inicializar datos
        // eslint-disable-next-line react-hooks/exhaustive-deps
        (async () => {
            fetchUsers();
            fetchSchools();
            fetchAssignableSchools();
            fetchCorporations();
            fetchRoles();
            fetchAllPilots();
            fetchAllMonitoras();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAllPilots = async () => {
        if (!hasPermission('usuarios-listar-pilotos')) {
            setAllPilots([]);
            return;
        }
        try {
            setAllPilots(await loadCatalog('pilots', {}, { skipSchoolCycleContext: true }));
        } catch (error) {
            console.error('[fetchAllPilots] Error:', error);
            setAllPilots([]);
        }
    };

    const fetchAllMonitoras = async () => {
        if (!hasPermission('usuarios-listar-monitoras')) {
            setAllMonitoras([]);
            return;
        }
        try {
            setAllMonitoras(await loadCatalog('monitors', {}, { skipSchoolCycleContext: true }));
        } catch (error) {
            console.error('[fetchAllMonitoras] Error:', error);
            setAllMonitoras([]);
        }
    };

    const fetchRoles = async () => {
        try {
            const resp = await api.get('/roles');
            // API may return { roles: [...] } or an array directly
            const data = resp.data?.roles ? resp.data.roles : resp.data;
            // Normalize to objects with id and name
            if (Array.isArray(data)) {
                const normalized = data.map(r => ({ id: Number(r.id ?? r.roleId ?? r.value ?? r.key), name: r.name ?? r.label ?? String(r) }));
                setRoleOptions(normalized);
            } else {
                setRoleOptions([]);
            }
        } catch (error) {
            console.error('[fetchRoles] Error:', error);
            setRoleOptions([]);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit: rowsPerPage
            };
            if (searchQuery) {
                params.search = searchQuery;
            }
            if (roleFilter) {
                params.roleId = roleFilter;
            }
            if (clientFilter?.type === 'school') {
                params.schoolId = clientFilter.id;
            }
            if (clientFilter?.type === 'corp') {
                params.corporationId = clientFilter.id;
            }
            if (clientFilter?.type === 'none') {
                params.sinAfiliacion = true;
            }

            const response = await api.get('/users/non-parents', { params, skipSchoolCycleContext: true });
            const data = response.data || {};
            setUsers(data.users || []);
            setTotalUsers(Number(data.count || 0));
        } catch (err) {
            console.error('[fetchUsers] Error:', err);
            notify.error('Error al obtener usuarios');
        }
        setLoading(false);
    };

    // Fetch when pagination or filters change
    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, roleFilter, clientFilter, searchQuery]);

        // Register page-level refresh handler for global refresh control
        useRegisterPageRefresh(async () => {
            await fetchUsers();
        }, [fetchUsers]);

    const fetchSchools = async () => {
        try {
            setSchools(await loadCatalog('schools', { allCycles: true, latestPerSchool: true }, { skipSchoolCycleContext: true }));
        } catch (err) {
            console.error('[fetchSchools] Error:', err);
            notify.error('Error al obtener colegios');
        }
    };

    const fetchAssignableSchools = async () => {
        try {
            const [latestSchools, allSchools] = await Promise.all([
                loadCatalog('schools', { latestPerSchool: true, includeArchived: true }, { skipSchoolCycleContext: true }),
                loadCatalog('schools', { allCycles: true, includeArchived: true }, { skipSchoolCycleContext: true })
            ]);
            const { schools: catalog, canonicalIdBySchoolId } = buildStaffSchoolCatalog(latestSchools, allSchools);
            setAssignableSchools(catalog);
            setCanonicalSchoolIdById(canonicalIdBySchoolId);
            setAssignableSchoolsState('listo');
        } catch (err) {
            setAssignableSchoolsState('error');
            console.error('[fetchAssignableSchools] Error:', err);
            notify.error('Error al obtener colegios asignables');
        }
    };

    const fetchCorporations = async () => {
        try {
            setCorporations(await loadCatalog('corporations', { allCycles: true }, { skipSchoolCycleContext: true }));
        } catch (err) {
            console.error('[fetchCorporations] Error:', err);
            notify.error('Error al obtener corporaciones');
        }
    };

    // Removed fetchBuses

    

    const handleEditClick = async (user) => {
        const parsedRoleId = Number(user.roleId);
        setSelectedUser({
            ...user,
            roleId: parsedRoleId,
            originalRoleId: parsedRoleId,
            password: '',
            corporationId: user.corporationId || ''
        });
        setInitialStaffSchoolIds([]);
        // Populate monitoraFullName and phoneNumber from nested MonitoraDetail if present
        if (parsedRoleId === 4) {
            const md = user.monitoraDetail || user.MonitoraDetail || null;
            const mdFullName = md && (md.fullName || md.full_name) ? (md.fullName || md.full_name) : '';
            const mdPhone = md && (md.phoneNumber || md.phone || md.phone_number) ? (md.phoneNumber || md.phone || md.phone_number) : '';
            setSelectedUser(prev => ({ ...prev, monitoraFullName: mdFullName, phoneNumber: mdPhone }));
        }
            // Nota: El select de contrato NO se muestra en el diálogo de edición
            if (parsedRoleId === 6 || (user.Role?.name === 'Supervisor')) {
                const attachedSchools = user.attachedSupervisorSchools || [];
                const supervisorSchoolIds = toCanonicalSchoolIds(
                    attachedSchools.length > 0 ? attachedSchools : [user.school],
                    canonicalSchoolIdById
                );
                setSelectedSupervisorSchools(supervisorSchoolIds);
                setInitialStaffSchoolIds(supervisorSchoolIds);
                
                // Load attached corporations for supervisor
                const attachedCorporations = user.attachedSupervisorCorporations || [];
                if (attachedCorporations.length > 0) {
                    setSelectedSupervisorCorporations(attachedCorporations.map(c => Number(c)));
                } else {
                    setSelectedSupervisorCorporations([]);
                }
            }
        
        // Para el caso de Auxiliar
        if (parsedRoleId === 7 || (user.Role?.name === 'Auxiliar')) {
            const attachedSchools = user.attachedAuxiliarSchools || [];
            const auxiliarSchoolIds = toCanonicalSchoolIds(
                attachedSchools.length > 0 ? attachedSchools : [user.school],
                canonicalSchoolIdById
            );
            setSelectedAuxiliarSchools(auxiliarSchoolIds);
            setInitialStaffSchoolIds(auxiliarSchoolIds);
            
            // Load attached corporations for auxiliar (if backend provided them)
            const attachedCorporations = user.attachedAuxiliarCorporations || [];
            if (attachedCorporations.length > 0) {
                setSelectedAuxiliarCorporations(attachedCorporations.map(c => Number(c)));
            } else {
                setSelectedAuxiliarCorporations([]);
            }
        } else {
            setSelectedAuxiliarSchools([]);
            // setSelectedAuxiliarCorporations([]);
        }
        setOpenDialog(true);
    };


    const handleAddUser = () => {
        setSelectedUser({
            id: null,
            name: '',
            email: '',
            password: '',
            roleId: '',
            school: '',
            corporationId: ''
        });
        setSelectedSupervisorSchools([]);
        setSelectedSupervisorCorporations([]);
        setSelectedAuxiliarSchools([]);
        setSelectedAuxiliarCorporations([]);
        setInitialStaffSchoolIds([]);
        setOpenDialog(true);
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedUser(null);
        setSelectedSupervisorSchools([]);
        setSelectedSupervisorCorporations([]);
        setSelectedAuxiliarSchools([]);
        setSelectedAuxiliarCorporations([]);
        setInitialStaffSchoolIds([]);
    };

    const handleDeleteClick = async (user) => {
        const ok = await confirm({
            title: 'Eliminar usuario',
            message: `Se eliminará de forma permanente a ${user.name || user.email || 'este usuario'}. Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            // Soft-delete endpoint (logical delete)
            onConfirm: () => api.delete(`/users/${user.id}`),
            errorMessage: 'Error al eliminar el usuario',
        });
        if (ok) {
            notify.success('Usuario eliminado');
            invalidateCatalog('pilots');
            invalidateCatalog('monitors');
            fetchUsers();
        }
    };

    // Acciones por fila según la pirámide: editar si es gestionable o es uno mismo.
    const renderUserActions = (user) => {
        if (!manageableRolesLoaded) {
            return null;
        }
        const puedeEditar = canEditUser(user);
        const puedeEliminar = canManageUser(user);
        if (!puedeEditar && !puedeEliminar) {
            return (
                <RowActions
                    actions={[{
                        key: 'locked',
                        kind: 'other',
                        label: 'Sin permiso',
                        icon: <Lock fontSize="small" />,
                        disabled: true,
                        tooltip: user.Role?.name
                            ? `No tienes permitido gestionar usuarios con rol ${user.Role.name}`
                            : 'No tienes permitido gestionar a este usuario',
                    }]}
                />
            );
        }
        return (
            <RowActions
                actions={[
                    puedeEditar && { key: 'edit', kind: 'edit', label: 'Editar', icon: <Edit fontSize="small" />, permission: 'usuarios-editar', onClick: () => handleEditClick(user) },
                    puedeEliminar && { key: 'delete', kind: 'delete', label: 'Eliminar', icon: <Delete fontSize="small" />, permission: 'usuarios-eliminar', onClick: () => handleDeleteClick(user) },
                ]}
            />
        );
    };

    const handleUserChange = (e) => {
        const { name, value } = e.target;
        setUserErrors((prev) => clearError(prev, name));
        setSelectedUser(prev => ({ ...prev, [name]: value }));
    };

    const handleRoleIdChange = (e) => {
        const newRoleId = Number(e.target.value);
        setUserErrors((prev) => clearError(prev, 'roleId'));
        // If the selected role should not have school/corporation, clear them when changing
        if (roleDisablesSchoolOrCorp(newRoleId)) {
            setSelectedUser(prev => ({ ...prev, roleId: newRoleId, school: '', corporationId: '' }));
        } else {
            setSelectedUser(prev => ({ ...prev, roleId: newRoleId }));
        }
    };


    // Horarios de parada gestionados por el modal por alumno; helpers removidos

    const handleSaveUser = async () => {
        const found = validate(selectedUser, {
            name: ['required'],
            email: ['required', 'email'],
            ...(selectedUser?.id ? {} : { password: ['required'] }),
            ...(isSelfEdit ? {} : { roleId: ['required'] }),
        });
        setUserErrors(found);
        if (hasErrors(found)) {
            focusFirstError(found);
            return;
        }
        setSavingUser(true);
        try {
            if (selectedUser.id && isSelf(selectedUser)) {
                const selfPayload = { name: selectedUser.name, email: selectedUser.email };
                if (selectedUser.password?.trim() !== '') {
                    selfPayload.password = selectedUser.password;
                }
                if (typeof selectedUser.phoneNumber !== 'undefined') {
                    selfPayload.phoneNumber = selectedUser.phoneNumber;
                }
                await api.put(`/users/${selectedUser.id}`, selfPayload);
                notify.success('Tus datos se actualizaron');
                fetchUsers();
                handleDialogClose();
                return;
            }

            const roleIdNum = Number(selectedUser.roleId);

            // Arma el payload del usuario
            let payload = {
                id: selectedUser.id,
                name: selectedUser.name,
                email: selectedUser.email,
                roleId: roleIdNum,
                // Asegura tipo numérico para school
                school: selectedUser.school ? Number(selectedUser.school) : null,
                // Asegura tipo numérico para corporationId
                corporationId: selectedUser.corporationId ? Number(selectedUser.corporationId) : null
            };

            if (selectedUser.password?.trim() !== '') {
                payload.password = selectedUser.password;
            }

            // Evita pisar phoneNumber si no se está editando
            if (typeof selectedUser.phoneNumber !== 'undefined') {
                payload.phoneNumber = selectedUser.phoneNumber;
            }


            // Supervisor: colegios a cargo (preferred)
            if (roleIdNum === 6) {
                payload.supervisorSchools = (selectedSupervisorSchools || []).map(s => Number(s));
                payload.supervisorCorporations = (selectedSupervisorCorporations || []).map(c => Number(c));
            }

            // Auxiliar: colegios a cargo (igual que supervisores)
            if (roleIdNum === 7) {
                payload.auxiliarSchools = (selectedAuxiliarSchools || []).map(s => Number(s));
                payload.auxiliarCorporations = (selectedAuxiliarCorporations || []).map(c => Number(c));
            }

            // Monitora: include monitoraDetail with fullName and phoneNumber
            if (roleIdNum === 4) {
                payload.monitoraDetail = {
                    fullName: selectedUser?.monitoraFullName || selectedUser?.name || '',
                    phoneNumber: selectedUser?.phoneNumber || ''
                };
                if (selectedUser?.school) {
                    payload.monitoraDetail.schoolId = Number(selectedUser.school);
                }
            }

            // Crear o actualizar (no envíes id en POST)
            if (selectedUser.id) {
                const { data: updateData } = await api.put(`/users/${selectedUser.id}`, payload);
                const releasedBuses = updateData?.releasedBuses || [];
                const releasedPlates = releasedBuses.map(b => b.plate || `#${b.id}`).join(', ');
                const releasedMessage = releasedBuses.length > 0
                    ? `. Se desasignó ${releasedBuses.length === 1 ? 'del bus' : 'de los buses'} ${releasedPlates}`
                    : '';
                notify.success(`Usuario actualizado exitosamente${releasedMessage}`);
            } else {
                const { id, ...payloadForPost } = payload;
                await api.post('/users', payloadForPost);
                notify.success('Usuario creado');
            }

            invalidateCatalog('pilots');
            invalidateCatalog('monitors');
            fetchUsers();
            handleDialogClose();
        } catch (err) {
            console.error('[handleSaveUser] Error:', err);
            notify.fromError(err, 'Error al guardar usuario');
        } finally {
            setSavingUser(false);
        }
    };


    //const handleSearchChange = (e) => {
        //setSearchInput(e.target.value);
    //};

    // --- MODIFICACIÓN: Se actualiza el filtrado para considerar además el apellido de la familia ---
    const filteredUsers = users.filter((u) => {
        if (!matchSearchTokens(searchQuery, [u.name, u.email])) {
            return false;
        }
        if (roleFilter) {
            if (Number(u.roleId) !== Number(roleFilter)) {
                return false;
            }
        }
        // El cliente lo filtra el backend (fetchUsers): aquí solo llega la página actual, y volver a
        // filtrarla con otras reglas escondía filas que el contador sí contaba.
        return true;
    });
    // --- FIN MODIFICACIÓN ---

    // Cliente: con varios, se ordena por el primero (colegios y luego corporaciones, en orden alfabético).
    const sortValue = (user, field) => (field === 'client' ? (userClientNames(clientsOf(user))[0] || '') : getFieldValue(user, field));
    const sortedUsers = sortRows(filteredUsers, { orderBy: table.orderBy, order: table.order, getValue: sortValue });
    // Server provides pagination; `users` already contains the current page.
    // Keep sorting client-side for the current page only.
    const displayedUsers = sortedUsers;

        

    // El Excel lo arma el backend (GET /users/non-parents/excel) con los mismos filtros que el listado:
    // hoja Usuarios (todos los clientes de cada usuario) y hoja Personal a cargo (pilotos y monitoras).
    const handleDownloadAllUsers = async (category, clientObj) => {
        if (!category) {
            notify.warning('Por favor selecciona una opción para descargar');
            return;
        }
        const params = {};
        if (category === 'Colegios') {
            if (!clientObj?.id) {
                notify.warning('Por favor selecciona un colegio para descargar');
                return;
            }
            params.schoolId = clientObj.id;
        } else if (category === 'Corporaciones') {
            if (!clientObj?.id) {
                notify.warning('Por favor selecciona una corporación para descargar');
                return;
            }
            params.corporationId = clientObj.id;
        } else if (category === 'Sin afiliación') {
            params.sinAfiliacion = true;
        }
        try {
            const clientName = clientObj?.name || (category === 'Sin afiliación' ? 'sin afiliacion' : '');
            await downloadFromApi('/users/non-parents/excel', {
                params,
                config: { skipSchoolCycleContext: true },
                fallbackName: buildFileName({ object: 'usuarios', client: clientName, date: todayForFileName(), extension: 'xlsx' })
            });
        } catch (error) {
            notify.fromError(error, 'Error al descargar todos los usuarios');
        }
    };

    // Plantilla de la carga masiva: hoja Listas y una hoja por rol que el actor puede gestionar.
    const buildUserTemplate = () => {
        // 1. Prepara listas de referencia. `assignableSchools` (no `schools`) porque no depende del
        // filtro de Ciclo Escolar: un id canónico por colegio. Los archivados no se ofrecen para altas.
        const colegios = assignableSchools.filter(s => !s.archived).sort((a, b) => a.id - b.id).map(s => [s.id, s.name]);
        const corporaciones = [...corporations].sort((a, b) => a.id - b.id).map(c => [c.id, c.name]);
        //const pilotos = allPilots.map(p => [p.id, p.name]);
        //const monitoras = allMonitoras.map(m => [m.id, m.name]);

        // 2. Definir los headers por rol
        const sheets = [
            {
                name: "Gestor",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)",
                    "Corporación (ID)"
                ],
                example: [
                    "GestorEjemplo",
                    "gestor@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    ""
                ]
            },
            {
                name: "Administrador",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña"
                ],
                example: [
                    "AdminEjemplo",
                    "admin@email.com",
                    "contraseña123"
                ]
            },
            
            {
                name: "Monitora",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)",
                    "Corporación (ID)"
                ],
                example: [
                    "MonitoraEjemplo",
                    "moni@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    ""
                ]
            },
            {
                name: "Piloto",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)",
                    "Corporación (ID)"
                ],
                example: [
                    "PilotoEjemplo",
                    "piloto@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    ""
                ]
            },
            {
                name: "Supervisor",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegios a Cargo (IDs separados por ;)",
                    "Corporaciones a Cargo (IDs separados por ;)"
                ],
                example: [
                    "SupervisorEjemplo",
                    "supervisor@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    corporaciones[0]?.[0] || ""
                ]
            },
            {
                name: "Auxiliar",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegios a Cargo (IDs separados por ;)",
                    "Corporaciones a Cargo (IDs separados por ;)"
                ],
                example: [
                    "AuxiliarEjemplo",
                    "auxiliar@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    corporaciones[0]?.[0] || ""
                ]
            }
        ];

        // 3. Hoja de listas de referencia con columnas separadas y una columna en blanco entre cada bloque
        // Encuentra el máximo de filas para cada bloque para alinear verticalmente
        const maxRows = Math.max(
            colegios.length,
            corporaciones.length
        );

        const wsListasData = [
            [
                "Colegios (ID)", "Colegios (Nombre)", "", // columna en blanco
                "Corporaciones (ID)", "Corporaciones (Nombre)"
            ]
        ];

        for (let i = 0; i < maxRows; i++) {
            wsListasData.push([
                colegios[i]?.[0] ?? "", colegios[i]?.[1] ?? "", "",
                corporaciones[i]?.[0] ?? "", corporaciones[i]?.[1] ?? ""
            ]);
        }
        const [listasHeaders, ...listasRows] = wsListasData;
        const listasWidths = [
            Math.max("Colegios (ID)".length + 2, 15),
            Math.max("Colegios (Nombre)".length + 2, 20),
            2,
            Math.max("Corporaciones (ID)".length + 2, 15),
            Math.max("Corporaciones (Nombre)".length + 2, 20)
        ];
        return buildWorkbook({
            sheets: [
                {
                    name: 'Listas',
                    columns: listasHeaders.map((header, index) => ({ header, key: `c${index}`, width: listasWidths[index] })),
                    rows: listasRows,
                },
                ...sheets.filter(sheet => canManageRoleId(BULK_SHEET_ROLE_IDS[sheet.name])).map(sheet => ({
                    name: sheet.name,
                    columns: sheet.headers.map((header, index) => ({ header, key: `c${index}`, width: Math.max(header.length + 2, 15) })),
                    rows: [sheet.example],
                })),
            ],
        });
    };

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.personal}
                title="Gestión de Usuarios y Roles"
                actions={[
                    { key: 'download', label: 'Descargar todos', group: 'download', onClick: () => setDownloadAllDialogOpen(true) },
                    puedeCargaMasiva && { key: 'bulk', label: 'Carga masiva', group: 'upload', permission: 'usuarios-carga-masiva', onClick: () => setBulkOpen(true) },
                    puedeCrearAlgunRol && { key: 'add', label: 'Añadir usuario', icon: <Add />, primary: true, permission: 'usuarios-crear', onClick: handleAddUser },
                ]}
            />
            {/* Filtros */}
            <FilterBar {...pageFilters.barProps} loading={loading} />
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {isMobile ? (
                        <>
                            {displayedUsers.map((user) => (
                                <MobileCard key={user.id} elevation={3} actions={renderUserActions(user)}>
                                    <MobileField label="Apellido Familia">{user.lastName || '—'}</MobileField>
                                    <MobileField label="Nombre">
                                        {user.name}{' '}
                                        {isUserNew(user) && (
                                            <Chip label="NUEVO" color="success" size="small" sx={{ ml: 1 }} />
                                        )}
                                    </MobileField>
                                    <MobileField label="Correo">{user.email}</MobileField>
                                    <MobileField label="Rol">{user.Role ? user.Role.name : '—'}</MobileField>
                                    <MobileField label="Cliente"><UserClientsCell clients={clientsOf(user)} /></MobileField>
                                </MobileCard>
                            ))}
                            <AppTablePagination count={totalUsers} {...table.paginationProps} />
                        </>
                    ) : (
                        <Paper sx={{ width: '100%', overflowX: 'auto' }}>
                            <AppTableContainer>
                                <Table stickyHeader>
                                    <SortableTableHead columns={COLUMNS} {...table.sortProps} showSortIcons />
                                    <TableBody>
                                        {displayedUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>{user.lastName || '—'}</TableCell>
                                                <TableCell>
                                                    {user.name}{' '}
                                                    {isUserNew(user) && (
                                                        <Chip label="NUEVO" color="success" size="small" sx={{ ml: 1 }} />
                                                    )}
                                                </TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>{user.Role ? user.Role.name : '—'}</TableCell>
                                                <TableCell><UserClientsCell clients={clientsOf(user)} /></TableCell>
                                                <TableCell>
                                                    {formatDateTime(user.updatedAt)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {renderUserActions(user)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {users.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center">
                                                    No se encontraron usuarios.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </AppTableContainer>
                            <AppTablePagination count={totalUsers} {...table.paginationProps} />
                        </Paper>
                    )}

                        {/* bulk editors removed */}
                </>
            )}

            {/* Diálogo para crear/editar usuario (En este diálogo NO se muestra el select de contrato) */}
            <AppDialog
                open={openDialog}
                onClose={handleDialogClose}
                title={selectedUser?.id ? 'Editar usuario' : 'Nuevo usuario'}
                subtitle={selectedUser?.id
                    ? 'Actualiza la información del usuario.'
                    : 'Completa la información para crear un nuevo usuario.'}
                icon={selectedUser?.id ? <Edit /> : <PersonAddIcon />}
                size="md"
                onSubmit={handleSaveUser}
                submitLabel={selectedUser?.id ? 'Guardar cambios' : 'Crear usuario'}
                submitting={savingUser}
                readOnly={!hasPermission(selectedUser?.id ? 'usuarios-editar' : 'usuarios-crear')}
                dirty={userFormSnapshot !== userInitialRef.current}
            >
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <TextField
                            autoFocus
                            name="name"
                            label="Nombre completo"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={selectedUser?.name || ''}
                            onChange={handleUserChange}
                            required
                            error={Boolean(userErrors.name)}
                            helperText={userErrors.name}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            name="email"
                            label="Correo electrónico"
                            type="email"
                            fullWidth
                            variant="outlined"
                            value={selectedUser?.email || ''}
                            onChange={handleUserChange}
                            required
                            error={Boolean(userErrors.email)}
                            helperText={userErrors.email}
                        />
                    </Grid>
                    {!selectedUser?.id && (
                        <Grid item xs={12} md={6}>
                            <TextField
                                name="password"
                                label="Contraseña"
                                type="password"
                                autoComplete="new-password"
                                fullWidth
                                variant="outlined"
                                value={selectedUser?.password || ''}
                                onChange={handleUserChange}
                                required
                                error={Boolean(userErrors.password)}
                                helperText={userErrors.password}
                            />
                        </Grid>
                    )}
                    {selectedUser?.id && (
                        <Grid item xs={12} md={6}>
                            <TextField
                                name="password"
                                label="Nueva contraseña (opcional)"
                                type="password"
                                autoComplete="new-password"
                                fullWidth
                                variant="outlined"
                                value={selectedUser?.password || ''}
                                onChange={handleUserChange}
                            />
                        </Grid>
                    )}
                    <Grid item xs={12} md={6}>
                        <FormControl variant="outlined" fullWidth required error={Boolean(userErrors.roleId)}>
                            <InputLabel>Rol</InputLabel>
                            <Select
                                name="roleId"
                                value={selectedUser?.roleId || ''}
                                onChange={handleRoleIdChange}
                                label="Rol"
                                disabled={isSelfEdit}
                            >
                                <MenuItem value="">
                                    <em>Seleccione un rol</em>
                                </MenuItem>
                                {roleOptions
                                    .filter(r => assignableRoles.has(String(r.name).toLowerCase()))
                                    .filter(r => canManageRoleId(r.id) || (isSelfEdit && Number(r.id) === Number(selectedUser?.originalRoleId)))
                                    .map((r) => (
                                        <MenuItem key={r.id} value={r.id}>
                                            {r.name}
                                        </MenuItem>
                                    ))}
                            </Select>
                            {userErrors.roleId && (
                                <FormHelperText>{userErrors.roleId}</FormHelperText>
                            )}
                            {isSelfEdit && (
                                <FormHelperText>No puedes cambiar tu propio rol.</FormHelperText>
                            )}
                            {selectedUser?.id && Number(selectedUser?.roleId) !== Number(selectedUser?.originalRoleId) && (
                                <FormHelperText>Al cambiar el rol, el usuario deberá iniciar sesión de nuevo.</FormHelperText>
                            )}
                        </FormControl>
                    </Grid>
                    {Number(selectedUser?.roleId) === 4 && (
                        <>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    name="monitoraFullName"
                                    label="Nombre completo (monitora)"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedUser?.monitoraFullName || ''}
                                    onChange={handleUserChange}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    name="phoneNumber"
                                    label="Número de teléfono"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedUser?.phoneNumber || ''}
                                    onChange={handleUserChange}
                                />
                            </Grid>
                        </>
                    )}
                    {!isSelfEdit && !roleDisablesSchoolOrCorp(selectedUser?.roleId) && (
                        <>
                            <Grid item xs={12} md={6}>
                                <EntitySelect
                                    entity="school"
                                    name="school"
                                    size="medium"
                                    options={schools}
                                    value={selectedUser?.school || ''}
                                    onChange={(newSchoolId) => {
                                        setSelectedUser(prev => ({
                                            ...prev,
                                            school: newSchoolId,
                                            corporationId: newSchoolId ? '' : prev.corporationId
                                        }));
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <EntitySelect
                                    entity="corporation"
                                    name="corporationId"
                                    size="medium"
                                    options={corporations}
                                    value={selectedUser?.corporationId || ''}
                                    onChange={(newCorporationId) => {
                                        setSelectedUser(prev => ({
                                            ...prev,
                                            corporationId: newCorporationId,
                                            school: newCorporationId ? '' : prev.school
                                        }));
                                    }}
                                />
                            </Grid>
                        </>
                    )}
                    {!isSelfEdit && Number(selectedUser?.roleId) === 6 && (
                        <Box sx={{ mt: 3, clear: 'both', width: '100%' }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                                Clientes a cargo
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Selecciona uno o más clientes (colegios y corporaciones); todos los pilotos asignados serán enlazados automáticamente.
                            </Typography>

                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                Colegios
                            </Typography>
                            <FormControl fullWidth sx={{ mb: 2 }} size="small">
                                <InputLabel>Seleccionar Colegios</InputLabel>
                                <Select
                                    multiple
                                    value={selectedSupervisorSchools}
                                    onChange={(e) => setSelectedSupervisorSchools(Array.isArray(e.target.value) ? e.target.value : [e.target.value])}
                                    label="Seleccionar Colegios"
                                    renderValue={(selected) => staffSchoolsSummary(assignableSchools, selected, assignableSchoolsState)}
                                >
                                    {visibleStaffSchoolOptions(assignableSchools, initialStaffSchoolIds).map(s => (
                                        <MenuItem key={s.id} value={s.id}>
                                            <Checkbox checked={selectedSupervisorSchools.includes(s.id)} />
                                            <ListItemText primary={staffSchoolLabel(assignableSchools, s.id)} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Typography variant="subtitle1" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>
                                Corporaciones
                            </Typography>
                            <FormControl fullWidth sx={{ mb: 2 }} size="small">
                                <InputLabel>Seleccionar Corporaciones</InputLabel>
                                <Select
                                    multiple
                                    value={selectedSupervisorCorporations}
                                    onChange={(e) => setSelectedSupervisorCorporations(Array.isArray(e.target.value) ? e.target.value : [e.target.value])}
                                    label="Seleccionar Corporaciones"
                                    renderValue={(selected) => selected.map(id => (corporations.find(c => c.id === id)?.name || id)).join(', ')}
                                >
                                    {corporations.map(c => (
                                        <MenuItem key={c.id} value={c.id}>
                                            <Checkbox checked={selectedSupervisorCorporations.includes(c.id)} />
                                            <ListItemText primary={c.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Typography variant="subtitle2" sx={{ mt: 2 }}>Pilotos enlazados automáticamente:</Typography>
                            <Paper variant="outlined" sx={{ p: 2, maxHeight: '200px', overflowY: 'auto', mb: 2 }}>
                                {(() => {
                                    // Compute pilots that belong to selected schools or corporations
                                    const schoolPilots = selectedSupervisorSchools.length > 0 
                                        ? allPilots.filter(p => {
                                            const schoolId = Number(p.school);
                                            return Boolean(schoolId) && selectedSupervisorSchools.includes(canonicalSchoolIdById.get(schoolId) ?? schoolId);
                                        })
                                        : [];
                                    const corpPilots = selectedSupervisorCorporations.length > 0
                                        ? allPilots.filter(p => selectedSupervisorCorporations.includes(Number(p.corporationId)))
                                        : [];
                                    const allLinkedPilots = [...schoolPilots, ...corpPilots];
                                    
                                    if (allLinkedPilots.length === 0) {return (
                                        <Typography variant="body2" color="text.secondary">No se seleccionaron clientes o no hay pilotos asignados.</Typography>
                                    );}
                                    
                                    // Remove duplicates by ID
                                    const uniquePilots = allLinkedPilots.filter((p, idx, arr) => 
                                        arr.findIndex(pilot => pilot.id === p.id) === idx
                                    );
                                    
                                    return uniquePilots.map(p => (
                                        <Typography key={p.id} variant="body2">{p.name} — {p.email} (ID: {p.id})</Typography>
                                    ));
                                })()}
                            </Paper>
                        </Box>
                    )}
                    {!isSelfEdit && Number(selectedUser?.roleId) === 7 && (
                        <Box sx={{ mt: 3, clear: 'both', width: '100%' }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                                Clientes a cargo
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Selecciona uno o más colegios; todas las monitoras asignadas serán enlazadas automáticamente.
                            </Typography>

                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                Colegios
                            </Typography>
                            <FormControl fullWidth sx={{ mb: 2 }} size="small">
                                <InputLabel>Seleccionar Colegios</InputLabel>
                                <Select
                                    multiple
                                    value={selectedAuxiliarSchools}
                                    onChange={(e) => setSelectedAuxiliarSchools(Array.isArray(e.target.value) ? e.target.value : [e.target.value])}
                                    label="Seleccionar Colegios"
                                    renderValue={(selected) => staffSchoolsSummary(assignableSchools, selected, assignableSchoolsState)}
                                >
                                    {visibleStaffSchoolOptions(assignableSchools, initialStaffSchoolIds).map(s => (
                                        <MenuItem key={s.id} value={s.id}>
                                            <Checkbox checked={selectedAuxiliarSchools.includes(s.id)} />
                                            <ListItemText primary={staffSchoolLabel(assignableSchools, s.id)} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Typography variant="subtitle1" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>
                                Corporaciones
                            </Typography>
                            <FormControl fullWidth sx={{ mb: 2 }} size="small">
                                <InputLabel>Seleccionar Corporaciones</InputLabel>
                                <Select
                                    multiple
                                    value={selectedAuxiliarCorporations}
                                    onChange={(e) => setSelectedAuxiliarCorporations(Array.isArray(e.target.value) ? e.target.value : [e.target.value])}
                                    label="Seleccionar Corporaciones"
                                    renderValue={(selected) => selected.map(id => (corporations.find(c => c.id === id)?.name || id)).join(', ')}
                                >
                                    {corporations.map(c => (
                                        <MenuItem key={c.id} value={c.id}>
                                            <Checkbox checked={selectedAuxiliarCorporations.includes(c.id)} />
                                            <ListItemText primary={c.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Typography variant="subtitle2" sx={{ mt: 2 }}>Monitoras enlazadas automáticamente:</Typography>
                            <Paper variant="outlined" sx={{ p: 2, maxHeight: '200px', overflowY: 'auto', mb: 2 }}>
                                {(() => {
                                    // Compute monitoras that belong to selected schools or corporations.
                                    // A monitora's school may be a sibling-cycle record of the selected
                                    // one, so compare canonical ids.
                                    const schoolMonitoras = selectedAuxiliarSchools.length > 0
                                        ? allMonitoras.filter(m => {
                                            const schoolId = Number(m.school);
                                            if (!schoolId) {
                                                return false;
                                            }
                                            return selectedAuxiliarSchools.includes(canonicalSchoolIdById.get(schoolId) ?? schoolId);
                                        })
                                        : [];
                                    const corpMonitoras = selectedAuxiliarCorporations.length > 0
                                        ? allMonitoras.filter(m => selectedAuxiliarCorporations.includes(Number(m.corporationId)))
                                        : [];
                                    const allLinkedMonitoras = [...schoolMonitoras, ...corpMonitoras];
                                    
                                    if (allLinkedMonitoras.length === 0) {return (
                                        <Typography variant="body2" color="text.secondary">No se seleccionaron clientes o no hay monitoras asignadas.</Typography>
                                    );}
                                    
                                    // Remove duplicates by ID
                                    const uniqueMonitoras = allLinkedMonitoras.filter((m, idx, arr) => 
                                        arr.findIndex(monitora => monitora.id === m.id) === idx
                                    );
                                    
                                    return uniqueMonitoras.map(m => (
                                        <Typography key={m.id} variant="body2">{m.name} — {m.email} (ID: {m.id})</Typography>
                                    ));
                                })()}
                            </Paper>
                        </Box>
                    )}
                </Grid>
            </AppDialog>

            {/* Diálogo Carga Masiva */}
            <BulkUploadDialog
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                title="Carga masiva de usuarios"
                description={[
                    'Sube un archivo Excel o CSV con las columnas necesarias, usando la plantilla.',
                    'Las listas de colegios y corporaciones están en la hoja "Listas" de la plantilla.',
                ]}
                templateObject="usuarios"
                successLabel="Usuarios creados o actualizados"
                buildTemplate={buildUserTemplate}
                upload={async (file) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await api.post('/users/bulk-upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    return response.data;
                }}
                onUploaded={() => {
                    invalidateCatalog('pilots');
                    invalidateCatalog('monitors');
                    fetchUsers();
                }}
            />

            {/* Reporte de rutas eliminado */}

            

            {/* Diálogo para descargar todos los usuarios */}
            <AppDialog
                open={downloadAllDialogOpen}
                onClose={() => setDownloadAllDialogOpen(false)}
                title="Descargar todos los usuarios"
                icon={<FileDownloadIcon />}
                size="sm"
                onSubmit={() => {
                    handleDownloadAllUsers(downloadCategory, selectedClientForDownload);
                    setDownloadAllDialogOpen(false);
                }}
                submitLabel="Descargar"
            >
                <FormControl fullWidth>
                    <InputLabel>Filtrar por</InputLabel>
                    <Select
                        value={downloadCategory}
                        label="Filtrar por"
                        onChange={(e) => { setDownloadCategory(e.target.value); setSelectedClientForDownload(null); }}
                    >
                        <MenuItem value=""> 
                            <em>Selecciona...</em>
                        </MenuItem>
                        <MenuItem value="Colegios">Colegios</MenuItem>
                        <MenuItem value="Corporaciones">Corporaciones</MenuItem>
                        <MenuItem value="Sin afiliación">Sin afiliación</MenuItem>
                    </Select>
                </FormControl>

                {downloadCategory === 'Colegios' && (
                    <Box sx={{ mt: 2 }}>
                        <Autocomplete
                            options={clientFilterSchools}
                            getOptionLabel={(opt) => opt?.name || ''}
                            value={selectedClientForDownload}
                            onChange={(e, v) => setSelectedClientForDownload(v)}
                            renderInput={(params) => <TextField {...params} label="Selecciona colegio" />}
                            fullWidth
                        />
                    </Box>
                )}

                {downloadCategory === 'Corporaciones' && (
                    <Box sx={{ mt: 2 }}>
                        <Autocomplete
                            options={corporations}
                            getOptionLabel={(opt) => opt?.name || ''}
                            value={selectedClientForDownload}
                            onChange={(e, v) => setSelectedClientForDownload(v)}
                            renderInput={(params) => <TextField {...params} label="Selecciona corporación" />}
                            fullWidth
                        />
                    </Box>
                )}

                {downloadCategory === 'Sin afiliación' && (
                    <Box sx={{ mt: 2 }}>
                        <DialogContentText>Se descargarán usuarios que no pertenecen a ningún colegio ni corporación.</DialogContentText>
                    </Box>
                )}
            </AppDialog>
        </PageContainer>
    );
};

export default RolesManagementPage;
