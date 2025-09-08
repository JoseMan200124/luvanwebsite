// src/pages/SchoolUsersPage.jsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Grid,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TablePagination,
    InputAdornment,
    TableSortLabel,
    TextField,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText
    ,Checkbox, FormControlLabel
} from '@mui/material';
import { 
    School as SchoolIcon, 
    CalendarToday,
    ArrowBack,
    Search,
    FilterList,
    Email,
    Edit,
    Delete,
    DirectionsBus,
    
    Mail,
    Add,
    FileUpload,
    GetApp
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import StudentScheduleModal from '../components/modals/StudentScheduleModal';
import CircularMasivaModal from '../components/CircularMasivaModal';

// Opciones de roles disponibles en esta vista: Padre solamente
const roleOptions = [
    { id: 3, name: 'Padre' }
];

const PageContainer = styled.div`
    ${tw`bg-gray-50 min-h-screen w-full`}
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;

    @media (max-width: 640px) {
        padding: 1rem;
    }
`;

const HeaderCard = styled(Card)`
    ${tw`mb-6 shadow-lg`}
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
`;

const SchoolUsersPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { schoolYear, schoolId } = useParams();

    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    // Sorting state
    const [sortBy, setSortBy] = useState(null); // 'status' | 'updatedAt' | 'familyLastName' | 'name' | 'email' | 'role' | 'students'
    const [sortOrder, setSortOrder] = useState('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedUser, setSelectedUser] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Nuevos estados para funcionalidades
    
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openCircularModal, setOpenCircularModal] = useState(false);
    const [openStudentScheduleModal, setOpenStudentScheduleModal] = useState(false);
    const [openSendContractDialog, setOpenSendContractDialog] = useState(false);
    const [openSchoolSelectDialog, setOpenSchoolSelectDialog] = useState(false);
    
    // Estados para diferentes operaciones
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [downloadMode, setDownloadMode] = useState('');
    const [scheduleModalStudents, setScheduleModalStudents] = useState([]);
    // Actions menu state removed: actions shown inline per row

    // Menu is closed inline where used

    // Estados para formulario de padres
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
    
    // Estados para Supervisor y Auxiliar
    const [allPilots, setAllPilots] = useState([]);
    const [allMonitoras, setAllMonitoras] = useState([]);
    const [selectedSupervisorPilots, setSelectedSupervisorPilots] = useState([]);
    const [selectedAuxiliarMonitoras, setSelectedAuxiliarMonitoras] = useState([]);

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

    const handleUserChange = (e) => {
        setSelectedUser(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
    const [scheduleSchoolId, setScheduleSchoolId] = useState(null);
    // selectedUserForContract removed; use selectedUser when needed for sending contracts
    const [contracts, setContracts] = useState([]);
    const [schools, setSchools] = useState([]);

    // Obtener datos del estado de navegación
    const stateSchool = location.state?.school;
    const stateSchoolYear = location.state?.schoolYear;

    // Funciones auxiliares para determinar el estado de los usuarios
    const isUserNew = (user) => {
        if (!user.FamilyDetail) return false;
        if (user.FamilyDetail.source !== 'enrollment') return false;
        if (user.FamilyDetail.isNew === false) return false;
        const createdAt = new Date(user.createdAt);
        const now = new Date();
        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
        return diffDays <= 14;
    };

    const isFamilyLastNameDuplicated = (user, allUsers) => {
        if (!user.FamilyDetail || !user.FamilyDetail.familyLastName) return false;
        const lastName = user.FamilyDetail.familyLastName.trim().toLowerCase();
        if (!lastName) return false;
        const count = allUsers.filter(
            u =>
                u.FamilyDetail &&
                u.FamilyDetail.familyLastName &&
                u.FamilyDetail.familyLastName.trim().toLowerCase() === lastName
        ).length;
        return count > 1;
    };

    const getUserStatus = useCallback((user) => {
        if (isUserNew(user)) return 'Nuevo';
        if (isFamilyLastNameDuplicated(user, users)) return 'Duplicado';
        if (user.FamilyDetail && user.FamilyDetail.hasUpdatedData) return 'Actualizado';
        return 'Activo';
    }, [users]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Nuevo':
                return 'success';
            case 'Duplicado':
                return 'warning';
            case 'Actualizado':
                return 'info';
            default:
                return 'default';
        }
    };

    // Cargar datos adicionales
    const fetchContracts = useCallback(async () => {
        try {
            const response = await api.get('/contracts', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setContracts(response.data || []);
        } catch (err) {
            console.error('Error fetching contracts:', err);
            setContracts([]); // Asegurar que siempre sea un array
        }
    }, [auth.token]);

    const fetchSchools = useCallback(async () => {
        try {
            const response = await api.get('/schools', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            // Usar la misma estructura que RolesManagementPage
            setSchools(response.data.schools || response.data || []);
        } catch (err) {
            console.error('Error fetching schools:', err);
            setSchools([]); // Asegurar que siempre sea un array
        }
    }, [auth.token]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            // Usar el mismo endpoint que RolesManagementPage
            const response = await api.get('/users', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            const usersData = response.data.users || [];
            
            // Excluir roles que no se manejan en esta vista:
            // - Administrador=1, Gestor=2 (ya no se gestionan aquí)
            // - Monitora=4, Piloto=5, Supervisor=6, Auxiliar=7
            const excludedRoleIds = [1,2,4,5,6,7];
            let visibleUsers = usersData.filter(u => !excludedRoleIds.includes(Number(u.roleId)));

            // Filtrar usuarios por colegio si se especifica
            const filteredUsers = schoolId ? 
                visibleUsers.filter(user => Number(user.school) === Number(schoolId)) : 
                visibleUsers;
            
            setUsers(filteredUsers);
            setFilteredUsers(filteredUsers);
        } catch (err) {
            console.error('Error fetching users:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener los usuarios', 
                severity: 'error' 
            });
            setUsers([]);
            setFilteredUsers([]);
        } finally {
            setLoading(false);
        }
    }, [auth.token, schoolId]);

    useEffect(() => {
        if (auth.token && schoolId) {
            fetchUsers();
            fetchContracts();
            fetchSchools();
            fetchAllPilots();
            fetchAllMonitoras();
        }
    }, [auth.token, schoolId, fetchUsers, fetchContracts, fetchSchools]);

    useEffect(() => {
        let filtered = users;

        // Filtrar por búsqueda
        if (searchQuery) {
            filtered = filtered.filter(user => 
                user.familyLastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.motherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.fatherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.motherEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.fatherEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Filtrar por estado
        if (statusFilter) {
            filtered = filtered.filter(user => {
                const status = getUserStatus(user);
                return status === statusFilter;
            });
        }

        setFilteredUsers(filtered);
        setPage(0); // Reset page when filters change
    }, [users, searchQuery, statusFilter, getUserStatus]);

    const handleBackToDashboard = () => {
        navigate(`/admin/escuelas/${schoolYear || stateSchoolYear}/${schoolId}`, {
            state: {
                schoolYear: schoolYear || stateSchoolYear,
                school: stateSchool
            }
        });
    };

    

    const handleSortChange = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setPage(0);
    };

    // Restore action handlers for table actions
    const handleEditClick = async (user) => {
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
            setOriginalStudents(user.FamilyDetail.Students || []);
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

        setSelectedSupervisorPilots([]);
        if (parsedRoleId === 6 || (user.Role && user.Role.name === 'Supervisor')) {
            const newArray = user.supervisorPilots ? user.supervisorPilots.map(sp => Number(sp.pilotId)) : [];
            setSelectedSupervisorPilots(newArray);
        }

        if (user.Role?.name === 'Auxiliar') {
            const auxMonitoras = [];
            try {
                const auxMonitorasResp = await api.get(`/users/${user.id}/assigned-monitoras`);
                if (auxMonitorasResp.data && auxMonitorasResp.data.monitoraIds) {
                    auxMonitoras.push(...auxMonitorasResp.data.monitoraIds.map(id => Number(id)));
                }
            } catch (error) {
                console.error('Error al obtener monitoras asignadas al auxiliar:', error);
            }
            setSelectedAuxiliarMonitoras(auxMonitoras);
        } else {
            setSelectedAuxiliarMonitoras([]);
        }

        setOpenEditDialog(true);
    };

    const handleDeleteClick = (userOrId) => {
        // Accept either user object or id
        if (!userOrId) return;
        if (typeof userOrId === 'object') {
                setSelectedUser(userOrId);
        } else {
            const found = filteredUsers.find(u => u.id === userOrId) || users.find(u => u.id === userOrId);
            setSelectedUser(found ? found : { id: userOrId });
        }
    // delete confirmation dialog removed; selection is stored in state
    };

    const handleAssignBuses = (user) => {
        setSelectedUser(user);
        setScheduleModalStudents(user.FamilyDetail?.Students || []);
        // Ensure the modal receives a schoolId so it can load schedules and route numbers.
        // Prefer the user's assigned school, then the route param, then the currentSchool from location state.
        const sch = user?.school || schoolId || currentSchool?.id || null;
        setScheduleSchoolId(sch ? Number(sch) : null);
        setOpenStudentScheduleModal(true);
    };

    const handleSendContract = (user) => {
        setSelectedUser(user);
        setOpenSendContractDialog(true);
    };

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
            setOpenEditDialog(false);
        } catch (err) {
            console.error('[handleSaveUser] Error:', err);
            setSnackbar({ open: true, message: 'Error al guardar usuario', severity: 'error' });
        }
    };

    const handleAddUser = () => {
        setSelectedUser({
            id: null,
            name: '',
            email: '',
            password: '',
            // Auto-assign Padre role and current school when creating a new user
            roleId: 3,
            school: schoolId || currentSchool?.id || ''
        });
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
        setSelectedSupervisorPilots([]);
        setSelectedAuxiliarMonitoras([]);
        setOpenEditDialog(true);
    };

    const handleDownloadUserTemplate = () => {
        // 1. Prepara listas de referencia
        const colegios = schools.map(s => [s.id, s.name]);
        const tiposRuta = [
            ["Completa"],
            ["Media AM"],
            ["Media PM"]
        ];

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
                    ""
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
                    ""
                ]
            }
        ];

        // 3. Hoja de listas de referencia con columnas separadas
        const maxRows = Math.max(colegios.length, tiposRuta.length);

        const wsListasData = [
            [
                "Colegios (ID)", "Colegios (Nombre)", "", 
                "Tipo de Ruta"
            ]
        ];

        for (let i = 0; i < maxRows; i++) {
            wsListasData.push([
                colegios[i]?.[0] ?? "", colegios[i]?.[1] ?? "", "",
                tiposRuta[i]?.[0] ?? ""
            ]);
        }

        const wsListas = XLSX.utils.aoa_to_sheet(wsListasData);

        wsListas['!cols'] = [
            { wch: 15 },
            { wch: 20 },
            { wch: 2 },
            { wch: 15 }
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

    

    const handleBulkUpload = async () => {
        if (!bulkFile) return;
        
        setBulkLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            
            await api.post('/users/bulk-upload', formData, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Carga masiva completada exitosamente',
                severity: 'success'
            });
            
            setOpenBulkDialog(false);
            setBulkFile(null);
            fetchUsers();
        } catch (err) {
            console.error('Error in bulk upload:', err);
            setSnackbar({
                open: true,
                message: 'Error en la carga masiva',
                severity: 'error'
            });
        } finally {
            setBulkLoading(false);
        }
    };

    const currentSchool = stateSchool;
    const currentSchoolYear = schoolYear || stateSchoolYear;

    // Obtener opciones de grados del colegio gestionado (soporta varios formatos)
    const availableGrades = (() => {
        let sch = null;

        // Try find school by selectedUser.school (may be id or string)
        if (selectedUser?.school) {
            if (Array.isArray(schools)) {
                sch = schools.find(s => String(s.id) === String(selectedUser.school));
            }
            // as fallback, if currentSchool matches the id
            if (!sch && currentSchool && String(currentSchool.id) === String(selectedUser.school)) {
                sch = currentSchool;
            }
        }

        // fallback to currentSchool
        if (!sch && currentSchool) sch = currentSchool;

        // fallback to schoolId param
        if (!sch && schoolId && Array.isArray(schools)) {
            sch = schools.find(s => String(s.id) === String(schoolId));
        }

        const gradesRaw = sch?.grades;
        if (!gradesRaw) return [];

        let parsed = [];
        if (typeof gradesRaw === 'string') {
            // try parse JSON first
            try {
                parsed = JSON.parse(gradesRaw);
            } catch (err) {
                // if not JSON, maybe comma-separated
                parsed = gradesRaw.split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name }));
            }
        } else if (Array.isArray(gradesRaw)) {
            parsed = gradesRaw;
        } else {
            return [];
        }

        // Normalize to array of strings
        return parsed
            .map(g => {
                if (!g) return '';
                if (typeof g === 'string') return g;
                if (typeof g === 'object') return g.name ?? g.label ?? JSON.stringify(g);
                return String(g);
            })
            .filter(Boolean);
    })();

    // apply sorting to filteredUsers before pagination
    const sortedUsers = (() => {
        if (!sortBy) return filteredUsers;
        const copy = filteredUsers.slice();
        copy.sort((a, b) => {
            let va = '';
            let vb = '';
            switch (sortBy) {
                case 'status':
                    va = getUserStatus(a);
                    vb = getUserStatus(b);
                    break;
                case 'updatedAt':
                    va = a.updatedAt || a.createdAt || '';
                    vb = b.updatedAt || b.createdAt || '';
                    break;
                case 'familyLastName':
                    va = a.FamilyDetail?.familyLastName || a.familyLastName || '';
                    vb = b.FamilyDetail?.familyLastName || b.familyLastName || '';
                    break;
                case 'name':
                    va = a.name || '';
                    vb = b.name || '';
                    break;
                case 'email':
                    va = a.email || a.motherEmail || a.fatherEmail || '';
                    vb = b.email || b.motherEmail || b.fatherEmail || '';
                    break;
                case 'role':
                    va = (roleOptions.find(r => r.id === a.roleId)?.name) || '';
                    vb = (roleOptions.find(r => r.id === b.roleId)?.name) || '';
                    break;
                case 'students':
                    va = String(a.studentsCount || a.FamilyDetail?.Students?.length || 0);
                    vb = String(b.studentsCount || b.FamilyDetail?.Students?.length || 0);
                    break;
                default:
                    va = '';
                    vb = '';
            }

            // try numeric compare for updatedAt or students
            if (sortBy === 'updatedAt') {
                const da = new Date(va).getTime() || 0;
                const db = new Date(vb).getTime() || 0;
                return sortOrder === 'asc' ? da - db : db - da;
            }

            if (!isNaN(Number(va)) && !isNaN(Number(vb))) {
                return sortOrder === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
            }

            // string compare
            const cmp = va.toString().toLowerCase().localeCompare(vb.toString().toLowerCase());
            return sortOrder === 'asc' ? cmp : -cmp;
        });
        return copy;
    })();

    const paginatedUsers = sortedUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
    const v = parseInt(event.target.value, 10);
    setRowsPerPage(Number.isNaN(v) ? 10 : v);
    setPage(0);
    };

    return (
        <PageContainer>
            {/* Header */}
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={handleBackToDashboard}
                            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                        >
                            Volver al Dashboard
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <SchoolIcon sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Usuarios - {currentSchool?.name || 'Cargando...'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Ciclo Escolar ${currentSchoolYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                    {filteredUsers.length} usuarios encontrados
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            {/* Filtros y búsqueda */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Buscar por nombre, apellido o email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth variant="outlined">
                                <InputLabel>Estado</InputLabel>
                                <Select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    label="Estado"
                                    startAdornment={<FilterList />}
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="Nuevo">Nuevo</MenuItem>
                                    <MenuItem value="Duplicado">Duplicado</MenuItem>
                                    <MenuItem value="Actualizado">Actualizado</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        {/* Role filter removed: this view only handles Padres */}
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('');
                                }}
                            >
                                Limpiar
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Botones de Acción */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<FileUpload />}
                                fullWidth
                                onClick={() => setOpenBulkDialog(true)}
                            >
                                Carga Masiva
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<Add />}
                                fullWidth
                                onClick={handleAddUser}
                            >
                                Añadir Usuario
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<Mail />}
                                fullWidth
                                onClick={() => setOpenCircularModal(true)}
                            >
                                Enviar Circular
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<GetApp />}
                                fullWidth
                                onClick={() => {
                                    setDownloadMode('new');
                                    setOpenSchoolSelectDialog(true);
                                }}
                            >
                                Descargar Nuevos
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<GetApp />}
                                fullWidth
                                onClick={() => {
                                    setDownloadMode('all');
                                    setOpenSchoolSelectDialog(true);
                                }}
                            >
                                Descargar Todos
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="info"
                                startIcon={<GetApp />}
                                fullWidth
                                onClick={() => {
                                    setDownloadMode('report');
                                    setOpenSchoolSelectDialog(true);
                                }}
                            >
                                Reporte de Rutas
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Tabla de usuarios */}
            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'familyLastName'}
                                                    direction={sortBy === 'familyLastName' ? sortOrder : 'asc'}
                                                    onClick={() => handleSortChange('familyLastName')}
                                                >
                                                    Apellido Familia
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'students'}
                                                    direction={sortBy === 'students' ? sortOrder : 'asc'}
                                                    onClick={() => handleSortChange('students')}
                                                >
                                                    Cant. Hijos
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'email'}
                                                    direction={sortBy === 'email' ? sortOrder : 'asc'}
                                                    onClick={() => handleSortChange('email')}
                                                >
                                                    Correo
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'updatedAt'}
                                                    direction={sortBy === 'updatedAt' ? sortOrder : 'asc'}
                                                    onClick={() => handleSortChange('updatedAt')}
                                                >
                                                    Fecha de actualización
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'status'}
                                                    direction={sortBy === 'status' ? sortOrder : 'asc'}
                                                    onClick={() => handleSortChange('status')}
                                                >
                                                    Estado
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                Acciones
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedUsers.map((user) => (
                                            <TableRow key={user.id} hover>
                                                <TableCell>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        {user.FamilyDetail?.familyLastName || user.familyLastName || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={user.studentsCount || user.FamilyDetail?.Students?.length || 0}
                                                        variant="outlined"
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Email fontSize="small" color="action" />
                                                        {user.email || user.motherEmail || user.fatherEmail || 'N/A'}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {(() => {
                                                            const d = new Date(user.updatedAt || user.createdAt);
                                                            const dd = String(d.getDate()).padStart(2, '0');
                                                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                                                            const yyyy = d.getFullYear();
                                                            const hh = String(d.getHours()).padStart(2, '0');
                                                            const min = String(d.getMinutes()).padStart(2, '0');
                                                            return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
                                                        })()}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {getUserStatus(user) === 'Activo' ? (
                                                        <Typography variant="body2" color="textSecondary">-</Typography>
                                                    ) : (
                                                        <Chip
                                                            label={getUserStatus(user)}
                                                            color={getStatusColor(getUserStatus(user))}
                                                            size="small"
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                        <IconButton size="small" onClick={() => handleEditClick(user)}>
                                                            <Edit fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => handleDeleteClick(user)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                        {Number(user.roleId) === 3 && (
                                                            <>
                                                                <IconButton size="small" onClick={() => handleAssignBuses(user)}>
                                                                    <DirectionsBus fontSize="small" />
                                                                </IconButton>
                                                                <IconButton size="small" onClick={() => handleSendContract(user)}>
                                                                    <Mail fontSize="small" />
                                                                </IconButton>
                                                            </>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                        {paginatedUsers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                                    <Typography variant="body1" color="textSecondary">
                                                        No se encontraron usuarios con los filtros aplicados
                                                    </Typography>
                                                </TableCell>
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
                                    rowsPerPageOptions={[5,10,25,50]}
                                />
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={openBulkDialog} onClose={() => setOpenBulkDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Usuarios</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Sube un archivo Excel/CSV con las columnas necesarias. Usa la plantilla oficial.<br />
                        <br />
                        Las listas de Colegios y Tipo de Ruta están en la hoja "Listas" de la plantilla.<br />
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
                            <input
                                type="file"
                                hidden
                                onChange={(e) => setBulkFile(e.target.files[0])}
                                accept=".xlsx,.xls,.csv"
                            />
                        </Button>
                    </Box>
                    {bulkFile && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Archivo seleccionado: {bulkFile.name}
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
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenBulkDialog(false)}>Cancelar</Button>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        disabled={!bulkFile || bulkLoading}
                        onClick={handleBulkUpload}
                    >
                        Subir
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de confirmación para descargas */}
            <Dialog open={openSchoolSelectDialog} onClose={() => setOpenSchoolSelectDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {downloadMode === 'report' ? 'Reporte de Rutas' : 
                     downloadMode === 'new' ? 'Descargar Nuevos' : 'Descargar Todos'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {downloadMode === 'report' 
                            ? `¿Deseas generar el reporte de rutas para ${currentSchool?.name}?`
                            : downloadMode === 'new' 
                                ? `¿Deseas descargar los usuarios nuevos de ${currentSchool?.name}?`
                                : `¿Deseas descargar todos los usuarios de ${currentSchool?.name}?`
                        }
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSchoolSelectDialog(false)}>Cancelar</Button>
                    <Button 
                        variant="contained" 
                        color="primary"
                        onClick={() => {
                            if (downloadMode === 'report') {
                                // Generar reporte de rutas para el colegio actual
                                console.log('Generar reporte para colegio:', schoolId);
                            } else if (downloadMode === 'new') {
                                // Descargar usuarios nuevos del colegio actual
                                console.log('Descargar nuevos para colegio:', schoolId);
                            } else {
                                // Descargar todos los usuarios del colegio actual
                                console.log('Descargar todos para colegio:', schoolId);
                            }
                            setOpenSchoolSelectDialog(false);
                        }}
                    >
                        {downloadMode === 'report' ? 'Generar Reporte' : 'Descargar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal Circular Masiva */}
            <CircularMasivaModal
                open={openCircularModal}
                onClose={() => setOpenCircularModal(false)}
                schools={Array.isArray(schools) ? schools : []}
                onSuccess={() => {
                    setSnackbar({ open: true, message: 'Circular enviada exitosamente', severity: 'success' });
                }}
            />

            {/* Modal para asignar buses */}
            <StudentScheduleModal
                studentId={null}
                students={scheduleModalStudents}
                schoolId={scheduleSchoolId}
                open={openStudentScheduleModal}
                onClose={() => {
                    setOpenStudentScheduleModal(false);
                    setScheduleModalStudents([]);
                    setScheduleSchoolId(null);
                    fetchUsers();
                }}
            />

            {/* Diálogo para envío de contrato */}
            <Dialog open={openSendContractDialog} onClose={() => setOpenSendContractDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Enviar Contrato Manualmente</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Selecciona el contrato que deseas enviar a <strong>{selectedUser?.name}</strong>.
                    </DialogContentText>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Contrato</InputLabel>
                        <Select
                            value=""
                            label="Contrato"
                        >
                            {Array.isArray(contracts) && contracts
                                .filter(c => c.schoolId === null || Number(c.schoolId) === Number(selectedUser?.school))
                                .map((contract) => (
                                    <MenuItem key={contract.uuid} value={contract.uuid}>
                                        {contract.title}
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSendContractDialog(false)}>Cancelar</Button>
                    <Button variant="contained" color="primary">
                        Enviar
                    </Button>
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

            {/* Diálogo para crear/editar usuario */}
            <Dialog open={openEditDialog} onClose={() => {
                setOpenEditDialog(false);
            }} maxWidth="md" fullWidth>
                <DialogTitle>{selectedUser?.id ? 'Editar Usuario' : 'Añadir Usuario'}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedUser?.id
                            ? 'Actualiza la información del usuario.'
                            : 'Completa la información para crear un nuevo usuario.'}
                    </DialogContentText>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        autoFocus={!!selectedUser?.id}
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
                                {selectedUser?.id && (
                                    <Grid item xs={12}>
                                        <TextField
                                            name="password"
                                            label="Nueva Contraseña (opcional)"
                                            type="password"
                                            fullWidth
                                            variant="outlined"
                                            value={selectedUser?.password || ''}
                                            onChange={handleUserChange}
                                            helperText="Dejarlo en blanco para mantener la contraseña actual"
                                        />
                                    </Grid>
                                )}
                            </Grid>
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
                        {Number(selectedUser?.roleId) === 3 && (
                            <>
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ mt: 3, ml: 2 }}>
                                        Datos de la Familia (Padre)
                                    </Typography>
                                </Grid>
                                <Grid container spacing={2} sx={{ mt: 1, pl: 2 }}>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            autoFocus={!selectedUser?.id}
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
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="razonSocial"
                                            label="Razón Social"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.razonSocial}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="nit"
                                            label="NIT"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.nit}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="mainAddress"
                                            label="Dirección Principal"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.mainAddress}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="alternativeAddress"
                                            label="Dirección Alternativa"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.alternativeAddress}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <FormControl variant="outlined" fullWidth>
                                            <InputLabel>Tipo de Ruta</InputLabel>
                                            <Select
                                                name="routeType"
                                                value={familyDetail.routeType}
                                                onChange={handleFamilyDetailChange}
                                                label="Tipo de Ruta"
                                            >
                                                <MenuItem value="">
                                                    <em>Seleccione un tipo</em>
                                                </MenuItem>
                                                <MenuItem value="Completa">Completa</MenuItem>
                                                <MenuItem value="Media AM">Media AM</MenuItem>
                                                <MenuItem value="Media PM">Media PM</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="specialFee"
                                            label="Descuento Especial"
                                            type="number"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.specialFee}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                </Grid>
                                
                                {/* Sección de estudiantes */}
                                <Typography variant="h6" sx={{ mt: 3, ml: 2 }}>
                                    Estudiantes
                                </Typography>
                                <Grid container spacing={2} sx={{ mt: 1, pl: 2 }}>
                                    <Grid item xs={12} md={5}>
                                        <TextField
                                            name="fullName"
                                            label="Nombre del Estudiante"
                                            fullWidth
                                            variant="outlined"
                                            value={newStudent.fullName}
                                            onChange={(e) => setNewStudent(prev => ({ ...prev, fullName: e.target.value }))}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={5}>
                                        <FormControl fullWidth variant="outlined">
                                            <InputLabel>Grado</InputLabel>
                                            <Select
                                                name="grade"
                                                label="Grado"
                                                value={newStudent.grade}
                                                onChange={(e) => setNewStudent(prev => ({ ...prev, grade: e.target.value }))}
                                            >
                                                <MenuItem value="">
                                                    <em>Seleccione un grado</em>
                                                </MenuItem>
                                                {availableGrades.length === 0 ? (
                                                    <MenuItem value="">No hay grados disponibles</MenuItem>
                                                ) : (
                                                    availableGrades.map((g, i) => (
                                                        <MenuItem key={i} value={g}>{g}</MenuItem>
                                                    ))
                                                )}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={2}>
                                        <Button
                                            variant="outlined"
                                            onClick={handleAddStudent}
                                            fullWidth
                                            sx={{ height: '56px' }}
                                        >
                                            Agregar
                                        </Button>
                                    </Grid>
                                    {familyDetail.students.length > 0 && (
                                        <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                                Estudiantes registrados:
                                            </Typography>
                                            {familyDetail.students.map((student, index) => (
                                                <Grid container spacing={2} key={index} sx={{ mb: 2, alignItems: 'center' }}>
                                                    <Grid item xs={12} md={6}>
                                                        <TextField
                                                            fullWidth
                                                            label={`Nombre del Estudiante ${index + 1}`}
                                                            value={student.fullName || ''}
                                                            onChange={(e) => setFamilyDetail(prev => {
                                                                const copy = Array.isArray(prev.students) ? [...prev.students] : [];
                                                                copy[index] = { ...copy[index], fullName: e.target.value };
                                                                return { ...prev, students: copy };
                                                            })}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={9} md={5}>
                                                        <FormControl fullWidth variant="outlined">
                                                            <InputLabel>{`Grado`}</InputLabel>
                                                            <Select
                                                                value={student.grade || ''}
                                                                label="Grado"
                                                                onChange={(e) => setFamilyDetail(prev => {
                                                                    const copy = Array.isArray(prev.students) ? [...prev.students] : [];
                                                                    copy[index] = { ...copy[index], grade: e.target.value };
                                                                    return { ...prev, students: copy };
                                                                })}
                                                            >
                                                                <MenuItem value="">
                                                                    <em>Seleccione un grado</em>
                                                                </MenuItem>
                                                                {availableGrades.length === 0 ? (
                                                                    <MenuItem value="">No hay grados disponibles</MenuItem>
                                                                ) : (
                                                                    availableGrades.map((g, i) => (
                                                                        <MenuItem key={i} value={g}>{g}</MenuItem>
                                                                    ))
                                                                )}
                                                            </Select>
                                                        </FormControl>
                                                    </Grid>
                                                    <Grid item xs={3} md={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <IconButton size="small" onClick={() => setFamilyDetail(prev => ({ ...prev, students: prev.students.filter((_, i) => i !== index) }))}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Grid>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    )}
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
                                    {!Array.isArray(allPilots) || allPilots.length === 0 ? (
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
                                    {!Array.isArray(allMonitoras) || allMonitoras.length === 0 ? (
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
                    <Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button>
                    <Button 
                        variant="contained" 
                        color="primary"
                        onClick={handleSaveUser}
                    >
                        {selectedUser?.id ? 'Guardar Cambios' : 'Crear Usuario'}
                    </Button>
                </DialogActions>
            </Dialog>
        </PageContainer>
    );
};

export default SchoolUsersPage;
