// src/pages/EmployeesPage.jsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
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
    TablePagination,
    InputAdornment,
    TableSortLabel,
    TextField,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import { 
    Business as CorporationIcon, 
    CalendarToday,
    ArrowBack,
    Search,
    Edit,
    Delete,
    Add,
    ExpandMore,
    FileUpload,
    GetApp,
    Mail,
    FilterList,
    DirectionsBus
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import EmployeeScheduleModal from '../components/modals/EmployeeScheduleModal';
import ExcelJS from 'exceljs';
import moment from 'moment-timezone';

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
    background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
    color: white;
`;

const StyledAccordion = styled(Accordion)`
    &.MuiAccordion-root {
        border: 1px solid rgba(0, 0, 0, 0.12);
        box-shadow: none;
        margin-bottom: 8px;
        border-radius: 8px !important;
        overflow: hidden;
        
        &:before {
            display: none;
        }
    }
    
    & .MuiAccordionSummary-root {
        background-color: #f8f9fa;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        min-height: 56px;
        
        &:hover {
            background-color: #e9ecef;
        }
        
        &.Mui-expanded {
            background-color: #e3f2fd;
        }
    }
    
    & .MuiAccordionDetails-root {
        padding: 24px;
        background-color: #ffffff;
    }
`;

// Función para convertir tiempo de 24h a 12h con AM/PM
const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

const EmployeesPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { fiscalYear, corporationId } = useParams();

    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Diálogos
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [openCircularDialog, setOpenCircularDialog] = useState(false);
    
    // Estados para carga masiva
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    
    // Estados para circular
    const [circularSubject, setCircularSubject] = useState('');
    const [circularMessage, setCircularMessage] = useState('');
    const [circularLoading, setCircularLoading] = useState(false);
    
    // Estado de la corporación
    const [corporationData, setCorporationData] = useState(location.state?.corporation || null);
    
    // Formulario de empleado - SOLO campos del formulario de inscripción + phoneNumber
    const [employeeForm, setEmployeeForm] = useState({
        name: '',
        email: '',
        password: '',
        phoneNumber: '',
        serviceAddress: '',
        zoneOrSector: '',
        routeType: 'Completa',
        emergencyContact: '',
        emergencyRelationship: '',
        emergencyPhone: '',
        selectedSchedule: -1,
        scheduleSlots: []
    });
    
    // Estados de acordeón
    const [expandedPanels, setExpandedPanels] = useState({
        basicInfo: true,
        contactInfo: false,
        schedules: false
    });

    // Funciones auxiliares para determinar el estado de los empleados
    const isEmployeeNew = (employee) => {
        if (!employee.EmployeeDetail) return false;
        if (employee.EmployeeDetail.isNew === false) return false;
        const createdAt = new Date(employee.createdAt);
        const now = new Date();
        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
        return diffDays <= 14;
    };

    const isEmployeeDuplicated = (employee, allEmployees) => {
        const email = employee.email?.trim().toLowerCase();
        if (!email) return false;
        const count = allEmployees.filter(
            e => e.email && e.email.trim().toLowerCase() === email
        ).length;
        return count > 1;
    };

    const getEmployeeStatus = useCallback((employee) => {
        // If employee has explicit state flag (DB uses 0/1), consider 0 as Inactivo
        if (employee && (employee.state === 0 || employee.state === '0' || employee.state === false)) return 'Inactivo';
        if (isEmployeeNew(employee)) return 'Nuevo';
        if (isEmployeeDuplicated(employee, employees)) return 'Duplicado';
        if (employee.EmployeeDetail && employee.EmployeeDetail.hasUpdatedData) return 'Actualizado';
        return 'Activo';
    }, [employees]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Nuevo':
                return 'success';
            case 'Duplicado':
                return 'warning';
            case 'Actualizado':
                return 'info';
            case 'Inactivo':
                return 'error';
            default:
                return 'default';
        }
    };

    const fetchCorporationData = useCallback(async () => {
        if (!corporationId || corporationData) return;
        
        try {
            const response = await api.get(`/corporations/${corporationId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            const corp = response.data.corporation;
            
            // Parse schedules if it's a string
            if (corp.schedules && typeof corp.schedules === 'string') {
                try {
                    corp.schedules = JSON.parse(corp.schedules);
                } catch (e) {
                    corp.schedules = [];
                }
            } else if (!Array.isArray(corp.schedules)) {
                corp.schedules = [];
            }
            
            // Parse routeSchedules if it's a string
            if (corp.routeSchedules && typeof corp.routeSchedules === 'string') {
                try {
                    corp.routeSchedules = JSON.parse(corp.routeSchedules);
                } catch (e) {
                    corp.routeSchedules = [];
                }
            } else if (!Array.isArray(corp.routeSchedules)) {
                corp.routeSchedules = [];
            }
            
            // Parse routeNumbers if it's a string
            if (corp.routeNumbers && typeof corp.routeNumbers === 'string') {
                try {
                    corp.routeNumbers = JSON.parse(corp.routeNumbers);
                } catch (e) {
                    corp.routeNumbers = [];
                }
            } else if (!Array.isArray(corp.routeNumbers)) {
                corp.routeNumbers = [];
            }
            
            // Los campos JSON ya vienen parseados desde el backend gracias a los getters del modelo
            setCorporationData(corp);
            
            console.log('[EmployeesPage] Corporation loaded:', {
                name: corp.name,
                routeNumbers: corp.routeNumbers,
                routeSchedules: corp.routeSchedules,
                businessHours: corp.businessHours,
                schedules: corp.schedules
            });
        } catch (err) {
            console.error('Error fetching corporation data:', err);
        }
    }, [auth.token, corporationId, corporationData]);

    const fetchEmployees = useCallback(async () => {
        if (!corporationId) return;
        
        setLoading(true);
        try {
            const response = await api.get(`/corporations/${corporationId}/employees`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    fiscalYear: fiscalYear
                }
            });
            
            const employeesData = response.data.employees || [];
            setEmployees(employeesData);
            setFilteredEmployees(employeesData);
        } catch (err) {
            console.error('Error fetching employees:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener empleados', 
                severity: 'error' 
            });
        } finally {
            setLoading(false);
        }
    }, [auth.token, corporationId, fiscalYear]);

    useEffect(() => {
        if (auth.token && corporationId) {
            fetchCorporationData();
            fetchEmployees();
        }
    }, [auth.token, corporationId, fetchCorporationData, fetchEmployees]);

    // Filtrado y ordenamiento
    useEffect(() => {
        let filtered = [...employees];
        
        // Búsqueda
        if (searchQuery.trim()) {
            filtered = filtered.filter(emp => 
                emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        
        // Filtro por estado (usando getEmployeeStatus)
        if (statusFilter) {
            filtered = filtered.filter(emp => getEmployeeStatus(emp) === statusFilter);
        }
        
        setFilteredEmployees(filtered);
    }, [employees, searchQuery, statusFilter, getEmployeeStatus]);

    const handleBackToDashboard = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}`, {
            state: {
                fiscalYear: fiscalYear,
                corporation: corporationData
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

    const handleSearch = () => {
        setSearchQuery(searchInput);
        setPage(0);
    };

    const handleClearFilters = () => {
        setSearchInput('');
        setSearchQuery('');
        setStatusFilter('');
        setPage(0);
    };

    const handleOpenCreateDialog = () => {
        setEmployeeForm({
            name: '',
            email: '',
            password: '',
            phoneNumber: '',
            serviceAddress: '',
            zoneOrSector: '',
            routeType: 'Completa',
            emergencyContact: '',
            emergencyRelationship: '',
            emergencyPhone: '',
            selectedSchedule: -1,
            scheduleSlots: []
        });
        setExpandedPanels({
            basicInfo: true,
            contactInfo: false,
            schedules: false
        });
        setOpenCreateDialog(true);
    };

    const handleOpenEditDialog = (employee) => {
        setSelectedEmployee(employee);
        
        // Convertir selectedSchedule de índice numérico (si ya lo es) o mantener -1
        let scheduleIndex = -1;
        if (employee.EmployeeDetail?.selectedSchedule !== undefined && employee.EmployeeDetail?.selectedSchedule !== null) {
            scheduleIndex = Number(employee.EmployeeDetail.selectedSchedule);
            if (isNaN(scheduleIndex)) scheduleIndex = -1;
        }
        
        setEmployeeForm({
            name: employee.name || '',
            email: employee.email || '',
            password: '',
            phoneNumber: employee.phoneNumber || '',
            serviceAddress: employee.EmployeeDetail?.serviceAddress || '',
            zoneOrSector: employee.EmployeeDetail?.zoneOrSector || '',
            routeType: employee.EmployeeDetail?.routeType || 'Completa',
            emergencyContact: employee.EmployeeDetail?.emergencyContact || '',
            emergencyRelationship: employee.EmployeeDetail?.emergencyRelationship || '',
            emergencyPhone: employee.EmployeeDetail?.emergencyPhone || '',
            selectedSchedule: scheduleIndex,
            scheduleSlots: employee.ScheduleSlots || []
        });
        setExpandedPanels({
            basicInfo: true,
            contactInfo: false,
            schedules: false
        });
        setOpenEditDialog(true);
    };

    const handleOpenDeleteDialog = (employee) => {
        setSelectedEmployee(employee);
        setOpenDeleteDialog(true);
    };

    const handleOpenScheduleDialog = (employee) => {
        setSelectedEmployee(employee);
        setOpenScheduleDialog(true);
    };

    const handleCloseDialogs = () => {
        setOpenCreateDialog(false);
        setOpenEditDialog(false);
        setOpenDeleteDialog(false);
        setOpenScheduleDialog(false);
        setSelectedEmployee(null);
    };

    const handleFormChange = (field, value) => {
        setEmployeeForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedPanels(prev => ({ ...prev, [panel]: isExpanded }));
    };

    const handleCreateEmployee = async () => {
        try {
            const payload = {
                name: employeeForm.name,
                email: employeeForm.email,
                password: employeeForm.password,
                phoneNumber: employeeForm.phoneNumber,
                employeeDetail: {
                    serviceAddress: employeeForm.serviceAddress,
                    zoneOrSector: employeeForm.zoneOrSector,
                    routeType: employeeForm.routeType,
                    emergencyContact: employeeForm.emergencyContact,
                    emergencyRelationship: employeeForm.emergencyRelationship,
                    emergencyPhone: employeeForm.emergencyPhone,
                    selectedSchedule: employeeForm.selectedSchedule
                },
                scheduleSlots: employeeForm.scheduleSlots
            };
            
            await api.post(`/corporations/${corporationId}/employees`, payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Empleado creado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchEmployees();
        } catch (err) {
            console.error('Error creating employee:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al crear empleado',
                severity: 'error'
            });
        }
    };

    const handleUpdateEmployee = async () => {
        if (!selectedEmployee) return;
        
        try {
            const payload = {
                name: employeeForm.name,
                email: employeeForm.email,
                phoneNumber: employeeForm.phoneNumber,
                employeeDetail: {
                    serviceAddress: employeeForm.serviceAddress,
                    zoneOrSector: employeeForm.zoneOrSector,
                    routeType: employeeForm.routeType,
                    emergencyContact: employeeForm.emergencyContact,
                    emergencyRelationship: employeeForm.emergencyRelationship,
                    emergencyPhone: employeeForm.emergencyPhone,
                    selectedSchedule: employeeForm.selectedSchedule
                }
            };
            
            // Si se proporciona contraseña, incluirla
            if (employeeForm.password) {
                payload.password = employeeForm.password;
            }
            
            await api.put(`/corporations/${corporationId}/employees/${selectedEmployee.id}`, payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Empleado actualizado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchEmployees();
        } catch (err) {
            console.error('Error updating employee:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al actualizar empleado',
                severity: 'error'
            });
        }
    };

    const handleDeleteEmployee = async () => {
        if (!selectedEmployee) return;
        
        try {
            await api.delete(`/users/${selectedEmployee.id}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Empleado eliminado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchEmployees();
        } catch (err) {
            console.error('Error deleting employee:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al eliminar empleado',
                severity: 'error'
            });
        }
    };

    const handleActivateEmployee = async (employee) => {
        if (!employee) return;
        
        try {
            await api.put(`/users/${employee.id}/activate`, {}, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Empleado activado exitosamente',
                severity: 'success'
            });
            
            fetchEmployees();
        } catch (err) {
            console.error('Error activating employee:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al activar empleado',
                severity: 'error'
            });
        }
    };

    // Función para descargar empleados NUEVOS
    const handleDownloadNewEmployees = async () => {
        try {
            const newEmployees = employees.filter(emp => isEmployeeNew(emp));
            
            if (newEmployees.length === 0) {
                setSnackbar({
                    open: true,
                    message: 'No hay empleados nuevos para descargar',
                    severity: 'warning'
                });
                return;
            }
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Empleados Nuevos');
            
            worksheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Teléfono', key: 'phone', width: 15 },
                { header: 'Dirección Servicio', key: 'serviceAddress', width: 40 },
                { header: 'Zona/Sector', key: 'zoneOrSector', width: 20 },
                { header: 'Tipo Ruta', key: 'routeType', width: 15 },
                { header: 'Horario', key: 'schedule', width: 30 },
                { header: 'Fecha Creación', key: 'createdAt', width: 20 }
            ];
            
            newEmployees.forEach(emp => {
                const detail = emp.EmployeeDetail || {};
                const scheduleIndex = detail.selectedSchedule;
                let scheduleName = 'Sin horario';
                
                if (scheduleIndex >= 0 && corporationData?.schedules?.[scheduleIndex]) {
                    const sched = corporationData.schedules[scheduleIndex];
                    scheduleName = `${sched.name} (${formatTime12Hour(sched.entryTime)} - ${formatTime12Hour(sched.exitTime)})`;
                }
                
                worksheet.addRow({
                    name: emp.name || '',
                    email: emp.email || '',
                    phone: emp.phoneNumber || '',
                    serviceAddress: detail.serviceAddress || '',
                    zoneOrSector: detail.zoneOrSector || '',
                    routeType: detail.routeType || '',
                    schedule: scheduleName,
                    createdAt: emp.createdAt ? moment(emp.createdAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : ''
                });
            });
            
            // Aplicar estilos al header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1976D2' }
            };
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Empleados_Nuevos_${currentCorporation?.name || 'Corporativo'}_${moment().format('YYYYMMDD')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            setSnackbar({
                open: true,
                message: 'Archivo descargado exitosamente',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error downloading new employees:', err);
            setSnackbar({
                open: true,
                message: 'Error al descargar empleados',
                severity: 'error'
            });
        }
    };

    // Función para descargar TODOS los empleados
    const handleDownloadAllEmployees = async () => {
        try {
            if (employees.length === 0) {
                setSnackbar({
                    open: true,
                    message: 'No hay empleados para descargar',
                    severity: 'warning'
                });
                return;
            }
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Todos los Empleados');
            
            worksheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Teléfono', key: 'phone', width: 15 },
                { header: 'Dirección Servicio', key: 'serviceAddress', width: 40 },
                { header: 'Zona/Sector', key: 'zoneOrSector', width: 20 },
                { header: 'Tipo Ruta', key: 'routeType', width: 15 },
                { header: 'Contacto Emergencia', key: 'emergencyContact', width: 25 },
                { header: 'Relación Emergencia', key: 'emergencyRelationship', width: 20 },
                { header: 'Teléfono Emergencia', key: 'emergencyPhone', width: 15 },
                { header: 'Horario', key: 'schedule', width: 30 },
                { header: 'Paradas', key: 'stops', width: 15 },
                { header: 'Estado', key: 'status', width: 15 },
                { header: 'Fecha Creación', key: 'createdAt', width: 20 },
                { header: 'Última Actualización', key: 'updatedAt', width: 20 }
            ];
            
            employees.forEach(emp => {
                const detail = emp.EmployeeDetail || {};
                const scheduleIndex = detail.selectedSchedule;
                let scheduleName = 'Sin horario';
                
                if (scheduleIndex >= 0 && corporationData?.schedules?.[scheduleIndex]) {
                    const sched = corporationData.schedules[scheduleIndex];
                    scheduleName = `${sched.name} (${formatTime12Hour(sched.entryTime)} - ${formatTime12Hour(sched.exitTime)})`;
                }
                
                worksheet.addRow({
                    name: emp.name || '',
                    email: emp.email || '',
                    phone: emp.phoneNumber || '',
                    serviceAddress: detail.serviceAddress || '',
                    zoneOrSector: detail.zoneOrSector || '',
                    routeType: detail.routeType || '',
                    emergencyContact: detail.emergencyContact || '',
                    emergencyRelationship: detail.emergencyRelationship || '',
                    emergencyPhone: detail.emergencyPhone || '',
                    schedule: scheduleName,
                    stops: emp.ScheduleSlots?.length || 0,
                    status: getEmployeeStatus(emp),
                    createdAt: emp.createdAt ? moment(emp.createdAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : '',
                    updatedAt: emp.updatedAt ? moment(emp.updatedAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : ''
                });
            });
            
            // Aplicar estilos al header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1976D2' }
            };
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Empleados_Todos_${currentCorporation?.name || 'Corporativo'}_${moment().format('YYYYMMDD')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            setSnackbar({
                open: true,
                message: 'Archivo descargado exitosamente',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error downloading all employees:', err);
            setSnackbar({
                open: true,
                message: 'Error al descargar empleados',
                severity: 'error'
            });
        }
    };

    // Función para manejar carga masiva
    const handleBulkUpload = async () => {
        if (!bulkFile) {
            setSnackbar({
                open: true,
                message: 'Por favor seleccione un archivo',
                severity: 'warning'
            });
            return;
        }
        
        setBulkLoading(true);
        
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            
            await api.post(`/corporations/${corporationId}/employees/bulk`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Carga masiva completada exitosamente',
                severity: 'success'
            });
            
            setOpenBulkDialog(false);
            setBulkFile(null);
            fetchEmployees();
        } catch (err) {
            console.error('Error in bulk upload:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error en la carga masiva',
                severity: 'error'
            });
        } finally {
            setBulkLoading(false);
        }
    };

    // Función para enviar circular
    const handleSendCircular = async () => {
        if (!circularSubject || !circularMessage) {
            setSnackbar({
                open: true,
                message: 'Por favor complete todos los campos',
                severity: 'warning'
            });
            return;
        }
        
        setCircularLoading(true);
        
        try {
            await api.post(`/mail/circular/employees/${corporationId}`, {
                subject: circularSubject,
                message: circularMessage
            }, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Circular enviada exitosamente',
                severity: 'success'
            });
            
            setOpenCircularDialog(false);
            setCircularSubject('');
            setCircularMessage('');
        } catch (err) {
            console.error('Error sending circular:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al enviar circular',
                severity: 'error'
            });
        } finally {
            setCircularLoading(false);
        }
    };

    const currentCorporation = corporationData || location.state?.corporation;

    // Aplicar ordenamiento a los empleados filtrados antes de paginar
    const sortedEmployees = (() => {
        if (!sortBy) return filteredEmployees;
        const copy = filteredEmployees.slice();
        copy.sort((a, b) => {
            let va = '';
            let vb = '';
            switch (sortBy) {
                case 'name':
                    va = a.name || '';
                    vb = b.name || '';
                    break;
                case 'email':
                    va = a.email || '';
                    vb = b.email || '';
                    break;
                case 'updatedAt':
                    va = a.updatedAt || a.createdAt || '';
                    vb = b.updatedAt || b.createdAt || '';
                    break;
                case 'status':
                    va = getEmployeeStatus(a);
                    vb = getEmployeeStatus(b);
                    break;
                default:
                    va = '';
                    vb = '';
            }

            // Comparación numérica para fechas
            if (sortBy === 'updatedAt') {
                const da = new Date(va).getTime() || 0;
                const db = new Date(vb).getTime() || 0;
                return sortOrder === 'asc' ? da - db : db - da;
            }

            // Comparación de strings
            const cmp = va.toString().toLowerCase().localeCompare(vb.toString().toLowerCase());
            return sortOrder === 'asc' ? cmp : -cmp;
        });
        return copy;
    })();

    const paginatedEmployees = sortedEmployees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderEmployeeDialog = (isEdit = false) => (
        <Dialog 
            open={isEdit ? openEditDialog : openCreateDialog} 
            onClose={handleCloseDialogs}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                {isEdit ? 'Editar Empleado' : 'Crear Nuevo Empleado'}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    {/* Información Básica */}
                    <StyledAccordion 
                        expanded={expandedPanels.basicInfo}
                        onChange={handleAccordionChange('basicInfo')}
                    >
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                Información Básica
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Nombre Completo"
                                        value={employeeForm.name}
                                        onChange={(e) => handleFormChange('name', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        type="email"
                                        value={employeeForm.email}
                                        onChange={(e) => handleFormChange('email', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label={isEdit ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                                        type="password"
                                        value={employeeForm.password}
                                        onChange={(e) => handleFormChange('password', e.target.value)}
                                        required={!isEdit}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teléfono"
                                        value={employeeForm.phoneNumber}
                                        onChange={(e) => handleFormChange('phoneNumber', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Horario</InputLabel>
                                        <Select
                                            value={employeeForm.selectedSchedule}
                                            label="Horario"
                                            onChange={(e) => handleFormChange('selectedSchedule', e.target.value)}
                                        >
                                            <MenuItem value={-1}>
                                                <em>Seleccionar horario</em>
                                            </MenuItem>
                                            {Array.isArray(corporationData?.schedules) && corporationData.schedules.length > 0 ? (
                                                corporationData.schedules.map((schedule, idx) => (
                                                    <MenuItem key={idx} value={idx}>
                                                        {schedule.name} ({formatTime12Hour(schedule.entryTime)} - {formatTime12Hour(schedule.exitTime)})
                                                    </MenuItem>
                                                ))
                                            ) : (
                                                <MenuItem disabled value={-1}>
                                                    No hay horarios configurados
                                                </MenuItem>
                                            )}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </StyledAccordion>

                    {/* Información de Contacto */}
                    <StyledAccordion 
                        expanded={expandedPanels.contactInfo}
                        onChange={handleAccordionChange('contactInfo')}
                    >
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                Información de Contacto
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Dirección de Servicio"
                                        value={employeeForm.serviceAddress}
                                        onChange={(e) => handleFormChange('serviceAddress', e.target.value)}
                                        multiline
                                        rows={2}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Zona o Sector"
                                        value={employeeForm.zoneOrSector}
                                        onChange={(e) => handleFormChange('zoneOrSector', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Tipo de Ruta</InputLabel>
                                        <Select
                                            value={employeeForm.routeType}
                                            label="Tipo de Ruta"
                                            onChange={(e) => handleFormChange('routeType', e.target.value)}
                                        >
                                            <MenuItem value="Completa">Completa</MenuItem>
                                            <MenuItem value="Media PM">Media PM</MenuItem>
                                            <MenuItem value="Media AM">Media AM</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Contacto de Emergencia"
                                        value={employeeForm.emergencyContact}
                                        onChange={(e) => handleFormChange('emergencyContact', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Relación (Emergencia)"
                                        value={employeeForm.emergencyRelationship}
                                        onChange={(e) => handleFormChange('emergencyRelationship', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teléfono de Emergencia"
                                        value={employeeForm.emergencyPhone}
                                        onChange={(e) => handleFormChange('emergencyPhone', e.target.value)}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </StyledAccordion>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCloseDialogs}>Cancelar</Button>
                <Button 
                    onClick={isEdit ? handleUpdateEmployee : handleCreateEmployee}
                    variant="contained"
                    disabled={!employeeForm.name || !employeeForm.email || (!isEdit && !employeeForm.password)}
                >
                    {isEdit ? 'Actualizar' : 'Crear'}
                </Button>
            </DialogActions>
        </Dialog>
    );

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
                        <CorporationIcon sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Empleados - {corporationData?.name || 'Corporación'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Año Fiscal ${fiscalYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                    {filteredEmployees.length} empleados
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
                        <Grid item xs={12} md={5}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Buscar por nombre, email o departamento..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearch();
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={1}>
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleSearch}
                                sx={{ height: '56px' }}
                            >
                                Buscar
                            </Button>
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
                                    <MenuItem value="Activo">Activo</MenuItem>
                                    <MenuItem value="Inactivo">Inactivo</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={handleClearFilters}
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
                        <Grid item xs={12} md={2.4}>
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
                        <Grid item xs={12} md={2.4}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<Add />}
                                fullWidth
                                onClick={handleOpenCreateDialog}
                            >
                                Añadir Empleado
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2.4}>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<Mail />}
                                fullWidth
                                onClick={() => setOpenCircularDialog(true)}
                            >
                                Enviar Circular
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2.4}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<GetApp />}
                                fullWidth
                                onClick={handleDownloadNewEmployees}
                            >
                                Descargar Nuevos
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2.4}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<GetApp />}
                                fullWidth
                                onClick={handleDownloadAllEmployees}
                            >
                                Descargar Todos
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Tabla de empleados */}
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
                                                    active={sortBy === 'name'}
                                                    direction={sortBy === 'name' ? sortOrder : 'asc'}
                                                    onClick={() => handleSortChange('name')}
                                                >
                                                    Nombre
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'email'}
                                                    direction={sortBy === 'email' ? sortOrder : 'asc'}
                                                    onClick={() => handleSortChange('email')}
                                                >
                                                    Email
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Horario</TableCell>
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
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedEmployees.map((employee) => (
                                            <TableRow key={employee.id} hover>
                                                <TableCell>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        {employee.name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Mail fontSize="small" color="action" />
                                                        {employee.email}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const scheduleIndex = Number(employee.EmployeeDetail?.selectedSchedule);
                                                        if (scheduleIndex >= 0 && Array.isArray(corporationData?.schedules) && corporationData.schedules[scheduleIndex]) {
                                                            const schedule = corporationData.schedules[scheduleIndex];
                                                            return (
                                                                <Chip 
                                                                    label={`${schedule.name} (${formatTime12Hour(schedule.entryTime)} - ${formatTime12Hour(schedule.exitTime)})`}
                                                                    size="small"
                                                                    color="info"
                                                                    variant="outlined"
                                                                />
                                                            );
                                                        }
                                                        return (
                                                            <Typography variant="body2" color="textSecondary">
                                                                -
                                                            </Typography>
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {(() => {
                                                            const d = new Date(employee.updatedAt || employee.createdAt);
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
                                                    {getEmployeeStatus(employee) === 'Activo' ? (
                                                        <Typography variant="body2" color="textSecondary">-</Typography>
                                                    ) : getEmployeeStatus(employee) === 'Inactivo' ? (
                                                        <Chip
                                                            label={getEmployeeStatus(employee)}
                                                            color={getStatusColor(getEmployeeStatus(employee))}
                                                            size="small"
                                                            clickable
                                                            onClick={() => handleActivateEmployee(employee)}
                                                        />
                                                    ) : (
                                                        <Chip
                                                            label={getEmployeeStatus(employee)}
                                                            color={getStatusColor(getEmployeeStatus(employee))}
                                                            size="small"
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                        <IconButton size="small" onClick={() => handleOpenEditDialog(employee)}>
                                                            <Edit fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => handleOpenDeleteDialog(employee)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => handleOpenScheduleDialog(employee)}>
                                                            <DirectionsBus fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                        {paginatedEmployees.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                                    <Typography variant="body1" color="textSecondary">
                                                        No se encontraron empleados con los filtros aplicados
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                component="div"
                                count={sortedEmployees.length}
                                page={page}
                                onPageChange={(e, newPage) => setPage(newPage)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(e) => {
                                    setRowsPerPage(parseInt(e.target.value, 10));
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[5, 10, 25, 50]}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Diálogos */}
            {renderEmployeeDialog(false)}
            {renderEmployeeDialog(true)}

            {/* Diálogo de eliminar */}
            <Dialog open={openDeleteDialog} onClose={handleCloseDialogs}>
                <DialogTitle>Confirmar Eliminación</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Está seguro que desea eliminar al empleado "{selectedEmployee?.name}"?
                        Esta acción no se puede deshacer.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialogs}>Cancelar</Button>
                    <Button onClick={handleDeleteEmployee} color="error" variant="contained">
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de horario completo igual al de estudiantes */}
            <EmployeeScheduleModal 
                employee={selectedEmployee}
                corporation={corporationData}
                open={openScheduleDialog}
                onClose={handleCloseDialogs}
                onScheduleUpdated={async () => {
                    await fetchEmployees();
                    setSnackbar({
                        open: true,
                        message: 'Horario actualizado correctamente',
                        severity: 'success'
                    });
                }}
            />

            {/* Diálogo de Carga Masiva */}
            <Dialog open={openBulkDialog} onClose={() => setOpenBulkDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Empleados</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Seleccione un archivo Excel (.xlsx) con los datos de los empleados.
                            El archivo debe contener las siguientes columnas: Nombre, Email, Contraseña, Teléfono.
                        </Typography>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setBulkFile(e.target.files[0])}
                            style={{ width: '100%' }}
                        />
                        {bulkFile && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Archivo seleccionado: {bulkFile.name}
                            </Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setOpenBulkDialog(false);
                        setBulkFile(null);
                    }}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleBulkUpload} 
                        variant="contained"
                        disabled={!bulkFile || bulkLoading}
                    >
                        {bulkLoading ? <CircularProgress size={24} /> : 'Cargar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de Enviar Circular */}
            <Dialog open={openCircularDialog} onClose={() => setOpenCircularDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Enviar Circular a Empleados</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Asunto"
                            value={circularSubject}
                            onChange={(e) => setCircularSubject(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Mensaje"
                            value={circularMessage}
                            onChange={(e) => setCircularMessage(e.target.value)}
                            multiline
                            rows={6}
                            placeholder="Escriba el mensaje que desea enviar a todos los empleados del corporativo..."
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Esta circular se enviará a todos los empleados activos del corporativo: {currentCorporation?.name}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setOpenCircularDialog(false);
                        setCircularSubject('');
                        setCircularMessage('');
                    }}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSendCircular} 
                        variant="contained"
                        color="secondary"
                        disabled={!circularSubject || !circularMessage || circularLoading}
                    >
                        {circularLoading ? <CircularProgress size={24} /> : 'Enviar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert 
                    onClose={() => setSnackbar({ ...snackbar, open: false })} 
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default EmployeesPage;
