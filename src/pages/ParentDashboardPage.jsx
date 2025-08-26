// src/pages/ParentDashboardPage.jsx
import React, { useEffect, useMemo, useState, useContext } from 'react';
import {
  Box as MuiBox,
  Card,
  CardContent,
  Typography,
  Divider,
  Button,
  CircularProgress,
  Grid,
  Snackbar,
  Alert,
  Container,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import { styled } from 'twin.macro';
import ParentNavbar from '../components/ParentNavbar';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

// ---------- Estilos ----------
const SectionCard = styled(Card)`width:100%;border-radius:10px;`;
const LoaderBox   = styled(MuiBox)`display:flex;align-items:center;justify-content:center;min-height:320px;`;
const DayCol      = styled(MuiBox)`min-width:190px;`;

// ---------- Utilidades ----------
const toArray = (v) => (Array.isArray(v) ? v : []);
const nonEmpty = (v) => (typeof v === 'number' ? true : !!(v && String(v).trim().length));
const safeStr  = (v) => (v == null ? '' : String(v)).trim();

// Orden fijo y etiquetas
const DAYS = [
  { key: 'monday',    label: 'Lunes' },
  { key: 'tuesday',   label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday',  label: 'Jueves' },
  { key: 'friday',    label: 'Viernes' },
];

// "06:02" -> 362
const timeToMinutes = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return Number.POSITIVE_INFINITY;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

// Normaliza lo que devuelve /parents/:id/route-info (si existe)
const normalizeParentInfo = (raw) => {
  const data = raw && typeof raw === 'object' ? raw : {};

  // students puede venir como array de strings u objetos
  let students = [];
  if (Array.isArray(data.students)) {
    students = data.students.map((s) => {
      if (s && typeof s === 'object') {
        return {
          id: s.id ?? null,
          fullName: safeStr(s.fullName || s.name || ''),
          grade: safeStr(s.grade || ''),
        };
      }
      return { id: null, fullName: safeStr(s), grade: '' };
    });
  }

  // routes (si el endpoint ya las trae)
  const routes = Array.isArray(data.routes)
    ? data.routes.map((r) => ({
        routeNumber: safeStr(r?.routeNumber || ''),
        stopPoint:   safeStr(r?.stopPoint || ''),
        monitoraName: safeStr(r?.monitoraName || ''),
        monitoraContact: safeStr(r?.monitoraContact || ''),
        schedules: toArray(r?.schedules || (r?.schedule ? [r.schedule] : []))
          .map(safeStr)
          .filter(Boolean),
      }))
    : [];

  return {
    // Familia
    familyLastName: safeStr(data.familyLastName),
    serviceAddress: safeStr(data.serviceAddress),
    zoneOrSector:   safeStr(data.zoneOrSector),
    routeType:      safeStr(data.routeType),

    // Colegio / banco
    schoolName: safeStr(data.schoolName),
    bankName:   safeStr(data.bankName),
    bankAccount: safeStr(data.bankAccount),

    // Emergencias
    emergencyContact:  safeStr(data.emergencyContact),
    emergencyRelation: safeStr(data.emergencyRelation),
    emergencyPhone:    safeStr(data.emergencyPhone),

    // Listas base
    students,
    routes,
  };
};

// Construye un índice { studentId -> slots[] } con GET /students/:id/scheduleSlots
const fetchSlotsByStudentIds = async (ids) => {
  const results = {};
  await Promise.all(
    ids.map(async (sid) => {
      try {
        const res = await api.get(`/students/${sid}/scheduleSlots`);
        const slots = toArray(res?.data?.slots).map((s) => {
          const days = s?.days;
          let daysArr = [];
          if (Array.isArray(days)) daysArr = days;
          else if (typeof days === 'string') {
            try { daysArr = JSON.parse(days) || []; } catch { daysArr = []; }
          }
          return {
            id: s?.id ?? null,
            time: safeStr(s?.time),
            note: safeStr(s?.note),
            schoolSchedule: safeStr(s?.schoolSchedule),
            days: daysArr,
            bus: s?.bus || null, // incluye Bus (con routeNumber, plate, etc.) si viene
          };
        });
        results[sid] = slots;
      } catch (e) {
        // Si falla, deja vacío para ese estudiante
        results[sid] = [];
      }
    })
  );
  return results;
};

// Deduce etiqueta (Entrada/Salida) por día usando la heurística de hora
const tagSlotsByDay = (slotsForDay) => {
  const sorted = [...slotsForDay].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  if (sorted.length >= 2) {
    const first = { ...sorted[0], _label: 'Entrada' };
    const last  = { ...sorted[sorted.length - 1], _label: 'Salida' };
    if (sorted.length === 2) return [first, last];
    // Si hay más de 2, etiqueta inicio y fin; los intermedios como "Parada"
    const middle = sorted.slice(1, -1).map((x) => ({ ...x, _label: 'Parada' }));
    return [first, ...middle, last];
  }
  if (sorted.length === 1) return [{ ...sorted[0], _label: 'Parada' }];
  return [];
};

// ---------- Componente ----------
const ParentDashboardPage = () => {
  const { auth } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, sev: 'success', msg: '' });

  const [parentInfo, setParentInfo] = useState(() => normalizeParentInfo({}));
  const [slotsByStudent, setSlotsByStudent] = useState({}); // { [studentId]: Slot[] }

  // Llama /parents/:id/route-info y, si hay estudiantes con id, trae sus slots
  const loadAll = async () => {
    setLoading(true);
    try {
      const userId = auth?.user?.id;
      if (!userId) {
        setParentInfo(normalizeParentInfo({}));
        setSlotsByStudent({});
        setSnackbar({ open: true, sev: 'warning', msg: 'Sesión no encontrada. Inicia sesión nuevamente.' });
        return;
      }

      // 1) Resumen de padre/familia
      const res = await api.get(`/parents/${userId}/route-info`);
      const info = normalizeParentInfo(res?.data?.data);
      setParentInfo(info);

      // 2) Si tengo ids de estudiantes, cargo sus scheduleSlots (accesible a "Padre")
      const studentIds = info.students.map((s) => s.id).filter(Boolean);
      if (studentIds.length > 0) {
        const byId = await fetchSlotsByStudentIds(studentIds);
        setSlotsByStudent(byId);
      } else {
        setSlotsByStudent({});
      }
    } catch (e) {
      console.error('[ParentDashboard] loadAll error:', e);
      setParentInfo(normalizeParentInfo({}));
      setSlotsByStudent({});
      setSnackbar({ open: true, sev: 'error', msg: 'No se pudo cargar la información.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user?.id]);

  // ---------- Derivados (listas para mostrar) ----------

  // Rutas construidas a partir de:
  //   a) parentInfo.routes (si el endpoint ya te lo da)
  //   b) y además, cualquier bus encontrado en los scheduleSlots por alumno
  const derivedRoutes = useMemo(() => {
    const fromInfo = toArray(parentInfo.routes)
      .filter((r) => nonEmpty(r.routeNumber) || nonEmpty(r.stopPoint) || (r.schedules?.length))
      .map((r) => ({
        routeNumber: r.routeNumber || '',
        stopPoint: r.stopPoint || '',
        schedules: toArray(r.schedules),
        monitoraName: r.monitoraName || '',
        monitoraContact: r.monitoraContact || '',
      }));

    const fromSlots = [];
    Object.values(slotsByStudent).forEach((slots) => {
      toArray(slots).forEach((s) => {
        const bus = s?.bus;
        if (!bus) return;
        fromSlots.push({
          routeNumber: safeStr(bus?.routeNumber || ''),
          stopPoint: '', // se podría mapear si lo guardas como note o extra
          schedules: s?.schoolSchedule ? [safeStr(s.schoolSchedule)] : [],
          monitoraName: '', // solo si el include del backend trae monitora asociada
          monitoraContact: '',
        });
      });
    });

    // Unir por routeNumber + schedules (simple)
    const keyOf = (r) => `${r.routeNumber}|${r.stopPoint}|${(r.schedules || []).join(',')}`;
    const map = new Map();
    [...fromInfo, ...fromSlots].forEach((r) => {
      if (!nonEmpty(r.routeNumber) && !nonEmpty(r.stopPoint) && (!r.schedules || r.schedules.length === 0)) return;
      const k = keyOf(r);
      if (!map.has(k)) map.set(k, { ...r });
    });
    return [...map.values()];
  }, [parentInfo.routes, slotsByStudent]);

  // ---------- Render ----------
  if (loading) {
    return (
      <>
        <ParentNavbar />
        <LoaderBox><CircularProgress /></LoaderBox>
      </>
    );
  }

  return (
    <>
      <ParentNavbar />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={3}>

          {/* ---------------- Perfil familiar ---------------- */}
          <Grid item xs={12} md={6}>
            <SectionCard elevation={3}>
              <CardContent>
                <Typography variant="h5" gutterBottom>Perfil Familiar</Typography>

                <Grid container columnSpacing={2} rowSpacing={1}>
                  {nonEmpty(parentInfo.familyLastName) && (
                    <>
                      <Grid item xs={6}><b>Apellidos familia:</b></Grid>
                      <Grid item xs={6}>{parentInfo.familyLastName}</Grid>
                    </>
                  )}

                  {nonEmpty(parentInfo.serviceAddress) && (
                    <>
                      <Grid item xs={6}><b>Dirección servicio:</b></Grid>
                      <Grid item xs={6}>{parentInfo.serviceAddress}</Grid>
                    </>
                  )}

                  {nonEmpty(parentInfo.zoneOrSector) && (
                    <>
                      <Grid item xs={6}><b>Zona/Sector:</b></Grid>
                      <Grid item xs={6}>{parentInfo.zoneOrSector}</Grid>
                    </>
                  )}

                  {nonEmpty(parentInfo.routeType) && (
                    <>
                      <Grid item xs={6}><b>Tipo ruta:</b></Grid>
                      <Grid item xs={6}>{parentInfo.routeType}</Grid>
                    </>
                  )}
                </Grid>
              </CardContent>
            </SectionCard>
          </Grid>

          {/* ---------------- Colegio & Pago ---------------- */}
          <Grid item xs={12} md={6}>
            <SectionCard elevation={3}>
              <CardContent>
                <Typography variant="h5" gutterBottom>Colegio & Pago</Typography>

                <Grid container columnSpacing={2} rowSpacing={1}>
                  {nonEmpty(parentInfo.schoolName) && (
                    <>
                      <Grid item xs={6}><b>Colegio:</b></Grid>
                      <Grid item xs={6}>{parentInfo.schoolName}</Grid>
                    </>
                  )}

                  {nonEmpty(parentInfo.bankName) && (
                    <>
                      <Grid item xs={6}><b>Banco:</b></Grid>
                      <Grid item xs={6}>{parentInfo.bankName}</Grid>
                    </>
                  )}

                  {nonEmpty(parentInfo.bankAccount) && (
                    <>
                      <Grid item xs={6}><b>Cuenta:</b></Grid>
                      <Grid item xs={6}>{parentInfo.bankAccount}</Grid>
                    </>
                  )}
                </Grid>

                {(nonEmpty(parentInfo.emergencyContact) ||
                  nonEmpty(parentInfo.emergencyRelation) ||
                  nonEmpty(parentInfo.emergencyPhone)) && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>Contacto de Emergencia</Typography>
                    <Grid container columnSpacing={2} rowSpacing={1}>
                      {nonEmpty(parentInfo.emergencyContact) && (
                        <>
                          <Grid item xs={6}><b>Nombre:</b></Grid>
                          <Grid item xs={6}>{parentInfo.emergencyContact}</Grid>
                        </>
                      )}
                      {nonEmpty(parentInfo.emergencyRelation) && (
                        <>
                          <Grid item xs={6}><b>Parentesco:</b></Grid>
                          <Grid item xs={6}>{parentInfo.emergencyRelation}</Grid>
                        </>
                      )}
                      {nonEmpty(parentInfo.emergencyPhone) && (
                        <>
                          <Grid item xs={6}><b>Teléfono:</b></Grid>
                          <Grid item xs={6}>{parentInfo.emergencyPhone}</Grid>
                        </>
                      )}
                    </Grid>
                  </>
                )}
              </CardContent>
            </SectionCard>
          </Grid>

          {/* ---------------- Estudiantes ---------------- */}
          <Grid item xs={12}>
            <SectionCard elevation={3}>
              <CardContent>
                <Typography variant="h5" gutterBottom>Mis Estudiantes</Typography>

                {parentInfo.students.length === 0 ? (
                  <Typography fontStyle="italic">Sin estudiantes registrados.</Typography>
                ) : (
                  <Grid container spacing={2}>
                    {parentInfo.students.map((st, idx) => (
                      <Grid key={`st-${st.id ?? idx}`} item xs={12} md={6} lg={4}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6">{st.fullName || 'Sin nombre'}</Typography>
                            {nonEmpty(st.grade) && (
                              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                                Grado: {st.grade}
                              </Typography>
                            )}
                            {st.id && (
                              <Chip size="small" sx={{ mt: 1 }} label={`ID: ${st.id}`} />
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </SectionCard>
          </Grid>

          {/* ---------------- Rutas (unificadas) ---------------- */}
          <Grid item xs={12}>
            <SectionCard elevation={3}>
              <CardContent>
                <Typography variant="h5" gutterBottom>Rutas</Typography>

                {derivedRoutes.length === 0 ? (
                  <Typography fontStyle="italic">No se encontraron rutas asignadas.</Typography>
                ) : (
                  <Stack spacing={2}>
                    {derivedRoutes.map((r, i) => (
                      <MuiBox key={`route-${i}`}>
                        <Grid container spacing={1}>
                          {nonEmpty(r.routeNumber) && (
                            <Grid item xs={12} md={3}><b>Ruta:</b> {r.routeNumber}</Grid>
                          )}
                          {nonEmpty(r.stopPoint) && (
                            <Grid item xs={12} md={3}><b>Punto:</b> {r.stopPoint}</Grid>
                          )}
                          {toArray(r.schedules).length > 0 && (
                            <Grid item xs={12} md={3}>
                              <b>Horario(s):</b> {toArray(r.schedules).join(', ')}
                            </Grid>
                          )}
                          {(nonEmpty(r.monitoraName) || nonEmpty(r.monitoraContact)) && (
                            <Grid item xs={12} md={3}>
                              <b>Monitora:</b>{' '}
                              {r.monitoraName}
                              {nonEmpty(r.monitoraContact) ? ` (${r.monitoraContact})` : ''}
                            </Grid>
                          )}
                        </Grid>
                        {i < derivedRoutes.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </MuiBox>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </SectionCard>
          </Grid>

          {/* ---------------- Horarios por estudiante (tipo "asignar buses") ---------------- */}
          <Grid item xs={12}>
            <SectionCard elevation={3}>
              <CardContent>
                <Typography variant="h5" gutterBottom>Horarios de Parada por Estudiante</Typography>

                {parentInfo.students.length === 0 ? (
                  <Typography fontStyle="italic">No hay estudiantes para mostrar horarios.</Typography>
                ) : (
                  parentInfo.students.map((st, idx) => {
                    const slots = st.id ? toArray(slotsByStudent[st.id]) : [];
                    const hasAny = slots.length > 0;

                    // Construye un índice por día -> slots etiquetados Entrada/Salida/Parada
                    const byDay = {};
                    DAYS.forEach((d) => { byDay[d.key] = []; });
                    slots.forEach((s) => {
                      const sDays = toArray(s.days).map((d) => String(d || '').toLowerCase());
                      DAYS.forEach(({ key }) => {
                        if (sDays.includes(key)) byDay[key].push(s);
                      });
                    });
                    Object.keys(byDay).forEach((k) => {
                      byDay[k] = tagSlotsByDay(byDay[k]);
                    });

                    return (
                      <MuiBox key={`sched-${st.id ?? idx}`} sx={{ mb: idx < parentInfo.students.length - 1 ? 3 : 0 }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {st.fullName || 'Estudiante'}{nonEmpty(st.grade) ? ` — ${st.grade}` : ''}
                        </Typography>

                        {!hasAny ? (
                          <Typography fontStyle="italic" sx={{ mb: 2 }}>
                            Sin horarios registrados para este estudiante.
                          </Typography>
                        ) : (
                          <MuiBox sx={{ overflowX: 'auto' }}>
                            <Stack direction="row" spacing={2} sx={{ minHeight: 1, pb: 1 }}>
                              {DAYS.map(({ key, label }) => {
                                const items = byDay[key];
                                return (
                                  <DayCol key={key}>
                                    <Typography variant="subtitle1" sx={{ mb: 1 }}>{label}</Typography>

                                    {items.length === 0 ? (
                                      <Card variant="outlined" sx={{ mb: 1, opacity: 0.6 }}>
                                        <CardContent>
                                          <Typography fontStyle="italic" variant="body2">Sin paradas</Typography>
                                        </CardContent>
                                      </Card>
                                    ) : (
                                      items.map((slot, i2) => {
                                        const bus = slot.bus || {};
                                        return (
                                          <Card key={`${key}-${i2}`} variant="outlined" sx={{ mb: 1 }}>
                                            <CardContent>
                                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                                <Chip size="small" label={slot._label} />
                                                {nonEmpty(slot.time) && (
                                                  <Tooltip title="Hora en punto de parada">
                                                    <Chip size="small" variant="outlined" label={slot.time} />
                                                  </Tooltip>
                                                )}
                                              </Stack>

                                              <Grid container spacing={0.5}>
                                                {nonEmpty(slot.schoolSchedule) && (
                                                  <>
                                                    <Grid item xs={6}><Typography variant="body2"><b>Hora colegio:</b></Typography></Grid>
                                                    <Grid item xs={6}><Typography variant="body2">{slot.schoolSchedule}</Typography></Grid>
                                                  </>
                                                )}

                                                {nonEmpty(bus.routeNumber) && (
                                                  <>
                                                    <Grid item xs={6}><Typography variant="body2"><b>Ruta:</b></Typography></Grid>
                                                    <Grid item xs={6}><Typography variant="body2">{bus.routeNumber}</Typography></Grid>
                                                  </>
                                                )}

                                                {nonEmpty(slot.time) && (
                                                  <>
                                                    <Grid item xs={6}><Typography variant="body2"><b>Hora parada:</b></Typography></Grid>
                                                    <Grid item xs={6}><Typography variant="body2">{slot.time}</Typography></Grid>
                                                  </>
                                                )}

                                                {nonEmpty(slot.note) && (
                                                  <>
                                                    <Grid item xs={6}><Typography variant="body2"><b>Nota parada:</b></Typography></Grid>
                                                    <Grid item xs={6}><Typography variant="body2">{slot.note}</Typography></Grid>
                                                  </>
                                                )}
                                              </Grid>
                                            </CardContent>
                                          </Card>
                                        );
                                      })
                                    )}
                                  </DayCol>
                                );
                              })}
                            </Stack>
                          </MuiBox>
                        )}
                        {idx < parentInfo.students.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </MuiBox>
                    );
                  })
                )}
              </CardContent>
            </SectionCard>
          </Grid>

          {/* ---------------- Acción de pagos ---------------- */}
          <Grid item xs={12} textAlign="center">
            <Button
              variant="contained"
              size="large"
              sx={{ backgroundColor: '#007BFF' }}
              onClick={() => { window.location.href = '/parent/payment'; }}
            >
              Subir Boleta de Pago
            </Button>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.sev}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ParentDashboardPage;
