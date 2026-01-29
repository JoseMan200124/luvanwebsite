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
import { Autocomplete } from '@mui/material';
import { ListItemText } from '@mui/material';
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

// Fallback static role list (used as initial value, backend will provide authoritative list)
const roleOptionsStatic = [
    { id: 1, name: 'Gestor' },
    { id: 2, name: 'Administrador' },
    { id: 4, name: 'Monitora' },
    { id: 5, name: 'Piloto' },
    { id: 6, name: 'Supervisor' },
    { id: 7, name: 'Auxiliar' }
];

/* ================== Responsive Table & Mobile Cards =================== */
// Contenedor principal de la página
const RolesContainer = styled.div`
    padding: 16px;
`;

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

// Helper para saber si un usuario es "nuevo"
function isUserNew(user) {
    if (!user.FamilyDetail) return false;
    // Only consider families explicitly marked `isNew` and within 21 days
    if (user.FamilyDetail.isNew === false) return false;
    const createdAt = new Date(user.createdAt);
    const now = new Date();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    return user.FamilyDetail.isNew === true && diffDays <= 21;
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
        case 'client':
            return user.School ? user.School.name : (user.corporation ? user.corporation.name : '');
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
    const [corporations, setCorporations] = useState([]);
    const [roleOptions, setRoleOptions] = useState(roleOptionsStatic);
    // Buses no longer needed for route report generation (slots carry routeNumber)
    const [contracts, setContracts] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    

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
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const [allPilots, setAllPilots] = useState([]);
    const [selectedSupervisorSchools, setSelectedSupervisorSchools] = useState([]);
    const [selectedSupervisorCorporations, setSelectedSupervisorCorporations] = useState([]);

    const [allMonitoras, setAllMonitoras] = useState([]);
    const [selectedAuxiliarSchools, setSelectedAuxiliarSchools] = useState([]);
    const [selectedAuxiliarCorporations, setSelectedAuxiliarCorporations] = useState([]);

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

    // Dialog para descargar usuarios
    const [downloadAllDialogOpen, setDownloadAllDialogOpen] = useState(false);
    const [downloadCategory, setDownloadCategory] = useState(''); // 'Colegios' | 'Corporaciones' | 'Sin afiliación'
    const [selectedClientForDownload, setSelectedClientForDownload] = useState(null); // object from schools or corporations

    // (Reporte de rutas removido de la página)

    // Filtros
    const [roleFilter, setRoleFilter] = useState('');
    const [clientFilter, setClientFilter] = useState(null); // { type: 'Colegio'|'Corporación', id, name }

    // Roles allowed to be created from the "Añadir Usuario" dialog
    const allowedRolesForCreate = ['gestor', 'administrador', 'monitora', 'piloto', 'supervisor', 'auxiliar'];
    // Roles that should NOT be assigned a school or corporation
    const rolesWithoutSchoolOrCorp = ['administrador', 'supervisor', 'auxiliar'];

    const roleDisablesSchoolOrCorp = (roleId) => {
        if (!roleId) return false;
        const r = roleOptions.find(ro => Number(ro.id) === Number(roleId));
        if (!r || !r.name) return false;
        return rolesWithoutSchoolOrCorp.includes(String(r.name).toLowerCase());
    };

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
        fetchCorporations();
        fetchRoles();
        fetchContracts();
        fetchAllPilots();
        fetchAllMonitoras();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [roleFilter, clientFilter, searchQuery]);

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

    const fetchRoles = async () => {
        try {
            const resp = await api.get('/roles');
            // API may return { roles: [...] } or an array directly
            const data = resp.data && resp.data.roles ? resp.data.roles : resp.data;
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
            // fetch all non-parent users from backend
            const response = await api.get('/users/non-parents');
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

    const fetchCorporations = async () => {
        try {
            const resp = await api.get('/corporations');
            setCorporations(resp.data.corporations || []);
        } catch (err) {
            console.error('[fetchCorporations] Error:', err);
            setSnackbar({ open: true, message: 'Error al obtener corporaciones', severity: 'error' });
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
            password: '',
            corporationId: user.corporationId || ''
        });
        // Populate monitoraFullName from nested MonitoraDetail if present (tolerant to different casing/keys)
        if (parsedRoleId === 4) {
            const md = user.monitoraDetail || user.MonitoraDetail || null;
            const mdFullName = md && md.fullName ? md.fullName : '';
            setSelectedUser(prev => ({ ...prev, monitoraFullName: mdFullName }));
        }
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
            if (parsedRoleId === 6 || (user.Role && user.Role.name === 'Supervisor')) {
                // If backend provides attachedSupervisorSchools (optional), use it. Otherwise try to infer from user's school
                const attachedSchools = user.attachedSupervisorSchools || [];
                if (attachedSchools.length > 0) {
                    setSelectedSupervisorSchools(attachedSchools.map(s => Number(s)));
                } else if (user.school) {
                    setSelectedSupervisorSchools([Number(user.school)]);
                } else {
                    setSelectedSupervisorSchools([]);
                }
                
                // Load attached corporations for supervisor
                const attachedCorporations = user.attachedSupervisorCorporations || [];
                if (attachedCorporations.length > 0) {
                    setSelectedSupervisorCorporations(attachedCorporations.map(c => Number(c)));
                } else {
                    setSelectedSupervisorCorporations([]);
                }
            }
        
        // Para el caso de Auxiliar
        if (parsedRoleId === 7 || (user.Role && user.Role.name === 'Auxiliar')) {
            console.log('🔍 Auxiliar detected, user data:', { 
                attachedAuxiliarSchools: user.attachedAuxiliarSchools,
                auxiliarSchools: user.auxiliarSchools,
                school: user.school 
            });
            // Load attached schools for auxiliar
            const attachedSchools = user.attachedAuxiliarSchools || [];
            if (attachedSchools.length > 0) {
                setSelectedAuxiliarSchools(attachedSchools.map(s => Number(s)));
            } else if (user.school) {
                setSelectedAuxiliarSchools([Number(user.school)]);
            } else {
                setSelectedAuxiliarSchools([]);
            }
            
            // Temporarily disabled - monitoras not assigned to corporations yet
            // const attachedCorporations = user.attachedAuxiliarCorporations || [];
            // if (attachedCorporations.length > 0) {
            //     setSelectedAuxiliarCorporations(attachedCorporations.map(c => Number(c)));
            // } else {
            //     setSelectedAuxiliarCorporations([]);
            // }
        } else {
            setSelectedAuxiliarSchools([]);
            // setSelectedAuxiliarCorporations([]);
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
            school: '',
            corporationId: ''
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
        setSelectedSupervisorSchools([]);
        setSelectedSupervisorCorporations([]);
        setSelectedAuxiliarSchools([]);
        setSelectedAuxiliarCorporations([]);
        setSchoolGrades([]);
        setOpenDialog(true);
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedUser(null);
        setSelectedSupervisorSchools([]);
        setSelectedSupervisorCorporations([]);
        setSelectedAuxiliarSchools([]);
        setSelectedAuxiliarCorporations([]);
    };

    const handleDeleteClick = async (userId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este usuario de forma PERMANENTE? Esta acción no se puede deshacer.')) {
            try {
                // Soft-delete endpoint (logical delete)
                await api.delete(`/users/${userId}`);
                setSnackbar({ open: true, message: 'Usuario eliminado', severity: 'success' });
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
        // If the selected role should not have school/corporation, clear them when changing
        if (roleDisablesSchoolOrCorp(newRoleId)) {
            setSelectedUser(prev => ({ ...prev, roleId: newRoleId, school: '', corporationId: '' }));
        } else {
            setSelectedUser(prev => ({ ...prev, roleId: newRoleId }));
        }
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
                school: selectedUser.school ? Number(selectedUser.school) : null,
                // Asegura tipo numérico para corporationId
                corporationId: selectedUser.corporationId ? Number(selectedUser.corporationId) : null
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
                if (selectedUser?.school) payload.monitoraDetail.schoolId = Number(selectedUser.school);
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
        setSearchInput(e.target.value);
    };

    const handleApplySearch = () => {
        setSearchQuery(searchInput);
    };

    // Client options for combined Autocomplete (Todos and Sin afiliación first)
    const clientOptions = [
        { type: 'Todos', id: 'all', label: 'Todos' },
        { type: 'Sin afiliación', id: 'none', label: 'Sin afiliación' },
        ...schools.map(s => ({ type: 'Colegio', id: s.id, label: s.name })),
        ...corporations.map(c => ({ type: 'Corporación', id: c.id, label: c.name }))
    ];

    // --- MODIFICACIÓN: Se actualiza el filtrado para considerar además el apellido de la familia ---
    const filteredUsers = users.filter((u) => {
        // Ocultar todos los usuarios con rol "Padre" (roleId 3)
        if (Number(u.roleId) === 3) return false;
        
        const matchesSearch =
            (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            ((u.FamilyDetail?.familyLastName || '').toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;
        if (roleFilter) {
            if (Number(u.roleId) !== Number(roleFilter)) return false;
        }
        if (clientFilter) {
            const cType = clientFilter.type;
            // 'Todos' means no filtering
            if (cType === 'Todos') {
                // do nothing
            } else if (cType === 'Sin afiliación') {
                const hasSchool = !!(u.school) || (Array.isArray(u.attachedAuxiliarSchools) && u.attachedAuxiliarSchools.length > 0) || (Array.isArray(u.attachedSupervisorSchools) && u.attachedSupervisorSchools.length > 0);
                const hasCorp = !!(u.corporationId || u.corporation) || (Array.isArray(u.attachedSupervisorCorporations) && u.attachedSupervisorCorporations.length > 0) || (Array.isArray(u.attachedAuxiliarCorporations) && u.attachedAuxiliarCorporations.length > 0);
                if (hasSchool || hasCorp) return false;
            } else {
                const cId = Number(clientFilter.id);
                if (cType === 'Colegio') {
                    if (Number(u.school) === cId) {
                        // ok
                    } else if (Array.isArray(u.attachedSupervisorSchools) && u.attachedSupervisorSchools.map(Number).includes(cId)) {
                        // ok
                    } else if (Array.isArray(u.attachedAuxiliarSchools) && u.attachedAuxiliarSchools.map(Number).includes(cId)) {
                        // ok
                    } else {
                        return false;
                    }
                } else if (cType === 'Corporación') {
                    if (Number(u.corporationId) === cId) {
                        // ok
                    } else if (Array.isArray(u.attachedSupervisorCorporations) && u.attachedSupervisorCorporations.map(Number).includes(cId)) {
                        // ok
                    } else if (Array.isArray(u.attachedAuxiliarCorporations) && u.attachedAuxiliarCorporations.map(Number).includes(cId)) {
                        // ok
                    } else {
                        return false;
                    }
                }
            }
        }
        

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
        

        

    const handleDownloadAllUsers = async (category, clientObj) => {
        try {
            let allUsers = [];
            let page = 0;
            const limit = 500;
            let total = 0;
            let fetched = 0;

            // Decide params: when category is Colegio/Corporación ask backend to filter so attached supervisors/auxiliares are included
            const baseParams = { page: 0, limit };
            if (category === 'Colegios') {
                const schoolId = clientObj ? clientObj.id : null;
                if (!schoolId) {
                    setSnackbar({ open: true, message: 'Por favor selecciona un colegio para descargar.', severity: 'warning' });
                    return;
                }
                baseParams.schoolId = schoolId;
            } else if (category === 'Corporaciones') {
                const corpId = clientObj ? clientObj.id : null;
                if (!corpId) {
                    setSnackbar({ open: true, message: 'Por favor selecciona una corporación para descargar.', severity: 'warning' });
                    return;
                }
                baseParams.corporationId = corpId;
            }

            // Primera petición para saber el total (pedimos al backend según params)
            let resp = await api.get('/users/non-parents', { params: baseParams });
            allUsers = resp.data.users || [];
            total = resp.data.total || allUsers.length;
            fetched = allUsers.length;

            // Si hay más, sigue pidiendo en lotes conservando los mismos filtros
            while (fetched < total) {
                page += 1;
                const params = { ...baseParams, page };
                const batchResp = await api.get('/users/non-parents', { params });
                const usersBatch = batchResp.data.users || [];
                allUsers = allUsers.concat(usersBatch);
                fetched += usersBatch.length;
                if (usersBatch.length === 0) break;
            }

            // Filtrar según categoría seleccionada
            if (!category) {
                setSnackbar({ open: true, message: 'Por favor selecciona una opción para descargar.', severity: 'warning' });
                return;
            }

            if (category === 'Colegios') {
                const schoolId = clientObj ? clientObj.id : null;
                if (!schoolId) {
                    setSnackbar({ open: true, message: 'Por favor selecciona un colegio para descargar.', severity: 'warning' });
                    return;
                }
                allUsers = allUsers.filter(u => String(u.school) === String(schoolId));
            } else if (category === 'Corporaciones') {
                const corpId = clientObj ? clientObj.id : null;
                if (!corpId) {
                    setSnackbar({ open: true, message: 'Por favor selecciona una corporación para descargar.', severity: 'warning' });
                    return;
                }
                allUsers = allUsers.filter(u => String(u.corporationId || u.corporation?.id || '') === String(corpId));
            } else if (category === 'Sin afiliación') {
                allUsers = allUsers.filter(u => !(u.school || u.corporationId || u.corporation));
            }
            // Excluir usuarios con rol 'Padre' (roleId === 3)
            allUsers = allUsers.filter(u => Number(u.roleId) !== 3);

            // Generar Excel (solo columnas solicitadas)
            const headers = [
                'Colegio',
                'Rol',
                'Nombre',
                'Correo electrónico',
                'Pilotos a Cargo',
                'Monitoras a Cargo'
            ];
            const data = [headers];
            allUsers.forEach((u) => {
                const roleName = u.Role ? u.Role.name : "";
                const schoolName = u.School ? u.School.name : "";

                let pilotosACargoStr = "";
                if (roleName.toLowerCase() === "supervisor" && u.supervisorPilots) {
                    const emails = u.supervisorPilots.map(sp => {
                        const pilot = allPilots.find(ap => ap.id === sp.pilotId);
                        return pilot ? pilot.email : "";
                    });
                    pilotosACargoStr = emails.join(";");
                }

                let monitorasACargoStr = "";
                if (roleName.toLowerCase() === "auxiliar") {
                    const possibleRelations = u.auxiliarMonitora || u.auxiliarMonitoras || u.auxiliarMonitoraRelations || u.auxiliarMonitoraIds || [];
                    let ids = [];
                    if (Array.isArray(possibleRelations) && possibleRelations.length > 0) {
                        ids = possibleRelations.map(x => {
                            if (!x) return null;
                            if (typeof x === 'number') return x;
                            if (typeof x === 'object') return x.monitoraId ?? x.monitora?.id ?? x.id ?? null;
                            return null;
                        }).filter(Boolean);
                    }
                    if (ids.length > 0) {
                        const emails = ids.map(id => {
                            const m = allMonitoras.find(am => am.id === id || am.monitoraId === id);
                            return m ? (m.email || m.name || '') : '';
                        }).filter(Boolean);
                        monitorasACargoStr = emails.join(';');
                    } else {
                        const monitorasSame = allMonitoras.filter(am => (u.school && String(am.school) === String(u.school)) || (u.corporationId && String(am.corporationId || am.corporation?.id) === String(u.corporationId)));
                        monitorasACargoStr = monitorasSame.map(m => m.email || m.name || '').filter(Boolean).join(';');
                    }
                }

                const row = [
                    schoolName || '',
                    roleName || '',
                    u.name || '',
                    u.email || '',
                    pilotosACargoStr,
                    monitorasACargoStr
                ];
                data.push(row);
            });
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);

            // Auto-ajustar ancho de columnas
            const colWidths = headers.map((header, headerIndex) => {
                let maxWidth = header.length;
                data.slice(1).forEach(row => {
                    if (row[headerIndex] !== undefined) {
                        const cellLength = String(row[headerIndex] || "").length;
                        if (cellLength > maxWidth) maxWidth = cellLength;
                    }
                });
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
        const corporaciones = corporations.map(c => [c.id, c.name]);
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

        const wsListas = XLSX.utils.aoa_to_sheet(wsListasData);

        // Ajusta el ancho de cada columna de la hoja Listas
        wsListas['!cols'] = [
            { wch: Math.max("Colegios (ID)".length + 2, 15) },
            { wch: Math.max("Colegios (Nombre)".length + 2, 20) },
            { wch: 2 },
            { wch: Math.max("Corporaciones (ID)".length + 2, 15) },
            { wch: Math.max("Corporaciones (Nombre)".length + 2, 20) }
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <TextField
                        label="Buscar usuarios"
                        variant="outlined"
                        size="small"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleApplySearch(); }}
                        sx={{ width: '100%', maxWidth: '300px' }}
                    />
                    <Button variant="contained" size="small" onClick={() => handleApplySearch()}>Buscar</Button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    

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
                            {roleOptions
                                .filter(r => {
                                    const n = String(r.name || '').toLowerCase();
                                    return n !== 'padre' && n !== 'colaborador';
                                })
                                .map(r => (
                                    <MenuItem key={r.id} value={r.id}>
                                        {r.name}
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>
                    <Autocomplete
                        size="small"
                        sx={{ width: 320 }}
                        options={clientOptions}
                        groupBy={(option) => {
                            if (!option) return '';
                            if (option.type === 'Todos' || option.type === 'Sin afiliación') return 'Opciones';
                            if (option.type === 'Colegio') return 'Colegios';
                            if (option.type === 'Corporación') return 'Corporaciones';
                            return '';
                        }}
                        getOptionLabel={(option) => option.label}
                        value={clientFilter}
                        onChange={(e, newVal) => {
                            setClientFilter(newVal || null);
                        }}
                        renderInput={(params) => <TextField {...params} label="Cliente (Todos/Colegios/Corporaciones)" />}
                        clearOnEscape
                    />
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
                                                <MobileLabel>Cliente</MobileLabel>
                                                <MobileValue>{user.School ? user.School.name : (user.corporation ? user.corporation.name : '—')}</MobileValue>
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
                                            <TableCell sortDirection={orderBy === 'client' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'client'}
                                                    direction={orderBy === 'client' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('client')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Cliente
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
                                                <ResponsiveTableCell data-label="Cliente">
                                                    {user.School ? user.School.name : (user.corporation ? user.corporation.name : '—')}
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
                                    {(selectedUser?.id
                                        ? roleOptions
                                        : roleOptions.filter(r => allowedRolesForCreate.includes(String(r.name).toLowerCase()))
                                    ).map((r) => (
                                        <MenuItem key={r.id} value={r.id}>
                                            {r.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        {Number(selectedUser?.roleId) === 4 && (
                            <>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="monitoraFullName"
                                        label="Nombre Completo (Monitora)"
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
                                        label="Número de Teléfono"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={selectedUser?.phoneNumber || ''}
                                        onChange={handleUserChange}
                                    />
                                </Grid>
                            </>
                        )}
                        {!roleDisablesSchoolOrCorp(selectedUser?.roleId) && (
                            <>
                                <Grid item xs={12} md={6}>
                                    <FormControl variant="outlined" fullWidth>
                                        <InputLabel>Colegio</InputLabel>
                                        <Select
                                            name="school"
                                            value={selectedUser?.school || ''}
                                            onChange={async (e) => {
                                                const newSchoolId = e.target.value;
                                                setSelectedUser(prev => ({ 
                                                    ...prev, 
                                                    school: newSchoolId,
                                                    corporationId: newSchoolId ? '' : prev.corporationId
                                                }));
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
                                <Grid item xs={12} md={6}>
                                    <FormControl variant="outlined" fullWidth>
                                        <InputLabel>Corporación</InputLabel>
                                        <Select
                                            name="corporationId"
                                            value={selectedUser?.corporationId || ''}
                                            onChange={(e) => {
                                                const newCorporationId = e.target.value;
                                                setSelectedUser(prev => ({ 
                                                    ...prev, 
                                                    corporationId: newCorporationId,
                                                    school: newCorporationId ? '' : prev.school
                                                }));
                                            }}
                                            label="Corporación"
                                        >
                                            <MenuItem value="">
                                                <em>Ninguna</em>
                                            </MenuItem>
                                            {corporations.map((corp) => (
                                                <MenuItem key={corp.id} value={corp.id}>
                                                    {corp.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </>
                        )}
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
                                        renderValue={(selected) => selected.map(id => (schools.find(s => s.id === id)?.name || id)).join(', ')}
                                    >
                                        {schools.map(s => (
                                            <MenuItem key={s.id} value={s.id}>
                                                <Checkbox checked={selectedSupervisorSchools.includes(s.id)} />
                                                <ListItemText primary={s.name} />
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
                                            ? allPilots.filter(p => selectedSupervisorSchools.includes(Number(p.school)))
                                            : [];
                                        const corpPilots = selectedSupervisorCorporations.length > 0
                                            ? allPilots.filter(p => selectedSupervisorCorporations.includes(Number(p.corporationId)))
                                            : [];
                                        const allLinkedPilots = [...schoolPilots, ...corpPilots];
                                        
                                        if (allLinkedPilots.length === 0) return (
                                            <Typography variant="body2" color="text.secondary">No se seleccionaron clientes o no hay pilotos asignados.</Typography>
                                        );
                                        
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
                        {selectedUser?.roleId === 7 && (
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
                                        renderValue={(selected) => selected.map(id => (schools.find(s => s.id === id)?.name || id)).join(', ')}
                                    >
                                        {schools.map(s => (
                                            <MenuItem key={s.id} value={s.id}>
                                                <Checkbox checked={selectedAuxiliarSchools.includes(s.id)} />
                                                <ListItemText primary={s.name} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Temporarily disabled - monitoras not assigned to corporations yet
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
                                */}

                                <Typography variant="subtitle2" sx={{ mt: 2 }}>Monitoras enlazadas automáticamente:</Typography>
                                <Paper variant="outlined" sx={{ p: 2, maxHeight: '200px', overflowY: 'auto', mb: 2 }}>
                                    {(() => {
                                        // Compute monitoras that belong to selected schools or corporations
                                        const schoolMonitoras = selectedAuxiliarSchools.length > 0 
                                            ? allMonitoras.filter(m => selectedAuxiliarSchools.includes(Number(m.school)))
                                            : [];
                                        // Temporarily disabled - monitoras not assigned to corporations yet
                                        // const corpMonitoras = selectedAuxiliarCorporations.length > 0
                                        //     ? allMonitoras.filter(m => selectedAuxiliarCorporations.includes(Number(m.corporationId)))
                                        //     : [];
                                        const allLinkedMonitoras = [...schoolMonitoras]; // , ...corpMonitoras
                                        
                                        if (allLinkedMonitoras.length === 0) return (
                                            <Typography variant="body2" color="text.secondary">No se seleccionaron clientes o no hay monitoras asignadas.</Typography>
                                        );
                                        
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

            

            {/* Diálogo para descargar todos los usuarios */}
            <Dialog open={downloadAllDialogOpen} onClose={() => setDownloadAllDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Descargar Todos los Usuarios</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 1 }}>
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
                                options={schools}
                                getOptionLabel={(opt) => opt?.name || ''}
                                value={selectedClientForDownload}
                                onChange={(e, v) => setSelectedClientForDownload(v)}
                                renderInput={(params) => <TextField {...params} label="Selecciona Colegio" />}
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
                                renderInput={(params) => <TextField {...params} label="Selecciona Corporación" />}
                                fullWidth
                            />
                        </Box>
                    )}

                    {downloadCategory === 'Sin afiliación' && (
                        <Box sx={{ mt: 2 }}>
                            <DialogContentText>Se descargarán usuarios que no pertenecen a ningún colegio ni corporación.</DialogContentText>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDownloadAllDialogOpen(false)}>Cancelar</Button>
                    <Button
                        onClick={() => {
                            handleDownloadAllUsers(downloadCategory, selectedClientForDownload);
                            setDownloadAllDialogOpen(false);
                        }}
                        variant="contained"
                    >
                        Descargar
                    </Button>
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
