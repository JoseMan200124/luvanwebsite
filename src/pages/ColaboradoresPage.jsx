// src/pages/ColaboradoresPage.jsx
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
    DirectionsBus,
    ToggleOn,
    ToggleOff
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import ColaboradorScheduleModal from '../components/modals/ColaboradorScheduleModal';
import BulkScheduleColaboradoresModal from '../components/modals/BulkScheduleColaboradoresModal';
import ExcelJS from 'exceljs';
import moment from 'moment-timezone';
import { normalizeKey } from '../utils/stringHelpers';
import { showDuplicateEmailFromError } from '../utils/duplicateEmailHandler';

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

const ColaboradoresPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { fiscalYear, corporationId } = useParams();

    const [colaboradores, setColaboradores] = useState([]);
    const [filteredColaboradores, setFilteredColaboradores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedColaborador, setSelectedColaborador] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Diálogos
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openToggleStateDialog, setOpenToggleStateDialog] = useState(false);
    const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [openBulkScheduleDialog, setOpenBulkScheduleDialog] = useState(false);
    const [openCircularDialog, setOpenCircularDialog] = useState(false);
    // Dialogo unificado para descargas (Nuevos / Todos)
    const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
    const [downloadChoice, setDownloadChoice] = useState('new'); // 'new' | 'all'
    
    // Estados para carga masiva
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    
    // Estados para circular
    const [circularSubject, setCircularSubject] = useState('');
    const [circularMessage, setCircularMessage] = useState('');
    const [circularLoading, setCircularLoading] = useState(false);
    
    // Estado para reporte de paradas
    const [stopReportLoading, setStopReportLoading] = useState(false);
    
    // Estado de la corporación
    const [corporationData, setCorporationData] = useState(location.state?.corporation || null);
    
    // Formulario de colaborador - SOLO campos del formulario de inscripción + phoneNumber
    const [colaboradorForm, setColaboradorForm] = useState({
        username: '',
        firstName: '',
        lastName: '',
        name: '',
        email: '',
        password: '',
        phoneNumber: '',
        serviceAddress: '',
        zoneOrSector: '',
        routeType: 'Completa',
        employeeNumber: '',
        emergencyContact: '',
        emergencyRelationship: '',
        emergencyPhone: '',
        selectedSchedule: -1,
        scheduleSlots: []
    });

    // Valores de campos extra definidos por la corporación (clave: fieldName)
    const [extraFieldsValues, setExtraFieldsValues] = useState({});
    
    // Estados de acordeón
    const [expandedPanels, setExpandedPanels] = useState({
        basicInfo: true,
        contactInfo: false,
        schedules: false,
        extraFields: false
    });

    // Función para obtener fecha/hora formateada para nombres de archivo
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

    // Funciones auxiliares para determinar el estado de los colaboradores
    const isColaboradorNew = (colaborador) => {
        if (!colaborador.ColaboradorDetail) return false;
        if (colaborador.ColaboradorDetail.isNew === false) return false;
        const createdAt = new Date(colaborador.createdAt);
        const now = new Date();
        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
        return diffDays <= 14;
    };

    const isColaboradorDuplicated = (colaborador, allColaboradores) => {
        const email = normalizeKey(colaborador.email);
        if (!email) return false;
        const count = allColaboradores.filter(
            e => e.email && normalizeKey(e.email) === email
        ).length;
        return count > 1;
    };

    const getColaboradorStatus = useCallback((colaborador) => {
        // If colaborador has explicit state flag (DB uses 0/1), consider 0 as Inactivo
        if (colaborador && (colaborador.state === 0 || colaborador.state === '0' || colaborador.state === false)) return 'Inactivo';
        if (isColaboradorNew(colaborador)) return 'Nuevo';
        if (isColaboradorDuplicated(colaborador, colaboradores)) return 'Duplicado';
        if (colaborador.ColaboradorDetail && colaborador.ColaboradorDetail.hasUpdatedData) return 'Actualizado';
        return 'Activo';
    }, [colaboradores]);

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

    // Determine assignment status for a collaborator's schedule slots
    // Binary behavior: either has assignments ('all') or none ('none').
    const getCollaboratorAssignStatus = (col) => {
        try {
            const slots = col?.scheduleSlots || col?.ScheduleSlots || col?.schedule || [];
            let arr = slots;
            if (!Array.isArray(arr)) {
                try { arr = JSON.parse(arr || '[]'); } catch (e) { arr = []; }
            }
            if (!Array.isArray(arr) || arr.length === 0) return 'none';

            const assignedCount = arr.filter(s => {
                if (!s) return false;
                const hasRoute = s.route || s.routeId || s.routeNumber || s.route_num;
                const hasStop = s.stop || s.stopId || s.stopName || s.parada || s.paradaId;
                return Boolean(hasRoute) || Boolean(hasStop);
            }).length;

            return assignedCount > 0 ? 'all' : 'none';
        } catch (e) {
            return 'none';
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
            
            console.log('[ColaboradoresPage] Corporation loaded:', {
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

    const fetchColaboradores = useCallback(async () => {
        if (!corporationId) return;
        
        setLoading(true);
        try {
            const response = await api.get(`/corporations/${corporationId}/colaboradores`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    fiscalYear: fiscalYear
                }
            });
            
            const colaboradoresData = response.data.colaboradores || [];
            setColaboradores(colaboradoresData);
            setFilteredColaboradores(colaboradoresData);
        } catch (err) {
            console.error('Error fetching colaboradores:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener colaboradores.', 
                severity: 'error' 
            });
        } finally {
            setLoading(false);
        }
    }, [auth.token, corporationId, fiscalYear]);

    useEffect(() => {
        if (auth.token && corporationId) {
            fetchCorporationData();
            fetchColaboradores();
        }
    }, [auth.token, corporationId, fetchCorporationData, fetchColaboradores]);

    useRegisterPageRefresh(async () => {
        setLoading(true);
        try {
            await Promise.all([fetchCorporationData(), fetchColaboradores()]);
        } finally {
            setLoading(false);
        }
    }, [fetchCorporationData, fetchColaboradores]);

    // Filtrado y ordenamiento
    useEffect(() => {
        let filtered = [...colaboradores];
        
        // Búsqueda
        if (searchQuery.trim()) {
            filtered = filtered.filter(col => 
                col.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                col.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        
        // Filtro por estado (usando getColaboradorStatus)
        if (statusFilter) {
            if (statusFilter === 'Sin asignaciones') {
                // Only show collaborators with NO assignments
                filtered = filtered.filter(col => getCollaboratorAssignStatus(col) === 'none');
            } else {
                filtered = filtered.filter(col => getColaboradorStatus(col) === statusFilter);
            }
        }
        
        setFilteredColaboradores(filtered);
    }, [colaboradores, searchQuery, statusFilter, getColaboradorStatus]);

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
        setColaboradorForm({
            username: '',
            firstName: '',
            lastName: '',
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
            schedules: false,
            extraFields: true
        });
        // Inicializar campos extra desde la configuración de la corporación
        const parsedExtra = Array.isArray(corporationData?.extraEnrollmentFields) ? corporationData.extraEnrollmentFields : [];
        const initialExtra = {};
        parsedExtra.forEach((f, idx) => {
            const fieldName = f.fieldName || f.label || f.name || f.key || `extra_${idx}`;
            initialExtra[fieldName] = f.default !== undefined ? f.default : '';
        });
        setExtraFieldsValues(initialExtra);
        setOpenCreateDialog(true);
    };

    const handleOpenEditDialog = (colaborador) => {
        setSelectedColaborador(colaborador);
        
        console.log('[ColaboradoresPage] Opening edit dialog for colaborador:', {
            colaboradorName: colaborador.name,
            hasColaboradorDetail: !!colaborador.ColaboradorDetail,
            extraFields: colaborador.ColaboradorDetail?.extraFields,
            extraFieldsType: typeof colaborador.ColaboradorDetail?.extraFields,
            corporationExtraFields: corporationData?.extraEnrollmentFields
        });
        
        // Convertir selectedSchedule de índice numérico (si ya lo es) o mantener -1
        let scheduleIndex = -1;
        if (colaborador.ColaboradorDetail?.selectedSchedule !== undefined && colaborador.ColaboradorDetail?.selectedSchedule !== null) {
            scheduleIndex = Number(colaborador.ColaboradorDetail.selectedSchedule);
            if (isNaN(scheduleIndex)) scheduleIndex = -1;
        }
        
        setColaboradorForm({
            username: colaborador.name || '',
            firstName: colaborador.ColaboradorDetail?.firstName || '',
            lastName: colaborador.ColaboradorDetail?.lastName || '',
            name: colaborador.name || '',
            email: colaborador.email || '',
            password: '',
            phoneNumber: colaborador.phoneNumber || '',
            employeeNumber: colaborador.ColaboradorDetail?.employeeNumber || '',
            serviceAddress: colaborador.ColaboradorDetail?.serviceAddress || '',
            zoneOrSector: colaborador.ColaboradorDetail?.zoneOrSector || '',
            routeType: colaborador.ColaboradorDetail?.routeType || 'Completa',
            emergencyContact: colaborador.ColaboradorDetail?.emergencyContact || '',
            emergencyRelationship: colaborador.ColaboradorDetail?.emergencyRelationship || '',
            emergencyPhone: colaborador.ColaboradorDetail?.emergencyPhone || '',
            selectedSchedule: scheduleIndex,
            scheduleSlots: colaborador.ScheduleSlots || []
        });
        // Inicializar campos extra con los valores existentes del colaborador o defaults de la corporación
        const corpFields = Array.isArray(corporationData?.extraEnrollmentFields) ? corporationData.extraEnrollmentFields : [];
        const initialExtra = {};
        
        // Parsear extraFields del colaborador si es string
        let colExtras = colaborador.ColaboradorDetail?.extraFields || {};
        if (typeof colExtras === 'string') {
            try {
                colExtras = JSON.parse(colExtras);
            } catch (e) {
                colExtras = {};
            }
        }
        
        // Crear mapa de claves normalizadas (trim) para búsqueda flexible
        const colExtrasNormalized = {};
        Object.keys(colExtras).forEach(k => {
            const trimmedKey = k.trim();
            colExtrasNormalized[trimmedKey] = colExtras[k];
        });
        
        corpFields.forEach((f, idx) => {
            const fieldName = f.fieldName || f.label || f.name || f.key || `extra_${idx}`;
            const trimmedFieldName = fieldName.trim();
            
            // Buscar valor guardado: primero con clave exacta, luego con clave trimmed
            let saved = f.default !== undefined ? f.default : '';
            if (colExtras[fieldName] !== undefined) {
                saved = colExtras[fieldName];
            } else if (colExtrasNormalized[trimmedFieldName] !== undefined) {
                saved = colExtrasNormalized[trimmedFieldName];
            }
            
            initialExtra[fieldName] = saved;
        });
        
        // También incluir cualquier extraFields que existan en ColaboradorDetail pero no estén en corpFields
        Object.keys(colExtras).forEach(k => { 
            const trimmedK = k.trim();
            // Buscar si algún campo de corpFields coincide (exacto o trimmed)
            const existsInCorp = corpFields.some(f => {
                const fn = f.fieldName || f.label || f.name || f.key || '';
                return fn === k || fn.trim() === trimmedK || fn === trimmedK;
            });
            if (!existsInCorp && initialExtra[k] === undefined) {
                initialExtra[k] = colExtras[k];
            }
        });
        
        setExtraFieldsValues(initialExtra);
        
        console.log('[ColaboradoresPage] Initialized extraFieldsValues:', initialExtra);
        
        setExpandedPanels({
            basicInfo: true,
            contactInfo: false,
            schedules: false,
            extraFields: true
        });
        setOpenEditDialog(true);
    };

    const handleOpenDeleteDialog = (colaborador) => {
        setSelectedColaborador(colaborador);
        setOpenDeleteDialog(true);
    };

    const handleOpenToggleStateDialog = (colaborador) => {
        setSelectedColaborador(colaborador);
        setOpenToggleStateDialog(true);
    };

    const handleOpenScheduleDialog = (colaborador) => {
        setSelectedColaborador(colaborador);
        setOpenScheduleDialog(true);
    };

    const handleCloseDialogs = () => {
        setOpenCreateDialog(false);
        setOpenEditDialog(false);
        setOpenDeleteDialog(false);
        setOpenToggleStateDialog(false);
        setOpenScheduleDialog(false);
        setSelectedColaborador(null);
    };

    const handleFormChange = (field, value) => {
        setColaboradorForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedPanels(prev => ({ ...prev, [panel]: isExpanded }));
    };

    const handleCreateColaborador = async () => {
        try {
            const payload = {
                name: colaboradorForm.username || colaboradorForm.name,
                email: colaboradorForm.email,
                password: colaboradorForm.password,
                phoneNumber: colaboradorForm.phoneNumber,
                colaboradorDetail: {
                    firstName: colaboradorForm.firstName || null,
                    lastName: colaboradorForm.lastName || null,
                    employeeNumber: colaboradorForm.employeeNumber || null,
                    serviceAddress: colaboradorForm.serviceAddress,
                    zoneOrSector: colaboradorForm.zoneOrSector,
                    routeType: colaboradorForm.routeType,
                    emergencyContact: colaboradorForm.emergencyContact,
                    emergencyRelationship: colaboradorForm.emergencyRelationship,
                    emergencyPhone: colaboradorForm.emergencyPhone,
                    selectedSchedule: colaboradorForm.selectedSchedule
                },
                scheduleSlots: colaboradorForm.scheduleSlots
            };
            // Incluir campos extra si existen
            if (extraFieldsValues && Object.keys(extraFieldsValues).length > 0) {
                payload.colaboradorDetail.extraFields = extraFieldsValues;
            }
            
            await api.post(`/corporations/${corporationId}/colaboradores`, payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Colaborador creado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchColaboradores();
        } catch (err) {
            try {
                if (showDuplicateEmailFromError(err, setSnackbar)) return;
            } catch (e) {
                // fallthrough to generic handling
            }

            console.error('Error creating colaborador:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al crear colaborador',
                severity: 'error'
            });
        }
    };

    const handleUpdateColaborador = async () => {
        if (!selectedColaborador) return;
        
        try {
            const payload = {
                name: colaboradorForm.username || colaboradorForm.name,
                email: colaboradorForm.email,
                phoneNumber: colaboradorForm.phoneNumber,
                colaboradorDetail: {
                    firstName: colaboradorForm.firstName,
                    lastName: colaboradorForm.lastName,
                    employeeNumber: colaboradorForm.employeeNumber,
                    serviceAddress: colaboradorForm.serviceAddress,
                    zoneOrSector: colaboradorForm.zoneOrSector,
                    routeType: colaboradorForm.routeType,
                    emergencyContact: colaboradorForm.emergencyContact,
                    emergencyRelationship: colaboradorForm.emergencyRelationship,
                    emergencyPhone: colaboradorForm.emergencyPhone,
                    selectedSchedule: colaboradorForm.selectedSchedule
                }
            };
            // Incluir campos extra si existen
            if (extraFieldsValues && Object.keys(extraFieldsValues).length > 0) {
                payload.colaboradorDetail.extraFields = extraFieldsValues;
            }
            
            // Si se proporciona contraseña, incluirla
            if (colaboradorForm.password) {
                payload.password = colaboradorForm.password;
            }
            
            await api.put(`/corporations/${corporationId}/colaboradores/${selectedColaborador.id}`, payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Colaborador actualizado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchColaboradores();
        } catch (err) {
            console.error('Error updating colaborador:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al actualizar colaborador',
                severity: 'error'
            });
        }
    };

    const handleDeleteColaborador = async () => {
        if (!selectedColaborador) return;
        
        try {
            await api.delete(`/users/${selectedColaborador.id}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Colaborador eliminado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchColaboradores();
        } catch (err) {
            console.error('Error deleting colaborador:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.message || 'Error al eliminar colaborador',
                severity: 'error'
            });
        }
    };

    const handleToggleState = async () => {
        if (!selectedColaborador) return;
        
        // Determinar el nuevo estado (opuesto al actual)
        const currentState = Number(selectedColaborador.state);
        const newState = currentState === 1 ? 0 : 1;
        
        try {
            await api.put(`/users/${selectedColaborador.id}/toggle-state`, 
                { state: newState },
                {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    }
                }
            );
            
            setSnackbar({
                open: true,
                message: `Colaborador ${newState === 1 ? 'activado' : 'desactivado'} exitosamente`,
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchColaboradores();
        } catch (err) {
            console.error('Error toggling colaborador state:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.message || 'Error al cambiar estado del colaborador',
                severity: 'error'
            });
        }
    };

    // Función para descargar colaboradores NUEVOS
    const handleDownloadNewColaboradores = async () => {
        try {
            const resp = await api.get(`/corporations/${corporationId}/colaboradores/download`, { params: { mode: 'new' } });
            const newColaboradores = resp.data.colaboradores || [];
            if (newColaboradores.length === 0) {
                setSnackbar({ open: true, message: 'No hay colaboradores nuevos para descargar', severity: 'warning' });
                return;
            }
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Colaboradores Nuevos');
            
            worksheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Teléfono', key: 'phone', width: 15 },
                { header: 'Dirección Servicio', key: 'serviceAddress', width: 40 },
                { header: 'Zona/Sector', key: 'zoneOrSector', width: 20 },
                { header: 'Tipo Ruta', key: 'routeType', width: 15 },
                { header: 'Horario', key: 'schedule', width: 30 },
                { header: 'Estado', key: 'status', width: 15 },
                { header: 'Fecha Creación', key: 'createdAt', width: 20 }
            ];
            
            newColaboradores.forEach(col => {
                const detail = col.ColaboradorDetail || {};
                const scheduleIndex = detail.selectedSchedule;
                let scheduleName = 'Sin horario';
                
                if (scheduleIndex >= 0 && corporationData?.schedules?.[scheduleIndex]) {
                    const sched = corporationData.schedules[scheduleIndex];
                    scheduleName = `${sched.name} (${formatTime12Hour(sched.entryTime)} - ${formatTime12Hour(sched.exitTime)})`;
                }
                
                worksheet.addRow({
                    name: col.name || '',
                    email: col.email || '',
                    phone: col.phoneNumber || '',
                    serviceAddress: detail.serviceAddress || '',
                    zoneOrSector: detail.zoneOrSector || '',
                    routeType: detail.routeType || '',
                    schedule: scheduleName,
                    status: Number(col.state) === 1 ? 'Activo' : 'Inactivo',
                    createdAt: col.createdAt ? moment(col.createdAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : ''
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
            
            // Añadir hoja 'Horarios' antes de generar el archivo
            addSchedulesSheet(workbook);

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Colaboradores_Nuevos_${currentCorporation?.name || 'Corporativo'}_${moment().format('YYYYMMDD')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            setSnackbar({
                open: true,
                message: 'Archivo descargado exitosamente',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error downloading new colaboradores:', err);
            setSnackbar({
                open: true,
                message: 'Error al descargar colaboradores',
                severity: 'error'
            });
        }
    };

    // Función para descargar TODOS los colaboradores
    const handleDownloadAllColaboradores = async () => {
        try {
            const resp = await api.get(`/corporations/${corporationId}/colaboradores/download`, { params: { mode: 'all' } });
            const allCols = resp.data.colaboradores || [];
            if (allCols.length === 0) {
                setSnackbar({ open: true, message: 'No hay colaboradores para descargar', severity: 'warning' });
                return;
            }
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Todos los Colaboradores');
            
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
            
            allCols.forEach(col => {
                const detail = col.ColaboradorDetail || {};
                const scheduleIndex = detail.selectedSchedule;
                let scheduleName = 'Sin horario';
                
                if (scheduleIndex >= 0 && corporationData?.schedules?.[scheduleIndex]) {
                    const sched = corporationData.schedules[scheduleIndex];
                    scheduleName = `${sched.name} (${formatTime12Hour(sched.entryTime)} - ${formatTime12Hour(sched.exitTime)})`;
                }
                
                worksheet.addRow({
                    name: col.name || '',
                    email: col.email || '',
                    phone: col.phoneNumber || '',
                    serviceAddress: detail.serviceAddress || '',
                    zoneOrSector: detail.zoneOrSector || '',
                    routeType: detail.routeType || '',
                    emergencyContact: detail.emergencyContact || '',
                    emergencyRelationship: detail.emergencyRelationship || '',
                    emergencyPhone: detail.emergencyPhone || '',
                    schedule: scheduleName,
                    stops: col.ScheduleSlots?.length || 0,
                    status: col.status || 'Activo',
                    createdAt: col.createdAt ? moment(col.createdAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : '',
                    updatedAt: col.updatedAt ? moment(col.updatedAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : ''
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
            a.download = `Colaboradores_Todos_${currentCorporation?.name || 'Corporativo'}_${moment().format('YYYYMMDD')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            setSnackbar({
                open: true,
                message: 'Archivo descargado exitosamente',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error downloading all colaboradores:', err);
            setSnackbar({
                open: true,
                message: 'Error al descargar colaboradores',
                severity: 'error'
            });
        }
    };

    // Descargar colaboradores activos
    const handleDownloadActiveColaboradores = async () => {
        try {
            const resp = await api.get(`/corporations/${corporationId}/colaboradores/download`, { params: { mode: 'active' } });
            const activeList = resp.data.colaboradores || [];
            if (activeList.length === 0) {
                setSnackbar({ open: true, message: 'No hay colaboradores activos para descargar', severity: 'info' });
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Colaboradores Activos');
            worksheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Teléfono', key: 'phone', width: 15 },
                { header: 'Dirección Servicio', key: 'serviceAddress', width: 40 },
                { header: 'Zona/Sector', key: 'zoneOrSector', width: 20 },
                { header: 'Tipo Ruta', key: 'routeType', width: 15 },
                { header: 'Horario', key: 'schedule', width: 30 },
                { header: 'Estado', key: 'status', width: 15 },
                { header: 'Fecha Creación', key: 'createdAt', width: 20 }
            ];

            activeList.forEach(col => {
                const detail = col.ColaboradorDetail || {};
                const scheduleIndex = detail.selectedSchedule;
                let scheduleName = 'Sin horario';
                if (scheduleIndex >= 0 && corporationData?.schedules?.[scheduleIndex]) {
                    const sched = corporationData.schedules[scheduleIndex];
                    scheduleName = `${sched.name} (${formatTime12Hour(sched.entryTime)} - ${formatTime12Hour(sched.exitTime)})`;
                }
                worksheet.addRow({
                    name: col.name || '',
                    email: col.email || '',
                    phone: col.phoneNumber || '',
                    serviceAddress: detail.serviceAddress || '',
                    zoneOrSector: detail.zoneOrSector || '',
                    routeType: detail.routeType || '',
                    schedule: scheduleName,
                    status: col.status || 'Activo',
                    createdAt: col.createdAt ? moment(col.createdAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : ''
                });
            });

            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            addSchedulesSheet(workbook);

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Colaboradores_Activos_${currentCorporation?.name || 'Corporativo'}_${moment().format('YYYYMMDD')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);

            setSnackbar({ open: true, message: 'Archivo descargado exitosamente', severity: 'success' });
        } catch (err) {
            console.error('Error downloading active colaboradores:', err);
            setSnackbar({ open: true, message: 'Error al descargar colaboradores activos', severity: 'error' });
        }
    };

    // Descargar colaboradores inactivos
    const handleDownloadInactiveColaboradores = async () => {
        try {
            const resp = await api.get(`/corporations/${corporationId}/colaboradores/download`, { params: { mode: 'inactive' } });
            const inactiveList = resp.data.colaboradores || [];
            if (inactiveList.length === 0) {
                setSnackbar({ open: true, message: 'No hay colaboradores inactivos para descargar', severity: 'info' });
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Colaboradores Inactivos');
            worksheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Teléfono', key: 'phone', width: 15 },
                { header: 'Dirección Servicio', key: 'serviceAddress', width: 40 },
                { header: 'Zona/Sector', key: 'zoneOrSector', width: 20 },
                { header: 'Tipo Ruta', key: 'routeType', width: 15 },
                { header: 'Horario', key: 'schedule', width: 30 },
                { header: 'Estado', key: 'status', width: 15 },
                { header: 'Fecha Creación', key: 'createdAt', width: 20 }
            ];

            inactiveList.forEach(col => {
                const detail = col.ColaboradorDetail || {};
                const scheduleIndex = detail.selectedSchedule;
                let scheduleName = 'Sin horario';
                if (scheduleIndex >= 0 && corporationData?.schedules?.[scheduleIndex]) {
                    const sched = corporationData.schedules[scheduleIndex];
                    scheduleName = `${sched.name} (${formatTime12Hour(sched.entryTime)} - ${formatTime12Hour(sched.exitTime)})`;
                }
                worksheet.addRow({
                    name: col.name || '',
                    email: col.email || '',
                    phone: col.phoneNumber || '',
                    serviceAddress: detail.serviceAddress || '',
                    zoneOrSector: detail.zoneOrSector || '',
                    routeType: detail.routeType || '',
                    schedule: scheduleName,
                    status: col.status || 'Inactivo',
                    createdAt: col.createdAt ? moment(col.createdAt).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : ''
                });
            });

            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            addSchedulesSheet(workbook);

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Colaboradores_Inactivos_${currentCorporation?.name || 'Corporativo'}_${moment().format('YYYYMMDD')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);

            setSnackbar({ open: true, message: 'Archivo descargado exitosamente', severity: 'success' });
        } catch (err) {
            console.error('Error downloading inactive colaboradores:', err);
            setSnackbar({ open: true, message: 'Error al descargar colaboradores inactivos', severity: 'error' });
        }
    };

    // Función para descargar plantilla de carga masiva (incluye campos extra de la corporación)
    const handleDownloadTemplate = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Plantilla Colaboradores');

            const standardColumns = [
                { header: 'Nombres', key: 'firstName', width: 25 },
                { header: 'Apellidos', key: 'lastName', width: 25 },
                { header: 'Nombre de Usuario', key: 'username', width: 25 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Contraseña', key: 'password', width: 20 },
                { header: 'Teléfono', key: 'phoneNumber', width: 15 },
                { header: 'Número Empleado', key: 'employeeNumber', width: 20 },
                { header: 'Horario (nombre)', key: 'selectedSchedule', width: 17 },
                { header: 'Dirección Servicio', key: 'serviceAddress', width: 40 },
                { header: 'Zona/Sector', key: 'zoneOrSector', width: 20 },
                { header: 'Tipo Ruta', key: 'routeType', width: 15 },
                { header: 'Contacto Emergencia', key: 'emergencyContact', width: 25 },
                { header: 'Parentesco Emergencia', key: 'emergencyRelationship', width: 30 },
                { header: 'Teléfono Emergencia', key: 'emergencyPhone', width: 20 }
            ];

            const extraFields = Array.isArray(currentCorporation?.extraEnrollmentFields) ? currentCorporation.extraEnrollmentFields : [];
            const extraColumns = extraFields.map((f, idx) => {
                const fieldName = f.fieldName || f.label || f.name || f.key || `extra_${idx}`;
                return { header: fieldName, key: fieldName, width: 25 };
            });

            worksheet.columns = [...standardColumns, ...extraColumns];

            // Fila de ejemplo (mapear a los campos del formulario)
            const example = {};
            worksheet.columns.forEach(col => {
                switch (col.key) {
                    case 'firstName': example[col.key] = 'Juan'; break;
                    case 'lastName': example[col.key] = 'Pérez'; break;
                    case 'username': example[col.key] = 'juan.perez'; break;
                    case 'email': example[col.key] = 'colaboradorprueba@ejemplo.com'; break;
                    case 'password': example[col.key] = 'Password123'; break;
                    case 'phoneNumber': example[col.key] = '50241234567'; break;
                    case 'employeeNumber': example[col.key] = 'EMP001'; break;
                    case 'serviceAddress': example[col.key] = 'Calle Falsa 123, Zona 1'; break;
                    case 'zoneOrSector': example[col.key] = 'Zona 1'; break;
                    case 'routeType': example[col.key] = 'Completa'; break;
                    case 'selectedSchedule': example[col.key] = ''; break;
                    case 'emergencyContact': example[col.key] = 'María López'; break;
                    case 'emergencyRelationship': example[col.key] = 'Madre'; break;
                    case 'emergencyPhone': example[col.key] = '50241239876'; break;
                    default: example[col.key] = '';
                }
            });
            // Añadir valores de ejemplo para campos extras si existen
            extraFields.forEach((f, idx) => {
                const fname = f.fieldName || f.label || f.name || f.key || `extra_${idx}`;
                example[fname] = f.default !== undefined ? f.default : '';
            });
            worksheet.addRow(example);

            // Estilos header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

            // Añadir hoja 'Horarios' con schedules de la corporación
            addSchedulesSheet(workbook);

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const corpName = currentCorporation?.name || 'Corporativo';
            a.download = `Plantilla_Colaboradores_${corpName}_${moment().format('YYYYMMDD')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);

            setSnackbar({ open: true, message: 'Plantilla descargada', severity: 'success' });
        } catch (err) {
            console.error('Error descargando plantilla:', err);
            setSnackbar({ open: true, message: 'Error al descargar plantilla', severity: 'error' });
        }
    };

    // Agregar hoja con lista de horarios de la corporación
    // (se coloca después para que siempre exista incluso si no hay horarios)
    const addSchedulesSheet = (workbook) => {
        const schedules = Array.isArray(currentCorporation?.schedules) ? currentCorporation.schedules : [];
        const sheet = workbook.addWorksheet('Horarios');
        sheet.columns = [
            { header: 'Nombre', key: 'name', width: 30 },
            { header: 'Hora Entrada', key: 'entryTime', width: 15 },
            { header: 'Hora Salida', key: 'exitTime', width: 15 }
        ];

        if (schedules.length === 0) {
            sheet.addRow({ name: 'No hay horarios definidos', entryTime: '', exitTime: '' });
        } else {
            schedules.forEach((s) => {
                const entryRaw = s.entryTime || s.entry || s.startTime || s.entry_time || '';
                const exitRaw = s.exitTime || s.exit || s.endTime || s.exit_time || '';
                const entryFmt = entryRaw ? formatTime12Hour(entryRaw) : '';
                const exitFmt = exitRaw ? formatTime12Hour(exitRaw) : '';
                sheet.addRow({
                    name: s.name || '',
                    entryTime: entryFmt,
                    exitTime: exitFmt
                });
            });
        }
        sheet.getRow(1).font = { bold: true };
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
            
            await api.post(`/corporations/${corporationId}/colaboradores/bulk`, formData, {
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
            fetchColaboradores();
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
            await api.post(`/mail/circular/colaboradores/${corporationId}`, {
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

    // Función para descargar reporte de paradas de colaboradores
    const handleDownloadRouteReport = async () => {
        if (!corporationId) {
            setSnackbar({ open: true, message: 'No hay corporación seleccionada.', severity: 'warning' });
            return;
        }

        setStopReportLoading(true);
        try {
            // Usar endpoint del backend que filtra por activos
            const resp = await api.get(`/corporations/${corporationId}/colaboradores/download`, { params: { mode: 'active' } });
            const activeColaboradores = resp.data.colaboradores || [];

            // Filtrar colaboradores activos que tienen ScheduleSlots asignados
            const colaboradoresWithRoutes = activeColaboradores.filter(col => 
                Array.isArray(col.ScheduleSlots) && col.ScheduleSlots.length > 0
            );

            if (colaboradoresWithRoutes.length === 0) {
                setSnackbar({ open: true, message: 'No hay colaboradores con paradas asignadas para generar el reporte.', severity: 'warning' });
                setStopReportLoading(false);
                return;
            }

            const workbook = new ExcelJS.Workbook();
            
            const weekdaysMap = [
                { key: 'monday', label: 'Lunes' },
                { key: 'tuesday', label: 'Martes' },
                { key: 'wednesday', label: 'Miércoles' },
                { key: 'thursday', label: 'Jueves' },
                { key: 'friday', label: 'Viernes' },
                { key: 'saturday', label: 'Sábado' },
                { key: 'sunday', label: 'Domingo' }
            ];

            // Headers simples: datos básicos + estado + entrada/salida + contacto
            const headers = [
                'Nombre',
                'Estado',
                'Email',
                'Teléfono',
                'Tipo Ruta',
                'Dirección Servicio',
                'Zona/Sector',
                'Horario Corporativo',
                'Entrada Hora',
                'Entrada Ruta',
                'Entrada Parada',
                'Salida Hora',
                'Salida Ruta',
                'Salida Parada',
                'Contacto Emergencia',
                'Teléfono Emergencia',
                'Parentesco Emergencia'
            ];

            const parseRouteNumber = (r) => {
                if (r == null) return null;
                const s = String(r).trim();
                if (s === '') return null;
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
            };

            // Crear una hoja por cada día de la semana
            weekdaysMap.forEach((day) => {
                const sheet = workbook.addWorksheet(day.label);

                const headerRow = sheet.addRow(headers);
                headerRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });

                // Filtrar colaboradores que tienen slots para este día específico
                const colaboradoresForDay = colaboradoresWithRoutes.filter(col => {
                    const slots = Array.isArray(col.ScheduleSlots) ? col.ScheduleSlots : [];
                    return slots.some(slot => {
                        let slotDays = [];
                        if (Array.isArray(slot.days)) slotDays = slot.days;
                        else if (typeof slot.days === 'string') {
                            try {
                                const parsed = JSON.parse(slot.days);
                                if (Array.isArray(parsed)) slotDays = parsed;
                                else slotDays = [slot.days];
                            } catch (e) {
                                slotDays = slot.days.split ? slot.days.split(',').map(x => x.trim()) : [slot.days];
                            }
                        } else if (slot.days) slotDays = [slot.days];

                        const normalizedDays = slotDays.map(d => d ? d.toString().toLowerCase() : '').filter(Boolean);
                        return normalizedDays.includes(day.key);
                    });
                });

                colaboradoresForDay.forEach((col, colIndex) => {
                    const detail = col.ColaboradorDetail || {};
                    const slots = Array.isArray(col.ScheduleSlots) ? col.ScheduleSlots : [];
                    
                    // Get schedule name
                    const scheduleIndex = detail.selectedSchedule;
                    let scheduleName = 'Sin horario';
                    if (scheduleIndex >= 0 && corporationData?.schedules?.[scheduleIndex]) {
                        const sched = corporationData.schedules[scheduleIndex];
                        scheduleName = `${sched.name} (${formatTime12Hour(sched.entryTime)} - ${formatTime12Hour(sched.exitTime)})`;
                    }

                    // Filtrar slots por día
                    const daySlotsFiltered = slots.filter(slot => {
                        let slotDays = [];
                        if (Array.isArray(slot.days)) slotDays = slot.days;
                        else if (typeof slot.days === 'string') {
                            try {
                                const parsed = JSON.parse(slot.days);
                                if (Array.isArray(parsed)) slotDays = parsed;
                                else slotDays = [slot.days];
                            } catch (e) {
                                slotDays = slot.days.split ? slot.days.split(',').map(x => x.trim()) : [slot.days];
                            }
                        } else if (slot.days) slotDays = [slot.days];

                        const normalizedDays = slotDays.map(d => d ? d.toString().toLowerCase() : '').filter(Boolean);
                        return normalizedDays.includes(day.key);
                    });

                    // Separar por tipo: entrada y salida
                    const entradaSlot = daySlotsFiltered.find(s => s.stopType === 'entrada') || null;
                    const salidaSlot = daySlotsFiltered.find(s => s.stopType === 'salida') || null;

                    // Construir fila de datos
                    const statusCell = (typeof getColaboradorStatus === 'function')
                        ? (getColaboradorStatus(col) === 'Inactivo' ? 'Inactivo' : 'Activo')
                        : (col && (col.state === 0 || col.state === '0' || col.state === false) ? 'Inactivo' : 'Activo');
                    const row = [
                        col.name || '',
                        statusCell,
                        col.email || '',
                        col.phoneNumber || '',
                        detail.routeType || '',
                        detail.serviceAddress || '',
                        detail.zoneOrSector || '',
                        scheduleName,
                        entradaSlot ? formatTime12Hour(entradaSlot.time || '') : '',
                        entradaSlot ? parseRouteNumber(entradaSlot.routeNumber) : null,
                        entradaSlot ? (entradaSlot.note || '') : '',
                        salidaSlot ? formatTime12Hour(salidaSlot.time || '') : '',
                        salidaSlot ? parseRouteNumber(salidaSlot.routeNumber) : null,
                        salidaSlot ? (salidaSlot.note || '') : '',
                        detail.emergencyContact || '',
                        detail.emergencyPhone || '',
                        detail.emergencyRelationship || ''
                    ];

                    const rowObj = sheet.addRow(row);
                    const isEven = (colIndex + 1) % 2 === 0;
                    rowObj.eachCell((cell) => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.border = { top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } };
                    });
                });

                // Auto-size columns
                sheet.columns.forEach((column, index) => {
                    const header = headers[index];
                    let maxWidth = header ? header.length : 10;
                    sheet.eachRow((row, rowNumber) => {
                        if (rowNumber > 1) {
                            const cell = row.getCell(index + 1);
                            const cellLength = String(cell.value || '').length;
                            if (cellLength > maxWidth) maxWidth = cellLength;
                        }
                    });
                    column.width = Math.min(Math.max(maxWidth, 10), 50);
                });

                // Add auto filter
                if (sheet.rowCount > 1 && headers.length > 0) {
                    const getColumnLetter = (columnNumber) => {
                        let letter = '';
                        while (columnNumber > 0) {
                            const remainder = (columnNumber - 1) % 26;
                            letter = String.fromCharCode(65 + remainder) + letter;
                            columnNumber = Math.floor((columnNumber - 1) / 26);
                        }
                        return letter;
                    };
                    const maxColumns = Math.min(headers.length, 1024);
                    const lastColumnLetter = getColumnLetter(maxColumns);
                    const filterRange = `A1:${lastColumnLetter}${sheet.rowCount}`;
                    sheet.autoFilter = filterRange;
                }

                sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
            });

            const corpName = currentCorporation?.name || 'Corporativo';
            const fileName = `reporte_paradas_${corpName.replace(/[^a-zA-Z0-9]/g, '_')}_${getFormattedDateTime()}.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSnackbar({ open: true, message: `Reporte de paradas para ${corpName} descargado exitosamente`, severity: 'success' });
        } catch (error) {
            console.error('[handleDownloadRouteReport] Error:', error);
            setSnackbar({ open: true, message: 'Error al descargar el reporte de paradas', severity: 'error' });
        } finally {
            setStopReportLoading(false);
        }
    };

    const currentCorporation = corporationData || location.state?.corporation;

    // Aplicar ordenamiento a los colaboradores filtrados antes de paginar
    const sortedColaboradores = (() => {
        if (!sortBy) return filteredColaboradores;
        const copy = filteredColaboradores.slice();
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
                    va = getColaboradorStatus(a);
                    vb = getColaboradorStatus(b);
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

    const paginatedColaboradores = sortedColaboradores.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderColaboradorDialog = (isEdit = false) => (
        <Dialog 
            open={isEdit ? openEditDialog : openCreateDialog} 
            onClose={handleCloseDialogs}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                {isEdit ? 'Editar Colaborador' : 'Crear Nuevo Colaborador'}
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
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Nombres"
                                        value={colaboradorForm.firstName}
                                        onChange={(e) => handleFormChange('firstName', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Apellidos"
                                        value={colaboradorForm.lastName}
                                        onChange={(e) => handleFormChange('lastName', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Nombre Usuario"
                                        value={colaboradorForm.username}
                                        onChange={(e) => handleFormChange('username', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        type="email"
                                        value={colaboradorForm.email}
                                        onChange={(e) => handleFormChange('email', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label={isEdit ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                                        type="password"
                                        value={colaboradorForm.password}
                                        onChange={(e) => handleFormChange('password', e.target.value)}
                                        required={!isEdit}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teléfono"
                                        value={colaboradorForm.phoneNumber}
                                        onChange={(e) => handleFormChange('phoneNumber', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Número de empleado"
                                        value={colaboradorForm.employeeNumber}
                                        onChange={(e) => handleFormChange('employeeNumber', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Horario</InputLabel>
                                        <Select
                                            value={colaboradorForm.selectedSchedule}
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

                    {/* Campos adicionales (dinámicos definidos por la corporación) */}
                    {Array.isArray(corporationData?.extraEnrollmentFields) && corporationData.extraEnrollmentFields.length > 0 && (
                        <StyledAccordion 
                            expanded={expandedPanels.extraFields}
                            onChange={handleAccordionChange('extraFields')}
                        >
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="subtitle1" fontWeight="bold">Campos Adicionales</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    {corporationData.extraEnrollmentFields.map((field, idx) => {
                                        const fieldName = field.fieldName || field.label || field.name || field.key || `extra_${idx}`;
                                        const label = fieldName;
                                        const type = (field.type || 'text').toLowerCase();

                                        const handleChangeExtra = (value) => {
                                            setExtraFieldsValues(prev => ({ ...prev, [fieldName]: value }));
                                        };

                                        return (
                                            <Grid item xs={12} sm={6} key={fieldName}>
                                                {type === 'select' ? (
                                                    <FormControl fullWidth>
                                                        <InputLabel>{label}</InputLabel>
                                                        <Select
                                                            value={extraFieldsValues[fieldName] ?? ''}
                                                            label={label}
                                                            onChange={(e) => handleChangeExtra(e.target.value)}
                                                        >
                                                            {(Array.isArray(field.options) ? field.options : []).map((opt, i) => (
                                                                <MenuItem key={i} value={opt.value ?? opt}>{opt.label ?? opt}</MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : type === 'textarea' ? (
                                                    <TextField
                                                        fullWidth
                                                        label={label}
                                                        multiline
                                                        rows={4}
                                                        value={extraFieldsValues[fieldName] ?? ''}
                                                        onChange={(e) => handleChangeExtra(e.target.value)}
                                                    />
                                                ) : type === 'checkbox' ? (
                                                    <FormControl fullWidth>
                                                        <InputLabel shrink>{label}</InputLabel>
                                                        <Select
                                                            value={extraFieldsValues[fieldName] ? 'true' : 'false'}
                                                            onChange={(e) => handleChangeExtra(e.target.value === 'true')}
                                                        >
                                                            <MenuItem value={'true'}>Sí</MenuItem>
                                                            <MenuItem value={'false'}>No</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                ) : (
                                                    <TextField
                                                        fullWidth
                                                        label={label}
                                                        value={extraFieldsValues[fieldName] ?? ''}
                                                        onChange={(e) => handleChangeExtra(e.target.value)}
                                                    />
                                                )}
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </AccordionDetails>
                        </StyledAccordion>
                    )}

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
                                        value={colaboradorForm.serviceAddress}
                                        onChange={(e) => handleFormChange('serviceAddress', e.target.value)}
                                        multiline
                                        rows={2}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Zona o Sector"
                                        value={colaboradorForm.zoneOrSector}
                                        onChange={(e) => handleFormChange('zoneOrSector', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Tipo de Ruta</InputLabel>
                                        <Select
                                            value={colaboradorForm.routeType}
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
                                        value={colaboradorForm.emergencyContact}
                                        onChange={(e) => handleFormChange('emergencyContact', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Relación (Emergencia)"
                                        value={colaboradorForm.emergencyRelationship}
                                        onChange={(e) => handleFormChange('emergencyRelationship', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teléfono de Emergencia"
                                        value={colaboradorForm.emergencyPhone}
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
                    onClick={isEdit ? handleUpdateColaborador : handleCreateColaborador}
                    variant="contained"
                    disabled={!colaboradorForm.username || !colaboradorForm.email || (!isEdit && !colaboradorForm.password)}
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
                                Colaboradores - {corporationData?.name || 'Corporación'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Año Fiscal ${fiscalYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                    {filteredColaboradores.length} colaboradores
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
                                    <MenuItem value="Sin asignaciones">Sin asignaciones</MenuItem>
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
                                startIcon={<FileUpload />}
                                fullWidth
                                onClick={() => setOpenBulkScheduleDialog(true)}
                            >
                                Cargar Horarios
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<Add />}
                                fullWidth
                                onClick={handleOpenCreateDialog}
                                sx={{ fontSize: '0.811rem' }}
                            >
                                Añadir Colaborador
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2}>
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
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<GetApp />}
                                fullWidth
                                onClick={() => setOpenDownloadDialog(true)}
                            >
                                Descargar
                            </Button>
                        </Grid>

                        <Dialog open={openDownloadDialog} onClose={() => setOpenDownloadDialog(false)}>
                            <DialogTitle>Descargar Colaboradores</DialogTitle>
                            <DialogContent>
                                <DialogContentText>Selecciona qué deseas descargar:</DialogContentText>
                                <FormControl fullWidth sx={{ mt: 2 }}>
                                    <InputLabel id="colab-download-select-label">Opción</InputLabel>
                                    <Select
                                        labelId="colab-download-select-label"
                                        value={downloadChoice}
                                        label="Opción"
                                        onChange={(e) => setDownloadChoice(e.target.value)}
                                    >
                                        <MenuItem value="all">Todos</MenuItem>
                                        <MenuItem value="new">Nuevos</MenuItem>
                                        <MenuItem value="active">Activos</MenuItem>
                                        <MenuItem value="inactive">Inactivos</MenuItem>
                                        <MenuItem value="report">Reporte de Paradas</MenuItem>
                                    </Select>
                                </FormControl>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setOpenDownloadDialog(false)}>Cancelar</Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<GetApp />}
                                    onClick={() => {
                                        if (downloadChoice === 'new') handleDownloadNewColaboradores();
                                        else if (downloadChoice === 'all') handleDownloadAllColaboradores();
                                        else if (downloadChoice === 'active') handleDownloadActiveColaboradores();
                                        else if (downloadChoice === 'inactive') handleDownloadInactiveColaboradores();
                                        else if (downloadChoice === 'report') handleDownloadRouteReport();
                                        setOpenDownloadDialog(false);
                                    }}
                                >
                                    Descargar
                                </Button>
                            </DialogActions>
                        </Dialog>
                        
                    </Grid>
                </CardContent>
            </Card>

            {/* Tabla de colaboradores */}
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
                                        {paginatedColaboradores.map((colaborador) => (
                                            <TableRow key={colaborador.id} hover>
                                                <TableCell>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        {colaborador.name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Mail fontSize="small" color="action" />
                                                        {colaborador.email}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const scheduleIndex = Number(colaborador.ColaboradorDetail?.selectedSchedule);
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
                                                            const d = new Date(colaborador.updatedAt || colaborador.createdAt);
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
                                                    {getColaboradorStatus(colaborador) === 'Activo' ? (
                                                        <Chip
                                                            label="Activo"
                                                            color="success"
                                                            size="small"
                                                            clickable
                                                            onClick={() => handleOpenToggleStateDialog(colaborador)}
                                                        />
                                                    ) : getColaboradorStatus(colaborador) === 'Inactivo' ? (
                                                        <Chip
                                                            label={getColaboradorStatus(colaborador)}
                                                            color={getStatusColor(getColaboradorStatus(colaborador))}
                                                            size="small"
                                                            clickable
                                                            onClick={() => handleOpenToggleStateDialog(colaborador)}
                                                        />
                                                    ) : (
                                                        <Chip
                                                            label={getColaboradorStatus(colaborador)}
                                                            color={getStatusColor(getColaboradorStatus(colaborador))}
                                                            size="small"
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                        <IconButton size="small" onClick={() => handleOpenEditDialog(colaborador)} title="Editar">
                                                            <Edit fontSize="small" />
                                                        </IconButton>
                                                        {(() => {
                                                            const s = getCollaboratorAssignStatus(colaborador);
                                                            const title = s === 'all' ? 'Tiene asignaciones' : 'Sin asignaciones';
                                                            if (s === 'none') {
                                                                return (
                                                                    <IconButton size="small" onClick={() => handleOpenScheduleDialog(colaborador)} title={title}>
                                                                        <DirectionsBus fontSize="small" />
                                                                    </IconButton>
                                                                );
                                                            }
                                                            return (
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleOpenScheduleDialog(colaborador)}
                                                                    title={title}
                                                                    sx={(theme) => ({
                                                                        bgcolor: theme.palette.success.main,
                                                                        color: theme.palette.common.white,
                                                                        borderRadius: 1,
                                                                        '&:hover': { bgcolor: theme.palette.success.dark }
                                                                    })}
                                                                >
                                                                    <DirectionsBus fontSize="small" />
                                                                </IconButton>
                                                            );
                                                        })()}
                                                        
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => handleOpenToggleStateDialog(colaborador)}
                                                            title={Number(colaborador.state) === 1 ? 'Desactivar' : 'Activar'}
                                                            color={Number(colaborador.state) === 1 ? 'warning' : 'success'}
                                                        >
                                                            {Number(colaborador.state) === 1 ? <ToggleOn fontSize="small" /> : <ToggleOff fontSize="small" />}
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => handleOpenDeleteDialog(colaborador)} title="Eliminar" color="error">
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                        {paginatedColaboradores.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                                    <Typography variant="body1" color="textSecondary">
                                                        No se encontraron colaboradores con los filtros aplicados
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                component="div"
                                count={sortedColaboradores.length}
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
            {renderColaboradorDialog(false)}
            {renderColaboradorDialog(true)}

            {/* Diálogo de eliminar */}
            <Dialog open={openDeleteDialog} onClose={handleCloseDialogs}>
                <DialogTitle>Confirmar Eliminación</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Está seguro que desea eliminar al colaborador "{selectedColaborador?.name}"?
                        Esta acción no es reversible..
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialogs}>Cancelar</Button>
                    <Button onClick={handleDeleteColaborador} color="error" variant="contained">
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de toggle state (activar/desactivar) */}
            <Dialog open={openToggleStateDialog} onClose={handleCloseDialogs}>
                <DialogTitle>
                    {selectedColaborador && Number(selectedColaborador.state) === 1 ? 'Desactivar' : 'Activar'} Colaborador
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Está seguro que desea {selectedColaborador && Number(selectedColaborador.state) === 1 ? 'desactivar' : 'activar'} al colaborador "{selectedColaborador?.name}"?
                        {selectedColaborador && Number(selectedColaborador.state) === 1 
                            ? ' El colaborador no podrá acceder al sistema mientras esté desactivado.' 
                            : ' El colaborador podrá acceder al sistema nuevamente.'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialogs}>Cancelar</Button>
                    <Button 
                        onClick={handleToggleState} 
                        color={selectedColaborador && Number(selectedColaborador.state) === 1 ? 'warning' : 'success'}
                        variant="contained"
                    >
                        {selectedColaborador && Number(selectedColaborador.state) === 1 ? 'Desactivar' : 'Activar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de horario completo igual al de estudiantes */}
            <ColaboradorScheduleModal 
                colaborador={selectedColaborador}
                corporation={corporationData}
                open={openScheduleDialog}
                onClose={handleCloseDialogs}
                onScheduleUpdated={async () => {
                    await fetchColaboradores();
                    setSnackbar({
                        open: true,
                        message: 'Horario actualizado correctamente',
                        severity: 'success'
                    });
                }}
            />

            {/* Diálogo de Carga Masiva */}
            <Dialog open={openBulkDialog} onClose={() => setOpenBulkDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Colaboradores</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Sube un archivo Excel con las columnas necesarias. Usa la plantilla oficial.<br/>
                            <br/>
                            La lista de Horarios se encuentra en la hoja "Horarios" de la plantilla.<br/>
                            <br/>
                            El límite de archivo es 5 MB.
                        </Typography>

                        <Button
                            variant="outlined"
                            sx={{ mr: 2 }}
                            color="success"
                            onClick={handleDownloadTemplate}
                        >
                            Descargar Plantilla
                        </Button>
                        <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                            Seleccionar Archivo
                            <input
                                type="file"
                                hidden
                                onChange={(e) => setBulkFile(e.target.files[0])}
                                accept=".xlsx,.xls"
                            />
                        </Button>

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

            <BulkScheduleColaboradoresModal
                open={openBulkScheduleDialog}
                onClose={() => setOpenBulkScheduleDialog(false)}
                corporationId={corporationId}
            />

            {/* Diálogo de Enviar Circular */}
            <Dialog open={openCircularDialog} onClose={() => setOpenCircularDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Enviar Circular a Colaboradores</DialogTitle>
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
                            placeholder="Escriba el mensaje que desea enviar a todos los colaboradores del corporativo..."
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Esta circular se enviará a todos los colaboradores activos del corporativo: {currentCorporation?.name}
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
        </PageContainer>
    );
};

export default ColaboradoresPage;
