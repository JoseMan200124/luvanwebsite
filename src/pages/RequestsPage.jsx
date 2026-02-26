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
    TableSortLabel
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
    updateRequestStatus,
    deleteRequest,
    getRequestStatistics,
    getSchoolsList,
    getCorporationsList,
    VALID_REQUEST_TYPES,
    REQUEST_STATES,
    STATE_COLORS
} from '../services/requestService';

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
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState(null);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');

    // Load requests
    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                sortBy,
                sortOrder: sortOrder.toUpperCase(),
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
    }, [page, rowsPerPage, filters, sortBy, sortOrder]);

    // Load statistics
    const fetchStatistics = useCallback(async () => {
        try {
            const params = {};
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (filters.schoolId) params.schoolId = filters.schoolId;
            if (filters.corporationId) params.corporationId = filters.corporationId;
            const stats = await getRequestStatistics(params);
            setStatistics(stats);
        } catch (err) {
            console.error('Error fetching statistics', err);
        }
    }, [filters.startDate, filters.endDate, filters.schoolId, filters.corporationId]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);
    useEffect(() => { fetchStatistics(); }, [fetchStatistics]);
    useEffect(() => {
        // Fetch schools and corporations for client selector
        (async () => {
            try {
                const sc = await getSchoolsList();
                setSchools(sc || []);
            } catch (e) { console.error('Error loading schools', e); }
            try {
                const cc = await getCorporationsList();
                setCorporations(cc || []);
            } catch (e) { console.error('Error loading corporations', e); }
        })();
    }, []);

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
            setSelectedRequest(detail);
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
        setSelectedRequest(request);
        setNewStatus(request.status || '');
        setStatusNotes(request.reviewNotes || request.review_notes || '');
        setStatusModalOpen(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!selectedRequest) return;
        try {
            const payload = { status: newStatus };
            if (statusNotes) payload.reviewNotes = statusNotes;
            await updateRequestStatus(selectedRequest.id, payload);
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
        approved: 'Aprobada',
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
        const label = STATUS_LABELS_ES[status] || REQUEST_STATES[status] || status;
        const bg = STATUS_BG[status] || '#757575';
        return <Chip icon={getStatusIcon(status)} label={label} size="small" sx={{ backgroundColor: bg, color: '#fff', fontWeight: 600 }} />;
    };

    const getPriorityChip = (priority) => {
        const label = PRIORITY_LABELS_ES[priority] || priority || '-';
        const bg = PRIORITY_BG[priority] || '#616161';
        return <Chip label={label} size="small" sx={{ backgroundColor: bg, color: '#fff', fontWeight: 600 }} />;
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
                        <StatsCard sx={{ borderLeft: `4px solid ${STATUS_BG.approved}` }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Aprobadas/Completadas</Typography>
                                <Typography variant="h4" color={STATUS_BG.approved}>{statistics.approvedRequests}</Typography>
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
                                {Object.keys(REQUEST_STATES).map(s => (
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
                        <Button size="small" variant="outlined" onClick={() => { setDraftFilters(initialFilters); setFilters(initialFilters); setPage(0); fetchStatistics(); fetchRequests(); }}>Limpiar filtros</Button>
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
                            fetchStatistics();
                            fetchRequests();
                        }}>Buscar</Button>
                    </Grid>
                </Grid>
            </FiltersContainer>

            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
                <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel active={sortBy==='createdAt'} direction={sortOrder} onClick={() => handleSort('createdAt')}>Fecha</TableSortLabel>
                                </TableCell>
                                <TableCell>Prioridad</TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Título</TableCell>
                                <TableCell>Solicitante</TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell align="right">Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                            ) : requests.length === 0 ? (
                                <TableRow><TableCell colSpan={7} align="center">No hay solicitudes</TableCell></TableRow>
                            ) : requests.map(r => (
                                <TableRow key={r.id} hover sx={{ '&:hover': { backgroundColor: '#fafafa' } }}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</TableCell>
                                        <TableCell>{getPriorityChip(r.priority)}</TableCell>
                                        <TableCell>{VALID_REQUEST_TYPES[r.requestType] || r.requestType}</TableCell>
                                        <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</TableCell>
                                        <TableCell>{r.requester?.name || r.requester?.fullName || r.userId}</TableCell>
                                        <TableCell>{getStatusChip(r.status)}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Ver detalle"><IconButton size="small" onClick={() => handleViewDetail(r)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                                        <Tooltip title={r.status === 'cancelled' ? 'No editable (cancelada)' : 'Cambiar estado'}>
                                            <span>
                                                <IconButton size="small" color="primary" onClick={() => handleOpenStatusModal(r)} disabled={r.status === 'cancelled'}>
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
            <Dialog open={detailModalOpen} onClose={() => setDetailModalOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    Detalle de Solicitud
                </DialogTitle>
                <DialogContent dividers>
                    {selectedRequest ? (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Fecha de solicitud</Typography>
                                <Typography>{formatDate(selectedRequest.createdAt)}</Typography>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Solicitante</Typography>
                                <Typography>
                                    {(() => {
                                        const base = selectedRequest.requester?.name || selectedRequest.userId || '-';
                                        if (selectedRequest.corporation?.name) return `${base} - Corporación ${selectedRequest.corporation.name}`;
                                        if (selectedRequest.school?.name) return `${base} - Colegio ${selectedRequest.school.name}`;
                                        return base;
                                    })()}
                                </Typography>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Estado</Typography>
                                <Box sx={{ mt: 1 }}>{getStatusChip(selectedRequest.status)}</Box>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Tipo de solicitud</Typography>
                                <Typography>{VALID_REQUEST_TYPES[selectedRequest.requestType] || selectedRequest.requestType || '-'}</Typography>
                            </Grid>

                            <Grid item xs={12}>
                                <Typography variant="subtitle2" color="textSecondary">Título de la solicitud</Typography>
                                <Typography>{selectedRequest.title || '-'}</Typography>
                            </Grid>

                            <Grid item xs={12}>
                                <Typography variant="subtitle2" color="textSecondary">Motivo de la solicitud</Typography>
                                <Typography>{selectedRequest.description || '-'}</Typography>
                            </Grid>

                            <Grid item xs={12}>
                                <Typography variant="subtitle2" color="textSecondary">Notas adicionales</Typography>
                                <Typography>{selectedRequest.reviewNotes || selectedRequest.notes || '-'}</Typography>
                            </Grid>

                            {selectedRequest.status && selectedRequest.status !== 'pending' && (
                                <>
                                    <Grid item xs={12} sx={{ mt: 1, borderTop: '1px solid #eee', pt: 2 }}>
                                        <Typography variant="subtitle1">Revisión</Typography>
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="textSecondary">Revisado por</Typography>
                                        <Typography>{selectedRequest.reviewer?.name || selectedRequest.reviewedBy || '-'}</Typography>
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="textSecondary">Fecha de revisión</Typography>
                                        <Typography>{formatDate(selectedRequest.reviewedAt)}</Typography>
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" color="textSecondary">Notas de revisión</Typography>
                                        <Typography>{selectedRequest.reviewNotes || '-'}</Typography>
                                    </Grid>
                                </>
                            )}

                            
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
            <Dialog open={statusModalOpen} onClose={() => setStatusModalOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>✎ Cambiar Estado de Solicitud</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1 }}>
                        <TextField
                            select
                            label="Estado"
                            fullWidth
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            sx={{ mb: 2 }}
                        >
                            {Object.keys(REQUEST_STATES).map(s => (
                                <MenuItem key={s} value={s}>{STATUS_LABELS_ES[s] || REQUEST_STATES[s] || s}</MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="Notas"
                            fullWidth
                            multiline
                            rows={4}
                            value={statusNotes}
                            onChange={(e) => setStatusNotes(e.target.value)}
                            placeholder="Notas de revisión (opcional)"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStatusModalOpen(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleConfirmStatusChange}>Guardar</Button>
                </DialogActions>
            </Dialog>
        </PageContainer>
    );
};

export default RequestsPage;
