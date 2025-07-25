// src/pages/PaymentsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import moment from 'moment';
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
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Badge,
    Checkbox,
    FormControlLabel,
    useTheme,
    useMediaQuery,
    Box,
    Switch,
    Grid,
    TableSortLabel
} from '@mui/material';
import {
    Send as SendIcon,
    Edit as EditIcon,
    ReceiptLong as ReceiptIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    Payment as PaymentIcon,
    PauseCircleFilled as PauseIcon,
    PlayCircleFilled as PlayIcon,
    MoneyOff as MoneyOffIcon,
    History as HistoryIcon,
} from '@mui/icons-material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import NoteAltIcon from '@mui/icons-material/NoteAlt'; // Agrega este import

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import ExtraordinaryPaymentSection from "../components/ExtraordinaryPaymentSection";
import PaymentHistorySection from "../components/PaymentHistorySection";
import tw from 'twin.macro';
import styled from 'styled-components';
import { getSocket } from '../services/socketService';

// IMPORTS RECHARTS
import {
    PieChart,
    Pie,
    Cell,
    Tooltip as RechartsTooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer
} from 'recharts';

// Contenedor principal con Twin.Macro
const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

// Componentes para la vista móvil (tarjetas)
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

/* ========== Código para ordenamiento ========== */
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

/**
 * Normaliza (remueve acentos/tildes) y convierte a minúscula,
 * para facilitar la búsqueda "sin tildes".
 */
function normalizeString(str) {
    return str
        .normalize("NFD") // descompone acentos
        .replace(/[\u0300-\u036f]/g, "") // elimina acentos/diacríticos
        .toLowerCase();
}

/**
 * Extrae el valor a partir del objeto payment según la columna.
 * Para campos numéricos se elimina el prefijo "Q " y se convierte a número.
 */
function getFieldValue(payment, field) {
    switch (field) {
        case 'familyLastName':
            return payment.User && payment.User.FamilyDetail
                ? payment.User.FamilyDetail.familyLastName || ''
                : '';
        case 'studentCount':
            return payment.User && payment.User.FamilyDetail && Array.isArray(payment.User.FamilyDetail.Students)
                ? payment.User.FamilyDetail.Students.length
                : 0;
        case 'finalStatus':
            return payment.finalStatus || '';
        case 'nextPaymentDate':
            return payment.nextPaymentDate ? new Date(payment.nextPaymentDate).getTime() : 0;
        case 'lastPaymentDate':
            return payment.lastPaymentDate ? new Date(payment.lastPaymentDate).getTime() : 0;
        case 'montoTotal': {
            let val = payment.montoTotal;
            if (typeof val === 'string') {
                val = val.replace('Q ', '');
            }
            return parseFloat(val) || 0;
        }
        case 'leftover': {
            let val = payment.leftover;
            if (typeof val === 'string') {
                val = val.replace('Q ', '');
            }
            return parseFloat(val) || 0;
        }
        case 'accumulatedPenalty': {
            let val = payment.accumulatedPenalty;
            if (typeof val === 'string') {
                val = val.replace('Q ', '');
            }
            return parseFloat(val) || 0;
        }
        case 'totalDue': {
            let val = payment.totalDue;
            if (typeof val === 'string') {
                val = val.replace('Q ', '');
            }
            return parseFloat(val) || 0;
        }
        case 'creditBalance': {
            let val = payment.creditBalance;
            if (typeof val === 'string') {
                val = val.replace('Q ', '');
            }
            return parseFloat(val) || 0;
        }
        default:
            return '';
    }
}
/* ========== Fin código para ordenamiento ========== */

const PaymentsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Listado de colegios
    const [schools, setSchools] = useState([]);

    // Data por colegio
    const [schoolPaymentsData, setSchoolPaymentsData] = useState({});

    // Filtros globales
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('');

    // Estados Mora Global
    const [globalDailyPenalty, setGlobalDailyPenalty] = useState(10);
    const [openPenaltyEdit, setOpenPenaltyEdit] = useState(false);
    const [globalPenaltyPaused, setGlobalPenaltyPaused] = useState(false);

    // Diálogo Email
    const [openEmailDialog, setOpenEmailDialog] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [attachments, setAttachments] = useState([]);

    // Boletas / Zoom
    const [openReceiptsDialog, setOpenReceiptsDialog] = useState(false);
    const [fatherReceipts, setFatherReceipts] = useState([]);
    const [fatherName, setFatherName] = useState('');
    const [openImageDialog, setOpenImageDialog] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState('');
    const [zoomScale, setZoomScale] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [pos, setPos] = useState({ x: 0, y: 0 });

    // Boletas no vistas
    const [unreadReceiptsMap, setUnreadReceiptsMap] = useState({});

    // Diálogo Registrar Pago
    const [openRegisterPayDialog, setOpenRegisterPayDialog] = useState(false);
    const [registerPaySelected, setRegisterPaySelected] = useState(null);
    const [registerPaymentData, setRegisterPaymentData] = useState({
        paymentId: null,
        amountPaid: '',
        isFullPayment: false,
        isMultipleMonths: false,
        monthsCount: 1,
        paymentDate: moment().format('YYYY-MM-DD')
    });

    // Diálogo Número de cuenta
    const [openBankAccountNumberDialog, setOpenBankAccountNumberDialog] = useState(false);
    const [selectedPaymentForBankAccount, setSelectedPaymentForBankAccount] = useState(null);
    const [bankAccountNumberValue, setBankAccountNumberValue] = useState('');

    // Snackbar
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Análisis
    const [analysisData, setAnalysisData] = useState(null);
    const [analysisSchoolId, setAnalysisSchoolId] = useState('');
    const [combinedEarnings, setCombinedEarnings] = useState([]);

    // Indicadores
    const pagadoCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'PAGADO')?.count || 0;
    const moraCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'MORA')?.count || 0;
    const pendienteCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'PENDIENTE')?.count || 0;
    const currentMonthEarnings = combinedEarnings.find(item =>
        item.year === moment().year() && item.month === (moment().month() + 1)
    )?.total || 0;

    // Exonerar Mora
    const [openExonerateDialog, setOpenExonerateDialog] = useState(false);
    const [exoneratePayment, setExoneratePayment] = useState(null);
    const [exonerateAmount, setExonerateAmount] = useState('');

    // Refrescar Historial de Pagos
    const [paymentHistoryRefresh, setPaymentHistoryRefresh] = useState(0);

    // Notas
    const [openNotesDialog, setOpenNotesDialog] = useState(false);
    const [selectedPaymentForNotes, setSelectedPaymentForNotes] = useState(null);
    const [notesDraftDialog, setNotesDraftDialog] = useState('');

    // Recibo
    const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
    const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
    const [receiptNumberDraft, setReceiptNumberDraft] = useState('');

    // Historial de Pagos de Usuario
    const [openUserHistoryDialog, setOpenUserHistoryDialog] = useState(false);
    const [userHistoryPayments, setUserHistoryPayments] = useState([]);
    const [userHistoryLoading, setUserHistoryLoading] = useState(false);
    const [userHistoryName, setUserHistoryName] = useState('');
    const [userHistoryMonth, setUserHistoryMonth] = useState(moment().format('YYYY-MM'));
    const [userHistoryUserId, setUserHistoryUserId] = useState(null);

    const triggerPaymentHistoryRefresh = () => setPaymentHistoryRefresh(prev => prev + 1);

    const handleOpenExonerateDialog = (payment) => {
        setExoneratePayment(payment);
        setExonerateAmount('');
        setOpenExonerateDialog(true);
    };

    const handleCloseExonerateDialog = () => {
        setOpenExonerateDialog(false);
        setExoneratePayment(null);
        setExonerateAmount('');
    };

    const handleExoneratePenalty = async () => {
        if (!exoneratePayment) return;
        const amt = parseFloat(exonerateAmount);
        if (isNaN(amt) || amt <= 0) {
            setSnackbar({
                open: true,
                message: 'Ingrese un monto válido para exonerar',
                severity: 'error'
            });
            return;
        }
        try {
            await api.post(`/payments/${exoneratePayment.id}/exoneratePenalty`, {
                exonerateAmount: amt
            });
            triggerPaymentHistoryRefresh();
            setSnackbar({
                open: true,
                message: 'Mora exonerada correctamente',
                severity: 'success'
            });
            handleCloseExonerateDialog();

            const schId = exoneratePayment.schoolId || 'null';
            refetchSchoolPayments(schId);
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: 'Error al exonerar mora', severity: 'error' });
        }
    };

    // Factura
    const handleToggleInvoiceNeed = async (payment, newCheckedValue) => {
        try {
            await api.put(`/payments/${payment.id}/set-invoice-need`, {
                requiresInvoice: newCheckedValue
            });
            triggerPaymentHistoryRefresh();
            setSnackbar({
                open: true,
                message: `Se ha actualizado la opción de factura a: ${newCheckedValue ? 'Sí' : 'No'}`,
                severity: 'success'
            });
            refetchSchoolPayments(payment.schoolId);
        } catch (error) {
            console.error('Error al actualizar requerimiento de factura:', error);
            setSnackbar({
                open: true,
                message: 'Error al actualizar si requiere factura',
                severity: 'error'
            });
        }
    };

    // Número de cuenta
    const handleOpenBankAccountDialog = (payment) => {
        setSelectedPaymentForBankAccount(payment);
        setBankAccountNumberValue(payment.bankAccountNumber || '');
        setOpenBankAccountNumberDialog(true);
    };

    const handleCloseBankAccountNumberDialog = () => {
        setOpenBankAccountNumberDialog(false);
        setSelectedPaymentForBankAccount(null);
    };

    const handleSaveBankAccountNumber = async () => {
        if (!selectedPaymentForBankAccount) return;
        try {
            await api.put(`/payments/${selectedPaymentForBankAccount.id}/bank-account`, {
                bankAccountNumber: bankAccountNumberValue
            });
            triggerPaymentHistoryRefresh();
            setSnackbar({
                open: true,
                message: 'Número de cuenta actualizado correctamente',
                severity: 'success'
            });
            handleCloseBankAccountNumberDialog();
            refetchSchoolPayments(selectedPaymentForBankAccount.schoolId);
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Error al actualizar el número de cuenta',
                severity: 'error'
            });
        }
    };

    // Notas
    const handleNotesSave = async (paymentId, value) => {
        try {
            await api.put(`/payments/${paymentId}/notes`, { notes: value });
            setSnackbar({ open: true, message: 'Notas actualizadas', severity: 'success' });
            // Actualiza en memoria
            setSchoolPaymentsData(prev => {
                const next = { ...prev };
                Object.values(next).forEach(sch => {
                    sch.payments = sch.payments.map(p =>
                        p.id === paymentId ? { ...p, notes: value } : p
                    );
                    sch.filteredPayments = sch.filteredPayments.map(p =>
                        p.id === paymentId ? { ...p, notes: value } : p
                    );
                });
                return next;
            });
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al actualizar notas', severity: 'error' });
        }
    };

    // Handler para abrir el diálogo de notas
    const handleOpenNotesDialog = (payment) => {
        setSelectedPaymentForNotes(payment);
        setNotesDraftDialog(payment.notes || '');
        setOpenNotesDialog(true);
    };

    // Handler para cerrar el diálogo de notas
    const handleCloseNotesDialog = () => {
        setOpenNotesDialog(false);
        setSelectedPaymentForNotes(null);
        setNotesDraftDialog('');
    };

    // Guardar nota desde el diálogo
    const handleSaveNotesDialog = async () => {
        if (!selectedPaymentForNotes) return;
        await handleNotesSave(selectedPaymentForNotes.id, notesDraftDialog);
        handleCloseNotesDialog();
    };

    // Handler para abrir el diálogo de recibo
    const handleOpenReceiptDialog = (payment) => {
        setSelectedPaymentForReceipt(payment);
        setReceiptNumberDraft(payment.receiptNumber || '');
        setOpenReceiptDialog(true);
    };

    // Handler para cerrar el diálogo de recibo
    const handleCloseReceiptDialog = () => {
        setOpenReceiptDialog(false);
        setSelectedPaymentForReceipt(null);
        setReceiptNumberDraft('');
    };

    // Guardar número de recibo desde el diálogo
    const handleSaveReceiptDialog = async () => {
        if (!selectedPaymentForReceipt) return;
        try {
            await api.put(`/payments/${selectedPaymentForReceipt.id}/receipt-number`, { receiptNumber: receiptNumberDraft });
            setSnackbar({ open: true, message: 'Número de recibo actualizado', severity: 'success' });
            setSchoolPaymentsData(prev => {
                const next = { ...prev };
                Object.values(next).forEach(sch => {
                    sch.payments = sch.payments.map(p =>
                        p.id === selectedPaymentForReceipt.id ? { ...p, receiptNumber: receiptNumberDraft } : p
                    );
                    sch.filteredPayments = sch.filteredPayments.map(p =>
                        p.id === selectedPaymentForReceipt.id ? { ...p, receiptNumber: receiptNumberDraft } : p
                    );
                });
                return next;
            });
            handleCloseReceiptDialog();
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al actualizar número de recibo', severity: 'error' });
        }
    };

    // Abrir diálogo de historial de pagos de usuario
    const handleOpenUserHistoryDialog = async (payment) => {
        setUserHistoryLoading(true);
        setOpenUserHistoryDialog(true);
        setUserHistoryName(payment.User?.name || '');
        setUserHistoryUserId(payment.User?.id || null);
        setUserHistoryMonth(moment().format('YYYY-MM')); // Por defecto, mes actual
        await fetchUserHistory(payment.User?.id, moment().format('YYYY-MM'));
        setUserHistoryLoading(false);
    };

    // Cerrar diálogo de historial de pagos de usuario
    const handleCloseUserHistoryDialog = () => {
        setOpenUserHistoryDialog(false);
        setUserHistoryPayments([]);
        setUserHistoryName('');
        setUserHistoryMonth(moment().format('YYYY-MM'));
    };

    // Función para obtener el historial de pagos de un usuario en un mes específico
    const fetchUserHistory = async (userId, yearMonth) => {
        setUserHistoryLoading(true);
        try {
            const [year, month] = yearMonth.split('-');
            const monthStart = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
            const monthEnd = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
            const res = await api.get(`/payments/history`, {
                params: { userId, monthStart, monthEnd, limit: 100 }
            });
            setUserHistoryPayments(res.data.histories || []);
        } catch (err) {
            setUserHistoryPayments([]);
        }
        setUserHistoryLoading(false);
    };

    const handleUserHistoryMonthChange = async (e) => {
        const newMonth = e.target.value;
        setUserHistoryMonth(newMonth);
        if (userHistoryUserId) {
            await fetchUserHistory(userHistoryUserId, newMonth);
        }
    };

    // Carga inicial
    useEffect(() => {
        (async () => {
            await fetchSchools();
            await fetchGlobalSettings();
            await fetchPaymentsAnalysis('');
        })();
    }, []);

    const fetchSchools = async () => {
        try {
            const res = await api.get('/schools');
            const all = res.data.schools || [];

            const initialData = {};
            all.forEach((sch) => {
                initialData[sch.id] = {
                    payments: [],
                    totalCount: 0,
                    page: 0,
                    rowsPerPage: 10,
                    order: 'asc',
                    orderBy: '',
                    filteredPayments: []
                };
            });

            setSchools(all);
            setSchoolPaymentsData(initialData);

            // Cargamos los datos de todos los colegios de una vez:
            all.forEach((sch) => {
                // Traemos TODOS los pagos de ese colegio (limit muy grande)
                fetchPaymentsForSchool(sch.id);
            });
        } catch (error) {
            console.error("fetchSchools: Error obteniendo colegios:", error);
        }
    };

    const fetchGlobalSettings = async () => {
        try {
            const res = await api.get('/system-settings');
            if (res.data.setting) {
                setGlobalDailyPenalty(res.data.setting.dailyPenalty);
                if (typeof res.data.setting.globalPenaltyPaused !== 'undefined') {
                    setGlobalPenaltyPaused(!!res.data.setting.globalPenaltyPaused);
                }
            }
        } catch (err) {
            console.error("fetchGlobalSettings: Error obteniendo settings globales:", err);
        }
    };

    // Obtener Pagos (para un colegio) - se fuerza limit alto
    const fetchPaymentsForSchool = async (schId) => {
        try {
            const res = await api.get('/payments', {
                params: {
                    schoolId: schId,
                    page: 1,
                    limit: 999999
                }
            });
            const arr = res.data.payments || [];
            const studentsTotal = res.data.studentTotals
                ? (res.data.studentTotals[schId] || 0)
                : 0;

            const totalCount = arr.length;

            setSchoolPaymentsData((prev) => {
                const next = { ...prev };
                if (!next[schId]) {
                    next[schId] = {
                        payments: [],
                        totalCount: 0,
                        page: 0,
                        rowsPerPage: 10,
                        order: 'asc',
                        orderBy: '',
                        filteredPayments: []
                    };
                }
                next[schId].payments = arr;
                next[schId].totalCount = totalCount;
                next[schId].totalStudents = studentsTotal;
                next[schId].filteredPayments = localFilterAndSort(
                    arr,
                    next[schId].order,
                    next[schId].orderBy,
                    searchQuery,
                    statusFilter
                );
                return next;
            });
        } catch (error) {
            console.error(`fetchPaymentsForSchool(${schId}):`, error);
            setSnackbar({ open: true, message: 'Error al obtener pagos', severity: 'error' });
        }
    };

    const refetchSchoolPayments = (schoolId) => {
        // Simplemente volvemos a llamar sin paginación,
        // para recargar todo y recalcular en local
        fetchPaymentsForSchool(schoolId);
    };

    // Filtro local
    const localFilterAndSort = (paymentsArray, order, orderBy, search, statusF) => {
        let temp = [...paymentsArray];

        // =======================
        // 1) Filtro por apellido (ignorando acentos)
        // =======================
        if (search.trim()) {
            const qNorm = normalizeString(search.trim());
            temp = temp.filter((p) => {
                const famLastRaw = p.User?.FamilyDetail?.familyLastName || '';
                const famLastNorm = normalizeString(famLastRaw);
                return famLastNorm.includes(qNorm);
            });
        }

        // =======================
        // 2) Filtro por estado (PAGADO, MORA, PENDIENTE)
        // =======================
        if (statusF) {
            temp = temp.filter((p) => (p.finalStatus || '').toUpperCase() === statusF);
        }

        // =======================
        // 3) Filtro por colegio
        // =======================
        if (schoolFilter) {
            temp = temp.filter((p) => p.schoolId === schoolFilter);
        }

        // Ordenar localmente
        if (orderBy) {
            const comparator = getComparator(order, orderBy);
            temp = stableSort(temp, comparator);
        }

        return temp;
    };

    // Cada que cambie la búsqueda o el estado, recalculamos para cada colegio
    useEffect(() => {
        setSchoolPaymentsData((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((schId) => {
                const { payments, order, orderBy } = updated[schId];
                updated[schId].filteredPayments = localFilterAndSort(
                    payments,
                    order,
                    orderBy,
                    searchQuery,
                    statusFilter
                );
            });
            return updated;
        });
    }, [searchQuery, statusFilter]);

    // Cada que cambie el filtro de colegio, también recalculamos
    useEffect(() => {
        setSchoolPaymentsData((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((schId) => {
                const { payments, order, orderBy } = updated[schId];
                updated[schId].filteredPayments = localFilterAndSort(
                    payments,
                    order,
                    orderBy,
                    searchQuery,
                    statusFilter
                );
            });
            return updated;
        });
    }, [schoolFilter]);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };
    const handleStatusFilterChange = (e) => {
        setStatusFilter(e.target.value);
    };
    const handleSchoolFilterChange = (e) => {
        setSchoolFilter(e.target.value);
    };

    // Editar Mora Global
    const handleTogglePenaltyEdit = () => {
        setOpenPenaltyEdit(!openPenaltyEdit);
    };
    const handleSaveGlobalPenalty = async () => {
        try {
            await api.put('/system-settings', {
                dailyPenalty: globalDailyPenalty,
                globalPenaltyPaused: globalPenaltyPaused
            });
            triggerPaymentHistoryRefresh();
            setSnackbar({
                open: true,
                message: 'Mora global actualizada',
                severity: 'success'
            });
            setOpenPenaltyEdit(false);
        } catch (error) {
            setSnackbar({ open: true, message: 'Error al actualizar mora global', severity: 'error' });
        }
    };

    const handleToggleGlobalPenaltyPaused = async () => {
        const newVal = !globalPenaltyPaused;
        try {
            await api.put('/system-settings', {
                dailyPenalty: globalDailyPenalty,
                globalPenaltyPaused: newVal
            });
            triggerPaymentHistoryRefresh();
            setGlobalPenaltyPaused(newVal);
            setSnackbar({
                open: true,
                message: newVal ? 'Mora global congelada' : 'Mora global reactivada',
                severity: 'success'
            });
        } catch (error) {
            setSnackbar({ open: true, message: 'Error al actualizar la pausa global', severity: 'error' });
        }
    };

    // Enviar Correo
    const handleOpenEmailDialog = (payment) => {
        setSelectedPayment(payment);
        setEmailSubject('');
        setEmailMessage('');
        setAttachments([]);
        setOpenEmailDialog(true);
    };
    const handleCloseEmailDialog = () => {
        setOpenEmailDialog(false);
        setSelectedPayment(null);
        setAttachments([]);
    };
    const handleSendEmail = async () => {
        if (!selectedPayment) return;
        try {
            const formData = new FormData();
            formData.append('subject', emailSubject);
            formData.append('message', emailMessage);
            if (attachments?.length > 0) {
                for (let i = 0; i < attachments.length; i++) {
                    formData.append('attachments', attachments[i]);
                }
            }
            await api.post(`/payments/${selectedPayment.id}/sendEmail`, formData);
            triggerPaymentHistoryRefresh();
            setSnackbar({
                open: true,
                message: 'Correo enviado exitosamente',
                severity: 'success'
            });
            handleCloseEmailDialog();
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al enviar correo', severity: 'error' });
        }
    };

    // Leyenda de colores
    const getRowColor = (pay) => {
        const st = (pay.finalStatus || '').toUpperCase();
        if (st === 'PAGADO') {
            return '#bbf7d0';
        }
        if (st === 'MORA') {
            return '#fca5a5';
        }
        return '#fde68a';
    };

    // Ver Boletas
    const handleShowReceipts = async (pay) => {
        if (!pay.User) return;
        setFatherName(pay.User.name || '');
        const fatherId = pay.User.id;
        try {
            const resp = await api.get(`/parents/${fatherId}/receipts`);
            setFatherReceipts(resp.data?.receipts || []);
            setOpenReceiptsDialog(true);
            setUnreadReceiptsMap((prev) => ({ ...prev, [fatherId]: false }));
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al obtener boletas', severity: 'error' });
        }
    };
    const handleCloseReceiptsDialog = () => {
        setOpenReceiptsDialog(false);
        setFatherReceipts([]);
        setFatherName('');
    };

    const handleImageClick = (url) => {
        setSelectedImageUrl(url);
        setZoomScale(1);
        setDragging(false);
        setPos({ x: 0, y: 0 });
        setOpenImageDialog(true);
    };

    const handleCloseImageDialog = () => {
        setOpenImageDialog(false);
        setSelectedImageUrl('');
        setZoomScale(1);
        setPos({ x: 0, y: 0 });
        setDragging(false);
    };
    const handleMouseDown = (e) => {
        setDragging(true);
        setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    };
    const handleMouseMove = (e) => {
        if (!dragging) return;
        const containerRect = e.currentTarget.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const imgEl = e.currentTarget.querySelector('img');
        if (!imgEl) return;

        const nW = imgEl.naturalWidth;
        const nH = imgEl.naturalHeight;
        const scaledW = nW * zoomScale;
        const scaledH = nH * zoomScale;

        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;

        if (scaledW <= containerWidth) {
            newX = (containerWidth - scaledW) / 2;
        } else {
            const minX = containerWidth - scaledW;
            if (newX < minX) newX = minX;
            if (newX > 0) newX = 0;
        }
        if (scaledH <= containerHeight) {
            newY = (containerHeight - scaledH) / 2;
        } else {
            const minY = containerHeight - scaledH;
            if (newY < minY) newY = minY;
            if (newY > 0) newY = 0;
        }
        setPos({ x: newX, y: newY });
    };
    const handleMouseUp = () => {
        setDragging(false);
    };
    const handleWheelZoom = (e) => {
        e.preventDefault();
        let delta = e.deltaY > 0 ? -0.1 : 0.1;
        let newS = zoomScale + delta;
        if (newS < 0.3) newS = 0.3;
        if (newS > 4) newS = 4;
        setZoomScale(newS);
    };

    // Registrar Pago
    const handleOpenRegisterPayDialog = (pay) => {
        setRegisterPaySelected(pay);
        setRegisterPaymentData({
            paymentId: pay.id,
            amountPaid: '',
            isFullPayment: false,
            isMultipleMonths: false,
            monthsCount: 1
        });
        setOpenRegisterPayDialog(true);
    };
    const handleCloseRegisterPayDialog = () => {
        setOpenRegisterPayDialog(false);
        setRegisterPaySelected(null);
        setRegisterPaymentData({
            paymentId: null,
            amountPaid: '',
            isFullPayment: false,
            isMultipleMonths: false,
            monthsCount: 1
        });
    };
    const handleSelectMultipleMonths = (checked) => {
        if (!registerPaySelected) return;
        const newData = { ...registerPaymentData };
        newData.isMultipleMonths = checked;
        if (checked) {
            newData.isFullPayment = false;
            newData.amountPaid = '';
            const months = newData.monthsCount || 1;
            const base = parseFloat(registerPaySelected.montoTotal) || 0;
            const total = base * months;
            newData.amountPaid = total.toFixed(2);
        } else {
            newData.monthsCount = 1;
            newData.amountPaid = '';
        }
        setRegisterPaymentData(newData);
    };
    const handleSelectFullPayment = (checked) => {
        if (!registerPaySelected) return;
        const newData = { ...registerPaymentData };
        newData.isFullPayment = checked;
        if (checked) {
            newData.isMultipleMonths = false;
            const td = parseFloat(registerPaySelected.totalDue) || 0;
            newData.amountPaid = td.toFixed(2);
        } else {
            newData.amountPaid = '';
        }
        setRegisterPaymentData(newData);
    };
    const handleMonthsCountChange = (val) => {
        if (!registerPaySelected) return;
        const months = parseInt(val || '1', 10);
        const newData = { ...registerPaymentData, monthsCount: months };
        const base = parseFloat(registerPaySelected.montoTotal) || 0;
        const total = base * months;
        newData.amountPaid = total.toFixed(2);
        setRegisterPaymentData(newData);
    };
    const handleAmountPaidManual = (val) => {
        const v = val.trim();
        const newData = {
            ...registerPaymentData,
            amountPaid: v,
            isMultipleMonths: false,
            isFullPayment: false,
            monthsCount: 1
        };
        setRegisterPaymentData(newData);
    };
    const handleRegisterPayment = async () => {
        try {
            const { paymentId, amountPaid, isFullPayment,
                isMultipleMonths, monthsCount, paymentDate } = registerPaymentData;
            await api.post(`/payments/${paymentId}/add-transaction`, {
                amountPaid,
                isFullPayment,
                isMultipleMonths,
                monthsCount,
                paymentDate
            });
            triggerPaymentHistoryRefresh();

            setSnackbar({ open: true, message: 'Pago registrado exitosamente', severity: 'success' });
            handleCloseRegisterPayDialog();

            if (registerPaySelected) {
                const schId = registerPaySelected.schoolId || 'null';
                refetchSchoolPayments(schId);
            }
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al registrar pago', severity: 'error' });
        }
    };

    // Socket
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        socket.on('receipt-uploaded', ({ fatherId }) => {
            setUnreadReceiptsMap(prev => ({ ...prev, [fatherId]: true }));
        });
        return () => {
            socket.off('receipt-uploaded');
        };
    }, []);

    // Pausa/Despausa Mora
    const handleTogglePenaltyPausedIndividual = async (payment) => {
        const newVal = !payment.penaltyPaused;
        setSchoolPaymentsData((prev) => {
            const next = { ...prev };
            const schId = payment.schoolId;
            if (!next[schId]) return next;
            next[schId].payments = next[schId].payments.map((p) =>
                p.id === payment.id ? { ...p, penaltyPaused: newVal } : p
            );
            next[schId].filteredPayments = next[schId].filteredPayments.map((p) =>
                p.id === payment.id ? { ...p, penaltyPaused: newVal } : p
            );
            return next;
        });

        setSnackbar({
            open: true,
            message: newVal
                ? `Se ha pausado la mora de ${payment.User?.name}`
                : `Se ha reactivado la mora de ${payment.User?.name}`,
            severity: 'success'
        });

        try {
            await api.put(`/payments/${payment.id}`, {
                penaltyPaused: newVal
            });
            triggerPaymentHistoryRefresh();
        } catch (error) {
            console.error('Error al actualizar la mora:', error);
            setSnackbar({
                open: true,
                message: 'Error al actualizar la pausa de mora para usuario',
                severity: 'error'
            });
            setSchoolPaymentsData((prev) => {
                const next = { ...prev };
                const schId = payment.schoolId;
                if (!next[schId]) return next;
                next[schId].payments = next[schId].payments.map((p) =>
                    p.id === payment.id ? { ...p, penaltyPaused: payment.penaltyPaused } : p
                );
                next[schId].filteredPayments = next[schId].filteredPayments.map((p) =>
                    p.id === payment.id ? { ...p, penaltyPaused: payment.penaltyPaused } : p
                );
                return next;
            });
        }
    };

    // Orden
    const handleRequestSort = (schoolId, property) => {
        setSchoolPaymentsData((prev) => {
            const next = { ...prev };
            const data = next[schoolId];
            if (!data) return next;

            const isAsc = data.orderBy === property && data.order === 'asc';
            const newOrder = isAsc ? 'desc' : 'asc';

            data.order = newOrder;
            data.orderBy = property;

            data.filteredPayments = localFilterAndSort(
                data.payments,
                data.order,
                data.orderBy,
                searchQuery,
                statusFilter
            );

            next[schoolId] = { ...data };
            return next;
        });
    };

    // Paginación LOCAL (ya no llamamos al servidor):
    const handleChangePage = (schoolId, event, newPage) => {
        setSchoolPaymentsData((prev) => {
            const next = { ...prev };
            if (!next[schoolId]) return next;
            next[schoolId].page = newPage;
            return next;
        });
    };

    const handleChangeRowsPerPage = (schoolId, event) => {
        const newRowsPerPage = parseInt(event.target.value, 10);
        setSchoolPaymentsData((prev) => {
            const next = { ...prev };
            if (!next[schoolId]) return next;
            next[schoolId].rowsPerPage = newRowsPerPage;
            next[schoolId].page = 0;
            return next;
        });
    };

    // Análisis
    const fetchPaymentsAnalysis = async (schId) => {
        try {
            const params = {};
            if (schId && schId !== '') {
                params.schoolId = schId;
            }
            const res = await api.get('/payments/analysis', { params });
            setAnalysisData(res.data);
        } catch (error) {
            console.error("fetchPaymentsAnalysis: Error =>", error);
            setAnalysisData(null);
        }
    };
    const fetchExtraordinaryEarnings = async () => {
        try {
            const res = await api.get('/payments/extraordinary/analysis');
            return res.data.monthlyEarnings || [];
        } catch (error) {
            console.error('Error al obtener análisis de pagos extraordinarios:', error);
            return [];
        }
    };
    useEffect(() => {
        (async () => {
            const extra = await fetchExtraordinaryEarnings();
            const normal = analysisData?.monthlyEarnings || [];
            const combined = combineEarnings(normal, extra);
            setCombinedEarnings(combined);
        })();
    }, [analysisData]);

    const combineEarnings = (normalEarnings, extraEarnings) => {
        const map = {};
        normalEarnings.forEach(item => {
            const key = `${item.year}-${item.month}`;
            map[key] = (map[key] || 0) + item.total;
        });
        extraEarnings.forEach(item => {
            const key = `${item.year}-${item.month}`;
            map[key] = (map[key] || 0) + item.total;
        });
        const combined = Object.keys(map).map(key => {
            const [year, month] = key.split('-').map(Number);
            return { year, month, total: map[key] };
        });
        combined.sort((a, b) => (a.year - b.year) || (a.month - b.month));
        return combined;
    };

    // =========================
    // Render principal
    // =========================

    // Filtramos la lista de colegios para renderizar solo el que está en schoolFilter,
    // o todos si schoolFilter = ''
    const filteredSchools = schoolFilter
        ? schools.filter((sch) => sch.id === schoolFilter)
        : schools;

    return (
        <Container>
            {/* SECCIÓN DE CABECERA / MORA */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                }}
            >
                <Typography variant="h4" gutterBottom>
                    Gestión de Pagos
                </Typography>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: '16px'
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            padding: '16px',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            maxWidth: '300px'
                        }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Estados
                        </Typography>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 14, height: 14, backgroundColor: '#bbf7d0', borderRadius: '50%' }} />
                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                    Pagado
                                </Typography>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 14, height: 14, backgroundColor: '#fde68a', borderRadius: '50%' }} />
                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                    Pago Pendiente
                                </Typography>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 14, height: 14, backgroundColor: '#fca5a5', borderRadius: '50%' }} />
                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                    Mora
                                </Typography>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!openPenaltyEdit ? (
                            <>
                                <Typography sx={{ fontWeight: 'bold' }}>
                                    Mora Global: Q {globalDailyPenalty}
                                </Typography>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <Button variant="outlined" onClick={handleTogglePenaltyEdit}>
                                        EDITAR MORA
                                    </Button>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={globalPenaltyPaused}
                                                onChange={handleToggleGlobalPenaltyPaused}
                                                color="primary"
                                            />
                                        }
                                        label={globalPenaltyPaused ? 'Mora Global CONGELADA' : 'Mora Global ACTIVA'}
                                    />
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <TextField
                                    label="Mora Global (Q)"
                                    variant="outlined"
                                    size="small"
                                    value={globalDailyPenalty}
                                    onChange={(e) => setGlobalDailyPenalty(e.target.value)}
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button variant="contained" onClick={handleSaveGlobalPenalty}>
                                        Guardar
                                    </Button>
                                    <Button variant="outlined" onClick={handleTogglePenaltyEdit}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* FILTROS */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '16px',
                    marginBottom: '16px'
                }}
            >
                <TextField
                    label="Buscar Apellido"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: isMobile ? '100%' : '220px' }}
                />
                <FormControl variant="outlined" size="small" style={{ width: isMobile ? '100%' : '150px' }}>
                    <InputLabel>Estado</InputLabel>
                    <Select label="Estado" value={statusFilter} onChange={handleStatusFilterChange}>
                        <MenuItem value="">Todos</MenuItem>
                        <MenuItem value="PAGADO">Pagado</MenuItem>
                        <MenuItem value="PENDIENTE">Pago Pendiente</MenuItem>
                        <MenuItem value="MORA">Mora</MenuItem>
                    </Select>
                </FormControl>
                <FormControl variant="outlined" size="small" style={{ width: isMobile ? '100%' : '200px' }}>
                    <InputLabel>Colegio</InputLabel>
                    <Select label="Colegio" value={schoolFilter} onChange={handleSchoolFilterChange}>
                        <MenuItem value="">Todos</MenuItem>
                        {schools.map((sch) => (
                            <MenuItem key={sch.id} value={sch.id}>
                                {sch.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </div>

            {/* TABLA PRINCIPAL */}
            {filteredSchools.map((school) => {
                const schId = school.id;
                const data = schoolPaymentsData[schId];
                if (!data) return null;

                // Aquí aplicamos la paginación local
                const page = data.page;
                const rowsPerPage = data.rowsPerPage;
                const startIndex = page * rowsPerPage;
                const endIndex = startIndex + rowsPerPage;

                // "finalPayments" es el slice de lo filtrado
                const slicedPayments = data.filteredPayments.slice(startIndex, endIndex);
                const totalCount = data.filteredPayments.length;
                const order = data.order;
                const orderBy = data.orderBy;

                return (
                    <div key={schId} style={{ marginBottom: '40px' }}>
                        <Typography variant="h5" style={{ marginBottom: '16px' }}>
                            {school.name}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ mb: 2 }}>
                            Total de estudiantes: {data.totalStudents ?? 0}
                        </Typography>
                        {isMobile ? (
                            slicedPayments.map((payment) => {
                                const family = payment.User?.FamilyDetail;
                                const familiaApellido = family?.familyLastName ||
                                    (family?.motherName + " " + family?.fatherName) ||
                                    '';
                                const cantidadEst = family?.Students?.length || 0;

                                return (
                                    <MobileCard key={payment.id}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'center',
                                                gap: 1,
                                                marginTop: 1
                                            }}
                                        >
                                            <IconButton title="Enviar Correo" onClick={() => handleOpenEmailDialog(payment)}>
                                                <SendIcon />
                                            </IconButton>
                                            <IconButton title="Ver Boletas" onClick={() => handleShowReceipts(payment)}>
                                                <Badge
                                                    color="primary"
                                                    variant="dot"
                                                    overlap="circular"
                                                    invisible={!payment.User || !unreadReceiptsMap[payment.User.id]}
                                                >
                                                    <ReceiptIcon />
                                                </Badge>
                                            </IconButton>
                                            <IconButton title="Registrar Pago" onClick={() => handleOpenRegisterPayDialog(payment)}>
                                                <PaymentIcon />
                                            </IconButton>
                                            <IconButton
                                                title={payment.penaltyPaused ? 'Descongelar mora (usuario)' : 'Congelar mora (usuario)'}
                                                onClick={() => handleTogglePenaltyPausedIndividual(payment)}
                                            >
                                                {payment.penaltyPaused ? (
                                                    <PlayIcon style={{ color: 'green' }} />
                                                ) : (
                                                    <PauseIcon style={{ color: 'red' }} />
                                                )}
                                            </IconButton>
                                            <IconButton title="Exonerar Mora" onClick={() => handleOpenExonerateDialog(payment)}>
                                                <MoneyOffIcon />
                                            </IconButton>
                                            <IconButton title="Editar Número de Cuenta" onClick={() => handleOpenBankAccountDialog(payment)}>
                                                <AccountBalanceWalletIcon />
                                            </IconButton>
                                            <IconButton title="Editar Nota" onClick={() => handleOpenNotesDialog(payment)}>
                                                <NoteAltIcon />
                                            </IconButton>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={!!family?.requiresInvoice}
                                                        onChange={(e) => handleToggleInvoiceNeed(payment, e.target.checked)}
                                                    />
                                                }
                                                label="Factura"
                                                labelPlacement="top"
                                                sx={{ marginLeft: 0 }}
                                            />
                                            <IconButton
                                                title="Ver Historial de Pagos"
                                                onClick={() => handleOpenUserHistoryDialog(payment)}
                                            >
                                                <HistoryIcon />
                                            </IconButton>
                                        </Box>
                                        <MobileField>
                                            <MobileLabel>Familia</MobileLabel>
                                            <MobileValue>{familiaApellido}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Cantidad de Estudiantes</MobileLabel>
                                            <MobileValue>{cantidadEst}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Estado</MobileLabel>
                                            <MobileValue>{payment.finalStatus}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Tipo</MobileLabel>
                                            <MobileValue>{family?.routeType || ''}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Razón Social</MobileLabel>
                                            <MobileValue>{family?.razonSocial || ''}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>NIT</MobileLabel>
                                            <MobileValue>{family?.nit || ''}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Descuento</MobileLabel>
                                            <MobileValue>Q {Number(family?.specialFee || 0).toFixed(2)}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Próximo Pago</MobileLabel>
                                            <MobileValue>
                                                {payment.nextPaymentDate
                                                    ? moment(payment.nextPaymentDate).format('DD/MM/YYYY')
                                                    : '—'}
                                            </MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Último Pago</MobileLabel>
                                            <MobileValue>
                                                {payment.lastPaymentDate
                                                    ? moment(payment.lastPaymentDate).format('DD/MM/YYYY')
                                                    : '—'}
                                            </MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Requiere Factura</MobileLabel>
                                            <MobileValue>{family?.requiresInvoice ? 'Sí' : 'No'}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Notas</MobileLabel>
                                            <MobileValue>{payment.notes || ''}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Recibo</MobileLabel>
                                            <MobileValue>
                                                {payment.receiptNumber || ''}
                                                <IconButton
                                                    size="small"
                                                    title="Editar Recibo"
                                                    onClick={() => handleOpenReceiptDialog(payment)}
                                                    sx={{ ml: 1 }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </MobileValue>
                                        </MobileField>
                                    </MobileCard>
                                );
                            })
                        ) : (
                            <Paper>
                                <TableContainer>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell align="center">Acciones</TableCell>
                                                <TableCell sortDirection={orderBy === 'familyLastName' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'familyLastName'}
                                                        direction={orderBy === 'familyLastName' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'familyLastName')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Familia
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'studentCount' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'studentCount'}
                                                        direction={orderBy === 'studentCount' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'studentCount')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Cant. Estudiantes
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'finalStatus' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'finalStatus'}
                                                        direction={orderBy === 'finalStatus' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'finalStatus')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Estado
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell>Tipo</TableCell>
                                                <TableCell>Razón Social</TableCell>
                                                <TableCell>NIT</TableCell>
                                                <TableCell sortDirection={orderBy === 'nextPaymentDate' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'nextPaymentDate'}
                                                        direction={orderBy === 'nextPaymentDate' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'nextPaymentDate')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Próximo Pago
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'lastPaymentDate' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'lastPaymentDate'}
                                                        direction={orderBy === 'lastPaymentDate' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'lastPaymentDate')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Último Pago
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'montoTotal' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'montoTotal'}
                                                        direction={orderBy === 'montoTotal' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'montoTotal')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Monto Total
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'leftover' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'leftover'}
                                                        direction={orderBy === 'leftover' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'leftover')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Saldo
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'accumulatedPenalty' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'accumulatedPenalty'}
                                                        direction={orderBy === 'accumulatedPenalty' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'accumulatedPenalty')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Multa Acum.
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'totalDue' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'totalDue'}
                                                        direction={orderBy === 'totalDue' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'totalDue')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Total a Pagar
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell sortDirection={orderBy === 'creditBalance' ? order : false}>
                                                    <TableSortLabel
                                                        active={orderBy === 'creditBalance'}
                                                        direction={orderBy === 'creditBalance' ? order : 'asc'}
                                                        onClick={() => handleRequestSort(schId, 'creditBalance')}
                                                        hideSortIcon={false}
                                                        sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                    >
                                                        Abono
                                                    </TableSortLabel>
                                                </TableCell>
                                                <TableCell>Descuento</TableCell>
                                                <TableCell>Número de Cuenta</TableCell>
                                                <TableCell>Recibo</TableCell>
                                                <TableCell>Usuario Activo</TableCell>
                                                <TableCell>Factura</TableCell>
                                                <TableCell>Notas</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {slicedPayments.map((payment) => {
                                                const fatherId = payment.User?.id;
                                                const hasUnread = fatherId ? unreadReceiptsMap[fatherId] === true : false;
                                                const mt = parseFloat(payment.montoTotal) || 0;
                                                const lo = parseFloat(payment.leftover) || 0;
                                                const pen = parseFloat(payment.accumulatedPenalty) || 0;
                                                const td = parseFloat(payment.totalDue) || 0;
                                                const cb = parseFloat(payment.creditBalance) || 0;
                                                const familyDetail = payment.User?.FamilyDetail;
                                                const apellidoFam = familyDetail?.familyLastName || '';
                                                const cantEst = familyDetail?.Students?.length || 0;

                                                return (
                                                    <TableRow key={payment.id} style={{ backgroundColor: getRowColor(payment) }}>
                                                        <TableCell align="center">
                                                            <IconButton title="Enviar Correo" onClick={() => handleOpenEmailDialog(payment)}>
                                                                <SendIcon />
                                                            </IconButton>
                                                            <IconButton title="Ver Boletas" onClick={() => handleShowReceipts(payment)}>
                                                                <Badge color="primary" variant="dot" overlap="circular" invisible={!hasUnread}>
                                                                    <ReceiptIcon />
                                                                </Badge>
                                                            </IconButton>
                                                            <IconButton title="Registrar Pago" onClick={() => handleOpenRegisterPayDialog(payment)}>
                                                                <PaymentIcon />
                                                            </IconButton>
                                                            <IconButton
                                                                title={payment.penaltyPaused ? 'Descongelar mora (usuario)' : 'Congelar mora (usuario)'}
                                                                onClick={() => handleTogglePenaltyPausedIndividual(payment)}
                                                            >
                                                                {payment.penaltyPaused ? (
                                                                    <PlayIcon style={{ color: 'green' }} />
                                                                ) : (
                                                                    <PauseIcon style={{ color: 'red' }} />
                                                                )}
                                                            </IconButton>
                                                            <IconButton title="Exonerar Mora" onClick={() => handleOpenExonerateDialog(payment)}>
                                                                <MoneyOffIcon />
                                                            </IconButton>
                                                            <IconButton title="Editar Número de Cuenta" onClick={() => handleOpenBankAccountDialog(payment)}>
                                                                <AccountBalanceWalletIcon />
                                                            </IconButton>
                                                            <IconButton title="Editar Nota" onClick={() => handleOpenNotesDialog(payment)}>
                                                                <NoteAltIcon />
                                                            </IconButton>
                                                            <IconButton
                                                                title="Ver Historial de Pagos"
                                                                onClick={() => handleOpenUserHistoryDialog(payment)}
                                                            >
                                                                <HistoryIcon />
                                                            </IconButton>
                                                        </TableCell>
                                                        <TableCell>{apellidoFam}</TableCell>
                                                        <TableCell>{cantEst}</TableCell>
                                                        <TableCell>{payment.finalStatus}</TableCell>
                                                        <TableCell>{familyDetail?.routeType || ''}</TableCell>
                                                        <TableCell>{familyDetail?.razonSocial || ''}</TableCell>
                                                        <TableCell>{familyDetail?.nit || ''}</TableCell>
                                                        <TableCell>
                                                            {payment.nextPaymentDate
                                                                ? moment.parseZone(payment.nextPaymentDate).format('DD/MM/YYYY')
                                                                : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {payment.lastPaymentDate
                                                                ? moment.parseZone(payment.lastPaymentDate).format('DD/MM/YYYY')
                                                                : '—'}
                                                        </TableCell>
                                                        <TableCell>Q {mt.toFixed(2)}</TableCell>
                                                        <TableCell>Q {lo.toFixed(2)}</TableCell>
                                                        <TableCell>Q {pen.toFixed(2)}</TableCell>
                                                        <TableCell>Q {td.toFixed(2)}</TableCell>
                                                        <TableCell>Q {cb.toFixed(2)}</TableCell>
                                                        <TableCell>Q {Number(familyDetail?.specialFee || 0).toFixed(2)}</TableCell>
                                                        <TableCell>{payment.bankAccountNumber || ''}</TableCell>
                                                        <TableCell>
                                                            {payment.receiptNumber || ''}
                                                            <IconButton
                                                                size="small"
                                                                title="Editar Recibo"
                                                                onClick={() => handleOpenReceiptDialog(payment)}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                        <TableCell>{payment.User?.state === 1 ? 'Sí' : 'No'}</TableCell>
                                                        <TableCell>
                                                            <Switch
                                                                checked={!!familyDetail?.requiresInvoice}
                                                                onChange={(e) => handleToggleInvoiceNeed(payment, e.target.checked)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>{payment.notes || ''}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <TablePagination
                                    component="div"
                                    count={totalCount}
                                    page={page}
                                    onPageChange={(e, newPage) => handleChangePage(schId, e, newPage)}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={(e) => handleChangeRowsPerPage(schId, e)}
                                    rowsPerPageOptions={[5, 10, 25]}
                                    labelRowsPerPage="Filas por página"
                                />
                            </Paper>
                        )}
                    </div>
                );
            })}

            {/* SECCIÓN DE PAGOS EXTRAORDINARIOS */}
            <ExtraordinaryPaymentSection onPaymentCreated={(newExtraPayment) => {
                console.log('Nuevo pago extraordinario registrado:', newExtraPayment);
            }} />

            {/* Dialog Email */}
            <Dialog open={openEmailDialog} onClose={handleCloseEmailDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Enviar Correo al Padre</DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        label="Asunto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Mensaje"
                        type="text"
                        fullWidth
                        multiline
                        rows={4}
                        variant="outlined"
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                    />
                    <Button variant="outlined" component="label" sx={{ mt: 2 }}>
                        Adjuntar Archivos
                        <input
                            type="file"
                            multiple
                            hidden
                            onChange={(e) => {
                                setAttachments(e.target.files);
                            }}
                        />
                    </Button>
                    {attachments?.length > 0 && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {Array.from(attachments).map((f) => f.name).join(', ')}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEmailDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSendEmail}>
                        Enviar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Boletas */}
            <Dialog open={openReceiptsDialog} onClose={handleCloseReceiptsDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Boletas de Pago de {fatherName}</DialogTitle>
                <DialogContent dividers style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {fatherReceipts.length === 0 ? (
                        <Typography>No hay boletas.</Typography>
                    ) : (
                        fatherReceipts.map((rcpt) => (
                            <div key={rcpt.id} style={{ marginBottom: '16px' }}>
                                <Typography variant="body1">
                                    Subida el: {moment(rcpt.uploadedAt).format('DD/MM/YYYY HH:mm')}
                                </Typography>
                                <img
                                    src={rcpt.fileUrl}
                                    alt="Boleta"
                                    style={{
                                        maxWidth: '100%',
                                        marginTop: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleImageClick(rcpt.fileUrl)}
                                />
                            </div>
                        ))
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseReceiptsDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Zoom/Pan Boleta */}
            <Dialog open={openImageDialog} onClose={handleCloseImageDialog} maxWidth="xl" fullWidth>
                <DialogTitle>Vista de la Boleta</DialogTitle>
                <DialogContent
                    dividers
                    style={{ width: '100%', height: '600px', position: 'relative', overflow: 'hidden' }}
                    onWheel={handleWheelZoom}
                >
                    {selectedImageUrl ? (
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: dragging ? 'grabbing' : 'grab'
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <img
                                src={selectedImageUrl}
                                alt="BoletaZoom"
                                style={{
                                    position: 'absolute',
                                    left: `${pos.x}px`,
                                    top: `${pos.y}px`,
                                    transform: `scale(${zoomScale})`,
                                    transformOrigin: 'top left',
                                    maxWidth: 'none',
                                    maxHeight: 'none'
                                }}
                            />
                        </div>
                    ) : (
                        <Typography>No se cargó la boleta</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <IconButton onClick={() => setZoomScale((z) => Math.max(0.3, z - 0.1))} title="Zoom Out">
                        <ZoomOutIcon />
                    </IconButton>
                    <IconButton onClick={() => setZoomScale((z) => Math.min(4, z + 0.1))} title="Zoom In">
                        <ZoomInIcon />
                    </IconButton>
                    <Button onClick={handleCloseImageDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Registrar Pago */}
            <Dialog open={openRegisterPayDialog} onClose={handleCloseRegisterPayDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Registrar Pago</DialogTitle>
                <DialogContent>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={registerPaymentData.isMultipleMonths}
                                onChange={(e) => handleSelectMultipleMonths(e.target.checked)}
                                disabled={
                                    !registerPaymentData.isMultipleMonths &&
                                    (registerPaymentData.isFullPayment ||
                                        (registerPaymentData.amountPaid && parseFloat(registerPaymentData.amountPaid) > 0))
                                }
                            />
                        }
                        label="Más de un mes"
                    />
                    {registerPaymentData.isMultipleMonths && (
                        <TextField
                            label="Cantidad de meses"
                            margin="dense"
                            type="number"
                            fullWidth
                            variant="outlined"
                            value={registerPaymentData.monthsCount}
                            onChange={(e) => handleMonthsCountChange(e.target.value)}
                        />
                    )}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={registerPaymentData.isFullPayment}
                                onChange={(e) => handleSelectFullPayment(e.target.checked)}
                                disabled={
                                    !registerPaymentData.isFullPayment &&
                                    (registerPaymentData.isMultipleMonths ||
                                        (registerPaymentData.amountPaid && parseFloat(registerPaymentData.amountPaid) > 0))
                                }
                            />
                        }
                        label="Pago Completo"
                    />
                    <TextField
                        label="Monto Pagado (Q)"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={registerPaymentData.amountPaid}
                        onChange={(e) => handleAmountPaidManual(e.target.value)}
                        disabled={registerPaymentData.isMultipleMonths || registerPaymentData.isFullPayment}
                    />
                    <TextField
                        label="Fecha del Pago"
                        type="date"
                        margin="dense"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={registerPaymentData.paymentDate}
                        onChange={(e) =>
                            setRegisterPaymentData({ ...registerPaymentData, paymentDate: e.target.value })
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRegisterPayDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleRegisterPayment}>
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Actualizar Número de Cuenta */}
            <Dialog open={openBankAccountNumberDialog} onClose={handleCloseBankAccountNumberDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Actualizar Número de Cuenta Bancaria</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Número de Cuenta Bancaria"
                        fullWidth
                        margin="dense"
                        value={bankAccountNumberValue}
                        onChange={(e) => setBankAccountNumberValue(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseBankAccountNumberDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveBankAccountNumber}>Guardar</Button>
                </DialogActions>
            </Dialog>

            {/* Exonerar Mora */}
            <Dialog open={openExonerateDialog} onClose={handleCloseExonerateDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Exonerar Mora</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Monto a Exonerar"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={exonerateAmount}
                        onChange={(e) => setExonerateAmount(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseExonerateDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleExoneratePenalty}>Exonerar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Editar Nota */}
            <Dialog open={openNotesDialog} onClose={handleCloseNotesDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Editar Nota</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Nota"
                        value={notesDraftDialog}
                        onChange={e => setNotesDraftDialog(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={6}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseNotesDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveNotesDialog}>Guardar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Editar Número de Recibo */}
            <Dialog open={openReceiptDialog} onClose={handleCloseReceiptDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Editar Número de Recibo</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Número de Recibo"
                        value={receiptNumberDraft}
                        onChange={e => setReceiptNumberDraft(e.target.value)}
                        fullWidth
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseReceiptDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveReceiptDialog}>Guardar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Historial de Pagos de Usuario */}
            <Dialog open={openUserHistoryDialog} onClose={handleCloseUserHistoryDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Historial de Pagos de {userHistoryName}</DialogTitle>
                <DialogContent dividers style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <Box sx={{ mb: 2 }}>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Mes</InputLabel>
                            <Select
                                label="Mes"
                                value={userHistoryMonth}
                                onChange={handleUserHistoryMonthChange}
                            >
                                {Array.from({ length: 12 }, (_, i) => {
                                    const month = (i + 1).toString().padStart(2, '0');
                                    const value = `${moment().year()}-${month}`;
                                    return (
                                        <MenuItem key={value} value={value}>
                                            {moment(value, 'YYYY-MM').format('MMMM')}
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                    </Box>
                    {userHistoryLoading ? (
                        <Typography>Cargando...</Typography>
                    ) : userHistoryPayments.length === 0 ? (
                        <Typography>No hay historial de pagos.</Typography>
                    ) : (
                        <TableContainer component={Paper}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Apellido Familia</TableCell>
                                        <TableCell>Cant. Estudiantes</TableCell>
                                        <TableCell>Estado Final</TableCell>
                                        <TableCell>Próximo Pago</TableCell>
                                        <TableCell>Último Pago</TableCell>
                                        <TableCell>Monto Total (Q)</TableCell>
                                        <TableCell>Saldo (Q)</TableCell>
                                        <TableCell>Multa Acum. (Q)</TableCell>
                                        <TableCell>Total a Pagar (Q)</TableCell>
                                        <TableCell>Abono (Q)</TableCell>
                                        <TableCell>Número de Cuenta</TableCell>
                                        <TableCell>Factura</TableCell>
                                        <TableCell>Exoneración (Q)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {userHistoryPayments.map((h, idx) => (
                                        <TableRow key={h.id || idx}>
                                            <TableCell>{h.familyLastName}</TableCell>
                                            <TableCell>{h.studentCount}</TableCell>
                                            <TableCell>{h.finalStatus}</TableCell>
                                            <TableCell>
                                                {h.nextPaymentDate
                                                    ? moment.parseZone(h.nextPaymentDate).format('DD/MM/YYYY')
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {h.lastPaymentDate
                                                    ? moment.parseZone(h.lastPaymentDate).format('DD/MM/YYYY')
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {parseFloat(h.montoTotal).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {parseFloat(h.leftover).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {parseFloat(h.accumulatedPenalty).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {parseFloat(h.totalDue).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {parseFloat(h.creditBalance).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {h.bankAccountNumber || ''}
                                            </TableCell>
                                            <TableCell>
                                                {h.requiresInvoice ? 'Sí' : 'No'}
                                            </TableCell>
                                            <TableCell>
                                                {parseFloat(h.exoneratedPenaltyAmount || 0).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseUserHistoryDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <PaymentHistorySection refresh={paymentHistoryRefresh} />

            {/* SECCIÓN DE ANÁLISIS DE PAGOS */}
            <Box sx={{ mt: 6, mb: 2 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Análisis General de Pagos
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <FormControl variant="outlined" size="small" sx={{ width: 220 }}>
                        <InputLabel>Colegio (Análisis)</InputLabel>
                        <Select
                            label="Colegio (Análisis)"
                            value={analysisSchoolId}
                            onChange={(e) => {
                                setAnalysisSchoolId(e.target.value);
                                fetchPaymentsAnalysis(e.target.value);
                            }}
                        >
                            <MenuItem value="">Todos</MenuItem>
                            {schools.map((sch) => (
                                <MenuItem key={sch.id} value={sch.id}>
                                    {sch.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {analysisData && (
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ mb: 3, p: 2, background: '#f9fafb', borderRadius: 2, boxShadow: 1 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Total Familias: </strong></Typography>
                                <Typography variant="h6">{analysisData.totalPayments}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Familias Pagadas: </strong></Typography>
                                <Typography variant="h6">{pagadoCount}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Familias en Mora: </strong></Typography>
                                <Typography variant="h6">{moraCount}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Familias Pendientes: </strong></Typography>
                                <Typography variant="h6">{pendienteCount}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Usuarios Activos (Alumnos):</strong></Typography>
                                <Typography variant="h6">{analysisData.totalPayments}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Ingreso Neto:</strong></Typography>
                                <Typography variant="h6">Q {Number(analysisData.netIncome ?? 0).toFixed(2)}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Ingreso por Mora:</strong></Typography>
                                <Typography variant="h6">Q {Number(analysisData.lateFeeIncome ?? 0).toFixed(2)}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Monto de ingreso a la Fecha:</strong></Typography>
                                <Typography variant="h6">Q {currentMonthEarnings.toFixed(2)}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Pendiente de Pago a la Fecha:</strong></Typography>
                                <Typography variant="h6">Q {analysisData.sumTotalDue}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={5} md={2}>
                                <Typography variant="body2"><strong>Total Descuentos Aplicados:</strong></Typography>
                                <Typography variant="h6">Q {Number(analysisData.totalSpecialFee ?? 0).toFixed(2)}</Typography>
                            </Grid>
                        </Grid>
                    </Box>                        
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom>
                                Ganancias Mensuales (Pagos + Extraordinarios)
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={combinedEarnings.map(item => ({
                                        ...item,
                                        label: moment({ year: item.year, month: item.month - 1 }).format("MMMM YYYY")
                                    }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis />
                                    <RechartsTooltip formatter={(value) => `Q ${value}`} />
                                    <Legend />
                                    <Bar dataKey="total">
                                        {combinedEarnings.map((entry, index) => {
                                            const colors = [
                                                '#0088FE', '#FFBB28', '#FF8042', '#00C49F',
                                                '#FF6633', '#9933FF', '#33CCFF', '#66CC33'
                                            ];
                                            return (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={colors[index % colors.length]}
                                                />
                                            );
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Grid>
                    </Grid>
                </Box>
            )}
        </Container>
    );
};

export default React.memo(PaymentsManagementPage);
