import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TextField,
    IconButton,
    Tooltip,
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
    Checkbox
} from '@mui/material';
import { Snackbar, Alert } from '@mui/material';
import {
    Edit,
    Delete,
    Add,
    FileUpload,
    DirectionsBus,
    Mail
} from '@mui/icons-material';
import StudentScheduleModal from '../components/modals/StudentScheduleModal';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import CircularMasivaModal from '../components/CircularMasivaModal';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

/* ================== Responsive Table & Mobile Cards =================== */
// Contenedor principal de la página
const RolesContainer = styled.div`
    padding: 16px;
`;

// Opciones de roles disponibles en el sistema
const roleOptions = [
    { id: 1, name: 'Administrador' },
    { id: 2, name: 'Gestor' },
    { id: 3, name: 'Padre' },
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

// Helper para extraer un horario HH:mm de diferentes formatos de valores
function extractTime(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        const m = val.match(/(\d{1,2}):(\d{2})/);
        if (m) {
            const hh = m[1].padStart(2, '0');
            const mm = m[2];
            return `${hh}:${mm}`;
        }
        return '';
    }
    if (typeof val === 'number') {
        // e.g., 730 -> 07:30
        const s = String(val);
        if (s.length >= 3) {
            const mm = s.slice(-2);
            const hh = s.slice(0, -2).padStart(2, '0');
            return `${hh}:${mm}`;
        }
        return '';
    }
    if (typeof val === 'object') {
        // Intentar algunas claves comunes
        if (val.time) return extractTime(val.time);
        if (val.start) return extractTime(val.start);
        if (val.hour) return extractTime(val.hour);
        if (val.value) return extractTime(val.value);
        try {
            const str = JSON.stringify(val);
            return extractTime(str);
        } catch (_) {
            return '';
        }
    }
    return '';
}

// Helper para extraer el código de periodo (AM/MD/PM/EX) priorizando schoolSchedule.
// No infiere por hora; solo usa el código explícito si está presente.
function extractPeriodCode(slot) {
    if (!slot) return null;
    const ss = (slot.schoolSchedule ?? '').toString();
    const mSS = ss.match(/\b(AM|MD|PM|EX)\b/i);
    if (mSS && mSS[1]) return mSS[1].toUpperCase();
    // Fallback legacy: si no viene en schoolSchedule, buscar token en slot.time/timeSlot
    const t = (slot.time ?? slot.timeSlot ?? '').toString();
    const mT = t.match(/\b(AM|MD|PM|EX)\b/i);
    if (mT && mT[1]) return mT[1].toUpperCase();
    return null;
}

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

    // Modal para selección de colegio en reporte de rutas
    const [openRouteReportDialog, setOpenRouteReportDialog] = useState(false);
    const [selectedSchoolForReport, setSelectedSchoolForReport] = useState('');
    const [routeReportLoading, setRouteReportLoading] = useState(false);
    const [downloadMode, setDownloadMode] = useState('report'); // 'report' | 'new' | 'all'

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
        const newUsers = users.filter(u => isUserNew(u) && String(u.school) === String(schoolId));
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

    const handleOpenRouteReportDialog = () => {
        setSelectedSchoolForReport('');
        setOpenRouteReportDialog(true);
    };

    const handleCloseRouteReportDialog = () => {
        setOpenRouteReportDialog(false);
        setSelectedSchoolForReport('');
    };

    const handleDownloadRouteReport = async (schoolId) => {
        if (!schoolId) {
            setSnackbar({
                open: true,
                message: 'Por favor selecciona un colegio.',
                severity: 'warning'
            });
            return;
        }

        setRouteReportLoading(true);
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

            // Filtrar solo usuarios padres del colegio seleccionado que tengan ScheduleSlots
            // (a nivel familiar o por estudiante). Según el requisito, solo usamos ScheduleSlots.
            const parentsWithRoutes = allUsers.filter(u =>
                u.Role && (u.Role.name === 'Padre' || (u.Role.name || '').toString().toLowerCase() === 'padre') &&
                u.FamilyDetail &&
                u.school && parseInt(u.school) === parseInt(schoolId) &&
                (
                    (Array.isArray(u.FamilyDetail.ScheduleSlots) && u.FamilyDetail.ScheduleSlots.length > 0) ||
                    (Array.isArray(u.FamilyDetail.Students) && u.FamilyDetail.Students.some(s => Array.isArray(s.ScheduleSlots) && s.ScheduleSlots.length > 0))
                )
            );

            // Agrupar por número de ruta (routeNumber en ScheduleSlots) y contar estudiantes AM/MD/PM
            // Contaremos cada estudiante una sola vez por periodo (AM/MD/PM) por ruta.
            const routeSummary = {};
            // Construir resumen basado únicamente en ScheduleSlots (student.ScheduleSlots o, si falta, family ScheduleSlots filtradas por studentId)
            parentsWithRoutes.forEach(user => {
                const fd = user.FamilyDetail || {};
                if (!fd.Students || fd.Students.length === 0) return;

                fd.Students.forEach(student => {
                    const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                    // Incluir sólo los family slots que aplican al estudiante (sin studentId o con studentId igual al estudiante)
                    const familySlots = Array.isArray(fd.ScheduleSlots) ? fd.ScheduleSlots.filter(s => !s.studentId || Number(s.studentId) === Number(student.id)) : [];
                    const slotsToUse = studentSlots.length > 0 ? studentSlots : familySlots;

                    // Para evitar dobles conteos, acumular por estudiante un conjunto único de (route, period)
                    const studentRoutePeriodSet = new Set();

                    slotsToUse.forEach(slot => {
                        // Determinar routeNumber directamente desde el slot
                        let routeNumber = '';
                        if (slot && slot.routeNumber != null && String(slot.routeNumber).trim() !== '') {
                            routeNumber = String(slot.routeNumber);
                        }
                        // Fallback: si no hay routeNumber definido en el slot, usar una etiqueta neutral
                        if (!routeNumber) routeNumber = 'Sin Ruta';

                        // Detectar periodo únicamente por código explícito (AM/MD/PM/EX)
                        const period = extractPeriodCode(slot);
                        if (!period) return; // si no hay código, no contar este slot

                        // Key único por estudiante para evitar duplicados
                        const key = `${routeNumber}::${period}`;
                        studentRoutePeriodSet.add(key);
                    });

                    // Incrementar el resumen por cada (route, period) único del estudiante
                    studentRoutePeriodSet.forEach(k => {
                        const [routeNumber, period] = k.split('::');
                        if (!routeSummary[routeNumber]) routeSummary[routeNumber] = { cantAM: 0, cantPM: 0, cantMD: 0, cantEX: 0 };
                        if (period === 'AM') routeSummary[routeNumber].cantAM++;
                        else if (period === 'MD') routeSummary[routeNumber].cantMD++;
                        else if (period === 'PM') routeSummary[routeNumber].cantPM++;
                        else if (period === 'EX') routeSummary[routeNumber].cantEX++;
                    });
                });
            });

            // Determinar el número máximo de estudiantes para crear las columnas dinámicas
            // Solo contar familias que tengan al menos un ScheduleSlot (a nivel estudiante o familiar)
            let maxStudents = 0;

            parentsWithRoutes.forEach(user => {
                const fd = user.FamilyDetail || {};
                if (!fd.Students || fd.Students.length === 0) return;

                const hasStudentWithRoute = fd.Students.some(student => {
                    const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                    if (studentSlots.length > 0) {
                        return studentSlots.some(slot => {
                            const timeSlot = extractTime(slot.schoolSchedule || slot.time || slot.timeSlot || '');
                            return /(\d{1,2}):(\d{2})/.test(timeSlot);
                        });
                    }
                    // fallback: check family slots
                    if (Array.isArray(fd.ScheduleSlots) && fd.ScheduleSlots.length > 0) {
                        return fd.ScheduleSlots.some(slot => /(\d{1,2}):(\d{2})/.test(extractTime(slot.schoolSchedule || slot.time || slot.timeSlot || '')));
                    }
                    return false;
                });

                if (hasStudentWithRoute && fd.Students.length > maxStudents) {
                    maxStudents = fd.Students.length;
                }
            });

            // Ordenar las rutas numéricamente cuando sea posible, fallback a orden alfabético
            const sortedRoutes = Object.keys(routeSummary).sort((a, b) => {
                const ma = (a || '').toString().match(/(\d+)/);
                const mb = (b || '').toString().match(/(\d+)/);
                if (ma && mb) return Number(ma[1]) - Number(mb[1]);
                if (ma && !mb) return -1;
                if (!ma && mb) return 1;
                return a.toString().localeCompare(b.toString());
            });

            // Crear Excel con ExcelJS para soporte completo de estilos
            const workbook = new ExcelJS.Workbook();

            // Hoja resumen por rutas (ocupacion)
            const summaryWorksheet = workbook.addWorksheet('OCUPACIÓN POR RUTA');

            // Agregar headers con estilo
            // Incluir EX como franja adicional
            const summaryHeaders = ["No. Ruta", "Cant. AM", "Cant. PM", "Cant. MD", "Cant. EX"];
            const summaryHeaderRow = summaryWorksheet.addRow(summaryHeaders);

            // Estilo para headers del resumen
            summaryHeaderRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' } // Azul
                };
                cell.font = {
                    color: { argb: 'FFFFFFFF' },
                    bold: true
                };
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Agregar datos del resumen
            if (sortedRoutes.length === 0) {
                // Si no hay rutas específicas (keys en routeSummary), crear un resumen
                // analizando únicamente ScheduleSlots a nivel estudiante o familiar
                const timeSummary = { cantAM: 0, cantPM: 0, cantMD: 0, cantEX: 0 };

                parentsWithRoutes.forEach(user => {
                    const fd = user.FamilyDetail || {};
                    if (!fd.Students || fd.Students.length === 0) return;

                    fd.Students.forEach(student => {
                        const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                        const slotsToUse = studentSlots.length > 0 ? studentSlots : (Array.isArray(fd.ScheduleSlots) ? fd.ScheduleSlots : []);

                        if (slotsToUse.length === 0) {
                            // Si no hay slots ni a nivel estudiante ni familiar, contar como AM por defecto
                            timeSummary.cantAM++;
                        } else {
                            slotsToUse.forEach(slot => {
                                const code = extractPeriodCode(slot);
                                if (code === 'AM') timeSummary.cantAM++;
                                else if (code === 'MD') timeSummary.cantMD++;
                                else if (code === 'PM') timeSummary.cantPM++;
                                else if (code === 'EX') timeSummary.cantEX++;
                            });
                        }
                    });
                });

                // Agregar una sola fila con el resumen total
                const rowData = ["Total", timeSummary.cantAM, timeSummary.cantPM, timeSummary.cantMD, timeSummary.cantEX];
                const row = summaryWorksheet.addRow(rowData);
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' }
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                    };
                });
                // Asegurar que las columnas numéricas sean números (excluir horas)
                [2, 3, 4, 5].forEach((colIdx) => {
                    try {
                        const c = row.getCell(colIdx);
                        if (c && c.value != null) {
                            const n = Number(c.value);
                            if (!Number.isNaN(n)) {
                                c.value = n;
                                c.numFmt = '0';
                            }
                        }
                    } catch (e) {
                        // no bloquear si hay error en conversión
                        console.warn('[handleDownloadRouteReport] Numeric conversion error for total row:', e);
                    }
                });
            } else {
                // Usar el resumen por rutas específicas
                sortedRoutes.forEach((routeNumber, index) => {
                    const routeData = routeSummary[routeNumber];
                    const rowData = [routeNumber, routeData.cantAM, routeData.cantPM, routeData.cantMD, routeData.cantEX || 0];
                    const row = summaryWorksheet.addRow(rowData);

                    // Estilo alternado para filas
                    const isEven = (index + 1) % 2 === 0;
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' }
                        };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                            left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                            right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                        };
                    });

                    // Asegurar que las columnas numéricas sean números (No. Ruta y conteos)
                    // Col 1: intentar extraer número de "routeNumber" solo si contiene dígitos
                    try {
                        const c1 = row.getCell(1);
                        if (c1 && c1.value != null) {
                            const m = c1.value.toString().match(/(\d+)/);
                            if (m) {
                                c1.value = Number(m[1]);
                                c1.numFmt = '0';
                            }
                        }
                    } catch (e) {
                        console.warn('[handleDownloadRouteReport] Numeric conversion error for route number:', e);
                    }
                    // Cols 2-5: conteos
                    [2, 3, 4, 5].forEach((colIdx) => {
                        try {
                            const c = row.getCell(colIdx);
                            if (c && c.value != null) {
                                const n = Number(c.value);
                                if (!Number.isNaN(n)) {
                                    c.value = n;
                                    c.numFmt = '0';
                                }
                            }
                        } catch (e) {
                            console.warn('[handleDownloadRouteReport] Numeric conversion error for route row:', e);
                        }
                    });
                });
                // Verificación simple: sumar totales desde routeSummary y loggear para detectar discrepancias
                try {
                    const totalsFromRoutes = { cantAM: 0, cantMD: 0, cantPM: 0, cantEX: 0 };
                    Object.values(routeSummary).forEach(r => {
                        totalsFromRoutes.cantAM += r.cantAM || 0;
                        totalsFromRoutes.cantMD += r.cantMD || 0;
                        totalsFromRoutes.cantPM += r.cantPM || 0;
                        totalsFromRoutes.cantEX += r.cantEX || 0;
                    });
                    console.log('[handleDownloadRouteReport] Totales calculados desde routeSummary:', totalsFromRoutes);
                } catch (e) {
                    // ignore logging errors
                }
            }

            // Auto-ajustar columnas y agregar filtros
            summaryWorksheet.columns.forEach(column => {
                column.width = Math.max(15, column.header ? column.header.length : 10);
            });
            summaryWorksheet.autoFilter = 'A1:E' + summaryWorksheet.rowCount;

            // Congelar la primera fila (encabezados) para que sea sticky
            summaryWorksheet.views = [
                { state: 'frozen', ySplit: 1 }
            ];

            // Hoja de datos de familias
            const familiesWorksheet = workbook.addWorksheet('DATA');

            // Crear headers dinámicos (nuevo orden solicitado)
            // Orden: Apellido Familia, Tipo Ruta, Dirección Principal, Dirección Alterna,
            // (Estudiantes: Nombre, Grado, Hora AM, Parada AM, Hora MD, Parada MD, Hora PM, Parada PM),
            // Nombre Padre, Email Padre
            const baseHeaders = [
                "Apellido Familia",
                "Tipo Ruta",
                "Dirección Principal",
                "Dirección Alterna"
            ];

        // Agregar columnas para estudiantes (nombre, grado) y por día Lunes-Viernes: Hora/Ruta/Parada para AM, MD, PM, EX
            const weekdaysMap = [
                { key: 'monday', label: 'Lunes' },
                { key: 'tuesday', label: 'Martes' },
                { key: 'wednesday', label: 'Miércoles' },
                { key: 'thursday', label: 'Jueves' },
                { key: 'friday', label: 'Viernes' }
            ];
            const studentHeaders = [];
            for (let i = 1; i <= maxStudents; i++) {
                studentHeaders.push(`Estudiante ${i} - Nombre`);
                studentHeaders.push(`Estudiante ${i} - Grado`);
                weekdaysMap.forEach(day => {
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Hora AM`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Ruta AM`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Parada AM`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Hora MD`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Ruta MD`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Parada MD`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Hora PM`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Ruta PM`);
                    studentHeaders.push(`Estudiante ${i} - ${day.label} - Parada PM`);
            studentHeaders.push(`Estudiante ${i} - ${day.label} - Hora EX`);
            studentHeaders.push(`Estudiante ${i} - ${day.label} - Ruta EX`);
            studentHeaders.push(`Estudiante ${i} - ${day.label} - Parada EX`);
                });
            }

            // Agregar columnas de contacto de la madre y el padre
            const headers = [...baseHeaders, ...studentHeaders, 'Nombre Padre', 'Email Padre', 'Nombre Mamá', 'Teléfono Mamá', 'Nombre Papá', 'Teléfono Papá'];
            const familiesHeaderRow = familiesWorksheet.addRow(headers);

            // Estilo para headers de familias
            familiesHeaderRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF70AD47' } // Verde
                };
                cell.font = {
                    color: { argb: 'FFFFFFFF' },
                    bold: true
                };
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Función para verificar si una familia tiene al menos un estudiante con ScheduleSlot parseable
            // Ahora consideramos slot.schoolSchedule (preferido) o slot.time/slot.timeSlot
            const familyHasStudentWithRoute = (user) => {
                const fd = user.FamilyDetail || {};
                if (!fd.Students || fd.Students.length === 0) return false;

                // Verificar ScheduleSlots a nivel familiar
                if (Array.isArray(fd.ScheduleSlots) && fd.ScheduleSlots.length > 0) {
                    if (fd.ScheduleSlots.some(slot => /(\d{1,2}):(\d{2})/.test(extractTime(slot.schoolSchedule || slot.time || slot.timeSlot || '')))) return true;
                }

                // Verificar ScheduleSlots a nivel estudiante
                return fd.Students.some(student => {
                    const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                    return studentSlots.some(slot => /(\d{1,2}):(\d{2})/.test(extractTime(slot.schoolSchedule || slot.time || slot.timeSlot || '')));
                });
            };

            // Filtrar familias que tienen al menos un estudiante con ruta
            const familiesWithRoutes = parentsWithRoutes.filter(familyHasStudentWithRoute);

            // Procesar solo las familias que tienen estudiantes con rutas (ScheduleSlots)
            familiesWithRoutes.forEach((user, familyIndex) => {
                const fd = user.FamilyDetail || {};

                // Nota: las horas y paradas ahora se registran a nivel estudiante usando ScheduleSlots

                // Mantener solo datos estáticos de la familia; las horas/paradas ahora son por estudiante
                const baseData = [
                    fd.familyLastName || "",
                    fd.routeType || "",
                    fd.mainAddress || "",
                    fd.alternativeAddress || ""
                ];

                // Datos de estudiantes (solo nombre, grado y rutas basadas en ScheduleSlots)
                const studentData = [];
                for (let i = 0; i < maxStudents; i++) {
                    if (fd.Students && fd.Students[i]) {
                        const student = fd.Students[i];
                        studentData.push(student.fullName || "");
                        studentData.push(student.grade || "");

                        // Inicializar estructura por día y por periodo (keys en inglés, labels en español para headers)
            const dataByDay = {};
                        weekdaysMap.forEach(d => {
                            dataByDay[d.key] = {
                horaAM: '', paradaAM: '',
                horaMD: '', paradaMD: '',
                horaPM: '', paradaPM: '',
                horaEX: '', paradaEX: ''
                            };
                        });

                        const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                        // Incluir slots familiares que correspondan a este estudiante (slot.studentId === student.id) o que no tengan studentId
                        const familySlots = Array.isArray(fd.ScheduleSlots) ? fd.ScheduleSlots.filter(s => !s.studentId || Number(s.studentId) === Number(student.id)) : [];
                        // Preferir slots específicos del estudiante; si no hay, usar familySlots (que pueden incluir entries por studentId)
                        const slotsToUse = studentSlots.length > 0 ? studentSlots : familySlots;

                        slotsToUse.forEach(slot => {
                            const displayTime = (slot.time || slot.schoolSchedule || slot.timeSlot || '').toString();
                            const note = slot.note || '';

                            // Parsear slot.days robustamente (array, JSON string, or CSV-like)
                            let slotDays = [];
                            if (Array.isArray(slot.days)) {
                                slotDays = slot.days;
                            } else if (typeof slot.days === 'string') {
                                try {
                                    const parsed = JSON.parse(slot.days);
                                    if (Array.isArray(parsed)) slotDays = parsed;
                                    else slotDays = [slot.days];
                                } catch (e) {
                                    // fallback: comma separated
                                    slotDays = slot.days.split ? slot.days.split(',').map(x => x.trim()) : [slot.days];
                                }
                            } else if (slot.days) {
                                slotDays = [slot.days];
                            }

                            // obtener routeNumber directamente del slot
                            let routeLabel = '';
                            if (slot && slot.routeNumber != null && String(slot.routeNumber).trim() !== '') {
                                routeLabel = String(slot.routeNumber);
                            }

                            const paradaDisplay = `${note || ''}`;

                            // Para cada día del slot, asignar al día correspondiente
                            slotDays.forEach(rawDay => {
                                if (!rawDay) return;
                                const day = rawDay.toString().toLowerCase();
                                if (!dataByDay[day]) return; // ignorar fines de semana u otros

                                // Priorizar código explícito (AM/MD/PM/EX); si no existe, usar hora
                                const period = extractPeriodCode(slot);

                                if (period === 'AM') {
                                    if (!dataByDay[day].horaAM) dataByDay[day].horaAM = displayTime;
                                    if (!dataByDay[day].rutaAM) dataByDay[day].rutaAM = routeLabel;
                                    if (!dataByDay[day].paradaAM) dataByDay[day].paradaAM = paradaDisplay;
                                } else if (period === 'MD') {
                                    if (!dataByDay[day].horaMD) dataByDay[day].horaMD = displayTime;
                                    if (!dataByDay[day].rutaMD) dataByDay[day].rutaMD = routeLabel;
                                    if (!dataByDay[day].paradaMD) dataByDay[day].paradaMD = paradaDisplay;
                                } else if (period === 'PM') {
                                    if (!dataByDay[day].horaPM) dataByDay[day].horaPM = displayTime;
                                    if (!dataByDay[day].rutaPM) dataByDay[day].rutaPM = routeLabel;
                                    if (!dataByDay[day].paradaPM) dataByDay[day].paradaPM = paradaDisplay;
                                } else if (period === 'EX') {
                                    if (!dataByDay[day].horaEX) dataByDay[day].horaEX = displayTime;
                                    if (!dataByDay[day].rutaEX) dataByDay[day].rutaEX = routeLabel;
                                    if (!dataByDay[day].paradaEX) dataByDay[day].paradaEX = paradaDisplay;
                                } else {
                                    // Si no hay código de periodo, no colocamos nada para evitar interpretaciones erróneas
                                }
                            });
                        });

                        // Push en orden Lunes..Viernes los pares Hora/Parada por periodo
                        weekdaysMap.forEach(d => {
                            const dd = dataByDay[d.key];
                            studentData.push(dd.horaAM);
                            studentData.push(dd.rutaAM || '');
                            studentData.push(dd.paradaAM);
                            studentData.push(dd.horaMD);
                            studentData.push(dd.rutaMD || '');
                            studentData.push(dd.paradaMD);
                            studentData.push(dd.horaPM);
                            studentData.push(dd.rutaPM || '');
                            studentData.push(dd.paradaPM);
                            studentData.push(dd.horaEX);
                            studentData.push(dd.rutaEX || '');
                            studentData.push(dd.paradaEX);
                        });
                    } else {
                        // Rellenar con vacíos equivalentes a: nombre, grado, y 12 columnas por día
                        studentData.push(""); // Nombre vacío
                        studentData.push(""); // Grado vacío
                        const emptyPerDay = 12; // Hora/Ruta/Parada AM, MD, PM, EX
                        for (let d = 0; d < weekdaysMap.length; d++) {
                            for (let k = 0; k < emptyPerDay; k++) studentData.push("");
                        }
                    }
                }

                // Agregar datos de contacto de la madre y el padre al final según especificación
                const userName = user.name || "";
                const userEmail = user.email || "";
                const motherName = (fd.motherName && fd.motherName.trim()) || '';
                const motherPhone = (fd.motherCellphone && fd.motherCellphone.trim()) || '';
                // Preferir los campos en FamilyDetail; si no existen, usar user.name / user.email
                const fatherName = (fd.fatherName && fd.fatherName.trim()) || '';
                const fatherPhone = (fd.fatherCellphone && fd.fatherCellphone.trim()) || '';

                const rowData = [...baseData, ...studentData, userName, userEmail, motherName, motherPhone, fatherName, fatherPhone];
                const row = familiesWorksheet.addRow(rowData);

                // Estilo alternado para filas de familias
                const isEven = (familyIndex + 1) % 2 === 0;
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' }
                    };
                    cell.alignment = {
                        horizontal: 'center',
                        vertical: 'middle'
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                    };
                });

                // Convertir columnas de ruta de estudiantes a número cuando sea posible
                try {
                    const baseLen = baseHeaders.length; // now 4
                    // Each student block: name(1), grade(1) + for each weekday 12 columns (hora,ruta,parada for AM/MD/PM/EX) => 2 + 12*weekdays
                    const perStudentCols = 2 + weekdaysMap.length * 12;
                    for (let i = 0; i < maxStudents; i++) {
                        const studentStart = baseLen + i * perStudentCols;
                        weekdaysMap.forEach((d, dayIdx) => {
                            const dayOffset = dayIdx * 12; // 12 columns per day
                            // Offsets after name(1) and grade(2), per day:
                            // horaAM(+1), rutaAM(+2), paradaAM(+3), horaMD(+4), rutaMD(+5), paradaMD(+6), horaPM(+7), rutaPM(+8), paradaPM(+9), horaEX(+10), rutaEX(+11), paradaEX(+12)
                            const colRutaAM = studentStart + 2 + dayOffset + 2;
                            const colRutaMD = studentStart + 2 + dayOffset + 5;
                            const colRutaPM = studentStart + 2 + dayOffset + 8;
                            const colRutaEX = studentStart + 2 + dayOffset + 11;

                            [colRutaAM, colRutaMD, colRutaPM, colRutaEX].forEach(colIdx => {
                                try {
                                    const cell = row.getCell(colIdx);
                                    if (cell && cell.value != null && cell.value !== '') {
                                        const raw = cell.value.toString();
                                        // 1) Buscar primer grupo de dígitos
                                        let m = raw.match(/(\d+)/);
                                        let num = null;
                                        if (m) {
                                            num = Number(m[1]);
                                        } else {
                                            // 2) Intentar parsear el string completo
                                            const n = Number(raw);
                                            if (!Number.isNaN(n)) num = n;
                                            else {
                                                // 3) Fallback: eliminar todos los no-dígitos y parsear
                                                const digitsOnly = raw.replace(/\D+/g, '');
                                                if (digitsOnly) num = Number(digitsOnly);
                                            }
                                        }

                                        if (num !== null && !Number.isNaN(num)) {
                                            cell.value = num;
                                            cell.numFmt = '0';
                                        } else {
                                            // If no numeric value found, leave as-is (string)
                                            // but do not set numeric format
                                            cell.value = raw;
                                            cell.numFmt = 'General';
                                        }
                                    }
                                } catch (e) {
                                    // ignore per-cell conversion errors
                                }
                            });
                            // Ensure Hora columns remain as General/text (no numeric format)
                            try {
                                const colHoraAM = studentStart + 2 + dayOffset + 1;
                                const colHoraMD = studentStart + 2 + dayOffset + 4;
                                const colHoraPM = studentStart + 2 + dayOffset + 7;
                                const colHoraEX = studentStart + 2 + dayOffset + 10;
                                [colHoraAM, colHoraMD, colHoraPM, colHoraEX].forEach(hIdx => {
                                    try {
                                        const hCell = row.getCell(hIdx);
                                        if (hCell && hCell.value != null && hCell.value !== '') {
                                            // Preserve value as string and set format to General to avoid number formatting
                                            hCell.value = hCell.value.toString();
                                            hCell.numFmt = 'General';
                                        }
                                    } catch (inner) {
                                        // ignore
                                    }
                                });
                            } catch (e) {
                                // ignore
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[handleDownloadRouteReport] Error converting student route columns to number:', e);
                }
            });

            // Auto-ajustar columnas para la hoja de familias
            familiesWorksheet.columns.forEach((column, index) => {
                const header = headers[index];
                let maxWidth = header ? header.length : 10;

                // Calcular ancho basado en contenido
                familiesWorksheet.eachRow((row, rowNumber) => {
                    if (rowNumber > 1) { // Skip header row
                        const cell = row.getCell(index + 1);
                        const cellLength = String(cell.value || "").length;
                        if (cellLength > maxWidth) {
                            maxWidth = cellLength;
                        }
                    }
                });

                column.width = Math.min(Math.max(maxWidth, 10), 50);
            });

            // Configurar filtros para TODAS las columnas en la hoja "Datos Familias"
            // Primero asegurar que hay datos antes de configurar filtros
            if (familiesWorksheet.rowCount > 1 && headers.length > 0) {
                // Función para convertir número de columna a letra de Excel
                const getColumnLetter = (columnNumber) => {
                    let letter = '';
                    while (columnNumber > 0) {
                        const remainder = (columnNumber - 1) % 26;
                        letter = String.fromCharCode(65 + remainder) + letter;
                        columnNumber = Math.floor((columnNumber - 1) / 26);
                    }
                    return letter;
                };

                // Validar que no excedamos el límite de Excel (1024 columnas = AMJ)
                const maxColumns = Math.min(headers.length, 1024);
                const lastColumnLetter = getColumnLetter(maxColumns);
                const filterRange = `A1:${lastColumnLetter}${familiesWorksheet.rowCount}`;

                // Configurar autoFilter para toda la tabla de familias
                familiesWorksheet.autoFilter = filterRange;

                // Configurar cada columna individualmente para asegurar que tenga filtro
                for (let i = 0; i < maxColumns; i++) {
                    const columnLetter = getColumnLetter(i + 1);
                    try {
                        const column = familiesWorksheet.getColumn(columnLetter);
                        if (column) {
                            // Asegurar que la columna tenga filtro habilitado
                            column.filterButton = true;
                        }
                    } catch (error) {
                        console.warn(`Error configurando filtro para columna ${columnLetter}:`, error);
                        break; // Salir del loop si hay error
                    }
                }

                // Log para debugging
                console.log('Headers count:', headers.length);
                console.log('Max columns processed:', maxColumns);
                console.log('AutoFilter range:', filterRange);
                console.log('Last column letter:', lastColumnLetter);
            } else {
                console.warn('No hay suficientes datos para configurar filtros');
            }

            // Congelar la primera fila (encabezados) para que sea sticky en la hoja de familias
            familiesWorksheet.views = [
                { state: 'frozen', ySplit: 1 }
            ];

            // Generar archivo
            const selectedSchool = schools.find(s => s.id === parseInt(schoolId));
            const schoolName = selectedSchool ? selectedSchool.name : 'Colegio';
            const fileName = `reporte_rutas_${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_${getFormattedDateTime()}.xlsx`;

            // Escribir archivo
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSnackbar({
                open: true,
                message: `Reporte de rutas para ${schoolName} descargado exitosamente`,
                severity: 'success'
            });

            // Cerrar el modal después de la descarga exitosa
            handleCloseRouteReportDialog();

        } catch (error) {
            console.error('[handleDownloadRouteReport] Error:', error);
            setSnackbar({
                open: true,
                message: 'Error al descargar el reporte de rutas',
                severity: 'error'
            });
        } finally {
            setRouteReportLoading(false);
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
                        variant="contained"
                        color="success"
                        onClick={() => { setDownloadMode('new'); setOpenRouteReportDialog(true); }}
                    >
                        Descargar Nuevos
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => { setDownloadMode('all'); setOpenRouteReportDialog(true); }}
                        sx={{ ml: 2 }}
                    >
                        Descargar Todos
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={handleOpenRouteReportDialog}
                    >
                        Reporte de Rutas
                    </Button>
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

            {/* Modal para selección de colegio en reporte de rutas */}
            <Dialog open={openRouteReportDialog} onClose={handleCloseRouteReportDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Reporte de Rutas por Colegio</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Selecciona el colegio para el cual deseas generar el reporte de rutas.
                    </DialogContentText>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            label="Colegio"
                            value={selectedSchoolForReport}
                            onChange={(e) => setSelectedSchoolForReport(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>Seleccione un colegio</em>
                            </MenuItem>
                            {schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                    {school.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRouteReportDialog} color="primary">
                        Cancelar
                    </Button>
                    <Button
                        onClick={async () => {
                            if (!selectedSchoolForReport) {
                                setSnackbar({ open: true, message: 'Por favor selecciona un colegio.', severity: 'warning' });
                                return;
                            }
                            if (downloadMode === 'report') {
                                await handleDownloadRouteReport(selectedSchoolForReport);
                            } else if (downloadMode === 'new') {
                                handleDownloadNewUsers(selectedSchoolForReport);
                            } else if (downloadMode === 'all') {
                                await handleDownloadAllUsers(selectedSchoolForReport);
                            }
                            setOpenRouteReportDialog(false);
                        }}
                        color="primary"
                        variant="contained"
                        disabled={!selectedSchoolForReport || routeReportLoading}
                    >
                        {routeReportLoading ? 'Generando...' : (downloadMode === 'report' ? 'Descargar Reporte' : (downloadMode === 'new' ? 'Descargar Nuevos' : 'Descargar Todos'))}
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
