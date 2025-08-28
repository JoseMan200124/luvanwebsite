// src/pages/SchoolsManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    TextField,
    IconButton,
    Tooltip,
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Alert,
    CircularProgress,
    Chip,
    Popover,
    Box,
    Checkbox,
    FormControl,
    FormControlLabel,
    InputLabel,
    Select,
    MenuItem,
    
    DialogContentText,
    useTheme,
    useMediaQuery,
    TableSortLabel
} from '@mui/material';
import {
    Edit,
    Delete,
    Add,
    ContentCopy,
    FileUpload,
    Visibility
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';
import styled from 'styled-components';
// recharts removed from this file (not used here)
import SubmissionPreview from './SubmissionPreview';
// ───────────────────────────────
// Estilos generales
// ───────────────────────────────
const SchoolsContainer = tw.div`
  p-8 bg-gray-100 min-h-screen w-full
`;

/**
 * Función para formatear fecha/hora (para nombres de plantillas, etc.).
 */
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

// ───────────────────────────────
// Estilos para la tabla en desktop (vista tradicional)
// ───────────────────────────────
// ResponsiveTableHead removed (not used) to fix linter warning

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

// ───────────────────────────────
// Estilos para la vista móvil (tarjetas)
// ───────────────────────────────
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

/* =================== Código para ordenamiento =================== */
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

function getFieldValue(school, field) {
    switch (field) {
        case 'name':
            return school.name;
        case 'city':
            return school.city;
        case 'address':
            return school.address;
        case 'contactPerson':
            return school.contactPerson;
        case 'contactPhone':
            return school.contactPhone;
        case 'contactEmail':
            return school.contactEmail;
        case 'studentsCount':
            return school.studentsCount;
        default:
            return '';
    }
}
/* =================== Fin código para ordenamiento =================== */

const SchoolsManagementPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const { auth } = useContext(AuthContext);

    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const [schoolSchedules, setSchoolSchedules] = useState([]);
    const [schoolGrades, setSchoolGrades] = useState([]);
    const [schoolRouteNumbers, setSchoolRouteNumbers] = useState([]);
    const [schoolRouteSchedules, setSchoolRouteSchedules] = useState([]); // [{ routeNumber, schedules: [{code,name,times:["HH:mm" ]}] }]
    const [schoolExtraFields, setSchoolExtraFields] = useState([]);

    const [anchorEl, setAnchorEl] = useState(null);
    const [popoverGrades, setPopoverGrades] = useState([]);

    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    // removed selectedSchoolForSubmissions state (not used elsewhere)
    const [submissions, setSubmissions] = useState([]);

    const [openSubmissionDialog, setOpenSubmissionDialog] = useState(false);
    const [submissionDetail, setSubmissionDetail] = useState(null);

    const downloadFilename = `colegios_template_${getFormattedDateTime()}.xlsx`;

    // =================== Estados para ordenamiento ===================
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('');
    const currentYear = new Date().getFullYear();
    const cycleYears = Array.from(
        { length: currentYear - 2025 + 1 },
        (_, i) => 2025 + i
    );
    const [schoolCycles, setSchoolCycles] = useState({});

    const handleCycleChange = (schoolId, year) => {
        setSchoolCycles(prev => ({ ...prev, [schoolId]: year }));
    };

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    // ───────────────────────────────
    // Función para obtener colegios
    // ───────────────────────────────
    const fetchSchools = async () => {
        setLoading(true);
        try {
            const response = await api.get('/schools', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            let fetchedSchools = Array.isArray(response.data.schools)
                ? response.data.schools
                : [];
            fetchedSchools = fetchedSchools.map((school) => {
                let parsedSchedules = [];
                if (typeof school.schedules === 'string' && school.schedules.trim()) {
                    try {
                        parsedSchedules = JSON.parse(school.schedules);
                    } catch {
                        parsedSchedules = [];
                    }
                } else if (Array.isArray(school.schedules)) {
                    parsedSchedules = school.schedules;
                }
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
                let parsedExtraFields = [];
                if (
                    typeof school.extraEnrollmentFields === 'string' &&
                    school.extraEnrollmentFields.trim()
                ) {
                    try {
                        parsedExtraFields = JSON.parse(school.extraEnrollmentFields);
                    } catch {
                        parsedExtraFields = [];
                    }
                } else if (Array.isArray(school.extraEnrollmentFields)) {
                    parsedExtraFields = school.extraEnrollmentFields;
                }
                let parsedRouteNumbers = [];
                if (typeof school.routeNumbers === 'string' && school.routeNumbers.trim()) {
                    try {
                        parsedRouteNumbers = JSON.parse(school.routeNumbers);
                    } catch {
                        parsedRouteNumbers = [];
                    }
                } else if (Array.isArray(school.routeNumbers)) {
                    parsedRouteNumbers = school.routeNumbers;
                }
                return {
                    ...school,
                    schedules: parsedSchedules,
                    grades: parsedGrades,
                    routeNumbers: parsedRouteNumbers,
                    extraEnrollmentFields: parsedExtraFields,
                    studentsCount: Number(school.studentsCount) || 0
                };

            });
            setSchools(fetchedSchools);
            const initialCycles = fetchedSchools.reduce((acc, sc) => {
                acc[sc.id] = currentYear;
                return acc;
            }, {});
            setSchoolCycles(initialCycles);
            setLoading(false);
        } catch (err) {
            console.error('Error al obtener los colegios:', err);
            setSnackbar({
                open: true,
                message: 'Error al obtener colegios',
                severity: 'error'
            });
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchools();
        // eslint-disable-next-line
    }, [auth.token]);

    // ───────────────────────────────
    // Funciones para agregar/editar colegio
    // ───────────────────────────────
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
            bankAccount: ''
        });
        // Initialize the 4 fixed schedules (AM, MD, PM, EX) with N/A times
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
        setOpenDialog(true);
    };

    const handleEditClick = async (school) => {
        const transportFeeCompleteValue = school.transportFeeComplete ?? '';
        const transportFeeHalfValue = school.transportFeeHalf ?? '';
        const duePaymentDayValue = school.duePaymentDay ?? '';
        const bankNameValue = school.bankName ?? '';
        const bankAccountValue = school.bankAccount ?? '';

        setSelectedSchool({
            ...school,
            whatsappLink: school.whatsappLink || '',
            transportFeeComplete: transportFeeCompleteValue,
            transportFeeHalf: transportFeeHalfValue,
            duePaymentDay: duePaymentDayValue,
            bankName: bankNameValue,
            bankAccount: bankAccountValue
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

        setOpenDialog(true);
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedSchool(null);
        setSchoolSchedules([]);
        setSchoolGrades([]);
    setSchoolExtraFields([]);
    setSchoolRouteNumbers([]);
    setSchoolRouteSchedules([]);
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
                fetchSchools();
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

    const handleInputChange = (e) => {
        setSelectedSchool((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    // ────── Horarios ──────────────────────────────────────────
    // [ADDED] Ahora cada horario tendrá también un "name"
    // Schedules are fixed (AM/MD/PM/EX). Time changes handled in handleTimeChange.

    const handleTimeChange = (e, scheduleIndex, timeIndex) => {
        const { value } = e.target;
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            // Only allow one time entry per schedule. If empty, set to 'N/A'
            clone[scheduleIndex].times = [value ? value : 'N/A'];
            return clone;
        });
    };

    // Helper to ensure schedules array has 4 fixed slots (AM, MD, PM, EX)
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

    // ────── Grados ────────────────────────────────────────────
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

    // Route numbers management (array of strings)
    const handleAddRouteNumber = () => {
        setSchoolRouteNumbers((prev) => {
            const next = [...prev, ''];
            return next;
        });
        // create an empty route schedule entry for new route
    setSchoolRouteSchedules(prev => ([...(Array.isArray(prev) ? prev : []), { routeNumber: '', schedules: [] }]));
    };

    const handleRemoveRouteNumber = (index) => {
        setSchoolRouteNumbers((prev) => {
            const clone = [...prev];
            const removed = clone[index];
            clone.splice(index, 1);
            // also remove corresponding route schedule entry
            setSchoolRouteSchedules(prevRS => (Array.isArray(prevRS) ? prevRS.filter(x => String(x.routeNumber) !== String(removed)) : []));
            return clone;
        });
    };

    const handleChangeRouteNumber = (index, value) => {
        setSchoolRouteNumbers((prev) => {
            const clone = [...prev];
            const oldVal = clone[index];
            clone[index] = value;
            // keep routeSchedules key in sync
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

    // ────── Campos Extra ──────────────────────────────────────
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

        try {
            // Normalize schedules to required shape: 4 entries AM/MD/PM/EX with name 'HORARIO XX' and single time or 'N/A'
                const normalizedSchedules = ensureFourSchedules(schoolSchedules).map(s => ({
                code: s.code,
                name: `HORARIO ${s.code}`,
                times: Array.isArray(s.times) && s.times[0] && s.times[0] !== 'N/A' ? [s.times[0]] : ['N/A']
            }));

            // Build routeSchedules payload aligned to current routeNumbers
            // Build routeSchedules payload aligned to current routeNumbers, now storing full schedule objects
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
                transportFeeComplete:
                    Number(selectedSchool.transportFeeComplete) || 0.0,
                transportFeeHalf:
                    Number(selectedSchool.transportFeeHalf) || 0.0,
                duePaymentDay:
                    Number(selectedSchool.duePaymentDay) || 1,
                extraEnrollmentFields: schoolExtraFields,
                routeNumbers: schoolRouteNumbers,
                routeSchedules: routeSchedulesPayload,
                bankName: selectedSchool.bankName || '',
                bankAccount: selectedSchool.bankAccount || ''
            };

            if (selectedSchool.id) {
                await api.put(`/schools/${selectedSchool.id}`, payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({
                    open: true,
                    message: 'Colegio actualizado exitosamente',
                    severity: 'success'
                });
            } else {
                await api.post('/schools', payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({
                    open: true,
                    message: 'Colegio creado exitosamente',
                    severity: 'success'
                });
            }

            fetchSchools();
            handleDialogClose();
        } catch (err) {
            console.error('Error al guardar el colegio:', err);
            setSnackbar({
                open: true,
                message: 'Error al guardar el colegio',
                severity: 'error'
            });
        }
    };

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleSearchChange = (e) => setSearchQuery(e.target.value);
    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredSchools = schools.filter((sch) =>
        sch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sch.city || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Aplicamos el ordenamiento a la lista filtrada
    const sortedSchools = stableSort(filteredSchools, getComparator(order, orderBy));

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

    const handlePopoverOpen = (event, grades) => {
        setAnchorEl(event.currentTarget);
        setPopoverGrades(grades);
    };
    const handlePopoverClose = () => {
        setAnchorEl(null);
        setPopoverGrades([]);
    };
    const openPopover = Boolean(anchorEl);
    const popoverId = openPopover ? 'grades-popover' : undefined;

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
            const resp = await api.post('/schools/bulk-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            setBulkResults(resp.data);
            fetchSchools();
        } catch (error) {
            console.error('Error al subir colegios masivamente:', error);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al procesar la carga masiva',
                severity: 'error'
            });
        }
        setBulkLoading(false);
    };

    // Función auxiliar para ver formularios de inscripción de un colegio
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

    // Using setSubmissionDetail directly where needed; helper removed to avoid linter warning.
    const handleCloseSubmissionDialog = () => {
        setSubmissionDetail(null);
        setOpenSubmissionDialog(false);
    };

    // Submission stats helpers removed because not used in this component UI path.

    return (
        <SchoolsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Colegios
            </Typography>

            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    gap: '8px'
                }}
            >
                <TextField
                    label="Buscar colegios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: '100%', maxWidth: '300px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                        onClick={handleAddSchool}
                    >
                        Añadir Colegio
                    </Button>
                </div>
            </Box>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {isMobile ? (
                        <>
                            {sortedSchools
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((school) => (
                                    <MobileCard key={school.id} elevation={3}>
                                        <MobileField>
                                            <MobileLabel>Ciclo Escolar</MobileLabel>
                                            <FormControl size="small">
                                                <Select
                                                    value={schoolCycles[school.id]}
                                                    onChange={e => handleCycleChange(school.id, e.target.value)}
                                                >
                                                    {cycleYears.map(y => (
                                                        <MenuItem key={y} value={y}>{y}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Nombre</MobileLabel>
                                            <MobileValue>{school.name}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Total de Alumnos</MobileLabel>
                                            <MobileValue>{school.studentsCount}</MobileValue>
                                        </MobileField>

                                        <MobileField>
                                            <MobileLabel>Ciudad</MobileLabel>
                                            <MobileValue>{school.city}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Dirección</MobileLabel>
                                            <MobileValue>{school.address}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Contacto</MobileLabel>
                                            <MobileValue>{school.contactPerson}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Teléfono</MobileLabel>
                                            <MobileValue>{school.contactPhone}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Email</MobileLabel>
                                            <MobileValue>{school.contactEmail}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Grados</MobileLabel>
                                            <MobileValue>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {school.grades.slice(0, 3).map((grade, index) => (
                                                        <Chip
                                                        key={index}
                                                        label={grade.name}
                                                        size="small"
                                                        color="primary"
                                                        />
                                                    ))}
                                                    {school.grades.length > 3 && (
                                                        <Chip
                                                        label={`+${school.grades.length - 3} más`}
                                                        size="small"
                                                        onClick={(e) =>
                                                            handlePopoverOpen(e, school.grades.slice(3))
                                                        }
                                                        clickable
                                                        color="secondary"
                                                        />
                                                    )}
                                                </Box>
                                            </MobileValue>
                                        </MobileField>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'center',
                                                gap: 1,
                                                marginTop: 1
                                            }}
                                        >
                                            <Tooltip title="Copiar enlace">
                                                <IconButton onClick={() => handleCopyLink(school.id)}>
                                                    <ContentCopy />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Editar">
                                                <IconButton onClick={() => handleEditClick(school)}>
                                                    <Edit />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Eliminar">
                                                <IconButton onClick={() => handleDeleteClick(school.id)}>
                                                    <Delete />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Ver Formularios Llenados">
                                                <IconButton onClick={() => handleViewSubmissions(school)}>
                                                    <Visibility />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </MobileCard>
                                ))}
                            <TablePagination
                                component="div"
                                count={sortedSchools.length}
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
                            <TableContainer
                                sx={{
                                    overflowX: 'auto',
                                    maxHeight: { xs: 400, sm: 'none' },
                                }}
                            >
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
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
                                            <TableCell>
                                                Ciclo Escolar
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'studentsCount' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'studentsCount'}
                                                    direction={orderBy === 'studentsCount' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('studentsCount')}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Alumnos
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'city' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'city'}
                                                    direction={orderBy === 'city' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('city')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Ciudad
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'address' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'address'}
                                                    direction={orderBy === 'address' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('address')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Dirección
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'contactPerson' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'contactPerson'}
                                                    direction={orderBy === 'contactPerson' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('contactPerson')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Contacto
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'contactPhone' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'contactPhone'}
                                                    direction={orderBy === 'contactPhone' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('contactPhone')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Teléfono
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'contactEmail' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'contactEmail'}
                                                    direction={orderBy === 'contactEmail' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('contactEmail')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Email
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Grados</TableCell>
                                            <TableCell align="center">Formulario</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sortedSchools
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((school) => {
                                                const maxVisibleGrades = 3;
                                                const visibleGrades = school.grades.slice(0, maxVisibleGrades);
                                                const remainingGrades = school.grades.length - maxVisibleGrades;
                                                return (
                                                    <TableRow key={school.id}>
                                                        <ResponsiveTableCell data-label="Nombre">{school.name}</ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Ciclo Escolar">
                                                            <FormControl size="small" fullWidth>
                                                                <Select
                                                                    value={schoolCycles[school.id]}
                                                                    onChange={e => handleCycleChange(school.id, e.target.value)}
                                                                >
                                                                    {cycleYears.map(y => (
                                                                        <MenuItem key={y} value={y}>{y}</MenuItem>
                                                                    ))}
                                                                </Select>
                                                            </FormControl>
                                                        </ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Alumnos">
                                                            {school.studentsCount}
                                                        </ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Ciudad">{school.city}</ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Dirección">{school.address}</ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Contacto">{school.contactPerson}</ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Teléfono">{school.contactPhone}</ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Email">{school.contactEmail}</ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Grados">
                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                {visibleGrades.map((grade, index) => (
                                                                    <Chip
                                                                        key={index}
                                                                        label={grade.name}
                                                                        size="small"
                                                                        color="primary"
                                                                    />
                                                                ))}
                                                                {remainingGrades > 0 && (
                                                                    <Chip
                                                                        label={`+${remainingGrades} más`}
                                                                        size="small"
                                                                        onClick={(e) =>
                                                                            handlePopoverOpen(e, school.grades.slice(maxVisibleGrades))
                                                                        }
                                                                        clickable
                                                                        color="secondary"
                                                                    />
                                                                )}
                                                            </Box>
                                                        </ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Formulario" align="center">
                                                            <Tooltip title="Copiar enlace">
                                                                <IconButton onClick={() => handleCopyLink(school.id)}>
                                                                    <ContentCopy />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </ResponsiveTableCell>
                                                        <ResponsiveTableCell data-label="Acciones" align="center">
                                                            <Tooltip title="Editar">
                                                                <IconButton onClick={() => handleEditClick(school)}>
                                                                    <Edit />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Eliminar">
                                                                <IconButton onClick={() => handleDeleteClick(school.id)}>
                                                                    <Delete />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Ver Formularios Llenados">
                                                                <IconButton onClick={() => handleViewSubmissions(school)}>
                                                                    <Visibility />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </ResponsiveTableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        {sortedSchools.length === 0 && (
                                            <TableRow>
                                                <ResponsiveTableCell colSpan={9} align="center">
                                                    No se encontraron colegios.
                                                </ResponsiveTableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={sortedSchools.length}
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

            <Popover
                id={popoverId}
                open={openPopover}
                anchorEl={anchorEl}
                onClose={handlePopoverClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle1">Grados Adicionales:</Typography>
                    {popoverGrades.map((grade, index) => (
                        <Chip
                            key={index}
                            label={grade.name}
                            size="small"
                            color="primary"
                            sx={{ m: 0.5 }}
                        />
                    ))}
                </Box>
            </Popover>

            <Dialog open={openSubmissionDialog} onClose={handleCloseSubmissionDialog} maxWidth="md" fullWidth>
                <DialogTitle>
                    {submissionDetail ? "Detalle del Formulario" : "Formularios Llenados"}
                </DialogTitle>
                <DialogContent>
                    {submissionDetail ? (
                        <SubmissionPreview submission={submissionDetail} />
                    ) : (
                        <>
                            {submissions.length === 0 ? (
                                <DialogContentText>
                                    No hay formularios llenados para este colegio.
                                </DialogContentText>
                            ) : (
                                <Box>
                                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                                        Selecciona un formulario para ver el detalle:
                                    </Typography>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Fecha</TableCell>
                                                <TableCell>Nombre</TableCell>
                                                <TableCell>Correo</TableCell>
                                                <TableCell>Ciclo Escolar</TableCell>
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

            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>{selectedSchool?.id ? 'Editar Colegio' : 'Añadir Colegio'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="name"
                        label="Nombre"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.name : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="city"
                        label="Ciudad"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.city : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="address"
                        label="Dirección"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.address : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactPerson"
                        label="Persona de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPerson : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactPhone"
                        label="Teléfono de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPhone : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="whatsappLink"
                        label="Enlace de WhatsApp"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.whatsappLink : ''}
                        onChange={handleInputChange}
                        placeholder="https://wa.me/123456789?text=Hola"
                    />
                    <TextField
                        margin="dense"
                        name="contactEmail"
                        label="Email de Contacto"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactEmail : ''}
                        onChange={handleInputChange}
                    />

                    <TextField
                        margin="dense"
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
                        margin="dense"
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
                        margin="dense"
                        name="duePaymentDay"
                        label="Día de Pago (1-31)"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.duePaymentDay : ''}
                        onChange={handleInputChange}
                        inputProps={{ min: '1', max: '31' }}
                    />

                    {/* Campos nuevos: Banco y Cuenta */}
                    <TextField
                        margin="dense"
                        name="bankName"
                        label="Banco"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.bankName : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="bankAccount"
                        label="Cuenta Bancaria"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.bankAccount : ''}
                        onChange={handleInputChange}
                    />

                    <Typography variant="h6" style={{ marginTop: '1rem' }}>
                        Horarios
                    </Typography>
                    {schoolSchedules.map((sch, scheduleIndex) => (
                        <Paper key={scheduleIndex} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle1">
                                    {sch.code ? `Horario ${sch.code}` : `Horario #${scheduleIndex + 1}`}
                                </Typography>
                            </div>

                            {/* Nombre fijo: se guarda como 'HORARIO XX' en el backend */}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.3rem', marginTop: '0.5rem' }}>
                                <TextField
                                    label="Hora (HH:mm)"
                                    variant="outlined"
                                    type="time"
                                    value={Array.isArray(sch.times) ? (sch.times[0] === 'N/A' ? '' : sch.times[0]) : ''}
                                    onChange={(e) => handleTimeChange(e, scheduleIndex, 0)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </div>
                        </Paper>
                    ))}

                    <Typography variant="h6" style={{ marginTop: '2rem' }}>
                        Grados del Colegio
                    </Typography>
                    {schoolGrades.map((grade, gradeIndex) => (
                        <Paper key={gradeIndex} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle1">
                                    Grado #{gradeIndex + 1}
                                </Typography>
                                <IconButton
                                    onClick={() => handleRemoveGrade(gradeIndex)}
                                    color="error"
                                    size="small"
                                >
                                    <Delete />
                                </IconButton>
                            </div>
                            <TextField
                                margin="dense"
                                name="name"
                                label="Nombre del Grado"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={grade.name}
                                onChange={(e) => handleGradeChange(e, gradeIndex)}
                            />
                        </Paper>
                    ))}
                    <Button
                        variant="outlined"
                        style={{ marginTop: '1rem' }}
                        onClick={handleAddGrade}
                        startIcon={<Add />}
                    >
                        Agregar Grado
                    </Button>

                    <Typography variant="h6" style={{ marginTop: '2rem' }}>
                        Números de Ruta del Colegio
                    </Typography>
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
                            <Paper key={idx} style={{ padding: '0.75rem', marginTop: '0.5rem' }}>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
                                {/* Checkbox group for assigning school schedules to this route */}
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
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
                    <Button variant="outlined" style={{ marginTop: '0.75rem' }} onClick={handleAddRouteNumber} startIcon={<Add />}>
                        Agregar Número de Ruta
                    </Button>

                    {/* Removed separate route schedules free-form times; schedules are assigned via checkboxes above */}

                    <Typography variant="h6" style={{ marginTop: '2rem' }}>
                        Campos Extra de Inscripción
                    </Typography>
                    {schoolExtraFields.map((field, idx) => (
                        <Paper key={idx} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            </div>
                            <TextField
                                margin="dense"
                                label="Nombre del Campo"
                                type="text"
                                fullWidth
                                value={field.fieldName || ''}
                                onChange={(e) => handleChangeExtraField(idx, 'fieldName', e.target.value)}
                            />
                            <FormControl fullWidth margin="dense">
                                <InputLabel>Tipo</InputLabel>
                                <Select
                                    value={field.type || 'text'}
                                    onChange={(e) => handleChangeExtraField(idx, 'type', e.target.value)}
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
                        </Paper>
                    ))}
                    <Button
                        variant="outlined"
                        style={{ marginTop: '1rem' }}
                        onClick={handleAddExtraField}
                        startIcon={<Add />}
                    >
                        Agregar Campo Extra
                    </Button>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} color="primary" variant="contained">
                        {selectedSchool?.id ? 'Guardar Cambios' : 'Crear Colegio'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Colegios</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Sube un archivo Excel/CSV con las columnas necesarias.
                        <br />
                        Para <em>Horarios</em> puedes escribir algo como: <br />
                        <code>Lunes=08:00,09:00;Martes=07:00,09:30</code> <br />
                        Para <em>Grados</em>: <br />
                        <code>Kinder,Primero,Segundo</code>
                    </Typography>
                    <Button
                        variant="outlined"
                        color="success"
                        href="/plantillas/plantilla_colegios.xlsx"
                        download={downloadFilename}
                        sx={{ mr: 2 }}
                    >
                        Descargar Plantilla
                    </Button>
                    <Button variant="outlined" component="label" startIcon={<FileUpload />}>
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

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </SchoolsContainer>
    );
};

export default SchoolsManagementPage;
