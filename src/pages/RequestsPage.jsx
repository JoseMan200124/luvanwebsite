/**
 * pages/RequestsPage.jsx
 *
 * Solicitudes de usuarios de un colegio o una corporación
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import {
    Paper,
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableRow,
    TextField,
    MenuItem,
    Grid,
    Chip,
    CircularProgress,
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    HelpOutline as HelpOutlineIcon,
    Add as AddIcon
} from '@mui/icons-material';
import {
    Cancel as CancelIcon,
    Assignment as AssignmentIcon,
    Flag as FlagIcon
} from '@mui/icons-material';
import StatusChip from '../components/StatusChip';
import { REQUEST_STATUS, getStatusLabel } from '../constants/statuses';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import {
    getAllRequests,
    getRequestById,
    getRequestEvents,
    updateRequestStatus,
    deleteRequest,
    getRequestStatistics,
    REQUEST_TYPE_META,
    VALID_REQUEST_TYPES,
    REQUEST_STATES
} from '../services/requestService';
import {
    Schedule as ScheduleIcon,
    DirectionsBus as DirectionsBusIcon,
    Create as CreateIcon,
} from '@mui/icons-material';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import api from '../utils/axiosConfig';
import { getCicloEscolarYear } from '../services/cicloEscolarService';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import useClientScope from '../hooks/useClientScope';
import AppDialog from '../components/dialogs/AppDialog';
import { StatCard, StatCardGrid } from '../components/StatCard';
import usePermissions from '../hooks/usePermissions';
import NuevaSolicitudDialog from '../components/requests/NuevaSolicitudDialog';
import FechaLimiteEditor from '../components/requests/FechaLimiteEditor';
import { useCurrentDate } from '../hooks/useCurrentDate';
import { estaVencida } from '../utils/solicitudesFamilias';

const SELECTABLE_REQUEST_STATES = Object.keys(REQUEST_STATES).filter((s) => s !== 'approved');

/**
 * RequestsPage
 *
 * Componente de React que muestra y gestiona una lista paginada de solicitudes de usuarios.
 * - Obtiene datos mediante llamadas a la API: getAllRequests, getRequestById, deleteRequest, updateRequestStatus.
 * - Muestra estadísticas agregadas mediante getRequestStatistics.
 * - Siempre trabaja sobre un colegio (ruta /escuelas/ciclo/:cicloEscolarId/:schoolId/solicitudes) o una
 *   corporación (ruta /corporaciones/:fiscalYear/:corporationId/solicitudes), tomados de la URL.
 * - No manda cicloEscolarId: el interceptor de axios aporta el ciclo de la URL y un valor explícito lo pisaría.
 * - Soporta filtrado (tipo, estado, solicitante, rango de fechas), ordenamiento y paginación.
 * - Permite ver detalle de una solicitud, cambiar su estado (con notas) y eliminarla; actualiza la lista y estadísticas tras acciones.
 * - Gestiona estados locales para: requests, loading, statistics, filtros (aplicados y draft), paginación, ordenamiento,
 *   selección de request, y modales (detalle, confirmación de borrado, cambio de estado).
 * - Formatea fechas con utils/dateFormat (zona 'America/Guatemala').
 *
 * Uso interno de utilidades UI:
 * - Genera Chips con etiquetas y colores según prioridad/estado.
 * - Usa componentes de MUI: Table, Dialogs, Buttons, Icons, etc.
 *
 * Notas:
 * - No recibe props; lee el scope (colegio o corporación) de la URL.
 * - Las keys esperadas en objetos de solicitud incluyen campos como id, createdAt, priority, requestType, title,
 *   requester, status, reviewNotes/review_notes, reviewer/reviewedBy, reviewedAt, school, corporation.
 *
 * @returns {JSX.Element} Interfaz completa para listar y gestionar solicitudes.
 * @see {@link https://mui.com/material-ui/icons/} Para ver otros iconos disponibles (paquete @mui/icons-material).
 */
// Columnas de la tabla
const COLUMNS = [
    { id: 'createdAt', label: 'Fecha', sortable: true },
    { id: 'prioridad', label: 'Prioridad' },
    { id: 'tipo', label: 'Tipo' },
    { id: 'titulo', label: 'Título' },
    { id: 'solicitante', label: 'Solicitante' },
    { id: 'creada_por', label: 'Creada por' },
    { id: 'dueDate', label: 'Fecha límite', sortable: true },
    { id: 'estado', label: 'Estado' },
    { id: 'acciones', label: 'Acciones', align: 'right' },
];

const RequestsPage = () => {
    const location = useLocation();
    const { hasPermission } = usePermissions();
    const { schoolId, fiscalYear, corporationId } = useParams();
    const scopeParams = useMemo(
        () => (schoolId ? { schoolId } : { corporationId }),
        [schoolId, corporationId]
    );

    // Datos del colegio o la corporación para el encabezado (del estado de navegación o de la API)
    const stateSchool = location.state?.school;
    const stateCorporation = location.state?.corporation;
    const [scopeData, setScopeData] = useState(null);
    const currentCicloEscolar = scopeData?.cicloEscolar || scopeData?.CicloEscolar
        || location.state?.cicloEscolar || stateSchool?.cicloEscolar || stateSchool?.CicloEscolar || null;
    const currentCycleLabel = getCicloEscolarYear(currentCicloEscolar);
    const scope = useClientScope({ entity: scopeData || (schoolId ? stateSchool : stateCorporation), cicloEscolar: currentCicloEscolar });
    const { currentDate } = useCurrentDate();
    const hoy = currentDate.format('YYYY-MM-DD');
    // Solo en la fila operativa del colegio (ni archivada ni ciclo siguiente). Sin los campos, oculto: la API igual responde 409.
    const puedeCrear = Boolean(schoolId)
        && String(scopeData?.operationStatus || '').toUpperCase() === 'ACTIVE'
        && String(scopeData?.cycleStatus || '').toUpperCase() !== 'ARCHIVED';
    const [nuevaOpen, setNuevaOpen] = useState(false);

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState(null);

    // Paginación y orden (en el servidor)
    const table = useTableState({ defaultOrderBy: 'createdAt', defaultOrder: 'desc' });
    const { page, rowsPerPage, orderBy: sortBy, order: sortOrder } = table;
    const [totalCount, setTotalCount] = useState(0);

    const pageFilters = useFilters({
        fields: [
            F.select('requestType', { label: 'Tipo', options: VALID_REQUEST_TYPES }),
            F.select('status', {
                label: 'Estado',
                width: 'sm',
                options: SELECTABLE_REQUEST_STATES.map((state) => ({ value: state, label: getStatusLabel(REQUEST_STATUS, state) })),
            }),
            F.search('userName', { label: 'Solicitante', width: 'md' }),
            F.dateRange('dates'),
        ],
        onApplied: table.resetPage,
    });
    const { requestType, status, userName, dates } = pageFilters.applied;
    const filters = useMemo(
        () => ({ userName, status, requestType, startDate: dates.from, endDate: dates.to }),
        [userName, status, requestType, dates.from, dates.to]
    );

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
        if (normalized === 'approved') {
            return 'completed';
        }
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
                ...scopeParams,
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
    }, [page, rowsPerPage, filters, scopeParams, sortBy, sortOrder]);

    // Load statistics
    const fetchStatistics = useCallback(async () => {
        try {
            const params = { ...scopeParams };
            if (filters.startDate) {
                params.startDate = filters.startDate;
            }
            if (filters.endDate) {
                params.endDate = filters.endDate;
            }
            const stats = await getRequestStatistics(params);
            setStatistics(stats);
        } catch (err) {
            console.error('Error fetching statistics', err);
        }
    }, [filters.startDate, filters.endDate, scopeParams]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);
    useEffect(() => { fetchStatistics(); }, [fetchStatistics]);

    useEffect(() => {
        const stateScope = schoolId ? stateSchool : stateCorporation;
        if (stateScope) {
            // El estado de navegación pinta el encabezado de inmediato.
            setScopeData(stateScope);
            // Un colegio sin operationStatus (estado parcial) se completa con el GET: sin ese dato
            // se ocultaría el botón "Nueva solicitud".
            if (!schoolId || stateScope.operationStatus) {
                return;
            }
        }
        const fetchScopeData = async () => {
            try {
                const response = await api.get(schoolId ? `/schools/${schoolId}` : `/corporations/${corporationId}`);
                // GET /schools/:id responde { school } y GET /corporations/:id responde { corporation }.
                setScopeData(schoolId ? response.data?.school : response.data?.corporation);
            } catch (error) {
                console.error('Error al obtener datos del encabezado:', error);
            }
        };
        fetchScopeData();
    }, [schoolId, corporationId, stateSchool, stateCorporation]);


    // Register global refresh handler so the global button triggers this page's refresh
    useRegisterPageRefresh(async () => {
        table.resetPage();
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
        if (!requestToDelete) {
            return;
        }
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
        if (!selectedRequest) {
            return;
        }
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
        if (statusNotes) {
            payload.reviewNotes = statusNotes;
        }

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
        if (!pendingStatusPayload) {
            return;
        }
        try {
            const payload = { status: pendingStatusPayload.status };
            if (pendingStatusPayload.notes) {
                payload.reviewNotes = pendingStatusPayload.notes;
            }
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

    const getStatusChip = (status) => (
        <StatusChip domain={REQUEST_STATUS} value={status === 'approved' ? 'completed' : status} showIcon sx={{ fontWeight: 600 }} />
    );

    const getPriorityChip = (priority) => {
        const label = PRIORITY_LABELS_ES[priority] || priority || '-';
        const bg = PRIORITY_BG[priority] || '#616161';
        return <Chip label={label} size="small" sx={{ backgroundColor: bg, color: '#fff', fontWeight: 600 }} />;
    };

    const getRequestTypeLabel = (requestType) => {
        const normalized = String(requestType || '').toLowerCase().trim();
        const directMeta = REQUEST_TYPE_META[normalized];
        if (directMeta?.label) {
            return directMeta.label;
        }

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
        if (!request) {
            return null;
        }
        if (request.corporation?.name) {
            return request.corporation.name;
        }
        if (request.school?.name) {
            return request.school.name;
        }
        return null;
    };

    const getClientChip = (request) => {
        const label = getClientLabel(request);
        if (!label) {
            return null;
        }

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
        return statusValue ? getStatusLabel(REQUEST_STATUS, statusValue) : 'N/A';
    };

    // Try to extract a status value from a variety of metadata shapes
    const extractStatusFromMetadata = (meta) => {
        if (!meta) {
            return null;
        }
        // direct known keys
        const direct = meta?.status || meta?.newStatus || meta?.statusCode || meta?.to || meta?.new_status || meta?.new_status_code;
        if (direct) {
            return direct;
        }

        // check common nested shapes
        if (meta.change && (meta.change.to || meta.change.new)) {
            return meta.change.to || meta.change.new;
        }
        if (meta.changes?.status && (meta.changes.status.to || meta.changes.status.new)) {
            return meta.changes.status.to || meta.changes.status.new;
        }
        if (meta.details && (meta.details.status || meta.details.newStatus)) {
            return meta.details.status || meta.details.newStatus;
        }

        // recursive shallow scan for string values that look like a status
        const candidates = [];
        const scan = (obj, depth = 0) => {
            if (!obj || depth > 3) {
                return;
            }
            if (typeof obj === 'string' || typeof obj === 'number') {
                candidates.push(String(obj));
                return;
            }
            if (Array.isArray(obj)) {
                for (const v of obj) {
                    scan(v, depth + 1);
                }
                return;
            }
            if (typeof obj === 'object') {
                for (const k of Object.keys(obj)) {
                    const v = obj[k];
                    if (typeof v === 'string' || typeof v === 'number') {
                        candidates.push(String(v));
                    }
                    else if (typeof v === 'object') {
                        scan(v, depth + 1);
                    }
                }
            }
        };

        scan(meta, 0);
        if (candidates.length === 0) {
            return null;
        }

        // try to find one candidate that matches known keywords
        const join = candidates.join(' ').toLowerCase();
        const keywords = ['pending','pendiente','in_review','in review','en revisi','approved','aprob','rejected','rechaz','completed','completad','cancelled','cancelad'];
        for (const kw of keywords) {
            if (join.includes(kw)) {
                return kw;
            }
        }

        // fallback to first candidate
        return candidates[0] || null;
    };

    const normalizeEventStatus = (s) => {
        if (!s) {
            return null;
        }
        const low = String(s).toLowerCase().trim();
        const map = {
            'pending': 'pending', 'pendiente': 'pending',
            'in_review': 'in_review', 'in review': 'in_review', 'en_revision': 'in_review', 'en revision': 'in_review', 'en revisión': 'in_review',
            'approved': 'completed', 'aprobado': 'completed', 'aprobada': 'completed', 'aprob': 'completed',
            'rejected': 'rejected', 'rechazado': 'rejected', 'rechazada': 'rejected', 'rechaz': 'rejected',
            'completed': 'completed', 'completado': 'completed', 'completada': 'completed', 'completad': 'completed',
            'cancelled': 'cancelled', 'cancelado': 'cancelled', 'cancelada': 'cancelled', 'cancelad': 'cancelled'
        };
        // direct key
        if (map[low]) {
            return map[low];
        }
        if (['pending','in_review','approved','rejected','completed','cancelled'].includes(low)) {
            return low;
        }
        return null;
    };

    const getEventTitle = (ev) => {
        const action = String(ev?.action || '').toLowerCase();
        if (action === 'created') {
            return 'Creación';
        }
        if (action === 'status_updated') {
            return 'Estado actualizado';
        }
        if (action === 'cancelled') {
            return 'Solicitud cancelada';
        }
        if (action === 'assigned') {
            return 'Solicitud asignada';
        }
        if (action === 'completed') {
            return 'Solicitud completada';
        }
        if (action === 'commented') {
            return 'Comentario agregado';
        }
        if (action === 'due_date_changed') {
            return 'Fecha límite';
        }
        return 'Actualización';
    };

    const getEventDetailText = (ev) => {
        const meta = ev?.metadata || {};
        const action = String(ev?.action || '').toLowerCase();
        const notesTextRaw = ev?.notes || meta?.note || '';
        const notes = String(notesTextRaw || '').trim();

        let mainText = null;

        if (action === 'created') {
            const requestType = meta?.requestType || selectedRequest?.requestType;
            mainText = `Tipo: ${getRequestTypeLabel(requestType)}`;
            // La nota automática ("Solicitud creada de tipo schedule_change" en registros viejos) repite el tipo
            // y puede traer la clave en inglés: solo se muestra una nota escrita por alguien.
            if (/^Solicitud creada de tipo /i.test(notes)) {
                return mainText;
            }
        } else if (action === 'status_updated') {
            const rawFromMeta = extractStatusFromMetadata(meta);

            let resolved = normalizeEventStatus(rawFromMeta);
            if (!resolved) {
                const notesLower = notes.toLowerCase();
                if (/pending|pendiente/.test(notesLower)) {
                    resolved = 'pending';
                }
                else if (/in[_ ]?review|en\s*revisi[oó]n|en\s*revision/.test(notesLower)) {
                    resolved = 'in_review';
                }
                else if (/approved|aproba/.test(notesLower)) {
                    resolved = 'completed';
                }
                else if (/rejected|rechazad/.test(notesLower)) {
                    resolved = 'rejected';
                }
                else if (/completed|completad/.test(notesLower)) {
                    resolved = 'completed';
                }
                else if (/cancelled|cancelad/.test(notesLower)) {
                    resolved = 'cancelled';
                }
            }

            mainText = resolved ? `Estado actualizado: ${getSafeStatusLabel(resolved)}` : 'Estado actualizado';
        } else if (action === 'cancelled') {
            mainText = 'La solicitud fue cancelada';
        } else {
            // For unrecognized actions, prefer to show notes alone if they exist
            if (notes) {
                return String(notes);
            }
            mainText = 'Actualización registrada';
        }

        if (!notes) {
            return mainText;
        }

        return (
            <>
                {mainText}
                <br />
                {"Notas: " + notes}
            </>
        );
    };

    const formatLastUpdateNote = (ev) => {
        if (!ev) {
            return null;
        }

        const action = String(ev?.action || '').toLowerCase();
        const rawNote = String(ev.notes || ev.metadata?.note || '').trim();
        if (!rawNote) {
            return null;
        }

        if (action === 'created') {
            const requestType = ev?.metadata?.requestType || selectedRequest?.requestType;
            return `Solicitud creada de tipo ${getRequestTypeLabel(requestType)}`;
        }

        return rawNote;
    };

    const getLastUpdateEvent = () => {
        if (!requestEvents || requestEvents.length === 0) {
            return null;
        }
        const sorted = [...requestEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const statusEv = sorted.find(ev => String(ev?.action || '').toLowerCase() === 'status_updated' && (ev.notes || ev.metadata?.note));
        if (statusEv) {
            return statusEv;
        }
        const anyNotes = sorted.find(ev => ev.notes || ev.metadata?.note);
        return anyNotes || null;
    };

    const getStatusModalMessage = (status) => {
        if (!status) {
            return null;
        }
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
            <PageHeader
                variant="hero"
                tone={scope.tone}
                title="Solicitudes de Usuarios"
                name={scopeData?.name ?? null}
                back={scope.back}
                period={scope.periodLabel(schoolId ? currentCycleLabel : fiscalYear)}
                meta={[`${totalCount} solicitudes encontradas`]}
                actions={[
                    puedeCrear && { key: 'nueva', label: 'Nueva solicitud', icon: <AddIcon />, primary: true, permission: 'solicitudes-crear', onClick: () => setNuevaOpen(true) },
                ]}
            />

            {/* Statistics */}
            {statistics && (
                <StatCardGrid columns={{ md: 3, lg: 6 }}>
                    <StatCard label="Total" value={statistics.totalRequests} icon={<AssignmentIcon />} format="number" />
                    {[
                        { label: 'Pendientes', status: REQUEST_STATUS.pending, value: statistics.pendingRequests },
                        { label: 'En revisión', status: REQUEST_STATUS.in_review, value: statistics.inReviewRequests ?? 0 },
                        { label: 'Completadas', status: REQUEST_STATUS.completed, value: statistics.approvedRequests },
                        { label: 'Rechazadas', status: REQUEST_STATUS.rejected, value: statistics.rejectedRequests },
                    ].map(({ label, status, value }) => {
                        const StatusIcon = status.icon;
                        return (
                            <StatCard
                                key={label}
                                label={label}
                                value={value}
                                icon={<StatusIcon />}
                                color={status.color}
                                valueColor={status.color}
                                format="number"
                            />
                        );
                    })}
                    <StatCard label="Por prioridad" icon={<FlagIcon />}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 0.25, pr: 0.5 }}>
                            {['urgent', 'high', 'medium', 'low'].map((p) => (
                                <Box key={p} sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>{PRIORITY_LABELS_ES[p] || p}</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.4 }}>{statistics.priorityCounts?.[p] ?? 0}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </StatCard>
                </StatCardGrid>
            )}

            <FilterBar {...pageFilters.barProps} loading={loading} />

            <AppTableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                        <SortableTableHead columns={COLUMNS} {...table.sortProps} />
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                            ) : requests.length === 0 ? (
                                <TableRow><TableCell colSpan={9} align="center">No hay solicitudes</TableCell></TableRow>
                            ) : requests.map(r => (
                                <TableRow key={r.id} hover sx={{ '&:hover': { backgroundColor: '#fafafa' } }}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.createdAt)}</TableCell>
                                        <TableCell>{getPriorityChip(r.priority)}</TableCell>
                                        <TableCell>{getRequestTypeChip(r.requestType)}</TableCell>
                                        <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</TableCell>
                                        <TableCell>{r.requester?.name || r.requester?.fullName || r.userId}</TableCell>
                                        <TableCell>{r.createdBy?.name || r.createdBy?.email || r.requester?.name || '-'}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {r.dueDate ? formatDate(r.dueDate) : '-'}
                                            {estaVencida(r, hoy) && <Chip label="Vencida" color="error" size="small" sx={{ ml: 1 }} />}
                                        </TableCell>
                                        <TableCell>{getStatusChip(r.status)}</TableCell>
                                    <TableCell align="right">
                                        <RowActions
                                            actions={[
                                                { key: 'view', kind: 'view', label: 'Ver detalle', icon: <VisibilityIcon fontSize="small" />, onClick: () => handleViewDetail(r) },
                                                {
                                                    key: 'status',
                                                    kind: 'edit',
                                                    color: 'primary',
                                                    label: 'Cambiar estado',
                                                    tooltip: isFinalStatus(r.status) || r.status === 'cancelled' ? 'Solicitud ya resuelta' : 'Cambiar estado',
                                                    icon: <EditIcon fontSize="small" />,
                                                    permission: 'solicitudes-actualizar-estado',
                                                    disabled: isFinalStatus(r.status) || r.status === 'cancelled',
                                                    onClick: () => handleOpenStatusModal(r),
                                                },
                                                { key: 'delete', kind: 'delete', label: 'Eliminar', icon: <DeleteIcon fontSize="small" />, permission: 'solicitudes-eliminar', onClick: () => handleOpenDeleteModal(r) },
                                            ]}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </AppTableContainer>
                <AppTablePagination count={totalCount} {...table.paginationProps} />

            {puedeCrear && (
                <NuevaSolicitudDialog
                    open={nuevaOpen}
                    schoolId={schoolId}
                    onClose={() => setNuevaOpen(false)}
                    onCreated={() => { fetchRequests(); fetchStatistics(); }}
                />
            )}

            {/* Detail modal */}
            <AppDialog
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title={selectedRequest ? (selectedRequest.title || 'Solicitud sin título') : 'Detalle de solicitud'}
                subtitle={selectedRequest ? formatDateTime(selectedRequest.createdAt) : undefined}
                icon={<VisibilityIcon />}
                size="md"
                readOnly
                contentSx={{ backgroundColor: '#F5F7FB' }}
            >
                {selectedRequest ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
                        {getStatusChip(selectedRequest.status)}
                        {getRequestTypeChip(selectedRequest.requestType)}
                        {getClientChip(selectedRequest)}
                    </Box>
                ) : null}
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

                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                            Fecha límite
                                        </Typography>
                                        <FechaLimiteEditor
                                            request={selectedRequest}
                                            editable={hasPermission('solicitudes-actualizar-estado')}
                                            hoy={hoy}
                                            onSaved={async (actualizada) => {
                                                setSelectedRequest((anterior) => ({ ...anterior, dueDate: actualizada?.dueDate ?? null }));
                                                try {
                                                    setRequestEvents(await getRequestEvents(selectedRequest.id));
                                                } catch (err) {
                                                    // La fecha ya se guardó: solo falló refrescar el historial.
                                                    console.error('Error al refrescar el historial', err);
                                                }
                                                fetchRequests();
                                            }}
                                        />
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
                                if (!ev) {
                                    return null;
                                }
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
                                                if (/pending|pendiente/.test(notesText)) {
                                                    notesMatch = 'pending';
                                                }
                                                else if (/in[_ ]?review|en\s*revisi[oó]n|en\s*revision/.test(notesText)) {
                                                    notesMatch = 'in_review';
                                                }
                                                else if (/approved|aprobad[oa]|aprobado|aprobada/.test(notesText)) {
                                                    notesMatch = 'approved';
                                                }
                                                else if (/rejected|rechazad[oa]|rechazado|rechazada/.test(notesText)) {
                                                    notesMatch = 'rejected';
                                                }
                                                else if (/completed|completad[oa]|completado|completada/.test(notesText)) {
                                                    notesMatch = 'completed';
                                                }
                                                else if (/cancelled|cancelad[oa]|cancelado|cancelada/.test(notesText)) {
                                                    notesMatch = 'cancelled';
                                                }
                                                const statusResolved = statusFromMeta || notesMatch || null;
                                                if (!statusResolved) {
                                                    return null;
                                                }
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
                                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>{ev.createdAt ? formatDateTime(ev.createdAt) : ''}</Typography>
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
                                                        {formatDateTime(ev.createdAt)}
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
            </AppDialog>

            {/* Delete confirm */}
            <AppDialog
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Eliminar solicitud"
                icon={<DeleteIcon />}
                tone="danger"
                size="xs"
                onSubmit={handleConfirmDelete}
                submitLabel="Eliminar"
            >
                <Typography variant="body2">¿Deseas eliminar permanentemente esta solicitud?</Typography>
            </AppDialog>

            {/* Status change */}
            <AppDialog
                open={statusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                title="Cambiar estado de solicitud"
                subtitle="Selecciona el nuevo estado y añade una nota de revisión si corresponde."
                icon={<EditIcon />}
                size="sm"
                onSubmit={handleConfirmStatusChange}
                submitLabel="Cambiar"
                submitDisabled={!newStatus}
                readOnly={!hasPermission('solicitudes-actualizar-estado')}
            >
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
                                : <MenuItem key={s} value={s}>{getStatusLabel(REQUEST_STATUS, s)}</MenuItem>
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
                        if (!msg) {
                            return null;
                        }
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
            </AppDialog>

            <AppDialog
                open={statusConfirmOpen}
                onClose={() => { setStatusConfirmOpen(false); setPendingStatusPayload(null); }}
                title="Resolver solicitud"
                icon={<HelpOutlineIcon />}
                size="xs"
                onSubmit={handleConfirmFinalStatus}
                submitLabel="Resolver"
            >
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {pendingStatusPayload?.status ? `Estás a punto de marcar la solicitud como ${String(getSafeStatusLabel(pendingStatusPayload.status)).toLowerCase()}. Después de esto no se podrá volver a editar su estado.` : 'Estás a punto de marcar la solicitud como un estado final. Después de esto no se podrá volver a editar su estado.'}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    {getStatusChip(pendingStatusPayload?.status)}
                </Box>
                <Typography variant="body2" sx={{ textAlign: 'center' }}>
                    ¿Deseas continuar?
                </Typography>
            </AppDialog>
        </PageContainer>
    );
};

export default RequestsPage;
