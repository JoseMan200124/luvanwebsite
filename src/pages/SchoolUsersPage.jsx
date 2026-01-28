// src/pages/SchoolUsersPage.jsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
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
    GetApp,
    ToggleOn,
    ToggleOff
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import StudentScheduleModal from '../components/modals/StudentScheduleModal';
import CircularMasivaModal from '../components/CircularMasivaModal';
import BulkScheduleModal from '../components/modals/BulkScheduleModal';

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
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedUser, setSelectedUser] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Nuevos estados para funcionalidades
    
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [openBulkScheduleDialog, setOpenBulkScheduleDialog] = useState(false);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
    const [openActivateConfirm, setOpenActivateConfirm] = useState(false);
    const [openSuspendConfirm, setOpenSuspendConfirm] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [activateLoading, setActivateLoading] = useState(false);
    const [suspendLoading, setSuspendLoading] = useState(false);
    const [openCircularModal, setOpenCircularModal] = useState(false);
    const [openStudentScheduleModal, setOpenStudentScheduleModal] = useState(false);
    const [openSendContractDialog, setOpenSendContractDialog] = useState(false);
    const [openSchoolSelectDialog, setOpenSchoolSelectDialog] = useState(false);
    
    // Estados para diferentes operaciones
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [downloadMode, setDownloadMode] = useState('');
    const [scheduleModalStudents, setScheduleModalStudents] = useState([]);
    const [routeReportLoading, setRouteReportLoading] = useState(false);
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
        zoneOrSector: '',
        routeType: '',
        emergencyContact: '',
        emergencyRelationship: '',
        emergencyPhone: '',
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

    // Generar y descargar archivo Excel con los padres NUEVOS del colegio gestionado
    const handleDownloadNewParents = async (schoolIdParam) => {
        const schoolIdToUse = schoolIdParam || schoolId || currentSchool?.id;
        if (!schoolIdToUse) {
            setSnackbar({ open: true, message: 'Por favor selecciona un colegio.', severity: 'warning' });
            return;
        }

        try {
            setRouteReportLoading(true);

            // Obtener padres (usar state si contiene datos para este colegio)
            let parents = [];
            if (Array.isArray(users) && users.length > 0) {
                const matched = users.filter(u => String(u.school) === String(schoolIdToUse));
                if (matched.length > 0) parents = matched.slice();
            }
            if (parents.length === 0) {
                const resp = await api.get('/users/parents', { params: { schoolId: schoolIdToUse } });
                parents = resp.data.users || [];
            }

            // Filtrar sólo los nuevos según isUserNew
            const newParents = parents.filter(u => isUserNew(u));

            // Si no hay nuevos, avisar
            if (!newParents || newParents.length === 0) {
                setSnackbar({ open: true, message: 'No hay usuarios nuevos para descargar.', severity: 'info' });
                return;
            }

            // Determinar máximo de hijos entre las familias nuevas
            let maxStudents = 0;
            newParents.forEach(u => {
                const fd = u.FamilyDetail || {};
                const cnt = Array.isArray(fd.Students) ? fd.Students.length : 0;
                if (cnt > maxStudents) maxStudents = cnt;
            });

            // Construir workbook con ExcelJS
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Padres Nuevos');

            // Encabezados básicos (Apellido Familia primero)
            const baseHeaders = [
                { header: 'Apellido Familia', key: 'apellidoFamilia' },
                { header: 'Nombre', key: 'nombre' },
                { header: 'Email', key: 'email' },
                { header: 'Nombre Madre', key: 'madreNombre' },
                { header: 'Celular Madre', key: 'madreCelular' },
                { header: 'Email Madre', key: 'madreEmail' },
                { header: 'Nombre Padre', key: 'padreNombre' },
                { header: 'Celular Padre', key: 'padreCelular' },
                { header: 'Email Padre', key: 'padreEmail' },
                { header: 'Dirección Principal', key: 'direccionPrincipal' },
                { header: 'Dirección Alterna', key: 'direccionAlterna' },
                { header: 'Zona/Sector', key: 'zonaSector' },
                { header: 'Tipo Ruta', key: 'tipoRuta' },
                { header: 'Contacto Emergencia', key: 'emergenciaContacto' },
                { header: 'Parentesco Emergencia', key: 'emergenciaParentesco' },
                { header: 'Teléfono Emergencia', key: 'emergenciaTelefono' }
            ];

            const studentCols = [];
            for (let i = 1; i <= maxStudents; i++) {
                studentCols.push({ header: `Estudiante ${i} - Nombre`, key: `est_${i}_nombre` });
                studentCols.push({ header: `Estudiante ${i} - Grado`, key: `est_${i}_grado` });
            }

            const finalColumns = baseHeaders.concat(studentCols);
            sheet.columns = finalColumns.map(col => ({ header: col.header, key: col.key, width: Math.min(Math.max(col.header.length + 6, 12), 40) }));
            
            // Formato
            sheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            sheet.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return;
                const isEven = rowIndex % 2 === 0;
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                    cell.alignment = { vertical: 'middle' };
                });
            });

            sheet.columns.forEach((col) => {
                const key = col.key;
                if (key === 'madreCelular' || key === 'padreCelular' || key === 'tipoRuta') {
                    col.alignment = { horizontal: 'center', vertical: 'middle' };
                }
                if (key && key.startsWith('est_') && key.endsWith('_grado')) {
                    col.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            });

            sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.getRow(1).cellCount).letter}1` };
            sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

            // Populate rows for each new parent
            newParents.forEach((u, idx) => {
                const fd = u.FamilyDetail || {};
                const row = [];
                row.push(fd.familyLastName || '');
                row.push(u.name || '');
                row.push(u.email || '');
                row.push(fd.motherName || '');
                row.push(fd.motherCellphone || '');
                row.push(fd.motherEmail || '');
                row.push(fd.fatherName || '');
                row.push(fd.fatherCellphone || '');
                row.push(fd.fatherEmail || '');
                row.push(fd.mainAddress || '');
                row.push(fd.alternativeAddress || '');
                row.push(fd.zoneOrSector || '');
                row.push(fd.routeType || '');
                row.push(fd.emergencyContact || '');
                row.push(fd.emergencyRelationship || '');
                row.push(fd.emergencyPhone || '');

                for (let i = 0; i < maxStudents; i++) {
                    const student = Array.isArray(fd.Students) && fd.Students[i] ? fd.Students[i] : null;
                    row.push(student ? (student.fullName || '') : '');
                    row.push(student ? (student.grade || '') : '');
                }

                const added = sheet.addRow(row);
                // Apply simple styling per row (alternating background)
                const isEven = (idx + 1) % 2 === 0;
                added.eachCell((cell, colNumber) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                    // Default vertical middle
                    cell.alignment = { vertical: 'middle' };
                    // Column header text
                    const headerText = (sheet.getRow(1).getCell(colNumber).value || '').toString().toLowerCase();
                    if (headerText.includes('celular') || headerText.includes('tipo ruta') || headerText.includes('grado')) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const selectedSchool = schools.find(s => s.id === parseInt(schoolIdToUse));
            const schoolName = selectedSchool ? selectedSchool.name : 'Colegio';
            const fileName = `padres_nuevos_${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_${getFormattedDateTime()}.xlsx`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSnackbar({ open: true, message: `Archivo con padres nuevos de ${schoolName} descargado.`, severity: 'success' });
        } catch (error) {
            console.error('[handleDownloadNewParents] Error:', error);
            setSnackbar({ open: true, message: 'Error al generar el archivo de padres nuevos', severity: 'error' });
        } finally {
            setRouteReportLoading(false);
        }
    };

    const handleDownloadRouteReport = async (schoolIdParam) => {
        const schoolIdToUse = schoolIdParam || schoolId || currentSchool?.id;
        if (!schoolIdToUse) {
            setSnackbar({ open: true, message: 'Por favor selecciona un colegio.', severity: 'warning' });
            return;
        }

        setRouteReportLoading(true);
        try {
            // Fetch all users in pages like the original implementation
            let allUsers = [];
            let p = 0;
            const limit = 500;
            let total = 0;
            let fetched = 0;

            const firstResp = await api.get('/users', { params: { page: p, limit } });
            allUsers = firstResp.data.users || [];
            total = firstResp.data.total || allUsers.length;
            fetched = allUsers.length;

            while (fetched < total) {
                p += 1;
                const resp = await api.get('/users', { params: { page: p, limit } });
                const usersBatch = resp.data.users || [];
                allUsers = allUsers.concat(usersBatch);
                fetched += usersBatch.length;
                if (usersBatch.length === 0) break;
            }

            const parentsWithRoutes = allUsers.filter(u =>
                u.Role && (u.Role.name === 'Padre' || (u.Role.name || '').toString().toLowerCase() === 'padre') &&
                u.FamilyDetail &&
                u.school && parseInt(u.school) === parseInt(schoolIdToUse) &&
                (
                    (Array.isArray(u.FamilyDetail.ScheduleSlots) && u.FamilyDetail.ScheduleSlots.length > 0) ||
                    (Array.isArray(u.FamilyDetail.Students) && u.FamilyDetail.Students.some(s => Array.isArray(s.ScheduleSlots) && s.ScheduleSlots.length > 0))
                )
            );

            // Build route summary like original
            const routeSummary = {};
            parentsWithRoutes.forEach(user => {
                const fd = user.FamilyDetail || {};
                if (!fd.Students || fd.Students.length === 0) return;
                fd.Students.forEach(student => {
                    const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                    const familySlots = Array.isArray(fd.ScheduleSlots) ? fd.ScheduleSlots.filter(s => !s.studentId || Number(s.studentId) === Number(student.id)) : [];
                    const slotsToUse = studentSlots.length > 0 ? studentSlots : familySlots;
                    const studentRoutePeriodSet = new Set();
                    slotsToUse.forEach(slot => {
                        let routeNumber = '';
                        if (slot && slot.routeNumber != null && String(slot.routeNumber).trim() !== '') {
                            routeNumber = String(slot.routeNumber);
                        }
                        if (!routeNumber) routeNumber = 'Sin Ruta';
                        const period = (function(slot){
                            const ss = (slot.schoolSchedule ?? '').toString();
                            const mSS = ss.match(/\b(AM|MD|PM|EX)\b/i);
                            if (mSS && mSS[1]) return mSS[1].toUpperCase();
                            const t = (slot.time ?? slot.timeSlot ?? '').toString();
                            const mT = t.match(/\b(AM|MD|PM|EX)\b/i);
                            if (mT && mT[1]) return mT[1].toUpperCase();
                            return null;
                        })(slot);
                        if (!period) return;
                        studentRoutePeriodSet.add(`${routeNumber}::${period}`);
                    });
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

            // Determine max students
            let maxStudents = 0;
            parentsWithRoutes.forEach(user => {
                const fd = user.FamilyDetail || {};
                if (!fd.Students || fd.Students.length === 0) return;
                const hasStudentWithRoute = fd.Students.some(student => {
                    const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                    if (studentSlots.length > 0) return studentSlots.some(slot => /(.+):(.+)/.test((slot.schoolSchedule || slot.time || slot.timeSlot || '').toString()));
                    if (Array.isArray(fd.ScheduleSlots) && fd.ScheduleSlots.length > 0) return fd.ScheduleSlots.some(slot => /(.+):(.+)/.test((slot.schoolSchedule || slot.time || slot.timeSlot || '').toString()));
                    return false;
                });
                if (hasStudentWithRoute && fd.Students.length > maxStudents) maxStudents = fd.Students.length;
            });

            // familiesWithRoutes: filter parents that have at least one student with schedule slots
            const familiesWithRoutes = parentsWithRoutes.filter(user => {
                const fd = user.FamilyDetail || {};
                if (!fd.Students || fd.Students.length === 0) return false;
                if (Array.isArray(fd.ScheduleSlots) && fd.ScheduleSlots.length > 0) {
                    if (fd.ScheduleSlots.some(slot => /(.+):(.+)/.test((slot.schoolSchedule || slot.time || slot.timeSlot || '').toString()))) return true;
                }
                return fd.Students.some(student => {
                    const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                    return studentSlots.some(slot => /(.+):(.+)/.test((slot.schoolSchedule || slot.time || slot.timeSlot || '').toString()));
                });
            });

            const workbook = new ExcelJS.Workbook();
            // Weekday map and contact columns used by per-day sheets
            const weekdaysMap = [ { key: 'monday', label: 'Lunes' }, { key: 'tuesday', label: 'Martes' }, { key: 'wednesday', label: 'Miércoles' }, { key: 'thursday', label: 'Jueves' }, { key: 'friday', label: 'Viernes' } ];
            const contactCols = ['Nombre Padre', 'Email Padre', 'Nombre Mamá', 'Teléfono Mamá', 'Nombre Papá', 'Teléfono Papá'];

            // Create a worksheet per weekday with per-student schedule columns for that day
            weekdaysMap.forEach((day) => {
                const sheet = workbook.addWorksheet(day.label);
                const headers = ["Apellido Familia", "Tipo Ruta", "Dirección Principal", "Dirección Alterna"];
                for (let i = 1; i <= maxStudents; i++) {
                    headers.push(`Estudiante ${i} - Nombre`);
                    headers.push(`Estudiante ${i} - Grado`);
                    headers.push(`Estudiante ${i} - Hora AM`);
                    headers.push(`Estudiante ${i} - Ruta AM`);
                    headers.push(`Estudiante ${i} - Nota Parada AM`);
                    headers.push(`Estudiante ${i} - Hora MD`);
                    headers.push(`Estudiante ${i} - Ruta MD`);
                    headers.push(`Estudiante ${i} - Nota Parada MD`);
                    headers.push(`Estudiante ${i} - Hora PM`);
                    headers.push(`Estudiante ${i} - Ruta PM`);
                    headers.push(`Estudiante ${i} - Nota Parada PM`);
                    headers.push(`Estudiante ${i} - Hora EX`);
                    headers.push(`Estudiante ${i} - Ruta EX`);
                    headers.push(`Estudiante ${i} - Nota Parada EX`);
                }
                headers.push(...contactCols);

                const headerRow = sheet.addRow(headers);
                headerRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }; cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });

                familiesWithRoutes.forEach((user, familyIndex) => {
                    const fd = user.FamilyDetail || {};
                    const row = [];
                    row.push(fd.familyLastName || '');
                    row.push(fd.routeType || '');
                    row.push(fd.mainAddress || '');
                    row.push(fd.alternativeAddress || '');
                    for (let i = 0; i < maxStudents; i++) {
                        const student = (fd.Students && fd.Students[i]) ? fd.Students[i] : null;
                        row.push(student ? (student.fullName || '') : '');
                        row.push(student ? (student.grade || '') : '');

                        // prepare day-specific defaults
                        const defaultPer = { horaAM: '', rutaAM: '', paradaAM: '', horaMD: '', rutaMD: '', paradaMD: '', horaPM: '', rutaPM: '', paradaPM: '', horaEX: '', rutaEX: '', paradaEX: '' };
                        let dataForDay = { ...defaultPer };

                        if (student) {
                            const studentSlots = Array.isArray(student.ScheduleSlots) ? student.ScheduleSlots : [];
                            const familySlots = Array.isArray(fd.ScheduleSlots) ? fd.ScheduleSlots.filter(s => !s.studentId || Number(s.studentId) === Number(student.id)) : [];
                            const slotsToUse = studentSlots.length > 0 ? studentSlots : familySlots;
                            slotsToUse.forEach(slot => {
                                let slotDays = [];
                                if (Array.isArray(slot.days)) slotDays = slot.days;
                                else if (typeof slot.days === 'string') {
                                    try { const parsed = JSON.parse(slot.days); if (Array.isArray(parsed)) slotDays = parsed; else slotDays = [slot.days]; } catch (e) { slotDays = slot.days.split ? slot.days.split(',').map(x => x.trim()) : [slot.days]; }
                                } else if (slot.days) slotDays = [slot.days];
                                const normalizedDays = slotDays.map(d => d ? d.toString().toLowerCase() : '').filter(Boolean);
                                if (!normalizedDays.includes(day.key)) return;
                                const displayTime = (slot.time || slot.schoolSchedule || slot.timeSlot || '').toString();
                                const note = slot.note || '';
                                let routeLabel = '';
                                if (slot && slot.routeNumber != null && String(slot.routeNumber).trim() !== '') routeLabel = String(slot.routeNumber);
                                const ss = (slot.schoolSchedule ?? '').toString();
                                const mSS = ss.match(/\b(AM|MD|PM|EX)\b/i);
                                const period = mSS && mSS[1] ? mSS[1].toUpperCase() : ( (slot.time||slot.timeSlot||'').toString().match(/\b(AM|MD|PM|EX)\b/i)?.[1] ?? null );
                                if (!period) return;
                                if (period === 'AM') { if (!dataForDay.horaAM) dataForDay.horaAM = displayTime; if (!dataForDay.rutaAM) dataForDay.rutaAM = routeLabel; if (!dataForDay.paradaAM) dataForDay.paradaAM = note; }
                                else if (period === 'MD') { if (!dataForDay.horaMD) dataForDay.horaMD = displayTime; if (!dataForDay.rutaMD) dataForDay.rutaMD = routeLabel; if (!dataForDay.paradaMD) dataForDay.paradaMD = note; }
                                else if (period === 'PM') { if (!dataForDay.horaPM) dataForDay.horaPM = displayTime; if (!dataForDay.rutaPM) dataForDay.rutaPM = routeLabel; if (!dataForDay.paradaPM) dataForDay.paradaPM = note; }
                                else if (period === 'EX') { if (!dataForDay.horaEX) dataForDay.horaEX = displayTime; if (!dataForDay.rutaEX) dataForDay.rutaEX = routeLabel; if (!dataForDay.paradaEX) dataForDay.paradaEX = note; }
                            });
                        }

                        // push per-period fields for this day
                        const parseRouteNumber = (r) => {
                            if (r == null) return null;
                            const s = String(r).trim();
                            if (s === '') return null;
                            // Try integer first, then float
                            const n = Number(s);
                            return Number.isFinite(n) ? n : null;
                        };

                        row.push(dataForDay.horaAM);
                        row.push(parseRouteNumber(dataForDay.rutaAM));
                        row.push(dataForDay.paradaAM);

                        row.push(dataForDay.horaMD);
                        row.push(parseRouteNumber(dataForDay.rutaMD));
                        row.push(dataForDay.paradaMD);

                        row.push(dataForDay.horaPM);
                        row.push(parseRouteNumber(dataForDay.rutaPM));
                        row.push(dataForDay.paradaPM);

                        row.push(dataForDay.horaEX);
                        row.push(parseRouteNumber(dataForDay.rutaEX));
                        row.push(dataForDay.paradaEX);
                    }

                    const motherName = (fd.motherName && fd.motherName.trim()) || '';
                    const motherPhone = (fd.motherCellphone && fd.motherCellphone.trim()) || '';
                    const fatherName = (fd.fatherName && fd.fatherName.trim()) || '';
                    const fatherPhone = (fd.fatherCellphone && fd.fatherCellphone.trim()) || '';
                    row.push(user.name || '');
                    row.push(user.email || '');
                    row.push(motherName);
                    row.push(motherPhone);
                    row.push(fatherName);
                    row.push(fatherPhone);

                    const rowObj = sheet.addRow(row);
                    const isEven = (familyIndex + 1) % 2 === 0;
                    rowObj.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } }; });
                });

                // Auto-size per-day sheet columns
                sheet.columns.forEach((column, index) => {
                    const header = headers[index];
                    let maxWidth = header ? header.length : 10;
                    sheet.eachRow((row, rowNumber) => {
                        if (rowNumber > 1) {
                            const cell = row.getCell(index + 1);
                            const cellLength = String(cell.value || "").length;
                            if (cellLength > maxWidth) maxWidth = cellLength;
                        }
                    });
                    column.width = Math.min(Math.max(maxWidth, 10), 50);
                });

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
                    for (let i = 0; i < maxColumns; i++) {
                        const columnLetter = getColumnLetter(i + 1);
                        try { const column = sheet.getColumn(columnLetter); if (column) column.filterButton = true; } catch (error) { break; }
                    }
                }

                sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
            });

            const selectedSchool = schools.find(s => s.id === parseInt(schoolIdToUse));
            const schoolName = selectedSchool ? selectedSchool.name : 'Colegio';
            const fileName = `reporte_rutas_${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_${getFormattedDateTime()}.xlsx`;
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

            setSnackbar({ open: true, message: `Reporte de rutas para ${schoolName} descargado exitosamente`, severity: 'success' });
            setOpenSchoolSelectDialog(false);
        } catch (error) {
            console.error('[handleDownloadRouteReport] Error:', error);
            setSnackbar({ open: true, message: 'Error al descargar el reporte de rutas', severity: 'error' });
        } finally {
            setRouteReportLoading(false);
        }
    };

    // Generar y descargar archivo Excel con TODOS los padres del colegio gestionado (ExcelJS, columnas por hijo)
    const handleDownloadAllParents = async (schoolIdParam) => {
        const schoolIdToUse = schoolIdParam || schoolId || currentSchool?.id;
        if (!schoolIdToUse) {
            setSnackbar({ open: true, message: 'Por favor selecciona un colegio.', severity: 'warning' });
            return;
        }

        try {
            setRouteReportLoading(true);

            // Obtener padres (usar state si aplica)
            let parents = [];
            if (Array.isArray(users) && users.length > 0) {
                const matched = users.filter(u => String(u.school) === String(schoolIdToUse));
                if (matched.length > 0) parents = matched.slice();
            }
            if (parents.length === 0) {
                const resp = await api.get('/users/parents', { params: { schoolId: schoolIdToUse } });
                parents = resp.data.users || [];
            }

            // Determinar máximo de hijos entre las familias
            let maxStudents = 0;
            parents.forEach(u => {
                const fd = u.FamilyDetail || {};
                const cnt = Array.isArray(fd.Students) ? fd.Students.length : 0;
                if (cnt > maxStudents) maxStudents = cnt;
            });

            // Construir workbook con ExcelJS
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Padres');

            // Encabezados básicos
            const baseHeaders = [
                { header: 'Apellido Familia', key: 'apellidoFamilia' },
                { header: 'Nombre', key: 'nombre' },
                { header: 'Email', key: 'email' },
                { header: 'Nombre Madre', key: 'madreNombre' },
                { header: 'Celular Madre', key: 'madreCelular' },
                { header: 'Email Madre', key: 'madreEmail' },
                { header: 'Nombre Padre', key: 'padreNombre' },
                { header: 'Celular Padre', key: 'padreCelular' },
                { header: 'Email Padre', key: 'padreEmail' },
                { header: 'Dirección Principal', key: 'direccionPrincipal' },
                { header: 'Dirección Alterna', key: 'direccionAlterna' },
                { header: 'Zona/Sector', key: 'zonaSector' },
                { header: 'Tipo Ruta', key: 'tipoRuta' },
                { header: 'Contacto Emergencia', key: 'emergenciaContacto' },
                { header: 'Parentesco Emergencia', key: 'emergenciaParentesco' },
                { header: 'Teléfono Emergencia', key: 'emergenciaTelefono' }
            ];

            // Añadir columnas por cada hijo: Estudiante N - Nombre, Estudiante N - Grado
            const studentCols = [];
            for (let i = 1; i <= maxStudents; i++) {
                studentCols.push({ header: `Estudiante ${i} - Nombre`, key: `est_${i}_nombre` });
                studentCols.push({ header: `Estudiante ${i} - Grado`, key: `est_${i}_grado` });
            }

            const finalColumns = baseHeaders.concat(studentCols);
            sheet.columns = finalColumns.map(col => ({ header: col.header, key: col.key, width: Math.min(Math.max(col.header.length + 6, 12), 40) }));

            // Formato: cabecera en negrita y relleno
            sheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            // Alternar color de filas
            sheet.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return; // header
                const isEven = rowIndex % 2 === 0;
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                    cell.alignment = { vertical: 'middle' };
                });
            });

            // Centrar columnas de celular y todas las columnas de grado
            sheet.columns.forEach((col) => {
                const key = col.key;
                if (key === 'madreCelular' || key === 'padreCelular') {
                    col.alignment = { horizontal: 'center', vertical: 'middle' };
                }
                if (key && key.startsWith('est_') && key.endsWith('_grado')) {
                    col.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            });

            // Auto filter
            const lastColLetter = sheet.getRow(1).cellCount;
            sheet.autoFilter = {
                from: 'A1',
                to: `${sheet.getColumn(lastColLetter).letter}1`
            };

            // Freeze first row and first column
            sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

            // Fill rows with parent data
            parents.forEach((u, idx) => {
                const fd = u.FamilyDetail || {};
                const row = [];
                row.push(fd.familyLastName || '');
                row.push(u.name || '');
                row.push(u.email || '');
                row.push(fd.motherName || '');
                row.push(fd.motherCellphone || '');
                row.push(fd.motherEmail || '');
                row.push(fd.fatherName || '');
                row.push(fd.fatherCellphone || '');
                row.push(fd.fatherEmail || '');
                row.push(fd.mainAddress || '');
                row.push(fd.alternativeAddress || '');
                row.push(fd.zoneOrSector || '');
                row.push(fd.routeType || '');
                row.push(fd.emergencyContact || '');
                row.push(fd.emergencyRelationship || '');
                row.push(fd.emergencyPhone || '');

                for (let i = 0; i < maxStudents; i++) {
                    const student = Array.isArray(fd.Students) && fd.Students[i] ? fd.Students[i] : null;
                    row.push(student ? (student.fullName || '') : '');
                    row.push(student ? (student.grade || '') : '');
                }

                const added = sheet.addRow(row);
                const isEven = (idx + 1) % 2 === 0;
                added.eachCell((cell, colNumber) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                    cell.alignment = { vertical: 'middle' };
                    const headerText = (sheet.getRow(1).getCell(colNumber).value || '').toString().toLowerCase();
                    if (headerText.includes('celular') || headerText.includes('tipo ruta') || headerText.includes('grado')) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
            });

            // Generar buffer y descargar
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const selectedSchool = schools.find(s => s.id === parseInt(schoolIdToUse));
            const schoolName = selectedSchool ? selectedSchool.name : 'Colegio';
            const fileName = `padres_${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_${getFormattedDateTime()}.xlsx`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSnackbar({ open: true, message: `Archivo con padres de ${schoolName} descargado.`, severity: 'success' });
        } catch (error) {
            console.error('[handleDownloadAllParents] Error:', error);
            setSnackbar({ open: true, message: 'Error al generar el archivo de padres', severity: 'error' });
        } finally {
            setRouteReportLoading(false);
        }
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
        // Consider a family new only when `isNew` is explicitly true and
        // the account was created within the last 21 days.
        if (user.FamilyDetail.isNew === false) return false;
        const createdAt = new Date(user.createdAt);
        const now = new Date();
        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
        return user.FamilyDetail.isNew === true && diffDays <= 21;
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
        // If user has explicit state flag (DB uses 0/1), consider 0 as Inactivo
        if (user && (user.state === 0 || user.state === '0' || user.state === false)) return 'Inactivo';
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
            case 'Inactivo':
                return 'error';
            default:
                return 'default';
        }
    };

    // Helpers to normalize and count students reliably
    const getStudentsArray = (user) => {
        try {
            const fd = user?.FamilyDetail || user?.familyDetail || {};
            let students = fd?.Students ?? fd?.students ?? [];
            if (!Array.isArray(students)) {
                try {
                    students = JSON.parse(students || '[]');
                } catch (e) {
                    students = [];
                }
            }
            if (!Array.isArray(students)) students = [];
            // Filter out falsy entries
            return students.filter(s => s && (typeof s === 'object' || String(s).trim() !== ''));
        } catch (e) {
            return [];
        }
    };

    const getStudentsCount = (user) => {
        if (!user) return 0;
        const arr = getStudentsArray(user);
        if (Array.isArray(arr) && arr.length > 0) return arr.length;
        if (typeof user.studentsCount === 'number') return user.studentsCount;
        if (user.studentsCount && !isNaN(Number(user.studentsCount))) return Number(user.studentsCount);
        return 0;
    };

    const countStudents = (list) => (Array.isArray(list) ? list.reduce((acc, u) => acc + getStudentsCount(u), 0) : 0);

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
            // Fetch only parents from the backend endpoint
            const response = await api.get('/users/parents', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: { schoolId }
            });

            const usersData = response.data.users || [];
            // Normalize users: ensure FamilyDetail and Students array exist and compute studentsCount
            const normalized = (usersData || []).map(u => {
                const fdRaw = u.FamilyDetail || u.familyDetail || {};
                let students = fdRaw?.Students ?? fdRaw?.students ?? [];
                if (!Array.isArray(students)) {
                    try { students = JSON.parse(students || '[]'); } catch (e) { students = []; }
                }
                if (!Array.isArray(students)) students = [];
                students = students.filter(s => s && (typeof s === 'object' || String(s).trim() !== ''));
                const fdClean = { ...fdRaw, Students: students };
                const studentsCount = students.length || (u.studentsCount ? Number(u.studentsCount) : 0);
                return { ...u, FamilyDetail: fdClean, studentsCount };
            });
            setUsers(normalized);
            setFilteredUsers(normalized);
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

        // Filtrar por búsqueda (case-insensitive y sin acentos). Soporta búsqueda por varias palabras.
        if (searchQuery) {
            const normalize = (str) => {
                if (!str) return '';
                try {
                    return str
                        .toString()
                        .normalize('NFD')
                        .replace(/\p{Diacritic}/gu, '')
                        .toLowerCase();
                } catch (e) {
                    // Fallback for environments without Unicode property escapes
                    return str
                        .toString()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .toLowerCase();
                }
            };

            const tokens = normalize(searchQuery).split(/\s+/).filter(Boolean);

            filtered = filtered.filter(user => {
                const familyLast = normalize(user.FamilyDetail?.familyLastName || user.familyLastName || '');
                const motherName = normalize(user.motherName || user.FamilyDetail?.motherName || '');
                const fatherName = normalize(user.fatherName || user.FamilyDetail?.fatherName || '');
                const motherEmail = normalize(user.motherEmail || '');
                const fatherEmail = normalize(user.fatherEmail || '');
                const name = normalize(user.name || '');
                const email = normalize(user.email || '');

                // For each token, ensure it matches at least one field
                return tokens.every(token => (
                    familyLast.includes(token) ||
                    motherName.includes(token) ||
                    fatherName.includes(token) ||
                    motherEmail.includes(token) ||
                    fatherEmail.includes(token) ||
                    name.includes(token) ||
                    email.includes(token)
                ));
            });
        }

        // Filtrar por estado
        if (statusFilter) {
            if (statusFilter === 'Activo') {
                filtered = filtered.filter(user => !(user && (user.state === 0 || user.state === '0' || user.state === false)));
            } else if (statusFilter === 'Inactivo') {
                filtered = filtered.filter(user => (user && (user.state === 0 || user.state === '0' || user.state === false)));
            } else {
                filtered = filtered.filter(user => {
                    const status = getUserStatus(user);
                    return status === statusFilter;
                });
            }
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
                zoneOrSector: user.FamilyDetail.zoneOrSector || '',
                routeType: user.FamilyDetail.routeType || '',
                emergencyContact: user.FamilyDetail.emergencyContact || '',
                emergencyRelationship: user.FamilyDetail.emergencyRelationship || '',
                emergencyPhone: user.FamilyDetail.emergencyPhone || '',
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
                zoneOrSector: '',
                routeType: '',
                emergencyContact: '',
                emergencyRelationship: '',
                emergencyPhone: '',
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

    // Activation handlers (moved out so they are accessible from the table)
    const handleActivateClick = (user) => {
        if (!user) return;
        setSelectedUser(user);
        setOpenActivateConfirm(true);
    };

    const handleSuspendClick = (user) => {
        if (!user) return;
        setSelectedUser(user);
        setOpenSuspendConfirm(true);
    };

    const handleCancelSuspend = () => {
        setSelectedUser(null);
        setOpenSuspendConfirm(false);
    };

    const handleConfirmSuspend = async () => {
        if (!selectedUser || !selectedUser.id) return;
        try {
            setSuspendLoading(true);

            // Obtener payment directamente por userId (no requiere schoolId/schoolYear)
            const res = await api.get(`/payments/by-user/${selectedUser.id}`);
            const payment = res.data.payment || res.data || null;

            if (!payment || !payment.id) {
                setSnackbar({ open: true, message: 'No se encontró un pago asociado para esta familia', severity: 'error' });
                return;
            }

            await api.post(`/payments/v2/${payment.id}/suspend`);
            setSnackbar({ open: true, message: 'Familia suspendida', severity: 'success' });
            setOpenSuspendConfirm(false);
            setSelectedUser(null);
            // Refresh users list (suspend endpoint also updates user state)
            fetchUsers();
        } catch (err) {
            console.error('Error suspending family from users page:', err);
            const message = err?.response?.data?.message || 'Error suspendiendo la familia';
            setSnackbar({ open: true, message, severity: 'error' });
        } finally {
            setSuspendLoading(false);
        }
    };

    const handleCancelActivate = () => {
        setSelectedUser(null);
        setOpenActivateConfirm(false);
    };

    const handleConfirmActivate = async () => {
        if (!selectedUser || !selectedUser.id) return;
        try {
            setActivateLoading(true);
            // Prefer using payments v2 activate endpoint when possible (keeps payment and user status in sync)
            const sId = stateSchool?.id || schoolId;
            const sYear = schoolYear || stateSchoolYear;

            if (sId && sYear) {
                try {
                    const res = await api.get('/payments', { params: { schoolId: sId, schoolYear: sYear, page: 1, limit: 200 } });
                    const payments = res.data.payments || res.data || [];
                    const payment = payments.find(p => (p.User && p.User.id) === selectedUser.id || p.userId === selectedUser.id);
                    if (payment && payment.id) {
                        await api.post(`/payments/v2/${payment.id}/activate`);
                        setSnackbar({ open: true, message: 'Familia activada', severity: 'success' });
                        setOpenActivateConfirm(false);
                        setSelectedUser(null);
                        fetchUsers();
                        return;
                    }
                } catch (err) {
                    console.warn('No se pudo activar vía payments v2, fallback a usuario:', err?.response?.data || err.message);
                    // continue to fallback
                }
            }

            // Fallback: activar usuario directamente
            await api.patch(`/users/${selectedUser.id}/state`, { state: 1 });
            setSnackbar({ open: true, message: 'Usuario activado correctamente', severity: 'success' });
            setOpenActivateConfirm(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) {
            console.error('Error activating user:', err);
            setSnackbar({ open: true, message: 'Error activando el usuario', severity: 'error' });
        } finally {
            setActivateLoading(false);
        }
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
        // Open confirmation dialog after selection
        setOpenDeleteConfirm(true);
    };

    const handleCancelDelete = () => {
        setSelectedUser(null);
        setOpenDeleteConfirm(false);
    };

    const handleConfirmDelete = async () => {
        if (!selectedUser || !selectedUser.id) return;
        try {
            setBulkLoading(true);
            // This view requires a permanent (hard) deletion for users.
            await api.delete(`/users/${selectedUser.id}`);
            setSnackbar({ open: true, message: 'Usuario eliminado permanentemente', severity: 'success' });
            setOpenDeleteConfirm(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) {
            console.error('Error deleting user:', err);
            const message = err?.response?.data?.message || 'Error eliminando el usuario';
            setSnackbar({ open: true, message, severity: 'error' });
        } finally {
            setBulkLoading(false);
        }
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

            // Validation: when creating a new Parent (roleId 3), require at least one student
            const currentStudentsCount = currentStudentsNorm.length;
            if (!selectedUser.id && roleIdNum === 3 && currentStudentsCount === 0) {
                setSnackbar({ open: true, message: 'Debe agregar al menos un estudiante para crear una familia', severity: 'warning' });
                return;
            }

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
            zoneOrSector: '',
            routeType: '',
            emergencyContact: '',
            emergencyRelationship: '',
            emergencyPhone: '',
            students: [],
            scheduleSlots: [],
            specialFee: 0
        });
        setOriginalStudents([]);
        setSelectedSupervisorPilots([]);
        setSelectedAuxiliarMonitoras([]);
        setOpenEditDialog(true);
    };

    // Descargar plantilla sólo para padres. Si hay un colegio seleccionado, prefill del campo Colegio (ID)
    const handleDownloadParentsTemplate = () => {

        const headers = [
            "Apellido Familia",
            "Nombre Completo (Usuario)",
            "Correo electrónico (Usuario)",
            "Contraseña",
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
            "Zona/Sector",
            "Contacto de Emergencia",
            "Parentesco de Emergencia",
            "Teléfono de Emergencia",
            "Descuento especial (monto)",
            "Tipo ruta",
            "Alumno 1",
            "Grado Alumno 1",
            "Alumno 2",
            "Grado Alumno 2",
            "Alumno 3",
            "Grado Alumno 3",
            "Alumno 4",
            "Grado Alumno 4"
        ];

        const example = [
            "López Ruiz",
            "UsuarioEjemplo",
            "usuario@ejemplo.com",
            "contraseña123",
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
            "Zona 10",
            "Ana García",
            "Hermana",
            "55598765",
            "0",
            "Completa",
            "Alumno Ejemplo 1",
            "Primero Básico",
            "Alumno Ejemplo 2",
            "Segundo",
            "Alumno Ejemplo 3",
            "Tercero",
            "Alumno Ejemplo 4",
            "Cuarto"
        ];

        // Hoja de listas: únicamente lista de grados del colegio gestionado (una columna)
        // Normalizar grades del colegio gestionado como en availableGrades
        const getManagedSchoolGrades = () => {
            let sch = currentSchool;
            if (!sch && schoolId && Array.isArray(schools)) sch = schools.find(s => String(s.id) === String(schoolId));
            if (!sch && Array.isArray(schools) && schools.length > 0) sch = schools[0];
            const gradesRaw = sch?.grades;
            if (!gradesRaw) return [];
            let parsed = [];
            if (typeof gradesRaw === 'string') {
                try { parsed = JSON.parse(gradesRaw); } catch (e) { parsed = gradesRaw.split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name })); }
            } else if (Array.isArray(gradesRaw)) parsed = gradesRaw; else return [];
            return parsed.map(g => {
                if (!g) return '';
                if (typeof g === 'string') return g;
                if (typeof g === 'object') return g.name ?? g.label ?? JSON.stringify(g);
                return String(g);
            }).filter(Boolean);
        };

        const managedGrades = getManagedSchoolGrades();
        const wsListasData = [["Grados"]];
        if (managedGrades.length === 0) {
            // fallback: include a few common grades to avoid empty list
            wsListasData.push(["Primero Básico"]);
            wsListasData.push(["Segundo"]);
            wsListasData.push(["Tercero"]);
        } else {
            managedGrades.forEach(g => wsListasData.push([g]));
        }

        const wsPadres = XLSX.utils.aoa_to_sheet([headers, example]);
        wsPadres['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
        const wsListas = XLSX.utils.aoa_to_sheet(wsListasData);
        wsListas['!cols'] = [{ wch: 30 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsPadres, 'Padres');
        XLSX.utils.book_append_sheet(wb, wsListas, 'Listas');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const fileName = `plantilla_padres_${getFormattedDateTime()}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
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
            // Adjuntar el colegio gestionado para que el backend pueda enlazar los padres automáticamente
            const schoolToAttach = currentSchool?.id || schoolId || '';
            if (schoolToAttach) formData.append('schoolId', String(schoolToAttach));
            
            await api.post('/parents/bulk-upload', formData, {
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
                    va = String(getStudentsCount(a));
                    vb = String(getStudentsCount(b));
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
                                Familias - {currentSchool?.name || 'Cargando...'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Ciclo Escolar ${currentSchoolYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                        {users.length} familias encontradas
                                    </Typography>
                                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                        {(() => {
                                            try {
                                                const total = countStudents(users);
                                                return `${total} alumnos`;
                                            } catch (e) {
                                                return `0 alumnos`;
                                            }
                                        })()}
                                    </Typography>
                                </Box>
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
                                placeholder="Buscar por nombre, apellido o email..."
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
                        {/* Role filter removed: this view only handles Padres */}
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
                                variant="outlined"
                                color="primary"
                                startIcon={<FileUpload />}
                                fullWidth
                                onClick={() => setOpenBulkScheduleDialog(true)}
                            >
                                Carga Horarios
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
                                Añadir Familia
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
                                                        label={getStudentsCount(user)}
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
                                                    ) : getUserStatus(user) === 'Inactivo' ? (
                                                        <Chip
                                                            label={getUserStatus(user)}
                                                            color={getStatusColor(getUserStatus(user))}
                                                            size="small"
                                                            clickable
                                                            onClick={() => handleActivateClick(user)}
                                                        />
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

                                                        {(() => {
                                                            const isInactive = user && (user.state === 0 || user.state === '0' || user.state === false);
                                                            return isInactive ? (
                                                                <IconButton size="small" title="Activar familia" onClick={() => handleActivateClick(user)}>
                                                                    <ToggleOff fontSize="small" />
                                                                </IconButton>
                                                            ) : (
                                                                <IconButton size="small" title="Suspender familia" onClick={() => handleSuspendClick(user)}>
                                                                    <ToggleOn fontSize="small" />
                                                                </IconButton>
                                                            );
                                                        })()}

                                                        <IconButton size="small" onClick={() => handleDeleteClick(user)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
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
                <DialogTitle>Carga Masiva de Familias</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Sube un archivo Excel. Usa la plantilla oficial.<br />
                        <br />
                        La lista de Grados se encuentra en la hoja "Listas" de la plantilla.<br />
                        <br />
                        El límite de archivo es 5 MB.
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                        <Button
                            variant="outlined"
                            sx={{ mr: 2 }}
                            color="success"
                            onClick={handleDownloadParentsTemplate}
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

            {/* Modal: Carga masiva de horarios */}
            <BulkScheduleModal open={openBulkScheduleDialog} onClose={() => setOpenBulkScheduleDialog(false)} schoolId={currentSchool?.id || schoolId} />

            {/* Diálogo de confirmación para eliminación de usuario */}
            <Dialog open={openDeleteConfirm} onClose={handleCancelDelete} maxWidth="xs" fullWidth>
                <DialogTitle>Eliminar Usuario</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Estás seguro que deseas eliminar al usuario <strong>{selectedUser?.name || selectedUser?.email || selectedUser?.id}</strong>? Esta acción no es reversible.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={bulkLoading}>
                        {bulkLoading ? 'Eliminando...' : 'Eliminar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de confirmación para activar familia */}
            <Dialog open={openActivateConfirm} onClose={handleCancelActivate} maxWidth="xs" fullWidth>
                <DialogTitle>Activar Familia</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Deseas activar a la familia <strong>{selectedUser?.FamilyDetail?.familyLastName || selectedUser?.familyLastName || selectedUser?.name || selectedUser?.email || selectedUser?.id}</strong>?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelActivate}>Cancelar</Button>
                    <Button variant="contained" color="success" onClick={handleConfirmActivate} disabled={activateLoading}>
                        {activateLoading ? 'Activando...' : 'Activar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de confirmación para suspender familia (usa la misma lógica que el modal de pagos) */}
            <Dialog open={openSuspendConfirm} onClose={handleCancelSuspend} maxWidth="xs" fullWidth>
                <DialogTitle>Suspender Familia</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Deseas suspender a la familia <strong>{selectedUser?.FamilyDetail?.familyLastName || selectedUser?.familyLastName || selectedUser?.name || selectedUser?.email || selectedUser?.id}</strong>?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelSuspend}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={handleConfirmSuspend} disabled={suspendLoading}>
                        {suspendLoading ? 'Suspendiendo...' : 'Suspender'}
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
                        disabled={routeReportLoading}
                        onClick={async () => {
                            if (downloadMode === 'report') {
                                // Generar reporte de rutas para el colegio actual
                                await handleDownloadRouteReport(currentSchool?.id || schoolId);
                            } else if (downloadMode === 'new') {
                                        // Descargar usuarios nuevos del colegio actual
                                        await handleDownloadNewParents(currentSchool?.id || schoolId);
                                        setOpenSchoolSelectDialog(false);
                            } else if (downloadMode === 'all') {
                                await handleDownloadAllParents(currentSchool?.id || schoolId);
                                setOpenSchoolSelectDialog(false);
                            } else {
                                setOpenSchoolSelectDialog(false);
                            }
                        }}
                    >
                        {routeReportLoading ? 'Generando...' : (downloadMode === 'report' ? 'Generar Reporte' : 'Descargar')}
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
                <DialogTitle>{selectedUser?.id ? 'Editar Familia' : 'Añadir Familia'}</DialogTitle>
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
                                        <TextField
                                            name="zoneOrSector"
                                            label="Zona/Sector"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.zoneOrSector}
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

                                {/* Sección de contacto de emergencia */}
                                <Typography variant="h6" sx={{ mt: 3, ml: 2 }}>
                                    Contacto de Emergencia
                                </Typography>
                                <Grid container spacing={2} sx={{ mt: 1, pl: 2 }}>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="emergencyContact"
                                            label="Nombre del Contacto"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.emergencyContact}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="emergencyRelationship"
                                            label="Parentesco"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.emergencyRelationship}
                                            onChange={handleFamilyDetailChange}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            name="emergencyPhone"
                                            label="Teléfono de Emergencia"
                                            fullWidth
                                            variant="outlined"
                                            value={familyDetail.emergencyPhone}
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
                        disabled={!selectedUser?.id && Number(selectedUser?.roleId) === 3 && (!(Array.isArray(familyDetail.students)) || familyDetail.students.length === 0)}
                    >
                        {selectedUser?.id ? 'Guardar Cambios' : 'Crear Usuario'}
                    </Button>
                </DialogActions>
            </Dialog>
        </PageContainer>
    );
};

export default SchoolUsersPage;
