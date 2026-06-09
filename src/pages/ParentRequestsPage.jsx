// src/pages/ParentRequestsPage.jsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  RefreshControl,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  ArrowBack as ArrowBackIcon,
  ChevronRight as ChevronRightIcon,
  AccessTime as AccessTimeIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  DirectionsBus as DirectionsBusIcon,
  Create as CreateIcon,
} from '@mui/icons-material';
import { styled } from 'twin.macro';
import moment from 'moment-timezone';
import ParentNavbar from '../components/ParentNavbar';
import { AuthContext } from '../context/AuthProvider';
import { getMyRequests, getRequestById, getRequestEvents, REQUEST_TYPE_META } from '../services/requestService';

const PageShell = styled(Box)`
  width: 100%;
`;

const LoaderBox = styled(Box)`
  display: flex;
  min-height: 280px;
  align-items: center;
  justify-content: center;
`;

const SectionCard = styled(Card)`
  width: 100%;
  border-radius: 14px;
`;

const PRIMARY = '#1B6FD1';
const SECONDARY = '#FF6B35';

const getStatusMeta = (status) => {
  const value = String(status || '').toLowerCase();
  const meta = {
    pending: { label: 'Pendiente', color: '#FB8C00' },
    in_review: { label: 'En revisión', color: '#42A5F5' },
    approved: { label: 'Completada', color: '#4CAF50' },
    rejected: { label: 'Rechazada', color: '#E53935' },
    completed: { label: 'Completada', color: '#388E3C' },
    cancelled: { label: 'Cancelada', color: '#9C27B0' },
  };
  return meta[value] || { label: value || 'N/A', color: '#757575' };
};

const getRequestTypeLabel = (type) => REQUEST_TYPE_META[String(type || '').toLowerCase()]?.label || String(type || 'N/A');

const REQUEST_TYPE_ICON_MAP = {
  service_cancellation: CancelIcon,
  schedule_change: ScheduleIcon,
  route_change: DirectionsBusIcon,
  other: CreateIcon,
};

const formatDate = (date) => (date ? moment(date).tz('America/Guatemala').format('DD/MM/YYYY hh:mm A') : '-');

const getRequestTypeChip = (type) => {
  const normalizedType = String(type || '').toLowerCase();
  const meta = REQUEST_TYPE_META[normalizedType] || REQUEST_TYPE_META.other;
  const IconComponent = REQUEST_TYPE_ICON_MAP[normalizedType] || CreateIcon;

  return (
    <Chip
      icon={<IconComponent sx={{ color: '#fff !important', fontSize: 18 }} />}
      label={meta.label || String(type || 'N/A')}
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

const normalizeStatus = (status) => {
  const value = String(status || '').toLowerCase().trim();
  const map = {
    pending: 'pending',
    pendiente: 'pending',
    in_review: 'in_review',
    'in review': 'in_review',
    en_revision: 'in_review',
    'en revision': 'in_review',
    'en revisión': 'in_review',
    approved: 'approved',
    aprobado: 'approved',
    aprobada: 'approved',
    rejected: 'rejected',
    rechazado: 'rejected',
    rechazada: 'rejected',
    completed: 'completed',
    completado: 'completed',
    completada: 'completed',
    cancelled: 'cancelled',
    cancelado: 'cancelled',
    cancelada: 'cancelled',
  };

  return map[value] || value;
};

const getStatusLabelEs = (status) => {
  const normalized = normalizeStatus(status);
  const labels = {
    pending: 'Pendiente',
    in_review: 'En revisión',
    approved: 'Completada',
    rejected: 'Rechazada',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };

  return labels[normalized] || 'Estado actualizado';
};

// Try to extract a status value from a variety of metadata shapes
const extractStatusFromMetadata = (meta) => {
  if (!meta) return null;
  const direct = meta?.status || meta?.newStatus || meta?.statusCode || meta?.to || meta?.new_status || meta?.new_status_code;
  if (direct) return direct;

  if (meta.change && (meta.change.to || meta.change.new)) return meta.change.to || meta.change.new;
  if (meta.changes?.status && (meta.changes.status.to || meta.changes.status.new)) return meta.changes.status.to || meta.changes.status.new;
  if (meta.details && (meta.details.status || meta.details.newStatus)) return meta.details.status || meta.details.newStatus;

  const candidates = [];
  const scan = (obj, depth = 0) => {
    if (!obj || depth > 3) return;
    if (typeof obj === 'string' || typeof obj === 'number') {
      candidates.push(String(obj));
      return;
    }
    if (Array.isArray(obj)) {
      for (const v of obj) scan(v, depth + 1);
      return;
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string' || typeof v === 'number') candidates.push(String(v));
        else if (typeof v === 'object') scan(v, depth + 1);
      }
    }
  };

  scan(meta, 0);
  if (candidates.length === 0) return null;

  const join = candidates.join(' ').toLowerCase();
  const keywords = ['pending','pendiente','in_review','in review','en revisi','approved','aprob','rejected','rechaz','completed','completad','cancelled','cancelad'];
  for (const kw of keywords) {
    if (join.includes(kw)) return kw;
  }

  return candidates[0] || null;
};

const normalizeEventStatus = (s) => {
  if (!s) return null;
  const low = String(s).toLowerCase().trim();
  const map = {
    pending: 'pending',
    pendiente: 'pending',
    in_review: 'in_review',
    'in review': 'in_review',
    en_revision: 'in_review',
    'en revision': 'in_review',
    'en revisión': 'in_review',
    approved: 'completed',
    aprobado: 'completed',
    aprobada: 'completed',
    aprob: 'completed',
    rejected: 'rejected',
    rechazado: 'rejected',
    rechazada: 'rejected',
    completed: 'completed',
    completado: 'completed',
    completada: 'completed',
    cancelado: 'cancelled',
    cancelled: 'cancelled',
    cancelada: 'cancelled',
  };
  if (map[low]) return map[low];
  if (['pending','in_review','approved','rejected','completed','cancelled'].includes(low)) return low;
  return null;
};

const getEventActionLabel = (action) => {
  const normalized = String(action || '').toLowerCase();
  if (normalized === 'created') return 'Creación';
  if (normalized === 'status_updated') return 'Estado actualizado';
  if (normalized === 'cancelled') return 'Solicitud cancelada';
  if (normalized === 'assigned') return 'Solicitud asignada';
  if (normalized === 'completed') return 'Solicitud completada';
  if (normalized === 'commented') return 'Comentario agregado';
  return 'Actualización';
};

const getEventTitle = (event) => {
  const action = String(event?.action || '').toLowerCase();
  if (action === 'status_updated') return 'Estado actualizado';

  return getEventActionLabel(event?.action);
};

const getEventDetailText = (event, selectedRequest) => {
  const action = String(event?.action || '').toLowerCase();
  const meta = event?.metadata || {};
  const notesTextRaw = event?.notes || meta?.note || '';
  const notes = String(notesTextRaw || '').trim();

  let mainText = null;

  if (action === 'created') {
    const requestType = meta?.requestType || selectedRequest?.requestType;
    mainText = `Tipo: ${getRequestTypeLabel(requestType)}`;
  } else if (action === 'status_updated') {
    const rawFromMeta = extractStatusFromMetadata(meta) || meta?.status || meta?.newStatus || meta?.statusCode;

    let resolved = normalizeEventStatus(rawFromMeta);
    if (!resolved) {
      const notesLower = notes.toLowerCase();
      if (/pending|pendiente/.test(notesLower)) resolved = 'pending';
      else if (/in[_ ]?review|en\s*revisi[oó]n|en\s*revision/.test(notesLower)) resolved = 'in_review';
      else if (/approved|aproba/.test(notesLower)) resolved = 'completed';
      else if (/rejected|rechazad/.test(notesLower)) resolved = 'rejected';
      else if (/completed|completad/.test(notesLower)) resolved = 'completed';
      else if (/cancelled|cancelad/.test(notesLower)) resolved = 'cancelled';
    }

    mainText = resolved ? `Estado actualizado: ${getStatusLabelEs(resolved)}` : 'Estado actualizado';
  } else if (action === 'cancelled') {
    mainText = 'La solicitud fue cancelada';
  } else {
    if (notes) return String(notes);
    mainText = 'Actualización registrada';
  }

  if (!notes) return mainText;

  return (
    <>
      {mainText}
      <br />
      {`Nota: ${notes}`}
    </>
  );
};

const ParentRequestsPage = () => {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestEvents, setRequestEvents] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[ParentRequestsPage] Error cargando solicitudes:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }, [loadRequests]);

  const openDetail = async (request) => {
    try {
      const detail = await getRequestById(request.id);
      const events = await getRequestEvents(request.id);
      setSelectedRequest(detail);
      setRequestEvents(events || []);
      setDetailOpen(true);
    } catch (error) {
      console.error('[ParentRequestsPage] Error abriendo detalle:', error);
    }
  };

  const requestCards = useMemo(() => requests, [requests]);

  return (
    <PageShell>
      <ParentNavbar />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/parent/dashboard')}
            sx={{ mb: 2 }}
          >
            Volver al panel
          </Button>

          <SectionCard elevation={3}>
            <CardContent>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'flex-start' : 'center'} justifyContent="space-between">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: PRIMARY }}>
                    <DescriptionIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Mis Solicitudes
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Revisa el estado de tus solicitudes y su historial.
                    </Typography>
                  </Box>
                </Box>

                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={onRefresh}
                >
                  Actualizar
                </Button>
              </Stack>
            </CardContent>
          </SectionCard>
        </Box>

        {loading ? (
          <LoaderBox>
            <CircularProgress />
          </LoaderBox>
        ) : (
          <Paper elevation={0} sx={{ p: { xs: 0, sm: 0 }, background: 'transparent' }}>
            <Box sx={{ display: 'grid', gap: 2 }}>
              {requestCards.length === 0 ? (
                <SectionCard elevation={2}>
                  <CardContent>
                    <Alert severity="info">Aún no tienes solicitudes registradas.</Alert>
                  </CardContent>
                </SectionCard>
              ) : (
                requestCards.map((request) => {
                  const status = getStatusMeta(request.status);
                  const typeLabel = getRequestTypeLabel(request.requestType);
                  return (
                    <SectionCard key={request.id} elevation={2} sx={{ cursor: 'pointer' }} onClick={() => openDetail(request)}>
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Avatar sx={{ bgcolor: SECONDARY, width: 48, height: 48 }}>
                            <DescriptionIcon />
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
                              <Chip label={status.label} size="small" sx={{ bgcolor: status.color, color: '#fff', fontWeight: 700 }} />
                              {getRequestTypeChip(request.requestType)}
                            </Stack>
                            <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }} noWrap>
                              {request.title || 'Solicitud sin título'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                              {formatDate(request.createdAt)}
                            </Typography>
                          </Box>
                          <ChevronRightIcon color="disabled" />
                        </Stack>
                      </CardContent>
                    </SectionCard>
                  );
                })
              )}
            </Box>
          </Paper>
        )}
      </Container>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          {selectedRequest?.title || 'Detalle de solicitud'}
        </DialogTitle>
        <DialogContent dividers>
          {selectedRequest && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#F7FAFF', border: '1px solid #DCE7F5' }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                  <Chip label={getStatusMeta(selectedRequest.status).label} size="small" sx={{ bgcolor: getStatusMeta(selectedRequest.status).color, color: '#fff', fontWeight: 700 }} />
                  {getRequestTypeChip(selectedRequest.requestType)}
                </Stack>
                <Typography variant="body2" color="text.secondary">Fecha de creación</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>{formatDate(selectedRequest.createdAt)}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                  Historial
                </Typography>
                {requestEvents.length === 0 ? (
                  <Alert severity="info">No hay eventos registrados para esta solicitud.</Alert>
                ) : (
                  <Stack spacing={1.25}>
                    {requestEvents.map((event) => (
                      <Box key={event.id} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #E6EDF7', backgroundColor: '#FBFDFF' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {getEventTitle(event)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {getEventDetailText(event, selectedRequest)}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDate(event.createdAt)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default ParentRequestsPage;