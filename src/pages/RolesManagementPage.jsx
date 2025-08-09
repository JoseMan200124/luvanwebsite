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
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Snackbar,
    Alert,
    CircularProgress,
    Grid,
    Checkbox,
    Box,
    Link,
    useMediaQuery,
    useTheme,
    Chip,
    TableSortLabel,
    FormControlLabel
} from '@mui/material';
import {
    Edit,
    Delete,
    Add,
    FileUpload,
    DirectionsBus,
    Mail
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';
import styled from 'styled-components';
import CircularMasivaModal from '../components/CircularMasivaModal';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const RolesContainer = tw.div`
  p-8 bg-gray-100 min-h-screen w-full
`;

const roleOptions = [
    { id: 1, name: 'Gestor' },
    { id: 2, name: 'Administrador' },
    { id: 3, name: 'Padre' },
    { id: 4, name: 'Monitora' },
    { id: 5, name: 'Piloto' },
    { id: 6, name: 'Supervisor' },
    { id: 7, name: 'Auxiliar' },
];

/* =========================================================================
   SUBMODAL PARA ASIGNAR BUSES Y MOSTRAR LAS ASIGNACIONES PREVIAS
   Ahora se agrega un select para elegir el contrato a enviar (opcional)
   ========================================================================= */
const AssignBusesModal = ({ open, onClose, parentUser, buses, contracts, onSaveSuccess }) => {
    const [schoolSchedules, setSchoolSchedules] = useState([]);
    const [studentSchedules, setStudentSchedules] = useState({});

    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState([]);
    // Estructura: { [studentId]: [ { busId, assignedSchedule: string[] }, ... ] }
    const [assignments, setAssignments] = useState({});
    // Nuevo estado para contrato a enviar al asignar buses
    const [selectedContractForBuses, setSelectedContractForBuses] = useState('');

    // Función para aplanar el schedule del bus en strings tipo "Lunes 08:00"
    const getScheduleOptions = (bus) => {
        if (!bus.schedule || !Array.isArray(bus.schedule)) return [];
        const options = [];
        bus.schedule.forEach((sch) => {
            const day = sch.day;
            sch.times.forEach((t) => {
                options.push(`${day} ${t}`);
            });
        });
        return options;
    };

    // Al abrir el modal, cargar los estudiantes y sus asignaciones previas
    useEffect(() => {
        if (open && parentUser && parentUser.school) {
            const fetchSchedules = async () => {
                try {
                    const resp = await api.get(`/schools/${parentUser.school}`);
                    setSchoolSchedules(resp.data.school.schedules || []);
                } catch (error) {
                    setSchoolSchedules([]);
                }
            };
            fetchSchedules();
            setStudents(parentUser.FamilyDetail?.Students || []);
            setAssignments({});
            setSelectedContractForBuses('');
            setStudentSchedules({}); // Limpiar horarios por alumno
        }
    }, [open, parentUser]);

    // Filtrar contratos: solo los del colegio del padre (NO los globales)
    const filteredContracts = contracts.filter(
        c =>
            c.schoolId === null ||
            Number(c.schoolId) === Number(parentUser.school)
    );

    // Seleccionar automáticamente el contrato del colegio si existe
    useEffect(() => {
        if (open && parentUser && contracts.length > 0) {
            const contractForSchool = contracts.find(
                c => Number(c.schoolId) === Number(parentUser.school)
            );
            setSelectedContractForBuses(contractForSchool ? contractForSchool.uuid : '');
        }
    // eslint-disable-next-line
    }, [open, parentUser, contracts]);

    // Cambiar un horario en un selector específico
    const handleStudentScheduleChange = (studentId, idx, value) => {
        setStudentSchedules(prev => {
            const arr = prev[studentId] ? [...prev[studentId]] : [];
            const prevHorario = arr[idx];
            arr[idx] = value;
            // Si cambió el horario, elimina la asignación de buses del horario anterior
            setAssignments(prevAssignments => {
                const arrAssign = prevAssignments[studentId] ? [...prevAssignments[studentId]] : [];
                const filtered = arrAssign.filter(h => h.horario !== prevHorario);
                return { ...prevAssignments, [studentId]: filtered };
            });
            return { ...prev, [studentId]: arr };
        });
    };

    // Toggle bus para un horario específico
    const handleToggleBus = (studentId, horario, busId) => {
        setAssignments(prev => {
            const arr = prev[studentId] ? [...prev[studentId]] : [];
            let horarioObj = arr.find(h => h.horario === horario);
            if (!horarioObj) {
                // Si no existe, lo creamos
                horarioObj = { horario, buses: [busId] };
                return { ...prev, [studentId]: [...arr, horarioObj] };
            }
            const buses = horarioObj.buses.includes(busId)
                ? horarioObj.buses.filter(id => id !== busId)
                : [...horarioObj.buses, busId];
            const newArr = arr.map(h =>
                h.horario === horario ? { ...h, buses } : h
            ).filter(h => h.buses.length > 0); // Elimina horarios sin buses
            // Si después de quitar el bus no quedan buses, elimina el objeto
            if (!buses.length) {
                return { ...prev, [studentId]: newArr };
            }
            return { ...prev, [studentId]: newArr };
        });
    };

    // Saber si un bus está asignado a un horario específico
    const isBusChecked = (studentId, horario, busId) => {
        const arr = assignments[studentId] || [];
        const horarioObj = arr.find(h => h.horario === horario);
        return horarioObj ? horarioObj.buses.includes(busId) : false;
    };

    // Agregar un nuevo selector de horario
    const handleAddScheduleSelector = (studentId) => {
        setStudentSchedules(prev => ({
            ...prev,
            [studentId]: [...(prev[studentId] || []), ""]
        }));
    };

    // Eliminar un selector de horario
    const handleRemoveScheduleSelector = (studentId, idx) => {
        setStudentSchedules(prev => {
            const arr = prev[studentId] ? [...prev[studentId]] : [];
            const removed = arr[idx];
            arr.splice(idx, 1);
            // Al eliminar, también elimina las asignaciones de ese horario
            setAssignments(prevAssignments => {
                const arrAssign = prevAssignments[studentId] ? [...prevAssignments[studentId]] : [];
                const newArrAssign = arrAssign.filter(h => h.horario !== removed);
                return { ...prevAssignments, [studentId]: newArrAssign };
            });
            return { ...prev, [studentId]: arr };
        });
    };

    // Devolver array de horarios actualmente seleccionados
    const getSelectedSchedules = (studentId, busId) => {
        const currentList = assignments[studentId] || [];
        const found = currentList.find(item => item.busId === busId);
        return found ? found.assignedSchedule : [];
    };

    // Manejar el cambio de horarios (multiple)
    const handleSchedulesChange = (studentId, busId, newSchedules) => {
        setAssignments((prev) => {
            const currentList = prev[studentId] || [];
            const newArray = currentList.map((item) =>
                item.busId === busId ? { ...item, assignedSchedule: newSchedules } : item
            );
            return { ...prev, [studentId]: newArray };
        });
    };

    // Al guardar, transforma assignments al formato esperado por el backend
    const handleSave = async () => {
        setLoading(true);
        try {
            const promises = Object.keys(assignments).map(async (studId) => {
                // Agrupar por busId y juntar todos los horarios
                const busToHorarios = {};
                (assignments[studId] || []).forEach(h => {
                    h.buses.forEach(busId => {
                        if (!busToHorarios[busId]) busToHorarios[busId] = [];
                        if (!busToHorarios[busId].includes(h.horario)) {
                            busToHorarios[busId].push(h.horario);
                        }
                    });
                });
                const assignedBuses = Object.entries(busToHorarios).map(([busId, horarios]) => ({
                    busId: Number(busId),
                    assignedSchedule: horarios
                }));
                await api.put(`/students/${studId}/assign-buses`, { assignedBuses });
            });
            await Promise.all(promises);
            // Luego, si se seleccionó un contrato, se envía
            if (selectedContractForBuses) {
                const contractResp = await api.get(`/contracts/${selectedContractForBuses}`);
                const contract = contractResp.data;
                if (contract && parentUser.email) {
                    const fatherShareUrl = `${contract.url}?parentId=${parentUser.id}`;
                    await api.post('/mail/send', {
                        to: parentUser.email,
                        subject: 'Enlace de Contrato Asignado (Tras asignar rutas)',
                        html: `
                            <h1>Hola, ${parentUser.name}</h1>
                            <p>Te han asignado el contrato <strong>${contract.title}</strong> tras la asignación de rutas.</p>
                            <p>Puedes llenarlo en el siguiente enlace:
                            <a href="${fatherShareUrl}" target="_blank">${fatherShareUrl}</a></p>
                            <br/>
                            <p>Atentamente, Sistema de Contratos</p>
                            `
                    });
                }
            }
            setLoading(false);
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (error) {
            console.error('Error al asignar buses:', error);
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Asignar Buses</DialogTitle>
            <DialogContent>
                {students.length === 0 ? (
                    <Typography>No hay estudiantes para este padre.</Typography>
                ) : (
                    <>
                        {students.map((stud) => {
                            const schedulesArr = studentSchedules[stud.id] || [];
                            const allHorarioOptions = schoolSchedules.flatMap((sch) =>
                                (sch.times || []).map((time) => `${sch.day} ${time}`)
                            );
                            return (
                                <Box key={stud.id} sx={{ mb: 3, borderBottom: '1px solid #ccc', pb: 2 }}>
                                    <Typography variant="h6">{stud.fullName}</Typography>
                                    <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                                        Grado: {stud.grade || 'N/A'}
                                    </Typography>
                                    {/* Renderiza un selector por cada horario */}
                                    {schedulesArr.map((selectedSchedule, idx) => {
                                        const used = schedulesArr.filter((_, i) => i !== idx);
                                        const availableOptions = allHorarioOptions.filter(opt => !used.includes(opt));
                                        return (
                                            <Box key={idx} sx={{ mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <FormControl fullWidth>
                                                        <InputLabel>Horario</InputLabel>
                                                        <Select
                                                            value={selectedSchedule}
                                                            onChange={e => handleStudentScheduleChange(stud.id, idx, e.target.value)}
                                                            label="Horario"
                                                        >
                                                            <MenuItem value="">
                                                                <em>Seleccione un horario</em>
                                                            </MenuItem>
                                                            {availableOptions.map((value) => (
                                                                <MenuItem key={value} value={value}>
                                                                    {value}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                    <IconButton
                                                        color="error"
                                                        aria-label="Eliminar horario"
                                                        onClick={() => handleRemoveScheduleSelector(stud.id, idx)}
                                                        sx={{ ml: 1 }}
                                                        disabled={schedulesArr.length === 1}
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Box>
                                                {/* Mostrar buses solo si hay horario seleccionado */}
                                                {selectedSchedule && (
                                                    <Box sx={{ ml: 2 }}>
                                                        {buses
                                                            .filter(bus => {
                                                                if (!bus.pilot) return false;
                                                                if (String(bus.pilot.school) !== String(parentUser.school)) return false;
                                                                const busSchedules = getScheduleOptions(bus);
                                                                return busSchedules.includes(selectedSchedule);
                                                            })
                                                            .map((bus) => {
                                                                const checked = isBusChecked(stud.id, selectedSchedule, bus.id);
                                                                return (
                                                                    <div key={bus.id} style={{ marginBottom: 10 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                            <Checkbox
                                                                                checked={checked}
                                                                                onChange={() => handleToggleBus(stud.id, selectedSchedule, bus.id)}
                                                                                color="primary"
                                                                            />
                                                                            <span>{`Bus [Ruta ${bus.routeNumber}] (Piloto: ${bus.pilot?.name || 'N/A'})`}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </Box>
                                                )}
                                            </Box>
                                        );
                                    })}
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        sx={{ mb: 2 }}
                                        onClick={() => handleAddScheduleSelector(stud.id)}
                                        disabled={schedulesArr.length >= allHorarioOptions.length}
                                    >
                                        Agregar ruta
                                    </Button>
                                </Box>
                            );
                        })}
                        {/* Nuevo select para elegir el contrato a enviar (opcional) */}
                        <Box sx={{ mt: 2 }}>
                            <FormControl fullWidth>
                                <InputLabel>Contrato a enviar (opcional)</InputLabel>
                                <Select
                                    value={selectedContractForBuses}
                                    onChange={(e) => setSelectedContractForBuses(e.target.value)}
                                    label="Contrato a enviar (opcional)"
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
                        </Box>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
                <Button variant="contained" onClick={handleSave} disabled={loading}>
                    {loading ? 'Guardando...' : 'Guardar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

/* ================== Responsive Table & Mobile Cards =================== */
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
    const { auth } = useContext(AuthContext);

    const [users, setUsers] = useState([]);
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
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
    const [newSlot, setNewSlot] = useState({ time: '', note: '' });
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

    const [schoolGrades, setSchoolGrades] = useState([]);
    const [openCircularModal, setOpenCircularModal] = useState(false);

    // Submodal para asignar buses (sólo para padres)
    const [assignBusesOpen, setAssignBusesOpen] = useState(false);

    // Nuevo diálogo para envío manual de contrato
    const [openSendContractDialog, setOpenSendContractDialog] = useState(false);
    const [selectedUserForManualSend, setSelectedUserForManualSend] = useState(null);

    // Modal para selección de colegio en reporte de rutas
    const [openRouteReportDialog, setOpenRouteReportDialog] = useState(false);
    const [selectedSchoolForReport, setSelectedSchoolForReport] = useState('');
    const [routeReportLoading, setRouteReportLoading] = useState(false);

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
        fetchBuses();
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

    const fetchBuses = async () => {
        try {
            const resp = await api.get('/buses');
            setBuses(resp.data.buses || []);
        } catch (error) {
            console.error('[fetchBuses] Error:', error);
            setSnackbar({ open: true, message: 'Error al obtener buses', severity: 'error' });
        }
    };

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

    const handleAddSlot = () => {
        if (!newSlot.time) return;
        setFamilyDetail(prev => ({
            ...prev,
            scheduleSlots: [...prev.scheduleSlots, newSlot]
        }));
        setNewSlot({ time: '', note: '' });
    };

    const handleSaveUser = async () => {
        try {
            // Si la lista de estudiantes no cambió, no enviar ese campo
            const familyDetailPayload = { ...familyDetail };
            if (JSON.stringify(familyDetail.students) === JSON.stringify(originalStudents)) {
                delete familyDetailPayload.students;
            }
            let payload = {
                id: selectedUser.id,
                name: selectedUser.name,
                email: selectedUser.email,
                roleId: Number(selectedUser.roleId),
                school: selectedUser.school,
                phoneNumber: selectedUser.phoneNumber || null
            };
            if (selectedUser.password && selectedUser.password.trim() !== '') {
                payload.password = selectedUser.password;
            }
            if (payload.roleId === 3) {
                payload.familyDetail = familyDetailPayload;
            }
            if (payload.roleId === 6) {
                payload.supervisorPilots = selectedSupervisorPilots;
            }
            if (selectedUser?.roleId === 7) {
                payload.monitorasAsignadas = selectedAuxiliarMonitoras;
            }
            if (selectedUser.id) {
                await api.put(`/users/${selectedUser.id}`, payload);
                setSnackbar({ open: true, message: 'Usuario actualizado exitosamente', severity: 'success' });
            } else {
                await api.post('/users', payload);
                setSnackbar({ open: true, message: 'Usuario creado exitosamente', severity: 'success' });
            }
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

    const handleDownloadNewUsers = () => {
        const newUsers = users.filter(isUserNew);
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

    const handleDownloadAllUsers = async () => {
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

            // Filtrar solo usuarios padres con FamilyDetail, routeType y del colegio seleccionado
            const parentsWithRoutes = allUsers.filter(u => 
                u.Role && u.Role.name === 'Padre' && 
                u.FamilyDetail && 
                u.FamilyDetail.routeType &&
                u.school && parseInt(u.school) === parseInt(schoolId)
            );

            // Agrupar por número de ruta del bus asignado y contar estudiantes AM/PM
            const routeSummary = {};
            
            parentsWithRoutes.forEach(user => {
                const fd = user.FamilyDetail;
                
                if (fd.Students && fd.Students.length > 0) {
                    fd.Students.forEach(student => {
                        // Verificar si el estudiante tiene buses asignados específicos
                        if (student.buses && student.buses.length > 0) {
                            student.buses.forEach(bus => {
                                const busId = bus.id;
                                const routeNumber = bus.routeNumber || `Ruta ${busId}`;
                                
                                // Inicializar si no existe
                                if (!routeSummary[routeNumber]) {
                                    routeSummary[routeNumber] = {
                                        cantAM: 0,
                                        cantPM: 0
                                    };
                                }
                                
                                // Obtener horarios asignados desde la tabla intermedia
                                let assignedSchedule = [];
                                if (bus.AssignedBuses && bus.AssignedBuses.assignedSchedule) {
                                    try {
                                        assignedSchedule = typeof bus.AssignedBuses.assignedSchedule === 'string' 
                                            ? JSON.parse(bus.AssignedBuses.assignedSchedule)
                                            : bus.AssignedBuses.assignedSchedule;
                                    } catch (e) {
                                        console.warn('Error parsing assignedSchedule:', e);
                                        assignedSchedule = [];
                                    }
                                }
                                
                                // Analizar horarios para determinar AM/PM basado en formato de 24 horas
                                if (Array.isArray(assignedSchedule) && assignedSchedule.length > 0) {
                                    assignedSchedule.forEach(schedule => {
                                        if (schedule && typeof schedule === 'string') {
                                            // Buscar patrón de hora en formato 24 horas (HH:MM)
                                            const timeMatch = schedule.match(/(\d{1,2}):(\d{2})/);
                                            if (timeMatch) {
                                                const hour = parseInt(timeMatch[1]);
                                                // Determinar AM/PM basado en formato de 24 horas
                                                // AM: 0-11 horas (00:00 - 11:59)
                                                // PM: 12-23 horas (12:00 - 23:59)
                                                if (hour >= 0 && hour < 12) {
                                                    routeSummary[routeNumber].cantAM++;
                                                } else if (hour >= 12 && hour <= 23) {
                                                    routeSummary[routeNumber].cantPM++;
                                                } else {
                                                    // Hora inválida, contar como AM por defecto
                                                    routeSummary[routeNumber].cantAM++;
                                                }
                                            } else {
                                                // Si no se encuentra hora, revisar palabras clave como fallback
                                                const scheduleUpper = schedule.toUpperCase();
                                                if (scheduleUpper.includes('AM') || scheduleUpper.includes('MAÑANA') || scheduleUpper.includes('ENTRADA')) {
                                                    routeSummary[routeNumber].cantAM++;
                                                } else if (scheduleUpper.includes('PM') || scheduleUpper.includes('TARDE') || scheduleUpper.includes('SALIDA')) {
                                                    routeSummary[routeNumber].cantPM++;
                                                } else {
                                                    // Si no se puede determinar, contar como AM por defecto
                                                    routeSummary[routeNumber].cantAM++;
                                                }
                                            }
                                        }
                                    });
                                } else {
                                    // Si no hay horarios específicos, usar ScheduleSlots del estudiante
                                    if (student.ScheduleSlots && student.ScheduleSlots.length > 0) {
                                        student.ScheduleSlots.forEach(slot => {
                                            const timeSlot = slot.timeSlot || "";
                                            // Buscar patrón de hora en formato 24 horas
                                            const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
                                            if (timeMatch) {
                                                const hour = parseInt(timeMatch[1]);
                                                // Determinar AM/PM basado en formato de 24 horas
                                                if (hour >= 0 && hour < 12) {
                                                    routeSummary[routeNumber].cantAM++;
                                                } else if (hour >= 12 && hour <= 23) {
                                                    routeSummary[routeNumber].cantPM++;
                                                } else {
                                                    routeSummary[routeNumber].cantAM++;
                                                }
                                            } else {
                                                // Fallback a horarios específicos conocidos
                                                if (timeSlot.includes('7:30') || timeSlot.includes('8:00') || timeSlot.includes('07:30') || timeSlot.includes('08:00')) {
                                                    routeSummary[routeNumber].cantAM++;
                                                } else if (timeSlot.includes('13:00') || timeSlot.includes('13:30') || timeSlot.includes('14:00')) {
                                                    routeSummary[routeNumber].cantPM++;
                                                } else {
                                                    routeSummary[routeNumber].cantAM++;
                                                }
                                            }
                                        });
                                    } else {
                                        // Si no hay horarios, contar como AM por defecto
                                        routeSummary[routeNumber].cantAM++;
                                    }
                                }
                            });
                        }
                    });
                }
            });

            // Determinar el número máximo de estudiantes para crear las columnas dinámicas
            // Solo considerar familias que tienen al menos un estudiante con ruta
            let maxStudents = 0;
            
            parentsWithRoutes.forEach(user => {
                const fd = user.FamilyDetail;
                if (fd.Students && fd.Students.length > 0) {
                    // Verificar si esta familia tiene al menos un estudiante con ruta
                    const hasStudentWithRoute = fd.Students.some(student => {
                        // Verificar si tiene buses asignados específicos
                        if (student.buses && student.buses.length > 0) {
                            return student.buses.some(bus => {
                                let assignedSchedule = [];
                                if (bus.AssignedBuses && bus.AssignedBuses.assignedSchedule) {
                                    try {
                                        assignedSchedule = typeof bus.AssignedBuses.assignedSchedule === 'string' 
                                            ? JSON.parse(bus.AssignedBuses.assignedSchedule)
                                            : bus.AssignedBuses.assignedSchedule;
                                    } catch (e) {
                                        return false;
                                    }
                                }
                                return Array.isArray(assignedSchedule) && assignedSchedule.length > 0;
                            });
                        }
                        
                        // Verificar si tiene ScheduleSlots
                        if (student.ScheduleSlots && student.ScheduleSlots.length > 0) {
                            return student.ScheduleSlots.some(slot => {
                                const timeSlot = slot.timeSlot || "";
                                const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
                                return timeMatch !== null;
                            });
                        }
                        
                        return false;
                    });
                    
                    // Solo contar estudiantes si la familia tiene al menos uno con ruta
                    if (hasStudentWithRoute && fd.Students.length > maxStudents) {
                        maxStudents = fd.Students.length;
                    }
                }
            });

            // Ordenar las rutas alfabéticamente
            const sortedRoutes = Object.keys(routeSummary).sort();

            // Crear Excel con ExcelJS para soporte completo de estilos
            const workbook = new ExcelJS.Workbook();
            
            // Hoja resumen por rutas
            const summaryWorksheet = workbook.addWorksheet('Resumen por Rutas');
            
            // Agregar headers con estilo
            const summaryHeaders = ["No. Ruta", "Cant. AM", "Cant. PM"];
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
                // Si no hay rutas específicas, crear un resumen básico agrupando por tipo de ruta
                const routeTypeGroups = {};
                parentsWithRoutes.forEach(user => {
                    const routeType = user.FamilyDetail.routeType;
                    if (!routeTypeGroups[routeType]) {
                        routeTypeGroups[routeType] = [];
                    }
                    routeTypeGroups[routeType].push(user);
                });
                
                Object.keys(routeTypeGroups).forEach((routeType, index) => {
                    const families = routeTypeGroups[routeType];
                    const totalStudents = families.reduce((sum, family) => {
                        return sum + (family.FamilyDetail.Students ? family.FamilyDetail.Students.length : 1);
                    }, 0);
                    
                    let rowData;
                    if (routeType.includes('AM') || routeType.includes('Media AM')) {
                        rowData = [routeType, totalStudents, 0];
                    } else if (routeType.includes('PM') || routeType.includes('Media PM')) {
                        rowData = [routeType, 0, totalStudents];
                    } else if (routeType.includes('Completa')) {
                        rowData = [routeType, totalStudents, totalStudents];
                    } else {
                        rowData = [routeType, totalStudents, 0];
                    }
                    
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
                });
            } else {
                // Usar el resumen por rutas específicas
                sortedRoutes.forEach((routeNumber, index) => {
                    const routeData = routeSummary[routeNumber];
                    const rowData = [routeNumber, routeData.cantAM, routeData.cantPM];
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
                });
            }
            
            // Auto-ajustar columnas y agregar filtros
            summaryWorksheet.columns.forEach(column => {
                column.width = Math.max(15, column.header ? column.header.length : 10);
            });
            summaryWorksheet.autoFilter = 'A1:C' + summaryWorksheet.rowCount;
            
            // Hoja de datos de familias
            const familiesWorksheet = workbook.addWorksheet('Datos Familias');
            
            // Crear headers dinámicos
            const baseHeaders = [
                "Tipo Ruta",
                "Apellido Familia", 
                "Nombre Padre",
                "Email Padre",
                "Dirección Principal",
                "Dirección Alterna"
            ];
            
            // Agregar columnas para estudiantes
            const studentHeaders = [];
            for (let i = 1; i <= maxStudents; i++) {
                studentHeaders.push(`Estudiante ${i} - Nombre`);
                studentHeaders.push(`Estudiante ${i} - Grado`);
                studentHeaders.push(`Estudiante ${i} - Ruta AM`);
                studentHeaders.push(`Estudiante ${i} - Hora AM`);
                studentHeaders.push(`Estudiante ${i} - Parada AM`);
                studentHeaders.push(`Estudiante ${i} - Ruta PM`);
                studentHeaders.push(`Estudiante ${i} - Hora PM`);
                studentHeaders.push(`Estudiante ${i} - Parada PM`);
            }
            
            const headers = [...baseHeaders, ...studentHeaders];
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
            
            // Función para verificar si una familia tiene al menos un estudiante con ruta AM o PM
            const familyHasStudentWithRoute = (user) => {
                const fd = user.FamilyDetail;
                if (!fd.Students || fd.Students.length === 0) return false;
                
                return fd.Students.some(student => {
                    // Verificar si tiene buses asignados específicos
                    if (student.buses && student.buses.length > 0) {
                        return student.buses.some(bus => {
                            let assignedSchedule = [];
                            if (bus.AssignedBuses && bus.AssignedBuses.assignedSchedule) {
                                try {
                                    assignedSchedule = typeof bus.AssignedBuses.assignedSchedule === 'string' 
                                        ? JSON.parse(bus.AssignedBuses.assignedSchedule)
                                        : bus.AssignedBuses.assignedSchedule;
                                } catch (e) {
                                    return false;
                                }
                            }
                            return Array.isArray(assignedSchedule) && assignedSchedule.length > 0;
                        });
                    }
                    
                    // Verificar si tiene ScheduleSlots
                    if (student.ScheduleSlots && student.ScheduleSlots.length > 0) {
                        return student.ScheduleSlots.some(slot => {
                            const timeSlot = slot.timeSlot || "";
                            const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
                            return timeMatch !== null; // Tiene al menos una hora definida
                        });
                    }
                    
                    return false;
                });
            };
            
            // Filtrar familias que tienen al menos un estudiante con ruta
            const familiesWithRoutes = parentsWithRoutes.filter(familyHasStudentWithRoute);
            
            // Procesar solo las familias que tienen estudiantes con rutas
            familiesWithRoutes.forEach((user, familyIndex) => {
                const fd = user.FamilyDetail;
                
                // Datos base
                const baseData = [
                    fd.routeType || "",
                    fd.familyLastName || "",
                    user.name || "",
                    user.email || "",
                    fd.mainAddress || "",
                    fd.alternativeAddress || ""
                ];
                
                // Datos de estudiantes (expandidos en columnas separadas)
                const studentData = [];
                for (let i = 0; i < maxStudents; i++) {
                    if (fd.Students && fd.Students[i]) {
                        const student = fd.Students[i];
                        studentData.push(student.fullName || "");
                        studentData.push(student.grade || "");
                        
                        // Extraer información de rutas AM/PM para este estudiante
                        let rutaAM = "", horaAM = "", paradaAM = "";
                        let rutaPM = "", horaPM = "", paradaPM = "";
                        
                        if (student.buses && student.buses.length > 0) {
                            student.buses.forEach(bus => {
                                // Obtener horarios asignados desde la tabla intermedia
                                let assignedSchedule = [];
                                if (bus.AssignedBuses && bus.AssignedBuses.assignedSchedule) {
                                    try {
                                        assignedSchedule = typeof bus.AssignedBuses.assignedSchedule === 'string' 
                                            ? JSON.parse(bus.AssignedBuses.assignedSchedule)
                                            : bus.AssignedBuses.assignedSchedule;
                                    } catch (e) {
                                        console.warn('Error parsing assignedSchedule for student data:', e);
                                        assignedSchedule = [];
                                    }
                                }
                                
                                const routeNumber = bus.routeNumber || `Ruta ${bus.id}`;
                                
                                // Analizar cada horario asignado
                                if (Array.isArray(assignedSchedule)) {
                                    assignedSchedule.forEach(schedule => {
                                        if (schedule && typeof schedule === 'string') {
                                            const scheduleUpper = schedule.toUpperCase();
                                            const timeMatch = schedule.match(/(\d{1,2}):(\d{2})/);
                                            const hour = timeMatch ? parseInt(timeMatch[1]) : null;
                                            
                                            // Determinar si es AM o PM
                                            const isAM = scheduleUpper.includes('AM') || 
                                                        scheduleUpper.includes('MAÑANA') || 
                                                        scheduleUpper.includes('ENTRADA') || 
                                                        (hour !== null && hour < 12);
                                            
                                            const isPM = scheduleUpper.includes('PM') || 
                                                        scheduleUpper.includes('TARDE') || 
                                                        scheduleUpper.includes('SALIDA') || 
                                                        (hour !== null && hour >= 12);
                                            
                                            if (isAM && !rutaAM) {
                                                rutaAM = routeNumber;
                                                horaAM = timeMatch ? timeMatch[0] : schedule;
                                                // Buscar parada en ScheduleSlots del estudiante si está disponible
                                                if (student.ScheduleSlots && student.ScheduleSlots.length > 0) {
                                                    const matchingSlot = student.ScheduleSlots.find(slot => 
                                                        slot.timeSlot && slot.timeSlot.includes(timeMatch ? timeMatch[0] : schedule)
                                                    );
                                                    paradaAM = matchingSlot ? (matchingSlot.note || matchingSlot.timeSlot) : "";
                                                } else {
                                                    paradaAM = fd.mainAddress || "";
                                                }
                                            } else if (isPM && !rutaPM) {
                                                rutaPM = routeNumber;
                                                horaPM = timeMatch ? timeMatch[0] : schedule;
                                                // Buscar parada en ScheduleSlots del estudiante si está disponible
                                                if (student.ScheduleSlots && student.ScheduleSlots.length > 0) {
                                                    const matchingSlot = student.ScheduleSlots.find(slot => 
                                                        slot.timeSlot && slot.timeSlot.includes(timeMatch ? timeMatch[0] : schedule)
                                                    );
                                                    paradaPM = matchingSlot ? (matchingSlot.note || matchingSlot.timeSlot) : "";
                                                } else {
                                                    paradaPM = fd.mainAddress || "";
                                                }
                                            }
                                        }
                                    });
                                }
                            });
                        } else {
                            // Si no hay buses asignados específicos, usar información de ScheduleSlots
                            if (student.ScheduleSlots && student.ScheduleSlots.length > 0) {
                                student.ScheduleSlots.forEach(slot => {
                                    const timeSlot = slot.timeSlot || "";
                                    const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
                                    const hour = timeMatch ? parseInt(timeMatch[1]) : null;
                                    
                                    if (hour !== null) {
                                        if (hour < 12 && !rutaAM) {
                                            rutaAM = fd.routeType || "N/A";
                                            horaAM = timeMatch[0];
                                            paradaAM = slot.note || fd.mainAddress || "";
                                        } else if (hour >= 12 && !rutaPM) {
                                            rutaPM = fd.routeType || "N/A";
                                            horaPM = timeMatch[0];
                                            paradaPM = slot.note || fd.mainAddress || "";
                                        }
                                    }
                                });
                            }
                        }
                        
                        studentData.push(rutaAM);
                        studentData.push(horaAM);
                        studentData.push(paradaAM);
                        studentData.push(rutaPM);
                        studentData.push(horaPM);
                        studentData.push(paradaPM);
                    } else {
                        studentData.push(""); // Nombre vacío
                        studentData.push(""); // Grado vacío
                        studentData.push(""); // Ruta AM vacía
                        studentData.push(""); // Hora AM vacía
                        studentData.push(""); // Parada AM vacía
                        studentData.push(""); // Ruta PM vacía
                        studentData.push(""); // Hora PM vacía
                        studentData.push(""); // Parada PM vacía
                    }
                }
                
                const rowData = [...baseData, ...studentData];
                const row = familiesWorksheet.addRow(rowData);
                
                // Estilo alternado para filas de familias
                const isEven = (familyIndex + 1) % 2 === 0;
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' }
                    };
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                    };
                });
            });
            
            // Auto-ajustar columnas y agregar filtros
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
            
            // Agregar filtros automáticos
            familiesWorksheet.autoFilter = 'A1:' + String.fromCharCode(65 + headers.length - 1) + familiesWorksheet.rowCount;
            
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
                        onClick={handleDownloadNewUsers}
                    >
                        Descargar Nuevos
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={handleDownloadAllUsers}
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
                                                            setAssignBusesOpen(true);
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
                                                                    setAssignBusesOpen(true);
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
                                                <IconButton
                                                    color="error"
                                                    aria-label="Eliminar alumno"
                                                    onClick={() => handleRemoveStudent(idx)}
                                                >
                                                    <Delete />
                                                </IconButton>
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
                                <Typography variant="h6" sx={{ mt: 3, ml: 2 }}>
                                    Horarios de Parada
                                </Typography>
                                <Grid container spacing={2} sx={{ mt: 1, pl: 2 }}>
                                    {familyDetail.scheduleSlots.map((slot, idx) => (
                                        <Grid item xs={12} key={idx}>
                                            <Typography variant="body2">
                                                • {slot.time} {slot.note && `(${slot.note})`}
                                            </Typography>
                                        </Grid>
                                    ))}
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="time"
                                            label="Hora (HH:MM)"
                                            type="time"
                                            fullWidth
                                            variant="outlined"
                                            value={newSlot.time}
                                            onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            name="note"
                                            label="Nota / Parada"
                                            fullWidth
                                            variant="outlined"
                                            value={newSlot.note}
                                            onChange={(e) => setNewSlot({ ...newSlot, note: e.target.value })}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={2} display="flex" alignItems="center">
                                        <Button variant="outlined" onClick={handleAddSlot} sx={{ mt: 1 }}>
                                            Agregar
                                        </Button>
                                    </Grid>
                                </Grid>
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

            {/* Submodal para asignar buses al padre */}
            {selectedUser && (
                <AssignBusesModal
                    open={assignBusesOpen}
                    onClose={() => setAssignBusesOpen(false)}
                    parentUser={selectedUser}
                    buses={buses}
                    contracts={contracts}
                    onSaveSuccess={async () => {
                        fetchUsers();
                    }}
                />
            )}

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
                        onClick={() => handleDownloadRouteReport(selectedSchoolForReport)} 
                        color="primary" 
                        variant="contained"
                        disabled={!selectedSchoolForReport || routeReportLoading}
                    >
                        {routeReportLoading ? 'Generando...' : 'Descargar Reporte'}
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
