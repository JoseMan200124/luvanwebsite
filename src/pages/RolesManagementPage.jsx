import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    CircularProgress,
    Grid,
    Box,
    // Link,
    useMediaQuery,
    useTheme,
    Chip,
    TableSortLabel,
    FormControlLabel,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Tooltip,
    IconButton
} from '@mui/material';
import { Snackbar, Alert } from '@mui/material';
import {
    Edit,
    Delete,
    Add,
    FileUpload,
    DirectionsBus,
    Mail,
    FileDownload
} from '@mui/icons-material';
import StudentScheduleModal from '../components/modals/StudentScheduleModal';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import CircularMasivaModal from '../components/CircularMasivaModal';
import * as XLSX from 'xlsx';

/* ================== Responsive Table & Mobile Cards =================== */
// Contenedor principal de la página
const RolesContainer = styled.div`
    padding: 16px;
`;

// Opciones de roles disponibles en el sistema (sin incluir Padre)
const roleOptions = [
    { id: 1, name: 'Administrador' },
    { id: 2, name: 'Gestor' },
    { id: 4, name: 'Monitora' },
    { id: 5, name: 'Piloto' },
    { id: 6, name: 'Supervisor' },
    { id: 7, name: 'Auxiliar' }
];

const ResponsiveTableHead = styled(TableHead)`
    @media (max-width: 600px) {
        display: none;
    }
`;
const ResponsiveTableCell = styled(TableCell)`
    @media (max-width: 600px) {
        display: block;
        text-align: right;
        position: relative;
        padding-left: 50%;
        white-space: nowrap;
        &:before {
            content: attr(data-label);
            position: absolute;
            left: 0;
            width: 45%;
            padding-left: 15px;
            font-weight: bold;
            text-align: left;
            white-space: nowrap;
        }
    }
`;
const MobileCard = styled(Paper)`
    padding: 16px;
    margin-bottom: 16px;
`;
const MobileField = styled(Box)`
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
`;
const MobileLabel = styled(Typography)`
    font-weight: bold;
    font-size: 0.875rem;
    color: #555;
`;
const MobileValue = styled(Typography)`
    font-size: 1rem;
`;

// (helpers de tiempo y periodo eliminados porque ya no se usan en esta página)

// Helper para saber si un usuario es "nuevo"
function isUserNew(user) {
    if (!user.FamilyDetail) return false;
    if (user.FamilyDetail.source !== 'enrollment') return false;
    if (user.FamilyDetail.isNew === false) return false;
    const createdAt = new Date(user.createdAt);
    const now = new Date();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
}

// Helper para saber si el apellido de familia está duplicado
function isFamilyLastNameDuplicated(user, allUsers) {
    if (!user.FamilyDetail || !user.FamilyDetail.familyLastName) return false;
    const lastName = user.FamilyDetail.familyLastName.trim().toLowerCase();
    if (!lastName) return false;
    // Cuenta cuántos usuarios tienen el mismo apellido de familia (ignorando mayúsculas/minúsculas)
    const count = allUsers.filter(
        u =>
            u.FamilyDetail &&
            u.FamilyDetail.familyLastName &&
            u.FamilyDetail.familyLastName.trim().toLowerCase() === lastName
    ).length;
    return count > 1;
}

// Helpers para sort
function descendingComparator(a, b, orderBy) {
    const aValue = getFieldValue(a, orderBy);
    const bValue = getFieldValue(b, orderBy);
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
        return bValue.localeCompare(aValue);
    }
    if (bValue < aValue) return -1;
    if (bValue > aValue) return 1;
    return 0;
}
function getComparator(order, orderBy) {
    return order === 'desc'
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
}
function stableSort(array, comparator) {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
}
function getFieldValue(user, field) {
    switch (field) {
        case 'name':
            return user.name;
        case 'email':
            return user.email;
        case 'familyLastName':
            return user.FamilyDetail ? user.FamilyDetail.familyLastName : '';
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

/* Nuevo diálogo para envío manual de contrato */
const SendContractDialog = ({ open, onClose, user, contracts, onSent }) => {
    const [selectedContract, setSelectedContract] = useState('');
    const [loading, setLoading] = useState(false);

    // Mostrar contratos del colegio del usuario y los globales (schoolId null)
    const filteredContracts = contracts.filter(
        c =>
            c.schoolId === null ||
            Number(c.schoolId) === Number(user.school)
    );

    // Seleccionar automáticamente el contrato del colegio si existe
    useEffect(() => {
        if (open && user && contracts.length > 0) {
            const contractForSchool = contracts.find(
                c => Number(c.schoolId) === Number(user.school)
            );
            setSelectedContract(contractForSchool ? contractForSchool.uuid : '');
        }
    }, [open, user, contracts]);

    const handleSend = async () => {
        if (!selectedContract) return;
        setLoading(true);
        try {
            const contractResp = await api.get(`/contracts/${selectedContract}`);
            const contract = contractResp.data;
            if (contract && user.email) {
                const fatherShareUrl = `${contract.url}?parentId=${user.id}`;
                await api.post('/mail/send', {
                    to: user.email,
                    subject: 'Enlace de Contrato Asignado (Manual)',
                    html: `
            <h1>Hola, ${user.name}</h1>
            <p>Te han asignado el contrato <strong>${contract.title}</strong>.</p>
            <p>Puedes llenarlo en el siguiente enlace:
            <a href="${fatherShareUrl}" target="_blank">${fatherShareUrl}</a></p>
            <br/>
            <p>Atentamente, Sistema de Contratos</p>
          `
                });
                onSent();
            }
        } catch (err) {
            console.error('Error enviando contrato manualmente:', err);
        }
        setLoading(false);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Enviar Contrato Manualmente</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Selecciona el contrato que deseas enviar a <strong>{user?.name}</strong>.
                </DialogContentText>
                <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Contrato</InputLabel>
                    <Select
                        value={selectedContract}
                        onChange={(e) => setSelectedContract(e.target.value)}
                        label="Contrato"
                    >
                        <MenuItem value="">
                            <em>Ninguno</em>
                        </MenuItem>
                        {filteredContracts.map((c) => (
                            <MenuItem key={c.uuid} value={c.uuid}>
                                {c.title}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSend} variant="contained" disabled={loading || !selectedContract}>
                    {loading ? 'Enviando...' : 'Enviar Contrato'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const RolesManagementPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    useContext(AuthContext);

    const [users, setUsers] = useState([]);
    const [schools, setSchools] = useState([]);
    // Buses no longer needed for route report generation (slots carry routeNumber)
    const [contracts, setContracts] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [duplicateFilter, setDuplicateFilter] = useState('all');

    const [familyDetail, setFamilyDetail] = useState({
        familyLastName: '',
        motherName: '',
        motherCellphone: '',
        motherEmail: '',
        fatherName: '',
        fatherCellphone: '',
        fatherEmail: '',
        razonSocial: '',
        nit: '',
        mainAddress: '',
        alternativeAddress: '',
        routeType: '',
        students: [],
        scheduleSlots: [],
        specialFee: 0
    });
    const [originalStudents, setOriginalStudents] = useState([]);
    const [newStudent, setNewStudent] = useState({ fullName: '', grade: '' });
    // Se elimina la gestión de contrato en el diálogo de edición
    // const [selectedContractUuid, setSelectedContractUuid] = useState('');

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const [allPilots, setAllPilots] = useState([]);
    const [selectedSupervisorPilots, setSelectedSupervisorPilots] = useState([]);

    const [allMonitoras, setAllMonitoras] = useState([]);
    const [selectedAuxiliarMonitoras, setSelectedAuxiliarMonitoras] = useState([]);

    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    const [, setSchoolGrades] = useState([]);
    const [openCircularModal, setOpenCircularModal] = useState(false);
    // bulk editors removed
    const [openStudentScheduleModal, setOpenStudentScheduleModal] = useState(false);
    const [scheduleStudentId, setScheduleStudentId] = useState(null);
    const [scheduleSchoolId, setScheduleSchoolId] = useState(null);
    const [scheduleModalStudents, setScheduleModalStudents] = useState([]);

    // Submodal para asignar buses (sólo para padres) - removed unused state

    // Nuevo diálogo para envío manual de contrato
    const [openSendContractDialog, setOpenSendContractDialog] = useState(false);
    const [selectedUserForManualSend, setSelectedUserForManualSend] = useState(null);

    // Dialogs para descargar usuarios (nuevos / todos)
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
    const [downloadAllDialogOpen, setDownloadAllDialogOpen] = useState(false);
    const [selectedSchoolForDownload, setSelectedSchoolForDownload] = useState('');

    // (Reporte de rutas removido de la página)

    // Filtros
    const [newUsersFilter, setNewUsersFilter] = useState('all');
    const [updatedFilter, setUpdatedFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('');

    // Orden
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('');

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    useEffect(() => {
        fetchUsers();
        fetchSchools();
    // fetchBuses removed: not needed for route report
        fetchContracts();
        fetchAllPilots();
        fetchAllMonitoras();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [updatedFilter, duplicateFilter]);

    const fetchAllPilots = async () => {
        try {
            const resp = await api.get('/users/pilots');
            setAllPilots(resp.data.users || []);
        } catch (error) {
            console.error('[fetchAllPilots] Error:', error);
            setAllPilots([]);
        }
    };

    const fetchAllMonitoras = async () => {
        try {
            const resp = await api.get('/users/monitors');
            setAllMonitoras(resp.data.users || []);
        } catch (error) {
            console.error('[fetchAllMonitoras] Error:', error);
            setAllMonitoras([]);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/users');
            setUsers(response.data.users || []);
        } catch (err) {
            console.error('[fetchUsers] Error:', err);
            setSnackbar({ open: true, message: 'Error al obtener usuarios', severity: 'error' });
        }
        setLoading(false);
    };

    const fetchSchools = async () => {
        try {
            const resp = await api.get('/schools');
            setSchools(resp.data.schools || []);
        } catch (err) {
            console.error('[fetchSchools] Error:', err);
            setSnackbar({ open: true, message: 'Error al obtener colegios', severity: 'error' });
        }
    };

    // Removed fetchBuses

    const fetchContracts = async () => {
        try {
            const resp = await api.get('/contracts');
            setContracts(resp.data || []);
        } catch (err) {
            console.error('[fetchContracts] Error:', err);
        }
    };

    const fetchSchoolGrades = async (schoolId) => {
        try {
            const response = await api.get(`/schools/${schoolId}`);
            if (response.data && response.data.school && Array.isArray(response.data.school.grades)) {
                setSchoolGrades(response.data.school.grades);
            } else {
                setSchoolGrades([]);
            }
        } catch (error) {
            console.error('[fetchSchoolGrades] Error:', error);
            setSchoolGrades([]);
        }
    };

    const handleToggleSupervisorPilot = useCallback((pilotId) => {
        setSelectedSupervisorPilots(prev => {
            if (prev.includes(pilotId)) {
                return prev.filter(x => x !== pilotId);
            } else {
                return [...prev, pilotId];
            }
        });
    }, []);

    const handleToggleAuxiliarMonitora = useCallback((monitoraId) => {
        setSelectedAuxiliarMonitoras(prev => {
            if (prev.includes(monitoraId)) {
                return prev.filter(id => id !== monitoraId);
            } else {
                return [...prev, monitoraId];
            }
        });
    }, []);

    const handleEditClick = async (user) => {
        if (isUserNew(user)) {
            try {
                await api.put(`/users/${user.id}/mark-not-new`);
                await fetchUsers();
            } catch (err) {
                console.error('Error al marcar como NO nuevo:', err);
            }
        }
        // Nuevo: marcar hasUpdatedData como false si es padre y tiene FamilyDetail
        if (Number(user.roleId) === 3 && user.FamilyDetail && user.FamilyDetail.id) {
            try {
                await api.put(`/parents/${user.FamilyDetail.id}/mark-not-updated`);
                await fetchUsers();
            } catch (err) {
                console.error('Error al marcar hasUpdatedData como false:', err);
            }
        }
        const parsedRoleId = Number(user.roleId);
        setSelectedUser({
            ...user,
            roleId: parsedRoleId,
            password: ''
        });
        if (parsedRoleId === 3 && user.FamilyDetail) {
            setFamilyDetail({
                familyLastName: user.FamilyDetail.familyLastName || '',
                motherName: user.FamilyDetail.motherName || '',
                motherCellphone: user.FamilyDetail.motherCellphone || '',
                motherEmail: user.FamilyDetail.motherEmail || '',
                fatherName: user.FamilyDetail.fatherName || '',
                fatherCellphone: user.FamilyDetail.fatherCellphone || '',
                fatherEmail: user.FamilyDetail.fatherEmail || '',
                razonSocial: user.FamilyDetail.razonSocial || '',
                nit: user.FamilyDetail.nit || '',
                mainAddress: user.FamilyDetail.mainAddress || '',
                alternativeAddress: user.FamilyDetail.alternativeAddress || '',
                routeType: user.FamilyDetail.routeType || '',
                students: user.FamilyDetail.Students || [],
                scheduleSlots: user.FamilyDetail.ScheduleSlots || [],
                specialFee: user.FamilyDetail.specialFee ?? 0
            });
            // Guardamos la lista original para comparar
            setOriginalStudents(user.FamilyDetail.Students || []);
            if (user.school) {
                await fetchSchoolGrades(user.school);
            }
        } else {
            setFamilyDetail({
                familyLastName: '',
                motherName: '',
                motherCellphone: '',
                motherEmail: '',
                fatherName: '',
                fatherCellphone: '',
                fatherEmail: '',
                razonSocial: '',
                nit: '',
                mainAddress: '',
                alternativeAddress: '',
                routeType: '',
                students: [],
                scheduleSlots: [],
                specialFee: 0
            });
            setOriginalStudents([]);
        }
        // Nota: El select de contrato NO se muestra en el diálogo de edición
        setSelectedSupervisorPilots([]);
        if (parsedRoleId === 6 || (user.Role && user.Role.name === 'Supervisor')) {
            const newArray = user.supervisorPilots ? user.supervisorPilots.map(sp => Number(sp.pilotId)) : [];
            setSelectedSupervisorPilots(newArray);
        }
        // Para el caso de Auxiliar
        if (user.Role?.name === 'Auxiliar') {
            const auxMonitoras = [];
            try {
                // Intentamos obtener las monitoras asignadas
                const auxMonitorasResp = await api.get(`/users/${user.id}/assigned-monitoras`);
                if (auxMonitorasResp.data && auxMonitorasResp.data.monitoraIds) {
                    // Convertir a números para consistencia
                    auxMonitoras.push(...auxMonitorasResp.data.monitoraIds.map(id => Number(id)));
                }
            } catch (error) {
                console.error('Error al obtener monitoras asignadas al auxiliar:', error);
            }
            setSelectedAuxiliarMonitoras(auxMonitoras);
        } else {
            setSelectedAuxiliarMonitoras([]);
        }
        setOpenDialog(true);
    };

    const handleStudentChange = (index, field, value) => {
        setFamilyDetail(prev => {
            const students = [...prev.students];
            students[index] = { ...students[index], [field]: value };
            return { ...prev, students };
        });
    };

    const handleRemoveStudent = (index) => {
        setFamilyDetail(prev => {
            const students = [...prev.students];
            students.splice(index, 1);
            return { ...prev, students };
        });
    };

    const handleAddUser = () => {
        setSelectedUser({
            id: null,
            name: '',
            email: '',
            password: '',
            roleId: '',
            school: ''
        });
        setFamilyDetail({
            familyLastName:  '',
            motherName: '',
            motherCellphone: '',
            motherEmail: '',
            fatherName: '',
            fatherCellphone: '',
            fatherEmail: '',
            razonSocial: '',
            nit: '',
            mainAddress: '',
            alternativeAddress: '',
            routeType: '',
            students: [],
            scheduleSlots: [],
            specialFee: 0
        });
        setOriginalStudents([]);
        setSelectedSupervisorPilots([]);
        setSchoolGrades([]);
        setOpenDialog(true);
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedUser(null);
        setSelectedSupervisorPilots([]);
    };

    const handleDeleteClick = async (userId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
            try {
                await api.delete(`/users/${userId}`);
                setSnackbar({ open: true, message: 'Usuario eliminado exitosamente', severity: 'success' });
                fetchUsers();
            } catch (err) {
                console.error('[handleDeleteClick] Error:', err);
                setSnackbar({ open: true, message: 'Error al eliminar usuario', severity: 'error' });
            }
        }
    };

    const handleSendContractManually = async (fatherUser) => {
        try {
            if (!fatherUser) return;
            // Se abre el diálogo para envío manual (donde se muestra el select de contratos)
            setSelectedUserForManualSend(fatherUser);
            setOpenSendContractDialog(true);
        } catch (err) {
            console.error('Error en envío manual:', err);
        }
    };

    const handleUserChange = (e) => {
        setSelectedUser(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRoleIdChange = (e) => {
        const newRoleId = Number(e.target.value);
        setSelectedUser(prev => ({ ...prev, roleId: newRoleId }));
    };

    const handleFamilyDetailChange = (e) => {
        setFamilyDetail(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleAddStudent = () => {
        if (!newStudent.fullName) return;
        setFamilyDetail(prev => ({
            ...prev,
            students: [...prev.students, newStudent]
        }));
        setNewStudent({ fullName: '', grade: '' });
    };

    // Horarios de parada gestionados por el modal por alumno; helpers removidos

    const handleSaveUser = async () => {
        try {
            // === Normaliza alumnos CONSERVANDO el id para evitar borrar rutas al editar ===
            const normalizeStudents = (arr = []) =>
                (arr || [])
                    .map(s => ({
                        id: (s?.id ?? null),                         // <<-- clave para que el backend haga match y no borre slots
                        fullName: (s?.fullName ?? '').trim(),
                        grade: (s?.grade ?? '').trim()
                    }))
                    // Orden estable: primero por id (si existe), luego por nombre y grado
                    .sort((a, b) => {
                        const ai = a.id ?? Number.POSITIVE_INFINITY;
                        const bi = b.id ?? Number.POSITIVE_INFINITY;
                        if (ai !== bi) return ai - bi;
                        const byName = a.fullName.localeCompare(b.fullName);
                        if (byName !== 0) return byName;
                        return a.grade.localeCompare(b.grade);
                    });

            // Construye el payload de FamilyDetail SIN schedules (este modal no los edita)
            const familyDetailPayload = { ...familyDetail };
            delete familyDetailPayload.scheduleSlots;
            delete familyDetailPayload.ScheduleSlots; // por compatibilidad

            // Solo envía students si realmente hubo cambios
            const currentStudentsNorm  = normalizeStudents(familyDetail?.students);
            const originalStudentsNorm = normalizeStudents(originalStudents);

            if (
                JSON.stringify(currentStudentsNorm) === JSON.stringify(originalStudentsNorm)
            ) {
                // No hubo cambios de alumnos: no enviar
                delete familyDetailPayload.students;
                delete familyDetailPayload.Students; // por compatibilidad
            } else {
                // Hubo cambios: enviar con id para preservar rutas
                familyDetailPayload.students = currentStudentsNorm;
                delete familyDetailPayload.Students; // por compatibilidad
            }

            const roleIdNum = Number(selectedUser.roleId);

            // Arma el payload del usuario
            let payload = {
                id: selectedUser.id,
                name: selectedUser.name,
                email: selectedUser.email,
                roleId: roleIdNum,
                // Asegura tipo numérico para school
                school: selectedUser.school ? Number(selectedUser.school) : null
            };

            if (selectedUser.password && selectedUser.password.trim() !== '') {
                payload.password = selectedUser.password;
            }

            // Evita pisar phoneNumber si no se está editando
            if (typeof selectedUser.phoneNumber !== 'undefined') {
                payload.phoneNumber = selectedUser.phoneNumber;
            }

            // Solo incluye familyDetail si es Padre
            if (roleIdNum === 3) {
                payload.familyDetail = familyDetailPayload;
            }

            // Supervisor: pilotos a cargo
            if (roleIdNum === 6) {
                payload.supervisorPilots = selectedSupervisorPilots;
            }

            // Auxiliar: monitoras asignadas (comparar con roleId numérico del payload)
            if (roleIdNum === 7) {
                payload.monitorasAsignadas = selectedAuxiliarMonitoras;
            }

            // Crear o actualizar (no envíes id en POST)
            if (selectedUser.id) {
                await api.put(`/users/${selectedUser.id}`, payload);
                setSnackbar({ open: true, message: 'Usuario actualizado exitosamente', severity: 'success' });
            } else {
                const { id, ...payloadForPost } = payload;
                await api.post('/users', payloadForPost);
                setSnackbar({ open: true, message: 'Usuario creado exitosamente', severity: 'success' });
            }

            // Refresca y cierra
            fetchUsers();
            handleDialogClose();
        } catch (err) {
            console.error('[handleSaveUser] Error:', err);
            setSnackbar({ open: true, message: 'Error al guardar usuario', severity: 'error' });
        }
    };


    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // --- MODIFICACIÓN: Se actualiza el filtrado para considerar además el apellido de la familia ---
    const filteredUsers = users.filter((u) => {
        // Ocultar todos los usuarios con rol "Padre" (roleId 3)
        if (Number(u.roleId) === 3) return false;
        
        const matchesSearch =
            (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            ((u.FamilyDetail?.familyLastName || '').toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;
        if (newUsersFilter === 'new') {
            if (!isUserNew(u)) return false;
        } else if (newUsersFilter === 'old') {
            if (isUserNew(u)) return false;
        }
        if (updatedFilter === 'updated') {
            if (!u.FamilyDetail?.hasUpdatedData) return false;
        } else if (updatedFilter === 'notUpdated') {
            if (u.FamilyDetail?.hasUpdatedData) return false;
        }
        if (roleFilter) {
            if (Number(u.roleId) !== Number(roleFilter)) return false;
        }
        if (schoolFilter) {
            if (Number(u.school) !== Number(schoolFilter)) return false;
        }
        if (duplicateFilter === 'duplicated' && !isFamilyLastNameDuplicated(u, users)) return false;
        if (duplicateFilter === 'notDuplicated' && isFamilyLastNameDuplicated(u, users)) return false;

        return true;
    });
    // --- FIN MODIFICACIÓN ---

    const sortedUsers = stableSort(filteredUsers, getComparator(order, orderBy));
    const displayedUsers = sortedUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleOpenBulkDialog = () => {
        setBulkFile(null);
        setBulkResults(null);
        setOpenBulkDialog(true);
    };

    const handleCloseBulkDialog = () => {
        setOpenBulkDialog(false);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setBulkFile(file);
    };

    const handleUploadBulk = async () => {
        if (!bulkFile) return;
        setBulkLoading(true);
        setBulkResults(null);
        const formData = new FormData();
        formData.append('file', bulkFile);
        try {
            const resp = await api.post('/users/bulk-upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setBulkResults(resp.data);
            fetchUsers();
        } catch (error) {
            console.error('[handleUploadBulk] Error:', error);
            setSnackbar({ open: true, message: 'Ocurrió un error al procesar la carga masiva', severity: 'error' });
        }
        setBulkLoading(false);
    };

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

    const handleDownloadNewUsers = (schoolId) => {
        if (!schoolId) {
            setSnackbar({ open: true, message: 'Por favor selecciona un colegio para descargar.', severity: 'warning' });
            return;
        }
    let newUsers = users.filter(u => isUserNew(u) && String(u.school) === String(schoolId));
    // Excluir usuarios con rol 'Padre' (roleId === 3)
    newUsers = newUsers.filter(u => Number(u.roleId) !== 3);
        const headers = [
            "Nombre",
            "Apellido Familia",
            "Correo electrónico",
            "Contraseña",
            "Rol",
            "Colegio",
            "Placa de Bus",
            "Nombre de la Madre",
            "Celular de la Madre",
            "Correo de la Madre",
            "Nombre del Padre",
            "Celular del Padre",
            "Correo del Padre",
            "Razón social",
            "NIT",
            "Dirección Principal",
            "Dirección Alterna",
            "Descuenta especial",
            "Alumno 1",
            "Alumno 2",
            "Alumno 3",
            "Alumno 4",
            "Tipo ruta",
            "Pilotos a Cargo"
        ];
        const data = [];
        data.push(headers);
        newUsers.forEach((u) => {
            const roleName = u.Role ? u.Role.name : "";
            const schoolName = u.School ? u.School.name : "";
            const fd = u.FamilyDetail || {};
            const motherName = fd.motherName || "";
            const motherCell = fd.motherCellphone || "";
            const motherEmail = fd.motherEmail || "";
            const fatherName = fd.fatherName || "";
            const fatherCell = fd.fatherCellphone || "";
            const fatherEmail = fd.fatherEmail || "";
            const razonSocial = fd.razonSocial || "";
            const nit = fd.nit || "";
            const mainAddr = fd.mainAddress || "";
            const altAddr = fd.alternativeAddress || "";
            const specialFee = fd.specialFee || 0;
            const routeType = fd.routeType || "";
            let alumno1 = "";
            let alumno2 = "";
            let alumno3 = "";
            let alumno4 = "";
            if (fd.Students && fd.Students.length) {
                if (fd.Students[0]) alumno1 = fd.Students[0].fullName;
                if (fd.Students[1]) alumno2 = fd.Students[1].fullName;
                if (fd.Students[2]) alumno3 = fd.Students[2].fullName;
                if (fd.Students[3]) alumno4 = fd.Students[3].fullName;
            }
            let pilotosACargoStr = "";
            if (roleName.toLowerCase() === "supervisor" && u.supervisorPilots) {
                const emails = u.supervisorPilots.map(sp => {
                    const pilot = allPilots.find(ap => ap.id === sp.pilotId);
                    return pilot ? pilot.email : "";
                });
                pilotosACargoStr = emails.join(";");
            }
            const row = [
                u.name || "",
                fd.familyLastName || "",
                u.email || "",
                "",
                roleName,
                schoolName,
                "",
                motherName,
                motherCell,
                motherEmail,
                fatherName,
                fatherCell,
                fatherEmail,
                razonSocial,
                nit,
                mainAddr,
                altAddr,
                String(specialFee),
                alumno1,
                alumno2,
                alumno3,
                alumno4,
                routeType,
                pilotosACargoStr
            ];
            data.push(row);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Auto-ajustar ancho de columnas basado en los headers y contenido
        const colWidths = headers.map((header, headerIndex) => {
            // Calcular el ancho mínimo basado en el header y el contenido
            let maxWidth = header.length;

            // Revisar el contenido de cada fila para encontrar el texto más largo en cada columna
            data.slice(1).forEach(row => {
                if (row[headerIndex] !== undefined) {
                    const cellLength = String(row[headerIndex] || "").length;
                    if (cellLength > maxWidth) {
                        maxWidth = cellLength;
                    }
                }
            });

            // Limitar el ancho máximo a 50 caracteres para evitar columnas demasiado anchas
            return { wch: Math.min(Math.max(maxWidth, 10), 50) };
        });

        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "UsuariosNuevos");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        const fileName = `usuarios_nuevos_${getFormattedDateTime()}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadAllUsers = async (schoolId) => {
        try {
            let allUsers = [];
            let page = 0;
            const limit = 500;
            let total = 0;
            let fetched = 0;

            // Primera petición para saber el total
            const firstResp = await api.get('/users', { params: { page, limit } });
            allUsers = firstResp.data.users || [];
            total = firstResp.data.total || allUsers.length;
            fetched = allUsers.length;

            // Si hay más, sigue pidiendo en lotes
            while (fetched < total) {
                page += 1;
                const resp = await api.get('/users', { params: { page, limit } });
                const usersBatch = resp.data.users || [];
                allUsers = allUsers.concat(usersBatch);
                fetched += usersBatch.length;
                if (usersBatch.length === 0) break;
            }

            // Filtrar por colegio seleccionado
            if (!schoolId) {
                setSnackbar({ open: true, message: 'Por favor selecciona un colegio para descargar.', severity: 'warning' });
                return;
            }
            allUsers = allUsers.filter(u => String(u.school) === String(schoolId));
            // Excluir usuarios con rol 'Padre' (roleId === 3)
            allUsers = allUsers.filter(u => Number(u.roleId) !== 3);

            // Generar Excel
            const headers = [
                "Nombre",
                "Apellido Familia",
                "Correo electrónico",
                "Rol",
                "Colegio",
                "Placa de Bus",
                "Nombre de la Madre",
                "Celular de la Madre",
                "Correo de la Madre",
                "Nombre del Padre",
                "Celular del Padre",
                "Correo del Padre",
                "Razón social",
                "NIT",
                "Dirección Principal",
                "Dirección Alterna",
                "Descuento especial",
                "Alumno 1",
                "Alumno 2",
                "Alumno 3",
                "Alumno 4",
                "Tipo ruta",
                "Pilotos a Cargo"
            ];
            const data = [headers];
            allUsers.forEach((u) => {
                const roleName = u.Role ? u.Role.name : "";
                const schoolName = u.School ? u.School.name : "";
                const fd = u.FamilyDetail || {};
                const motherName = fd.motherName || "";
                const motherCell = fd.motherCellphone || "";
                const motherEmail = fd.motherEmail || "";
                const fatherName = fd.fatherName || "";
                const fatherCell = fd.fatherCellphone || "";
                const fatherEmail = fd.fatherEmail || "";
                const razonSocial = fd.razonSocial || "";
                const nit = fd.nit || "";
                const mainAddr = fd.mainAddress || "";
                const altAddr = fd.alternativeAddress || "";
                const specialFee = fd.specialFee || 0;
                const routeType = fd.routeType || "";
                let alumno1 = "";
                let alumno2 = "";
                let alumno3 = "";
                let alumno4 = "";
                if (fd.Students && fd.Students.length) {
                    if (fd.Students[0]) alumno1 = fd.Students[0].fullName;
                    if (fd.Students[1]) alumno2 = fd.Students[1].fullName;
                    if (fd.Students[2]) alumno3 = fd.Students[2].fullName;
                    if (fd.Students[3]) alumno4 = fd.Students[3].fullName;
                }
                let pilotosACargoStr = "";
                if (roleName.toLowerCase() === "supervisor" && u.supervisorPilots) {
                    const emails = u.supervisorPilots.map(sp => {
                        const pilot = allPilots.find(ap => ap.id === sp.pilotId);
                        return pilot ? pilot.email : "";
                    });
                    pilotosACargoStr = emails.join(";");
                }
                const row = [
                    u.name || "",
                    fd.familyLastName || "",
                    u.email || "",
                    roleName,
                    schoolName,
                    "",
                    motherName,
                    motherCell,
                    motherEmail,
                    fatherName,
                    fatherCell,
                    fatherEmail,
                    razonSocial,
                    nit,
                    mainAddr,
                    altAddr,
                    String(specialFee),
                    alumno1,
                    alumno2,
                    alumno3,
                    alumno4,
                    routeType,
                    pilotosACargoStr
                ];
                data.push(row);
            });
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);

            // Auto-ajustar ancho de columnas basado en los headers y contenido
            const colWidths = headers.map((header, headerIndex) => {
                // Calcular el ancho mínimo basado en el header y el contenido
                let maxWidth = header.length;

                // Revisar el contenido de cada fila para encontrar el texto más largo en cada columna
                data.slice(1).forEach(row => {
                    if (row[headerIndex] !== undefined) {
                        const cellLength = String(row[headerIndex] || "").length;
                        if (cellLength > maxWidth) {
                            maxWidth = cellLength;
                        }
                    }
                });

                // Limitar el ancho máximo a 50 caracteres para evitar columnas demasiado anchas
                return { wch: Math.min(Math.max(maxWidth, 10), 50) };
            });

            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
            const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const blob = new Blob([wbout], { type: "application/octet-stream" });
            const fileName = `usuarios_${getFormattedDateTime()}.xlsx`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Error al descargar todos los usuarios',
                severity: 'error'
            });
        }
    };

    const handleDownloadUserTemplate = () => {
        // 1. Prepara listas de referencia
        const colegios = schools.map(s => [s.id, s.name]);
        const tiposRuta = [
            ["Completa"],
            ["Media AM"],
            ["Media PM"]
        ];
        const pilotos = allPilots.map(p => [p.id, p.name]);
        const monitoras = allMonitoras.map(m => [m.id, m.name]);

        // 2. Definir los headers por rol
        const sheets = [
            {
                name: "Gestor",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)"
                ],
                example: [
                    "GestorEjemplo",
                    "gestor@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || ""
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
                name: "Padre",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)",
                    "Nombre de la Madre",
                    "Celular de la Madre",
                    "Correo de la Madre",
                    "Nombre del Padre",
                    "Celular del Padre",
                    "Correo del Padre",
                    "Razón social",
                    "NIT",
                    "Dirección Principal",
                    "Dirección Alterna",
                    "Descuento especial (monto)",
                    "Tipo ruta",
                    "Alumno 1",
                    "Grado Alumno 1",
                    "Alumno 2",
                    "Grado Alumno 2",
                    "Alumno 3",
                    "Grado Alumno 3",
                    "Alumno 4",
                    "Grado Alumno 4",
                ],
                example: [
                    "PadreEjemplo",
                    "padre@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    "María López",
                    "55512345",
                    "maria@email.com",
                    "Carlos Pérez",
                    "55567890",
                    "carlos@email.com",
                    "Razón Social Ejemplo",
                    "1234567-8",
                    "Calle Principal 123",
                    "Avenida Secundaria 456",
                    "0",
                    tiposRuta[0][0],
                    "Alumno Ejemplo 1",
                    "Primero Básico",
                    "Alumno Ejemplo 2",
                    "Segundo",
                    "Alumno Ejemplo 3",
                    "Tercero",
                    "Alumno Ejemplo 4",
                    "Cuarto",
                ]
            },
            {
                name: "Monitora",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)"
                ],
                example: [
                    "MonitoraEjemplo",
                    "moni@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || ""
                ]
            },
            {
                name: "Piloto",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)"
                ],
                example: [
                    "PilotoEjemplo",
                    "piloto@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || ""
                ]
            },
            {
                name: "Supervisor",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)",
                    "Pilotos a Cargo (IDs separados por ;)"
                ],
                example: [
                    "SupervisorEjemplo",
                    "supervisor@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    [pilotos[0]?.[0], pilotos[1]?.[0]].filter(Boolean).join(";")
                ]
            },
            {
                name: "Auxiliar",
                headers: [
                    "Nombre Completo",
                    "Correo electrónico",
                    "Contraseña",
                    "Colegio (ID)",
                    "Monitoras a Cargo (IDs separados por ;)"
                ],
                example: [
                    "AuxiliarEjemplo",
                    "auxiliar@email.com",
                    "contraseña123",
                    colegios[0]?.[0] || "",
                    [monitoras[0]?.[0], monitoras[1]?.[0]].filter(Boolean).join(";")
                ]
            }
        ];

        // 3. Hoja de listas de referencia con columnas separadas y una columna en blanco entre cada bloque
        // Encuentra el máximo de filas para cada bloque para alinear verticalmente
        const maxRows = Math.max(
            colegios.length,
            tiposRuta.length,
            pilotos.length,
            monitoras.length
        );

        const wsListasData = [
            [
                "Colegios (ID)", "Colegios (Nombre)", "", // columna en blanco
                "Tipo de Ruta", "", // columna en blanco
                "Pilotos (ID)", "Pilotos (Nombre)", "",
                "Monitoras (ID)", "Monitoras (Nombre)"
            ]
        ];

        for (let i = 0; i < maxRows; i++) {
            wsListasData.push([
                colegios[i]?.[0] ?? "", colegios[i]?.[1] ?? "", "",
                tiposRuta[i]?.[0] ?? "", "",
                pilotos[i]?.[0] ?? "", pilotos[i]?.[1] ?? "", "",
                monitoras[i]?.[0] ?? "", monitoras[i]?.[1] ?? ""
            ]);
        }

        const wsListas = XLSX.utils.aoa_to_sheet(wsListasData);

        // Ajusta el ancho de cada columna de la hoja Listas
        wsListas['!cols'] = [
            { wch: Math.max("Colegios (ID)".length + 2, 15) },
            { wch: Math.max("Colegios (Nombre)".length + 2, 20) },
            { wch: 2 },
            { wch: Math.max("Tipo de Ruta".length + 2, 15) },
            { wch: 2 },
            { wch: Math.max("Pilotos (ID)".length + 2, 15) },
            { wch: Math.max("Pilotos (Nombre)".length + 2, 20) },
            { wch: 2 },
            { wch: Math.max("Monitoras (ID)".length + 2, 15) },
            { wch: Math.max("Monitoras (Nombre)".length + 2, 20) }
        ];

        // 4. Generar el archivo
        const wb = XLSX.utils.book_new();
        sheets.forEach(sheet => {
            const ws = XLSX.utils.aoa_to_sheet([sheet.headers, sheet.example]);
            ws['!cols'] = sheet.headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
            XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        });
        XLSX.utils.book_append_sheet(wb, wsListas, "Listas");

        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        const fileName = `plantilla_usuarios_${getFormattedDateTime()}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <RolesContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Usuarios y Roles
            </Typography>
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    mb: 2,
                    gap: 2
                }}
            >
                <TextField
                    label="Buscar usuarios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    sx={{ width: '100%', maxWidth: '300px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <FormControl size="small" sx={{ width: 150 }}>
                        <InputLabel>Filtro Nuevo</InputLabel>
                        <Select
                            label="Filtro Nuevo"
                            value={newUsersFilter}
                            onChange={(e) => setNewUsersFilter(e.target.value)}
                        >
                            <MenuItem value="all">Todos</MenuItem>
                            <MenuItem value="new">Nuevos</MenuItem>
                            <MenuItem value="old">No nuevos</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: 150 }}>
                        <InputLabel>Actualizado</InputLabel>
                        <Select
                            label="Actualizado"
                            value={updatedFilter}
                            onChange={(e) => setUpdatedFilter(e.target.value)}
                        >
                            <MenuItem value="all">Todos</MenuItem>
                            <MenuItem value="updated">Actualizados</MenuItem>
                            <MenuItem value="notUpdated">No actualizados</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ width: 150 }}>
                        <InputLabel>Duplicado</InputLabel>
                        <Select
                            label="Duplicado"
                            value={duplicateFilter}
                            onChange={(e) => setDuplicateFilter(e.target.value)}
                        >
                            <MenuItem value="all">Todos</MenuItem>
                            <MenuItem value="duplicated">Duplicados</MenuItem>
                            <MenuItem value="notDuplicated">No duplicados</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ width: 150 }}>
                        <InputLabel>Rol</InputLabel>
                        <Select
                            label="Rol"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>Todos</em>
                            </MenuItem>
                            {roleOptions.map(r => (
                                <MenuItem key={r.id} value={r.id}>
                                    {r.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: 150 }}>
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            label="Colegio"
                            value={schoolFilter}
                            onChange={(e) => setSchoolFilter(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>Todos</em>
                            </MenuItem>
                            {schools.map(sch => (
                                <MenuItem key={sch.id} value={sch.id}>
                                    {sch.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button
                        variant="contained"
                        color="info"
                        startIcon={<FileUpload />}
                        onClick={handleOpenBulkDialog}
                    >
                        Carga Masiva
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Add />}
                        onClick={handleAddUser}
                    >
                        Añadir Usuario
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<FileUpload />}
                        onClick={() => setOpenCircularModal(true)}
                    >
                        Enviar Circular Masiva
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<FileDownload />}
                        onClick={() => setDownloadDialogOpen(true)}
                        sx={{ ml: 1 }}
                    >
                        Descargar Nuevos
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<FileDownload />}
                        onClick={() => setDownloadAllDialogOpen(true)}
                        sx={{ ml: 1 }}
                    >
                        Descargar Todos
                    </Button>
                    {/* Reporte de rutas removido */}
                    {/* bulk editors removed */}
                </div>
            </Box>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {isMobile ? (
                        <>
                            {displayedUsers.map((user) => (
                                <MobileCard key={user.id} elevation={3}>
                                    <Grid container spacing={1}>
                                        <Grid item xs={12}>
                                            <MobileField>
                                                <MobileLabel>Apellido Familia</MobileLabel>
                                                <MobileValue>{user.FamilyDetail ? user.FamilyDetail.familyLastName : '—'}</MobileValue>
                                            </MobileField>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <MobileField>
                                                <MobileLabel>Nombre</MobileLabel>
                                                <MobileValue>
                                                    {user.name}{' '}
                                                    {isUserNew(user) && (
                                                        <Chip label="NUEVO" color="success" size="small" sx={{ ml: 1 }} />
                                                    )}
                                                    {user.FamilyDetail?.hasUpdatedData && (
                                                        <Chip label="ACTUALIZADO" color="info" size="small" sx={{ ml: 1 }} />
                                                    )}
                                                    {isFamilyLastNameDuplicated(user, users) && (
                                                        <Chip label="POSIBLE DUPLICADO" color="warning" size="small" sx={{ ml: 1 }} />
                                                    )}
                                                </MobileValue>
                                            </MobileField>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <MobileField>
                                                <MobileLabel>Correo</MobileLabel>
                                                <MobileValue>{user.email}</MobileValue>
                                            </MobileField>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <MobileField>
                                                <MobileLabel>Rol</MobileLabel>
                                                <MobileValue>{user.Role ? user.Role.name : '—'}</MobileValue>
                                            </MobileField>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <MobileField>
                                                <MobileLabel>Colegio</MobileLabel>
                                                <MobileValue>{user.School ? user.School.name : '—'}</MobileValue>
                                            </MobileField>
                                        </Grid>
                                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
                                            <Tooltip title="Editar">
                                                <IconButton onClick={() => handleEditClick(user)}>
                                                    <Edit />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Eliminar">
                                                <IconButton onClick={() => handleDeleteClick(user.id)}>
                                                    <Delete />
                                                </IconButton>
                                            </Tooltip>
                                            {user.roleId === 3 && (
                                                <>
                                                    <Tooltip title="Asignar Buses">
                                                        <IconButton onClick={() => {
                                                            setSelectedUser(user);
                                                            // open the student schedule modal for this family's students
                                                            setScheduleModalStudents(user.FamilyDetail?.Students || []);
                                                            setScheduleSchoolId(Number(user?.school) || null);
                                                            setOpenStudentScheduleModal(true);
                                                        }}>
                                                            <DirectionsBus />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Enviar Contrato Manualmente">
                                                        <IconButton onClick={() => handleSendContractManually(user)}>
                                                            <Mail />
                                                        </IconButton>
                                                    </Tooltip>
                                                </>
                                            )}
                                        </Grid>
                                    </Grid>
                                </MobileCard>
                            ))}
                            <TablePagination
                                component="div"
                                count={sortedUsers.length}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                rowsPerPageOptions={[5, 10, 25]}
                                labelRowsPerPage="Filas por página"
                            />
                        </>
                    ) : (
                        <Paper sx={{ width: '100%', overflowX: 'auto' }}>
                            <TableContainer sx={{ maxHeight: { xs: 400, sm: 'none' }, overflowX: 'auto' }}>
                                <Table stickyHeader>
                                    <ResponsiveTableHead>
                                        <TableRow>
                                            <TableCell sortDirection={orderBy === 'familyLastName' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'familyLastName'}
                                                    direction={orderBy === 'familyLastName' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('familyLastName')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Apellido Familia
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'name' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'name'}
                                                    direction={orderBy === 'name' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('name')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Nombre
                                                </TableSortLabel>
                                            </TableCell>

                                            <TableCell sortDirection={orderBy === 'email' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'email'}
                                                    direction={orderBy === 'email' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('email')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Correo
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'role' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'role'}
                                                    direction={orderBy === 'role' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('role')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Rol
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'school' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'school'}
                                                    direction={orderBy === 'school' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('school')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Colegio
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'updatedAt' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'updatedAt'}
                                                    direction={orderBy === 'updatedAt' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('updatedAt')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Actualizado el
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </ResponsiveTableHead>
                                    <TableBody>
                                        {displayedUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <ResponsiveTableCell data-label="Apellido Familia">
                                                    {user.FamilyDetail ? user.FamilyDetail.familyLastName : '—'}
                                                </ResponsiveTableCell>
                                                <ResponsiveTableCell data-label="Nombre">
                                                    {user.name}{' '}
                                                    {isUserNew(user) && (
                                                        <Chip label="NUEVO" color="success" size="small" sx={{ ml: 1 }} />
                                                    )}
                                                    {user.FamilyDetail?.hasUpdatedData && (
                                                        <Chip label="ACTUALIZADO" color="info" size="small" sx={{ ml: 1 }} />
                                                    )}
                                                    {isFamilyLastNameDuplicated(user, users) && (
                                                        <Chip label="POSIBLE DUPLICADO" color="warning" size="small" sx={{ ml: 1 }} />
                                                    )}
                                                </ResponsiveTableCell>
                                                <ResponsiveTableCell data-label="Correo">
                                                    {user.email}
                                                </ResponsiveTableCell>
                                                <ResponsiveTableCell data-label="Rol">
                                                    {user.Role ? user.Role.name : '—'}
                                                </ResponsiveTableCell>
                                                <ResponsiveTableCell data-label="Colegio">
                                                    {user.School ? user.School.name : '—'}
                                                </ResponsiveTableCell>
                                                <ResponsiveTableCell data-label="Actualizado el">
                                                    {user.updatedAt
                                                        ? new Date(user.updatedAt).toLocaleString('es-GT', {
                                                              day: '2-digit',
                                                              month: '2-digit',
                                                              year: 'numeric',
                                                              hour: '2-digit',
                                                              minute: '2-digit'
                                                          })
                                                        : '—'}
                                                </ResponsiveTableCell>
                                                <ResponsiveTableCell data-label="Acciones" align="center">
                                                    <Tooltip title="Editar">
                                                        <IconButton onClick={() => handleEditClick(user)}>
                                                            <Edit />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Eliminar">
                                                        <IconButton onClick={() => handleDeleteClick(user.id)}>
                                                            <Delete />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {user.roleId === 3 && (
                                                        <>
                                                            <Tooltip title="Asignar Buses">
                                                                    <IconButton onClick={() => {
                                                                        setSelectedUser(user);
                                                                        // open the student schedule modal for this family's students
                                                                        setScheduleModalStudents(user.FamilyDetail?.Students || []);
                                                                        setScheduleSchoolId(Number(user?.school) || null);
                                                                        setOpenStudentScheduleModal(true);
                                                                    }}>
                                                                        <DirectionsBus />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            <Tooltip title="Enviar Contrato Manualmente">
                                                                <IconButton onClick={() => handleSendContractManually(user)}>
                                                                    <Mail />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </>
                                                    )}
                                                </ResponsiveTableCell>
                                            </TableRow>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <TableRow>
                                                <ResponsiveTableCell colSpan={6} align="center">
                                                    No se encontraron usuarios.
                                                </ResponsiveTableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={sortedUsers.length}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                rowsPerPageOptions={[5, 10, 25]}
                                labelRowsPerPage="Filas por página"
                            />
                        </Paper>
                    )}

                        {/* bulk editors removed */}
                </>
            )}

            {/* Diálogo para crear/editar usuario (En este diálogo NO se muestra el select de contrato) */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>{selectedUser?.id ? 'Editar Usuario' : 'Añadir Usuario'}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedUser?.id
                            ? 'Actualiza la información del usuario.'
                            : 'Completa la información para crear un nuevo usuario.'}
                    </DialogContentText>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                autoFocus
                                name="name"
                                label="Nombre Completo"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={selectedUser?.name || ''}
                                onChange={handleUserChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                name="email"
                                label="Correo Electrónico"
                                type="email"
                                fullWidth
                                variant="outlined"
                                value={selectedUser?.email || ''}
                                onChange={handleUserChange}
                                required
                            />
                        </Grid>
                        {!selectedUser?.id && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    name="password"
                                    label="Contraseña"
                                    type="password"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedUser?.password || ''}
                                    onChange={handleUserChange}
                                    required
                                />
                            </Grid>
                        )}
                        {selectedUser?.id && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    name="password"
                                    label="Nueva Contraseña (opcional)"
                                    type="password"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedUser?.password || ''}
                                    onChange={handleUserChange}
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} md={6}>
                            <FormControl variant="outlined" fullWidth required>
                                <InputLabel>Rol</InputLabel>
                                <Select
                                    name="roleId"
                                    value={selectedUser?.roleId || ''}
                                    onChange={handleRoleIdChange}
                                    label="Rol"
                                >
                                    <MenuItem value="">
                                        <em>Seleccione un rol</em>
                                    </MenuItem>
                                    {roleOptions.map((r) => (
                                        <MenuItem key={r.id} value={r.id}>
                                            {r.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl variant="outlined" fullWidth>
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    name="school"
                                    value={selectedUser?.school || ''}
                                    onChange={async (e) => {
                                        const newSchoolId = e.target.value;
                                        setSelectedUser(prev => ({ ...prev, school: newSchoolId }));
                                        if (Number(selectedUser?.roleId) === 3 && newSchoolId) {
                                            await fetchSchoolGrades(newSchoolId);
                                        }
                                    }}
                                    label="Colegio"
                                >
                                    <MenuItem value="">
                                        <em>Ninguno</em>
                                    </MenuItem>
                                    {schools.map((sch) => (
                                        <MenuItem key={sch.id} value={sch.id}>
                                            {sch.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        {Number(selectedUser?.roleId) === 3 && (
                            <>
                                {/* Se ha removido el select de contrato en el diálogo de edición */}
                                <Typography variant="h6" sx={{ mt: 3, ml: 2 }}>
                                    Datos de la Familia (Padre)
                                </Typography>
                                <Grid container spacing={2} sx={{ mt: 1, pl: 2 }}>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="familyLastName"
                                            label="Apellido de la Familia"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.familyLastName}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="motherName"
                                            label="Nombre de la Madre"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.motherName}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="motherCellphone"
                                            label="Celular de la Madre"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.motherCellphone}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="motherEmail"
                                            label="Correo de la Madre"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.motherEmail}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="fatherName"
                                            label="Nombre del Padre"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.fatherName}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="fatherCellphone"
                                            label="Celular del Padre"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.fatherCellphone}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="fatherEmail"
                                            label="Correo del Padre"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.fatherEmail}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            name="razonSocial"
                                            label="Razón Social"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.razonSocial}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            name="nit"
                                            label="NIT"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.nit}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            name="mainAddress"
                                            label="Dirección Principal"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.mainAddress}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            name="alternativeAddress"
                                            label="Dirección Alterna"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.alternativeAddress}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            name="specialFee"
                                            label="Descuento Especial (monto)"
                                            type="number"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.specialFee}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>Tipo de ruta</InputLabel>
                                            <Select
                                                name="routeType"
                                                label="Tipo de ruta"
                                                value={familyDetail.routeType}
                                                onChange={handleFamilyDetailChange}
                                            >
                                                <MenuItem value="Completa">Completa</MenuItem>
                                                <MenuItem value="Media AM">Media AM</MenuItem>
                                                <MenuItem value="Media PM">Media PM</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                                <Typography variant="h6" sx={{ mt: 3, ml: 2 }}>
                                    Alumnos
                                </Typography>
                                <Grid container spacing={2} sx={{ mt: 1, pl: 2 }}>
                                    {familyDetail.students.map((st, idx) => (
                                        <React.Fragment key={idx}>
                                            <Grid item xs={12} md={5}>
                                                <TextField
                                                    label="Nombre del Alumno"
                                                    fullWidth
                                                    value={st.fullName}
                                                    onChange={e =>
                                                        handleStudentChange(idx, 'fullName', e.target.value)
                                                    }
                                                />
                                            </Grid>
                                            <Grid item xs={10} md={5}>
                                                <TextField

                                                    label="Grado"
                                                    fullWidth
                                                    value={st.grade}
                                                    onChange={e =>
                                                        handleStudentChange(idx, 'grade', e.target.value)
                                                    }
                                                />
                                            </Grid>
                                            <Grid item xs={2} md={2} display="flex" alignItems="center">
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <IconButton
                                                        color="error"
                                                        aria-label="Eliminar alumno"
                                                        onClick={() => handleRemoveStudent(idx)}
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Box>
                                            </Grid>
                                        </React.Fragment>
                                    ))}
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            name="fullName"
                                            label="Nombre Completo del Alumno"
                                            fullWidth
                                            variant="outlined"
                                            value={newStudent.fullName}
                                            onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="grade"
                                            label="Grado"
                                            fullWidth
                                            variant="outlined"
                                            value={newStudent.grade}
                                            onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={2} display="flex" alignItems="center">
                                        <Button variant="outlined" onClick={handleAddStudent} sx={{ mt: 1 }}>
                                            Agregar
                                        </Button>
                                    </Grid>
                                </Grid>
                                {/* Sección 'Horarios de Parada' removida: gestionada ahora por el modal por alumno */}
                            </>
                        )}
                        {Number(selectedUser?.roleId) === 6 && (
                            <Box sx={{ mt: 3, clear: 'both', width: '100%' }}>
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                    Pilotos a cargo
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Selecciona uno o más pilotos que estarán a cargo de este Supervisor.
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, maxHeight: '200px', overflowY: 'auto' }}>
                                    {allPilots.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            No hay pilotos disponibles.
                                        </Typography>
                                    ) : (
                                        allPilots.map((pilot) => {
                                            const checked = selectedSupervisorPilots.includes(pilot.id);
                                            return (
                                                <FormControlLabel
                                                    key={pilot.id}
                                                    control={
                                                        <Checkbox
                                                            checked={checked}
                                                            onChange={() => handleToggleSupervisorPilot(pilot.id)}
                                                            color="primary"
                                                        />
                                                    }
                                                    label={`${pilot.name} - ${pilot.email} (ID: ${pilot.id})`}
                                                    sx={{ display: 'block', mb: 1 }}
                                                />
                                            );
                                        })
                                    )}
                                </Paper>
                            </Box>
                        )}
                        {selectedUser?.roleId === 7 && (
                            <Box sx={{ mt: 3, clear: 'both', width: '100%' }}>
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                    Monitoras a cargo
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Selecciona una o más monitoras que estarán a cargo de este Auxiliar.
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, maxHeight: '200px', overflowY: 'auto' }}>
                                    {allMonitoras.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            No hay monitoras disponibles.
                                        </Typography>
                                    ) : (
                                        allMonitoras.map((monitora) => {
                                            const checked = selectedAuxiliarMonitoras.includes(monitora.id);
                                            return (
                                                <FormControlLabel
                                                    key={monitora.id}
                                                    control={
                                                        <Checkbox
                                                            checked={checked}
                                                            onChange={() => handleToggleAuxiliarMonitora(monitora.id)}
                                                            color="primary"
                                                        />
                                                    }
                                                    label={`${monitora.name} - ${monitora.email} (ID: ${monitora.id})`}
                                                    sx={{ display: 'block', mb: 1 }}
                                                />
                                            );
                                        })
                                    )}
                                </Paper>
                            </Box>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button onClick={handleSaveUser} color="primary" variant="contained">
                        {selectedUser?.id ? 'Guardar Cambios' : 'Crear Usuario'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo Carga Masiva */}
            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Usuarios</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                            Sube un archivo Excel/CSV con las columnas necesarias. Usa la plantilla oficial.<br />
                            <br />
                            Las listas de Colegios, Tipo de Ruta y Pilotos están en la hoja "Listas" de la plantilla.<br />
                            <br />
                            El límite de archivo es 5 MB.
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                        <Button
                            variant="outlined"
                            sx={{ mr: 2 }}
                            color="success"
                            onClick={handleDownloadUserTemplate}
                        >
                            Descargar Plantilla
                        </Button>
                        <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                            Seleccionar Archivo
                            <input type="file" hidden onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
                        </Button>
                        {bulkFile && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                {bulkFile.name}
                            </Typography>
                        )}
                    </Box>
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
                                    <strong>Usuarios creados/actualizados:</strong> {bulkResults.successCount}
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
                    <Button onClick={handleUploadBulk} variant="contained" color="primary" disabled={!bulkFile || bulkLoading}>
                        Subir
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal Circular Masiva */}
            <CircularMasivaModal
                open={openCircularModal}
                onClose={() => setOpenCircularModal(false)}
                schools={schools}
                onSuccess={() => {}}
            />

            {/* Modal para editar horario por alumno (StudentScheduleModal) */}
            <StudentScheduleModal
                studentId={scheduleStudentId}
                students={scheduleModalStudents}
                schoolId={scheduleSchoolId}
                open={openStudentScheduleModal}
                onClose={() => {
                    setOpenStudentScheduleModal(false);
                    setScheduleStudentId(null);
                    setScheduleSchoolId(null);
                    setScheduleModalStudents([]);
                    // refresh users to reflect any schedule changes
                    fetchUsers();
                }}
            />

            {/* Diálogo para envío manual de contrato */}
            {openSendContractDialog && selectedUserForManualSend && (
                <SendContractDialog
                    open={openSendContractDialog}
                    onClose={() => setOpenSendContractDialog(false)}
                    user={selectedUserForManualSend}
                    contracts={contracts}
                    onSent={() => {
                        setSnackbar({ open: true, message: 'Contrato enviado manualmente.', severity: 'success' });
                        fetchUsers();
                    }}
                />
            )}

            {/* Reporte de rutas eliminado */}

            {/* Diálogo para descargar usuarios nuevos */}
            <Dialog open={downloadDialogOpen} onClose={() => setDownloadDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Descargar Usuarios Nuevos</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth>
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            value={selectedSchoolForDownload}
                            label="Colegio"
                            onChange={(e) => setSelectedSchoolForDownload(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>Selecciona un colegio</em>
                            </MenuItem>
                            {schools.map(s => (
                                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDownloadDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={() => { handleDownloadNewUsers(selectedSchoolForDownload); setDownloadDialogOpen(false); }} variant="contained">Descargar</Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo para descargar todos los usuarios */}
            <Dialog open={downloadAllDialogOpen} onClose={() => setDownloadAllDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Descargar Todos los Usuarios</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth>
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            value={selectedSchoolForDownload}
                            label="Colegio"
                            onChange={(e) => setSelectedSchoolForDownload(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>Selecciona un colegio</em>
                            </MenuItem>
                            {schools.map(s => (
                                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDownloadAllDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={() => { handleDownloadAllUsers(selectedSchoolForDownload); setDownloadAllDialogOpen(false); }} variant="contained">Descargar</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </RolesContainer>
    );
};

export default RolesManagementPage;
