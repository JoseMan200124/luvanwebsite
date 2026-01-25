// src/pages/ColaboradorDashboardPage.jsx
import React, { useEffect, useState, useContext, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Divider,
  Snackbar,
  Alert,
  Container,
  Avatar,
  Paper,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip
} from '@mui/material';
import { styled } from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import ParentNavbar from '../components/ParentNavbar';
import UpdateColaboradorInfoDialog from '../components/UpdateColaboradorInfoDialog';

const SectionCard = styled(Card)`width:100%;border-radius:10px;`;
const LoaderBox   = styled(Box)`display:flex;align-items:center;justify-content:center;min-height:320px;`;

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

const toArray = (v) => (Array.isArray(v) ? v : []);
const safeStr  = (v) => (v == null ? '' : String(v)).trim();

const tagSlotsByDay = (slotsForDay) => {
  const sorted = [...slotsForDay].sort((a,b) => (a.time||'').localeCompare(b.time||''));
  if (sorted.length >= 2) {
    const first = { ...sorted[0], _label: 'Entrada' };
    const last  = { ...sorted[sorted.length-1], _label: 'Salida' };
    if (sorted.length === 2) return [first, last];
    const middle = sorted.slice(1,-1).map(x => ({ ...x, _label: 'Parada' }));
    return [first, ...middle, last];
  }
  if (sorted.length === 1) return [{ ...sorted[0], _label: 'Parada' }];
  return [];
};

const ColaboradorDashboardPage = () => {
  const { auth } = useContext(AuthContext);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open:false, sev:'success', msg:'' });

  const [colaboradorInfo, setColaboradorInfo] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Requests (mis solicitudes)
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [openNewRequestDialog, setOpenNewRequestDialog] = useState(false);
  const [newRequestType, setNewRequestType] = useState('service_cancellation');
  const [newReason, setNewReason] = useState('');
  const [newAdditionalNotes, setNewAdditionalNotes] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [openRequestDetail, setOpenRequestDetail] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [openRequestsModal, setOpenRequestsModal] = useState(false);
  const [openCancelConfirm, setOpenCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [selectedDay, setSelectedDay] = useState('all');

  const getRequestTypeLabel = (type) => {
    const labels = {
      service_cancellation: 'Baja del Servicio',
      schedule_change: 'Cambio de Horario',
      route_change: 'Cambio de Ruta',
      payment_adjustment: 'Ajuste de Pago',
      contract_modification: 'Modificación de Contrato',
      student_transfer: 'Transferencia de Estudiante',
      bus_change: 'Cambio de Bus',
      temporary_suspension: 'Suspensión Temporal',
      complaint: 'Queja/Reclamo',
      suggestion: 'Sugerencia',
      other: 'Otro'
    };
    return labels[type] || type;
  };

  const getRequestStatusLabel = (status) => {
    const labels = {
      pending: 'Pendiente',
      in_review: 'En Revisión',
      cancelled: 'Cancelada',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      completed: 'Completada'
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (p) => {
    return p === 'low' ? 'Baja' : p === 'medium' ? 'Media' : p === 'high' ? 'Alta' : 'Urgente';
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return String(d);
    }
  };

  const getRequestStatusColor = (status) => {
    const colors = {
      pending: '#FFA500',
      in_review: '#2196F3',
      cancelled: '#9C27B0',
      approved: '#4CAF50',
      rejected: '#F44336',
      completed: '#9E9E9E'
    };
    return colors[status] || '#9E9E9E';
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const userId = auth?.user?.id;
      if (!userId) throw new Error('Usuario no autenticado');

      const [infoRes, slotsRes] = await Promise.all([
        api.get(`/corporations/colaboradores/${userId}`),
        api.get(`/schedule-slots/colaborador/${userId}`)
      ]);

      let infoData = infoRes?.data || null;
      // If the response lacks phoneNumber or selectedSchedule, try the fallback endpoint
      const needsFallback = !infoData?.phoneNumber && auth?.user?.email;
      if (needsFallback) {
        try {
          const fb = await api.get(`/update-colaborador-info`, { params: { email: auth.user.email } });
          // merge phoneNumber and selectedSchedule if present
          if (fb?.data) {
            infoData = { ...infoData, ...fb.data };
          }
        } catch (err) {
          // ignore fallback errors
          console.debug('[ColaboradorDashboard] fallback info fetch failed', err?.message || err);
        }
      }

      setColaboradorInfo(infoData);
      setSchedules(Array.isArray(slotsRes?.data) ? slotsRes.data : []);
    } catch (e) {
      console.error('[ColaboradorDashboard] loadAll error:', e);
      setColaboradorInfo(null);
      setSchedules([]);
      setSnackbar({ open:true, sev:'error', msg: 'No se pudo cargar información del colaborador.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user?.id]);

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const userId = auth?.user?.id;
      if (!userId) throw new Error('Usuario no autenticado');
      const res = await api.get('/requests/my-requests');
      const data = res?.data?.requests ?? res?.data ?? [];
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ColaboradorDashboard] loadRequests error:', err);
      setRequests([]);
      setSnackbar({ open:true, sev:'error', msg: 'No se pudieron cargar tus solicitudes.' });
    } finally {
      setLoadingRequests(false);
    }
  };

  // Format time strings to 12-hour (e.g., 07:30 -> 7:30 AM). If input looks already formatted, return as-is.
  const formatTime12 = (timeStr) => {
    if (!timeStr) return '';
    const s = String(timeStr).trim();
    // If contains AM/PM already, return
    if (/\b(am|pm)\b/i.test(s)) return s;
    // Try ISO time like HH:mm or HH:mm:ss
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return s;
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${hh}:${mm} ${ampm}`;
  };

  const daysToRender = useMemo(() => {
    if (selectedDay === 'all') return DAYS;
    return DAYS.filter(d => d.key === selectedDay);
  }, [selectedDay]);

  // Build index by day
  const byDay = useMemo(() => {
    const map = {};
    DAYS.forEach(d => map[d.key] = []);
    schedules.forEach(s => {
      const ds = toArray(s.days).map(x => String(x||'').toLowerCase());
      DAYS.forEach(({ key }) => { if (ds.includes(key)) map[key].push(s); });
    });
    Object.keys(map).forEach(k => { map[k] = tagSlotsByDay(map[k]); });
    return map;
  }, [schedules]);

  // Compute a compact schedule summary (first Entrada - last Salida)
  const scheduleSummary = useMemo(() => {
    const entries = [];
    const exits = [];
    Object.values(byDay).forEach(arr => arr.forEach(slot => {
      if (!slot || !slot._label) return;
      const t = slot.time || '';
      if (slot._label === 'Entrada' && t) entries.push(t);
      if (slot._label === 'Salida' && t) exits.push(t);
    }));
    const sortTimes = arr => arr.slice().sort((a,b) => a.localeCompare(b));
    const first = entries.length ? sortTimes(entries)[0] : null;
    const last  = exits.length ? sortTimes(exits).slice(-1)[0] : null;
    if (first || last) return `${first || '--'} - ${last || '--'}`;
    return null;
  }, [byDay]);

  // Prefer corporation schedule (selectedSchedule index) when available
  const scheduleText = useMemo(() => {
    const corpSchedules = colaboradorInfo?.corporation?.schedules;
    const sel = colaboradorInfo?.selectedSchedule ?? colaboradorInfo?.colaboradorDetail?.selectedSchedule ?? -1;
    if (Array.isArray(corpSchedules) && sel != null && Number(sel) >= 0 && Number(sel) < corpSchedules.length) {
      const s = corpSchedules[Number(sel)];
      // prefer readable name, else try to show time range if provided
      // If start and end separate fields exist, prefer them
      const startTime = s.startTime || s.entryTime || s.entrada || s.start || null;
      const endTime = s.endTime || s.exitTime || s.salida || s.end || null;
      if (s.name && (startTime || endTime)) {
        const fmtStart = startTime ? formatTime12(String(startTime)) : '--';
        const fmtEnd = endTime ? formatTime12(String(endTime)) : '--';
        return `${s.name} — ${fmtStart} - ${fmtEnd}`;
      }
      if (s.name) return s.name;
      if (startTime || endTime) return `${startTime || '--'} - ${endTime || '--'}`;
      if (s.timeRange) return s.timeRange;
      return JSON.stringify(s).slice(0, 80);
    }
    // fallback to computed summary from stops
    return scheduleSummary;
  }, [colaboradorInfo, scheduleSummary]);

  if (loading) {
    return (
      <>
        <ParentNavbar />
        <LoaderBox>
          <CircularProgress />
        </LoaderBox>
      </>
    );
  }

  // Helper: initials for avatar
  const initials = (colaboradorInfo?.name || '').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase() || 'C';

  return (
    <>
      <ParentNavbar />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, color: '#fff' }}>
                <Avatar sx={{ width: 72, height: 72, bgcolor: theme.palette.secondary.main }}>{initials}</Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{safeStr(colaboradorInfo?.name || 'Colaborador')}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>{colaboradorInfo?.role?.name || 'Colaborador'}</Typography>
                  {colaboradorInfo?.corporation && (
                    <Chip size="small" label={colaboradorInfo.corporation.name} sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }} />
                  )}
                </Box>
              </Box>

              <CardContent>
                <Grid container spacing={1}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Información</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Dirección:</strong> {safeStr(colaboradorInfo?.colaboradorDetail?.serviceAddress) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Zona/Sector:</strong> {safeStr(colaboradorInfo?.colaboradorDetail?.zoneOrSector) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Teléfono:</strong> {safeStr(
                      colaboradorInfo?.phoneNumber ||
                      colaboradorInfo?.phone ||
                      colaboradorInfo?.user?.phoneNumber ||
                      colaboradorInfo?.user?.phone ||
                      colaboradorInfo?.account?.phoneNumber ||
                      colaboradorInfo?.colaboradorDetail?.phone
                    ) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Número de empleado:</strong> {safeStr(colaboradorInfo?.colaboradorDetail?.employeeNumber) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Horario:</strong> {safeStr(scheduleText) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Tipo ruta:</strong> {safeStr(colaboradorInfo?.colaboradorDetail?.routeType) || '—'}</Typography>
                  </Grid>

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Contacto de Emergencia</Typography>
                     <Typography variant="body2">{safeStr(colaboradorInfo?.colaboradorDetail?.emergencyContact) ? (<><strong>Nombre:</strong> {safeStr(colaboradorInfo?.colaboradorDetail?.emergencyContact)}</>) : ' '}</Typography>
                    <Typography variant="body2">{safeStr(colaboradorInfo?.colaboradorDetail?.emergencyPhone) ? (<><strong>Teléfono:</strong> {safeStr(colaboradorInfo?.colaboradorDetail?.emergencyPhone)}</>) : ' '}</Typography>
                    <Typography variant="body2">{safeStr(colaboradorInfo?.colaboradorDetail?.emergencyRelationship) ? (<><strong>Parentesco:</strong> {safeStr(colaboradorInfo?.colaboradorDetail?.emergencyRelationship)}</>) : ' '}</Typography>
                  </Grid>

                  <Grid item xs={12} sx={{ mt: 2, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                      <Button variant="contained" color="primary" size="small" onClick={() => setOpenEditDialog(true)}>Editar mis datos</Button>
                      <Button variant="outlined" size="small" onClick={async () => { await loadRequests(); setOpenRequestsModal(true); }}>Mis Solicitudes</Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Paper>
          </Grid>
          
          {/* Mis Solicitudes ahora en modal (abrir desde botón en la izquierda) */}

          <Grid item xs={12} md={8}>
            <SectionCard elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="h6">Horarios y Paradas</Typography>
                  </Box>
                  <ToggleButtonGroup exclusive value={selectedDay} onChange={(_, v) => v && setSelectedDay(v)} size="small">
                    <ToggleButton value="all">Semana</ToggleButton>
                    {DAYS.map(d => <ToggleButton key={d.key} value={d.key}>{d.label}</ToggleButton>)}
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
                  {daysToRender.map(({ key, label }) => {
                    const items = byDay[key] || [];
                    return (
                      <Paper key={key} sx={{ minWidth: 220, p: 1, borderRadius: 2 }} elevation={0}>
                        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>{label}</Typography>

                        {items.length === 0 ? (
                          <Box sx={{ p: 1 }}>
                            <Typography variant="body2" color="text.secondary">Sin paradas</Typography>
                          </Box>
                        ) : (
                          items.map((slot, i) => (
                            <Paper key={`${key}-${i}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, mb: 1 }} elevation={1}>
                              <Box sx={{ width: 78, textAlign: 'center' }}>
                                <Chip label={slot._label || 'Parada'} size="small" color={slot._label === 'Entrada' ? 'success' : slot._label === 'Salida' ? 'error' : 'default'} />
                                <Typography variant="h6" sx={{ mt: 0.5 }}>{formatTime12(slot.time) || safeStr(slot.time)}</Typography>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                {safeStr(slot.routeNumber) && <Typography variant="body2"><strong>Ruta:</strong> {slot.routeNumber}</Typography>}
                                {safeStr(slot.note) && <Typography variant="body2"><strong>Punto:</strong> {slot.note}</Typography>}
                              </Box>
                            </Paper>
                          ))
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              </CardContent>
            </SectionCard>
          </Grid>
        </Grid>
      </Container>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open:false })} anchorOrigin={{ vertical:'bottom', horizontal:'center' }}>
        <Alert severity={snackbar.sev} onClose={() => setSnackbar({ ...snackbar, open:false })} sx={{ width: '100%' }}>{snackbar.msg}</Alert>
      </Snackbar>
      <UpdateColaboradorInfoDialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        initialData={colaboradorInfo || {}}
        onSaved={() => { setOpenEditDialog(false); loadAll(); setSnackbar({ open:true, sev:'success', msg: 'Datos actualizados correctamente.' }); }}
      />

      {/* Dialog: Mis Solicitudes (lista + acciones) */}
      <Dialog open={openRequestsModal} onClose={() => setOpenRequestsModal(false)} fullWidth maxWidth="md">
        <DialogTitle>Mis Solicitudes</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1">Tus solicitudes recientes</Typography>
            <Box>
              <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => loadRequests()}>Actualizar</Button>
              <Button variant="contained" size="small" onClick={() => setOpenNewRequestDialog(true)}>Nueva Solicitud</Button>
            </Box>
          </Box>

          {loadingRequests ? (
            <LoaderBox><CircularProgress size={28} /></LoaderBox>
          ) : (
            <List>
              {requests.length === 0 ? (
                <ListItem><ListItemText primary="No tienes solicitudes" secondary="Crea una nueva para comenzar" /></ListItem>
              ) : (
                requests.map((r) => (
                  <ListItem key={r.id} button onClick={async () => {
                    try {
                      const res = await api.get(`/requests/${r.id}`);
                      setSelectedRequest(res.data);
                      setOpenRequestDetail(true);
                    } catch (err) {
                      console.error('Error fetching request detail', err);
                    }
                  }}>
                    <ListItemText
                      primary={r.title}
                      secondary={`${getRequestTypeLabel(r.requestType)} — ${formatDate(r.createdAt)}`}
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title={getRequestStatusLabel(r.status)}>
                        <Chip
                          label={getRequestStatusLabel(r.status)}
                          size="small"
                          sx={{ backgroundColor: getRequestStatusColor(r.status), color: '#fff', fontWeight: 700 }}
                        />
                      </Tooltip>
                      <Button size="small" onClick={async (e) => {
                        e.stopPropagation();
                        try { const res = await api.get(`/requests/${r.id}`); setSelectedRequest(res.data); setOpenRequestDetail(true); } catch (err) { console.error(err); }
                      }} sx={{ ml: 1 }}>Ver detalles</Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequestsModal(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Nueva Solicitud */}
      <Dialog open={openNewRequestDialog} onClose={() => setOpenNewRequestDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva Solicitud</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="req-type-label">Tipo de solicitud</InputLabel>
            <Select labelId="req-type-label" value={newRequestType} label="Tipo de solicitud" onChange={(e) => setNewRequestType(e.target.value)}>
              <MenuItem value="service_cancellation">Baja del Servicio</MenuItem>
            </Select>
          </FormControl>

          {/* Solo formulario de Baja del Servicio */}
          <TextField label="Motivo de la baja" fullWidth multiline minRows={3} value={newReason} onChange={(e) => setNewReason(e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Notas adicionales (opcional)" fullWidth multiline minRows={2} value={newAdditionalNotes} onChange={(e) => setNewAdditionalNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewRequestDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={async () => {
            try {
              if (!newReason.trim()) { setSnackbar({ open:true, sev:'error', msg:'El motivo es requerido.' }); return; }
              await api.post('/requests/service-cancellation', { reason: newReason.trim(), additionalNotes: newAdditionalNotes.trim() || undefined });

              setOpenNewRequestDialog(false);
              setNewReason(''); setNewAdditionalNotes('');
              setSnackbar({ open:true, sev:'success', msg:'Solicitud de baja enviada correctamente.' });
              loadRequests();
              setOpenRequestsModal(true);
            } catch (err) {
              console.error('Error creating request', err);
              const msg = err?.response?.data?.message || 'No se pudo crear la solicitud.';
              setSnackbar({ open:true, sev:'error', msg });
            }
          }}>Enviar solicitud</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Detalle de Solicitud */}
      <Dialog open={openRequestDetail} onClose={() => { setOpenRequestDetail(false); setSelectedRequest(null); }} fullWidth maxWidth="sm">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">{selectedRequest?.title || 'Solicitud'}</Typography>
              <Typography variant="caption" color="text.secondary">{getRequestTypeLabel(selectedRequest?.requestType)} • {formatDate(selectedRequest?.createdAt)}</Typography>
            </Box>
            <Chip label={getRequestStatusLabel(selectedRequest?.status)} sx={{ backgroundColor: getRequestStatusColor(selectedRequest?.status), color: '#fff', fontWeight: 700 }} />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedRequest ? (
            <Box sx={{ mt: 1 }}>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Información General</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Tipo:</strong> {getRequestTypeLabel(selectedRequest.requestType)}</Typography></Grid>
                  <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Fecha:</strong> {formatDate(selectedRequest.createdAt)}</Typography></Grid>
                  {selectedRequest.priority && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Prioridad:</strong> {getPriorityLabel(selectedRequest.priority)}</Typography></Grid>}
                  {selectedRequest.relatedEntityType && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Relacionado a:</strong> {selectedRequest.relatedEntityType}</Typography></Grid>}
                </Grid>
              </Paper>

              {selectedRequest.description && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Descripción</Typography>
                  <Typography variant="body2">{selectedRequest.description}</Typography>
                </Paper>
              )}

              {selectedRequest.reason && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Motivo</Typography>
                  <Typography variant="body2">{selectedRequest.reason}</Typography>
                </Paper>
              )}

              {(selectedRequest.reviewedAt || selectedRequest.reviewNotes || selectedRequest.reviewer) && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Información de Revisión</Typography>
                  {selectedRequest.reviewer && <Typography variant="body2"><strong>Revisado por:</strong> {selectedRequest.reviewer?.name || selectedRequest.reviewer?.email}</Typography>}
                  {selectedRequest.reviewedAt && <Typography variant="body2"><strong>Fecha de revisión:</strong> {formatDate(selectedRequest.reviewedAt)}</Typography>}
                  {selectedRequest.reviewNotes && <Typography variant="body2" sx={{ mt: 1 }}><strong>Notas del revisor:</strong> {selectedRequest.reviewNotes}</Typography>}
                </Paper>
              )}
            </Box>
          ) : (
            <LoaderBox><CircularProgress size={28} /></LoaderBox>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenRequestDetail(false); setSelectedRequest(null); }}>Cerrar</Button>
          {selectedRequest && selectedRequest.status === 'pending' && (
            <>
              <Button color="error" variant="contained" onClick={() => setOpenCancelConfirm(true)}>Cancelar solicitud</Button>

              <Dialog open={openCancelConfirm} onClose={() => setOpenCancelConfirm(false)}>
                <DialogTitle>Confirmar cancelación</DialogTitle>
                <DialogContent>
                  <Typography>¿Estás seguro que quieres cancelar la solicitud "{selectedRequest?.title}"?</Typography>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setOpenCancelConfirm(false)}>Volver</Button>
                  <Button color="error" variant="contained" onClick={async () => {
                    if (!selectedRequest) return;
                    try {
                      setCanceling(true);
                      await api.post(`/requests/${selectedRequest.id}/cancel`);
                      setOpenCancelConfirm(false);
                      setOpenRequestDetail(false);
                      setSelectedRequest(null);
                      setSnackbar({ open:true, sev:'success', msg:'Solicitud cancelada.' });
                      await loadRequests();
                    } catch (err) {
                      console.error('Error cancelling request', err);
                      setSnackbar({ open:true, sev:'error', msg: err?.response?.data?.message || 'No se pudo cancelar la solicitud.' });
                    } finally {
                      setCanceling(false);
                    }
                  }} disabled={canceling}>{canceling ? 'Cancelando...' : 'Confirmar'}</Button>
                </DialogActions>
              </Dialog>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ColaboradorDashboardPage;
