// src/pages/SchoolPaymentsPage.jsx

import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import moment from 'moment';
import 'moment/locale/es'; // Importar locale español
import {
    Typography,
    Box,
    CircularProgress,
    Card,
    CardContent,
    Button,
    Paper,
    TablePagination,
    Grid,
    Chip,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tabs,
    Tab,
    Switch,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { IconButton, Collapse } from '@mui/material';
// Recharts (used by PaymentsManagement analysis)
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Cell,
    Tooltip as RechartsTooltip,
    Legend,
    PieChart,
    Pie
} from 'recharts';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowBack, School as SchoolIcon, CalendarToday, InfoOutlined, People } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/GetApp';
import { getCurrentDate } from '../hooks/useCurrentDate';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import styled from 'styled-components';
import tw from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import PaymentFilters from '../components/PaymentFilters';
import PaymentTable from '../components/PaymentTable';
import ManagePaymentsModal from '../components/ManagePaymentsModal';
import ManagePeriodsModal from '../components/modals/ManagePeriodsModal';
import ExtraordinaryPaymentSection from '../components/ExtraordinaryPaymentSection';
import ReceiptsPane from '../components/ReceiptsPane';

moment.locale('es'); // Configurar moment en español
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
    border-radius: 12px;
    padding: 8px 0;
`;

const SectionCard = styled(Card)`
    ${tw`mb-4`}
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
`;

const ChipsRow = styled(Box)`
    ${tw`mb-3`}
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
`;

// summary is rendered inline as a horizontal chip row

const SchoolPaymentsPage = () => {
    useContext(AuthContext); // keep context hook for future auth-based features
    const navigate = useNavigate();
    const location = useLocation();
    const { schoolYear, schoolId } = useParams();

    const [school, setSchool] = useState(location.state?.school || null);
    const [allSchools, setAllSchools] = useState([]);
    // paymentsAll stores the full dataset fetched from server. filtered is the client-side filtered pageable set.
    const [paymentsAll, setPaymentsAll] = useState([]);
    // (paymentsAll is the complete dataset; avoid relying on deprecated global `payments` identifier)
    const [filtered, setFiltered] = useState([]);
    // Sorting (moved to parent so sorting applies to full filtered set before pagination)
    const [orderBy, setOrderBy] = useState('familyLastName');
    const [order, setOrder] = useState('asc');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [autoDebitFilter, setAutoDebitFilter] = useState('');
    const [serviceStatusFilter, setServiceStatusFilter] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [countersView, setCountersView] = useState('payment'); // 'payment' o 'service'
    useEffect(() => {
        if (statusFilter) setShowDeleted(false);
    }, [statusFilter]);
    // client-side pagination state (we fetch all data once and paginate locally)
    const [page, setPage] = useState(0); // UI page (0-based)
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalPayments, setTotalPayments] = useState(0);
    const [totalPaidCount, setTotalPaidCount] = useState(0);
    const [totalMoraCount, setTotalMoraCount] = useState(0);
    const [totalPendingCount, setTotalPendingCount] = useState(0);
    const [totalInactiveCount, setTotalInactiveCount] = useState(0);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    // Loading indicator for initial data fetch
    const [loading, setLoading] = useState(true);
    // Analysis data (short version of PaymentsManagementPage analysis)
    const [analysisData, setAnalysisData] = useState(null);
    const [combinedEarnings, setCombinedEarnings] = useState([]);
    // collapsed states: initially both collapsed
    const [collapsedAnalysis, setCollapsedAnalysis] = useState(true);
    const [collapsedExtra, setCollapsedExtra] = useState(true);

    // Indicators derived from analysisData/combinedEarnings
    // IMPORTANTE: Solo contar usuarios activos (state !== 0)
    // V2: Estados de pago son CONFIRMADO, ADELANTADO, PENDIENTE, EN_PROCESO, MORA, ATRASADO
    // El estado INACTIVO es exclusivo del serviceStatus (estado del servicio), no del pago
    const confirmadoCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'CONFIRMADO')?.count || 0;
    const adelantadoCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'ADELANTADO')?.count || 0;
    const pagadoCount = confirmadoCount + adelantadoCount; // CONFIRMADO + ADELANTADO = pagos al día
    const moraCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'MORA')?.count || 0;
    const atrasadoCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'ATRASADO')?.count || 0;
    const enProcesoCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'EN_PROCESO')?.count || 0;
    const pendienteCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'PENDIENTE')?.count || 0;
    const inactivoCount = paymentsAll.filter(p => (p.serviceStatus || p.User?.FamilyDetail?.serviceStatus) === 'INACTIVE').length;
    const eliminadoCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'ELIMINADO')?.count || 0;
    const currentMonthEarnings = combinedEarnings.find(item =>
        item.year === moment().year() && item.month === (moment().month() + 1)
    )?.total || 0;

    // KPIs adicionales para toma de decisiones
    const totalFamilias = analysisData?.totalPayments || totalPayments;
    const familiasActivas = totalFamilias - inactivoCount;
    const tasaPago = familiasActivas > 0 ? ((pagadoCount / familiasActivas) * 100).toFixed(1) : 0;
    const tasaMora = familiasActivas > 0 ? ((moraCount / familiasActivas) * 100).toFixed(1) : 0;
    const ingresoTotal = Number(analysisData?.netIncome || 0);
    const ingresoMora = Number(analysisData?.lateFeeIncome || 0);
    const totalPendiente = Number(analysisData?.sumTotalDue || 0);
    const totalDescuentos = Number(analysisData?.totalSpecialFee || 0);
    const moraPendiente = Number(analysisData?.totals?.penaltyDue || 0);
    const creditoAcumulado = Number(analysisData?.totals?.creditBalance || 0);
    
    // Promedios y proyecciones
    const promedioIngresoPorFamilia = familiasActivas > 0 ? (ingresoTotal / familiasActivas).toFixed(2) : 0;
    const ingresoMensualPromedio = combinedEarnings.length > 0 
        ? (combinedEarnings.reduce((acc, item) => acc + Number(item.total || 0), 0) / combinedEarnings.filter(i => i.total > 0).length || 1).toFixed(2)
        : 0;
    
    // Eficiencia de cobro: (Ingreso Real / Ingreso Potencial) * 100
    const ingresoPotencial = Number(analysisData?.totals?.netMonthlyFee || 0) * (combinedEarnings.filter(i => i.total > 0).length || 1);
    const eficienciaCobro = ingresoPotencial > 0 ? ((ingresoTotal / ingresoPotencial) * 100).toFixed(1) : 0;
    
    // Contadores de estado del servicio (calculados desde paymentsAll)
    const serviceActiveCount = paymentsAll.filter(p => {
        const serviceStatus = p.serviceStatus || p.User?.FamilyDetail?.serviceStatus;
        return serviceStatus === 'ACTIVE';
    }).length;
    const servicePausedCount = paymentsAll.filter(p => {
        const serviceStatus = p.serviceStatus || p.User?.FamilyDetail?.serviceStatus;
        return serviceStatus === 'PAUSED';
    }).length;
    const serviceSuspendedCount = paymentsAll.filter(p => {
        const serviceStatus = p.serviceStatus || p.User?.FamilyDetail?.serviceStatus;
        return serviceStatus === 'SUSPENDED';
    }).length;
    const serviceInactiveCount = paymentsAll.filter(p => {
        const serviceStatus = p.serviceStatus || p.User?.FamilyDetail?.serviceStatus;
        return serviceStatus === 'INACTIVE';
    }).length;
    
    // Tendencia (comparar mes actual vs mes anterior)
    const currentMonth = moment().month() + 1;
    const currentYear = moment().year();
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevMonthEarnings = combinedEarnings.find(item => 
        item.year === prevYear && item.month === prevMonth
    )?.total || 0;
    const tendencia = prevMonthEarnings > 0 
        ? (((currentMonthEarnings - prevMonthEarnings) / prevMonthEarnings) * 100).toFixed(1)
        : 0;

    useEffect(() => {
        (async () => {
            setLoading(true);
            // If the current `school` is missing or does not match the requested `schoolId`, fetch it.
            if (!school || String(school.id) !== String(schoolId)) await fetchSchool();
            // trigger batch recalc for this school before loading payments
            try {
                // Trigger background recalculation so UI load is not blocked.
                // Fire-and-forget: do not await the request.
                api.post('/payments/recalc-school', { schoolId, schoolYear, background: true }).catch(err => {
                    // Log but don't block UI
                    console.error('Background recalc failed to start', err);
                });
                // Trigger auto-debits for this school as a fire-and-forget operation
                api.post('/payments/process-auto-debits', { schoolId, schoolYear }).catch(err => {
                    console.error('Background auto-debits failed to start', err);
                });
            } catch (e) {
                // ignore errors from recalc initiation; continue to fetch payments
            }
            // load all payments once (client-side pagination/filtering)
            await fetchAllPayments(statusFilter, search);
            // fetch analysis after payments loaded
            await fetchPaymentsAnalysis(schoolId);
            setLoading(false);
            // Nothing to load here: penalty is per-school and fetchSchool() populates it.
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    // keep analysis updated when paymentsAll change (best-effort)
    useEffect(() => {
        fetchPaymentsAnalysis(schoolId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentsAll]);

    const fetchSchool = async () => {
        try {
            const res = await api.get(`/schools/${schoolId}`);
            setSchool(res.data.school || null);
        } catch (err) {
            console.error('fetchSchool', err);
        }
    };

    const fetchAllSchools = useCallback(async () => {
        try {
            const res = await api.get('/schools');
            setAllSchools(res.data.schools || []);
        } catch (err) {
            console.error('fetchAllSchools', err);
        }
    }, []);

    // Fetch all payments for the school in one request and store locally.
    // Tries a single large request first and falls back to iterative paging if backend enforces pagination.
    const fetchAllPayments = async (status = '', q = '') => {
        if (!schoolId || !schoolYear) return;
        try {
            const st = status ? String(status).toUpperCase().trim() : '';
            const qq = q ? String(q).trim() : '';
            const params = { schoolId, schoolYear, page: 1, limit: 10000 };

            // MORA y PENDIENTE son valores de finalStatus → filtrar en el servidor.
            // PAGADO (= CONFIRMADO + ADELANTADO) e INACTIVO (= serviceStatus INACTIVE)
            // se manejan solo en cliente porque no son un único valor de columna.
            const SERVER_FINAL_STATUS = new Set(['MORA', 'PENDIENTE', 'EN_PROCESO', 'ATRASADO', 'CONFIRMADO', 'ADELANTADO', 'ELIMINADO']);
            if (st && SERVER_FINAL_STATUS.has(st)) params.finalStatus = st;
            // PAGADO e INACTIVO: no enviar filtro al servidor, el cliente filtra
            if (qq) params.search = qq;
            // include auto-debit filter if set: 'yes'|'no'
            if (autoDebitFilter === 'yes') params.autoDebit = true;
            if (autoDebitFilter === 'no') params.autoDebit = false;
            const res = await api.get('/payments', { params });
            let arr = res.data.payments || res.data.rows || [];
            let total = typeof res.data.totalCount === 'number'
                ? res.data.totalCount
                : (typeof res.data.count === 'number' ? res.data.count : (res.data.total || arr.length));

            // If the backend reported more records than returned, fetch iteratively
            if (total && Array.isArray(arr) && arr.length < total) {
                const per = Math.max(arr.length || 500, 500);
                const pages = Math.ceil(Number(total) / per);
                const all = [];
                for (let p = 0; p < pages; p++) {
                    const serverFilter = st && SERVER_FINAL_STATUS.has(st) ? { finalStatus: st } : {};
                    const r = await api.get('/payments', { params: { schoolId, schoolYear, page: p + 1, limit: per, ...serverFilter, ...(qq ? { search: qq } : {}) } });
                    const part = r.data.payments || r.data.rows || [];
                    if (Array.isArray(part) && part.length > 0) all.push(...part);
                }
                if (all.length > 0) arr = all;
            }

            setPaymentsAll(arr);
            setFiltered(arr);
            setTotalPayments(total || (Array.isArray(arr) ? arr.length : 0));
            
            // IMPORTANTE: Excluir usuarios inactivos de los conteos de PAGADO/PENDIENTE/MORA
            const isUserActive = (pmt) => Number(pmt.User?.state) !== 0;
            const activePayments = arr.filter(isUserActive);
            const inactivePayments = arr.filter(pmt => !isUserActive(pmt));
            
            // V2: CONFIRMADO + ADELANTADO = Al día
            const paidPayments = activePayments.filter(pmt => ['CONFIRMADO', 'ADELANTADO'].includes((pmt.finalStatus||'').toUpperCase()));
            setTotalPaidCount(typeof res.data.totalPaidCount === 'number' ? res.data.totalPaidCount : paidPayments.length);
            setTotalPendingCount(typeof res.data.totalPendingCount === 'number' ? res.data.totalPendingCount : activePayments.filter(pmt => (pmt.finalStatus||'').toUpperCase() === 'PENDIENTE').length);
            setTotalMoraCount(typeof res.data.totalMoraCount === 'number' ? res.data.totalMoraCount : activePayments.filter(pmt => (pmt.finalStatus||'').toUpperCase() === 'MORA').length);
            setTotalInactiveCount(typeof res.data.totalInactiveCount === 'number' ? res.data.totalInactiveCount : inactivePayments.length);
            setPage(0);
        } catch (err) {
            console.error('Error cargando pagos:', err);
            if (err.response?.status === 403) {
                setSnackbar({ open: true, message: `Sin permisos: ${err.response?.data?.message || 'No autorizado'}`, severity: 'error' });
            } else {
            setSnackbar({ open: true, message: 'Error cargando pagos', severity: 'error' });
            }
        }
    };

    // Small analysis fetch: tries backend endpoint /payments/analysis or derives simple metrics
    const fetchPaymentsAnalysis = async (schId) => {
        if (!schId) return;
        try {
            const res = await api.get('/payments/analysis', { params: { schoolId: schId, schoolYear, excludeInactive: true } });
            // expected shape: { statusDistribution: [...], monthlyEarnings: [...] }
            const data = res.data || null;
            // Keep ELIMINADO in statusDistribution so the counter chip reads the correct value.
            // Only exclude it from totalPayments (active-family count).
            const originalDist = Array.isArray(data?.statusDistribution) ? data.statusDistribution : [];
            const eliminatedEntry = originalDist.find(s => (s.finalStatus || '').toUpperCase() === 'ELIMINADO');
            const eliminatedCount = eliminatedEntry?.count || 0;
            const sanitized = {
                ...data,
                statusDistribution: originalDist,
                totalPayments: Math.max(0, (data?.totalPayments || 0) - eliminatedCount)
            };
            setAnalysisData(sanitized);
            setCombinedEarnings(Array.isArray(data?.monthlyEarnings) ? data.monthlyEarnings : []);
    } catch (e) {
            // fallback: derive from current payments (best-effort)
            // IMPORTANTE: Separar familias con servicio inactivo (serviceStatus=INACTIVE)
            try {
                const isServiceInactive = (p) => (p.serviceStatus || p.User?.FamilyDetail?.serviceStatus) === 'INACTIVE';
                const activePayments = (paymentsAll || []).filter(p => !isServiceInactive(p));
                const inactivePayments = (paymentsAll || []).filter(isServiceInactive);
                
                // V2: Estados de pago son CONFIRMADO, ADELANTADO, PENDIENTE, EN_PROCESO, MORA, ATRASADO
                const confirmado = activePayments.filter(p => (p.finalStatus||'').toUpperCase() === 'CONFIRMADO').length;
                const adelantado = activePayments.filter(p => (p.finalStatus||'').toUpperCase() === 'ADELANTADO').length;
                const mora = activePayments.filter(p => (p.finalStatus||'').toUpperCase() === 'MORA').length;
                const atrasado = activePayments.filter(p => (p.finalStatus||'').toUpperCase() === 'ATRASADO').length;
                const enProceso = activePayments.filter(p => (p.finalStatus||'').toUpperCase() === 'EN_PROCESO').length;
                const pend = activePayments.filter(p => (p.finalStatus||'').toUpperCase() === 'PENDIENTE').length;
                const inactivo = inactivePayments.length;
                
                const derived = { statusDistribution: [
                    { finalStatus: 'CONFIRMADO', count: confirmado },
                    { finalStatus: 'ADELANTADO', count: adelantado },
                    { finalStatus: 'MORA', count: mora },
                    { finalStatus: 'ATRASADO', count: atrasado },
                    { finalStatus: 'EN_PROCESO', count: enProceso },
                    { finalStatus: 'PENDIENTE', count: pend },
                    { finalStatus: 'INACTIVO', count: inactivo }
                ] };
                setAnalysisData(derived);
                // build a tiny combinedEarnings for last 6 months with zeros
                const now = moment();
                const months = [];
                for (let i = 5; i >= 0; i--) {
                    const m = moment(now).subtract(i, 'months');
                    months.push({ year: m.year(), month: m.month() + 1, total: 0 });
                }
                setCombinedEarnings(months);
            } catch (e2) {
                // ignore
            }
        }
    };

    // reference analysisData to avoid lint warnings when it's only set by fetch
    React.useEffect(() => {
        // noop: keep analysisData referenced for potential future effects
    }, [analysisData]);

    const fetchExtraordinaryEarnings = async () => {
        try {
            const res = await api.get('/payments/extraordinary/analysis', { params: { schoolId } });
            return res.data.monthlyEarnings || [];
        } catch (error) {
            console.error('fetchExtraordinaryEarnings error', error);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisData]);

    const combineEarnings = (normalEarnings, extraEarnings) => {
        const map = {};
        (normalEarnings || []).forEach(item => {
            const key = `${item.year}-${item.month}`;
            map[key] = (map[key] || 0) + (item.total || 0);
        });
        (extraEarnings || []).forEach(item => {
            const key = `${item.year}-${item.month}`;
            map[key] = (map[key] || 0) + (item.total || 0);
        });
        const combined = Object.keys(map).map(key => {
            const [year, month] = key.split('-').map(Number);
            return { year, month, total: map[key] };
        });
        combined.sort((a, b) => (a.year - b.year) || (a.month - b.month));
        return combined;
    };

    // Register global refresh after helper fetch functions are defined
    useRegisterPageRefresh(async () => {
        setLoading(true);
        try {
            await fetchAllPayments();
            await fetchPaymentsAnalysis(schoolId);
        } finally {
            setLoading(false);
        }
    }, [fetchAllPayments, fetchPaymentsAnalysis, schoolId]);

    // Extraordinary payments are handled by the shared ExtraordinaryPaymentSection component

    // When using server-side filtering/pagination, request server for filtered pages.
    // `filtered` will mirror `payments` (the current page returned by server).
    useEffect(() => {
        // whenever search or statusFilter change, apply client-side filtering of the already-fetched dataset
        setPage(0);
        try {
            const st = statusFilter ? String(statusFilter).toUpperCase().trim() : '';
            const qq = search ? String(search).toLowerCase().trim() : '';
            const arr = (paymentsAll || []).filter(p => {
                // Determinar si la familia tiene servicio inactivo (serviceStatus = INACTIVE)
                const isServiceInactive = (p.serviceStatus || p.User?.FamilyDetail?.serviceStatus) === 'INACTIVE';
                const isDeleted = !!p.User?.FamilyDetail?.deleted;

                if (st) {
                    if (st === 'INACTIVO') {
                        // Filtrar solo familias con servicio inactivo
                        if (!isServiceInactive) return false;
                    } else if (st === 'ELIMINADO') {
                        // Filtrar solo eliminados
                        if (!isDeleted) return false;
                    } else {
                        // Para otros estados, excluir familias con servicio inactivo y filtrar por finalStatus
                        if (isServiceInactive) return false;
                        if (isDeleted && !showDeleted) return false;
                        const s = (p.finalStatus || p.status || '').toUpperCase();
                        
                        // V2: PAGADO incluye CONFIRMADO y ADELANTADO
                        if (st === 'PAGADO') {
                            if (!['CONFIRMADO', 'ADELANTADO'].includes(s)) return false;
                        } else {
                            if (s !== st) return false;
                        }
                    }
                } else {
                    // No se seleccionó estado: aplicar reglas por defecto
                    if (isDeleted && !showDeleted) return false;

                    const s = (p.finalStatus || p.status || '').toUpperCase();
                    const defaultAllowed = ['CONFIRMADO', 'ADELANTADO', 'PENDIENTE', 'MORA', 'EN_PROCESO'];
                    if (!(defaultAllowed.includes(s) || (showDeleted && s === 'ELIMINADO') || isServiceInactive)) return false;
                }
                if (qq) {
                    const familyLast = (p.User?.FamilyDetail?.familyLastName || p.User?.familyLastName || '').toLowerCase();
                    if (!familyLast.includes(qq)) return false;
                }
                if (autoDebitFilter === 'yes') {
                    const auto = !!(p.automaticDebit || p.User?.FamilyDetail?.automaticDebit || p.User?.FamilyDetail?.autoDebit);
                    if (!auto) return false;
                } else if (autoDebitFilter === 'no') {
                    const auto = !!(p.automaticDebit || p.User?.FamilyDetail?.automaticDebit || p.User?.FamilyDetail?.autoDebit);
                    if (auto) return false;
                }
                // Filtrado por estado del servicio
                if (serviceStatusFilter) {
                    const paymentServiceStatus = p.serviceStatus || p.User?.FamilyDetail?.serviceStatus;
                    if (paymentServiceStatus !== serviceStatusFilter) return false;
                }
                return true;
            });
            setFiltered(arr);
            setTotalPayments(Array.isArray(arr) ? arr.length : 0);
        } catch (e) {
            console.error('filtering error', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statusFilter, paymentsAll, autoDebitFilter, showDeleted, serviceStatusFilter]);

    const handleBack = () => {
        navigate(`/admin/escuelas/${schoolYear || ''}/${schoolId}`, { state: { school, schoolYear } });
    };

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
        // reset to first page when sorting changes
        setPage(0);
    };

    // Client-side pagination: slice the filtered array for the current page
    // Sorting helpers (parent-level)
    const getValueForKey = (p, key) => {
        try {
            if (key === 'familyLastName') return (p.User?.FamilyDetail?.familyLastName || p.User?.familyLastName || '').toString().toLowerCase();
            if (key === 'students') return p.User?.FamilyDetail?.studentsCount || p.studentCount || 0;
            if (key === 'routeType') return (p.User?.FamilyDetail?.routeType || '').toString().toLowerCase();
            if (key === 'lastPayment') return p.lastPaymentDate || p.lastPaidDate || p.lastPayment || '';
            if (key === 'discount') return Number(p.User?.FamilyDetail?.specialFee ?? p.specialFee ?? 0) || 0;
            if (key === 'invoice') return !!(p.User?.FamilyDetail?.requiresInvoice || p.requiresInvoice) ? 1 : 0;
            if (key === 'status') return (p.finalStatus || '').toString().toLowerCase();
            if (key === 'serviceStatus') return (p.serviceStatus || p.User?.FamilyDetail?.serviceStatus || '').toString().toLowerCase();
        } catch (e) {
            return '';
        }
        return '';
    };

    const stableSort = (array, comparator) => {
        const stabilized = array.map((el, index) => [el, index]);
        stabilized.sort((a, b) => {
            const orderRes = comparator(a[0], b[0]);
            if (orderRes !== 0) return orderRes;
            return a[1] - b[1];
        });
        return stabilized.map(el => el[0]);
    };

    const sortedFiltered = React.useMemo(() => {
        if (!Array.isArray(filtered)) return [];
        const comparator = (a, b) => {
            const va = getValueForKey(a, orderBy);
            const vb = getValueForKey(b, orderBy);
            if (va < vb) return order === 'asc' ? -1 : 1;
            if (va > vb) return order === 'asc' ? 1 : -1;
            return 0;
        };
        return stableSort(filtered.slice(), comparator);
    }, [filtered, order, orderBy]);

    const pageSlice = React.useMemo(() => {
        const start = page * rowsPerPage;
        return (sortedFiltered || []).slice(start, start + rowsPerPage);
    }, [sortedFiltered, page, rowsPerPage]);

    // Dialog states
    const [openRegisterDialog, setOpenRegisterDialog] = useState(false);
    const [paymentTab, setPaymentTab] = useState(0); // 0 = Pago de Tarifa, 1 = Pago de Mora
    const [registerPaymentTarget, setRegisterPaymentTarget] = useState(null);
    const [registerAmount, setRegisterAmount] = useState('');
    const [registerPaymentExtra, setRegisterPaymentExtra] = useState({
        paymentDate: moment().format('YYYY-MM-DD'),
        numeroBoleta: '',
        extraordinaryDiscount: 0,
        bankAccountNumber: ''
    });
    // (extraordinary quick-register removed; use ExtraordinaryPaymentSection)
    
    // Payment summary calculation for real-time penalty exoneration display
    const [paymentSummary, setPaymentSummary] = useState(null);
    const [loadingPaymentSummary, setLoadingPaymentSummary] = useState(false);

    // Payment histories loading flag (for receipts pane inside Registrar Pago dialog)
    const [regHistLoading, setRegHistLoading] = useState(false);
    const [regHistPage] = useState(0);
    const [regHistLimit] = useState(10);
    if (!global.__paymentHistCache) global.__paymentHistCache = new Map();
    const regHistCacheRef = React.useRef(global.__paymentHistCache);
    // Helper to invalidate all cached payment-history entries for a given userId
    const invalidatePaymentHistCacheForUser = useCallback((uid) => {
        try {
            if (!uid || !regHistCacheRef.current) return;
            const prefix = `${uid}:`;
            for (const k of Array.from(regHistCacheRef.current.keys())) {
                if (k.startsWith(prefix)) regHistCacheRef.current.delete(k);
            }
        } catch (e) {
            console.warn('Error invalidating payment history cache for user', uid, e);
        }
    }, []);
    const [uploadedReceipts, setUploadedReceipts] = useState([]);
    const [uploadedReceiptsLoading, setUploadedReceiptsLoading] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [receiptZoom, setReceiptZoom] = useState(1);
    // Month filter for boletas (format: YYYY-MM)
    const [boletaMonth, setBoletaMonth] = useState('');

    // derive month options only from uploaded receipts (Boletas should show uploaded files only)
    const boletaMonthOptions = React.useMemo(() => {
        const setMonths = new Set();
        const pushDate = (d) => {
            if (!d) return;
            try {
                const m = moment.parseZone(d).format('YYYY-MM');
                setMonths.add(m);
            } catch (e) { /* ignore */ }
        };
        (uploadedReceipts || []).forEach(r => pushDate(r.createdAt || r.uploadedAt || r.date));
        const arr = Array.from(setMonths).sort().reverse();
        return arr;
    }, [uploadedReceipts]);

    const filteredUploadedReceipts = React.useMemo(() => {
        if (!boletaMonth) return uploadedReceipts || [];
        return (uploadedReceipts || []).filter(r => {
            const d = r.createdAt || r.uploadedAt || r.date;
            if (!d) return false;
            return moment.parseZone(d).format('YYYY-MM') === boletaMonth;
        });
    }, [uploadedReceipts, boletaMonth]);


    const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
    const [receiptTarget, setReceiptTarget] = useState(null);
    const [receiptNumberDraft, setReceiptNumberDraft] = useState('');
    
    // Pay Penalty dialog states
    const [openPayPenaltyDialog, setOpenPayPenaltyDialog] = useState(false);
    const [payPenaltyAmount, setPayPenaltyAmount] = useState('');
    const [payPenaltyBoleta, setPayPenaltyBoleta] = useState('');
    const [payPenaltyAccount, setPayPenaltyAccount] = useState('');
    const [payPenaltyDate, setPayPenaltyDate] = useState(moment().format('YYYY-MM-DD'));
    
    // Retroactive penalty calculation states
    const [retroactivePenalty, setRetroactivePenalty] = useState(null);
    const [isRetroactivePayment, setIsRetroactivePayment] = useState(false);

    // Exonerate/Discount Penalty dialog states
    const [openDiscountPenaltyDialog, setOpenDiscountPenaltyDialog] = useState(false);
    const [discountPenaltyAmount, setDiscountPenaltyAmount] = useState('');
    const [discountPenaltyType, setDiscountPenaltyType] = useState('DISCOUNT');
    const [discountPenaltyNotes, setDiscountPenaltyNotes] = useState('');
    
    // Exonerate toggle
    const [isExonerating, setIsExonerating] = useState(false);
    const [exonerateAmount, setExonerateAmount] = useState('');
    
    // New: receipt preview flow triggered from notification
    const [previewReceipt, setPreviewReceipt] = useState(null); // object { id, fileUrl, userId }
    // guard to avoid processing the same openRegister/showReceipt query multiple times
    const processedOpenRegisterRef = useRef(new Set());

    // Notas (editor)
    const [openNotesDialog, setOpenNotesDialog] = useState(false);
    const [notesTarget, setNotesTarget] = useState(null);
    const [notesDraft, setNotesDraft] = useState('');

    const [openEmailDialog, setOpenEmailDialog] = useState(false);
    const [emailTarget, setEmailTarget] = useState(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');

    // Diálogo para auto débito
    const [openAutoDebitDialog, setOpenAutoDebitDialog] = useState(false);
    const [autoDebitPayload, setAutoDebitPayload] = useState(null);

    // guard to avoid concurrent loads / re-entrancy when opening the register dialog
    const openRegisterInProgressRef = useRef(false);
    const handleOpenRegister = useCallback((payment) => {
        // prevent concurrent opens for the same flow
        if (openRegisterInProgressRef.current) return;
        openRegisterInProgressRef.current = true;

        console.log('DEBUG handleOpenRegister received payment:', {
            id: payment?.id,
            userId: payment?.userId,
            penaltyDue: payment?.penaltyDue,
            penaltyDue_type: typeof payment?.penaltyDue,
            keys: payment ? Object.keys(payment).slice(0, 10) : []
        });
        
        setRegisterPaymentTarget(payment);
        // clear any previously selected receipt when opening for a new target
        setSelectedReceipt(null);
        setReceiptZoom(1);
        setRegisterAmount('');
        setRegisterPaymentExtra({
            paymentDate: moment().format('YYYY-MM-DD'),
            numeroBoleta: payment.receiptNumber || '',
            extraordinaryDiscount: 0,
            bankAccountNumber: payment.bankAccountNumber || (school ? school.bankAccount : '') || ''
        });
        
        // Inicializar campos de la pestaña de mora con los mismos valores por defecto
        setPayPenaltyDate(moment().format('YYYY-MM-DD'));
        setPayPenaltyBoleta(payment.receiptNumber || '');
        setPayPenaltyAccount(payment.bankAccountNumber || (school ? school.bankAccount : '') || '');
        setPayPenaltyAmount('');
        setDiscountPenaltyAmount('');
        setIsExonerating(false);
        setExonerateAmount('');

    // Do not open dialog immediately. We'll open it after initial loads complete so the UI shows data-ready state.

        // load uploaded receipts and histories for this user's family (payment.User.id)
        (async () => {
            try {
                const userId = payment?.User?.id;
                setUploadedReceiptsLoading(true);
                setRegHistLoading(true);
                if (!userId) {
                    // No userId: clear receipts and loading flags and exit
                    setUploadedReceipts([]);
                    setRegHistLoading(false);
                    setUploadedReceiptsLoading(false);
                    openRegisterInProgressRef.current = false;
                    return;
                }

                // ensure schools list is loaded only when opening register (needed for account select)
                if (!allSchools || allSchools.length === 0) {
                    try { await fetchAllSchools(); } catch (e) { /* ignore */ }
                }

                // CRÍTICO: Recalcular mora primero para asegurar datos actualizados
                let updatedPayment = payment;
                if (payment?.id) {
                    try {
                        console.log('[handleOpenRegister] Recalculating payment before opening dialog...');
                        const recalcResponse = await api.post(`/payments/${payment.id}/recalc`);
                        console.log('[handleOpenRegister] Recalc response:', recalcResponse.data);
                        
                        // Obtener el payment actualizado desde el backend
                        const paymentResponse = await api.get(`/payments/${payment.id}`);
                        // El endpoint retorna { payment, currentPenalty, currentStatus, statusDetails }
                        updatedPayment = paymentResponse.data.payment;
                        console.log('[handleOpenRegister] Updated payment fetched:', updatedPayment);
                        
                        // Actualizar el target con los datos frescos
                        setRegisterPaymentTarget(updatedPayment);
                    } catch (e) {
                        console.error('[handleOpenRegister] Error recalculating/fetching payment:', e);
                        // Continue with original payment data if recalc fails
                    }
                }

                const cacheKey = `${userId}:${regHistPage}:${regHistLimit}`;
                const now = Date.now();
                const cached = regHistCacheRef.current.get(cacheKey);

                // build promises: receipts always requested, history only if not cached
                const receiptsPromise = api.get(`/parents/${userId}/receipts`).catch(e => ({ data: { receipts: [] } }));
                const histPromise = cached && (now - cached.ts) < 1000 * 60 * 5
                    ? Promise.resolve({ data: { histories: cached.data || [] }, __fromCache: true })
                    : api.get('/payments/paymenthistory', { params: { userId, page: regHistPage, limit: regHistLimit } }).catch(e => ({ data: { histories: [] } }));

                const [receiptsRes, histRes] = await Promise.all([receiptsPromise, histPromise]);

                // receipts
                setUploadedReceipts(receiptsRes.data?.receipts || []);
                setUploadedReceiptsLoading(false);

                // histories (we store in cache but don't keep them in component state currently)
                const histories = histRes.data?.histories || [];
                if (!histRes.__fromCache) regHistCacheRef.current.set(cacheKey, { ts: now, data: histories });
                setRegHistLoading(false);

                // open dialog now that initial data is ready
                setOpenRegisterDialog(true);
                // done
                openRegisterInProgressRef.current = false;
            } catch (err) {
                console.error('Error loading register histories', err);
                // ensure flags are cleared and modal still opens so user can retry / see error state
                setRegHistLoading(false);
                setUploadedReceiptsLoading(false);
                setUploadedReceipts([]);
                setOpenRegisterDialog(true);
                openRegisterInProgressRef.current = false;
            }
        })();
    }, [allSchools, fetchAllSchools, regHistPage, regHistLimit, school]);

    // Fetch payment summary for real-time penalty exoneration calculation
    // paymentId: id of payment; paymentDate: date string YYYY-MM-DD the payment will be applied
    // baseDate (optional): if provided, backend should calculate penalty starting from this date
    // Frontend will pass baseDate = nextPaymentDate when leftover != 0 so mora is calculated from nextPaymentDate
    const fetchPaymentSummary = useCallback(async (paymentId, paymentDate, baseDate = null) => {
        if (!paymentId || !paymentDate) return;
        
        setLoadingPaymentSummary(true);
        try {
            const params = { paymentDate };
            if (baseDate) params.baseDate = baseDate; // optional; backend may use this to change penalty base

            const response = await api.get(`/payments/${paymentId}/calculate-summary`, {
                params
            });
            setPaymentSummary(response.data.calculation);
        } catch (error) {
            console.error('Error calculating payment summary:', error);
            setPaymentSummary(null);
        } finally {
            setLoadingPaymentSummary(false);
        }
    }, []);

    // Recalculate summary when payment date changes
    useEffect(() => {
        if (openRegisterDialog && registerPaymentTarget?.id && registerPaymentExtra.paymentDate) {
            // If balanceDue != 0, calculate penalty starting from nextPaymentDate instead of lastPaymentDate
            const baseDate = (registerPaymentTarget?.balanceDue && Number(registerPaymentTarget.balanceDue) !== 0)
                ? registerPaymentTarget.nextPaymentDate
                : null;
            fetchPaymentSummary(registerPaymentTarget.id, registerPaymentExtra.paymentDate, baseDate);
        }
    }, [openRegisterDialog, registerPaymentTarget?.id, registerPaymentExtra.paymentDate, registerPaymentTarget?.balanceDue, registerPaymentTarget?.nextPaymentDate, fetchPaymentSummary]);
 
    // Handle query params after handleOpenRegister is defined
    useEffect(() => {
        const qs = new URLSearchParams(location.search);
        const openRegister = qs.get('openRegister') === 'true' || qs.get('openRegister') === '1';
        const userIdFromQuery = qs.get('userId');
        const receiptIdFromQuery = qs.get('receiptId');
        if (!openRegister || !userIdFromQuery || !schoolId) return;
        // avoid handling the same query repeatedly (some navigation flows re-emit location.search)
        const key = `openRegister:${location.search}`;
        if (processedOpenRegisterRef.current.has(key)) return;
        processedOpenRegisterRef.current.add(key);

        (async () => {
            try {
                // Load payments for this school (attempt larger limit to find the user's payment)
                const res = await api.get('/payments', { params: { schoolId, schoolYear, page: 1, limit: 1000 } });
                const paymentsArr = res.data.payments || res.data.rows || [];
                const found = paymentsArr.find(p => String(p.User?.id) === String(userIdFromQuery) || String(p.userId) === String(userIdFromQuery));
                if (found) {
                    // open register dialog for this payment
                    handleOpenRegister(found);
                    // If a specific receiptId was provided, try to preload it into selectedReceipt
                    if (receiptIdFromQuery) {
                        try {
                            const recRes = await api.get(`/parents/${userIdFromQuery}/receipts`);
                            const recs = recRes.data.receipts || [];
                            const matched = recs.find(r => String(r.id) === String(receiptIdFromQuery));
                            if (matched) setSelectedReceipt(matched);
                        } catch (e) {
                            // ignore receipt preload errors
                        }
                    }
                }
            } catch (e) {
                console.error('Error handling openRegister query', e);
            }
        })();
    }, [location.search, schoolId, schoolYear, handleOpenRegister]);

    // If navigation provided a payment object in location.state, open the register dialog immediately
    // NOTE: The payment from notification may not have full data. handleOpenRegister will fetch it from the query params path instead.
    useEffect(() => {
        const navPayment = location.state && location.state.payment ? location.state.payment : null;
        if (navPayment) {
            // Skip this effect if we also have openRegister query param - let the query param handler deal with it
            const qs = new URLSearchParams(location.search);
            const hasOpenRegisterParam = qs.get('openRegister') === 'true' || qs.get('openRegister') === '1';
            if (hasOpenRegisterParam) return;
            
            try {
                // directly open with provided payment object
                // avoid multiple opens when navigation state re-triggers
                const key = `navPayment:${location.search || navPayment?.id || navPayment?.User?.id || ''}`;
                if (!processedOpenRegisterRef.current.has(key)) {
                    processedOpenRegisterRef.current.add(key);
                    handleOpenRegister(navPayment);
                }
            } catch (e) {
                // ignore
            }
        }
    }, [location.state, location.search, handleOpenRegister]);

    // New: Show receipt preview when navigation/query indicates showReceipt
    useEffect(() => {
        const qs = new URLSearchParams(location.search);
        const showReceipt = qs.get('showReceipt') === 'true' || qs.get('showReceipt') === '1';
        const receiptId = qs.get('receiptId') || (location.state && location.state.receiptId) || null;
        const navPayment = location.state && location.state.payment ? location.state.payment : null;
        if (!showReceipt || !receiptId) return;

        (async () => {
            try {
                // fetch receipt info (fileUrl) for preview only
                const res = await api.get(`/parents/${navPayment?.User?.id || navPayment?.userId || qs.get('userId')}/receipts`);
                const recs = res.data.receipts || [];
                const found = recs.find(r => String(r.id) === String(receiptId));
                if (found) {
                    setPreviewReceipt(found);
                } else {
                    // No receipt found: clear any preview and do not auto-open Register
                    setPreviewReceipt(null);
                }
            } catch (e) {
                console.error('Error fetching receipt for preview', e);
                setPreviewReceipt(null);
            }
        })();
    }, [location.search, location.state, handleOpenRegister]);
    const handleConfirmRegister = async () => {
        if (!registerPaymentTarget) return;
        try {
            // Usar endpoint pay-tariff del nuevo sistema
            await api.post(`/payments/pay-tariff`, {
                paymentId: registerPaymentTarget.id,
                amount: registerAmount,
                realPaymentDate: registerPaymentExtra.paymentDate,
                receiptNumber: registerPaymentExtra.numeroBoleta,
                bankAccount: registerPaymentExtra.bankAccountNumber,
                extraordinaryDiscount: registerPaymentExtra.extraordinaryDiscount || 0,
                notes: registerPaymentExtra.extraordinaryDiscount > 0 
                    ? `Descuento extraordinario: Q${registerPaymentExtra.extraordinaryDiscount}` 
                    : undefined
            });
            
            setSnackbar({ open: true, message: 'Pago registrado exitosamente', severity: 'success' });
            setOpenRegisterDialog(false);
            
            // Invalidate cached payment histories for this user so modals will fetch fresh data
            invalidatePaymentHistCacheForUser(registerPaymentTarget?.User?.id || registerPaymentTarget?.userId);
            
            // refresh full dataset after mutation
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error(err);
            const errorMsg = err?.response?.data?.error || 'Error registrando pago';
            setSnackbar({ open: true, message: errorMsg, severity: 'error' });
        }
    };

    const handleOpenReceipt = useCallback(async (payment) => {
        setReceiptTarget(payment);
        setReceiptNumberDraft(payment.receiptNumber || '');
        setOpenReceiptDialog(true);
    }, []);
    const handleSaveReceipt = async () => {
        if (!receiptTarget) return;
        try {
            await api.put(`/payments/${receiptTarget.id}/receipt-number`, { receiptNumber: receiptNumberDraft });
            setSnackbar({ open: true, message: 'Número de recibo actualizado', severity: 'success' });
            setOpenReceiptDialog(false);
            // Invalidate cache for this user so modal will fetch fresh histories
            invalidatePaymentHistCacheForUser(receiptTarget?.User?.id || receiptTarget?.userId);
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: 'Error actualizando recibo', severity: 'error' });
        }
    };

    const handleOpenEmail = useCallback((payment) => {
        setEmailTarget(payment);
        setEmailSubject('');
        setEmailMessage('');
        setOpenEmailDialog(true);
    }, []);
    const handleSendEmail = async () => {
        if (!emailTarget) return;
        try {
            await api.post(`/payments/${emailTarget.id}/sendEmail`, { subject: emailSubject, message: emailMessage });
            setSnackbar({ open: true, message: 'Correo enviado', severity: 'success' });
            setOpenEmailDialog(false);
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: 'Error al enviar correo', severity: 'error' });
        }
    };

    // Open Manage Payments modal for a given family/payment
    const [openManageModal, setOpenManageModal] = useState(false);
    const [manageTarget, setManageTarget] = useState(null);
    const handleManagePayments = useCallback(async (payment) => {
        setManageTarget(payment);
        setOpenManageModal(true);
    }, []);

    // Open Manage Periods modal for a given family/payment
    const [openPeriodsModal, setOpenPeriodsModal] = useState(false);
    const [periodsTarget, setPeriodsTarget] = useState(null);
    const handleManagePeriods = useCallback((payment) => {
        setPeriodsTarget(payment);
        setOpenPeriodsModal(true);
    }, []);

    // Download payment history as a presentable PDF (jsPDF + autotable)
    const handleDownloadHistory = useCallback(async (payment) => {
        try {
            const userId = payment?.User?.id || payment?.userId || null;
            if (!userId) {
                setSnackbar({ open: true, message: 'Usuario no encontrado para generar reporte', severity: 'error' });
                return;
            }

            // Intentar traer el detalle completo del pago (incluye `periods`) para construir la tabla por MES.
            let paymentDetail = null;
            try {
                const detailRes = await api.get(`/payments/by-user/${userId}`);
                paymentDetail = detailRes?.data?.payment || null;
            } catch (e) {
                paymentDetail = null;
            }

            const attemptFetch = async (params) => {
                try {
                    const r = await api.get('/payments/paymenthistory', { params: { ...params, schoolYear } });
                    return r;
                } catch (e) {
                    console.error('[handleDownloadHistory] fetch error', e && e.response ? e.response.data || e.response : e);
                    throw e;
                }
            };

            // Intentar obtener transacciones del endpoint V2
            let res;
            let transactions = [];
            let histories = []; // Declarar la variable histories
            let noTransactions = false;
            
            try {
                // Primero intentar con el endpoint V2 de transacciones
                res = await api.get(`/payments/${payment.id}/history`);
                transactions = res.data.transactions || [];
            } catch (txError) {
                console.warn('No se pudo obtener transacciones V2, intentando con historial antiguo:', txError);
                // Fallback al endpoint antiguo de historial
                res = await attemptFetch({ userId, page: 0, limit: 200 });
                histories = res.data.histories || res.data || [];
            }

            // Si obtuvimos transacciones V2, usar esas
            if (transactions.length > 0) {
                // Procesar transacciones V2
                // No necesitamos paginación iterativa ya que el endpoint devuelve todas
            } else {
                // Si no, usar el sistema antiguo de histories
                const totalReported = res?.data?.totalRecords ?? res?.data?.totalCount ?? res?.data?.count ?? null;

                if ((Array.isArray(histories) && histories.length === 0) && totalReported && Number(totalReported) > 0) {
                    try {
                        const per = 200;
                        const pages = Math.ceil(Number(totalReported) / per);
                        const all = [];
                        for (let p = 0; p < pages; p++) {
                            const r2 = await attemptFetch({ userId, page: p, limit: per });
                            const part = r2.data.histories || r2.data || [];
                            if (Array.isArray(part) && part.length > 0) all.push(...part);
                        }
                        if (all.length > 0) histories = all;
                    } catch (e) {
                        console.warn('[handleDownloadHistory] iterative fetch failed', e);
                    }
                }

                if (!histories || histories.length === 0) {
                    const paymentId = payment?.id || null;
                    if (paymentId) {
                        try {
                            const res2 = await attemptFetch({ paymentId, page: 0, limit: 1000 });
                            const fallbackHist = res2.data.histories || res2.data || [];
                                        if (Array.isArray(fallbackHist) && fallbackHist.length > 0) {
                                            histories = fallbackHist;
                                        } else {
                                            // No hay historial encontrado: continuar y generar PDF indicando ausencia de transacciones
                                            histories = [];
                                            noTransactions = true;
                                        }
                        } catch (e) {
                            console.error('[handleDownloadHistory] fallback fetch error', e && e.response ? e.response.data || e.response : e);
                            const status = e && e.response && e.response.status;
                            const respData = e && e.response && e.response.data;
                            // If API indicates not found or no content, treat as no transactions
                            if (status === 404 || status === 204 || (respData && typeof respData === 'string' && /not found|no history|no transactions/i.test(respData))) {
                                // Treat as no transactions and continue to generate a PDF with a placeholder
                                histories = [];
                                noTransactions = true;
                            } else {
                                // Otherwise, generic error when generating PDF
                                setSnackbar({ open: true, message: 'No es posible generar el PDF por un error consultando historial', severity: 'error' });
                                return;
                            }
                        }
                    } else {
                        // No paymentId available: treat as no transactions and continue
                        histories = [];
                        noTransactions = true;
                    }
                }
            }

            // Helper: fetch image and convert to dataURL
            const fetchImageDataUrl = async (url) => {
                try {
                    const resp = await fetch(url);
                    const blob = await resp.blob();
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    return null;
                }
            };

            // Build PDF
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.width;

            // Colores
            const GREEN = [146, 208, 80];
            const GRID = [0, 0, 0];

            const familyPayment = payment || {};
            const periodsPayment = paymentDetail || payment || {};

            // Try to load logo from public folder
            const logoUrl = '/logo.png';
            const logoData = await fetchImageDataUrl(logoUrl);
            const headerTopY = 36;
            let logoDrawnH = 0;
            let logoDrawnW = 0;
            if (logoData) {
                const maxLogoW = 120;
                const maxLogoH = 80;
                try {
                    const props = doc.getImageProperties(logoData);
                    const imgW = Number(props?.width || 0) || 1;
                    const imgH = Number(props?.height || 0) || 1;
                    const scale = Math.min(maxLogoW / imgW, maxLogoH / imgH);
                    const drawW = imgW * scale;
                    const drawH = imgH * scale;
                    logoDrawnH = drawH;
                    logoDrawnW = drawW;
                    doc.addImage(logoData, props?.fileType || 'PNG', 40, headerTopY, drawW, drawH);
                } catch (e) {
                    // Fallback: draw without distortion by using a rectangular box closer to typical logo proportions
                    const fallbackW = 120;
                    const fallbackH = 60;
                    logoDrawnH = fallbackH;
                    logoDrawnW = fallbackW;
                    doc.addImage(logoData, 'PNG', 40, headerTopY, fallbackW, fallbackH);
                }
            }

            // Header center X: center text within the available space to the right of the logo
            const headerLeftX = 40;
            const headerRightX = pageWidth - 40;
            const headerContentLeftX = logoDrawnW > 0 ? (headerLeftX + logoDrawnW + 14) : headerLeftX;
            const headerCenterX = (headerContentLeftX + headerRightX) / 2;

            // Title centered
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('Estado de cuentas- Historial de Transacciones', headerCenterX, headerTopY + 30, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Generado: ${moment().format('YYYY-MM-DD HH:mm')}`, headerCenterX, headerTopY + 46, { align: 'center' });

            // Summary block
            let cursorY = headerTopY + Math.max(logoDrawnH || 0, 60) + 20;

            const familyLastName = familyPayment?.User?.FamilyDetail?.familyLastName
                || familyPayment?.User?.familyLastName
                || familyPayment?.user?.FamilyDetail?.familyLastName
                || paymentDetail?.User?.FamilyDetail?.familyLastName
                || paymentDetail?.User?.familyLastName
                || paymentDetail?.user?.FamilyDetail?.familyLastName
                || '';

            const studentCount = Number(
                familyPayment?.User?.FamilyDetail?.studentsCount
                || familyPayment?.user?.FamilyDetail?.studentsCount
                || familyPayment?.studentCount
                || 0
            );

            // Prefer paymentDetail (by-user endpoint) which returns Students filtered to active only
            const studentsArr = Array.isArray(periodsPayment?.User?.FamilyDetail?.Students)
                ? periodsPayment.User.FamilyDetail.Students
                : (Array.isArray(periodsPayment?.user?.FamilyDetail?.Students)
                    ? periodsPayment.user.FamilyDetail.Students
                    : []);

            const routeType = familyPayment?.User?.FamilyDetail?.routeType
                || familyPayment?.user?.FamilyDetail?.routeType
                || '';

            // Tarifa / descuento: preferir valores del payment; fallback a primer período si existe
            const periodsRaw = Array.isArray(periodsPayment?.periods)
                ? periodsPayment.periods
                : [];

            const firstPeriod = periodsRaw && periodsRaw.length > 0 ? periodsRaw.slice().sort((a, b) => String(a?.period || '').localeCompare(String(b?.period || '')))[0] : null;

            const monthlyTariff = Number(periodsPayment?.monthlyFee ?? periodsPayment?.monthlyFeeAmount ?? firstPeriod?.originalAmount ?? 0) || 0;
            const familyDiscount = Number(
                familyPayment?.User?.FamilyDetail?.specialFee
                || familyPayment?.user?.FamilyDetail?.specialFee
                || periodsPayment?.specialDiscount
                || periodsPayment?.specialFee
                || firstPeriod?.discountApplied
                || 0
            ) || 0;

            const monthlyNet = Number(periodsPayment?.netMonthlyFee ?? (monthlyTariff - familyDiscount)) || 0;

            // Tarifa base (por estudiante) para el tipo de ruta.
            // Preferir derivarla desde el total mensual / cant. estudiantes; fallback a tarifas de School si están disponibles.
            const safeStudentCount = Math.max(1, Number(studentCount || 1));
            const schoolObj = familyPayment?.School || familyPayment?.school || periodsPayment?.School || periodsPayment?.school || null;
            const routeUpper = String(routeType || '').toUpperCase().trim();
            const schoolBaseFee = (() => {
                const complete = Number(schoolObj?.transportFeeComplete ?? 0) || 0;
                const half = Number(schoolObj?.transportFeeHalf ?? 0) || 0;
                if (!complete && !half) return 0;
                if (routeUpper.includes('COMPLETA') || routeUpper.includes('COMPLETO')) return complete;
                return half || complete;
            })();
            const baseTariff = (monthlyTariff > 0 && safeStudentCount > 0)
                ? (monthlyTariff / safeStudentCount)
                : (schoolBaseFee || 0);

            const rawServiceStatus = (
                familyPayment?.serviceStatus
                || familyPayment?.User?.FamilyDetail?.serviceStatus
                || familyPayment?.user?.FamilyDetail?.serviceStatus
                || ''
            ).toString().toUpperCase().trim();

            const serviceStatusLabel = {
                ACTIVE: 'ACTIVO',
                PAUSED: 'PAUSADO',
                SUSPENDED: 'SUSPENDIDO',
                INACTIVE: 'INACTIVO',
                DELETED: 'ELIMINADO'
            }[rawServiceStatus] || (rawServiceStatus || '-');

            const rawFinalStatus = (familyPayment?.finalStatus || '').toString().toUpperCase().trim();
            const paymentStatusLabel = ['CONFIRMADO', 'ADELANTADO'].includes(rawFinalStatus)
                ? 'PAGADO'
                : (rawFinalStatus || '-');

            // Left summary
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Apellidos de Familia:', 40, cursorY);
            doc.setFont(undefined, 'normal');
            doc.text(String(familyLastName || '-'), 160, cursorY);

            doc.setFont(undefined, 'bold');
            doc.text('Cant. Hijos:', 40, cursorY + 18);
            doc.setFont(undefined, 'normal');
            doc.text(String(studentCount || 0), 160, cursorY + 18);

            // Right summary as a table (distinct style; no title/header)
            const rightLabelX = 340;
            const rightStartY = cursorY;
            const discountPct = (monthlyTariff > 0 && familyDiscount > 0)
                ? Math.round((familyDiscount / monthlyTariff) * 100)
                : 0;
            const discountLabel = discountPct > 0 ? `Descuento (${discountPct}%)` : 'Descuento:';
            const summaryRows = [
                ['Tipo de Ruta:', String(routeType || '-')],
                ['Tarifa base:', `Q${baseTariff.toFixed(2)}`],
                [`Tarifa (${studentCount || 0} ${Number(studentCount || 0) === 1 ? 'estudiante' : 'estudiantes'}):`, `Q${monthlyTariff.toFixed(2)}`],
                [discountLabel, `Q${familyDiscount.toFixed(2)}`],
                ['Cuota mensual:', `Q${monthlyNet.toFixed(2)}`],
                ['Estado de Pago:', String(paymentStatusLabel || '-')],
                ['Estado del Servicio:', String(serviceStatusLabel || '-')],
            ];

            let summaryTableFinalY = rightStartY;
            autoTable(doc, {
                startY: rightStartY - 2,
                margin: { left: rightLabelX, right: 40 },
                body: summaryRows,
                showHead: 'never',
                theme: 'grid',
                styles: { fontSize: 10, textColor: 0, cellPadding: 3.2, lineColor: GRID, lineWidth: 0.8 },
                columnStyles: {
                    0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 120 },
                    1: { halign: 'right', cellWidth: 95 }
                }
            });
            summaryTableFinalY = (doc.lastAutoTable && typeof doc.lastAutoTable.finalY !== 'undefined')
                ? doc.lastAutoTable.finalY
                : summaryTableFinalY;

            // Children table (verde)
            const childTableBody = (studentsArr || []).map(s => {
                const full = (s.fullName || s.name || '').toString().trim() || '-';
                const grade = (s.grade || s.gradeName || s.level || '').toString().trim() || '-';
                return [full, grade];
            });

            autoTable(doc, {
                startY: cursorY + 36,
                margin: { left: 40 },
                head: [
                    [{ content: 'HIJOS', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fontSize: 10, textColor: 0, fillColor: GREEN, lineColor: GRID, lineWidth: 1 } }],
                    ['Nombre', 'Grado']
                ],
                body: childTableBody.length > 0 ? childTableBody : [['-', '-']],
                styles: { fontSize: 9, textColor: 0, cellPadding: 4, lineColor: GRID, lineWidth: 1 },
                headStyles: { fillColor: GREEN, textColor: 0, halign: 'center', lineColor: GRID, lineWidth: 1 },
                columnStyles: { 0: { cellWidth: 170 }, 1: { cellWidth: 70, halign: 'center' } },
                tableWidth: 'auto',
                theme: 'grid',
            });

            const childrenTableFinalY = (doc.lastAutoTable && typeof doc.lastAutoTable.finalY !== 'undefined')
                ? doc.lastAutoTable.finalY
                : cursorY + 120;

            // Start the periods table below both summary + children tables
            cursorY = Math.max(summaryTableFinalY, childrenTableFinalY) + 28;

            // Periods table: construir desde `periods` si está disponible; fallback a unpaidPeriods (solo pendientes)
            const normalizePeriod = (p) => {
                const periodKey = (p?.period || '').toString().slice(0, 7);
                const originalAmount = Number(p?.originalAmount || p?.monthlyFee || 0) || 0;
                const discountApplied = Number(p?.discountApplied || p?.discount || 0) || 0;
                const netAmount = Number(p?.netAmount || (originalAmount - discountApplied)) || 0;
                const amountPaid = Number(p?.amountPaid || 0) || 0;
                const amountDue = Number(p?.amountDue || p?.amount || 0) || 0;
                const status = (p?.status || '').toString().toUpperCase().trim();
                return { period: periodKey, originalAmount, discountApplied, netAmount, amountPaid, amountDue, status };
            };

            const periods = (() => {
                if (Array.isArray(periodsRaw) && periodsRaw.length > 0) return periodsRaw.map(normalizePeriod);
                try {
                    const raw = periodsPayment?.unpaidPeriods
                        ? (typeof periodsPayment.unpaidPeriods === 'string'
                            ? JSON.parse(periodsPayment.unpaidPeriods)
                            : periodsPayment.unpaidPeriods)
                        : [];
                    return (Array.isArray(raw) ? raw : []).map(normalizePeriod);
                } catch (e) {
                    return [];
                }
            })();

            periods.sort((a, b) => String(a.period || '').localeCompare(String(b.period || '')));

            let noPeriods = false;
            if (!Array.isArray(periods) || periods.length === 0) {
                // No periods available: mark flag so we render a placeholder table instead of aborting
                noPeriods = true;
            }

            // Simular asignación de pagos a períodos para llenar FECHA/MONTO/BOLETA (best-effort)
            const txs = Array.isArray(transactions) ? transactions : [];
            const tariffLikeTx = txs
                .filter(t => {
                    const tt = String(t?.type || '').toUpperCase().trim();
                    return tt === 'TARIFA' || tt === 'CREDITO' || tt === 'CREDIT' || tt === 'PAYMENT';
                })
                .slice()
                .sort((a, b) => {
                    const da = moment.parseZone(a?.realPaymentDate || a?.createdAt || a?.registeredAt || 0).valueOf();
                    const db = moment.parseZone(b?.realPaymentDate || b?.createdAt || b?.registeredAt || 0).valueOf();
                    return da - db;
                });

            const periodAlloc = periods.map(p => ({
                ...p,
                remainingDueSim: Math.max(0, Number(p.netAmount || 0)),
                appliedSim: 0,
                paidAt: null,
                receiptNumber: '',
                notes: ''
            }));

            for (const tx of tariffLikeTx) {
                let txRemaining = Math.max(0, Number(tx?.amount || 0));
                if (txRemaining <= 0) continue;

                while (txRemaining > 0) {
                    const idx = periodAlloc.findIndex(pp => Number(pp.remainingDueSim || 0) > 0);
                    if (idx === -1) break;

                    const due = Number(periodAlloc[idx].remainingDueSim || 0);
                    const apply = Math.min(txRemaining, due);
                    if (apply <= 0) break;

                    periodAlloc[idx].remainingDueSim = Math.max(0, due - apply);
                    periodAlloc[idx].appliedSim = Number(periodAlloc[idx].appliedSim || 0) + apply;

                    // Guardar el último comprobante/fecha asociado a este período
                    periodAlloc[idx].paidAt = tx?.realPaymentDate || tx?.createdAt || tx?.registeredAt || null;
                    periodAlloc[idx].receiptNumber = String(tx?.receiptNumber || '').trim();
                    periodAlloc[idx].notes = String(tx?.notes || '').trim();

                    txRemaining -= apply;
                }
            }

            const monthNamesUpper = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
            const monthAbbrLower = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

            const formatPaidDate = (d) => {
                if (!d) return '';
                const m = moment.parseZone(d);
                if (!m.isValid()) return '';
                const day = m.date();
                const abbr = monthAbbrLower[m.month()] || '';
                return abbr ? `${day}-${abbr}` : String(day);
            };

            const money = (v) => {
                const num = Number(v || 0);
                return `Q ${num.toFixed(2)}`;
            };

            let totalTarifa = 0;
            let totalDesc = 0;
            let totalFaltante = 0;

            let bodyRows = [];

            if (!noTransactions && !noPeriods) {
                bodyRows = periodAlloc.map(p => {
                const mm = moment(`${p.period}-01`, 'YYYY-MM-DD');
                const mes = mm.isValid() ? (monthNamesUpper[mm.month()] || p.period) : (p.period || '');

                const tarifaV = Number(p.originalAmount || 0);
                const descV = Number(p.discountApplied || 0);
                const faltanteV = Number(p.amountDue || 0);

                totalTarifa += tarifaV;
                totalDesc += descV;
                totalFaltante += faltanteV;

                const hasPayment = Number(p.amountPaid || 0) > 0 || Number(p.appliedSim || 0) > 0;
                const fecha = (hasPayment && p.paidAt) ? formatPaidDate(p.paidAt) : '';
                const montoRaw = Number(p.amountPaid || 0) > 0 ? Number(p.amountPaid || 0) : Number(p.appliedSim || 0);
                const monto = hasPayment ? money(montoRaw) : '';
                const boleta = (hasPayment && p.receiptNumber) ? (p.receiptNumber || '') : '';
                const faltante = faltanteV > 0 ? money(faltanteV) : '-';

                return [mes, money(tarifaV), money(descV), fecha, monto, boleta, faltante];
                });

                // TOTAL row
                bodyRows.push(['TOTAL', money(totalTarifa), money(totalDesc), '', '', '', money(totalFaltante)]);
            } else if (noTransactions) {
                bodyRows = [[{ content: 'No hay transacciones registradas.', colSpan: 7, styles: { halign: 'center' } }]];
            } else {
                bodyRows = [[{ content: 'No se encontraron períodos para mostrar', colSpan: 7, styles: { halign: 'center' } }]];
            }

            // Main periods table
            autoTable(doc, {
                startY: cursorY,
                margin: { left: 40, right: 40 },
                head: [[ 'MES', 'TARIFA', 'DESCUENTOS', 'FECHA', 'MONTO', 'BOLETA', 'FALTANTE' ]],
                body: bodyRows,
                styles: { fontSize: 8.5, textColor: 0, cellPadding: 4, lineColor: GRID, lineWidth: 1, overflow: 'linebreak' },
                headStyles: { fillColor: GREEN, textColor: 0, halign: 'center', fontStyle: 'bold', lineColor: GRID, lineWidth: 1 },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 98 },
                    1: { halign: 'right', cellWidth: 64 },
                    2: { halign: 'right', cellWidth: 72 },
                    3: { halign: 'center', cellWidth: 52 },
                    4: { halign: 'right', cellWidth: 58 },
                    5: { halign: 'center', cellWidth: 84 },
                    6: { halign: 'right', cellWidth: 70 }
                },
                theme: 'grid',
                didParseCell: (data) => {
                    // Resaltar total faltante en rojo
                    const isTotalRow = data.row && data.row.index === bodyRows.length - 1;
                    if (isTotalRow && data.column && data.column.index === 6) {
                        data.cell.styles.textColor = [244, 67, 54];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (isTotalRow) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
                didDrawPage: (data) => {
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 18, { align: 'center' });
                    doc.setTextColor(0, 0, 0);
                }
            });

            // finalize and save
            const familyForName = (familyLastName && String(familyLastName).trim())
                ? String(familyLastName).replace(/\s+/g, '_')
                : 'Familia';
            const fileName = `Reporte Historial de Pagos Familia ${familyForName}.pdf`;
            doc.save(fileName);
            setSnackbar({ open: true, message: 'Descarga iniciada', severity: 'success' });
        } catch (err) {
            console.error('handleDownloadHistory', err);
            setSnackbar({ open: true, message: 'Error descargando reporte PDF', severity: 'error' });
        }
    }, [schoolYear]);

    // Notes handlers
    const handleOpenNotes = useCallback(async (payment) => {
        setNotesTarget(payment);
        setNotesDraft(payment?.notes || '');
        setOpenNotesDialog(true);
    }, []);
    const handleCloseNotes = () => {
        setOpenNotesDialog(false);
        setNotesTarget(null);
        setNotesDraft('');
    };
    const handleSaveNotes = async () => {
        if (!notesTarget) return;
        try {
            await api.put(`/payments/v2/${notesTarget.id}/notes`, { notes: notesDraft });
            setSnackbar({ open: true, message: 'Notas actualizadas', severity: 'success' });
            handleCloseNotes();
            // Invalidate cache for this user so modal will fetch fresh histories
            invalidatePaymentHistCacheForUser(notesTarget?.User?.id || notesTarget?.userId);
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error('Error actualizando notas', err);
            setSnackbar({ open: true, message: 'Error actualizando notas', severity: 'error' });
        }
    };

    const handleManageAction = async (actionName, payload) => {
        // Implement common management actions using available backend endpoints
        const payment = payload && payload.payment ? payload.payment : payload || manageTarget;

        try {
            if (!payment || !payment.id) {
                setSnackbar({ open: true, message: 'Pago no válido', severity: 'error' });
                return;
            }

            if (actionName === 'exoneratePenalty') {
                const amount = payload?.exonerateAmount ?? payload?.amount ?? null;
                if (!amount || Number.isNaN(amount) || amount <= 0) {
                    setSnackbar({ open: true, message: 'Monto inválido para exonerar', severity: 'error' });
                    return;
                }
                await api.post(`/payments/${payment.id}/exonerate-penalty`, { discountAmount: amount, type: 'EXONERATION' });
                setSnackbar({ open: true, message: 'Mora exonerada', severity: 'success' });
            } else if (actionName === 'freezePenalty') {
                // Congelar mora con fecha específica del backend (simulada o real)
                let freezeDate;
                if (payload?.freezeDate) {
                    freezeDate = payload.freezeDate;
                } else {
                    // Obtener fecha actual del backend
                    const currentDate = await getCurrentDate();
                    freezeDate = currentDate.format('YYYY-MM-DD');
                }
                console.log('[FREEZE_PENALTY] Sending request:', { paymentId: payment.id, freezeDate });
                const response = await api.post('/payments/penalties/freeze', { 
                    paymentId: payment.id,
                    freezeDate,
                    notes: `Mora congelada manualmente el ${moment(freezeDate).format('DD/MM/YYYY')}`
                });
                console.log('[FREEZE_PENALTY] Response received:', response.data);
                setSnackbar({ open: true, message: 'Mora congelada', severity: 'success' });
            } else if (actionName === 'unfreezePenalty') {
                // Descongelar mora (reanudar acumulación)
                await api.post('/payments/penalties/unfreeze', { 
                    paymentId: payment.id,
                    notes: 'Mora reanudada manualmente'
                });
                setSnackbar({ open: true, message: 'Mora reanudada', severity: 'success' });
            } else if (actionName === 'suspend' || actionName === 'activate') {
                // Cambiar status del payment usando endpoints V2
                const endpoint = actionName === 'suspend' ? 'suspend' : 'activate';
                await api.post(`/payments/v2/${payment.id}/${endpoint}`);
                setSnackbar({ open: true, message: actionName === 'suspend' ? 'Familia suspendida' : 'Familia activada', severity: 'success' });
            } else if (actionName === 'toggleAutoDebit') {
                const userId = payload?.payment?.User?.id || payment.User?.id;
                if (!userId) return setSnackbar({ open: true, message: 'Usuario no encontrado', severity: 'error' });
                const val = payload?.value;
                
                // Si se está ACTIVANDO el auto débito, mostrar diálogo para seleccionar mes
                if (val === true) {
                    setAutoDebitPayload({ userId, payment: payload?.payment || payment });
                    setOpenAutoDebitDialog(true);
                    return; // No ejecutar aún, esperar respuesta del diálogo
                } else {                
                    // Si se está DESACTIVANDO, usar el nuevo endpoint para actualizar ambas tablas (FamilyDetail y NewPayment)
                    await api.post('/payments/v2/activate-auto-debit', { 
                        userId, 
                        activateAutoDebit: false 
                    });
                }
                setSnackbar({ open: true, message: 'Débito automático desactivado', severity: 'success' });
            } else if (actionName === 'toggleRequiresInvoice') {
                // Use payments endpoint to set invoice need
                const val = payload?.value;
                await api.put(`/payments/${payment.id}/set-invoice-need`, { requiresInvoice: !!val });
                setSnackbar({ open: true, message: `Requiere factura: ${val ? 'Sí' : 'No'}`, severity: 'success' });
            } else if (actionName === 'deletePayment') {
                // Revert last payment transaction
                try {
                    await api.post(`/payments/${payment.id}/revert`);
                    setSnackbar({ open: true, message: 'Pago revertido', severity: 'success' });
                    // invalidate caches for this user and refresh payments/analysis
                    invalidatePaymentHistCacheForUser(payment?.User?.id || payment?.userId || manageTarget?.User?.id || manageTarget?.userId);
                    // close manage modal if open
                    setOpenManageModal(false);
                    // refresh dataset and analysis
                    await fetchAllPayments(statusFilter, search);
                    await fetchPaymentsAnalysis(schoolId);
                } catch (e) {
                    console.error('Error revirtiendo pago', e);
                    setSnackbar({ open: true, message: 'Error revirtiendo pago', severity: 'error' });
                }
            } else if (actionName === 'payPenalty') {
                // Pagar mora congelada
                const { amountPaid, numeroBoleta, bankAccountNumber, paidAt } = payload;
                if (!amountPaid || Number.isNaN(amountPaid) || amountPaid <= 0) {
                    setSnackbar({ open: true, message: 'Monto inválido para pagar mora', severity: 'error' });
                    return;
                }
                await api.post(`/payments/${payment.id}/pay-penalty`, {
                    amountPaid,
                    numeroBoleta,
                    bankAccountNumber,
                    paidAt
                });
                setSnackbar({ open: true, message: 'Pago de mora registrado exitosamente', severity: 'success' });
            } else if (actionName === 'discountPenalty') {
                // Exonerar o aplicar descuento a mora congelada
                const { discountAmount, type, notes } = payload;
                if (!discountAmount || Number.isNaN(discountAmount) || discountAmount <= 0) {
                    setSnackbar({ open: true, message: 'Monto inválido para exonerar/descontar', severity: 'error' });
                    return;
                }
                await api.post(`/payments/${payment.id}/exonerate-penalty`, {
                    discountAmount,
                    type,
                    notes
                });
                const message = type === 'EXONERATION' ? 'Mora exonerada exitosamente' : 'Descuento aplicado a mora';
                setSnackbar({ open: true, message, severity: 'success' });
            } else if (actionName === 'refreshPayments') {
                // Child requested a refresh only (no API call needed here).
            } else {
                setSnackbar({ open: true, message: `Acción no manejada: ${actionName}`, severity: 'info' });
            }
            // Invalidate payment history cache for affected user and refresh payments
            // Invalidate cache for this user so modal will fetch fresh histories
            invalidatePaymentHistCacheForUser(payment?.User?.id || payment?.userId || manageTarget?.User?.id || manageTarget?.userId);
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error('[handleManageAction] Error with action:', actionName);
            console.error('[handleManageAction] Error details:', err);
            console.error('[handleManageAction] Response data:', err?.response?.data);
            const errorMsg = err?.response?.data?.error || err?.message || 'Error ejecutando acción';
            setSnackbar({ open: true, message: errorMsg, severity: 'error' });
        }
    };

    const handleToggleInvoiceSent = async (row, newVal) => {
        try {
            // V2: La actualización ya se hizo en ManagePaymentsModal a nivel de transacción
            // Ya no necesitamos actualizar a nivel de pago porque ese campo no existe en V2
            
            setSnackbar({ open: true, message: `Factura ${newVal ? 'marcada como enviada' : 'desmarcada'}`, severity: 'success' });
            // Invalidate cache for this user so modal will fetch fresh histories
            invalidatePaymentHistCacheForUser(row?.userId || row?.User?.id || manageTarget?.User?.id || manageTarget?.userId);
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error('handleToggleInvoiceSent', err);
            setSnackbar({ open: true, message: 'Error actualizando envío de factura', severity: 'error' });
        }
    };

    // --- Export by status UI state ---
    const [openExportStatusDialog, setOpenExportStatusDialog] = useState(false);
    // Export dialog additional filters: separate month and year selectors
    const [exportMonth, setExportMonth] = useState('TODOS'); // 'TODOS' or '01'..'12'
    // Final status selector for export (MORA, PENDIENTE, PAGADO)
    const [exportFinalStatus, setExportFinalStatus] = useState('TODOS');
    // Service status selector for export (ACTIVE, PAUSED, SUSPENDED, INACTIVE, ALL)
    const [exportServiceStatus, setExportServiceStatus] = useState('TODOS'); 
    // Año seleccionable para exportación
    const [exportYear, setExportYear] = useState(String(moment().year()));
    const exportYearOptions = React.useMemo(() => {
        const currentYear = moment().year();
        const baseYear = Number(schoolYear);
        const startYear = Number.isFinite(baseYear) ? baseYear : currentYear;

        const years = [];
        for (let y = startYear; y <= currentYear; y++) years.push(String(y));
        // Mostrar descendente (más reciente primero)
        return years.reverse();
    }, [schoolYear]);

    // Si cambia schoolYear y el exportYear ya no está en el rango, ajustarlo.
    useEffect(() => {
        if (!exportYearOptions || exportYearOptions.length === 0) return;
        if (!exportYearOptions.includes(exportYear)) {
            setExportYear(exportYearOptions[0]);
        }
    }, [exportYearOptions]);

    // --- Export by estado (new) ---
    const [openExportByStateDialog, setOpenExportByStateDialog] = useState(false);
    const [exportByStateValue, setExportByStateValue] = useState('TODOS');
    const [exportByStateServiceStatus, setExportByStateServiceStatus] = useState('TODOS');


    // Export payments filtered by status and build Excel
    const handleDownloadPaymentsByStatus = useCallback(async (month = '', year = '') => {
        try {
            // Use new backend endpoint to fetch all PaymentHistory rows for payments
            // matching the selected final status. Backend will JOIN PaymentHistory -> Payment.
            // If 'GENERAL' is selected, omit the finalstatus param so backend returns all statuses.
            const selectedYear = String(year || exportYear || moment().year());
            const params = { schoolId, schoolYear: selectedYear, page: 1, limit: 10000 };
            // Manejar agrupación de estados: PAGADO incluye CONFIRMADO y ADELANTADO
            if (exportFinalStatus && String(exportFinalStatus).toUpperCase() === 'PAGADO') {
            } else if (exportFinalStatus && exportFinalStatus !== 'TODOS') {
                params.finalstatus = exportFinalStatus;
            }
            setOpenExportStatusDialog(false);
            setSnackbar({ open: true, message: 'Preparando descarga...', severity: 'info' });

            const res = await api.get('/payments/histories-by-finalstatus', { params });
            const historiesAll = res.data.histories || res.data || [];

            if (!Array.isArray(historiesAll) || historiesAll.length === 0) {
                setSnackbar({ open: true, message: 'No se encontraron historiales para el filtro seleccionado', severity: 'info' });
                return;
            }

            // Build workbook
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Historiales');

            const headers = [
                'Apellidos Familia',
                'Estado de Pago',
                'Estado del Servicio',
                'Fecha Pago',
                'Crédito/Saldo',
                'Tarifa',
                'Descuento Familia',
                'Descuento Extraordinario',
                'Mora',
                'Total a Pagar',
                'Monto Pagado',
                'Total pendiente de pago',
                'Crédito/Saldo Disponible'
            ];
            sheet.addRow(headers);

            // historiesAll contains PaymentHistory rows for all matching payments.
            // Apply month/year filter and write rows directly (assume each history row includes familyLastName)
            const yearToUse = selectedYear ? Number(selectedYear) : moment().year();
            const monthStrPad = (month && month !== 'TODOS') ? String(month).padStart(2, '0') : null;

            const normalizeUpper = (val) => (val == null ? '' : String(val)).trim().toUpperCase();
            const getHistoryUserId = (h) => (
                h?.userId ||
                h?.User?.id ||
                h?.Payment?.userId ||
                h?.Payment?.User?.id ||
                h?.payment?.userId ||
                h?.payment?.User?.id ||
                null
            );

            const buildServiceStatusMap = (paymentsArr) => new Map(
                (Array.isArray(paymentsArr) ? paymentsArr : []).map(p => {
                    const id = p?.userId || p?.User?.id || null;
                    const st = p?.serviceStatus || p?.User?.FamilyDetail?.serviceStatus || '';
                    return [id, normalizeUpper(st)];
                }).filter(([id]) => Boolean(id))
            );

            const buildFamilyDiscountMap = (paymentsArr) => new Map(
                (Array.isArray(paymentsArr) ? paymentsArr : []).map(p => {
                    const id = p?.userId || p?.User?.id || null;
                    const disc = p?.User?.FamilyDetail?.specialFee ?? p?.specialFee ?? 0;
                    return [id, Number(disc || 0)];
                }).filter(([id]) => Boolean(id))
            );

            // Build a map of current serviceStatus by userId. Prefer a fresh unfiltered /payments fetch
            // so this works even if the current UI has status/search filters applied.
            let serviceStatusByUserId = buildServiceStatusMap(paymentsAll);
            let familyDiscountByUserId = buildFamilyDiscountMap(paymentsAll);
            if (schoolId && schoolYear) {
                try {
                    const yearsToFetch = Array.from(new Set([
                        String(exportYear || schoolYear),
                        String(schoolYear)
                    ].filter(Boolean)));

                    const mergedServiceStatusMap = new Map(serviceStatusByUserId);
                    const mergedFamilyDiscountMap = new Map(familyDiscountByUserId);

                    for (const yr of yearsToFetch) {
                        try {
                            const resPayments = await api.get('/payments', { params: { schoolId, schoolYear: yr, page: 1, limit: 10000 } });
                            const allPayments = resPayments.data.payments || resPayments.data.rows || [];

                            const partialServiceMap = buildServiceStatusMap(allPayments);
                            partialServiceMap.forEach((v, k) => mergedServiceStatusMap.set(k, v));

                            const partialDiscMap = buildFamilyDiscountMap(allPayments);
                            partialDiscMap.forEach((v, k) => mergedFamilyDiscountMap.set(k, v));
                        } catch (eYr) {
                            console.warn(`[export] Could not fetch /payments for schoolYear=${yr}:`, eYr);
                        }
                    }

                    if (mergedServiceStatusMap.size > 0) serviceStatusByUserId = mergedServiceStatusMap;
                    if (mergedFamilyDiscountMap.size > 0) familyDiscountByUserId = mergedFamilyDiscountMap;
                } catch (e) {
                    // If this fails, fall back to paymentsAll-based maps.
                    console.warn('[export] Could not build /payments maps:', e);
                }
            }

            historiesAll.forEach(h => {
                const historyUserId = getHistoryUserId(h);

                // Determinar estado del servicio (preferir lo que venga en el historial, y si no, usar paymentsAll)
                const serviceStatus = normalizeUpper(
                    h?.serviceStatus ||
                    h?.User?.FamilyDetail?.serviceStatus ||
                    h?.Payment?.User?.FamilyDetail?.serviceStatus ||
                    (historyUserId ? serviceStatusByUserId.get(historyUserId) : '') ||
                    ''
                );
                
                // Filtrar por estado del servicio
                if (exportServiceStatus && exportServiceStatus !== 'TODOS') {
                    if (serviceStatus !== normalizeUpper(exportServiceStatus)) return;
                }
                
                const familyLast = h.familyLastName || h.familyLast || h.familyLastname || h.User?.FamilyDetail?.familyLastName || h.User?.familyLastName || '';
                // Use only finalStatus (as required). Fallback to Payment.finalStatus if the snapshot doesn't include it.
                const estado = h.finalStatus || (h.Payment && h.Payment.finalStatus) || '';
                const estadoUpper = normalizeUpper(estado);
                
                // Filtrar por estado de pago
                if (exportFinalStatus && exportFinalStatus !== 'TODOS') {
                    const filtroUpper = normalizeUpper(exportFinalStatus);
                    
                    // PAGADO incluye CONFIRMADO y ADELANTADO
                    if (filtroUpper === 'PAGADO') {
                        if (!['CONFIRMADO', 'ADELANTADO'].includes(estadoUpper)) return;
                    } else {
                        if (estadoUpper !== filtroUpper) return;
                    }
                }

                // Mostrar estado de pago en formato UI
                const estadoPagoText = (['CONFIRMADO', 'ADELANTADO'].includes(estadoUpper))
                    ? 'PAGADO'
                    : (estadoUpper || '');
                
                // Mapear estado del servicio a texto legible
                const serviceStatusText = {
                    'ACTIVE': 'ACTIVO',
                    'PAUSED': 'PAUSADO',
                    'SUSPENDED': 'SUSPENDIDO',
                    'INACTIVE': 'INACTIVO'
                }[serviceStatus] || serviceStatus || 'NO ESPECIFICADO';
                
                // Filtrar por fecha (mes y año)
                const pd = h.paymentDate || h.lastPaymentDate || h.snapshotDate || null;
                if (!pd) return;
                const mm = moment.parseZone(pd);
                
                // Si hay mes específico seleccionado, filtrar por mes y año exactos
                if (monthStrPad) {
                    if (mm.format('YYYY-MM') !== `${yearToUse}-${monthStrPad}`) return;
                }
                // Si no hay mes (TODOS), filtrar únicamente por el año seleccionado
                else if (year && year !== 'TODOS') {
                    if (mm.year() !== yearToUse) return;
                }

                const fecha = (typeof h.paymentDate !== 'undefined' && h.paymentDate !== null && h.paymentDate !== '') ? moment.parseZone(h.paymentDate).format('DD/MM/YY') : '0';
                const creditoSaldo = Number(h.creditBalanceBefore ?? 0);
                const tarifa = Number(h.tarif ?? 0);
                const descuentoFamFromHistory = Number(
                    h.familyDiscount ||
                    h.family_discount ||
                    h?.metadata?.familyDiscount ||
                    0
                );
                const descuentoFamFromFamily = historyUserId ? Number(familyDiscountByUserId.get(historyUserId) || 0) : 0;
                const descuentoFam = descuentoFamFromHistory > 0 ? descuentoFamFromHistory : descuentoFamFromFamily;

                const descExtra = Number(
                    h.extraordinaryDiscount ||
                    h.extraordinary_discount ||
                    h.discountAmount ||
                    0
                );
                const mora = Number(h.penaltyBefore ?? 0);
                const totalDueBefore = Number(h.totalDueBefore ?? 0);
                const totalAPagar = Number(totalDueBefore - creditoSaldo - descExtra);
                const monto = Number(h.amountPaid ?? 0);
                const totalPendiente = Number(h.totalDueAfter ?? 0);
                const creditoDisponible = Number(h.creditBalanceAfter ?? 0);

                // Insert Estado de Pago y Estado del Servicio
                sheet.addRow([familyLast, estadoPagoText, serviceStatusText, fecha, creditoSaldo, tarifa, descuentoFam, descExtra, mora, totalAPagar, monto, totalPendiente, creditoDisponible]);
            });

            if (sheet.rowCount <= 1) {
                setSnackbar({ open: true, message: 'No se encontraron registros con los filtros seleccionados', severity: 'info' });
                return;
            }

            // Styling header (match historial style)
            sheet.getRow(1).eachCell((cell, colNumber) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                // Column 2 (Apellidos Familia) left-aligned header, others centered
                cell.alignment = colNumber === 2 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            // Alternating row colors and alignment (center data cells; keep numeric right-aligned)
            sheet.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return;
                const isEven = rowIndex % 2 === 0;
                row.eachCell((cell, colNumber) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                    // center by default for text/date columns
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    // Numeric columns start at column 5 now (Crédito/Saldo). Right-align and format numbers for columns >= 5
                    if (colNumber >= 5) {
                        cell.numFmt = '0.00';
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    }
                });
            });

            // Autofilter and freeze first row
            const lastCol = sheet.getRow(1).cellCount;
            const getColumnLetter = (colNumber) => {
                let letter = '';
                while (colNumber > 0) {
                    const remainder = (colNumber - 1) % 26;
                    letter = String.fromCharCode(65 + remainder) + letter;
                    colNumber = Math.floor((colNumber - 1) / 26);
                }
                return letter;
            };
            const lastColLetter = getColumnLetter(lastCol);
            sheet.autoFilter = `A1:${lastColLetter}1`;
            sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

            // Autosize columns
            sheet.columns.forEach((column, index) => {
                const header = headers[index] || '';
                let maxLength = header.length;
                sheet.eachRow((row) => {
                    const cell = row.getCell(index + 1);
                    const value = cell && cell.value ? String(cell.value) : '';
                    if (value.length > maxLength) maxLength = value.length;
                });
                column.width = Math.min(Math.max(maxLength + 2, 10), 60);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            // Build filename with school and period (year or year-month)
            const monthNames = {
                '01': 'Enero','02': 'Febrero','03': 'Marzo','04': 'Abril','05': 'Mayo','06': 'Junio',
                '07': 'Julio','08': 'Agosto','09': 'Septiembre','10': 'Octubre','11': 'Noviembre','12': 'Diciembre'
            };
            // Build filename in requested format:
            // "Historial Pagos estadoFinal nombreColegio Mes Año"
            const periodYear = year || exportYear || moment().year();
            const monthPadded = (month && String(month).toUpperCase() !== 'TODOS') ? String(month).padStart(2, '0') : '';
            const monthName = monthPadded ? (monthNames[monthPadded] || monthPadded) : '';
            // sanitize school name for filenames (remove newlines/slashes, collapse spaces)
            const rawSchoolName = school?.name ? String(school.name) : String(schoolId || '');
            const schoolClean = rawSchoolName.replace(/[\n\r/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
            const statusPart = exportFinalStatus ? String(exportFinalStatus).toUpperCase() : '';
            let fileName;
            if (monthName) {
                fileName = `Historial Pagos ${statusPart} ${schoolClean} ${monthName} ${periodYear}.xlsx`;
            } else {
                fileName = `Historial Pagos ${statusPart} ${schoolClean} ${periodYear}.xlsx`;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setSnackbar({ open: true, message: 'Descarga iniciada', severity: 'success' });
        } catch (err) {
            console.error('handleDownloadPaymentsByStatus', err);
            setSnackbar({ open: true, message: 'Error generando exportación', severity: 'error' });
        }
    }, [schoolId, schoolYear, school, paymentsAll, exportYear, exportFinalStatus, exportServiceStatus]);

    // Export payments filtered by estado using client-side dataset (paymentsAll)
    const handleDownloadByState = useCallback(async (estado) => {
        try {
            setOpenExportByStateDialog(false);
            setSnackbar({ open: true, message: 'Preparando descarga...', severity: 'info' });

            const estadoNorm = estado ? String(estado).toUpperCase().trim() : 'TODOS';
            const arr = Array.isArray(paymentsAll) ? paymentsAll : [];
            const serviceFilter = String(exportByStateServiceStatus || 'TODOS').toUpperCase().trim();

            const toServiceText = (stRaw) => {
                const st = String(stRaw || '').toUpperCase().trim();
                return {
                    ACTIVE: 'ACTIVO',
                    PAUSED: 'PAUSADO',
                    SUSPENDED: 'SUSPENDIDO',
                    INACTIVE: 'INACTIVO'
                }[st] || (st ? st : 'NO ESPECIFICADO');
            };

            const toEstadoPagoText = (stRaw) => {
                const s = String(stRaw || '').toUpperCase().trim();
                return ['CONFIRMADO', 'ADELANTADO'].includes(s) ? 'PAGADO' : s;
            };

            const filteredRows = arr.filter(p => {
                // Determinar si la familia/usuario está marcado como eliminado (deleted)
                const isDeleted = !!p.User?.FamilyDetail?.deleted;

                // Siempre ignorar registros marcados como deleted
                if (isDeleted) return false;

                const paymentServiceStatus = String(p.serviceStatus || p.User?.FamilyDetail?.serviceStatus || '').toUpperCase().trim();
                if (serviceFilter && serviceFilter !== 'TODOS') {
                    if (paymentServiceStatus !== serviceFilter) return false;
                }

                const s = (p.finalStatus || p.status || '').toString().toUpperCase();

                if (!estadoNorm || estadoNorm === 'TODOS') return true;
                if (estadoNorm === 'PAGADO') return ['CONFIRMADO', 'ADELANTADO'].includes(s);
                return s === estadoNorm;
            });

            if (!filteredRows || filteredRows.length === 0) {
                setSnackbar({ open: true, message: 'No se encontraron registros para el estado seleccionado', severity: 'info' });
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Datos');

            const headers = ['Estado del Servicio','Estado de Pago','Apellidos Familia','Débito Automático','Cant. Estudiantes','Tipo Ruta','Fecha Último Pago','Descuento','Envío Factura'];
            sheet.addRow(headers);

            filteredRows.forEach(p => {
                const estadoVal = toEstadoPagoText(p.finalStatus || p.status || '');
                const serviceText = toServiceText(p.serviceStatus || p.User?.FamilyDetail?.serviceStatus || '');
                const familyLast = p.User?.FamilyDetail?.familyLastName || p.User?.familyLastName || '';
                const autoDebit = !!(p.automaticDebit || p.User?.FamilyDetail?.automaticDebit || p.User?.FamilyDetail?.autoDebit);
                const autoStr = autoDebit ? 'Sí' : 'No';
                const studentsCount = Array.isArray(p.User?.FamilyDetail?.Students) ? p.User.FamilyDetail.Students.length : (p.studentCount || 0);
                const studentsInt = Number.isFinite(Number(studentsCount)) ? Math.trunc(Number(studentsCount)) : 0;
                const routeType = p.User?.FamilyDetail?.routeType || '';
                const lastPaymentRaw = p.lastPaymentDate || p.lastPaidDate || p.lastPayment || p.lastPaymentAt || p.last_paid_at || null;
                const lastPaymentDate = lastPaymentRaw ? moment.parseZone(lastPaymentRaw).toDate() : null;
                const discount = Number(p.User?.FamilyDetail?.specialFee ?? p.specialFee ?? 0) || 0;
                const invoiceSent = !!(p.User?.FamilyDetail?.requiresInvoice || p.requiresInvoice);
                const invoiceStr = invoiceSent ? 'Sí' : 'No';

                // Add row: for Fecha Último Pago we add a Date object (or empty string if missing) so Excel recognizes it as date
                sheet.addRow([serviceText, estadoVal, familyLast, autoStr, studentsInt, routeType, lastPaymentDate || '', discount, invoiceStr]);
            });

            // Styling header (match historial style)
            sheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            // Alternating row colors and alignment (center text/date columns; numeric right-aligned)
            sheet.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return;
                const isEven = rowIndex % 2 === 0;
                row.eachCell((cell, colNumber) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                    // Apellidos Familia (col 3) left-aligned; numeric fields right-aligned; dates centered; others centered
                    if (colNumber === 3) {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    } else {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                    // Numeric columns: Cant. Estudiantes (col 5) integer, Descuento (col 8) two decimals
                    if (colNumber === 5) {
                        cell.numFmt = '0';
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                    if (colNumber === 8) {
                        cell.numFmt = '0.00';
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                    // Fecha Último Pago (col 7) should be date dd/mm/yyyy
                    if (colNumber === 7) {
                        cell.numFmt = 'dd/mm/yyyy';
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
            });

            // Autofilter and freeze first row
            const lastCol = sheet.getRow(1).cellCount;
            const getColumnLetter = (colNumber) => {
                let letter = '';
                while (colNumber > 0) {
                    const remainder = (colNumber - 1) % 26;
                    letter = String.fromCharCode(65 + remainder) + letter;
                    colNumber = Math.floor((colNumber - 1) / 26);
                }
                return letter;
            };
            const lastColLetter = getColumnLetter(lastCol);
            sheet.autoFilter = `A1:${lastColLetter}1`;
            sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

            // Autosize columns
            sheet.columns.forEach((column, index) => {
                const header = headers[index] || '';
                let maxLength = header.length;
                sheet.eachRow((row) => {
                    const cell = row.getCell(index + 1);
                    const value = cell && cell.value ? String(cell.value) : '';
                    if (value.length > maxLength) maxLength = value.length;
                });
                column.width = Math.min(Math.max(maxLength + 2, 10), 60);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `Pagos_por_estado_${(estadoNorm || 'TODOS')}_servicio_${(serviceFilter || 'TODOS')}_${school?.name ? school.name.replace(/[^a-z0-9]/gi,'_') : schoolId}.xlsx`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSnackbar({ open: true, message: 'Descarga iniciada', severity: 'success' });
        } catch (err) {
            console.error('handleDownloadByState', err);
            setSnackbar({ open: true, message: 'Error generando exportación', severity: 'error' });
        }
    }, [paymentsAll, exportByStateServiceStatus, school, schoolId]);

    // Legacy discount-save flow removed.
    // The new retroactive discount flow is applied via POST /payments/v2/:id/apply-family-discount.
    const handleSaveDiscount = async (payment) => {
        try {
            invalidatePaymentHistCacheForUser(payment?.User?.id || payment?.userId);
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error(err);
        }
    };

    // Derived values for the Register Payment dialog summary
    const formatCurrency = (v) => `Q ${Number(v || 0).toFixed(2)}`;
    
    // Función para calcular mora hasta una fecha específica (retroactiva)
    const calculateRetroactivePenalty = useCallback((paymentDate) => {
        if (!registerPaymentTarget?.penaltyStartDate || !paymentDate) {
            return null;
        }
        
        const penaltyStart = moment(registerPaymentTarget.penaltyStartDate).startOf('day');
        const paymentMoment = moment(paymentDate).startOf('day');
        const today = moment().startOf('day');
        
        // Si la fecha de pago es igual o después de hoy, no es retroactivo
        if (paymentMoment.isSameOrAfter(today)) {
            return null;
        }

        // Si existe una fecha de congelamiento, no permitir retroactivo para fechas iguales o posteriores a la fecha de congelamiento.
        const freezeDateStr = registerPaymentTarget?.penaltyFrozenAt || registerPaymentTarget?.penaltyFrozenUntil || null;
        if (freezeDateStr) {
            const freezeMoment = moment(freezeDateStr).startOf('day');
            if (!paymentMoment.isBefore(freezeMoment)) {
                return null;
            }
        }
        
        // Si la fecha de pago es antes del inicio de mora, no hay mora
        if (paymentMoment.isBefore(penaltyStart)) {
            return {
                isRetroactive: true,
                daysUntilPayment: 0,
                penaltyUntilPaymentDate: 0,
                message: 'Esta fecha es anterior al inicio de la mora. No se aplicará mora.'
            };
        }
        
        // Calcular días desde inicio de mora hasta fecha de pago
        const daysUntilPayment = paymentMoment.diff(penaltyStart, 'days') + 1;
        
        // Obtener datos de la escuela para el cálculo
        const dailyPenalty = school?.dailyPenalty || allSchools.find(s => s.id === registerPaymentTarget.schoolId)?.dailyPenalty || 0;
        const studentCount = (registerPaymentTarget?.User?.FamilyDetail?.Students || []).length || 1;
        
        // Calcular mora hasta la fecha del pago
        const penaltyUntilPaymentDate = daysUntilPayment * parseFloat(dailyPenalty) * studentCount;
        
        return {
            isRetroactive: true,
            daysUntilPayment,
            penaltyUntilPaymentDate,
            dailyPenalty: parseFloat(dailyPenalty),
            studentCount,
            paymentDate: paymentMoment.format('DD [de] MMMM, YYYY'),
            penaltyStartDate: penaltyStart.format('DD [de] MMMM, YYYY'),
            currentPenaltyDue: Number(registerPaymentTarget.penaltyDue || 0),
            message: `Pago retroactivo: La mora acumulada hasta el ${paymentMoment.format('DD/MM/YYYY')} era de Q${penaltyUntilPaymentDate.toFixed(2)}`
        };
    }, [registerPaymentTarget, school, allSchools]);
    
    // Calculate retroactive penalty when penalty payment date changes
    useEffect(() => {
        if (paymentTab === 1 && registerPaymentTarget?.penaltyStartDate) {
            const retroCalc = calculateRetroactivePenalty(payPenaltyDate);
            setRetroactivePenalty(retroCalc);
            setIsRetroactivePayment(retroCalc?.isRetroactive || false);
        } else {
            setRetroactivePenalty(null);
            setIsRetroactivePayment(false);
        }
    }, [payPenaltyDate, paymentTab, registerPaymentTarget?.penaltyStartDate, calculateRetroactivePenalty]);
    
    // Force re-render of retroactive penalty info when amounts change
    // (the UI calculation block is reactive to these values)
    useEffect(() => {
        if (isRetroactivePayment && retroactivePenalty) {
            // Just trigger a re-render, the UI will recalculate based on current values
            const timer = setTimeout(() => {
                // No action needed, just ensure UI updates
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [payPenaltyAmount, discountPenaltyAmount, exonerateAmount, isExonerating, isRetroactivePayment, retroactivePenalty]);
    
    // Valores del sistema V2
    // monthlyFee = tarifa base × cantidad de estudiantes (antes de descuentos)
    const dialogMonthlyFee = Number(registerPaymentTarget?.monthlyFee || 0);
    
    // specialDiscount (UI): prefer per-period discountApplied when there is a single unpaid period.
    // This avoids showing the latest configured family discount (future periods) for an already-generated period.
    const dialogFamilySpecialFee = (() => {
        try {
            const raw = registerPaymentTarget?.unpaidPeriods
                ? (typeof registerPaymentTarget.unpaidPeriods === 'string'
                    ? JSON.parse(registerPaymentTarget.unpaidPeriods)
                    : registerPaymentTarget.unpaidPeriods)
                : [];

            const periods = (Array.isArray(raw) ? raw : []).filter(p => Number(p?.amountDue ?? p?.amount ?? 0) > 0);
            if (periods.length === 1) {
                const perPeriodDiscount = Number(periods[0]?.discountApplied ?? periods[0]?.discount ?? NaN);
                if (Number.isFinite(perPeriodDiscount) && perPeriodDiscount >= 0) return perPeriodDiscount;
            }
        } catch (e) {
            // ignore and fall back
        }
        return Number(registerPaymentTarget?.specialDiscount || 0);
    })();
    
    // netMonthlyFee = monthlyFee - specialDiscount (lo que realmente debe pagar mensualmente)
    const dialogNetMonthlyFee = Number(registerPaymentTarget?.netMonthlyFee || 0);
    
    // Cantidad de estudiantes
    const studentCount = Number(
        registerPaymentTarget?.studentCount ||
        (Array.isArray(registerPaymentTarget?.User?.FamilyDetail?.Students) ? registerPaymentTarget.User.FamilyDetail.Students.length : undefined) ||
        registerPaymentTarget?.User?.FamilyDetail?.studentsCount ||
        1
    ) || 1;

    const dialogBaseFee = studentCount > 0 ? dialogMonthlyFee / studentCount : dialogMonthlyFee;
    
    // Tipo de ruta
    const routeType = registerPaymentTarget?.User?.FamilyDetail?.routeType || 'N/A';
    
    // Mora de la base de datos (solo para mostrar aviso, no se calcula en esta pestaña)
    const basePenaltyDue = Number(registerPaymentTarget?.penaltyDue || 0);
    
    const dialogCredito = Number(registerPaymentTarget?.creditBalance ?? 0);
    
    // Saldo pendiente: usar balanceDue
    const dialogLeftover = Number(registerPaymentTarget?.balanceDue || 0);
    
    const dialogExtraDiscount = Number(registerPaymentExtra?.extraordinaryDiscount || 0);

    // Períodos pendientes (para desglose): filtrar solo los que tienen monto pendiente
    const dialogPendingPeriods = (() => {
        try {
            const raw = registerPaymentTarget?.unpaidPeriods
                ? (typeof registerPaymentTarget.unpaidPeriods === 'string'
                    ? JSON.parse(registerPaymentTarget.unpaidPeriods)
                    : registerPaymentTarget.unpaidPeriods)
                : [];
            return (Array.isArray(raw) ? raw : []).filter(p => Number(p?.amountDue ?? p?.amount ?? 0) > 0);
        } catch (e) {
            return [];
        }
    })();

    const hasSinglePendingPeriod = dialogPendingPeriods.length === 1;
    const hasMultiplePendingPeriods = dialogPendingPeriods.length > 1;

    // UX (previous behavior):
    // - If there is exactly 1 pending period, show only the "CARGOS BASE" section (no per-period orange box).
    // - Ensure CARGOS BASE reflects that pending period's snapshot values (routeType/originalAmount) to avoid
    //   showing the latest FamilyDetail.routeType for a historical month.
    const singlePendingPeriod = hasSinglePendingPeriod ? dialogPendingPeriods[0] : null;
    const effectiveRouteType = singlePendingPeriod?.routeType || routeType;
    const effectiveMonthlyFee = Number(singlePendingPeriod?.originalAmount ?? dialogMonthlyFee ?? 0) || 0;
    const effectiveBaseFee = studentCount > 0 ? (effectiveMonthlyFee / studentCount) : effectiveMonthlyFee;
    
    // Total a pagar en pestaña de Tarifa: NO incluye mora (se paga por separado)
    const dialogTotalToPay = Math.max(0, 
        dialogLeftover - dialogCredito - dialogExtraDiscount
    );


    return (
        <PageContainer>
            {/* Loading overlay while initial data is fetched */}
            {loading && (
                <Box sx={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Cargando datos...</Typography>
                </Box>
            )}
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={handleBack}
                            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                        >
                            Volver al Dashboard
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <SchoolIcon sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Gestión de Pagos - {school?.name || 'Cargando...'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Chip
                                    size="small"
                                    icon={<CalendarToday />}
                                    label={`Ciclo Escolar ${schoolYear || ''}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Chip
                                    size="small"
                                    icon={<People />}
                                    label={`${totalPayments} familias`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 600 }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            {/* Analysis General de Pagos (full from PaymentsManagementPage) */}
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <SectionCard sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setCollapsedAnalysis(s => !s)}
                                        aria-label={collapsedAnalysis ? 'Expandir análisis' : 'Colapsar análisis'}
                                    >
                                        <ExpandMoreIcon sx={{ transform: collapsedAnalysis ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
                                    </IconButton>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>Análisis General de Pagos</Typography>
                                        <Typography variant="caption" color="text.secondary">Resumen y métricas principales del colegio</Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button size="small" onClick={() => fetchPaymentsAnalysis(schoolId)} sx={{ textTransform: 'none' }}>Actualizar</Button>
                                </Box>
                            </Box>

                            <Collapse in={!collapsedAnalysis} timeout="auto" unmountOnExit>
                                {/* If analysisData available show extended grid and chart */}
                                {analysisData ? (
                                    <Box sx={{ mt: 2 }}>
                                        {/* KPIs Principales */}
                                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1976d2' }}>📊 Indicadores Clave (KPIs)</Typography>
                                        <Box sx={{ mb: 3, p: 2, background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)', borderRadius: 2, boxShadow: 1 }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="caption" color="text.secondary">Tasa de Pago</Typography>
                                                            <Tooltip title="Porcentaje de familias activas que están al día con sus pagos" arrow>
                                                                <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                            </Tooltip>
                                                        </Box>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>{tasaPago}%</Typography>
                                                        <Typography variant="caption" color="text.secondary">{pagadoCount} de {familiasActivas} familias</Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="caption" color="text.secondary">Tasa de Mora</Typography>
                                                            <Tooltip title="Porcentaje de familias activas con pagos atrasados y acumulación de penalidades" arrow>
                                                                <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                            </Tooltip>
                                                        </Box>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#f44336' }}>{tasaMora}%</Typography>
                                                        <Typography variant="caption" color="text.secondary">{moraCount} familias en mora</Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="caption" color="text.secondary">Eficiencia de Cobro</Typography>
                                                            <Tooltip title="Efectividad del cobro: (Ingreso real / Ingreso potencial) × 100. Muestra pérdidas por descuentos, créditos y moras no cobradas" arrow>
                                                                <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                            </Tooltip>
                                                        </Box>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3' }}>{eficienciaCobro}%</Typography>
                                                        <Typography variant="caption" color="text.secondary">Ingreso real vs potencial</Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="caption" color="text.secondary">Tendencia Mensual</Typography>
                                                            <Tooltip title="Variación porcentual de ingresos del mes actual vs mes anterior." arrow>
                                                                <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                            </Tooltip>
                                                        </Box>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: Number(tendencia) >= 0 ? '#4caf50' : '#f44336' }}>
                                                            {Number(tendencia) >= 0 ? '+' : ''}{tendencia}%
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">vs mes anterior</Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Box>

                                        {/* Métricas Financieras */}
                                        <Typography variant="h6" sx={{ mb: 2, mt: 3, fontWeight: 600, color: '#1976d2' }}>💰 Métricas Financieras</Typography>
                                        <Box sx={{ mb: 3, p: 2, background: '#f9fafb', borderRadius: 2, boxShadow: 1 }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Ingreso Total del Año</strong></Typography>
                                                        <Tooltip title="Todo el dinero cobrado durante el año escolar actual (tarifas + moras pagadas; No incluye créditos acumulados)" arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 600 }}>Q {ingresoTotal.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Ingreso Mes Actual</strong></Typography>
                                                        <Tooltip title="Dinero cobrado únicamente en el mes en curso." arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ color: '#2196f3', fontWeight: 600 }}>Q {currentMonthEarnings.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Promedio Mensual</strong></Typography>
                                                        <Tooltip title="Promedio de ingresos por mes durante el año." arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Q {Number(ingresoMensualPromedio).toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Promedio por Familia</strong></Typography>
                                                        <Tooltip title="Cuánto paga en promedio cada familia activa." arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Q {Number(promedioIngresoPorFamilia).toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Ingreso por Mora</strong></Typography>
                                                        <Tooltip title="Dinero cobrado específicamente por moras." arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 600 }}>Q {ingresoMora.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Total Pendiente de Cobro</strong></Typography>
                                                        <Tooltip title="Suma de todas las deudas actuales de tarifas sin pagar." arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ color: '#f44336', fontWeight: 600 }}>Q {totalPendiente.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Mora Pendiente</strong></Typography>
                                                        <Tooltip title="Suma de todas las penalidades por mora acumuladas y no pagadas." arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ color: '#d32f2f', fontWeight: 600 }}>Q {moraPendiente.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Crédito Acumulado</strong></Typography>
                                                        <Tooltip title="Dinero a favor de las familias por pagos adelantados o sobrepagos. Se aplica automáticamente a futuros cobros" arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ color: '#9c27b0', fontWeight: 600 }}>Q {creditoAcumulado.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary"><strong>Total Descuentos</strong></Typography>
                                                        <Tooltip title="Suma de todos los descuentos especiales otorgados a las familias." arrow>
                                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                        </Tooltip>
                                                    </Box>
                                                    <Typography variant="h6" sx={{ color: '#795548', fontWeight: 600 }}>Q {totalDescuentos.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Typography>
                                                </Grid>
                                            </Grid>
                                        </Box>

                                        {/* Distribución de Familias */}
                                        <Typography variant="h6" sx={{ mb: 2, mt: 3, fontWeight: 600, color: '#1976d2' }}>👥 Distribución de Familias</Typography>
                                        <Box sx={{ mb: 3, p: 2, background: '#f9fafb', borderRadius: 2, boxShadow: 1 }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2" color="text.secondary"><strong>Total Familias</strong></Typography>
                                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{totalFamilias}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2" color="text.secondary"><strong>Activas</strong></Typography>
                                                    <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 600 }}>{familiasActivas}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2" color="text.secondary"><strong>Inactivas</strong></Typography>
                                                    <Typography variant="h6" sx={{ color: '#9e9e9e', fontWeight: 600 }}>{inactivoCount}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2" color="text.secondary"><strong>Pagadas</strong></Typography>
                                                    <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 600 }}>{pagadoCount}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2" color="text.secondary"><strong>En Mora</strong></Typography>
                                                    <Typography variant="h6" sx={{ color: '#f44336', fontWeight: 600 }}>{moraCount}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2" color="text.secondary"><strong>Pendientes</strong></Typography>
                                                    <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 600 }}>{pendienteCount}</Typography>
                                                </Grid>
                                                
                                            </Grid>
                                        </Box>

                                        {/* Gráficos */}
                                        <Grid container spacing={3} sx={{ mt: 2 }}>
                                            <Grid item xs={12} md={8}>
                                                <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: 1 }}>
                                                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                                                        📈 Ingresos Mensuales (Pagos + Extraordinarios)
                                                </Typography>
                                                    <Box sx={{ width: '100%', height: 350 }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                                data={(combinedEarnings || []).map(item => ({ 
                                                                    ...item, 
                                                                    label: moment({ year: item.year, month: item.month - 1 }).format('MMM YY'),
                                                                    fullLabel: moment({ year: item.year, month: item.month - 1 }).format('MMMM YYYY')
                                                                }))}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="label" angle={-45} textAnchor="end" height={80} />
                                                                <YAxis tickFormatter={(value) => `Q${(value/1000).toFixed(0)}k`} />
                                                                <RechartsTooltip 
                                                                    formatter={(value) => [`Q ${Number(value).toLocaleString('es-GT', {minimumFractionDigits: 2})}`, 'Ingreso']}
                                                                    labelFormatter={(label, payload) => payload && payload[0] ? payload[0].payload.fullLabel : label}
                                                                />
                                                            <Legend />
                                                                <Bar dataKey="total" name="Ingreso Total" radius={[8, 8, 0, 0]}>
                                                                    {(combinedEarnings || []).map((entry, index) => {
                                                                        const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];
                                                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                                            })}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                    </Box>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: 1, height: '100%' }}>
                                                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                                                        🎯 Estado de Pagos
                                                    </Typography>
                                                    <Box sx={{ width: '100%', height: 300 }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={[
                                                                        { name: 'Pagadas', value: pagadoCount, fill: '#4caf50' },
                                                                        { name: 'En Mora', value: moraCount, fill: '#f44336' },
                                                                        { name: 'Pendientes', value: pendienteCount, fill: '#ff9800' },
                                                                        { name: 'En Proceso', value: enProcesoCount, fill: '#2196f3' },
                                                                        { name: 'Atrasadas', value: atrasadoCount, fill: '#ff5722' }
                                                                    ].filter(item => item.value > 0)}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    labelLine={false}
                                                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                                    outerRadius={80}
                                                                    dataKey="value"
                                                                >
                                                                </Pie>
                                                                <RechartsTooltip formatter={(value, name) => [value + ' familias', name]} />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </Box>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                ) : (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="body2" color="text.secondary">Análisis no disponible. Pulsa Actualizar para intentar cargar datos.</Typography>
                                    </Box>
                                )}
                            </Collapse>
                        </CardContent>
                    </SectionCard>
                </Grid>
                {/* Sección de Pagos Extraordinarios: reutilizamos el componente compartido */}
                <Grid item xs={12}>
                    <SectionCard sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setCollapsedExtra(s => !s)}
                                        aria-label={collapsedExtra ? 'Expandir registro extraordinario' : 'Colapsar registro extraordinario'}
                                    >
                                        <ExpandMoreIcon sx={{ transform: collapsedExtra ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
                                    </IconButton>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>Registro de Pago Extraordinario</Typography>
                                        <Typography variant="caption" color="text.secondary">Registro y listado de pagos extraordinarios del colegio</Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button size="small" onClick={() => fetchPaymentsAnalysis(schoolId)} sx={{ textTransform: 'none' }}>Actualizar</Button>
                                </Box>
                            </Box>

                            <Collapse in={!collapsedExtra} timeout="auto" unmountOnExit>
                                {/* Inner light box to match Analysis visuals */}
                                <Box sx={{ mt: 2, p: 2, background: '#f9fafb', borderRadius: 2, boxShadow: 1 }}>
                                    <ExtraordinaryPaymentSection noWrapper={true} initialSchoolId={schoolId} hideSchoolSelect={true} onPaymentCreated={(newExtra) => {
                                        setSnackbar({ open: true, message: 'Pago extraordinario registrado', severity: 'success' });
                                        // refresh analysis and payments
                                        fetchPaymentsAnalysis(schoolId);
                                        fetchAllPayments(statusFilter, search);
                                    }} />
                                </Box>
                            </Collapse>
                        </CardContent>
                    </SectionCard>
                </Grid>
                <Grid item xs={12}>
                    <ChipsRow>
                        <ToggleButtonGroup
                            value={countersView}
                            exclusive
                            onChange={(e, newView) => {
                                if (newView !== null) setCountersView(newView);
                            }}
                            size="small"
                            sx={{ mr: 2 }}
                        >
                            <ToggleButton value="payment">Estado de Pago</ToggleButton>
                            <ToggleButton value="service">Estado del Servicio</ToggleButton>
                        </ToggleButtonGroup>
                        
                        {countersView === 'payment' ? (
                            <>
                                <Chip label={`Pagados: ${totalPaidCount}`} color="success" />
                                <Chip label={`Pendientes: ${totalPendingCount}`} color="warning" />
                                <Chip label={`En Mora: ${totalMoraCount}`} color="error" />
                                <Chip label={`Eliminados: ${eliminadoCount}`} sx={{ backgroundColor: '#000000', color: 'white' }} />
                            </>
                        ) : (
                            <>
                                <Chip label={`Activos: ${serviceActiveCount}`} color="success" />
                                <Chip label={`Pausados: ${servicePausedCount}`} color="warning" />
                                <Chip label={`Suspendidos: ${serviceSuspendedCount}`} color="error" />
                                <Chip label={`Inactivos: ${serviceInactiveCount}`} sx={{ backgroundColor: '#9e9e9e', color: 'white' }} />
                            </>
                        )}
                        
                        <Box sx={{ flex: 1 }} />
                    </ChipsRow>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                            <PaymentFilters 
                                search={search} 
                                onSearchChange={setSearch} 
                                status={statusFilter} 
                                onStatusChange={setStatusFilter} 
                                autoDebit={autoDebitFilter} 
                                onAutoDebitChange={setAutoDebitFilter} 
                                showDeleted={showDeleted} 
                                onShowDeletedChange={setShowDeleted}
                                serviceStatus={serviceStatusFilter}
                                onServiceStatusChange={setServiceStatusFilter}
                            />
                            <Box sx={{ flex: 1 }} />
                            <Button startIcon={<DownloadIcon />} size="small" onClick={() => setOpenExportStatusDialog(true)} sx={{ textTransform: 'none', mr: 1 }}>
                                Descargar Historial
                            </Button>
                            <Button startIcon={<DownloadIcon />} size="small" onClick={() => setOpenExportByStateDialog(true)} sx={{ textTransform: 'none' }}>
                                Descargar por Estado
                            </Button>
                            {/* Enviar Recordatorio button hidden temporarily per request. Restore when needed:
                                <Button startIcon={<SendIcon />} onClick={() => setSnackbar({ open: true, message: 'Enviar recordatorios (pendiente)', severity: 'info' })}>
                                    Enviar Recordatorio
                                </Button>
                            */}
                        </Box>

                        <PaymentTable
                            payments={pageSlice}
                            onRegisterClick={handleOpenRegister}
                            onReceiptClick={handleOpenReceipt}
                            onEmailClick={handleOpenEmail}
                            onManageClick={handleManagePayments}
                            onManagePeriodsClick={handleManagePeriods}
                            onNotesClick={handleOpenNotes}
                            onDownloadHistory={handleDownloadHistory}
                            order={order}
                            orderBy={orderBy}
                            onRequestSort={handleRequestSort}
                        />

                        <ManagePaymentsModal
                            open={openManageModal}
                            onClose={() => setOpenManageModal(false)}
                            payment={manageTarget}
                            onAction={handleManageAction}
                            onToggleInvoiceSent={handleToggleInvoiceSent}
                        />

                        <ManagePeriodsModal
                            open={openPeriodsModal}
                            onClose={() => setOpenPeriodsModal(false)}
                            payment={periodsTarget}
                            onChanged={() => {
                                // Períodos impactan balances/estados, refrescar dataset y análisis
                                fetchAllPayments(statusFilter, search);
                                fetchPaymentsAnalysis(schoolId);
                            }}
                        />

                        {/* Dialog: Exportar pagos por periodo */}
                        <Dialog
                            open={openExportStatusDialog}
                            onClose={() => setOpenExportStatusDialog(false)}
                            maxWidth="xs"
                            PaperProps={{
                                sx: {
                                    borderRadius: 2,
                                    overflow: 'visible',
                                    width: 380,
                                    maxWidth: 'calc(100% - 32px)'
                                }
                            }}
                        >
                            <DialogTitle sx={{ pb: 2 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Exportar historial de pagos
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Selecciona período y filtros para el reporte en excel.
                                    </Typography>
                                </Box>
                            </DialogTitle>
                            <DialogContent sx={{ pt: 2.5, overflow: 'visible' }}>
                                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <Box sx={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="export-finalstatus-label">Estado de Pago</InputLabel>
                                        <Select
                                            labelId="export-finalstatus-label"
                                            label="Estado de Pago"
                                            value={exportFinalStatus}
                                            onChange={(e) => setExportFinalStatus(e.target.value)}
                                        >
                                            <MenuItem value="TODOS">Todos los estados</MenuItem>
                                            <MenuItem value="PAGADO">PAGADO</MenuItem>
                                            <MenuItem value="PENDIENTE">PENDIENTE</MenuItem>
                                            <MenuItem value="MORA">MORA</MenuItem>
                                            <MenuItem value="ELIMINADO">ELIMINADO</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="export-servicestatus-label">Estado del Servicio</InputLabel>
                                        <Select
                                            labelId="export-servicestatus-label"
                                            label="Estado del Servicio"
                                            value={exportServiceStatus}
                                            onChange={(e) => setExportServiceStatus(e.target.value)}
                                        >
                                            <MenuItem value="TODOS">Todos los estados</MenuItem>
                                            <MenuItem value="ACTIVE">ACTIVO</MenuItem>
                                            <MenuItem value="PAUSED">PAUSADO</MenuItem>
                                            <MenuItem value="SUSPENDED">SUSPENDIDO</MenuItem>
                                            <MenuItem value="INACTIVE">INACTIVO</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="export-month-label">Mes</InputLabel>
                                        <Select
                                            labelId="export-month-label"
                                            label="Mes"
                                            value={exportMonth}
                                            onChange={(e) => setExportMonth(e.target.value)}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        maxHeight: 220
                                                    }
                                                }
                                            }}
                                        >
                                            <MenuItem value="TODOS">Todos los meses</MenuItem>
                                            <MenuItem value="01">Enero</MenuItem>
                                            <MenuItem value="02">Febrero</MenuItem>
                                            <MenuItem value="03">Marzo</MenuItem>
                                            <MenuItem value="04">Abril</MenuItem>
                                            <MenuItem value="05">Mayo</MenuItem>
                                            <MenuItem value="06">Junio</MenuItem>
                                            <MenuItem value="07">Julio</MenuItem>
                                            <MenuItem value="08">Agosto</MenuItem>
                                            <MenuItem value="09">Septiembre</MenuItem>
                                            <MenuItem value="10">Octubre</MenuItem>
                                            <MenuItem value="11">Noviembre</MenuItem>
                                            <MenuItem value="12">Diciembre</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="export-year-label">Año</InputLabel>
                                        <Select
                                            labelId="export-year-label"
                                            label="Año"
                                            value={exportYear}
                                            onChange={(e) => setExportYear(e.target.value)}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        maxHeight: 220
                                                    }
                                                }
                                            }}
                                        >
                                            {exportYearOptions.map((y) => (
                                                <MenuItem key={y} value={y}>{y}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    </Box>
                                </Box>
                            </DialogContent>
                            <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
                                <Button onClick={() => setOpenExportStatusDialog(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="contained" onClick={() => handleDownloadPaymentsByStatus(exportMonth, exportYear)}>
                                    Descargar
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Exportar por Estado (nuevo) */}
                        <Dialog
                            open={openExportByStateDialog}
                            onClose={() => setOpenExportByStateDialog(false)}
                            maxWidth="xs"
                            PaperProps={{
                                sx: {
                                    borderRadius: 2,
                                    overflow: 'visible',
                                    width: 380,
                                    maxWidth: 'calc(100% - 32px)'
                                }
                            }}
                        >
                            <DialogTitle sx={{ pb: 2 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Exportar pagos
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Selecciona el estado de pago y el estado del servicio.
                                    </Typography>
                                </Box>
                            </DialogTitle>
                            <DialogContent sx={{ pt: 2.5, overflow: 'visible' }}>
                                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <Box sx={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="export-by-state-label">Estado de Pago</InputLabel>
                                        <Select
                                            labelId="export-by-state-label"
                                            label="Estado de Pago"
                                            value={exportByStateValue}
                                            onChange={(e) => setExportByStateValue(e.target.value)}
                                        >
                                            <MenuItem value="TODOS">Todos los estados</MenuItem>
                                            <MenuItem value="PAGADO">PAGADO</MenuItem>
                                            <MenuItem value="PENDIENTE">PENDIENTE</MenuItem>
                                            <MenuItem value="MORA">MORA</MenuItem>
                                            <MenuItem value="ELIMINADO">ELIMINADO</MenuItem>
                                        </Select>
                                    </FormControl>

                                    <FormControl fullWidth size="small">
                                        <InputLabel id="export-by-state-servicestatus-label">Estado del Servicio</InputLabel>
                                        <Select
                                            labelId="export-by-state-servicestatus-label"
                                            label="Estado del Servicio"
                                            value={exportByStateServiceStatus}
                                            onChange={(e) => setExportByStateServiceStatus(e.target.value)}
                                        >
                                            <MenuItem value="TODOS">Todos los estados</MenuItem>
                                            <MenuItem value="ACTIVE">ACTIVO</MenuItem>
                                            <MenuItem value="PAUSED">PAUSADO</MenuItem>
                                            <MenuItem value="SUSPENDED">SUSPENDIDO</MenuItem>
                                            <MenuItem value="INACTIVE">INACTIVO</MenuItem>
                                        </Select>
                                    </FormControl>
                                    </Box>
                                </Box>
                            </DialogContent>
                            <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
                                <Button onClick={() => setOpenExportByStateDialog(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="contained" onClick={() => handleDownloadByState(exportByStateValue)}>
                                    Descargar
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Registrar Pago */}
                        <Dialog open={openRegisterDialog} onClose={() => { setOpenRegisterDialog(false); setSelectedReceipt(null); setReceiptZoom(1); setPaymentTab(0); }} fullWidth maxWidth="lg">
                            <DialogTitle>Registrar Pago</DialogTitle>
                            <DialogContent>
                                <Box sx={{ position: 'relative' }}>
                                <Grid container spacing={2}>
                                    {/* Panel de Boletas (Columna Izquierda - Siempre Visible) */}
                                    <Grid item xs={12} md={7}>
                                        <Box sx={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 1, p: 1, height: 580, overflow: 'auto', backgroundColor: '#fff' }}>
                                            <ReceiptsPane
                                                uploadedReceipts={uploadedReceipts}
                                                uploadedReceiptsLoading={uploadedReceiptsLoading}
                                                boletaMonth={boletaMonth}
                                                setBoletaMonth={setBoletaMonth}
                                                boletaMonthOptions={boletaMonthOptions}
                                                filteredUploadedReceipts={filteredUploadedReceipts}
                                                selectedReceipt={selectedReceipt}
                                                setSelectedReceipt={setSelectedReceipt}
                                                receiptZoom={receiptZoom}
                                                setReceiptZoom={setReceiptZoom}
                                                downloadFile={(url, name) => {
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = name || '';
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                }}
                                            />
                                        </Box>
                                    </Grid>
                                    
                                    {/* Panel de Formulario (Columna Derecha - Con Pestañas) */}
                                    <Grid item xs={12} md={5}>
                                        {/* Pestañas para separar Pago de Tarifa y Pago de Mora */}
                                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                            <Tabs value={paymentTab} onChange={(e, newValue) => setPaymentTab(newValue)}>
                                                <Tab label="Pago de Tarifa" />
                                                <Tab 
                                                    label={`Pago de Mora ${basePenaltyDue > 0 ? `(Q ${basePenaltyDue.toFixed(2)})` : '(Q 0.00)'}`}
                                                    sx={{
                                                        color: basePenaltyDue > 0 ? 'error.main' : 'inherit',
                                                        fontWeight: basePenaltyDue > 0 ? 700 : 400,
                                                        '&.Mui-selected': {
                                                            color: basePenaltyDue > 0 ? 'error.main' : 'primary.main'
                                                        }
                                                    }}
                                                />
                                            </Tabs>
                                        </Box>

                                        {/* Tab Panel 0: Pago de Tarifa */}
                                        {paymentTab === 0 && (
                                        <Box sx={{ maxWidth: 420 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {registerPaymentTarget ? `Familia: ${registerPaymentTarget.User?.FamilyDetail?.familyLastName || ''}` : ''}
                                                {registerPaymentTarget && (
                                                    ` (${studentCount} ${studentCount === 1 ? 'estudiante' : 'estudiantes'})`
                                                )}
                                            </Typography>
                                            {/* Show D/A chip when automatic debit is active on the payment or the family's record */}
                                            { (registerPaymentTarget && (registerPaymentTarget.automaticDebit || registerPaymentTarget.User?.FamilyDetail?.automaticDebit)) && (
                                                <Chip label="D/A" size="small" color="primary" sx={{ height: 22, fontSize: '0.75rem' }} />
                                            ) }
                                            {registerPaymentTarget?.autoDebit && (
                                                <Chip label="D/A" size="small" color="primary" sx={{ height: 22, fontSize: '0.75rem' }} />
                                            )}
                                        </Box>
                                        {/* Payment summary block: Desglose detallado del cálculo */}
                                        <Box sx={{ mb: 2, p: 2, backgroundColor: '#fafafa', borderRadius: 1, border: '1px solid rgba(0,0,0,0.04)' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>📋 Desglose de Pago</Typography>
                                            
                                            {/* Sección: Cargos Base */}
                                            {dialogPendingPeriods.length <= 1 && (
                                                <Box sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', display: 'block', mb: 1 }}>
                                                        CARGOS BASE
                                                    </Typography>
                                                    
                                                    {/* Tarifa base por estudiante */}
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Tarifa base
                                                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.disabled' }}>
                                                                ({effectiveRouteType})
                                                            </Typography>
                                                        </Typography>
                                                        <Typography variant="body2">{formatCurrency(effectiveBaseFee)}</Typography>
                                                    </Box>
                                                    
                                                    {/* Tarifa mensual total (base × estudiantes) */}
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Tarifa mensual
                                                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.disabled' }}>
                                                                        ({studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'})
                                                                    </Typography>
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatCurrency(effectiveMonthlyFee)}</Typography>
                                                    </Box>
                                                </Box>
                                            )}

                                            {/* Sección: Descuentos y Créditos */}
                                            {(() => {
                                                // When there are multiple unpaid periods, the family discount can vary per period.
                                                // Avoid showing a misleading single "Descuento familiar" line here.
                                                const showFamilyLine = dialogFamilySpecialFee > 0 && !hasMultiplePendingPeriods;
                                                const showBlock = dialogCredito > 0 || showFamilyLine || dialogExtraDiscount > 0;
                                                if (!showBlock) return null;

                                                return (
                                                <Box sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main', display: 'block', mb: 1 }}>
                                                        DESCUENTOS Y CRÉDITOS
                                                    </Typography>
                                                    
                                                    {dialogCredito > 0 && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                            <Typography variant="body2" color="text.secondary">Crédito a favor</Typography>
                                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                                                                - {formatCurrency(dialogCredito)}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    
                                                    {showFamilyLine && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Descuento familiar
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                                                                - {formatCurrency(dialogFamilySpecialFee)}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    
                                                    {dialogExtraDiscount > 0 && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                            <Typography variant="body2" color="text.secondary">Descuento extraordinario</Typography>
                                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                                                                - {formatCurrency(dialogExtraDiscount)}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                                );
                                            })()}

                                            {/* Desglose por períodos pendientes si hay varios meses */}
                                            {(() => {
                                                try {
                                                    const periods = dialogPendingPeriods;
                                                    
                                                    if (Array.isArray(periods) && periods.length > 1) {
                                                        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                                                        
                                                        return (
                                                            <Box sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                                                                <Box sx={{ p: 1.5, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ff9800' }}>
                                                                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1.5, color: '#e65100' }}>
                                                                        ⚠️ Períodos pendientes ({periods.length} meses):
                                                                    </Typography>
                                                                    {periods.map((period, idx) => {
                                                                        const periodDate = moment(period.period);
                                                                        const monthName = monthNames[periodDate.month()];
                                                                        const year = periodDate.year();
                                                                        const dueDate = period.dueDate ? moment(period.dueDate).format('DD/MM/YY') : 'N/A';
                                                                        
                                                                        // Verificar si es pago parcial
                                                                        const originalAmount = Number(period.originalAmount ?? dialogMonthlyFee ?? 0) || 0;
                                                                        const periodDiscount = Number(period.discountApplied ?? 0) || 0;
                                                                        const periodNetAmount = Number(period.netAmount ?? (originalAmount - periodDiscount)) || 0;
                                                                        const periodAmountDue = Number(period.amountDue ?? period.amount ?? 0) || 0;

                                                                        const periodRouteType = period.routeType || routeType;

                                                                        // Tarifa base por estudiante para este período
                                                                        const safeStudentCount = studentCount;
                                                                        const periodBaseFee = safeStudentCount > 0 ? (originalAmount / safeStudentCount) : originalAmount;

                                                                        const isParcial = periodAmountDue < periodNetAmount && periodAmountDue > 0;
                                                                        const amountPaid = isParcial
                                                                            ? (periodNetAmount - periodAmountDue)
                                                                            : (Number(period.amountPaid ?? 0) || 0);
                                                                        
                                                                        return (
                                                                            <Box key={idx} sx={{ mb: idx < periods.length - 1 ? 2 : 0, pb: idx < periods.length - 1 ? 2 : 0, borderBottom: idx < periods.length - 1 ? '1px dashed rgba(0,0,0,0.15)' : 'none' }}>
                                                                                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, color: 'text.primary' }}>
                                                                                    • {monthName} {year}
                                                                                    <Typography component="span" sx={{ fontSize: '0.65rem', ml: 0.5, color: 'text.disabled' }}>
                                                                                        (Vence: {dueDate})
                                                                                    </Typography>
                                                                                    {isParcial && (
                                                                                        <Typography component="span" sx={{ 
                                                                                            fontSize: '0.65rem', 
                                                                                            ml: 1, 
                                                                                            px: 0.75, 
                                                                                            py: 0.25,
                                                                                            backgroundColor: '#fff3e0',
                                                                                            color: '#e65100',
                                                                                            borderRadius: '4px',
                                                                                            fontWeight: 600
                                                                                        }}>
                                                                                            📝 PAGO PARCIAL
                                                                                        </Typography>
                                                                                    )}
                                                                                </Typography>

                                                                                {/* Tarifa base */}
                                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, ml: 2 }}>
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        Tarifa base
                                                                                        <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.disabled' }}>
                                                                                            ({periodRouteType})
                                                                                        </Typography>
                                                                                        :
                                                                                    </Typography>
                                                                                    <Typography variant="caption">
                                                                                        {formatCurrency(periodBaseFee)}
                                                                                    </Typography>
                                                                                </Box>
                                                                                
                                                                                {/* Tarifa mensual */}
                                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, ml: 2 }}>
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        Tarifa mensual ({studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'}):
                                                                                    </Typography>
                                                                                    <Typography variant="caption">
                                                                                        {formatCurrency(originalAmount)}
                                                                                    </Typography>
                                                                                </Box>
                                                                                
                                                                                {/* Descuento familiar aplicado a este período (puede variar por mes) */}
                                                                                {periodDiscount > 0 && (
                                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3, ml: 2 }}>
                                                                                        <Typography variant="caption" color="text.secondary">
                                                                                            Descuento familiar:
                                                                                        </Typography>
                                                                                        <Typography variant="caption" sx={{ color: 'success.main' }}>
                                                                                            - {formatCurrency(periodDiscount)}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                )}
                                                                                
                                                                                {/* Mostrar desglose de pago parcial */}
                                                                                {isParcial && (
                                                                                    <>
                                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3, ml: 2 }}>
                                                                                            <Typography variant="caption" sx={{ color: 'info.main', fontStyle: 'italic' }}>
                                                                                                Ya pagado:
                                                                                            </Typography>
                                                                                            <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 500 }}>
                                                                                                {formatCurrency(amountPaid)}
                                                                                            </Typography>
                                                                                        </Box>
                                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3, ml: 2 }}>
                                                                                            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 500 }}>
                                                                                                Saldo pendiente:
                                                                                            </Typography>
                                                                                            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
                                                                                                {formatCurrency(periodAmountDue)}
                                                                                            </Typography>
                                                                                        </Box>
                                                                                    </>
                                                                                )}
                                                                                
                                                                                {/* Subtotal del período */}
                                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, ml: 2, pt: 0.5, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                                                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                                                        {isParcial ? 'A pagar este período:' : 'Subtotal período:'}
                                                                                    </Typography>
                                                                                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                                                        {formatCurrency(periodAmountDue)}
                                                                                    </Typography>
                                                                                </Box>
                                                                            </Box>
                                                                        );
                                                                    })}
                                                                </Box>
                                                            </Box>
                                                        );
                                                    }

                                                    // Caso: solo 1 período pendiente
                                                    // UX: cuando hay 1 solo período pendiente, se muestra únicamente "CARGOS BASE" arriba.
                                                    if (Array.isArray(periods) && periods.length === 1) {
                                                        return null;
                                                    }
                                                } catch (e) {
                                                    console.error('Error parsing periods:', e);
                                                }
                                                return null;
                                            })()}

                                            {/* Total a pagar */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, borderTop: '2px solid rgba(0,0,0,0.12)' }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>💰 Total a pagar</Typography>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'primary.main' }}>
                                                    {formatCurrency(dialogTotalToPay)}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <TextField
                                            label="Monto pagado"
                                            type="number"
                                            fullWidth
                                            value={registerAmount}
                                            onChange={(e) => setRegisterAmount(e.target.value)}
                                            disabled={uploadedReceiptsLoading || regHistLoading}
                                            inputProps={{ min: 0, step: '0.01' }}
                                            sx={{ mb: 2 }}
                                        />
                                        <TextField
                                            label="Fecha del Pago"
                                            type="date"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            value={registerPaymentExtra.paymentDate}
                                            onChange={(e) => setRegisterPaymentExtra(prev => ({ ...prev, paymentDate: e.target.value }))}
                                            disabled={uploadedReceiptsLoading || regHistLoading}
                                            sx={{ mb: 2 }}
                                        />
                                        <TextField
                                            label="Número de Boleta"
                                            fullWidth
                                            value={registerPaymentExtra.numeroBoleta}
                                            onChange={(e) => setRegisterPaymentExtra(prev => ({ ...prev, numeroBoleta: e.target.value }))}
                                            disabled={uploadedReceiptsLoading || regHistLoading}
                                            sx={{ mb: 2 }}
                                        />
                                        <TextField
                                            label="Descuento Extraordinario (Q)"
                                            type="number"
                                            fullWidth
                                            value={registerPaymentExtra.extraordinaryDiscount}
                                            onChange={(e) => setRegisterPaymentExtra(prev => ({ ...prev, extraordinaryDiscount: e.target.value }))}
                                            disabled={uploadedReceiptsLoading || regHistLoading}
                                            sx={{ mb: 2 }}
                                        />
                                        <FormControl fullWidth sx={{ mb: 0 }}>
                                            <InputLabel>Número de Cuenta</InputLabel>
                                            <Select
                                                label="Número de Cuenta"
                                                value={registerPaymentExtra.bankAccountNumber}
                                                onChange={(e) => setRegisterPaymentExtra(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                                                disabled={uploadedReceiptsLoading || regHistLoading}
                                            >
                                                    {(() => {
                                                        const seen = new Set();
                                                        const entries = [];
                                                        try {
                                                            const sources = [];
                                                            if (Array.isArray(allSchools) && allSchools.length > 0) sources.push(...allSchools);
                                                            if (registerPaymentTarget?.schoolId && !sources.find(s => s.id === registerPaymentTarget.schoolId)) {
                                                                const found = allSchools.find(s => s.id === registerPaymentTarget.schoolId);
                                                                if (found) sources.push(found);
                                                            }

                                                            sources.forEach(sch => {
                                                                const raw = sch?.bankAccount || '';
                                                                if (!raw) return;
                                                                const parts = raw.split(/[|,;]+/).map(p => p.trim()).filter(Boolean);
                                                                if (parts.length > 0) {
                                                                    parts.forEach(p => {
                                                                        const key = `${sch.id}::${p}`;
                                                                        if (!seen.has(key)) { seen.add(key); entries.push({ key, value: p, label: `${sch.name} - ${p}` }); }
                                                                    });
                                                                } else {
                                                                    const key = `${sch.id}::${raw}`;
                                                                    if (!seen.has(key)) { seen.add(key); entries.push({ key, value: raw, label: `${sch.name} - ${raw}` }); }
                                                                }
                                                            });
                                                        } catch (e) {
                                                            // ignore
                                                        }
                                                        if (entries.length === 0) return <MenuItem value="">(No configurado)</MenuItem>;
                                                        return entries.map(opt => <MenuItem key={opt.key} value={opt.value}>{opt.label}</MenuItem>);
                                                    })()}
                                            </Select>
                                        </FormControl>
                                        </Box>
                                        )}

                                {/* Tab Panel 1: Pago de Mora */}
                                {paymentTab === 1 && (
                                <Box>
                                    <Typography variant="h6" sx={{ mb: 2, color: basePenaltyDue > 0 ? 'error.main' : 'success.main' }}>
                                        {basePenaltyDue > 0 ? '💰 Pago de Mora Acumulada' : '✅ Sin Mora Pendiente'}
                                    </Typography>
                                    
                                    {/* Información de la familia */}
                                    <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                            {registerPaymentTarget ? `Familia: ${registerPaymentTarget.User?.FamilyDetail?.familyLastName || ''}` : ''}
                                            {registerPaymentTarget && (
                                                ` (${studentCount} ${studentCount === 1 ? 'estudiante' : 'estudiantes'})`
                                            )}
                                        </Typography>
                                        
                                        {/* Desglose de mora */}
                                        <Box sx={{ mt: 2, p: 2, bgcolor: '#fff', borderRadius: 1, border: '1px solid rgba(211, 47, 47, 0.2)' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main', display: 'block', mb: 1 }}>
                                                MORA ACUMULADA
                                            </Typography>
                                            
                                            {/* Indicador de mora congelada */}
                                            {registerPaymentTarget?.penaltyFrozenAt ? (
                                                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffc107' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#856404', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        ❄️ Mora Congelada
                                                    </Typography>
                                                    {registerPaymentTarget?.penaltyFrozenUntil ? (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                            Congelada hasta el {moment(registerPaymentTarget.penaltyFrozenUntil).format('DD [de] MMMM, YYYY')} — limpieza del período {moment(registerPaymentTarget.penaltyFrozenUntil).format('MMMM YYYY')}{registerPaymentTarget?.penaltyFrozenAt ? ` aplicada el ${moment(registerPaymentTarget.penaltyFrozenAt).format('DD [de] MMMM, YYYY')}` : ''}
                                                        </Typography>
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                            Congelada desde el {moment(registerPaymentTarget.penaltyFrozenAt).format('DD [de] MMMM, YYYY')}
                                                            {registerPaymentTarget?.penaltyStartDate && (
                                                                <> ({moment(registerPaymentTarget.penaltyFrozenAt).diff(moment(registerPaymentTarget.penaltyStartDate), 'days') + 1} días de mora)</>
                                                            )}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            ) : (
                                                registerPaymentTarget?.penaltyStartDate && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                        📅 Desde el {moment(registerPaymentTarget.penaltyStartDate).format('DD [de] MMMM, YYYY')}
                                                        {' '}({moment(registerPaymentExtra?.paymentDate || moment().format('YYYY-MM-DD')).diff(moment(registerPaymentTarget.penaltyStartDate), 'days') + 1} días de atraso)
                                                    </Typography>
                                                )
                                            )}
                                            
                                            {/* Mora acumulada */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                                <Typography variant="body2" color="text.secondary">Mora acumulada:</Typography>
                                                <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
                                                    {formatCurrency(basePenaltyDue)}
                                                </Typography>
                                            </Box>

                                            {/* Exoneración (si hay monto en el campo) */}
                                            {(() => {
                                                const exonerateValue = isExonerating ? Number(exonerateAmount || 0) : Number(discountPenaltyAmount || 0);
                                                if (exonerateValue > 0) {
                                                    return (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {isExonerating ? 'Exoneración completa:' : 'Exoneración parcial:'}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                                                                - {formatCurrency(exonerateValue)}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {/* Total a pagar (mora - exoneración) */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Total a pagar:</Typography>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: basePenaltyDue > 0 ? 'error.main' : 'success.main' }}>
                                                    {(() => {
                                                        const exonerateValue = isExonerating ? Number(exonerateAmount || 0) : Number(discountPenaltyAmount || 0);
                                                        const total = Math.max(0, basePenaltyDue - exonerateValue);
                                                        return formatCurrency(total);
                                                    })()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* Toggle de Exoneración Completa */}
                                    {basePenaltyDue > 0 && (
                                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                ✅ Exoneración Completa
                                            </Typography>
                                            <Switch 
                                                checked={isExonerating}
                                                onChange={(e) => {
                                                    setIsExonerating(e.target.checked);
                                                    if (e.target.checked) {
                                                        // Cuando se activa exoneración completa:
                                                        // - Monto a pagar = 0
                                                        // - Número de boleta = 004
                                                        // - Exonerar mora = total de la mora
                                                        setPayPenaltyAmount('0');
                                                        setPayPenaltyBoleta('004');
                                                        setDiscountPenaltyAmount(basePenaltyDue.toString());
                                                        setExonerateAmount(basePenaltyDue.toString());
                                                    } else {
                                                        // Limpiar campos al desactivar
                                                        setPayPenaltyAmount('');
                                                        setPayPenaltyBoleta('');
                                                        setDiscountPenaltyAmount('');
                                                        setExonerateAmount('');
                                                    }
                                                }}
                                                color="success"
                                            />
                                        </Box>
                                    )}

                                    {/* Formulario de pago de mora (siempre visible, pero algunos campos bloqueados cuando está exonerando) */}
                                    <TextField
                                        label="Monto a Pagar"
                                        type="number"
                                        fullWidth
                                        value={payPenaltyAmount}
                                        onChange={(e) => setPayPenaltyAmount(e.target.value)}
                                        inputProps={{ min: 0, step: '0.01', max: basePenaltyDue }}
                                        sx={{ mb: 2 }}
                                        disabled={basePenaltyDue === 0 || isExonerating}
                                        helperText={isExonerating ? "Exoneración completa: No se realizará pago" : ""}
                                    />
                                    <TextField
                                        label="Fecha del Pago"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={payPenaltyDate}
                                        onChange={(e) => setPayPenaltyDate(e.target.value)}
                                        sx={{ mb: 2 }}
                                    />
                                    
                                    {/* Alert for retroactive penalty calculation */}
                                    {isRetroactivePayment && retroactivePenalty && (
                                        <Box sx={{ mb: 2, p: 2, bgcolor: retroactivePenalty.daysUntilPayment === 0 ? '#e8f5e9' : '#fff3e0', borderRadius: 1, border: retroactivePenalty.daysUntilPayment === 0 ? '1px solid #4caf50' : '1px solid #ff9800' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: retroactivePenalty.daysUntilPayment === 0 ? '#2e7d32' : '#e65100', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                                {retroactivePenalty.daysUntilPayment === 0 ? '✅' : '⏰'} PAGO RETROACTIVO DETECTADO
                                            </Typography>
                                            
                                            {retroactivePenalty.daysUntilPayment > 0 ? (
                                                <>
                                                    <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                                                        <strong>Fecha de pago:</strong> {retroactivePenalty.paymentDate}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                                                        <strong>Inicio de mora:</strong> {retroactivePenalty.penaltyStartDate}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                                                        <strong>Días de mora hasta esa fecha:</strong> {retroactivePenalty.daysUntilPayment} días
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                                                        <strong>Cálculo:</strong> {retroactivePenalty.daysUntilPayment} días × Q{retroactivePenalty.dailyPenalty} × {retroactivePenalty.studentCount} estudiante{retroactivePenalty.studentCount > 1 ? 's' : ''}
                                                    </Typography>
                                                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff', borderRadius: 1, border: '2px solid #ff9800' }}>
                                                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#e65100' }}>
                                                            💰 Mora hasta {moment(payPenaltyDate).format('DD/MM/YYYY')}: <span style={{ fontSize: '1.2em' }}>Q{retroactivePenalty.penaltyUntilPaymentDate.toFixed(2)}</span>
                                                        </Typography>
                                                    </Box>
                                                    
                                                    {/* Mostrar cálculo con pago y exoneración */}
                                                    {(() => {
                                                        const paymentAmount = Number(payPenaltyAmount || 0);
                                                        const exonerationAmount = isExonerating 
                                                            ? Number(exonerateAmount || 0) 
                                                            : Number(discountPenaltyAmount || 0);
                                                        const totalReduction = paymentAmount + exonerationAmount;
                                                        
                                                        if (paymentAmount > 0 || exonerationAmount > 0) {
                                                            const willCoverFull = totalReduction >= retroactivePenalty.penaltyUntilPaymentDate;
                                                            return (
                                                                <Box sx={{ mt: 2, p: 1.5, bgcolor: willCoverFull ? '#e8f5e9' : '#fff3e0', borderRadius: 1, border: willCoverFull ? '2px solid #4caf50' : '1px solid #ff9800' }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: willCoverFull ? '#2e7d32' : '#e65100', mb: 1 }}>
                                                                        📊 Aplicación del Pago Retroactivo:
                                                                    </Typography>
                                                                    {paymentAmount > 0 && (
                                                                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                                                            • Pago: Q{paymentAmount.toFixed(2)}
                                                                        </Typography>
                                                                    )}
                                                                    {exonerationAmount > 0 && (
                                                                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                                                            • Exoneración: Q{exonerationAmount.toFixed(2)}
                                                                        </Typography>
                                                                    )}
                                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.5 }}>
                                                                        • Total: Q{totalReduction.toFixed(2)}
                                                                    </Typography>
                                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: willCoverFull ? '#2e7d32' : '#e65100', mt: 1.5 }}>
                                                                        {willCoverFull ? (
                                                                            <>✅ Cubre toda la mora hasta {moment(payPenaltyDate).format('DD/MM/YYYY')}</>
                                                                        ) : (
                                                                            <>⚠️ Pago parcial: Debe pagarse el monto completo</>
                                                                        )}
                                                                    </Typography>
                                                                </Box>
                                                             );
                                                        }
                                                        return null;
                                                    })()}
                                                </>
                                            ) : (
                                                <Typography variant="body2" sx={{ color: '#2e7d32' }}>
                                                    {retroactivePenalty.message}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                    
                                    <TextField
                                        label="Número de Boleta"
                                        fullWidth
                                        value={payPenaltyBoleta}
                                        onChange={(e) => setPayPenaltyBoleta(e.target.value)}
                                        sx={{ mb: 2 }}
                                        disabled={isExonerating}
                                        helperText={isExonerating ? "004 - Exoneración completa" : ""}
                                    />
                                    <TextField
                                        label="Exonerar Mora (Q)"
                                        type="number"
                                        fullWidth
                                        value={discountPenaltyAmount}
                                        onChange={(e) => setDiscountPenaltyAmount(e.target.value)}
                                        inputProps={{ min: 0, step: '0.01', max: basePenaltyDue }}
                                        sx={{ mb: 2 }}
                                        disabled={basePenaltyDue === 0 || isExonerating}
                                        helperText={isExonerating ? "Exoneración del monto completo de la mora" : ""}
                                    />
                                    <FormControl fullWidth sx={{ mb: 2 }}>
                                        <InputLabel>Número de Cuenta</InputLabel>
                                        <Select
                                            label="Número de Cuenta"
                                            value={payPenaltyAccount}
                                            onChange={(e) => setPayPenaltyAccount(e.target.value)}
                                        >
                                            {(() => {
                                                const seen = new Set();
                                                const entries = [];
                                                try {
                                                    const sources = [];
                                                    if (Array.isArray(allSchools) && allSchools.length > 0) sources.push(...allSchools);
                                                    if (registerPaymentTarget?.schoolId && !sources.find(s => s.id === registerPaymentTarget.schoolId)) {
                                                        const found = allSchools.find(s => s.id === registerPaymentTarget.schoolId);
                                                        if (found) sources.push(found);
                                                    }

                                                    sources.forEach(sch => {
                                                        const raw = sch?.bankAccount || '';
                                                        if (!raw) return;
                                                        const parts = raw.split(/[|,;]+/).map(p => p.trim()).filter(Boolean);
                                                        if (parts.length > 0) {
                                                            parts.forEach(p => {
                                                                const key = `${sch.id}::${p}`;
                                                                if (!seen.has(key)) { seen.add(key); entries.push({ key, value: p, label: `${sch.name} - ${p}` }); }
                                                            });
                                                        } else {
                                                            const key = `${sch.id}::${raw}`;
                                                            if (!seen.has(key)) { seen.add(key); entries.push({ key, value: raw, label: `${sch.name} - ${raw}` }); }
                                                        }
                                                    });
                                                } catch (e) {
                                                    // ignore
                                                }
                                                if (entries.length === 0) return <MenuItem value="">(No configurado)</MenuItem>;
                                                    return entries.map(opt => <MenuItem key={opt.key} value={opt.value}>{opt.label}</MenuItem>);
                                                })()}
                                        </Select>
                                    </FormControl>

                                    {basePenaltyDue > 0 ? (
                                        <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffc107' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                💡 <strong>Nota:</strong> Este pago se aplicará exclusivamente a la mora acumulada. 
                                                El saldo de tarifa permanecerá sin cambios.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Box sx={{ mt: 2, p: 2, bgcolor: '#d4edda', borderRadius: 1, border: '1px solid #c3e6cb' }}>
                                            <Typography variant="caption" sx={{ color: '#155724' }}>
                                                ✅ <strong>Esta familia no tiene mora pendiente.</strong>
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                                )}
                                    </Grid>
                                </Grid>
                                
                                {/* Loading overlay when receipts/history are being fetched */}
                                {(uploadedReceiptsLoading || regHistLoading) && (
                                    <Box sx={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', zIndex: 30 }}>
                                        <CircularProgress />
                                        <Typography sx={{ mt: 2 }}>Cargando información de boletas y historial...</Typography>
                                    </Box>
                                )}
                                </Box>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => { setOpenRegisterDialog(false); setSelectedReceipt(null); setReceiptZoom(1); setPaymentTab(0); }} disabled={uploadedReceiptsLoading || regHistLoading}>Cancelar</Button>
                                
                                {/* Botón para Pago de Tarifa */}
                                {paymentTab === 0 && (
                                    <Button variant="contained" onClick={async () => {
                                        await handleConfirmRegister();
                                        // ensure receipt view reset after confirming
                                        setSelectedReceipt(null);
                                        setReceiptZoom(1);
                                    }} disabled={!registerAmount || uploadedReceiptsLoading || regHistLoading}>
                                        Registrar Pago de Tarifa
                                    </Button>
                                )}
                                
                                {/* Botón para Pago de Mora */}
                                {paymentTab === 1 && (
                                    <Button variant="contained" color={isExonerating ? "success" : "warning"} onClick={async () => {
                                        // Obtener valores de los campos
                                        const amt = Number(payPenaltyAmount || 0);
                                        const discount = Number(discountPenaltyAmount || 0);
                                        
                                        // Validar monto - permitir 0 si hay descuento/exoneración
                                        if (Number.isNaN(amt) || amt < 0) {
                                            setSnackbar({ open: true, message: 'Ingrese un monto válido', severity: 'error' });
                                            return;
                                        }
                                        
                                        // Validar que al menos uno tenga valor (pago o exoneración)
                                        if (amt === 0 && discount === 0) {
                                            setSnackbar({ open: true, message: 'Debe ingresar un monto de pago o de exoneración', severity: 'error' });
                                            return;
                                        }
                                        
                                        // Validar que la suma no exceda la mora
                                        const total = amt + discount;
                                        if (total > basePenaltyDue) {
                                            setSnackbar({ open: true, message: `El monto total (pago + exoneración) excede la mora adeudada (Q${basePenaltyDue.toFixed(2)})`, severity: 'error' });
                                            return;
                                        }
                                        
                                        try {
                                            const payloadData = {
                                                paymentId: registerPaymentTarget.id,
                                                amount: amt,
                                                extraordinaryDiscount: discount || 0,
                                                realPaymentDate: payPenaltyDate,
                                                receiptNumber: payPenaltyBoleta,
                                                bankAccount: payPenaltyAccount,
                                                notes: discount > 0 ? `Descuento/Exoneración de mora: Q${discount.toFixed(2)}` : null,
                                                source: 'manual'
                                            };
                                            console.log('[PAY PENALTY] Enviando payload:', payloadData);
                                            
                                            const response = await api.post('/payments/pay-penalty', payloadData);
                                            console.log('[PAY PENALTY] Respuesta recibida:', response.data);
                                            
                                            setSnackbar({ 
                                                open: true, 
                                                message: isExonerating 
                                                    ? `Mora exonerada: Q${discount.toFixed(2)}` 
                                                    : 'Pago de mora registrado exitosamente', 
                                                severity: 'success' 
                                            });
                                            setOpenRegisterDialog(false);
                                            setIsExonerating(false);
                                            setPayPenaltyAmount('');
                                            setPayPenaltyBoleta('');
                                            setPayPenaltyAccount('');
                                            setPayPenaltyDate(moment().format('YYYY-MM-DD'));
                                            setDiscountPenaltyAmount('');
                                            setExonerateAmount('');
                                            setPaymentTab(0);
                                            // Refrescar datos
                                            await fetchAllPayments(statusFilter, search);
                                        } catch (err) {
                                            console.error('Error procesando mora:', err);
                                            const errorMsg = err.response?.data?.message || 'Error al procesar el pago de mora';
                                            setSnackbar({ open: true, message: errorMsg, severity: 'error' });
                                        }
                                    }} disabled={uploadedReceiptsLoading || regHistLoading || basePenaltyDue === 0 || (() => {
                                        // Validar campos requeridos para habilitar el botón
                                        const amt = Number(payPenaltyAmount || 0);
                                        const discount = Number(discountPenaltyAmount || 0);
                                        
                                        // Si es exoneración completa, solo validar fecha y cuenta
                                        if (isExonerating) {
                                            return !payPenaltyDate || !payPenaltyAccount;
                                        }
                                        
                                        // Para pago normal: validar monto + fecha + boleta + cuenta
                                        // Al menos debe tener monto de pago O descuento
                                        if (amt === 0 && discount === 0) {
                                            return true; // Deshabilitar si no hay monto
                                        }
                                        
                                        // Si hay monto de pago, validar que haya boleta
                                        if (amt > 0 && !payPenaltyBoleta) {
                                            return true; // Deshabilitar si falta boleta
                                        }
                                        
                                        // Validar fecha y cuenta (siempre requeridos)
                                        return !payPenaltyDate || !payPenaltyAccount;
                                    })()}>
                                        {isExonerating ? 'Confirmar Exoneración' : 'Registrar Pago de Mora'}
                                    </Button>
                                )}
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Editar Número de Recibo */}
                        <Dialog open={openReceiptDialog} onClose={() => setOpenReceiptDialog(false)} fullWidth maxWidth="sm">
                            <DialogTitle>Editar Número de Recibo</DialogTitle>
                            <DialogContent>
                                <TextField
                                    label="Número de recibo"
                                    fullWidth
                                    value={receiptNumberDraft}
                                    onChange={(e) => setReceiptNumberDraft(e.target.value)}
                                />
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setOpenReceiptDialog(false)}>Cancelar</Button>
                                <Button variant="contained" onClick={handleSaveReceipt}>Guardar</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Notas */}
                        <Dialog open={openNotesDialog} onClose={handleCloseNotes} fullWidth maxWidth="sm">
                            <DialogTitle>Editar Notas</DialogTitle>
                            <DialogContent>
                                <TextField
                                    label="Notas"
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    value={notesDraft}
                                    onChange={(e) => setNotesDraft(e.target.value)}
                                />
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleCloseNotes}>Cancelar</Button>
                                <Button variant="contained" onClick={handleSaveNotes}>Guardar</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Enviar Email */}
                        <Dialog open={openEmailDialog} onClose={() => setOpenEmailDialog(false)} fullWidth maxWidth="sm">
                            <DialogTitle>Enviar Correo</DialogTitle>
                            <DialogContent>
                                <TextField
                                    label="Asunto"
                                    fullWidth
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    sx={{ mb: 2 }}
                                />
                                <TextField
                                    label="Mensaje"
                                    fullWidth
                                    multiline
                                    minRows={4}
                                    value={emailMessage}
                                    onChange={(e) => setEmailMessage(e.target.value)}
                                />
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setOpenEmailDialog(false)}>Cancelar</Button>
                                <Button variant="contained" onClick={handleSendEmail} disabled={!emailSubject && !emailMessage}>Enviar</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Configurar Auto Débito */}
                        <Dialog open={openAutoDebitDialog} onClose={() => setOpenAutoDebitDialog(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>Activar Débito Automático</DialogTitle>
                            <DialogContent>
                                <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #2196f3' }}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        <strong>¿A partir de cuándo deseas aplicar el débito automático?</strong>
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Selecciona si el débito automático debe aplicarse al mes actual o al siguiente mes.
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ mb: 2, fontWeight: 'bold' }}>
                                    Selecciona una opción:
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Button 
                                        variant="outlined" 
                                        color="primary"
                                        fullWidth
                                        onClick={async () => {
                                            try {
                                                const { userId } = autoDebitPayload;
                                                await api.post('/payments/v2/activate-auto-debit', { 
                                                    userId,
                                                    activateAutoDebit: true,
                                                    applyToCurrentMonth: true 
                                                });
                                                setSnackbar({ 
                                                    open: true, 
                                                    message: 'Débito automático activado para el mes actual. Se procesó el pago y se exoneró la mora existente.', 
                                                    severity: 'success' 
                                                });
                                                setOpenAutoDebitDialog(false);
                                                setAutoDebitPayload(null);
                                                // Actualizar vista
                                                await fetchAllPayments(statusFilter, search);
                                            } catch (err) {
                                                console.error(err);
                                                setSnackbar({ open: true, message: 'Error activando débito automático', severity: 'error' });
                                            }
                                        }}
                                        sx={{ py: 2, textAlign: 'left', justifyContent: 'flex-start' }}
                                    >
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                📅 Aplicar al mes actual
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Si ya pasó la fecha de pago, se procesará inmediatamente y se exonerará la mora existente.
                                            </Typography>
                                        </Box>
                                    </Button>
                                    
                                    <Button 
                                        variant="outlined" 
                                        color="secondary"
                                        fullWidth
                                        onClick={async () => {
                                            try {
                                                const { userId } = autoDebitPayload;
                                                await api.post('/payments/v2/activate-auto-debit', { 
                                                    userId,
                                                    activateAutoDebit: true,
                                                    applyToCurrentMonth: false 
                                                });
                                                setSnackbar({ 
                                                    open: true, 
                                                    message: 'Débito automático activado. Se aplicará a partir del siguiente mes.', 
                                                    severity: 'success' 
                                                });
                                                setOpenAutoDebitDialog(false);
                                                setAutoDebitPayload(null);
                                                // Actualizar vista
                                                await fetchAllPayments(statusFilter, search);
                                            } catch (err) {
                                                console.error(err);
                                                setSnackbar({ open: true, message: 'Error activando débito automático', severity: 'error' });
                                            }
                                        }}
                                        sx={{ py: 2, textAlign: 'left', justifyContent: 'flex-start' }}
                                    >
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                📆 Aplicar al siguiente mes
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                                El débito automático se aplicará cuando llegue el siguiente mes. El mes actual se procesa normalmente.
                                            </Typography>
                                        </Box>
                                    </Button>
                                </Box>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => {
                                    setOpenAutoDebitDialog(false);
                                    setAutoDebitPayload(null);
                                }}>
                                    Cancelar
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Pagar Mora Congelada */}
                        <Dialog open={openPayPenaltyDialog} onClose={() => setOpenPayPenaltyDialog(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>Pagar Mora {registerPaymentTarget?.penaltyFrozen ? 'Congelada' : 'Acumulada'}</DialogTitle>
                            <DialogContent>
                                <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        <strong>Mora {registerPaymentTarget?.penaltyFrozen ? 'Congelada' : 'Acumulada'}:</strong> Q {Number(registerPaymentTarget?.penaltyDue || 0).toFixed(2)}
                                    </Typography>
                                    {registerPaymentTarget?.penaltyFrozen && (
                                        <Typography variant="caption" color="text.secondary">
                                            Congelada el: {registerPaymentTarget?.penaltyStartDate ? moment(registerPaymentTarget.penaltyStartDate).format('DD/MM/YYYY') : '—'}
                                        </Typography>
                                    )}
                                    {!registerPaymentTarget?.penaltyFrozen && (
                                        <Typography variant="caption" color="text.secondary">
                                            💡 Puedes pagar esta mora por separado antes de pagar la tarifa completa.
                                        </Typography>
                                    )}
                                </Box>
                                <TextField 
                                    fullWidth 
                                    label="Monto a Pagar (Q)" 
                                    type="number" 
                                    value={payPenaltyAmount} 
                                    onChange={(e) => setPayPenaltyAmount(e.target.value)}
                                    sx={{ mb: 2 }}
                                />
                                <TextField 
                                    fullWidth 
                                    label="Fecha de Pago" 
                                    type="date" 
                                    value={payPenaltyDate} 
                                    onChange={(e) => setPayPenaltyDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ mb: 2 }}
                                />
                                <TextField 
                                    fullWidth 
                                    label="Número de Boleta" 
                                    value={payPenaltyBoleta} 
                                    onChange={(e) => setPayPenaltyBoleta(e.target.value)}
                                    sx={{ mb: 2 }}
                                />
                                <TextField 
                                    fullWidth 
                                    label="Número de Cuenta Bancaria" 
                                    value={payPenaltyAccount} 
                                    onChange={(e) => setPayPenaltyAccount(e.target.value)}
                                />
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => {
                                    setOpenPayPenaltyDialog(false);
                                    setPayPenaltyAmount('');
                                    setPayPenaltyBoleta('');
                                    setPayPenaltyAccount('');
                                    setPayPenaltyDate(moment().format('YYYY-MM-DD'));
                                }}>Cancelar</Button>
                                <Button variant="contained" onClick={async () => {
                                    const amt = Number(payPenaltyAmount || 0);
                                    if (!amt || Number.isNaN(amt) || amt <= 0) {
                                        setSnackbar({ open: true, message: 'Ingrese un monto válido', severity: 'error' });
                                        return;
                                    }
                                    const currentPenalty = Number(registerPaymentTarget?.penaltyDue || 0);
                                    if (amt > currentPenalty) {
                                        setSnackbar({ open: true, message: `El monto excede la mora adeudada (Q${currentPenalty.toFixed(2)})`, severity: 'error' });
                                        return;
                                    }
                                    try {
                                        // Usar endpoint pay-penalty que maneja tanto mora congelada como acumulada
                                        await api.post(`/payments/${registerPaymentTarget.id}/pay-penalty`, {
                                            amountPaid: amt,
                                            receiptNumber: payPenaltyBoleta,
                                            bankAccountNumber: payPenaltyAccount,
                                            paidAt: payPenaltyDate
                                        });
                                        setSnackbar({ open: true, message: 'Pago de mora registrado exitosamente', severity: 'success' });
                                        setOpenPayPenaltyDialog(false);
                                        setPayPenaltyAmount('');
                                        setPayPenaltyBoleta('');
                                        setPayPenaltyAccount('');
                                        setPayPenaltyDate(moment().format('YYYY-MM-DD'));
                                        // Refrescar datos
                                        await fetchAllPayments(statusFilter, search);
                                        // Actualizar el registerPaymentTarget con los datos frescos
                                        const updated = await api.get(`/payments/${registerPaymentTarget.id}`);
                                        if (updated.data) {
                                            setRegisterPaymentTarget(updated.data);
                                        }
                                    } catch (err) {
                                        console.error('Error pagando mora:', err);
                                        console.error('Error response:', err.response?.data);
                                        const errorMsg = err.response?.data?.message || 'Error al registrar pago de mora';
                                        setSnackbar({ open: true, message: errorMsg, severity: 'error' });
                                    }
                                }}>Registrar Pago</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Descontar/Exonerar Mora Congelada */}
                        <Dialog open={openDiscountPenaltyDialog} onClose={() => setOpenDiscountPenaltyDialog(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>Descontar / Exonerar Mora {registerPaymentTarget?.penaltyFrozen ? 'Congelada' : 'Acumulada'}</DialogTitle>
                            <DialogContent>
                                <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        <strong>Mora {registerPaymentTarget?.penaltyFrozen ? 'Congelada' : 'Acumulada'}:</strong> Q {Number(registerPaymentTarget?.penaltyDue || 0).toFixed(2)}
                                    </Typography>
                                    {registerPaymentTarget?.penaltyFrozen && (
                                        <Typography variant="caption" color="text.secondary">
                                            Congelada el: {registerPaymentTarget?.penaltyStartDate ? moment(registerPaymentTarget.penaltyStartDate).format('DD/MM/YYYY') : '—'}
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>Tipo de Operación</Typography>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Button 
                                            variant={discountPenaltyType === 'DISCOUNT' ? 'contained' : 'outlined'}
                                            onClick={() => setDiscountPenaltyType('DISCOUNT')}
                                            fullWidth
                                        >
                                            Descuento Parcial
                                        </Button>
                                        <Button 
                                            variant={discountPenaltyType === 'EXONERATION' ? 'contained' : 'outlined'}
                                            onClick={() => setDiscountPenaltyType('EXONERATION')}
                                            fullWidth
                                        >
                                            Exoneración Total
                                        </Button>
                                    </Box>
                                </Box>
                                <TextField 
                                    fullWidth 
                                    label="Monto a Descontar/Exonerar (Q)" 
                                    type="number" 
                                    value={discountPenaltyAmount} 
                                    onChange={(e) => setDiscountPenaltyAmount(e.target.value)}
                                    sx={{ mb: 2 }}
                                />
                                <TextField 
                                    fullWidth 
                                    label="Notas" 
                                    multiline
                                    rows={3}
                                    value={discountPenaltyNotes} 
                                    onChange={(e) => setDiscountPenaltyNotes(e.target.value)}
                                    placeholder="Razón del descuento o exoneración..."
                                />
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => {
                                    setOpenDiscountPenaltyDialog(false);
                                    setDiscountPenaltyAmount('');
                                    setDiscountPenaltyType('DISCOUNT');
                                    setDiscountPenaltyNotes('');
                                }}>Cancelar</Button>
                                <Button variant="contained" color="warning" onClick={async () => {
                                    const amt = Number(discountPenaltyAmount || 0);
                                    if (!amt || Number.isNaN(amt) || amt <= 0) {
                                        setSnackbar({ open: true, message: 'Ingrese un monto válido', severity: 'error' });
                                        return;
                                    }
                                    const currentPenalty = (registerPaymentTarget?.frozenPenalty || 0) > 0 
                                        ? registerPaymentTarget?.frozenPenalty 
                                        : registerPaymentTarget?.accumulatedPenalty || 0;
                                    if (amt > currentPenalty) {
                                        setSnackbar({ open: true, message: `El monto excede la mora (Q${currentPenalty.toFixed(2)})`, severity: 'error' });
                                        return;
                                    }
                                    try {
                                        // Determinar si es mora congelada o acumulada
                                        const isFrozen = (registerPaymentTarget?.frozenPenalty || 0) > 0;
                                        
                                        if (isFrozen) {
                                            // Usar endpoint de exoneración de mora congelada
                                            await api.post(`/payments/${registerPaymentTarget.id}/exonerate-penalty`, {
                                                discountAmount: amt,
                                                type: discountPenaltyType,
                                                notes: discountPenaltyNotes
                                            });
                                        } else {
                                            // Usar endpoint específico para exonerar mora acumulada
                                            await api.post(`/payments/${registerPaymentTarget.id}/exonerate-accumulated-penalty`, {
                                                discountAmount: amt,
                                                type: discountPenaltyType,
                                                notes: discountPenaltyNotes
                                            });
                                        }
                                        const message = discountPenaltyType === 'EXONERATION' ? 'Mora exonerada exitosamente' : 'Descuento aplicado a mora';
                                        setSnackbar({ open: true, message, severity: 'success' });
                                        setOpenDiscountPenaltyDialog(false);
                                        setDiscountPenaltyAmount('');
                                        setDiscountPenaltyType('DISCOUNT');
                                        setDiscountPenaltyNotes('');
                                        // Refrescar datos
                                        await fetchAllPayments(statusFilter, search);
                                        // Actualizar el registerPaymentTarget con los datos frescos
                                        const updated = await api.get(`/payments/${registerPaymentTarget.id}`);
                                        if (updated.data) {
                                            setRegisterPaymentTarget(updated.data);
                                        }
                                    } catch (err) {
                                        console.error('Error descatando/exonerando mora:', err);
                                        setSnackbar({ open: true, message: 'Error al descontar/exonerar mora', severity: 'error' });
                                    }
                                }}>{discountPenaltyType === 'EXONERATION' ? 'Exonerar' : 'Aplicar Descuento'}</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Preview de Boleta (triggered from notification) */}
                        <Dialog open={!!previewReceipt} onClose={() => setPreviewReceipt(null)} fullWidth maxWidth="md">
                            <DialogTitle>Vista previa de Boleta</DialogTitle>
                            <DialogContent>
                                {previewReceipt ? (
                                    previewReceipt.fileUrl ? (
                                        (previewReceipt.fileUrl.match(/(\.png|\.jpe?g|\.gif|\.webp|\.bmp)(\?|$)/i)) ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                                <img src={previewReceipt.fileUrl} alt="boleta" style={{ maxWidth: '100%', maxHeight: '60vh' }} />
                                            </Box>
                                        ) : (
                                            <Box>
                                                <Button variant="outlined" href={previewReceipt.fileUrl} target="_blank" rel="noreferrer">Abrir archivo</Button>
                                            </Box>
                                        )
                                    ) : (
                                        <Typography variant="body2">No se encontró la imagen de la boleta.</Typography>
                                    )
                                ) : null}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setPreviewReceipt(null)}>Cerrar</Button>
                                <Button variant="contained" onClick={() => {
                                    const navPayment = location.state && location.state.payment ? location.state.payment : null;
                                    const localPreview = previewReceipt;
                                    setPreviewReceipt(null);
                                    if (navPayment) {
                                        const key = `navPaymentButton:${location.search || navPayment?.id || navPayment?.User?.id || ''}`;
                                        if (!processedOpenRegisterRef.current.has(key)) {
                                            processedOpenRegisterRef.current.add(key);
                                            handleOpenRegister(navPayment);
                                        }
                                    } else if (localPreview) {
                                        (async () => {
                                            try {
                                                const uid = localPreview.userId || new URLSearchParams(location.search).get('userId');
                                                if (uid) {
                                                    const res = await api.get('/payments', { params: { userId: uid, schoolYear, page: 1, limit: 1 } });
                                                    const arr = res.data.payments || res.data.rows || [];
                                                    const first = arr[0];
                                                    if (first) {
                                                        const key = `previewFallback:${location.search || uid}`;
                                                        if (!processedOpenRegisterRef.current.has(key)) {
                                                            processedOpenRegisterRef.current.add(key);
                                                            handleOpenRegister(first);
                                                        }
                                                    }
                                                }
                                            } catch (e) {
                                                console.error('Error opening register from preview fallback', e);
                                            }
                                        })();
                                    }
                                }}>Registrar Pago</Button>
                            </DialogActions>
                        </Dialog>

                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <TablePagination
                                component="div"
                                count={totalPayments}
                                page={page}
                                onPageChange={(e, newPage) => {
                                    // local pagination: just change page, data is already loaded client-side
                                    setPage(newPage);
                                }}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(e) => {
                                    const rp = parseInt(e.target.value, 10);
                                    setRowsPerPage(rp);
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[10,25,50]}
                            />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default React.memo(SchoolPaymentsPage);
