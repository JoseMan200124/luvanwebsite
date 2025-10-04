// src/pages/SchoolPaymentsPage.jsx

import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import moment from 'moment';
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
    MenuItem
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
    Legend
} from 'recharts';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowBack, School as SchoolIcon, CalendarToday } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/GetApp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import styled from 'styled-components';
import tw from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import PaymentFilters from '../components/PaymentFilters';
import PaymentTable from '../components/PaymentTable';
import ManagePaymentsModal from '../components/ManagePaymentsModal';
import ExtraordinaryPaymentSection from '../components/ExtraordinaryPaymentSection';
import ReceiptsPane from '../components/ReceiptsPane';

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
    // client-side pagination state (we fetch all data once and paginate locally)
    const [page, setPage] = useState(0); // UI page (0-based)
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalPayments, setTotalPayments] = useState(0);
    const [totalPaidCount, setTotalPaidCount] = useState(0);
    const [totalMoraCount, setTotalMoraCount] = useState(0);
    const [totalPendingCount, setTotalPendingCount] = useState(0);
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
    const pagadoCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'PAGADO')?.count || 0;
    const moraCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'MORA')?.count || 0;
    const pendienteCount = analysisData?.statusDistribution?.find(s => s.finalStatus === 'PENDIENTE')?.count || 0;
    const currentMonthEarnings = combinedEarnings.find(item =>
        item.year === moment().year() && item.month === (moment().month() + 1)
    )?.total || 0;

    useEffect(() => {
        (async () => {
            setLoading(true);
            if (!school && schoolId) await fetchSchool();
            // trigger batch recalc for this school before loading payments
            try {
                // Trigger background recalculation so UI load is not blocked.
                // Fire-and-forget: do not await the request.
                api.post('/payments/recalc-school', { schoolId, background: true }).catch(err => {
                    // Log but don't block UI
                    console.error('Background recalc failed to start', err);
                });
                // Trigger auto-debits for ALL schools as a fire-and-forget operation
                api.post('/payments/process-auto-debits').catch(err => {
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
        if (!schoolId) return;
        try {
            const st = status ? String(status).toUpperCase().trim() : '';
            const qq = q ? String(q).trim() : '';
            const params = { schoolId, page: 1, limit: 10000 };
            if (st) params.status = st;
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
                    const r = await api.get('/payments', { params: { schoolId, page: p + 1, limit: per, ...(st ? { status: st } : {}), ...(qq ? { search: qq } : {}) } });
                    const part = r.data.payments || r.data.rows || [];
                    if (Array.isArray(part) && part.length > 0) all.push(...part);
                }
                if (all.length > 0) arr = all;
            }

            setPaymentsAll(arr);
            setFiltered(arr);
            setTotalPayments(total || (Array.isArray(arr) ? arr.length : 0));
            setTotalPaidCount(typeof res.data.totalPaidCount === 'number' ? res.data.totalPaidCount : (arr.filter(pmt => (pmt.finalStatus||'').toUpperCase() === 'PAGADO').length));
            setTotalPendingCount(typeof res.data.totalPendingCount === 'number' ? res.data.totalPendingCount : (arr.filter(pmt => (pmt.finalStatus||'').toUpperCase() === 'PENDIENTE').length));
            setTotalMoraCount(typeof res.data.totalMoraCount === 'number' ? res.data.totalMoraCount : (arr.filter(pmt => (pmt.finalStatus||'').toUpperCase() === 'MORA').length));
            setPage(0);
        } catch (err) {
            console.error('fetchAllPayments', err);
            setSnackbar({ open: true, message: 'Error cargando pagos', severity: 'error' });
        }
    };

    // Small analysis fetch: tries backend endpoint /payments/analysis or derives simple metrics
    const fetchPaymentsAnalysis = async (schId) => {
        if (!schId) return;
        try {
            const res = await api.get('/payments/analysis', { params: { schoolId: schId } });
            // expected shape: { statusDistribution: [...], monthlyEarnings: [...] }
            const data = res.data || null;
            setAnalysisData(data);
            setCombinedEarnings(Array.isArray(data?.monthlyEarnings) ? data.monthlyEarnings : []);
    } catch (e) {
            // fallback: derive from current payments (best-effort)
            try {
                const paid = (paymentsAll || []).filter(p => (p.finalStatus||'').toUpperCase() === 'PAGADO').length;
                const mora = (paymentsAll || []).filter(p => (p.finalStatus||'').toUpperCase() === 'MORA').length;
                const pend = (paymentsAll || []).filter(p => (p.finalStatus||'').toUpperCase() === 'PENDIENTE').length;
                const derived = { statusDistribution: [
                    { finalStatus: 'PAGADO', count: paid },
                    { finalStatus: 'MORA', count: mora },
                    { finalStatus: 'PENDIENTE', count: pend }
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
                if (st) {
                    const s = (p.finalStatus || p.status || '').toUpperCase();
                    if (s !== st) return false;
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
                return true;
            });
            setFiltered(arr);
            setTotalPayments(Array.isArray(arr) ? arr.length : 0);
        } catch (e) {
            console.error('filtering error', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statusFilter, paymentsAll, autoDebitFilter]);

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
            if (key === 'students') return (p.User?.FamilyDetail?.Students || []).length || (p.studentCount || 0);
            if (key === 'routeType') return (p.User?.FamilyDetail?.routeType || '').toString().toLowerCase();
            if (key === 'lastPayment') return p.lastPaymentDate || p.lastPaidDate || p.lastPayment || '';
            if (key === 'discount') return Number(p.User?.FamilyDetail?.specialFee ?? p.specialFee ?? 0) || 0;
            if (key === 'invoice') return !!(p.User?.FamilyDetail?.requiresInvoice || p.requiresInvoice) ? 1 : 0;
            if (key === 'status') return (p.finalStatus || '').toString().toLowerCase();
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
    const [registerPaymentTarget, setRegisterPaymentTarget] = useState(null);
    const [registerAmount, setRegisterAmount] = useState('');
    const [registerPaymentExtra, setRegisterPaymentExtra] = useState({
        paymentDate: moment().format('YYYY-MM-DD'),
        numeroBoleta: '',
        extraordinaryDiscount: 0,
        bankAccountNumber: ''
    });
    // (extraordinary quick-register removed; use ExtraordinaryPaymentSection)

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

    // Handlers
    const ensureRecalc = useCallback(async (payment) => {
        try {
            if (payment?.id) await api.post(`/payments/${payment.id}/recalc`);
        } catch (e) {
            // ignore recalc errors; continue UI flow
        }
    }, []);

    // guard to avoid concurrent loads / re-entrancy when opening the register dialog
    const openRegisterInProgressRef = useRef(false);
    const handleOpenRegister = useCallback((payment) => {
        // prevent concurrent opens for the same flow
        if (openRegisterInProgressRef.current) return;
        openRegisterInProgressRef.current = true;

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

                // Ensure payment is recalculated on-demand so UI shows fresh totals for this user
                try {
                    if (payment?.id) {
                        await api.post(`/payments/${payment.id}/recalc`);
                    }
                } catch (e) {
                    // ignore recalc errors; continue loading receipts/history
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
                const res = await api.get('/payments', { params: { schoolId, page: 1, limit: 1000 } });
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
    }, [location.search, schoolId, handleOpenRegister]);

    // If navigation provided a payment object in location.state, open the register dialog immediately
    useEffect(() => {
        const navPayment = location.state && location.state.payment ? location.state.payment : null;
        if (navPayment) {
            try {
                // directly open with provided payment object
                // avoid multiple opens when navigation state re-triggers
                const key = `navPayment:${location.search || navPayment?.id || navPayment?.User?.id || ''}`;
                if (!processedOpenRegisterRef.current.has(key)) {
                    processedOpenRegisterRef.current.add(key);
                    handleOpenRegister(navPayment);
                }
                // if the navigation also included a receipt id in query, preload it
                const qs = new URLSearchParams(location.search);
                const receiptIdFromQuery = qs.get('receiptId');
                if (receiptIdFromQuery) {
                    (async () => {
                        try {
                            const recRes = await api.get(`/parents/${navPayment.User?.id || navPayment.userId}/receipts`);
                            const recs = recRes.data.receipts || [];
                            const matched = recs.find(r => String(r.id) === String(receiptIdFromQuery));
                            if (matched) setSelectedReceipt(matched);
                        } catch (e) { /* ignore */ }
                    })();
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
            await api.post(`/payments/${registerPaymentTarget.id}/add-transaction`, {
                amountPaid: registerAmount,
                paymentDate: registerPaymentExtra.paymentDate,
                numeroBoleta: registerPaymentExtra.numeroBoleta,
                extraordinaryDiscount: registerPaymentExtra.extraordinaryDiscount,
                bankAccountNumber: registerPaymentExtra.bankAccountNumber
            });
            // If the payment was for an inactive user, activate the account automatically
            try {
                const userId = registerPaymentTarget?.User?.id || registerPaymentTarget?.userId || null;
                const userState = registerPaymentTarget?.User?.state;
                if (userId && (userState === 0 || userState === '0')) {
                    // Activate user (logical activation)
                    await api.patch(`/users/${userId}/state`, { state: 1 });
                    setSnackbar({ open: true, message: 'Pago registrado. Familia activada automáticamente.', severity: 'success' });
                } else {
                    setSnackbar({ open: true, message: 'Pago registrado', severity: 'success' });
                }
            } catch (e) {
                // Activation failed but payment succeeded; inform user
                console.error('Error activating user after payment', e);
                setSnackbar({ open: true, message: 'Pago registrado (error activando cuenta)', severity: 'warning' });
            }
            setOpenRegisterDialog(false);
                // Invalidate cached payment histories for this user so modals will fetch fresh data
                invalidatePaymentHistCacheForUser(registerPaymentTarget?.User?.id || registerPaymentTarget?.userId);
                // refresh full dataset after mutation
                fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: 'Error registrando pago', severity: 'error' });
        }
    };

    const handleOpenReceipt = useCallback(async (payment) => {
        // ensure fresh recalculation for this payment before showing receipt dialog
        await ensureRecalc(payment);
        setReceiptTarget(payment);
        setReceiptNumberDraft(payment.receiptNumber || '');
        setOpenReceiptDialog(true);
    }, [ensureRecalc]);
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
        // ensure fresh recalculation for this payment before opening manage modal
        await ensureRecalc(payment);
        setManageTarget(payment);
        setOpenManageModal(true);
    }, [ensureRecalc]);

    // Download payment history as a presentable PDF (jsPDF + autotable)
    const handleDownloadHistory = useCallback(async (payment) => {
        try {
            const userId = payment?.User?.id || payment?.userId || null;
            if (!userId) {
                setSnackbar({ open: true, message: 'Usuario no encontrado para generar reporte', severity: 'error' });
                return;
            }

            const attemptFetch = async (params) => {
                try {
                    const r = await api.get('/payments/paymenthistory', { params });
                    return r;
                } catch (e) {
                    console.error('[handleDownloadHistory] fetch error', e && e.response ? e.response.data || e.response : e);
                    throw e;
                }
            };

            let res = await attemptFetch({ userId, page: 0, limit: 200 });
            let histories = res.data.histories || res.data || [];
            const totalReported = res.data.totalRecords ?? res.data.totalCount ?? res.data.count ?? null;

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
                            setSnackbar({ open: true, message: 'No se encontró historial para este usuario', severity: 'info' });
                            return;
                        }
                    } catch (e) {
                        console.error('[handleDownloadHistory] fallback fetch error', e && e.response ? e.response.data || e.response : e);
                        setSnackbar({ open: true, message: 'Error consultando historial (fallback)', severity: 'error' });
                        return;
                    }
                } else {
                    setSnackbar({ open: true, message: 'No se encontró historial para este usuario', severity: 'info' });
                    return;
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
            
            let cursorY = 40;

            // Try to load logo from public folder
            const logoUrl = '/logo.png';
            const logoData = await fetchImageDataUrl(logoUrl);
            const logoWidth = 80;
            const logoHeight = 80;
            if (logoData) {
                doc.addImage(logoData, 'PNG', 40, cursorY, logoWidth, logoHeight);
            }

            // Header text
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            const title = 'Estado de Cuenta - Historial de Pagos';
            const titleX = logoData ? 40 + logoWidth + 20 : 40;
            doc.text(title, titleX, cursorY + 24);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Generado: ${moment().format('YYYY-MM-DD HH:mm')}`, titleX, cursorY + 42);

            cursorY += Math.max(logoHeight, 60) + 10;

            // Family / summary block
            const familyLastName = payment?.User?.FamilyDetail?.familyLastName || payment?.User?.familyLastName || '';
            const studentsArr = Array.isArray(payment?.User?.FamilyDetail?.Students) ? payment.User.FamilyDetail.Students : [];
            const studentCount = studentsArr.length || payment?.studentCount || 0;
            const routeType = payment?.User?.FamilyDetail?.routeType || '';
            const tarifa = Number(payment?.tarif || payment?.tariff || payment?.fee || 0);
            const descuento = Number(payment?.User?.FamilyDetail?.specialFee ?? payment?.specialFee ?? 0);

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Apellidos Familia:', 40, cursorY);
            doc.setFont(undefined, 'normal');
            doc.text(String(familyLastName || '-'), 160, cursorY);

            // Swap: show Cant. Hijos first, then the small table of Hijos below
            doc.setFont(undefined, 'bold');
            doc.text('Cant. Hijos:', 40, cursorY + 16);
            doc.setFont(undefined, 'normal');
            doc.text(String(studentCount), 160, cursorY + 16);

            // Keep a reference to top of this summary block for right-side alignment
            const summaryTopY = cursorY;

            // Small table for children: first row is a centered title 'Hijos', then header Nombre | Grado
            const childTableBody = (studentsArr || []).map(s => {
                const name = (s.fullName || s.firstName || s.name || '').toString().trim();
                const last = (s.lastName || '').toString().trim();
                const full = name && last ? `${name} ${last}` : (name || last || '-');
                const grade = (s.grade || s.gradeName || s.level || '').toString().trim() || '-';
                return [full, grade];
            });

            if (childTableBody.length > 0) {
                autoTable(doc, {
                    startY: cursorY + 36,
                    margin: { left: 40 },
                    head: [
                        [ { content: 'Hijos', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fontSize: 11, textColor: 255, fillColor: [68,114,196] } } ],
                        ['Nombre', 'Grado']
                    ],
                    body: childTableBody,
                    styles: { fontSize: 9, cellPadding: 4, lineColor: [200,200,200], lineWidth: 0.5 },
                    headStyles: { fillColor: [68,114,196], textColor: 255, halign: 'center' },
                    columnStyles: { 0: { cellWidth: 160 }, 1: { cellWidth: 60, halign: 'center' } },
                    tableWidth: 'auto',
                    theme: 'grid',
                });
                // move cursorY to after the child table (use lastAutoTable.finalY when available)
                cursorY = (doc.lastAutoTable && typeof doc.lastAutoTable.finalY !== 'undefined') ? doc.lastAutoTable.finalY + 10 : cursorY + 80;
            } else {
                // still render a small table with title + empty row
                autoTable(doc, {
                    startY: cursorY + 36,
                    margin: { left: 40 },
                    head: [ [ { content: 'Hijos', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fontSize: 11, textColor: 255, fillColor: [68,114,196] } } ], ['Nombre', 'Grado'] ],
                    body: [['-', '-']],
                    styles: { fontSize: 9, cellPadding: 4, lineColor: [200,200,200], lineWidth: 0.5 },
                    headStyles: { fillColor: [68,114,196], textColor: 255, halign: 'center' },
                    columnStyles: { 0: { cellWidth: 160 }, 1: { cellWidth: 60, halign: 'center' } },
                    tableWidth: 'auto',
                    theme: 'grid',
                });
                cursorY = (doc.lastAutoTable && typeof doc.lastAutoTable.finalY !== 'undefined') ? doc.lastAutoTable.finalY + 10 : cursorY + 80;
            }

            // Right-side summary (Tipo de Ruta / Tarifa / Descuento) aligned to top of summary block
            const rightLabelX = 400;
            const rightValueX = 480;

            doc.setFont(undefined, 'bold');
            doc.text('Tipo de Ruta:', rightLabelX, summaryTopY + 16);
            doc.setFont(undefined, 'normal');
            doc.text(String(routeType || '-'), rightValueX, summaryTopY + 16);

            doc.setFont(undefined, 'bold');
            doc.text('Tarifa:', rightLabelX, summaryTopY + 32);
            doc.setFont(undefined, 'normal');
            doc.text(`Q ${tarifa.toFixed(2)}`, rightValueX, summaryTopY + 32);

            doc.setFont(undefined, 'bold');
            doc.text('Descuento:', rightLabelX, summaryTopY + 48);
            doc.setFont(undefined, 'normal');
            doc.text(`Q ${descuento.toFixed(2)}`, rightValueX, summaryTopY + 48);

            // Table: Fecha | Tarifa | Mora | Total a Pagar | Pago Registrado | Saldo/Credito
            // center all columns for a compact, centered layout
            const tableColumnStyles = {
                0: { halign: 'center' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'center' }
            };

            const tableBody = (histories || []).map(h => {
                const dateVal = h.paymentDate || h.date || h.createdAt || h.createdAtSnapshot || '';
                const fecha = dateVal ? moment.parseZone(dateVal).format('YYYY-MM-DD') : '';
                const tarifaHist = Number(h.tarif || h.fee || h.amountDue || tarifa || 0);
                const penaltyBefore = Number(h.penaltyBefore || h.penalty || 0);
                const penaltyAfter = Number(h.penaltyAfter || 0);
                const mora = Math.max(0, penaltyBefore - penaltyAfter) || Number(h.mora || 0);
                const totalAPagar = Number(h.totalToPay || h.total || tarifaHist + mora - Number(h.extraordinaryDiscount || 0));
                const pagoRegistrado = Number(h.amountPaid || h.amount || h.value || 0);
                // Compute saldo/credito using multiple possible field names returned by backend
                let saldo = '';
                const hasBalanceBefore = typeof h.balanceBefore !== 'undefined' || typeof h.balance_before !== 'undefined';
                const hasBalanceAfter = typeof h.balanceAfter !== 'undefined' || typeof h.balance_after !== 'undefined';
                const balanceBeforeVal = Number(h.balanceBefore ?? h.balance_before ?? 0);
                const balanceAfterVal = Number(h.balanceAfter ?? h.balance_after ?? 0);
                if (hasBalanceBefore && hasBalanceAfter) {
                    const diff = balanceAfterVal - balanceBeforeVal;
                    saldo = diff === 0 ? `Q 0.00` : (diff < 0 ? `Q ${Math.abs(diff).toFixed(2)} deuda` : `Q ${diff.toFixed(2)} crédito`);
                } else if (typeof h.remainingBalance !== 'undefined') {
                    const rem = Number(h.remainingBalance ?? 0);
                    saldo = `Q ${rem.toFixed(2)}`;
                } else if (typeof h.creditBalanceAfter !== 'undefined') {
                    // Prefer creditBalanceAfter when available (primary source for last-column Crédito)
                    const cbAfter = Number(h.creditBalanceAfter ?? 0);
                    saldo = `Q ${cbAfter.toFixed(2)}`;
                } else if (typeof h.creditBalance !== 'undefined' || typeof h.credit !== 'undefined' || typeof h.creditAmount !== 'undefined') {
                    const cb = Number(h.creditBalance ?? h.credit ?? h.creditAmount);
                    saldo = `Q ${cb.toFixed(2)}`;
                } else if (typeof h.balance !== 'undefined' || typeof h.saldo !== 'undefined') {
                    const b = Number(h.balance ?? h.saldo ?? 0);
                    saldo = `Q ${b.toFixed(2)}`;
                } else {
                    saldo = '';
                }

                return [fecha, tarifaHist.toFixed(2), mora.toFixed(2), totalAPagar ? Number(totalAPagar).toFixed(2) : `${(tarifaHist + mora).toFixed(2)}`, pagoRegistrado.toFixed(2), saldo];
            });

            // Add table with autoTable
            autoTable(doc, {
                startY: cursorY,
                head: [[ 'Fecha', 'Tarifa', 'Mora', 'Total a Pagar', 'Pago Registrado', 'Crédito' ]],
                body: tableBody,
                styles: { fontSize: 9, cellPadding: 6, lineColor: [200,200,200], lineWidth: 0.5 },
                headStyles: { fillColor: [68,114,196], textColor: 255, halign: 'center' },
                alternateRowStyles: { fillColor: [245,245,245] },
                columnStyles: tableColumnStyles,
                theme: 'grid',
                didDrawPage: (data) => {
                    // footer if needed
                }
            });

            // finalize and save
            // Build the requested filename: "Reporte Historial de Pagos ApellidosFamilia.pdf"
            const familyForName = (familyLastName && String(familyLastName).trim()) ? String(familyLastName).replace(/\s+/g, '_') : 'Familia';
            const fileName = `Reporte Historial de Pagos Familia ${familyForName}.pdf`;
            doc.save(fileName);
            setSnackbar({ open: true, message: 'Descarga iniciada', severity: 'success' });
        } catch (err) {
            console.error('handleDownloadHistory', err);
            setSnackbar({ open: true, message: 'Error descargando reporte PDF', severity: 'error' });
        }
    }, []);

    // Notes handlers
    const handleOpenNotes = useCallback(async (payment) => {
        // ensure fresh recalculation for this payment before editing notes
        await ensureRecalc(payment);
        setNotesTarget(payment);
        setNotesDraft(payment?.notes || '');
        setOpenNotesDialog(true);
    }, [ensureRecalc]);
    const handleCloseNotes = () => {
        setOpenNotesDialog(false);
        setNotesTarget(null);
        setNotesDraft('');
    };
    const handleSaveNotes = async () => {
        if (!notesTarget) return;
        try {
            await api.put(`/payments/${notesTarget.id}/notes`, { notes: notesDraft });
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

        // ensure fresh recalculation for this payment before performing any action
        await ensureRecalc(payment);
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
                await api.post(`/payments/${payment.id}/exoneratePenalty`, { exonerateAmount: amount });
                setSnackbar({ open: true, message: 'Mora exonerada', severity: 'success' });
            } else if (actionName === 'freezePenalty' || actionName === 'toggleFreezePenalty') {
                // toggle penaltyPaused using updatePayment
                const current = !!payment.penaltyPaused;
                await api.put(`/payments/${payment.id}`, { penaltyPaused: !current });
                setSnackbar({ open: true, message: `${!current ? 'Mora congelada' : 'Mora reanudada'}`, severity: 'success' });
            } else if (actionName === 'suspend' || actionName === 'activate') {
                const userId = payment.User?.id;
                if (!userId) {
                    setSnackbar({ open: true, message: 'Usuario asociado no encontrado', severity: 'error' });
                    return;
                }
                const desiredState = actionName === 'suspend' ? 0 : 1;
                await api.patch(`/users/${userId}/state`, { state: desiredState });
                setSnackbar({ open: true, message: desiredState === 0 ? 'Familia suspendida' : 'Familia activada', severity: 'success' });
            } else if (actionName === 'toggleAutoDebit') {
                const userId = payload?.payment?.User?.id || payment.User?.id;
                if (!userId) return setSnackbar({ open: true, message: 'Usuario no encontrado', severity: 'error' });
                const val = payload?.value;
                await api.put(`/users/${userId}`, { familyDetail: { autoDebit: !!val } });
                setSnackbar({ open: true, message: `Débito automático ${val ? 'activado' : 'desactivado'}`, severity: 'success' });
            } else if (actionName === 'toggleRequiresInvoice') {
                // Use payments endpoint to set invoice need
                const val = payload?.value;
                await api.put(`/payments/${payment.id}/set-invoice-need`, { requiresInvoice: !!val });
                setSnackbar({ open: true, message: `Requiere factura: ${val ? 'Sí' : 'No'}`, severity: 'success' });
            } else if (actionName === 'deletePayment') {
                // Delete / revert a payment record entirely. Backend must expose DELETE /payments/:id
                try {
                    await api.delete(`/payments/${payment.id}`);
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
            } else {
                setSnackbar({ open: true, message: `Acción no manejada: ${actionName}`, severity: 'info' });
            }
            // Invalidate payment history cache for affected user and refresh payments
            // Invalidate cache for this user so modal will fetch fresh histories
            invalidatePaymentHistCacheForUser(payment?.User?.id || payment?.userId || manageTarget?.User?.id || manageTarget?.userId);
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error('handleManageAction', err);
            setSnackbar({ open: true, message: 'Error ejecutando acción', severity: 'error' });
        }
    };

    const handleToggleInvoiceSent = async (row, newVal) => {
        try {
            // The payments controller exposes PUT /payments/:paymentId/set-invoice-need
            // We have the payment (manageTarget) context; if row belongs to a transaction
            const paymentId = row.paymentId || row.payment?.id || manageTarget?.id;
            if (!paymentId) {
                setSnackbar({ open: true, message: 'Pago no encontrado para la transacción', severity: 'error' });
                return;
            }
            await api.put(`/payments/${paymentId}/set-invoice-need`, { requiresInvoice: !!newVal });
            setSnackbar({ open: true, message: `Factura enviada: ${newVal ? 'Sí' : 'No'}`, severity: 'success' });
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
    const [exportStatusSelection, setExportStatusSelection] = useState('GENERAL');

    // Export payments filtered by status and build Excel
    const handleDownloadPaymentsByStatus = useCallback(async (status) => {
        try {
            // status: 'PAGADOS'|'PENDIENTES'|'MORA'|'GENERAL'
            const st = status && String(status).toUpperCase().trim();
            const params = { schoolId, page: 1, limit: 10000 };
            if (st && st !== 'GENERAL') params.status = st;
            setOpenExportStatusDialog(false);
            setSnackbar({ open: true, message: 'Preparando descarga...', severity: 'info' });

            const res = await api.get('/payments', { params });
            const arr = res.data.payments || res.data.rows || [];

            if (!Array.isArray(arr) || arr.length === 0) {
                setSnackbar({ open: true, message: 'No se encontraron pagos para el filtro seleccionado', severity: 'info' });
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Pagos');

            const headers = [
                'Estado',
                'Apellido Familia',
                'Cantidad de Estudiantes',
                'Tipo de Ruta',
                'Fecha Último Pago',
                'Tarifa',
                'Mora Acumulada',
                'Descuento',
                'Envío Factura',
                'Notas',
                'Débito Automático'
            ];
            sheet.addRow(headers);

            arr.forEach(p => {
                const estado = p.finalStatus || p.status || '';
                const familyLast = p.User?.FamilyDetail?.familyLastName || p.User?.familyLastName || '';
                const students = Array.isArray(p.User?.FamilyDetail?.Students) ? p.User.FamilyDetail.Students.length : (p.studentCount || 0);
                const route = p.User?.FamilyDetail?.routeType || '';
                const lastPayment = p.lastPaymentDate || p.lastPaidDate || p.lastPayment || '';
                const tarifa = Number(p.tarif || p.tariff || p.fee || 0);
                const moraAcum = Number(p.accumulatedPenalty || p.totalPenalty || p.penalty || 0);
                // Descuento: prefer family specialFee, else payment.specialFee, else 0
                const descuento = Number(p.User?.FamilyDetail?.specialFee ?? p.specialFee ?? 0);
                const envioFactura = (p.requiresInvoice || p.invoiceSended || p.requiresInvoice === false) ? (!!p.requiresInvoice || !!p.invoiceSended ? 'Sí' : 'No') : (p.requiresInvoice === false ? 'No' : 'No');
                const notas = p.notes || '';
                const autoDebit = !!(p.automaticDebit || p.User?.FamilyDetail?.automaticDebit || p.User?.FamilyDetail?.autoDebit) ? 'Sí' : 'No';

                const row = [estado, familyLast, students, route, lastPayment ? moment.parseZone(lastPayment).format('YYYY-MM-DD') : '', tarifa, moraAcum, descuento, envioFactura, notas, autoDebit];
                sheet.addRow(row);
            });

            // Styling header (match historial style)
            sheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            // Alternating row colors and alignment (center data cells; keep numeric right-aligned)
            sheet.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return;
                const isEven = rowIndex % 2 === 0;
                row.eachCell((cell, colNumber) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
                    // center by default
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    // Tarifa column formatting (col 6) should be right-aligned and numeric
                    if (colNumber === 6) {
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
            const fileName = `pagos_${st || 'GENERAL'}_${school?.name ? school.name.replace(/\s+/g, '_') : schoolId}.xlsx`;
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
    }, [schoolId, school]);

    const handleSaveDiscount = async (payment, newDiscount) => {
        try {
            const userId = payment?.User?.id;
            if (!userId) {
                setSnackbar({ open: true, message: 'Usuario asociado no encontrado', severity: 'error' });
                return;
            }
            // Use dedicated family-detail endpoint to avoid accidental overwrites
            await api.put(`/users/${userId}/family-detail`, { specialFee: Number(newDiscount || 0) });
            setSnackbar({ open: true, message: 'Descuento actualizado', severity: 'success' });
            // Invalidate cache for this user so modal will fetch fresh histories
            invalidatePaymentHistCacheForUser(payment?.User?.id || payment?.userId);
            fetchAllPayments(statusFilter, search);
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: 'Error guardando descuento', severity: 'error' });
        }
    };

    // Derived values for the Register Payment dialog summary
    const formatCurrency = (v) => `Q ${Number(v || 0).toFixed(2)}`;
    // Tarifa: prefer explicit fee fields
    const dialogTarifa = Number(registerPaymentTarget?.tarif || registerPaymentTarget?.tariff || registerPaymentTarget?.fee || registerPaymentTarget?.monthlyFee || 0);
    // Mora (accumulated penalty)
    const dialogMora = Number(registerPaymentTarget?.accumulatedPenalty || registerPaymentTarget?.totalPenalty || registerPaymentTarget?.penalty || 0);
    // Crédito a favor: always use the payment table's creditBalance field only
    const dialogCredito = Number(registerPaymentTarget?.creditBalance ?? 0);
    // Descuento de familia (special fee) comes from User.FamilyDetail.specialFee
    // Note: family specialFee is already applied to the stored tarifa/leftover, so do not subtract it again.
    const dialogFamilySpecialFee = Number(registerPaymentTarget?.User?.FamilyDetail?.specialFee ?? 0);
    // Leftover / total due (fallbacks)
    const dialogLeftover = Number(registerPaymentTarget?.leftover || registerPaymentTarget?.leftOver || registerPaymentTarget?.totalDue || registerPaymentTarget?.amountDue || 0);
    const dialogExtraDiscount = Number(registerPaymentExtra?.extraordinaryDiscount || 0);
    // Total to pay: start from leftover + mora, then subtract credito and extraordinary discount only.
    const dialogTotalToPay = Math.max(0, dialogLeftover + dialogMora - dialogCredito - dialogExtraDiscount - dialogFamilySpecialFee);


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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Ciclo Escolar ${schoolYear || ''}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
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
                                        <Box sx={{ mb: 3, p: 2, background: '#f9fafb', borderRadius: 2, boxShadow: 1 }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Total Familias: </strong></Typography>
                                                    <Typography variant="h6">{analysisData.totalPayments ?? totalPayments}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Familias Pagadas: </strong></Typography>
                                                    <Typography variant="h6">{pagadoCount}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Familias en Mora: </strong></Typography>
                                                    <Typography variant="h6">{moraCount}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Familias Pendientes: </strong></Typography>
                                                    <Typography variant="h6">{pendienteCount}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Ingreso Neto:</strong></Typography>
                                                    <Typography variant="h6">Q {Number(analysisData.netIncome ?? 0).toFixed(2)}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Ingreso por Mora:</strong></Typography>
                                                    <Typography variant="h6">Q {Number(analysisData.lateFeeIncome ?? 0).toFixed(2)}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Ingreso a la Fecha:</strong></Typography>
                                                    <Typography variant="h6">Q {currentMonthEarnings.toFixed(2)}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Pendiente a la Fecha:</strong></Typography>
                                                    <Typography variant="h6">Q {analysisData.sumTotalDue ?? 0}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={2}>
                                                    <Typography variant="body2"><strong>Total Descuentos:</strong></Typography>
                                                    <Typography variant="h6">Q {Number(analysisData.totalSpecialFee ?? 0).toFixed(2)}</Typography>
                                                </Grid>
                                            </Grid>
                                        </Box>

                                        <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                                <Typography variant="subtitle1" gutterBottom>
                                                    Ganancias Mensuales (Pagos + Extraordinarios)
                                                </Typography>
                                                <Box sx={{ width: '100%', height: 300 }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={(combinedEarnings || []).map(item => ({ ...item, label: moment({ year: item.year, month: item.month - 1 }).format('MMMM YYYY') }))}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis dataKey="label" />
                                                            <YAxis />
                                                            <RechartsTooltip formatter={(value) => `Q ${value}`} />
                                                            <Legend />
                                                            <Bar dataKey="total">{(combinedEarnings || []).map((entry, index) => {
                                                                const colors = ['#0088FE', '#FFBB28', '#FF8042', '#00C49F', '#FF6633', '#9933FF', '#33CCFF', '#66CC33'];
                                                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                                            })}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
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
                        <Chip label={`Total familias: ${totalPayments}`} variant="outlined" />
                        <Chip label={`Pagados: ${totalPaidCount}`} color="success" />
                        <Chip label={`Pendientes: ${totalPendingCount}`} color="warning" />
                        <Chip label={`En Mora: ${totalMoraCount}`} color="error" />
                        <Box sx={{ flex: 1 }} />
                    </ChipsRow>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                            <PaymentFilters search={search} onSearchChange={setSearch} status={statusFilter} onStatusChange={setStatusFilter} autoDebit={autoDebitFilter} onAutoDebitChange={setAutoDebitFilter} />
                            <Box sx={{ flex: 1 }} />
                            <Button startIcon={<DownloadIcon />} size="small" onClick={() => setOpenExportStatusDialog(true)} sx={{ textTransform: 'none', mr: 1 }}>
                                Descargar Datos
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
                            onSaveDiscount={handleSaveDiscount}
                        />

                        {/* Dialog: Exportar pagos por estado */}
                        <Dialog open={openExportStatusDialog} onClose={() => setOpenExportStatusDialog(false)} fullWidth maxWidth="xs">
                            <DialogTitle>Exportar pagos - seleccionar estado</DialogTitle>
                            <DialogContent>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                                    <Button variant={exportStatusSelection === 'PAGADOS' ? 'contained' : 'outlined'} onClick={() => setExportStatusSelection('PAGADOS')}>Pagados</Button>
                                    <Button variant={exportStatusSelection === 'PENDIENTES' ? 'contained' : 'outlined'} onClick={() => setExportStatusSelection('PENDIENTES')}>Pendientes</Button>
                                    <Button variant={exportStatusSelection === 'MORA' ? 'contained' : 'outlined'} onClick={() => setExportStatusSelection('MORA')}>Mora</Button>
                                    <Button variant={exportStatusSelection === 'GENERAL' ? 'contained' : 'outlined'} onClick={() => setExportStatusSelection('GENERAL')}>General (todos)</Button>
                                </Box>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setOpenExportStatusDialog(false)}>Cancelar</Button>
                                <Button variant="contained" onClick={() => handleDownloadPaymentsByStatus(exportStatusSelection)}>Descargar</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Dialog: Registrar Pago */}
                        <Dialog open={openRegisterDialog} onClose={() => { setOpenRegisterDialog(false); setSelectedReceipt(null); setReceiptZoom(1); }} fullWidth maxWidth="lg">
                            <DialogTitle>Registrar Pago</DialogTitle>
                            <DialogContent>
                                <Box sx={{ position: 'relative' }}>
                                <Grid container spacing={2}>
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
                                    <Grid item xs={12} md={5}>
                                        <Box sx={{ maxWidth: 420 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {registerPaymentTarget ? `Familia: ${registerPaymentTarget.User?.FamilyDetail?.familyLastName || ''}` : ''}
                                                {registerPaymentTarget && (
                                                    ` (${(registerPaymentTarget.User?.FamilyDetail?.Students || []).length || (registerPaymentTarget.studentCount || 0)} estudiantes)`
                                                )}
                                            </Typography>
                                            {/* Show D/A chip when automatic debit is active on the payment or the family's record */}
                                            { (registerPaymentTarget && (registerPaymentTarget.automaticDebit || registerPaymentTarget.User?.FamilyDetail?.automaticDebit)) && (
                                                <Chip label="D/A" size="small" color="primary" sx={{ height: 22, fontSize: '0.75rem' }} />
                                            ) }
                                        </Box>
                                        {/* Payment summary block: Tarifa, Mora, Crédito, Total a pagar */}
                                        <Box sx={{ mb: 2, p: 2, backgroundColor: '#fafafa', borderRadius: 1, border: '1px solid rgba(0,0,0,0.04)' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Resumen de Pago</Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                                <Typography variant="body2" color="text.secondary">Tarifa</Typography>
                                                <Typography variant="body2">{formatCurrency(dialogTarifa)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">Mora</Typography>
                                                <Typography variant="body2">{formatCurrency(dialogMora)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">Crédito a favor</Typography>
                                                <Typography variant="body2">{formatCurrency(dialogCredito)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">Descuento familia</Typography>
                                                <Typography variant="body2">{formatCurrency(dialogFamilySpecialFee)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">Descuento extraordinario</Typography>
                                                <Typography variant="body2">{formatCurrency(dialogExtraDiscount)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Total a pagar</Typography>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{formatCurrency(dialogTotalToPay)}</Typography>
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
                                <Button onClick={() => { setOpenRegisterDialog(false); setSelectedReceipt(null); setReceiptZoom(1); }} disabled={uploadedReceiptsLoading || regHistLoading}>Cancelar</Button>
                                <Button variant="contained" onClick={async () => {
                                    await handleConfirmRegister();
                                    // ensure receipt view reset after confirming
                                    setSelectedReceipt(null);
                                    setReceiptZoom(1);
                                }} disabled={!registerAmount || uploadedReceiptsLoading || regHistLoading}>Registrar</Button>
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
                                                    const res = await api.get('/payments', { params: { userId: uid, page: 1, limit: 1 } });
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
