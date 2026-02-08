// src/pages/SchoolYearSelectionPage.jsx

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
    DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import SubmissionPreview from './SubmissionPreview';
import ExcelJS from 'exceljs';
import moment from 'moment';
import PermissionGuard from '../components/PermissionGuard';

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

const SchoolYearSelectionPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();

    const [schools, setSchools] = useState([]);
    const [selectedSchoolYear, setSelectedSchoolYear] = useState('2025');
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Estados para diálogos y acciones
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openSubmissionDialog, setOpenSubmissionDialog] = useState(false);
    const [submissions, setSubmissions] = useState([]);
    const [submissionDetail, setSubmissionDetail] = useState(null);
    // Bulk upload states
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    
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

    // Por ahora solo tenemos el ciclo escolar 2025, pero preparamos para futuras expansiones
    const schoolYears = [
        { id: '2025', name: 'Ciclo Escolar 2025' },
        // Aquí se pueden agregar más ciclos escolares en el futuro
    ];

    // Helper para asegurar que los horarios tengan 4 slots fijos (AM, MD, PM, EX)
    const ensureFourSchedules = (schedules) => {
        const codes = ['AM', 'MD', 'PM', 'EX'];
        const result = codes.map((code) => ({ code, name: `HORARIO ${code}`, times: ['N/A'] }));

        if (!Array.isArray(schedules)) return result;

        // Try to fill by code (if schedule.name contains the code) or by index
        schedules.forEach((s) => {
            if (!s) return;
            // Determine code from name if possible
            const name = (s.name || '').toString().toUpperCase();
            let matched = null;
            ['AM', 'MD', 'PM', 'EX'].forEach((c) => {
                if (name.includes(c)) matched = c;
            });
            if (matched) {
                const idx = codes.indexOf(matched);
                if (idx !== -1) {
                    result[idx].times = Array.isArray(s.times) && s.times.length > 0 ? [s.times[0]] : ['N/A'];
                }
            }
        });

        // If none matched by name, try to map by order
        const anyMatched = result.some((r, i) => r.times[0] !== 'N/A');
        if (!anyMatched) {
            schedules.forEach((s, i) => {
                if (i < 4) {
                    result[i].times = Array.isArray(s.times) && s.times.length > 0 ? [s.times[0]] : ['N/A'];
                }
            });
        }

        return result;
    };

    const fetchSchoolsByYear = useCallback(async () => {
        setLoading(true);
        try {
            const params = { schoolYear: selectedSchoolYear };
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
    }, [auth.token, selectedSchoolYear]);

    useEffect(() => {
        if (auth.token && selectedSchoolYear) {
            fetchSchoolsByYear();
        }
    }, [auth.token, selectedSchoolYear, fetchSchoolsByYear]);

    const handleSchoolYearChange = (event) => {
        setSelectedSchoolYear(event.target.value);
    };

    const handleSchoolSelect = (school) => {
        navigate(`/admin/escuelas/${selectedSchoolYear}/${school.id}`, {
            state: {
                schoolYear: selectedSchoolYear,
                school: school
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
        // Normalize to 4 fixed schedules
        const normalized = ensureFourSchedules(parsedSchedules);
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

        // Load routeSchedules from backend detail
        try {
            const detail = await api.get(`/schools/${school.id}`);
            const rs = (detail.data && detail.data.school && Array.isArray(detail.data.school.routeSchedules)) ? detail.data.school.routeSchedules : [];
            // Normalize backend entries to the new shape with schedules[]
            const normalizeEntry = (x) => {
                if (!x) return { routeNumber: '', schedules: [] };
                if (Array.isArray(x.schedules)) {
                    // Ensure each schedule has {code,name,times[0]}
                    const cleaned = x.schedules.map(s => ({
                        code: s && s.code ? s.code : null,
                        name: s && s.name ? s.name : (s && s.code ? `HORARIO ${s.code}` : 'HORARIO'),
                        times: Array.isArray(s && s.times) && s.times[0] ? [String(s.times[0])] : []
                    }));
                    return { routeNumber: String(x.routeNumber), schedules: cleaned };
                }
                // Legacy times[] -> map to school schedules by matching times
                const times = Array.isArray(x.times) ? x.times.filter(Boolean).map(String) : [];
                const schedulesForTimes = times.map(t => {
                    // Try to find a school schedule that has this time to derive code/name
                    const sch = (schoolSchedules || []).find(ss => Array.isArray(ss.times) && ss.times.includes(t));
                    return {
                        code: sch ? sch.code : null,
                        name: sch ? sch.name : 'HORARIO',
                        times: [t]
                    };
                });
                return { routeNumber: String(x.routeNumber), schedules: schedulesForTimes };
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
        } catch (e) {
            setSchoolRouteSchedules((parsedRouteNumbers || []).map(rn => ({ routeNumber: String(rn), schedules: [] })));
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
        setOpenBulkDialog(true);
    };
    const handleCloseBulkDialog = () => {
        setOpenBulkDialog(false);
    };
    const handleFileChange = (e) => {
        const file = e.target.files && e.target.files[0];
        setBulkFile(file || null);
    };
    const handleUploadBulk = async () => {
        if (!bulkFile) return;
        setBulkLoading(true);
        setBulkResults(null);
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            const resp = await api.post('/schools/bulk-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${auth.token}`
                }
            });
            setBulkResults(resp.data || null);
            // Refresh list after upload
            fetchSchoolsByYear();
            setSnackbar({ open: true, message: 'Carga masiva procesada', severity: 'success' });
        } catch (err) {
            console.error('Error al subir colegios masivamente:', err);
            setSnackbar({ open: true, message: 'Error al procesar la carga masiva', severity: 'error' });
        } finally {
            setBulkLoading(false);
        }
    };

    // Add school handler (reuse existing edit dialog)
    const handleAddSchool = () => {
        setSelectedSchool({
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
        setSchoolSchedules([
            { code: 'AM', name: 'HORARIO AM', times: ['N/A'] },
            { code: 'MD', name: 'HORARIO MD', times: ['N/A'] },
            { code: 'PM', name: 'HORARIO PM', times: ['N/A'] },
            { code: 'EX', name: 'HORARIO EX', times: ['N/A'] }
        ]);
        setSchoolGrades([]);
        setSchoolExtraFields([]);
        setSchoolRouteNumbers([]);
        setSchoolRouteSchedules([]);
        setSchoolYearStart('');
        setSchoolYearEnd('');
        setOpenEditDialog(true);
    };

    const handleCloseEditDialog = () => {
        setOpenEditDialog(false);
        setSelectedSchool(null);
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

        try {
            // Normalize schedules to required shape: 4 entries AM/MD/PM/EX with name 'HORARIO XX' and single time or 'N/A'
            const normalizedSchedules = ensureFourSchedules(schoolSchedules).map(s => ({
                code: s.code,
                name: `HORARIO ${s.code}`,
                times: Array.isArray(s.times) && s.times[0] && s.times[0] !== 'N/A' ? [s.times[0]] : ['N/A']
            }));

            // Build routeSchedules payload aligned to current routeNumbers
            const routeSchedulesPayload = (schoolRouteNumbers || []).map(rn => {
                const entry = (schoolRouteSchedules || []).find(x => String(x.routeNumber) === String(rn));
                const schedules = Array.isArray(entry && entry.schedules) ? entry.schedules : [];
                // Clean schedules: ensure unique by code (AM/MD/PM/EX), keep only first time if present
                const byCode = new Map();
                (schedules || []).forEach(s => {
                    if (!s) return;
                    const code = s.code || (s.name && s.name.includes('AM') ? 'AM' : s.name && s.name.includes('MD') ? 'MD' : s.name && s.name.includes('PM') ? 'PM' : s.name && s.name.includes('EX') ? 'EX' : null);
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
                // Add school year for new schools
                schoolYear: selectedSchoolYear
            };

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
                await api.post('/schools', payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                
                setSnackbar({
                    open: true,
                    message: 'Colegio creado exitosamente',
                    severity: 'success'
                });
            }

            fetchSchoolsByYear(); // Recargar la lista
            handleCloseEditDialog();
        } catch (err) {
            console.error('Error al guardar el colegio:', err);
            setSnackbar({
                open: true,
                message: 'Error al guardar el colegio',
                severity: 'error'
            });
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
                schoolYear: selectedSchoolYear,
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CalendarToday sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Gestión de Transportes Escolares
                            </Typography>
                            <Typography variant="h6" sx={{ opacity: 0.9 }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <FormControl fullWidth variant="outlined" sx={{ maxWidth: 300 }}>
                                <InputLabel>Seleccionar Ciclo Escolar</InputLabel>
                                <Select
                                    value={selectedSchoolYear}
                                    onChange={handleSchoolYearChange}
                                    label="Seleccionar Ciclo Escolar"
                                >
                                    {schoolYears.map((year) => (
                                        <MenuItem key={year.id} value={year.id}>
                                            {year.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <PermissionGuard permission="colegios-crear">
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={handleOpenBulkUpload}
                                    >
                                        Carga Masiva
                                    </Button>
                                </PermissionGuard>
                                <PermissionGuard permission="colegios-crear">
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleAddSchool}
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
                        Las fechas de Inicio Ciclo / Fin Ciclo deben ir en formato <code>dd-mm-aaaa</code> (ej. <code>01-03-2025</code>).
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
                                    { header: 'Horario AM', key: 'scheduleAM', width: 14, style: { numFmt: '@' } },
                                    { header: 'Horario MD', key: 'scheduleMD', width: 14, style: { numFmt: '@' } },
                                    { header: 'Horario PM', key: 'schedulePM', width: 14, style: { numFmt: '@' } },
                                    { header: 'Horario EX', key: 'scheduleEX', width: 14, style: { numFmt: '@' } },
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

                                // Example row to guide users
                                worksheet.addRow({
                                    name: 'Colegio Ejemplo',
                                    address: 'Calle 123',
                                    city: 'Ciudad',
                                    contactPerson: 'Nombre',
                                    contactEmail: 'contacto@colegio.com',
                                    contactPhone: '12345678',
                                    whatsapp: '',
                                    scheduleAM: '07:00',
                                    scheduleMD: '12:00',
                                    schedulePM: '13:00',
                                    scheduleEX: '15:00',
                                    grades: 'Kinder,1ero,2do',
                                    transportFeeComplete: 0.00,
                                    transportFeeHalf: 0.00,
                                    duePaymentDay: 1,
                                    bankName: '',
                                    bankAccount: '',
                                    routeNumbers: '12,15',
                                    dailyPenalty: 10.00,
                                    schoolYearStart: '01-03-2025',
                                    schoolYearEnd: '28-02-2026'
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
                    {bulkResults && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="info">
                                <Typography>
                                    <strong>Colegios creados/actualizados:</strong> {bulkResults.successCount}
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
                    <Button
                        onClick={handleUploadBulk}
                        variant="contained"
                        color="primary"
                        disabled={!bulkFile || bulkLoading}
                    >
                        Subir
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Lista de Colegios */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                        Colegios - {schoolYears.find(y => y.id === selectedSchoolYear)?.name}
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
                                                <Tooltip title="Copiar enlace de inscripción">
                                                    <IconButton 
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyLink(school.id);
                                                        }}
                                                    >
                                                        <ContentCopy fontSize="small" />
                                                    </IconButton>
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
                                        label="Inicio Ciclo Escolar"
                                        type="date"
                                        fullWidth
                                        variant="outlined"
                                        value={schoolYearStart || ''}
                                        onChange={(e) => setSchoolYearStart(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                    <TextField
                                        label="Fin Ciclo Escolar"
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
                                            schoolYear: selectedSchoolYear,
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
                                {schoolSchedules.map((sch, scheduleIndex) => (
                                    <Paper key={scheduleIndex} sx={{ p: 2 }}>
                                        <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                            {sch.code ? `Horario ${sch.code}` : `Horario #${scheduleIndex + 1}`}
                                        </Typography>
                                        <TextField
                                            label="Hora (HH:mm)"
                                            variant="outlined"
                                            type="time"
                                            value={Array.isArray(sch.times) ? (sch.times[0] === 'N/A' ? '' : sch.times[0]) : ''}
                                            onChange={(e) => handleTimeChange(e, scheduleIndex, 0)}
                                            InputLabelProps={{ shrink: true }}
                                            fullWidth
                                        />
                                    </Paper>
                                ))}
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
                    <Button onClick={handleSave} variant="contained" color="primary">
                        {selectedSchool?.id ? 'Guardar Cambios' : 'Crear Colegio'}
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
        </PageContainer>
    );
};

export default SchoolYearSelectionPage;
