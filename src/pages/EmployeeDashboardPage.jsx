// src/pages/EmployeeDashboardPage.jsx
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
  useTheme
} from '@mui/material';
import { styled } from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import ParentNavbar from '../components/ParentNavbar';
import UpdateEmployeeInfoDialog from '../components/UpdateEmployeeInfoDialog';

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

const EmployeeDashboardPage = () => {
  const { auth } = useContext(AuthContext);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open:false, sev:'success', msg:'' });

  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  const [selectedDay, setSelectedDay] = useState('all');

  const loadAll = async () => {
    setLoading(true);
    try {
      const userId = auth?.user?.id;
      if (!userId) throw new Error('Usuario no autenticado');

      const [infoRes, slotsRes] = await Promise.all([
        api.get(`/corporations/employees/${userId}`),
        api.get(`/schedule-slots/employee/${userId}`)
      ]);

      let infoData = infoRes?.data || null;
      // If the response lacks phoneNumber or selectedSchedule, try the fallback endpoint
      const needsFallback = !infoData?.phoneNumber && auth?.user?.email;
      if (needsFallback) {
        try {
          const fb = await api.get(`/update-employee-info`, { params: { email: auth.user.email } });
          // merge phoneNumber and selectedSchedule if present
          if (fb?.data) {
            infoData = { ...infoData, ...fb.data };
          }
        } catch (err) {
          // ignore fallback errors
          console.debug('[EmployeeDashboard] fallback info fetch failed', err?.message || err);
        }
      }

      setEmployeeInfo(infoData);
      setSchedules(Array.isArray(slotsRes?.data) ? slotsRes.data : []);
    } catch (e) {
      console.error('[EmployeeDashboard] loadAll error:', e);
      setEmployeeInfo(null);
      setSchedules([]);
      setSnackbar({ open:true, sev:'error', msg: 'No se pudo cargar información del empleado.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user?.id]);

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
    const corpSchedules = employeeInfo?.corporation?.schedules;
    const sel = employeeInfo?.selectedSchedule ?? employeeInfo?.employeeDetail?.selectedSchedule ?? -1;
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
  }, [employeeInfo, scheduleSummary]);

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
  const initials = (employeeInfo?.name || '').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase() || 'E';

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
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{safeStr(employeeInfo?.name || 'Empleado')}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>{employeeInfo?.role?.name || 'Empleado'}</Typography>
                  {employeeInfo?.corporation && (
                    <Chip size="small" label={employeeInfo.corporation.name} sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }} />
                  )}
                </Box>
              </Box>

              <CardContent>
                <Grid container spacing={1}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Información</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Dirección:</strong> {safeStr(employeeInfo?.employeeDetail?.serviceAddress) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Zona/Sector:</strong> {safeStr(employeeInfo?.employeeDetail?.zoneOrSector) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Teléfono:</strong> {safeStr(
                      employeeInfo?.phoneNumber ||
                      employeeInfo?.phone ||
                      employeeInfo?.user?.phoneNumber ||
                      employeeInfo?.user?.phone ||
                      employeeInfo?.account?.phoneNumber ||
                      employeeInfo?.employeeDetail?.phone
                    ) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Horario:</strong> {safeStr(scheduleText) || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>Tipo ruta:</strong> {safeStr(employeeInfo?.employeeDetail?.routeType) || '—'}</Typography>
                  </Grid>

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Contacto de Emergencia</Typography>
                     <Typography variant="body2">{safeStr(employeeInfo?.employeeDetail?.emergencyContact) ? (<><strong>Nombre:</strong> {safeStr(employeeInfo?.employeeDetail?.emergencyContact)}</>) : ' '}</Typography>
                    <Typography variant="body2">{safeStr(employeeInfo?.employeeDetail?.emergencyPhone) ? (<><strong>Teléfono:</strong> {safeStr(employeeInfo?.employeeDetail?.emergencyPhone)}</>) : ' '}</Typography>
                    <Typography variant="body2">{safeStr(employeeInfo?.employeeDetail?.emergencyRelationship) ? (<><strong>Parentesco:</strong> {safeStr(employeeInfo?.employeeDetail?.emergencyRelationship)}</>) : ' '}</Typography>
                  </Grid>

                  <Grid item xs={12} sx={{ mt: 2, textAlign: 'center' }}>
                    <Button variant="contained" color="primary" size="small" onClick={() => setOpenEditDialog(true)}>Editar mis datos</Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Paper>
          </Grid>

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
      <UpdateEmployeeInfoDialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        initialData={employeeInfo || {}}
        onSaved={() => { setOpenEditDialog(false); loadAll(); setSnackbar({ open:true, sev:'success', msg: 'Datos actualizados correctamente.' }); }}
      />
    </>
  );
};

export default EmployeeDashboardPage;
