/**
 * pages/RequestsPage.jsx
 *
 * Enhanced Requests management page (uses layout from MechanicRequestsPage)
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    Autocomplete,
    MenuItem,
    Grid,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TableSortLabel,
    Divider
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Delete as DeleteIcon,
    Check as CheckIcon,
    Edit as EditIcon,
    Build as BuildIcon,
    Refresh as RefreshIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    HourglassEmpty as PendingIcon,
    Autorenew as InProgressIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon
} from '@mui/icons-material';
import tw from 'twin.macro';
import styled from 'styled-components';
import moment from 'moment-timezone';
import { AuthContext } from '../context/AuthProvider';
import {
    getAllRequests,
    getRequestById,
    getRequestEvents,
    updateRequestStatus,
    deleteRequest,
    getRequestStatistics,
    getSchoolsList,
    getCorporationsList,
    REQUEST_TYPE_META,
    VALID_REQUEST_TYPES,
    REQUEST_STATES,
    STATE_COLORS
} from '../services/requestService';
import {
    Schedule as ScheduleIcon,
    Payments as PaymentsIcon,
    Description as DescriptionIcon,
    SwapHoriz as SwapHorizIcon,
    DirectionsBus as DirectionsBusIcon,
    PauseCircle as PauseCircleIcon,
    Lightbulb as LightbulbIcon,
    Create as CreateIcon,
} from '@mui/icons-material';
import CicloEscolarFilter, { getCicloEscolarFilterParams, getInitialCicloEscolarFilter } from '../components/CicloEscolarFilter';

const PageContainer = styled.div`
    ${tw`p-6`}
`;

const FiltersContainer = styled(Paper)`
    ${tw`p-4 mb-4`}
`;

const StatsCard = styled(Card)`
    ${tw`h-full`}
`;

/**
 * RequestsPage
 *
 * Componente de React que muestra y gestiona una lista paginada de solicitudes de usuarios.
 * - Obtiene datos mediante llamadas a la API: getAllRequests, getRequestById, deleteRequest, updateRequestStatus.
 * - Muestra estadísticas agregadas mediante getRequestStatistics.
 * - Carga listas auxiliares con getSchoolsList y getCorporationsList para el selector de cliente.
 * - Soporta filtrado (tipo, estado, solicitante, cliente, rango de fechas), ordenamiento y paginación.
 * - Permite ver detalle de una solicitud, cambiar su estado (con notas) y eliminarla; actualiza la lista y estadísticas tras acciones.
 * - Gestiona estados locales para: requests, loading, statistics, filtros (aplicados y draft), paginación, ordenamiento,
 *   selección de request, y modales (detalle, confirmación de borrado, cambio de estado).
 * - Formatea fechas con moment.js en zona 'America/Guatemala'.
 *
 * Uso interno de utilidades UI:
 * - Genera Chips con etiquetas y colores según prioridad/estado.
 * - Usa componentes de MUI: Table, Dialogs, Autocomplete, Buttons, Icons, etc.
 *
 * Notas:
 * - No recibe props; consume AuthContext para contexto de autenticación.
 * - Las keys esperadas en objetos de solicitud incluyen campos como id, createdAt, priority, requestType, title,
 *   requester, status, reviewNotes/review_notes, reviewer/reviewedBy, reviewedAt, school, corporation.
 *
 * @returns {JSX.Element} Interfaz completa para listar y gestionar solicitudes.
 * @see {@link https://mui.com/material-ui/icons/} Para ver otros iconos disponibles (paquete @mui/icons-material).
 */
const RequestsPage = () => {
    const { auth } = useContext(AuthContext);

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState(null);

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const initialFilters = { userName: '', client: '', schoolId: '', corporationId: '', status: '', requestType: '', startDate: '', endDate: '' };
    const [filters, setFilters] = useState(initialFilters);
    const [draftFilters, setDraftFilters] = useState(initialFilters);
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [selectedCicloEscolar, setSelectedCicloEscolar] = useState(getInitialCicloEscolarFilter);
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [requestEvents, setRequestEvents] = useState([]);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState(null);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
    const [pendingStatusPayload, setPendingStatusPayload] = useState(null);

    const normalizeStatus = (status) => {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'approved') return 'completed';
        return normalized;
    };

    const isFinalStatus = (status) => {
        const normalized = normalizeStatus(status);
        return normalized === 'completed' || normalized === 'rejected';
    };

    // Load requests
    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: page + 1,
                offset: page * rowsPerPage,
                limit: rowsPerPage,
                sortBy,
                sortOrder: sortOrder.toUpperCase(),
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
            };
            const res = await getAllRequests(params);
            setRequests(res.requests || res.data || []);
            setTotalCount(res.count || res.pagination?.total || 0);
        } catch (err) {
            console.error('Error fetching requests', err);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filters, selectedCicloEscolar, sortBy, sortOrder]);

    // Load statistics
    const fetchStatistics = useCallback(async () => {
        try {
            const params = {
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
            };
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (filters.schoolId) params.schoolId = filters.schoolId;
            if (filters.corporationId) params.corporationId = filters.corporationId;
            const stats = await getRequestStatistics(params);
            setStatistics(stats);
        } catch (err) {
            console.error('Error fetching statistics', err);
        }
    }, [filters.startDate, filters.endDate, filters.schoolId, filters.corporationId, selectedCicloEscolar]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);
    useEffect(() => { fetchStatistics(); }, [fetchStatistics]);
    useEffect(() => {
        // Fetch schools and corporations for client selector
        (async () => {
            try {
                const sc = await getSchoolsList(getCicloEscolarFilterParams(selectedCicloEscolar));
                setSchools(sc || []);
            } catch (e) { console.error('Error loading schools', e); }
            try {
                const cc = await getCorporationsList(getCicloEscolarFilterParams(selectedCicloEscolar));
                setCorporations(cc || []);
            } catch (e) { console.error('Error loading corporations', e); }
        })();
    }, [selectedCicloEscolar]);

    const handleDraftChange = (field) => (event) => {
        setDraftFilters(prev => ({ ...prev, [field]: event.target.value }));
    };

    // Build client options for Autocomplete (grouped)
    const clientOptions = [
        ...((schools || []).map(s => ({ label: s.name, value: `school:${s.id}`, group: 'Colegios' }))),
        ...((corporations || []).map(c => ({ label: c.name, value: `corp:${c.id}`, group: 'Corporaciones' })))
    ];

    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

    const handleSort = (column) => {
        const isAsc = sortBy === column && sortOrder === 'asc';
        setSortOrder(isAsc ? 'desc' : 'asc');
        setSortBy(column);
    };

    const handleRefresh = () => {
        setPage(0);
        fetchRequests();
        fetchStatistics();
    };

    // Register global refresh handler so the global button triggers this page's refresh
    useRegisterPageRefresh(async () => {
        setPage(0);
        await Promise.all([fetchRequests(), fetchStatistics()]);
    }, [fetchRequests, fetchStatistics]);

    const handleViewDetail = async (request) => {
        try {
            const detail = await getRequestById(request.id);
            const events = await getRequestEvents(request.id);
            setSelectedRequest({
                ...detail,
                createdBy: detail?.createdBy || request?.createdBy || null,
            });
            setRequestEvents(events || []);
            setDetailModalOpen(true);
        } catch (err) { console.error(err); }
    };

    const handleOpenDeleteModal = (request) => { setRequestToDelete(request); setDeleteModalOpen(true); };

    const handleConfirmDelete = async () => {
        if (!requestToDelete) return;
        try {
            await deleteRequest(requestToDelete.id);
            setDeleteModalOpen(false);
            setRequestToDelete(null);
            fetchRequests();
            fetchStatistics();
        } catch (err) { console.error(err); }
    };

    const handleOpenStatusModal = (request) => {
        if (isFinalStatus(request.status)) {
            return;
        }
        setSelectedRequest(request);
        setNewStatus('');
        setStatusNotes(request.reviewNotes || request.review_notes || '');
        setStatusModalOpen(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!selectedRequest) return;
        if (!newStatus) {
            return;
        }
        if (isFinalStatus(newStatus)) {
            setPendingStatusPayload({
                id: selectedRequest.id,
                status: newStatus,
                notes: statusNotes,
            });
            setStatusConfirmOpen(true);
            return;
        }

        const payload = { status: newStatus };
        if (statusNotes) payload.reviewNotes = statusNotes;

        try {
            await updateRequestStatus(selectedRequest.id, payload);
            setStatusModalOpen(false);
            setSelectedRequest(null);
            setNewStatus('');
            setStatusNotes('');
            fetchRequests();
            fetchStatistics();
        } catch (err) { console.error(err); }
    };

    const handleConfirmFinalStatus = async () => {
        if (!pendingStatusPayload) return;
        try {
            const payload = { status: pendingStatusPayload.status };
            if (pendingStatusPayload.notes) payload.reviewNotes = pendingStatusPayload.notes;
            await updateRequestStatus(pendingStatusPayload.id, payload);
            setStatusConfirmOpen(false);
            setPendingStatusPayload(null);
            setStatusModalOpen(false);
            setSelectedRequest(null);
            setNewStatus('');
            setStatusNotes('');
            fetchRequests();
            fetchStatistics();
        } catch (err) { console.error(err); }
    };

    const formatDate = (date) => date ? moment(date).tz('America/Guatemala').format('DD/MM/YYYY HH:mm') : '-';

    const PRIORITY_LABELS_ES = {
        urgent: 'Urgente',
        high: 'Alta',
        medium: 'Media',
        low: 'Baja'
    };

    const PRIORITY_BG = {
        urgent: '#D32F2F',
        high: '#F44336',
        medium: '#FFB300',
        low: '#9E9E9E'
    };

    const STATUS_LABELS_ES = {
        pending: 'Pendiente',
        in_review: 'En revisión',
        cancelled: 'Cancelada',
        approved: 'Completada',
        rejected: 'Rechazada',
        completed: 'Completada'
    };

    const STATUS_BG = {
        pending: '#FB8C00',
        in_review: '#42A5F5',
        cancelled: '#9C27B0',
        approved: '#4CAF50',
        completed: '#388E3C',
        rejected: '#E53935'
    };

    const SELECTABLE_REQUEST_STATES = Object.keys(REQUEST_STATES).filter((s) => s !== 'approved');

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending':
                return <PendingIcon fontSize="small" />;
            case 'in_review':
                return <InProgressIcon fontSize="small" />;
            case 'approved':
            case 'completed':
                return <CheckCircleIcon fontSize="small" />;
            case 'rejected':
                return <CancelIcon fontSize="small" />;
            default:
                return null;
        }
    };

    const getStatusChip = (status) => {
        const normalizedStatus = status === 'approved' ? 'completed' : status;
        const label = STATUS_LABELS_ES[normalizedStatus] || REQUEST_STATES[normalizedStatus] || normalizedStatus;
        const bg = STATUS_BG[normalizedStatus] || '#757575';
        return <Chip icon={getStatusIcon(normalizedStatus)} label={label} size="small" sx={{ backgroundColor: bg, color: '#fff', fontWeight: 600 }} />;
    };

    const getPriorityChip = (priority) => {
        const label = PRIORITY_LABELS_ES[priority] || priority || '-';
        const bg = PRIORITY_BG[priority] || '#616161';
        return <Chip label={label} size="small" sx={{ backgroundColor: bg, color: '#fff', fontWeight: 600 }} />;
    };

    const getRequestTypeLabel = (requestType) => {
        const normalized = String(requestType || '').toLowerCase().trim();
        const directMeta = REQUEST_TYPE_META[normalized];
        if (directMeta?.label) return directMeta.label;

        const normalizedKey = normalized
            .replace(/-/g, '_')
            .replace(/\s+/g, '_');

        const aliasMap = {
            servicecancellation: 'service_cancellation',
            baja_del_servicio: 'service_cancellation',
            bajadelsservicio: 'service_cancellation',
            schedulechange: 'schedule_change',
            cambiodehorario: 'schedule_change',
            routechange: 'route_change',
            cambioderuta: 'route_change',
        };

        const resolvedKey = aliasMap[normalizedKey] || normalizedKey;
        return REQUEST_TYPE_META[resolvedKey]?.label || VALID_REQUEST_TYPES[resolvedKey] || requestType || 'N/A';
    };

    const REQUEST_TYPE_ICON_MAP = {
        service_cancellation: CancelIcon,
        schedule_change: ScheduleIcon,
        route_change: DirectionsBusIcon,
        payment_adjustment: PaymentsIcon,
        contract_modification: DescriptionIcon,
        student_transfer: SwapHorizIcon,
        bus_change: DirectionsBusIcon,
        temporary_suspension: PauseCircleIcon,
        complaint: WarningIcon,
        suggestion: LightbulbIcon,
        other: CreateIcon,
    };

    const getRequestTypeChip = (requestType) => {
        const meta = REQUEST_TYPE_META[requestType] || REQUEST_TYPE_META.other;
        const IconComponent = REQUEST_TYPE_ICON_MAP[requestType] || CreateIcon;

        return (
            <Chip
                icon={<IconComponent sx={{ color: '#fff !important', fontSize: 18 }} />}
                label={meta.label || VALID_REQUEST_TYPES[requestType] || requestType || '-'}
                size="small"
                sx={{
                    backgroundColor: meta.color || '#6C757D',
                    color: '#fff',
                    fontWeight: 700,
                    '& .MuiChip-icon': { color: '#fff' },
                }}
            />
        );
    };

    const getClientLabel = (request) => {
        if (!request) return null;
        if (request.corporation?.name) return request.corporation.name;
        if (request.school?.name) return request.school.name;
        return null;
    };

    const getClientChip = (request) => {
        const label = getClientLabel(request);
        if (!label) return null;

        return (
            <Chip
                label={label}
                size="small"
                sx={{
                    backgroundColor: '#E8F4FF',
                    color: '#0B5CAB',
                    fontWeight: 700,
                    border: '1px solid #BFD9F7',
                }}
            />
        );
    };

    const getSafeStatusLabel = (statusValue) => {
        const normalized = String(statusValue || '').toLowerCase();
        return STATUS_LABELS_ES[normalized] || REQUEST_STATES[normalized] || (statusValue ? String(statusValue) : 'N/A');
    };

    const getEventActionLabel = (ev) => {
        const action = String(ev?.action || '').toLowerCase();
        if (action === 'created') return 'Creación';
        if (action === 'status_updated') return 'Estado actualizado';
        if (action === 'cancelled') return 'Solicitud cancelada';
        if (action === 'assigned') return 'Solicitud asignada';
        if (action === 'completed') return 'Solicitud completada';
        if (action === 'commented') return 'Comentario agregado';
        return 'Actualización';
    };

    const getEventTitle = (ev) => {
        const action = String(ev?.action || '').toLowerCase();
        if (action === 'created') return 'Creación';
        if (action === 'status_updated') {
            const meta = ev?.metadata || {};
            const statusFromMetadataRaw = meta?.status || meta?.newStatus || meta?.statusCode;
            const notesText = String(ev?.notes || '').toLowerCase();

            const normalizeStatus = (s) => {
                if (!s) return null;
                const low = String(s).toLowerCase().trim();
                const map = {
                    'pending': 'pending', 'pendiente': 'pending',
                    'in_review': 'in_review', 'in review': 'in_review', 'en_revision': 'in_review', 'en revision': 'in_review', 'en revisión': 'in_review',
                    'approved': 'approved', 'aprobado': 'approved', 'aprobada': 'approved',
                    'rejected': 'rejected', 'rechazado': 'rejected', 'rechazada': 'rejected',
                    'completed': 'completed', 'completado': 'completed', 'completada': 'completed',
                    'cancelled': 'cancelled', 'cancelado': 'cancelled', 'cancelada': 'cancelled'
                };
                if (map[low]) return map[low];
                if (['pending','in_review','approved','rejected','completed','cancelled'].includes(low)) return low;
                return null;
            };

            const statusFromMetadata = normalizeStatus(statusFromMetadataRaw);
            let notesMatch = null;
            if (/pending|pendiente/.test(notesText)) notesMatch = 'pending';
            else if (/in[_ ]?review|en\s*revisi[oó]n|en\s*revision/.test(notesText)) notesMatch = 'in_review';
            else if (/approved|aproba/.test(notesText)) notesMatch = 'approved';
            else if (/rejected|rechazad/.test(notesText)) notesMatch = 'rejected';
            else if (/completed|completad/.test(notesText)) notesMatch = 'completed';
            else if (/cancelled|cancelad/.test(notesText)) notesMatch = 'cancelled';

            const resolved = statusFromMetadata || notesMatch;
            return resolved ? getSafeStatusLabel(resolved) : 'Estado actualizado';
        }
        if (action === 'cancelled') return 'Solicitud cancelada';
        if (action === 'assigned') return 'Solicitud asignada';
        if (action === 'completed') return 'Solicitud completada';
        if (action === 'commented') return 'Comentario agregado';
        return 'Actualización';
    };

    const getEventDetailText = (ev) => {
        const meta = ev?.metadata || {};

        if (String(ev?.action || '').toLowerCase() === 'created') {
            const requestType = meta?.requestType || selectedRequest?.requestType;
            return `Tipo: ${getRequestTypeLabel(requestType)}`;
        }

        if (String(ev?.action || '').toLowerCase() === 'status_updated') {
            const statusFromMetadataRaw = meta?.status || meta?.newStatus || meta?.statusCode;
            const notesText = String(ev?.notes || '');

            const normalizeStatus = (s) => {
                if (!s) return null;
                const low = String(s).toLowerCase().trim();
                const map = {
                    'pending': 'pending', 'pendiente': 'pending',
                    'in_review': 'in_review', 'in review': 'in_review', 'en_revision': 'in_review', 'en revision': 'in_review', 'en revisión': 'in_review',
                    'approved': 'approved', 'aprobado': 'approved', 'aprobada': 'approved', 'aprobado/a': 'approved',
                    'rejected': 'rejected', 'rechazado': 'rejected', 'rechazada': 'rejected',
                    'completed': 'completed', 'completado': 'completed', 'completada': 'completed',
                    'cancelled': 'cancelled', 'cancelado': 'cancelled', 'cancelada': 'cancelled'
                };
                if (map[low]) return map[low];
                if (['pending','in_review','approved','rejected','completed','cancelled'].includes(low)) return low;
                return null;
            };

            const statusFromMetadata = normalizeStatus(statusFromMetadataRaw);

            // detect English or Spanish keywords inside notes
            let notesMatch = null;
            const notesLower = notesText.toLowerCase();
            if (/pending|pendiente/.test(notesLower)) notesMatch = 'pending';
            else if (/in[_ ]?review|en\s*revisi[oó]n|en\s*revision/.test(notesLower)) notesMatch = 'in_review';
            else if (/approved|aproba/.test(notesLower)) notesMatch = 'approved';
            else if (/rejected|rechazad/.test(notesLower)) notesMatch = 'rejected';
            else if (/completed|completad/.test(notesLower)) notesMatch = 'completed';
            else if (/cancelled|cancelad/.test(notesLower)) notesMatch = 'cancelled';

            const resolved = statusFromMetadata || notesMatch;
            return resolved ? `Estado actualizado: ${getSafeStatusLabel(resolved)}` : 'Estado actualizado';
        }

        if (String(ev?.action || '').toLowerCase() === 'cancelled') {
            return 'La solicitud fue cancelada';
        }

        if (ev?.notes) {
            return String(ev.notes);
        }

        return 'Actualización registrada';
    };

    const getLastUpdateNote = () => {
        if (!requestEvents || requestEvents.length === 0) return null;
        const sorted = [...requestEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const statusEv = sorted.find(ev => String(ev?.action || '').toLowerCase() === 'status_updated' && (ev.notes || ev.metadata?.note));
        if (statusEv) return statusEv.notes || statusEv.metadata?.note || null;
        const anyNotes = sorted.find(ev => ev.notes || ev.metadata?.note);
        return anyNotes ? (anyNotes.notes || anyNotes.metadata?.note) : null;
    };

    const formatLastUpdateNote = (ev) => {
        if (!ev) return null;

        const action = String(ev?.action || '').toLowerCase();
        const rawNote = String(ev.notes || ev.metadata?.note || '').trim();
        if (!rawNote) return null;

        if (action === 'created') {
            const requestType = ev?.metadata?.requestType || selectedRequest?.requestType;
            return `Solicitud creada de tipo ${getRequestTypeLabel(requestType)}`;
        }

        return rawNote;
    };

    const getLastUpdateEvent = () => {
        if (!requestEvents || requestEvents.length === 0) return null;
        const sorted = [...requestEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const statusEv = sorted.find(ev => String(ev?.action || '').toLowerCase() === 'status_updated' && (ev.notes || ev.metadata?.note));
        if (statusEv) return statusEv;
        const anyNotes = sorted.find(ev => ev.notes || ev.metadata?.note);
        return anyNotes || null;
    };

    const getStatusModalMessage = (status) => {
        if (!status) return null;
        const label = getSafeStatusLabel(status);
        const normalized = normalizeStatus(status);
        if (normalized !== 'rejected' && normalized !== 'completed') {
            return null;
        }
        if (isFinalStatus(normalized)) {
            const verb = String(label).toLowerCase();
            return {
                title: `Este cambio marcará la solicitud como ${verb}.`,
                detail: `Una vez marcada como ${verb}, ya no se permitirá modificar su estado.`
            };
        }
        return {
            title: `Cambiar estado a ${label}.`,
            detail: 'Este es un estado intermedio; podrás modificarlo posteriormente si fuera necesario.'
        };
    };

    return (
        <PageContainer>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h4" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
                    Solicitudes de Usuarios
                </Typography>
                <Box>
                    {/* Refrescar global: botón local eliminado */}
                </Box>
            </Box>

            {/* Statistics */}
            {statistics && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Total</Typography>
                                <Typography variant="h4">{statistics.totalRequests}</Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: `4px solid ${STATUS_BG.pending}` }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Pendientes</Typography>
                                <Typography variant="h4" color={STATUS_BG.pending}>{statistics.pendingRequests}</Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: `4px solid ${STATUS_BG.in_review}` }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>En revisión</Typography>
                                <Typography variant="h4" color={STATUS_BG.in_review}>{statistics.inReviewRequests ?? 0}</Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: `4px solid ${STATUS_BG.completed}` }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Completadas</Typography>
                                <Typography variant="h4" color={STATUS_BG.completed}>{statistics.approvedRequests}</Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard sx={{ borderLeft: `4px solid ${STATUS_BG.rejected}` }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Rechazadas</Typography>
                                <Typography variant="h4" color={STATUS_BG.rejected}>{statistics.rejectedRequests}</Typography>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <StatsCard>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Por Prioridad</Typography>
                                <Grid container spacing={1} sx={{ mt: 1 }}>
                                    {['urgent','high','medium','low'].map((p) => (
                                        <Grid item xs={6} key={p}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Typography variant="body2">{PRIORITY_LABELS_ES[p] || p}</Typography>
                                                <Typography variant="h6">{statistics.priorityCounts?.[p] ?? 0}</Typography>
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </StatsCard>
                    </Grid>
                </Grid>
            )}

            <FiltersContainer elevation={1}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs="auto" sm="auto" md={"auto"}>
                        <CicloEscolarFilter
                            value={selectedCicloEscolar}
                            onChange={(value) => {
                                setSelectedCicloEscolar(value);
                                setDraftFilters(initialFilters);
                                setFilters(initialFilters);
                                setPage(0);
                            }}
                            sx={{ width: 190 }}
                        />
                    </Grid>
                    <Grid item xs="auto" sm="auto" md={"auto"}>
                        <TextField fullWidth size="small" label="Tipo" select value={draftFilters.requestType} onChange={handleDraftChange('requestType')} sx={{ width: 200 }}>
                            <MenuItem value="">Todos</MenuItem>
                            {Object.entries(VALID_REQUEST_TYPES).map(([k, label]) => (
                                <MenuItem key={k} value={k}>{label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs="auto" sm="auto" md={"auto"}>
                        <TextField fullWidth size="small" label="Estado" select value={draftFilters.status} onChange={handleDraftChange('status')} sx={{ width: 150 }}>
                            <MenuItem value="">Todos</MenuItem>
                                {SELECTABLE_REQUEST_STATES.map(s => (
                                    <MenuItem key={s} value={s}>{STATUS_LABELS_ES[s] || REQUEST_STATES[s] || s}</MenuItem>
                                ))}
                        </TextField>
                    </Grid>
                    <Grid item xs="auto" sm="auto" md={"auto"}>
                        <TextField fullWidth size="small" label="Solicitante (nombre)" value={draftFilters.userName} onChange={handleDraftChange('userName')} />
                    </Grid>
                    <Grid item xs="auto" sm="auto" md={"auto"}>
                        <Autocomplete
                            size="small"
                            options={clientOptions}
                            groupBy={(option) => option.group}
                            getOptionLabel={(option) => option.label || ''}
                            value={clientOptions.find(o => o.value === draftFilters.client) || null}
                            onChange={(e, val) => setDraftFilters(prev => ({ ...prev, client: val ? val.value : '' }))}
                            renderInput={(params) => <TextField {...params} label="Cliente" />}
                            isOptionEqualToValue={(option, value) => !!value && option.value === value.value}
                            clearOnEscape
                            sx={{ width: 200 }}
                        />
                    </Grid>
                    <Grid item xs="auto" sm="auto" md={"auto"}>
                        <TextField sx={{ width: 150 }} size="small" type="date" fullWidth label="Fecha Inicio" value={draftFilters.startDate} onChange={handleDraftChange('startDate')} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs="auto" sm="auto" md={"auto"}>
                        <TextField sx={{ width: 150 }} size="small" type="date" fullWidth label="Fecha Fin" value={draftFilters.endDate} onChange={handleDraftChange('endDate')} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs="auto" sm="auto" md={"auto"} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => { setDraftFilters(initialFilters); setFilters(initialFilters); setPage(0); }}>Limpiar filtros</Button>
                        <Button size="small" variant="contained" onClick={() => {
                            // Parse client selection and translate to schoolId/corporationId
                            const applied = { ...draftFilters };
                            applied.schoolId = '';
                            applied.corporationId = '';
                            if (draftFilters.client && typeof draftFilters.client === 'string') {
                                if (draftFilters.client.startsWith('school:')) {
                                    applied.schoolId = draftFilters.client.split(':')[1];
                                } else if (draftFilters.client.startsWith('corp:')) {
                                    applied.corporationId = draftFilters.client.split(':')[1];
                                }
                            }
                            // remove client key before applying
                            delete applied.client;
                            setFilters(applied);
                            setPage(0);
                        }}>Buscar</Button>
                    </Grid>
                </Grid>
            </FiltersContainer>

            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel active={sortBy==='createdAt'} direction={sortOrder} onClick={() => handleSort('createdAt')}>Fecha</TableSortLabel>
                                </TableCell>
                                <TableCell>Prioridad</TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Título</TableCell>
                                <TableCell>Solicitante</TableCell>
                                <TableCell>Creada por</TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell align="right">Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                            ) : requests.length === 0 ? (
                                <TableRow><TableCell colSpan={8} align="center">No hay solicitudes</TableCell></TableRow>
                            ) : requests.map(r => (
                                <TableRow key={r.id} hover sx={{ '&:hover': { backgroundColor: '#fafafa' } }}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</TableCell>
                                        <TableCell>{getPriorityChip(r.priority)}</TableCell>
                                        <TableCell>{getRequestTypeChip(r.requestType)}</TableCell>
                                        <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</TableCell>
                                        <TableCell>{r.requester?.name || r.requester?.fullName || r.userId}</TableCell>
                                        <TableCell>{r.createdBy?.name || r.createdBy?.email || r.requester?.name || '-'}</TableCell>
                                        <TableCell>{getStatusChip(r.status)}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Ver detalle"><IconButton size="small" onClick={() => handleViewDetail(r)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                                        <Tooltip title={isFinalStatus(r.status) || r.status === 'cancelled' ? 'Solicitud ya resuelta' : 'Cambiar estado'}>
                                            <span>
                                                <IconButton size="small" color="primary" onClick={() => handleOpenStatusModal(r)} disabled={isFinalStatus(r.status) || r.status === 'cancelled'}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title={r.status === 'cancelled' ? 'Eliminar':'Eliminar'}>
                                            <IconButton size="small" color="error" onClick={() => handleOpenDeleteModal(r)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    labelRowsPerPage="Filas por página"
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`}
                />

            {/* Detail modal */}
            <Dialog
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        overflow: 'hidden',
                        backgroundColor: '#F5F7FB',
                    },
                }}
            >
                <DialogTitle sx={{ p: 0 }}>
                    {selectedRequest ? (
                        <Box
                            sx={{
                                px: 3,
                                py: 3,
                                color: '#fff',
                                background: 'linear-gradient(135deg, #0B5CAB 0%, #2F80ED 100%)',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Box
                                    sx={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 3,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(255,255,255,0.15)',
                                        flexShrink: 0,
                                    }}
                                >
                                    <VisibilityIcon />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1 }}>
                                        Detalle de solicitud
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 0.75 }}>
                                        {selectedRequest.title || 'Solicitud sin título'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        {formatDate(selectedRequest.createdAt)}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                                {getStatusChip(selectedRequest.status)}
                                {getRequestTypeChip(selectedRequest.requestType)}
                                {getClientChip(selectedRequest)}
                            </Box>
                        </Box>
                    ) : null}
                </DialogTitle>
                <DialogContent sx={{ p: 3 }} dividers={false}>
                    {selectedRequest ? (
                        <Grid container spacing={2.5}>
                            <Grid item xs={12} md={7}>
                                <Box
                                    sx={{
                                        backgroundColor: '#fff',
                                        borderRadius: 3,
                                        p: 2.5,
                                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                                        mb: 2,
                                    }}
                                >
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                                        Información general
                                    </Typography>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                                Solicitante
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                {selectedRequest.requester?.name || selectedRequest.userId || '-'}
                                            </Typography>
                                        </Grid>

                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                                Creada por
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                {selectedRequest.createdBy?.name || selectedRequest.createdBy?.email || '-'}
                                            </Typography>
                                        </Grid>

                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                                Prioridad
                                            </Typography>
                                            <Box sx={{ mt: 0.5 }}>{getPriorityChip(selectedRequest.priority)}</Box>
                                        </Grid>

                                        <Grid item xs={12}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                                Título
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                {selectedRequest.title || '-'}
                                            </Typography>
                                        </Grid>

                                        <Grid item xs={12}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                                Descripción
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: 'text.primary',
                                                    lineHeight: 1.7,
                                                    backgroundColor: '#F8FAFC',
                                                    border: '1px solid #E5EAF2',
                                                    borderRadius: 2,
                                                    p: 2,
                                                    minHeight: 84,
                                                }}
                                            >
                                                {selectedRequest.description || selectedRequest.reason || 'Sin descripción registrada.'}
                                            </Typography>
                                        </Grid>
                                        {/* Last update moved to separate block below */}
                                    </Grid>
                                </Box>
                                {/* Bloque separado 'Última actualización' (alineado con Información general) */}
                                {(() => {
                                    const ev = getLastUpdateEvent();
                                    if (!ev) return null;
                                    const note = formatLastUpdateNote(ev);
                                    const author = ev.actor?.name || ev.actor?.fullName || ev.actor?.email || null;
                                    return (
                                        <Box
                                            sx={{
                                                backgroundColor: '#fff',
                                                borderRadius: 3,
                                                p: 2.5,
                                                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                                                mb: 2,
                                                width: '100%'
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                    Última actualización
                                                </Typography>
                                                {(() => {
                                                    const statusFromMeta = ev.metadata?.status || ev.metadata?.newStatus || ev.metadata?.statusCode;
                                                    const notesText = String(ev.notes || '').toLowerCase();
                                                    let notesMatch = null;
                                                    if (/pending|pendiente/.test(notesText)) notesMatch = 'pending';
                                                    else if (/in[_ ]?review|en\s*revisi[oó]n|en\s*revision/.test(notesText)) notesMatch = 'in_review';
                                                    else if (/approved|aprobad[oa]|aprobado|aprobada/.test(notesText)) notesMatch = 'approved';
                                                    else if (/rejected|rechazad[oa]|rechazado|rechazada/.test(notesText)) notesMatch = 'rejected';
                                                    else if (/completed|completad[oa]|completado|completada/.test(notesText)) notesMatch = 'completed';
                                                    else if (/cancelled|cancelad[oa]|cancelado|cancelada/.test(notesText)) notesMatch = 'cancelled';
                                                    const statusResolved = statusFromMeta || notesMatch || null;
                                                    if (!statusResolved) return null;
                                                    return <Box sx={{ ml: 0.5 }}>{getStatusChip(statusResolved)}</Box>;
                                                })()}
                                            </Box>
                                            {note ? (
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: 'text.primary',
                                                        lineHeight: 1.6,
                                                        backgroundColor: '#FEFEFE',
                                                        border: '1px solid #EAEFF6',
                                                        borderRadius: 2,
                                                        p: 1.5,
                                                    }}
                                                >
                                                    {String(note)}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    Sin nota de última actualización.
                                                </Typography>
                                            )}
                                            <Box sx={{ mt: 1 }}>
                                                {author && <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>{author}</Typography>}
                                                <Typography variant="caption" sx={{ color: 'text.disabled' }}>{ev.createdAt ? formatDate(ev.createdAt) : ''}</Typography>
                                            </Box>
                                        </Box>
                                    );
                                })()}
                            </Grid>

                            <Grid item xs={12} md={5}>
                                <Box
                                    sx={{
                                        backgroundColor: '#fff',
                                        borderRadius: 3,
                                        p: 2.5,
                                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                                    }}
                                >
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                                        Historial de Actualizaciones
                                    </Typography>

                                    {requestEvents.length === 0 ? (
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                            No hay actualizaciones registradas para esta solicitud.
                                        </Typography>
                                    ) : (
                                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                                            {requestEvents.map((ev, index) => (
                                                <Box
                                                    key={ev.id}
                                                    sx={{
                                                        display: 'flex',
                                                        gap: 0,
                                                        alignItems: 'flex-start',
                                                        p: 1.5,
                                                        borderRadius: 2,
                                                        backgroundColor: index === 0 ? '#F8FAFC' : '#FBFDFF',
                                                        border: '1px solid #E6EDF7',
                                                    }}
                                                >
                                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                                            {getEventTitle(ev)}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.6 }}>
                                                            {getEventDetailText(ev)}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.75 }}>
                                                            {formatDate(ev.createdAt)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
                                </Box>
                            </Grid>
                        </Grid>
                    ) : <CircularProgress />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailModalOpen(false)}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirm */}
            <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
                <DialogTitle>Eliminar solicitud</DialogTitle>
                    <DialogContent>¿Deseas eliminar permanentemente esta solicitud?</DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteModalOpen(false)}>Cerrar</Button>
                        <Button color="error" variant="contained" onClick={handleConfirmDelete}>Eliminar</Button>
                    </DialogActions>
            </Dialog>

            {/* Status change */}
            <Dialog
                open={statusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        overflow: 'hidden',
                        background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%)',
                    }
                }}
            >
                <DialogTitle sx={{ p: 0 }}>
                    <Box sx={{ px: 3, py: 2.5, background: 'linear-gradient(135deg, #0B5CAB 0%, #2F80ED 100%)', color: '#fff' }}>
                        <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1 }}>
                            Gestión de estado
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, mt: 0.5 }}>
                            Cambiar estado de solicitud
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.92, mt: 1 }}>
                            Selecciona el nuevo estado y añade una nota de revisión si corresponde.
                        </Typography>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 3 }}>
                    <Box sx={{ mb: 2.5, p: 2, borderRadius: 3, backgroundColor: '#EEF5FF', border: '1px solid #D8E7FF' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                            Solicitud
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {selectedRequest?.title || 'Solicitud sin título'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, mb: 0.5 }}>
                            Descripción
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: 'text.primary',
                                lineHeight: 1.6,
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #DCE7F5',
                                borderRadius: 2,
                                p: 1.5,
                                minHeight: 64,
                            }}
                        >
                            {selectedRequest?.description || selectedRequest?.reason || 'Sin descripción registrada.'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                            {getStatusChip(selectedRequest?.status)}
                            {getPriorityChip(selectedRequest?.priority)}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <TextField
                            select
                            label="Nuevo estado"
                            fullWidth
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            helperText={newStatus ? (isFinalStatus(newStatus) ? 'Los estados finales requieren confirmación.' : ' ') : 'Selecciona un nuevo estado.'}
                        >
                            <MenuItem value="" disabled>
                                Selecciona un estado
                            </MenuItem>
                            {SELECTABLE_REQUEST_STATES.map(s => (
                                normalizeStatus(s) === normalizeStatus(selectedRequest?.status)
                                    ? null
                                    : <MenuItem key={s} value={s}>{STATUS_LABELS_ES[s] || REQUEST_STATES[s] || s}</MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="Notas de revisión"
                            fullWidth
                            multiline
                            rows={4}
                            value={statusNotes}
                            onChange={(e) => setStatusNotes(e.target.value)}
                            placeholder="Escribe una nota breve de la decisión tomada"
                        />

                        {newStatus && (() => {
                            const msg = getStatusModalMessage(newStatus);
                            if (!msg) return null;
                            const final = isFinalStatus(newStatus);
                            return (
                                <Box sx={{ p: 2, borderRadius: 2, backgroundColor: final ? '#FFF4E5' : '#F5F8FF', border: final ? '1px solid #FFD59A' : '1px solid #DCE7F5' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Box>{getStatusChip(newStatus)}</Box>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: final ? '#8A5A00' : 'text.primary' }}>
                                            {msg.title}
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ color: final ? '#8A5A00' : 'text.secondary', display: 'block' }}>
                                        {msg.detail}
                                    </Typography>
                                </Box>
                            );
                        })()}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
                    <Button onClick={() => setStatusModalOpen(false)} variant="outlined">
                        Cancelar
                    </Button>
                    <Button variant="contained" onClick={handleConfirmStatusChange} disabled={!newStatus}>
                        Cambiar
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={statusConfirmOpen}
                onClose={() => setStatusConfirmOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 4 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Confirmar resolución final</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        {pendingStatusPayload?.status ? `Estás a punto de marcar la solicitud como ${String(getSafeStatusLabel(pendingStatusPayload.status)).toLowerCase()}. Después de esto no se podrá volver a editar su estado.` : 'Estás a punto de marcar la solicitud como un estado final. Después de esto no se podrá volver a editar su estado.'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        {getStatusChip(pendingStatusPayload?.status)}
                    </Box>
                    <Typography variant="body2" sx={{ textAlign: 'center' }}>
                        ¿Deseas continuar?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => { setStatusConfirmOpen(false); setPendingStatusPayload(null); }} variant="outlined">
                        Cancelar
                    </Button>
                    <Button color="warning" variant="contained" onClick={handleConfirmFinalStatus}>
                        Sí, confirmar
                    </Button>
                </DialogActions>
            </Dialog>
        </PageContainer>
    );
};

export default RequestsPage;
