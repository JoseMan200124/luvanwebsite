// src/pages/CicloEscolarSelectionPage.jsx

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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TextField,
    Paper,
    Checkbox,
    FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Popover
} from '@mui/material';
import { 
    School as SchoolIcon, 
    CalendarToday, 
    ContentCopy, 
    Edit, 
    Delete, 
    Visibility,
    Add,
    ExpandMore,
    DeleteSweep as DeleteSweepIcon,
    NotificationsActive as NotificationsActiveIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import SubmissionPreview from './SubmissionPreview';
import ExcelJS from 'exceljs';
import moment from 'moment';
import PermissionGuard from '../components/PermissionGuard';
import { DEFAULT_SCHEDULE_CODES, ensureSchedules, getScheduleCodesFromSchool } from '../utils/scheduleConfig';
import EditSchedulesModal from '../components/modals/EditSchedulesModal';
import SendNotificationModal from '../components/SendNotificationModal';
import { getCicloEscolarOptionLabel, getCiclosEscolares } from '../services/cicloEscolarService';

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

const SchoolCard = styled(Card)`
    ${tw`cursor-pointer transition-all duration-300`}
    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }
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
        
        &.Mui-expanded {
            margin-bottom: 8px;
        }
    }
    
    & .MuiAccordionSummary-root {
        background-color: #f8f9fa;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        min-height: 56px;
        transition: background-color 0.3s ease;
        
        &:hover {
            background-color: #e9ecef;
        }
        
        &.Mui-expanded {
            min-height: 56px;
            background-color: #e3f2fd;
        }
    }
    
    & .MuiAccordionDetails-root {
        padding: 24px;
        background-color: #ffffff;
    }
    
    & .MuiAccordionSummary-expandIconWrapper {
        transition: transform 0.3s ease;
        
        &.Mui-expanded {
            transform: rotate(180deg);
        }
    }
`;

const StyledAccordionSummary = styled(AccordionSummary)`
    & .MuiAccordionSummary-content {
        margin: 12px 0;
        
        &.Mui-expanded {
            margin: 12px 0;
        }
    }
`;

const CicloEscolarSelectionPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();

    const [schools, setSchools] = useState([]);
    const [ciclosEscolares, setCiclosEscolares] = useState([]);
    const [selectedCicloEscolarId, setSelectedCicloEscolarId] = useState(() => localStorage.getItem('selectedCicloEscolarId') || '');
    const [cyclesLoading, setCyclesLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Estados para diálogos y acciones
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [savingSchool, setSavingSchool] = useState(false);
    const [prefillSchools, setPrefillSchools] = useState([]);
    const [prefillSchoolsLoading, setPrefillSchoolsLoading] = useState(false);
    const [selectedPrefillSchoolId, setSelectedPrefillSchoolId] = useState('');
    const [cycleMigrationConfirmation, setCycleMigrationConfirmation] = useState(null);
    const [openEditSchedulesModal, setOpenEditSchedulesModal] = useState(false);
    const [openSubmissionDialog, setOpenSubmissionDialog] = useState(false);
    const [submissions, setSubmissions] = useState([]);
    const [submissionDetail, setSubmissionDetail] = useState(null);
    // Bulk upload states
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkMigrationConfirmation, setBulkMigrationConfirmation] = useState(null);
    const [bulkSelectedRows, setBulkSelectedRows] = useState(new Set());
    
    // Estados para edición de colegio
    const [schoolSchedules, setSchoolSchedules] = useState([]);
    const [schoolGrades, setSchoolGrades] = useState([]);
    const [newGradeName, setNewGradeName] = useState('');
    const [schoolRouteNumbers, setSchoolRouteNumbers] = useState([]);
    const [schoolRouteSchedules, setSchoolRouteSchedules] = useState([]);
    const [schoolExtraFields, setSchoolExtraFields] = useState([]);
    // School year bounds for the UI edit dialog
    const [schoolYearStart, setSchoolYearStart] = useState('');
    const [schoolYearEnd, setSchoolYearEnd] = useState('');
    
    // Estados para limpieza de mora
    const [clearPeriod, setClearPeriod] = useState('CURRENT');
    const [customClearPeriod, setCustomClearPeriod] = useState('');
    const [clearReason, setClearReason] = useState('');
    const [clearingPenalty, setClearingPenalty] = useState(false);
    // Quick modal para limpieza (período actual fijo)
    const [openQuickClear, setOpenQuickClear] = useState(false);
    const [quickClearReason, setQuickClearReason] = useState('');
    const [quickClearing, setQuickClearing] = useState(false);
    const [openSendNotifModal, setOpenSendNotifModal] = useState(false);
    // Nombre legible del período actual (ej: Enero 2026)
    const monthNamesEs = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const currentMonthIndex = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentPeriodDisplay = `${monthNamesEs[currentMonthIndex]} ${currentYear}`;
    
    // Estado para controlar qué acordeones están expandidos
    const [expandedPanels, setExpandedPanels] = useState({
        basicInfo: true, // Información básica abierta por defecto
        financial: false,
        schedules: false,
        grades: false,
        routes: false,
        extraFields: false
    });

    // Estados para el popover de grados
    const [anchorEl, setAnchorEl] = useState(null);
    const [popoverGrades, setPopoverGrades] = useState([]);

    const selectedCicloEscolar = ciclosEscolares.find((cicloEscolar) => String(cicloEscolar.id) === String(selectedCicloEscolarId));
    const defaultCicloEscolar = ciclosEscolares.find((cicloEscolar) => cicloEscolar.predeterminado && cicloEscolar.activo) || ciclosEscolares.find((cicloEscolar) => cicloEscolar.predeterminado) || null;
    const selectedCycleYear = selectedCicloEscolar?.anio ? String(selectedCicloEscolar.anio) : '';
    const enabledCiclosEscolares = ciclosEscolares.filter((cicloEscolar) => cicloEscolar.activo);
    const selectableCiclosEscolares = enabledCiclosEscolares.length > 0 ? enabledCiclosEscolares : ciclosEscolares;
    const cycleOptions = selectableCiclosEscolares.map((cicloEscolar) => ({
        id: String(cicloEscolar.id),
        name: getCicloEscolarOptionLabel(cicloEscolar),
        anio: String(cicloEscolar.anio || ''),
        cicloEscolar
    }));

    // Helper para asegurar que los horarios tengan todos los slots configurados
    // For EXISTING schools: preserves whatever schedules they have as-is.
    // For NEW schools (empty schedules): seeds with the 4 default codes.
    const ensureFourSchedules = (schedules) => {
        const arr = Array.isArray(schedules) ? schedules : [];
        if (arr.length > 0) return [...arr]; // existing school — keep as-is
        return ensureSchedules([], DEFAULT_SCHEDULE_CODES); // new school — seed defaults
    };

    const parseArrayField = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    };

    const buildEmptySchoolDraft = () => ({
        id: null,
        name: '',
        address: '',
        city: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        whatsappLink: '',
        transportFeeComplete: '',
        transportFeeHalf: '',
        duePaymentDay: '',
        bankName: '',
        bankAccount: '',
        dailyPenalty: 0,
        penaltyPaused: false
    });

    const normalizeRouteSchedulesFromSchool = (school, routeNumbers) => {
        const sourceRouteSchedules = parseArrayField(school?.routeSchedules);
        const routeNumberSet = new Set((routeNumbers || []).map(String));

        const normalizeEntry = (entry) => {
            const schedules = parseArrayField(entry?.schedules)
                .map((schedule) => ({
                    code: schedule?.code ? String(schedule.code).toUpperCase() : null,
                    name: schedule?.name || (schedule?.code ? `HORARIO ${String(schedule.code).toUpperCase()}` : 'HORARIO'),
                    times: Array.isArray(schedule?.times) && schedule.times[0] ? [String(schedule.times[0])] : []
                }))
                .filter((schedule) => schedule.code);

            return {
                routeNumber: entry?.routeNumber == null ? '' : String(entry.routeNumber),
                schedules
            };
        };

        const existingByRouteNumber = new Map(sourceRouteSchedules.map((entry) => {
            const normalized = normalizeEntry(entry);
            return [String(normalized.routeNumber), normalized.schedules];
        }));

        const aligned = Array.from(routeNumberSet).map((routeNumber) => ({
            routeNumber,
            schedules: existingByRouteNumber.get(routeNumber) || []
        }));

        sourceRouteSchedules.forEach((entry) => {
            const normalized = normalizeEntry(entry);
            const key = String(normalized.routeNumber);
            if (key && !routeNumberSet.has(key)) aligned.push(normalized);
        });

        return aligned;
    };

    const resetCreateSchoolDraft = (sourceSchool = null) => {
        const source = sourceSchool || {};
        const routeNumbers = parseArrayField(source.routeNumbers).map(String);
        const schedules = sourceSchool
            ? ensureFourSchedules(parseArrayField(source.schedules)).map((schedule) => ({ ...schedule, _originalCode: null }))
            : ensureSchedules([], DEFAULT_SCHEDULE_CODES).map((schedule) => ({ ...schedule, _originalCode: null }));

        setSelectedSchool(sourceSchool ? {
            ...buildEmptySchoolDraft(),
            name: source.name || '',
            address: source.address || '',
            city: source.city || '',
            contactPerson: source.contactPerson || '',
            contactEmail: source.contactEmail || '',
            contactPhone: source.contactPhone || '',
            whatsappLink: source.whatsappLink || '',
            transportFeeComplete: source.transportFeeComplete ?? '',
            transportFeeHalf: source.transportFeeHalf ?? '',
            duePaymentDay: source.duePaymentDay ?? '',
            bankName: source.bankName || '',
            bankAccount: source.bankAccount || '',
            dailyPenalty: source.dailyPenalty ?? 0,
            penaltyPaused: !!source.penaltyPaused
        } : buildEmptySchoolDraft());
        setSchoolSchedules(schedules);
        setSchoolGrades(parseArrayField(source.grades));
        setSchoolExtraFields(parseArrayField(source.extraEnrollmentFields));
        setSchoolRouteNumbers(routeNumbers);
        setSchoolRouteSchedules(sourceSchool ? normalizeRouteSchedulesFromSchool(source, routeNumbers) : []);
        setSchoolYearStart(source.schoolYearStart || '');
        setSchoolYearEnd(source.schoolYearEnd || '');
        setNewGradeName('');
    };

    const isPreviousCycleSchool = (school) => {
        const cycleStatus = String(school?.cycleStatus || '').trim().toUpperCase();
        if (cycleStatus === 'ARCHIVED') return true;

        const selectedYear = Number(selectedCicloEscolar?.anio || selectedCycleYear || 0);
        const defaultYear = Number(defaultCicloEscolar?.anio || 0);
        return selectedYear > 0 && defaultYear > 0 && selectedYear < defaultYear;
    };

    const fetchCiclosEscolares = useCallback(async () => {
        setCyclesLoading(true);
        try {
            const data = await getCiclosEscolares();
            const ciclos = Array.isArray(data.ciclosEscolares) ? data.ciclosEscolares : [];
            setCiclosEscolares(ciclos);

            if (ciclos.length === 0) return;

            const storedId = localStorage.getItem('selectedCicloEscolarId');
            const selectableCycles = ciclos.filter((cicloEscolar) => cicloEscolar.activo);
            const cycleOptions = selectableCycles.length > 0 ? selectableCycles : ciclos;
            const storedCycle = storedId ? cycleOptions.find((cicloEscolar) => String(cicloEscolar.id) === String(storedId)) : null;
            const defaultCycle = data.default || data.active || ciclos.find((cicloEscolar) => cicloEscolar.predeterminado) || cycleOptions[0];
            const nextCycle = storedCycle || defaultCycle;

            if (nextCycle?.id) {
                setSelectedCicloEscolarId(String(nextCycle.id));
                localStorage.setItem('selectedCicloEscolarId', String(nextCycle.id));
            }
        } catch (error) {
            console.error('Error fetching ciclos escolares:', error);
            setSnackbar({ open: true, message: 'Error al obtener los ciclos escolares', severity: 'error' });
        } finally {
            setCyclesLoading(false);
        }
    }, []);

    const fetchSchoolsByYear = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                cicloEscolarId: selectedCicloEscolarId,
                includeArchived: true
            };
            // If the current user is not role 1 (Gestor) or 2 (Administrador),
            // request only assigned schools. Backend also enforces this rule,
            // but sending the hint keeps intent explicit.
            try {
                const roleId = Number(auth.user?.roleId || 0);
                if (roleId && ![1, 2].includes(roleId)) {
                    params.assignedOnly = true;
                }
            } catch (e) { /* ignore */ }

            const response = await api.get('/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params
            });
            // Procesar schools para asegurar que grades sea siempre un array
            const rawSchools = Array.isArray(response.data.schools) ? response.data.schools : [];
            const processedSchools = rawSchools.map((school) => {
                let parsedGrades = [];
                if (typeof school.grades === 'string' && school.grades.trim()) {
                    try {
                        parsedGrades = JSON.parse(school.grades);
                    } catch {
                        parsedGrades = [];
                    }
                } else if (Array.isArray(school.grades)) {
                    parsedGrades = school.grades;
                }
                
                return {
                    ...school,
                    grades: Array.isArray(parsedGrades) ? parsedGrades : [],
                    studentsCount: Number(school.studentsCount) || 0,
                    // Penalty fields defaults
                    dailyPenalty: Number(school.dailyPenalty) || 0,
                    penaltyPaused: !!school.penaltyPaused
                };
            });
            setSchools(processedSchools);
        } catch (err) {
            console.error('Error fetching schools:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener los colegios', 
                severity: 'error' 
            });
        } finally {
            setLoading(false);
        }
    }, [auth.token, selectedCicloEscolarId]);

    const fetchPrefillSchools = useCallback(async () => {
        if (!auth.token) return;

        setPrefillSchoolsLoading(true);
        try {
            const response = await api.get('/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    includeArchived: true,
                    includeAllCycles: true,
                    useHighestSchoolCycle: true
                }
            });

            const rawSchools = Array.isArray(response.data.schools) ? response.data.schools : [];
            setPrefillSchools(rawSchools.filter((school) => school?.id));
        } catch (err) {
            console.error('Error fetching prefill schools:', err);
            setSnackbar({
                open: true,
                message: 'Error al obtener colegios para prellenar',
                severity: 'error'
            });
        } finally {
            setPrefillSchoolsLoading(false);
        }
    }, [auth.token]);

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchSchoolsByYear();
    }, [fetchSchoolsByYear]);

    useEffect(() => {
        if (auth.token) {
            fetchCiclosEscolares();
        }
    }, [auth.token, fetchCiclosEscolares]);

    useEffect(() => {
        if (auth.token && selectedCicloEscolarId) {
            fetchSchoolsByYear();
        }
    }, [auth.token, selectedCicloEscolarId, fetchSchoolsByYear]);

    const handleCycleChange = (event) => {
        const nextCicloEscolarId = event.target.value;
        setSelectedCicloEscolarId(nextCicloEscolarId);
        localStorage.setItem('selectedCicloEscolarId', String(nextCicloEscolarId));
    };

    const handleSchoolSelect = (school) => {
        const cicloEscolarId = school.cicloEscolarId || selectedCicloEscolarId;
        const cicloEscolar = school.cicloEscolar || selectedCicloEscolar || ciclosEscolares.find((item) => String(item.id) === String(cicloEscolarId)) || null;
        const schoolWithCicloEscolar = {
            ...school,
            cicloEscolarId,
            ...(cicloEscolar ? { cicloEscolar } : {})
        };
        navigate(`/admin/escuelas/ciclo/${cicloEscolarId}/${school.id}`, {
            state: {
                cicloEscolarId,
                cicloEscolar,
                school: schoolWithCicloEscolar
            }
        });
    };

    // Funciones para los botones de acciones
    const handleCopyLink = (schoolId) => {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/schools/enroll/${schoolId}`;
        navigator.clipboard.writeText(link)
            .then(() => {
                setSnackbar({
                    open: true,
                    message: 'Enlace copiado al portapapeles',
                    severity: 'success',
                });
            })
            .catch((err) => {
                console.error('Error copiando enlace:', err);
                setSnackbar({
                    open: true,
                    message: 'No se pudo copiar el enlace',
                    severity: 'error'
                });
            });
    };

    const handleEditClick = async (school) => {
        const transportFeeCompleteValue = school.transportFeeComplete ?? '';
        const transportFeeHalfValue = school.transportFeeHalf ?? '';
        const duePaymentDayValue = school.duePaymentDay ?? '';
        const bankNameValue = school.bankName ?? '';
        const bankAccountValue = school.bankAccount ?? '';
        const dailyPenaltyValue = school.dailyPenalty ?? 0;
        const penaltyPausedValue = school.penaltyPaused ?? false;

        setSelectedSchool({
            ...school,
            whatsappLink: school.whatsappLink || '',
            transportFeeComplete: transportFeeCompleteValue,
            transportFeeHalf: transportFeeHalfValue,
            duePaymentDay: duePaymentDayValue,
            bankName: bankNameValue,
            bankAccount: bankAccountValue,
            dailyPenalty: dailyPenaltyValue,
            penaltyPaused: penaltyPausedValue
        });

        let parsedSchedules = [];
        if (Array.isArray(school.schedules)) {
            parsedSchedules = school.schedules;
        } else {
            try {
                parsedSchedules = JSON.parse(school.schedules) || [];
            } catch {
                parsedSchedules = [];
            }
        }
        // Normalize to 4 fixed schedules and tag each with _originalCode for change tracking
        const normalized = ensureFourSchedules(parsedSchedules).map(s => ({
            ...s,
            _originalCode: s.code || null   // track original code to detect renames on save
        }));
        setSchoolSchedules(normalized);

        let parsedGrades = [];
        if (Array.isArray(school.grades)) {
            parsedGrades = school.grades;
        } else {
            try {
                parsedGrades = JSON.parse(school.grades) || [];
            } catch {
                parsedGrades = [];
            }
        }
        setSchoolGrades(parsedGrades);

        let parsedRouteNumbers = [];
        if (Array.isArray(school.routeNumbers)) {
            parsedRouteNumbers = school.routeNumbers;
        } else {
            try {
                parsedRouteNumbers = JSON.parse(school.routeNumbers) || [];
            } catch {
                parsedRouteNumbers = [];
            }
        }
        setSchoolRouteNumbers(parsedRouteNumbers);

        // Load routeSchedules directly from the school object (already populated by formatSchoolResponse in the list API).
        {
            let rs = [];
            if (Array.isArray(school.routeSchedules)) {
                rs = school.routeSchedules;
            } else if (typeof school.routeSchedules === 'string' && school.routeSchedules.trim()) {
                try { rs = JSON.parse(school.routeSchedules); } catch { rs = []; }
            }
            if (!Array.isArray(rs)) rs = [];

            // All routeSchedules in DB use the canonical {schedules:[{code,name,times}]} format.
            const normalizeEntry = (x) => {
                if (!x) return { routeNumber: '', schedules: [] };
                const cleaned = (Array.isArray(x.schedules) ? x.schedules : []).map(s => ({
                    code: s?.code ? String(s.code).toUpperCase() : null,
                    name: s?.name ? s.name : (s?.code ? `HORARIO ${String(s.code).toUpperCase()}` : 'HORARIO'),
                    times: Array.isArray(s?.times) && s.times[0] ? [String(s.times[0])] : []
                })).filter(s => s.code);
                return { routeNumber: String(x.routeNumber), schedules: cleaned };
            };

            const rnSet = new Set((parsedRouteNumbers || []).map(r => String(r)));
            const existingMap = new Map((rs || []).map(x => [String(x.routeNumber), normalizeEntry(x).schedules]));
            const aligned = Array.from(rnSet).map(rn => ({ routeNumber: rn, schedules: existingMap.get(String(rn)) || [] }));
            // Also include any backend entries that aren't in routeNumbers (to not lose data)
            (rs || []).forEach(x => {
                const key = String(x.routeNumber);
                if (!rnSet.has(key)) aligned.push({ routeNumber: key, schedules: normalizeEntry(x).schedules });
            });
            setSchoolRouteSchedules(aligned);
        }

        let parsedExtraFields = [];
        if (Array.isArray(school.extraEnrollmentFields)) {
            parsedExtraFields = school.extraEnrollmentFields;
        } else {
            try {
                parsedExtraFields = JSON.parse(school.extraEnrollmentFields) || [];
            } catch {
                parsedExtraFields = [];
            }
        }
        setSchoolExtraFields(parsedExtraFields);
        // Initialize school year bounds in dialog state (if present)
        setSchoolYearStart(school.schoolYearStart || '');
        setSchoolYearEnd(school.schoolYearEnd || '');
        setOpenEditDialog(true);
    };

    const handleDeleteClick = async (schoolId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este colegio?')) {
            try {
                await api.delete(`/schools/${schoolId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({
                    open: true,
                    message: 'Colegio eliminado exitosamente',
                    severity: 'success'
                });
                fetchSchoolsByYear(); // Recargar la lista
            } catch (err) {
                console.error('Error al eliminar colegio:', err);
                setSnackbar({
                    open: true,
                    message: 'Error al eliminar colegio',
                    severity: 'error'
                });
            }
        }
    };

    const handleViewSubmissions = async (school) => {
        setSubmissions([]);
        try {
            setLoading(true);
            const resp = await api.get(`/schools/${school.id}/submissions`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            let rawSubmissions = resp.data.submissions || [];
            const parsedSubmissions = rawSubmissions.map((sub) => {
                let parsedData;
                if (typeof sub.data === 'string') {
                    try {
                        parsedData = JSON.parse(sub.data);
                    } catch (err) {
                        parsedData = {};
                    }
                } else {
                    parsedData = sub.data || {};
                }
                return {
                    ...sub,
                    data: parsedData
                };
            });
            setSubmissions(parsedSubmissions);
            setSelectedSchool(school);
            setOpenSubmissionDialog(true);
        } catch (error) {
            console.error('Error al obtener inscripciones:', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener formularios de este colegio',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };
    // Bulk upload handlers
    const handleOpenBulkUpload = () => {
        setBulkFile(null);
        setBulkResults(null);
        setBulkMigrationConfirmation(null);
        setBulkSelectedRows(new Set());
        setOpenBulkDialog(true);
    };
    const handleCloseBulkDialog = () => {
        setOpenBulkDialog(false);
    };
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        setBulkFile(file || null);
        setBulkResults(null);
        setBulkMigrationConfirmation(null);
        setBulkSelectedRows(new Set());
    };
    const submitBulkUpload = async ({ confirmCycleMigration = false, confirmedRows = [] } = {}) => {
        if (!bulkFile) return;
        setBulkLoading(true);
        if (!confirmCycleMigration) {
            setBulkResults(null);
            setBulkMigrationConfirmation(null);
            setBulkSelectedRows(new Set());
        }
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            if (selectedCicloEscolarId) {
                formData.append('cicloEscolarId', selectedCicloEscolarId);
            }
            if (confirmCycleMigration) {
                formData.append('confirmCycleMigration', 'true');
                formData.append('confirmedMigrationRows', JSON.stringify(confirmedRows));
            }
            const resp = await api.post('/schools/bulk-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${auth.token}`
                }
            });
            setBulkResults(resp.data || null);
            setBulkMigrationConfirmation(null);
            setBulkSelectedRows(new Set());
            // Refresh list after upload
            fetchSchoolsByYear();
            setSnackbar({ open: true, message: 'Carga masiva procesada', severity: 'success' });
        } catch (err) {
            console.error('Error al subir colegios masivamente:', err);
            const responseData = err.response?.data;
            if (err.response?.status === 409 && responseData?.bulk && responseData?.code === 'SCHOOL_CYCLE_MIGRATION_CONFIRMATION_REQUIRED') {
                const pendingRows = Array.isArray(responseData.pendingRows) ? responseData.pendingRows : [];
                setBulkMigrationConfirmation(responseData);
                setBulkSelectedRows(new Set(pendingRows.map((row) => Number(row.row)).filter(Boolean)));
                setBulkResults(responseData);
                setSnackbar({ open: true, message: 'Revisa los colegios que requieren confirmación de traslado.', severity: 'warning' });
                return;
            }
            setSnackbar({ open: true, message: 'Error al procesar la carga masiva', severity: 'error' });
        } finally {
            setBulkLoading(false);
        }
    };
    const handleUploadBulk = () => submitBulkUpload();
    const handleToggleBulkMigrationRow = (rowNumber) => {
        setBulkSelectedRows((prev) => {
            const next = new Set(prev);
            if (next.has(rowNumber)) next.delete(rowNumber);
            else next.add(rowNumber);
            return next;
        });
    };
    const handleConfirmBulkMigration = () => {
        submitBulkUpload({
            confirmCycleMigration: true,
            confirmedRows: Array.from(bulkSelectedRows)
        });
    };

    // Add school handler (reuse existing edit dialog)
    const handleAddSchool = () => {
        setSelectedPrefillSchoolId('');
        resetCreateSchoolDraft();
        fetchPrefillSchools();
        setOpenEditDialog(true);
    };

    const handlePrefillSchoolChange = (event) => {
        const nextSchoolId = event.target.value;
        setSelectedPrefillSchoolId(nextSchoolId);

        if (!nextSchoolId) {
            resetCreateSchoolDraft();
            return;
        }

        const sourceSchool = prefillSchools.find((school) => String(school.id) === String(nextSchoolId));
        if (!sourceSchool) return;

        resetCreateSchoolDraft(sourceSchool);
    };

    const handleCloseEditDialog = () => {
        setOpenEditDialog(false);
        setOpenEditSchedulesModal(false);
        setCycleMigrationConfirmation(null);
        setSelectedSchool(null);
        setSelectedPrefillSchoolId('');
        setSchoolSchedules([]);
        setSchoolGrades([]);
        setSchoolExtraFields([]);
        setSchoolRouteNumbers([]);
        setSchoolRouteSchedules([]);
        // Resetear acordeones
        setExpandedPanels({
            basicInfo: true,
            financial: false,
            schedules: false,
            grades: false,
            routes: false,
            extraFields: false
        });
    };

    const handleOpenEditSchedulesModal = () => {
        if (!selectedSchool) return;
        setOpenEditSchedulesModal(true);
    };

    const handleCloseEditSchedulesModal = () => {
        setOpenEditSchedulesModal(false);
    };

    const handleEditSchedulesSuccess = (result) => {
        const updatedSchedules = Array.isArray(result?.school?.schedules)
            ? result.school.schedules
            : [];

        const normalized = ensureFourSchedules(updatedSchedules).map(s => ({
            ...s,
            _originalCode: s.code || null
        }));

        setSchoolSchedules(normalized);
        setSelectedSchool((prev) => prev ? {
            ...prev,
            schedules: updatedSchedules,
            routeSchedules: result?.school?.routeSchedules ?? prev.routeSchedules
        } : prev);

        // Sync schoolRouteSchedules state so "Guardar Cambios" doesn't revert
        // deleted/edited schedule codes back into routeSchedules.
        const updatedRS = result?.school?.routeSchedules;
        if (Array.isArray(updatedRS)) {
            setSchoolRouteSchedules(updatedRS);
        }

        // Only refetch when the school already exists in DB.
        if (selectedSchool?.id) {
            fetchSchoolsByYear();
        }
    };

    const handleCloseSubmissionDialog = () => {
        setOpenSubmissionDialog(false);
        setSelectedSchool(null);
        setSubmissionDetail(null);
    };

    // Función para manejar la expansión de acordeones
    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedPanels(prev => ({
            ...prev,
            [panel]: isExpanded
        }));
    };

    // Funciones para el popover de grados
    const handlePopoverOpen = (event, grades) => {
        setAnchorEl(event.currentTarget);
        setPopoverGrades(Array.isArray(grades) ? grades : []);
    };
    
    const handlePopoverClose = () => {
        setAnchorEl(null);
        setPopoverGrades([]);
    };

    const openPopover = Boolean(anchorEl);
    const popoverId = openPopover ? 'grades-popover' : undefined;

    // Funciones para manejar cambios en el formulario de edición
    const handleInputChange = (e) => {
        setSelectedSchool((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleTimeChange = (e, scheduleIndex, timeIndex) => {
        const { value } = e.target;
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            // Only allow one time entry per schedule. If empty, set to 'N/A'
            clone[scheduleIndex].times = [value ? value : 'N/A'];
            return clone;
        });
    };

    const DAY_OPTIONS = [
        { key: 'monday', label: 'Lun' },
        { key: 'tuesday', label: 'Mar' },
        { key: 'wednesday', label: 'Mié' },
        { key: 'thursday', label: 'Jue' },
        { key: 'friday', label: 'Vie' },
    ];

    const ALL_DAY_KEYS = DAY_OPTIONS.map(d => d.key);
    const DAY_LABEL_BY_KEY = DAY_OPTIONS.reduce((acc, d) => {
        acc[d.key] = d.label;
        return acc;
    }, {});

    const formatTimeTo12h = (hhmm) => {
        if (!hhmm || typeof hhmm !== 'string') return hhmm;
        const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return hhmm;
        const h24 = Number(m[1]);
        const min = m[2];
        if (Number.isNaN(h24) || h24 < 0 || h24 > 23) return hhmm;
        const suffix = h24 >= 12 ? 'PM' : 'AM';
        const h12 = ((h24 + 11) % 12) + 1;
        return `${h12}:${min} ${suffix}`;
    };

    const isAllDaysSelected = (days) => {
        if (!Array.isArray(days) || days.length === 0) return true;
        return ALL_DAY_KEYS.every(day => days.includes(day));
    };

    // Funciones para grados
    const handleAddGrade = () => {
        setSchoolGrades((prev) => [...prev, { name: '' }]);
    };

    const handleRemoveGrade = (gradeIndex) => {
        setSchoolGrades((prev) => {
            const newArr = [...prev];
            newArr.splice(gradeIndex, 1);
            return newArr;
        });
    };

    const handleGradeChange = (e, gradeIndex) => {
        const { value } = e.target;
        setSchoolGrades((prev) => {
            const clone = [...prev];
            clone[gradeIndex].name = value;
            return clone;
        });
    };

    // Funciones para números de ruta
    const handleAddRouteNumber = () => {
        setSchoolRouteNumbers((prev) => {
            const next = [...prev, ''];
            return next;
        });
        setSchoolRouteSchedules(prev => ([...(Array.isArray(prev) ? prev : []), { routeNumber: '', schedules: [] }]));
    };

    const handleRemoveRouteNumber = (index) => {
        setSchoolRouteNumbers((prev) => {
            const clone = [...prev];
            const removed = clone[index];
            clone.splice(index, 1);
            setSchoolRouteSchedules(prevRS => (Array.isArray(prevRS) ? prevRS.filter(x => String(x.routeNumber) !== String(removed)) : []));
            return clone;
        });
    };

    const handleChangeRouteNumber = (index, value) => {
        setSchoolRouteNumbers((prev) => {
            const clone = [...prev];
            const oldVal = clone[index];
            clone[index] = value;
            setSchoolRouteSchedules(prevRS => {
                const arr = Array.isArray(prevRS) ? [...prevRS] : [];
                const idx = arr.findIndex(x => String(x.routeNumber) === String(oldVal));
                if (idx !== -1) arr[idx] = { routeNumber: String(value), schedules: Array.isArray(arr[idx].schedules) ? arr[idx].schedules : [] };
                else arr.push({ routeNumber: String(value), schedules: [] });
                return arr;
            });
            return clone;
        });
    };

    // Funciones para campos extra
    const handleAddExtraField = () => {
        setSchoolExtraFields((prev) => [
            ...prev,
            { fieldName: '', type: 'text', required: false }
        ]);
    };

    const handleRemoveExtraField = (index) => {
        setSchoolExtraFields((prev) => {
            const clone = [...prev];
            clone.splice(index, 1);
            return clone;
        });
    };

    const handleChangeExtraField = (index, field, value) => {
        setSchoolExtraFields((prev) => {
            const clone = [...prev];
            clone[index][field] = value;
            return clone;
        });
    };

    const isSchoolCycleMigrationConfirmation = (error) => {
        const responseData = error?.response?.data;
        return error?.response?.status === 409 && responseData?.code === 'SCHOOL_CYCLE_MIGRATION_CONFIRMATION_REQUIRED';
    };

    const handleConfirmCycleMigration = async () => {
        if (!cycleMigrationConfirmation?.payload) return;

        setSavingSchool(true);
        try {
            const response = await api.post('/schools', {
                ...cycleMigrationConfirmation.payload,
                confirmCycleMigration: true
            }, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });

            const transfer = response.data?.cycleMigrationTransfer;
            const hasTransfer = transfer && Object.values(transfer).some((value) => Number(value) > 0);
            setSnackbar({
                open: true,
                message: hasTransfer ? 'Colegio creado y relaciones actualizadas al nuevo ciclo.' : 'Colegio creado exitosamente',
                severity: 'success'
            });
            setCycleMigrationConfirmation(null);
            fetchSchoolsByYear();
            handleCloseEditDialog();
        } catch (err) {
            console.error('Error al confirmar traslado de ciclo:', err);
            setSnackbar({
                open: true,
                message: 'Error al crear el colegio con traslado de ciclo',
                severity: 'error'
            });
        } finally {
            setSavingSchool(false);
        }
    };

    // Función para guardar cambios
    const handleSave = async () => {
        if (!selectedSchool) return;

        if (
            Number(selectedSchool.transportFeeComplete) < 0 ||
            Number(selectedSchool.transportFeeHalf) < 0
        ) {
            setSnackbar({
                open: true,
                message: 'Las cuotas de transporte no pueden ser negativas.',
                severity: 'error'
            });
            return;
        }
        if (
            Number(selectedSchool.duePaymentDay) < 1 ||
            Number(selectedSchool.duePaymentDay) > 31
        ) {
            setSnackbar({
                open: true,
                message: 'El día de pago debe estar entre 1 y 31.',
                severity: 'error'
            });
            return;
        }
        // Validate daily penalty
        if (Number(selectedSchool.dailyPenalty) < 0) {
            setSnackbar({ open: true, message: 'La mora diaria no puede ser negativa.', severity: 'error' });
            return;
        }

        // Validate schedules: codes must be 2-4 uppercase letters, no duplicates
        const schedulesWithCode = schoolSchedules.filter(s => s && s.code);
        const invalidCode = schedulesWithCode.find(s => !/^[A-Z]{2,4}$/.test(s.code));
        if (invalidCode) {
            setSnackbar({ open: true, message: `Código de horario inválido: "${invalidCode.code}". Use 2 a 4 letras mayúsculas (ej: AM, VE, NO).`, severity: 'error' });
            return;
        }
        const codeCounts = {};
        for (const s of schedulesWithCode) {
            codeCounts[s.code] = (codeCounts[s.code] || 0) + 1;
        }
        const dupCode = Object.keys(codeCounts).find(c => codeCounts[c] > 1);
        if (dupCode) {
            setSnackbar({ open: true, message: `Código de horario duplicado: "${dupCode}". Cada código debe ser único.`, severity: 'error' });
            return;
        }

        // Validate duplicate base time for the same day
        const occupancyByDayTime = new Map();
        for (const s of schedulesWithCode) {
            const time = Array.isArray(s.times) && s.times[0] && s.times[0] !== 'N/A' ? String(s.times[0]) : null;
            if (!time) continue;

            const daysForSchedule = isAllDaysSelected(s.days) ? ALL_DAY_KEYS : s.days;
            for (const day of daysForSchedule) {
                const k = `${day}|${time}`;
                if (occupancyByDayTime.has(k)) {
                    const existingCode = occupancyByDayTime.get(k);
                    const dayLabel = DAY_LABEL_BY_KEY[day] || day;
                    const timeLabel = formatTimeTo12h(time);
                    setSnackbar({
                        open: true,
                        message: `Conflicto de hora base: los horarios "${existingCode}" y "${s.code}" comparten ${timeLabel} en ${dayLabel}.`,
                        severity: 'error'
                    });
                    return;
                }
                occupancyByDayTime.set(k, s.code);
            }
        }

        // Warn if there are entries without code (they will be skipped)
        const emptyCodeEntries = schoolSchedules.filter(s => s && !s.code);
        if (emptyCodeEntries.length > 0) {
            // Don't block, just skip them silently during normalization
        }

        let attemptedPayload = null;
        setSavingSchool(true);
        try {
            // Normalize schedules: filter out entries without code, preserve days
            const normalizedSchedules = schedulesWithCode
                .map(s => {
                    const entry = {
                        code: s.code.toUpperCase(),
                        name: s.name || `HORARIO ${s.code.toUpperCase()}`,
                        times: Array.isArray(s.times) && s.times[0] && s.times[0] !== 'N/A' ? [s.times[0]] : ['N/A']
                    };
                    // Preserve days restriction if set
                    if (Array.isArray(s.days) && s.days.length > 0) {
                        entry.days = s.days;
                    }
                    // Include originalCode so backend can detect renames and cascade updates
                    if (s._originalCode !== undefined && s._originalCode !== null) {
                        entry.originalCode = s._originalCode;
                    }
                    return entry;
                });

            // Build routeSchedules payload aligned to current routeNumbers
            const routeSchedulesPayload = (schoolRouteNumbers || []).map(rn => {
                const entry = (schoolRouteSchedules || []).find(x => String(x.routeNumber) === String(rn));
                const schedules = Array.isArray(entry && entry.schedules) ? entry.schedules : [];
                // Clean schedules: ensure unique by code, keep only first time if present
                const byCode = new Map();
                (schedules || []).forEach(s => {
                    if (!s) return;
                    const code = (s.code || '').toUpperCase() || null;
                    const time = Array.isArray(s.times) && s.times[0] ? String(s.times[0]) : null;
                    const name = s.name || (code ? `HORARIO ${code}` : 'HORARIO');
                    if (code) byCode.set(code, { code, name, times: time ? [time] : [] });
                });
                return { routeNumber: String(rn), schedules: Array.from(byCode.values()) };
            });

            const payload = {
                name: selectedSchool.name,
                address: selectedSchool.address,
                city: selectedSchool.city,
                contactPerson: selectedSchool.contactPerson,
                contactEmail: selectedSchool.contactEmail,
                contactPhone: selectedSchool.contactPhone,
                whatsappLink: selectedSchool.whatsappLink || null,
                schedules: normalizedSchedules,
                grades: schoolGrades,
                transportFeeComplete: Number(selectedSchool.transportFeeComplete) || 0.0,
                transportFeeHalf: Number(selectedSchool.transportFeeHalf) || 0.0,
                duePaymentDay: Number(selectedSchool.duePaymentDay) || 1,
                extraEnrollmentFields: schoolExtraFields,
                routeNumbers: schoolRouteNumbers,
                routeSchedules: routeSchedulesPayload,
                bankName: selectedSchool.bankName || '',
                bankAccount: selectedSchool.bankAccount || '',
                // Penalty settings
                dailyPenalty: Number(selectedSchool.dailyPenalty) || 0,
                penaltyPaused: !!selectedSchool.penaltyPaused,
                // school year bounds
                schoolYearStart: schoolYearStart || null,
                schoolYearEnd: schoolYearEnd || null,
                cicloEscolarId: selectedCicloEscolarId || null
            };
            attemptedPayload = payload;

            // Distinguish between create and update
            if (selectedSchool.id) {
                // Update existing school
                await api.put(`/schools/${selectedSchool.id}`, payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                
                setSnackbar({
                    open: true,
                    message: 'Colegio actualizado exitosamente',
                    severity: 'success'
                });
            } else {
                // Create new school
                const createResponse = await api.post('/schools', payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });

                const transfer = createResponse.data?.cycleMigrationTransfer;
                const hasTransfer = transfer && Object.values(transfer).some((value) => Number(value) > 0);
                
                setSnackbar({
                    open: true,
                    message: hasTransfer ? 'Colegio creado y relaciones actualizadas al nuevo ciclo.' : 'Colegio creado exitosamente',
                    severity: 'success'
                });
            }

            fetchSchoolsByYear(); // Recargar la lista
            handleCloseEditDialog();
        } catch (err) {
            console.error('Error al guardar el colegio:', err);
            if (!selectedSchool?.id && attemptedPayload && isSchoolCycleMigrationConfirmation(err)) {
                setCycleMigrationConfirmation({
                    open: true,
                    payload: attemptedPayload,
                    message: err.response.data?.message || '',
                    impact: err.response.data?.impact || null
                });
                return;
            }
            setSnackbar({
                open: true,
                message: 'Error al guardar el colegio',
                severity: 'error'
            });
        } finally {
            setSavingSchool(false);
        }
    };

    // Función para limpiar mora
    const handleClearPenalty = async () => {
        if (!selectedSchool) return;
        
        if (!clearReason.trim()) {
            setSnackbar({
                open: true,
                message: 'Debe ingresar un motivo para la limpieza de mora',
                severity: 'warning'
            });
            return;
        }
        
        // Determinar período a limpiar
        let periodToClean = clearPeriod;
        if (clearPeriod === 'CUSTOM') {
            if (!customClearPeriod) {
                setSnackbar({
                    open: true,
                    message: 'Debe seleccionar un período personalizado',
                    severity: 'warning'
                });
                return;
            }
            periodToClean = customClearPeriod;
        } else if (clearPeriod === 'CURRENT') {
            // Usar período actual (formato YYYY-MM)
            const now = new Date();
            periodToClean = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        
        const confirmMessage = clearPeriod === 'ALL'
            ? `¿Está seguro de limpiar TODA la mora acumulada del colegio "${selectedSchool.name}"?\n\nMotivo: ${clearReason}`
            : `¿Está seguro de limpiar la mora del período ${periodToClean} del colegio "${selectedSchool.name}"?\n\nMotivo: ${clearReason}`;
        
        if (!window.confirm(confirmMessage)) {
            return;
        }
        
        setClearingPenalty(true);
        
        try {
            const response = await api.post('/payments/penalties/clear', {
                schoolId: selectedSchool.id,
                cicloEscolarId: selectedCicloEscolarId || null,
                period: periodToClean,
                reason: clearReason
            });
            
            setSnackbar({
                open: true,
                message: response.data.message || 'Mora limpiada exitosamente',
                severity: 'success'
            });
            
            // Limpiar campos
            setClearPeriod('CURRENT');
            setCustomClearPeriod('');
            setClearReason('');
            
        } catch (err) {
            console.error('Error al limpiar mora:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al limpiar la mora',
                severity: 'error'
            });
        } finally {
            setClearingPenalty(false);
        }
    };

    return (
        <PageContainer>
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
                        <CalendarToday sx={{ fontSize: { xs: 36, sm: 40 }, flexShrink: 0 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '2.125rem' }, lineHeight: 1.2 }}>
                                Gestión de Transportes Escolares
                            </Typography>
                            <Typography variant="h6" sx={{ opacity: 0.9, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                                Selecciona el ciclo escolar y colegio para gestionar
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            {/* Selector de Ciclo Escolar */}
            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
                            Ciclo Escolar
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <FormControl fullWidth variant="outlined" sx={{ maxWidth: { xs: '100%', sm: 300 }, minWidth: 0 }}>
                                <InputLabel>Seleccionar Ciclo Escolar</InputLabel>
                                <Select
                                    value={selectedCicloEscolarId}
                                    onChange={handleCycleChange}
                                    label="Seleccionar Ciclo Escolar"
                                    disabled={cyclesLoading || cycleOptions.length === 0}
                                >
                                    {cycleOptions.map((cycleOption) => (
                                        <MenuItem key={cycleOption.id} value={cycleOption.id}>
                                            {cycleOption.name}
                                        </MenuItem>
                                    ))}
                                    {cycleOptions.length === 0 && (
                                        <MenuItem value="" disabled>
                                            Sin ciclos configurados
                                        </MenuItem>
                                    )}
                                </Select>
                            </FormControl>

                            <Box sx={{ display: { xs: 'grid', sm: 'flex' }, gridTemplateColumns: { xs: '1fr' }, gap: 1, width: { xs: '100%', sm: 'auto' } }}>
                                <PermissionGuard permission="notificaciones-crear">
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        startIcon={<NotificationsActiveIcon />}
                                        onClick={() => setOpenSendNotifModal(true)}
                                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                                    >
                                        Enviar Notificación
                                    </Button>
                                </PermissionGuard>
                                <PermissionGuard permission="colegios-crear">
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={handleOpenBulkUpload}
                                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                                    >
                                        Carga Masiva
                                    </Button>
                                </PermissionGuard>
                                <PermissionGuard permission="colegios-crear">
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleAddSchool}
                                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                                        >
                                        Añadir Colegio
                                    </Button>
                                </PermissionGuard>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Bulk upload dialog copied/adapted from SchoolsManagementPage */}
            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Colegios</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Subir un archivo Excel utilizando la plantilla.
                        <br />
                        <br />
                        Para los horarios, escribir tiempos en formato <code>HH:MM</code> (ej. <code>13:00</code>). <br /> <br />
                        Las fechas de Inicio Ciclo / Fin Ciclo deben ir en formato <code>dd-mm-aaaa</code>.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="success"
                        onClick={async () => {
                            try {
                                const workbook = new ExcelJS.Workbook();
                                const worksheet = workbook.addWorksheet('Plantilla Colegios');
                                worksheet.columns = [
                                    { header: 'Nombre', key: 'name', width: 30 },
                                    { header: 'Dirección', key: 'address', width: 40 },
                                    { header: 'Ciudad', key: 'city', width: 20 },
                                    { header: 'Persona de Contacto', key: 'contactPerson', width: 25 },
                                    { header: 'Correo de Contacto', key: 'contactEmail', width: 30 },
                                    { header: 'Teléfono de Contacto', key: 'contactPhone', width: 20 },
                                    { header: 'Enlace Whatsapp', key: 'whatsapp', width: 20 },
                                    // Dynamic schedule columns
                                    ...DEFAULT_SCHEDULE_CODES.map(code => ({
                                        header: `Horario ${code}`, key: `schedule${code}`, width: 14, style: { numFmt: '@' }
                                    })),
                                    { header: 'Grados', key: 'grades', width: 30 },
                                    { header: 'Tarifa Completa', key: 'transportFeeComplete', width: 18, style: { numFmt: '0.00' } },
                                    { header: 'Tarifa Media', key: 'transportFeeHalf', width: 18, style: { numFmt: '0.00' } },
                                    { header: 'Dia de Pago', key: 'duePaymentDay', width: 12, style: { numFmt: '0' } },
                                    { header: 'Banco', key: 'bankName', width: 20 },
                                    { header: 'Cuenta Bancaria', key: 'bankAccount', width: 25 },
                                    { header: 'Numeros Ruta', key: 'routeNumbers', width: 25, style: { numFmt: '@' } },
                                    { header: 'Penalidad Diaria', key: 'dailyPenalty', width: 16, style: { numFmt: '0.00' } },
                                    { header: 'Inicio Ciclo', key: 'schoolYearStart', width: 14, style: { numFmt: '@' } },
                                    { header: 'Fin Ciclo', key: 'schoolYearEnd', width: 14, style: { numFmt: '@' } }
                                ];

                                const templateYear = Number.parseInt(selectedCycleYear, 10) || new Date().getFullYear();

                                // Example row to guide users
                                worksheet.addRow({
                                    name: 'Colegio Ejemplo',
                                    address: 'Calle 123',
                                    city: 'Ciudad',
                                    contactPerson: 'Nombre',
                                    contactEmail: 'contacto@colegio.com',
                                    contactPhone: '12345678',
                                    whatsapp: '',
                                    // Dynamic schedule example values
                                    ...Object.fromEntries(DEFAULT_SCHEDULE_CODES.map((code, i) => [
                                        `schedule${code}`, ['07:00', '12:00', '13:00', '15:00'][i] || 'N/A'
                                    ])),
                                    grades: 'Kinder,1ero,2do',
                                    transportFeeComplete: 0.00,
                                    transportFeeHalf: 0.00,
                                    duePaymentDay: 1,
                                    bankName: '',
                                    bankAccount: '',
                                    routeNumbers: '12,15',
                                    dailyPenalty: 10.00,
                                    schoolYearStart: `01-03-${templateYear}`,
                                    schoolYearEnd: `28-02-${templateYear + 1}`
                                });

                                worksheet.getRow(1).font = { bold: true };

                                const buffer = await workbook.xlsx.writeBuffer();
                                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Plantilla_Colegios_${moment().format('YYYYMMDD')}.xlsx`;
                                a.click();
                                window.URL.revokeObjectURL(url);
                            } catch (err) {
                                console.error('Error generando plantilla:', err);
                            }
                        }}
                        sx={{ mr: 2 }}
                    >
                        Descargar Plantilla
                    </Button>
                    <Button variant="outlined" component="label" startIcon={<Add />}>
                        Seleccionar Archivo
                        <input
                            type="file"
                            hidden
                            onChange={handleFileChange}
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
                    {bulkMigrationConfirmation && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="warning">
                                <Typography sx={{ fontWeight: 600, mb: 1 }}>
                                    Colegios encontrados en ciclos anteriores
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    Marca los colegios que deseas crear en el ciclo seleccionado y trasladar sus relaciones operativas.
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {(bulkMigrationConfirmation.pendingRows || []).map((row) => {
                                        const counts = row.impact?.counts || {};
                                        return (
                                            <FormControlLabel
                                                key={row.row}
                                                control={
                                                    <Checkbox
                                                        checked={bulkSelectedRows.has(Number(row.row))}
                                                        onChange={() => handleToggleBulkMigrationRow(Number(row.row))}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography variant="body2">
                                                            Fila {row.row}: {row.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {Number(counts.pilotsToMove || 0)} pilotos, {Number(counts.monitorasToMove || 0)} monitoras, {Number(counts.busesToUnassign || 0)} buses, {Number(counts.routeAssignmentsToClear || 0)} rutas afectadas
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        );
                                    })}
                                </Box>
                            </Alert>
                        </Box>
                    )}
                    {bulkResults && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="info">
                                <Typography>
                                    <strong>Colegios creados:</strong> {bulkResults.successCount || 0}
                                </Typography>
                                <Typography>
                                    <strong>Duplicados ignorados:</strong> {bulkResults.duplicateCount || 0}
                                </Typography>
                                <Typography>
                                    <strong>No procesados por selección:</strong> {bulkResults.skippedCount || 0}
                                </Typography>
                                <Typography>
                                    <strong>Errores:</strong> {bulkResults.errorsCount || 0}
                                </Typography>
                                {bulkResults.duplicateRows && bulkResults.duplicateRows.length > 0 && (
                                    <>
                                        <Typography sx={{ mt: 1 }}>
                                            <strong>Duplicados:</strong>
                                        </Typography>
                                        <ul>
                                            {bulkResults.duplicateRows.map((duplicate) => (
                                                <li key={`duplicate-${duplicate.row}`}>
                                                    Fila {duplicate.row}: {duplicate.name || 'Sin nombre'} - {duplicate.reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                                {bulkResults.skippedRows && bulkResults.skippedRows.length > 0 && (
                                    <>
                                        <Typography sx={{ mt: 1 }}>
                                            <strong>No procesados:</strong>
                                        </Typography>
                                        <ul>
                                            {bulkResults.skippedRows.map((skipped) => (
                                                <li key={`skipped-${skipped.row}`}>
                                                    Fila {skipped.row}: {skipped.name || 'Sin nombre'} - {skipped.reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                                {bulkResults.errorsList && bulkResults.errorsList.length > 0 && (
                                    <ul>
                                        {bulkResults.errorsList.map((err) => (
                                            <li key={`error-${err.row}`}>
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
                    <Button
                        onClick={bulkMigrationConfirmation ? handleConfirmBulkMigration : handleUploadBulk}
                        variant="contained"
                        color={bulkMigrationConfirmation ? 'warning' : 'primary'}
                        disabled={!bulkFile || bulkLoading}
                    >
                        {bulkMigrationConfirmation ? 'Procesar selección' : 'Subir'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Lista de Colegios */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                        Colegios - {cycleOptions.find((cycleOption) => cycleOption.id === selectedCicloEscolarId)?.name || `Ciclo Escolar ${selectedCycleYear}`}
                    </Typography>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : schools.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <SchoolIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                            <Typography variant="h6" color="textSecondary">
                                No hay colegios disponibles para este ciclo escolar
                            </Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            {schools.map((school) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={school.id}>
                                    <SchoolCard>
                                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                            <Box sx={{ minHeight: 28, mb: 1, display: 'flex', justifyContent: 'center' }}>
                                                {isPreviousCycleSchool(school) && (
                                                    <Chip
                                                        label="Ciclo anterior"
                                                        size="small"
                                                        color="warning"
                                                        variant="filled"
                                                    />
                                                )}
                                            </Box>
                                            <SchoolIcon 
                                                sx={{ 
                                                    fontSize: 48, 
                                                    color: 'primary.main', 
                                                    mb: 2 
                                                }} 
                                            />
                                            <Typography 
                                                variant="h6" 
                                                component="h3" 
                                                gutterBottom
                                                sx={{ 
                                                    fontWeight: 'bold',
                                                    minHeight: '2.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {school.name}
                                            </Typography>
                                            <Typography 
                                                variant="body2" 
                                                color="textSecondary" 
                                                sx={{ mb: 2 }}
                                            >
                                                {school.city}
                                            </Typography>

                                            {/* Total de Alumnos */}
                                            <Typography 
                                                variant="body2" 
                                                color="text.secondary" 
                                                sx={{ mb: 1, fontWeight: 600 }}
                                            >
                                                Total de Alumnos: {school.studentsCount || 0}
                                            </Typography>

                                            {/* Grados como chips */}
                                            {Array.isArray(school.grades) && school.grades.length > 0 ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2, justifyContent: 'center' }}>
                                                    {school.grades.slice(0, 3).map((grade, index) => (
                                                        <Chip
                                                            key={index}
                                                            label={grade?.name || grade || `Grado ${index + 1}`}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                        />
                                                    ))}
                                                    {school.grades.length > 3 && (
                                                        <Chip
                                                            label={`+${school.grades.length - 3} más`}
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePopoverOpen(e, school.grades.slice(3));
                                                            }}
                                                            clickable
                                                            color="secondary"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Box>
                                            ) : (
                                                <Typography 
                                                    variant="body2" 
                                                    color="textSecondary" 
                                                    sx={{ mb: 2, fontSize: '0.75rem' }}
                                                >
                                                    Sin grados configurados
                                                </Typography>
                                            )}
                                            
                                            {/* Botón principal de gestionar */}
                                            <Button 
                                                variant="contained" 
                                                color="primary"
                                                size="small"
                                                sx={{ borderRadius: 2, mb: 2 }}
                                                onClick={() => handleSchoolSelect(school)}
                                            >
                                                Gestionar
                                            </Button>

                                            {/* Botones de acciones */}
                                            <Box sx={{ 
                                                display: 'flex', 
                                                justifyContent: 'center', 
                                                gap: 1,
                                                borderTop: '1px solid #e0e0e0',
                                                pt: 1.5
                                            }}>
                                                <Tooltip title={school.canCreateNewUsers === false ? 'Solo disponible en el ciclo más reciente' : 'Copiar enlace de inscripción'}>
                                                    <span>
                                                        <IconButton 
                                                            size="small"
                                                            disabled={school.canCreateNewUsers === false}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyLink(school.id);
                                                            }}
                                                        >
                                                            <ContentCopy fontSize="small" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Editar colegio">
                                                    <IconButton 
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditClick(school);
                                                        }}
                                                    >
                                                        <Edit fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Ver formularios de inscripción">
                                                    <IconButton 
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewSubmissions(school);
                                                        }}
                                                    >
                                                        <Visibility fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <PermissionGuard permission="colegios-eliminar">
                                                    <Tooltip title="Eliminar colegio">
                                                        <IconButton 
                                                            size="small"
                                                            color="error"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteClick(school.id);
                                                            }}
                                                        >
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </PermissionGuard>
                                            </Box>
                                        </CardContent>
                                    </SchoolCard>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </CardContent>
            </Card>

            {/* Diálogo de edición de colegio */}
            <Dialog 
                open={openEditDialog} 
                onClose={handleCloseEditDialog} 
                maxWidth="md" 
                fullWidth
            >
                <DialogTitle>
                    {selectedSchool?.id ? 'Editar Colegio' : 'Añadir Nuevo Colegio'}
                </DialogTitle>
                <DialogContent sx={{ px: 3, py: 2 }}>
                    {!selectedSchool?.id && (
                        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Prellenar con colegio existente</InputLabel>
                                    <Select
                                        value={selectedPrefillSchoolId}
                                        label="Prellenar con colegio existente"
                                        onChange={handlePrefillSchoolChange}
                                        disabled={prefillSchoolsLoading}
                                    >
                                        <MenuItem value="">
                                            <em>Sin prellenar</em>
                                        </MenuItem>
                                        {prefillSchools.map((school) => {
                                            const cicloLabel = getCicloEscolarOptionLabel(school?.cicloEscolar) || 'Ciclo actual';
                                            return (
                                                <MenuItem key={school.id} value={String(school.id)}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, width: '100%' }}>
                                                        <Typography>{school.name}</Typography>
                                                        <Chip label={cicloLabel} size="small" variant="outlined" />
                                                    </Box>
                                                </MenuItem>
                                            );
                                        })}
                                    </Select>
                                </FormControl>
                                {prefillSchoolsLoading && <CircularProgress size={22} />}
                            </Box>
                        </Paper>
                    )}

                    {/* Sección: Información Básica */}
                    <StyledAccordion 
                        expanded={expandedPanels.basicInfo} 
                        onChange={handleAccordionChange('basicInfo')}
                        TransitionProps={{ unmountOnExit: false }}
                    >
                        <StyledAccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                📋 Información Básica
                            </Typography>
                        </StyledAccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    name="name"
                                    label="Nombre"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.name : ''}
                                    onChange={handleInputChange}
                                />
                                <TextField
                                    name="city"
                                    label="Ciudad"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.city : ''}
                                    onChange={handleInputChange}
                                />
                                <TextField
                                    name="address"
                                    label="Dirección"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.address : ''}
                                    onChange={handleInputChange}
                                />
                                <TextField
                                    name="contactPerson"
                                    label="Persona de Contacto"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.contactPerson : ''}
                                    onChange={handleInputChange}
                                />
                                <TextField
                                    name="contactPhone"
                                    label="Teléfono de Contacto"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.contactPhone : ''}
                                    onChange={handleInputChange}
                                />
                                <TextField
                                    name="contactEmail"
                                    label="Email de Contacto"
                                    type="email"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.contactEmail : ''}
                                    onChange={handleInputChange}
                                />
                                <TextField
                                    name="whatsappLink"
                                    label="Enlace de WhatsApp"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.whatsappLink : ''}
                                    onChange={handleInputChange}
                                    placeholder="https://wa.me/123456789?text=Hola"
                                />
                            </Box>
                        </AccordionDetails>
                    </StyledAccordion>

                    {/* Sección: Información Financiera */}
                    <StyledAccordion 
                        expanded={expandedPanels.financial} 
                        onChange={handleAccordionChange('financial')}
                        TransitionProps={{ unmountOnExit: false }}
                    >
                        <StyledAccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                💰 Información Financiera
                            </Typography>
                        </StyledAccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        label="Inicio Ciclo del Colegio"
                                        type="date"
                                        fullWidth
                                        variant="outlined"
                                        value={schoolYearStart || ''}
                                        onChange={(e) => setSchoolYearStart(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                    <TextField
                                        label="Fin Ciclo del Colegio"
                                        type="date"
                                        fullWidth
                                        variant="outlined"
                                        value={schoolYearEnd || ''}
                                        onChange={(e) => setSchoolYearEnd(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Box>

                                <TextField
                                    name="transportFeeComplete"
                                    label="Cuota de Transporte Completa (Q)"
                                    type="number"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.transportFeeComplete : ''}
                                    onChange={handleInputChange}
                                    inputProps={{ min: '0', step: '0.01' }}
                                />
                                <TextField
                                    name="transportFeeHalf"
                                    label="Cuota de Transporte Media (Q)"
                                    type="number"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.transportFeeHalf : ''}
                                    onChange={handleInputChange}
                                    inputProps={{ min: '0', step: '0.01' }}
                                />
                                <TextField
                                    name="duePaymentDay"
                                    label="Día de Pago (1-31)"
                                    type="number"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.duePaymentDay : ''}
                                    onChange={handleInputChange}
                                    inputProps={{ min: '1', max: '31' }}
                                />
                                <TextField
                                    name="bankName"
                                    label="Banco"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.bankName : ''}
                                    onChange={handleInputChange}
                                />
                                <TextField
                                    name="bankAccount"
                                    label="Cuenta Bancaria"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedSchool ? selectedSchool.bankAccount : ''}
                                    onChange={handleInputChange}
                                />
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <TextField
                                        name="dailyPenalty"
                                        label="Mora diaria (Q)"
                                        type="number"
                                        variant="outlined"
                                        value={selectedSchool ? selectedSchool.dailyPenalty : 0}
                                        onChange={handleInputChange}
                                        inputProps={{ min: '0', step: '0.01' }}
                                        sx={{ width: 140 }}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={selectedSchool ? !!selectedSchool.penaltyPaused : false}
                                                onChange={(e) => setSelectedSchool(prev => ({ ...prev, penaltyPaused: e.target.checked }))}
                                            />
                                        }
                                        label="Mora pausada"
                                    />
                                    <Button
                                        variant="contained"
                                        color="warning"
                                        startIcon={<DeleteSweepIcon />}
                                        onClick={() => setOpenQuickClear(true)}
                                        disabled={!selectedSchool}
                                    >
                                        LIMPIEZA DE MORA
                                    </Button>
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </StyledAccordion>

                    {/* Dialog: Limpieza rápida (período actual, motivo solamente) */}
                    <Dialog open={openQuickClear} onClose={() => setOpenQuickClear(false)} maxWidth="sm" fullWidth>
                        <DialogTitle>Limpiar Mora — Período Actual ({currentPeriodDisplay})</DialogTitle>
                        <DialogContent>
                            <DialogContentText sx={{ mb: 2 }}>
                                ⚠️ Esta acción limpiará la mora de todas las familias del colegio para el período actual ({currentPeriodDisplay}).
                                Por favor, proporciona un motivo para el registro de esta limpieza:
                            </DialogContentText>
                            <TextField
                                label="Período"
                                type="text"
                                fullWidth
                                value={currentPeriodDisplay}
                                InputProps={{ readOnly: true }}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label="Motivo"
                                type="text"
                                fullWidth
                                multiline
                                minRows={2}
                                value={quickClearReason}
                                onChange={(e) => setQuickClearReason(e.target.value)}
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setOpenQuickClear(false)}>Cancelar</Button>
                            <Button
                                variant="contained"
                                color="primary"
                                disabled={!quickClearReason || !selectedSchool || quickClearing}
                                onClick={async () => {
                                    try {
                                        setQuickClearing(true);
                                        const period = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                                        await api.post('/payments/penalties/clear', {
                                            schoolId: selectedSchool.id,
                                            cicloEscolarId: selectedCicloEscolarId || null,
                                            period,
                                            reason: quickClearReason
                                        });
                                        setQuickClearing(false);
                                        setOpenQuickClear(false);
                                        setSnackbar({ open: true, message: 'Limpieza de mora realizada correctamente', severity: 'success' });
                                        fetchSchoolsByYear();
                                    } catch (err) {
                                        console.error(err);
                                        setQuickClearing(false);
                                        setSnackbar({ open: true, message: 'Error al realizar limpieza de mora', severity: 'error' });
                                    }
                                }}
                            >
                                Limpiar
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Sección: Horarios */}
                    <StyledAccordion 
                        expanded={expandedPanels.schedules} 
                        onChange={handleAccordionChange('schedules')}
                        TransitionProps={{ unmountOnExit: false }}
                    >
                        <StyledAccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                🕐 Horarios del Colegio
                            </Typography>
                        </StyledAccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Horarios configurados actualmente: {Array.isArray(schoolSchedules) ? schoolSchedules.length : 0}
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        startIcon={<Edit />}
                                        onClick={handleOpenEditSchedulesModal}
                                        disabled={!selectedSchool}
                                    >
                                        Editar Horarios del Colegio
                                    </Button>
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </StyledAccordion>

                    {/* Sección: Grados */}
                    <StyledAccordion 
                        expanded={expandedPanels.grades} 
                        onChange={handleAccordionChange('grades')}
                        TransitionProps={{ unmountOnExit: false }}
                    >
                        <StyledAccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                🎓 Grados del Colegio
                            </Typography>
                        </StyledAccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <TextField
                                        label="Nombre del Grado"
                                        variant="outlined"
                                        value={newGradeName}
                                        onChange={(e) => setNewGradeName(e.target.value)}
                                        fullWidth
                                    />
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            const name = (newGradeName || '').toString().trim();
                                            if (!name) return;
                                            setSchoolGrades(prev => [...prev, { name }]);
                                            setNewGradeName('');
                                        }}
                                        startIcon={<Add />}
                                    >
                                        Agregar
                                    </Button>
                                </Box>

                                <Box>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Grados registrados:</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {Array.isArray(schoolGrades) && schoolGrades.length > 0 ? (
                                            schoolGrades.map((grade, idx) => (
                                                <Chip
                                                    key={idx}
                                                    label={grade?.name || `Grado ${idx + 1}`}
                                                    onDelete={() => handleRemoveGrade(idx)}
                                                    sx={{ mr: 1, mb: 1 }}
                                                />
                                            ))
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">No hay grados definidos.</Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </StyledAccordion>

                    {/* Sección: Números de Ruta */}
                    <StyledAccordion 
                        expanded={expandedPanels.routes} 
                        onChange={handleAccordionChange('routes')}
                        TransitionProps={{ unmountOnExit: false }}
                    >
                        <StyledAccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                🚌 Números de Ruta del Colegio
                            </Typography>
                        </StyledAccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {schoolRouteNumbers.map((rn, idx) => {
                                    const entry = (schoolRouteSchedules || []).find(x => String(x.routeNumber) === String(rn)) || { routeNumber: String(rn), schedules: [] };
                                    const selectedByCode = new Set((entry.schedules || []).map(s => s && s.code).filter(Boolean));
                                    const toggleSchedule = (code, schObj, checked) => {
                                        setSchoolRouteSchedules(prev => {
                                            const arr = Array.isArray(prev) ? [...prev] : [];
                                            let i = arr.findIndex(x => String(x.routeNumber) === String(rn));
                                            if (i === -1) { arr.push({ routeNumber: String(rn), schedules: [] }); i = arr.length - 1; }
                                            const curr = Array.isArray(arr[i].schedules) ? [...arr[i].schedules] : [];
                                            const idxByCode = curr.findIndex(s => s && s.code === code);
                                            if (checked) {
                                                const cleaned = { code: schObj.code, name: schObj.name || `HORARIO ${schObj.code}`, times: Array.isArray(schObj.times) && schObj.times[0] ? [String(schObj.times[0])] : [] };
                                                if (idxByCode === -1) curr.push(cleaned); else curr[idxByCode] = cleaned;
                                            } else {
                                                if (idxByCode !== -1) curr.splice(idxByCode, 1);
                                            }
                                            arr[i] = { routeNumber: String(rn), schedules: curr };
                                            return arr;
                                        });
                                    };
                                    return (
                                        <Paper key={idx} sx={{ p: 2 }}>
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                                                <TextField
                                                    fullWidth
                                                    value={rn}
                                                    onChange={(e) => handleChangeRouteNumber(idx, e.target.value)}
                                                    label={`Número de Ruta #${idx + 1}`}
                                                />
                                                <IconButton size="small" color="error" onClick={() => handleRemoveRouteNumber(idx)}>
                                                    <Delete />
                                                </IconButton>
                                            </Box>
                                            <Typography variant="body2" sx={{ mb: 1 }}>Horarios asignados:</Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                {(schoolSchedules || []).map((sch, si) => {
                                                    const timeVal = Array.isArray(sch.times) && sch.times[0] && sch.times[0] !== 'N/A' ? sch.times[0] : '';
                                                    const label = `${sch.code || sch.name || 'Horario'}${timeVal ? ` — ${timeVal}` : ''}`;
                                                    const disabled = !timeVal;
                                                    const checked = sch.code ? selectedByCode.has(sch.code) : false;
                                                    return (
                                                        <FormControlLabel
                                                            key={`rn-${idx}-sch-${si}`}
                                                            control={<Checkbox size="small" disabled={disabled} checked={checked} onChange={(e) => toggleSchedule(sch.code, sch, e.target.checked)} />}
                                                            label={label}
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        </Paper>
                                    );
                                })}
                                <Button variant="outlined" onClick={handleAddRouteNumber} startIcon={<Add />} sx={{ mt: 1 }}>
                                    Agregar Número de Ruta
                                </Button>
                            </Box>
                        </AccordionDetails>
                    </StyledAccordion>

                    {/* Sección: Campos Extra */}
                    <StyledAccordion 
                        expanded={expandedPanels.extraFields} 
                        onChange={handleAccordionChange('extraFields')}
                        TransitionProps={{ unmountOnExit: false }}
                    >
                        <StyledAccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                📝 Campos Extra de Inscripción
                            </Typography>
                        </StyledAccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {schoolExtraFields.map((field, idx) => (
                                    <Paper key={idx} sx={{ p: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="subtitle1">
                                                Campo #{idx + 1}
                                            </Typography>
                                            <IconButton
                                                onClick={() => handleRemoveExtraField(idx)}
                                                color="error"
                                                size="small"
                                            >
                                                <Delete />
                                            </IconButton>
                                        </Box>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <TextField
                                                label="Nombre del Campo"
                                                type="text"
                                                fullWidth
                                                value={field.fieldName || ''}
                                                onChange={(e) => handleChangeExtraField(idx, 'fieldName', e.target.value)}
                                            />
                                            <FormControl fullWidth>
                                                <InputLabel>Tipo</InputLabel>
                                                <Select
                                                    value={field.type || 'text'}
                                                    onChange={(e) => handleChangeExtraField(idx, 'type', e.target.value)}
                                                    label="Tipo"
                                                >
                                                    <MenuItem value="text">Texto</MenuItem>
                                                    <MenuItem value="number">Número</MenuItem>
                                                    <MenuItem value="date">Fecha</MenuItem>
                                                    <MenuItem value="select">Select/Combo</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={!!field.required}
                                                        onChange={(e) => handleChangeExtraField(idx, 'required', e.target.checked)}
                                                    />
                                                }
                                                label="Requerido"
                                            />
                                        </Box>
                                    </Paper>
                                ))}
                                <Button
                                    variant="outlined"
                                    onClick={handleAddExtraField}
                                    startIcon={<Add />}
                                    sx={{ mt: 1 }}
                                >
                                    Agregar Campo Extra
                                </Button>
                            </Box>
                        </AccordionDetails>
                    </StyledAccordion>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog}>Cancelar</Button>
                    <Button onClick={handleSave} variant="contained" color="primary" disabled={savingSchool}>
                        {savingSchool ? <CircularProgress size={20} color="inherit" /> : (selectedSchool?.id ? 'Guardar Cambios' : 'Crear Colegio')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={!!cycleMigrationConfirmation?.open}
                onClose={() => !savingSchool && setCycleMigrationConfirmation(null)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Confirmar traslado al nuevo ciclo</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {cycleMigrationConfirmation?.message || 'Ya existe un colegio con este nombre en un ciclo escolar anterior.'}
                    </DialogContentText>
                    <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
                        Si continúas, el colegio anterior quedará archivado y se aplicarán estos cambios operativos:
                    </Alert>
                    <Box component="ul" sx={{ pl: 3, my: 0 }}>
                        <li>{Number(cycleMigrationConfirmation?.impact?.counts?.pilotsToMove || 0)} pilotos se moverán al colegio del ciclo nuevo.</li>
                        <li>{Number(cycleMigrationConfirmation?.impact?.counts?.monitorasToMove || 0)} monitoras se moverán al colegio del ciclo nuevo.</li>
                        <li>{Number(cycleMigrationConfirmation?.impact?.counts?.busesToUnassign || 0)} buses quedarán sin ruta/colegio para poder reasignarlos.</li>
                        <li>{Number(cycleMigrationConfirmation?.impact?.counts?.routeAssignmentsToClear || 0)} asignaciones de ruta del colegio anterior se limpiarán.</li>
                        <li>{Number(cycleMigrationConfirmation?.impact?.counts?.supervisorsToMove || 0)} supervisores apuntarán al colegio del ciclo nuevo.</li>
                        <li>{Number(cycleMigrationConfirmation?.impact?.counts?.auxiliariesToMove || 0)} auxiliares apuntarán al colegio del ciclo nuevo.</li>
                    </Box>
                    <Alert severity="info" sx={{ mt: 2 }}>
                        <strong>Importante:</strong> Solo se está moviendo el colegio asignado a estos usuarios al nuevo ciclo. Las asignaciones de buses (placas, monitoras y pilotos asignados a rutas) <strong>no se transfieren automáticamente</strong> y deberán configurarse nuevamente en el nuevo ciclo.
                    </Alert>
                    {Array.isArray(cycleMigrationConfirmation?.impact?.oldSchools) && cycleMigrationConfirmation.impact.oldSchools.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                            {cycleMigrationConfirmation.impact.oldSchools.map((school) => (
                                <Chip
                                    key={school.id}
                                    label={`${school.name} (${getCicloEscolarOptionLabel(school.cicloEscolar) || 'sin ciclo'})`}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCycleMigrationConfirmation(null)} disabled={savingSchool}>Cancelar</Button>
                    <Button onClick={handleConfirmCycleMigration} variant="contained" color="warning" disabled={savingSchool}>
                        {savingSchool ? <CircularProgress size={20} color="inherit" /> : 'Aceptar y crear'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de formularios de inscripción */}
            <Dialog 
                open={openSubmissionDialog} 
                onClose={handleCloseSubmissionDialog} 
                maxWidth="md" 
                fullWidth
            >
                <DialogTitle>
                    {submissionDetail ? "Detalle del Formulario" : "Formularios de Inscripción"}
                    {selectedSchool && !submissionDetail && (
                        <Typography variant="subtitle2" color="textSecondary">
                            {selectedSchool.name}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent>
                    {submissionDetail ? (
                        <SubmissionPreview submission={submissionDetail} />
                    ) : (
                        <>
                            {submissions.length === 0 ? (
                                <DialogContentText>
                                    No hay formularios de inscripción para este colegio.
                                </DialogContentText>
                            ) : (
                                <Box>
                                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                                        {submissions.length} formularios encontrados:
                                    </Typography>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Fecha y Hora</TableCell>
                                                <TableCell>Nombre</TableCell>
                                                <TableCell>Correo</TableCell>
                                                <TableCell>Acciones</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {submissions.map((sub) => (
                                                <TableRow key={sub.id}>
                                                    <TableCell>
                                                        {new Date(sub.createdAt).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {sub.data.accountFullName || sub.data.fatherName || sub.data.motherName || '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {sub.data.accountEmail || sub.data.fatherEmail || sub.data.motherEmail || '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() => setSubmissionDetail(sub)}
                                                        >
                                                            Ver Detalle
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    {submissionDetail && (
                        <Button onClick={() => setSubmissionDetail(null)}>
                            Volver a la lista
                        </Button>
                    )}
                    <Button onClick={handleCloseSubmissionDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            <EditSchedulesModal
                open={openEditSchedulesModal}
                onClose={handleCloseEditSchedulesModal}
                school={selectedSchool ? { ...selectedSchool, schedules: schoolSchedules, routeSchedules: schoolRouteSchedules } : null}
                onSuccess={handleEditSchedulesSuccess}
                onNotify={(snackbarState) => setSnackbar(snackbarState)}
            />

            {/* Popover para mostrar grados adicionales */}
            <Popover
                id={popoverId}
                open={openPopover}
                anchorEl={anchorEl}
                onClose={handlePopoverClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <Box sx={{ p: 2, maxWidth: 300 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Grados adicionales
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {Array.isArray(popoverGrades) && popoverGrades.map((grade, index) => (
                            <Chip
                                key={index}
                                label={grade?.name || grade || `Grado ${index + 1}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        ))}
                    </Box>
                </Box>
            </Popover>

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

            <SendNotificationModal
                open={openSendNotifModal}
                onClose={() => setOpenSendNotifModal(false)}
                schools={schools}
            />
        </PageContainer>
    );
};

export default CicloEscolarSelectionPage;
