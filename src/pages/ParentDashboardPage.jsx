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
  Link,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
} from '@mui/material';
import { styled } from 'twin.macro';
import ParentNavbar from '../components/ParentNavbar';
import UpdateParentInfoDialog from '../components/UpdateParentInfoDialog';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import SignatureCanvas from 'react-signature-canvas';
import parse from 'html-react-parser';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    contactPhone: safeStr(data.contactPhone),
    contactEmail: safeStr(data.contactEmail),
    whatsappLink: safeStr(data.whatsappLink),
    bankName:   safeStr(data.bankName),
    bankAccount: safeStr(data.bankAccount),
    duePaymentDay: safeStr(data.duePaymentDay),
    transportFeeComplete: safeStr(data.transportFeeComplete),
    transportFeeHalf: safeStr(data.transportFeeHalf),

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
            routeNumber: safeStr(s?.routeNumber),
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

  // Estado para firma de contratos
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsList, setContractsList] = useState([]);
  const [filledContractsList, setFilledContractsList] = useState([]);
  // Estado y refs para firma en modal
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [signingContract, setSigningContract] = useState(null);
  const [filledData, setFilledData] = useState({});
  const [missingFields, setMissingFields] = useState([]);
  const signaturePads = React.useRef({});
  const fieldRefs = React.useRef({});
  const [submittingSignature, setSubmittingSignature] = useState(false);

  const [parentInfo, setParentInfo] = useState(() => normalizeParentInfo({}));
  const [slotsByStudent, setSlotsByStudent] = useState({}); // { [studentId]: Slot[] }

  // Filtros
  const [selectedDay, setSelectedDay] = useState('all'); // 'all' | monday | ... | friday
  const [selectedStudent, setSelectedStudent] = useState('all'); // 'all' | <id>

  // Estado para el diálogo de actualización de datos
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateDialogData, setUpdateDialogData] = useState({});

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

  // Función para abrir el diálogo de actualización
  const handleOpenUpdateDialog = async () => {
    try {
      const email = auth?.user?.email;
      if (!email) {
        setSnackbar({ open: true, sev: 'error', msg: 'No se encontró el correo del usuario.' });
        return;
      }
      const res = await api.get(`/update-parent-info?email=${encodeURIComponent(email)}`);
      setUpdateDialogData(res?.data || {});
      setUpdateDialogOpen(true);
    } catch (e) {
      console.error('[ParentDashboard] Error fetching update data:', e);
      setSnackbar({ open: true, sev: 'error', msg: 'No se pudo cargar la información para actualizar.' });
    }
  };

  // ---------- Firma de contratos desde el dashboard ----------
  const handleOpenContractsDialog = async () => {
    const parentId = auth?.user?.id;
    if (!parentId) {
      setSnackbar({ open: true, sev: 'warning', msg: 'Sesión no encontrada. Inicia sesión nuevamente.' });
      return;
    }

    try {
      setContractsLoading(true);
      // Obtener contratos disponibles del colegio
      const [contractsRes, filledRes] = await Promise.all([
        api.get(`/parents/${parentId}/contracts`),
        api.get(`/parents/${parentId}/filled-contracts`)
      ]);

      const contracts = Array.isArray(contractsRes.data?.contracts) ? contractsRes.data.contracts : [];
      const filled = Array.isArray(filledRes.data?.filledContracts) ? filledRes.data.filledContracts : [];

      setContractsList(contracts);
      setFilledContractsList(filled || []);
      setContractsDialogOpen(true);
    } catch (e) {
      console.error('[ParentDashboard] Error fetching contracts:', e);
      setSnackbar({ open: true, sev: 'error', msg: 'No se pudieron obtener los contratos disponibles.' });
    } finally {
      setContractsLoading(false);
    }
  };

  const handleCloseContractsDialog = () => {
    setContractsDialogOpen(false);
    setContractsList([]);
  };

  const handleOpenContractShare = async (contract) => {
    if (!contract || !contract.uuid) return;
    try {
      // Load shared contract HTML/content
      const res = await api.get(`/contracts/share/${contract.uuid}`);
      const data = res.data || {};
      setSigningContract({ ...contract, title: data.title || contract.title, content: data.content || contract.content });
      setFilledData({});
      setMissingFields([]);
      signaturePads.current = {};
      fieldRefs.current = {};
      setSigningDialogOpen(true);
    } catch (err) {
      console.error('Error loading shared contract:', err);
      setSnackbar({ open: true, sev: 'error', msg: 'No se pudo cargar el contrato para firmar.' });
    }
  };

  const handleOpenFilledView = (filled) => {
    if (!filled || !filled.uuid) return;
    const uuid = filled.uuid;
    setViewFilledUuid(uuid);
    setViewFilledLoading(true);
    setViewFilledOpen(true);
    setViewFilledData(null);
    api.get(`/contracts/filled/${uuid}`).then((res) => {
      setViewFilledData(res.data);
    }).catch((err) => {
      console.error('Error loading filled contract:', err);
      setSnackbar({ open: true, sev: 'error', msg: 'No se pudo cargar el contrato firmado.' });
      setViewFilledOpen(false);
    }).finally(() => setViewFilledLoading(false));
  };

  // Estado para ver contrato firmado embebido
  const [viewFilledOpen, setViewFilledOpen] = useState(false);
  const [viewFilledUuid, setViewFilledUuid] = useState('');
  const [viewFilledData, setViewFilledData] = useState(null);
  const [viewFilledLoading, setViewFilledLoading] = useState(false);

  // Helpers for signing modal
  const extractPlaceholders = (content) => {
    const regex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
    const placeholders = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const nameTrim = match[1].trim();
      placeholders.push({ name: nameTrim, type: match[2] });
    }
    return Array.from(new Set(placeholders.map(JSON.stringify))).map(JSON.parse);
  };

  const handleChangeField = (name, value) => {
    setFilledData((prev) => ({ ...prev, [name]: value }));
    if (value) setMissingFields((prev) => prev.filter((n) => n !== name));
  };

  const handleSignatureRef = (name, ref) => {
    if (ref) signaturePads.current[name] = ref;
  };

  const handleSignatureEndLocal = (name) => {
    const pad = signaturePads.current[name];
    if (pad && !pad.isEmpty()) setMissingFields((prev) => prev.filter((n) => n !== name));
  };

  const renderSigningContent = (html) => {
    const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
    const elements = [];
    let lastIndex = 0;
    let match;
    while ((match = placeholderRegex.exec(html)) !== null) {
      const full = match[0];
      const rawName = match[1];
      const type = match[2];
      const nameTrim = rawName.trim();
      const before = html.substring(lastIndex, match.index);
      if (before) elements.push(<span key={`before-${lastIndex}`} dangerouslySetInnerHTML={{ __html: before }} />);

      if (type === 'signature') {
        const isMissing = missingFields.includes(nameTrim);
        elements.push(
          <div key={`sig-${nameTrim}`} style={{ margin: '12px 0' }}>
            <div style={{ marginBottom: 6 }}>{nameTrim}</div>
            <div style={{ border: isMissing ? '2px solid #d32f2f' : '1px solid #000', display: 'inline-block' }}>
              <SignatureCanvas penColor="black" canvasProps={{ width: 300, height: 120, style: { display: 'block' } }} ref={(r) => handleSignatureRef(nameTrim, r)} onEnd={() => handleSignatureEndLocal(nameTrim)} />
            </div>
            <div style={{ marginTop: 6 }}>
              <Button size="small" onClick={() => { const p = signaturePads.current[nameTrim]; if (p) { p.clear(); setMissingFields((prev) => [...prev, nameTrim]); } }}>Limpiar</Button>
            </div>
          </div>
        );
      } else {
        elements.push(
          <input
            key={`inp-${nameTrim}-${match.index}`}
            placeholder={nameTrim}
            ref={(el) => { fieldRefs.current[nameTrim] = el; }}
            type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
            value={filledData[nameTrim] || ''}
            onChange={(e) => handleChangeField(nameTrim, e.target.value)}
            style={{ border: 'none', borderBottom: '1px solid #000', minWidth: 160, margin: '0 6px' }}
          />
        );
      }

      lastIndex = match.index + full.length;
    }
    const remaining = html.substring(lastIndex);
    if (remaining) elements.push(<span key={`rem-${lastIndex}`} dangerouslySetInnerHTML={{ __html: remaining }} />);
    return elements;
  };

  // Renderiza el contenido ya llenado (muestra firmas e inputs como en FilledContractViewer)
  const renderFilledContent = (content) => {
    const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
    return parse(content, {
      replace: (domNode) => {
        if (domNode.type === 'text') {
          const text = domNode.data;
          const segments = [];
          let lastIndex = 0;
          let match;
          while ((match = placeholderRegex.exec(text)) !== null) {
            const [fullMatch, rawName, type] = match;
            const nameTrim = rawName.trim();
            const beforeText = text.substring(lastIndex, match.index);
            if (beforeText) segments.push(beforeText);

            if (type === 'signature') {
              const signatureDataUrl = viewFilledData?.filledData[`${nameTrim}_signature`] || '';
              if (signatureDataUrl) {
                segments.push(
                  <div key={`sig-${nameTrim}-${match.index}`} style={{ display: 'block', margin: '12px 0', clear: 'both' }}>
                    <img src={signatureDataUrl} alt={`Firma de ${nameTrim}`} style={{ width: '200px', height: '100px', border: '1px solid #000' }} />
                  </div>
                );
              } else {
                segments.push(
                  <div key={`sig-placeholder-${nameTrim}-${match.index}`} style={{ display: 'block', margin: '12px 0', clear: 'both', border: '1px solid #000', width: '200px', height: '100px' }}>
                    <Typography variant="subtitle1" gutterBottom>{nameTrim}</Typography>
                  </div>
                );
              }
            } else {
              const value = viewFilledData?.filledData[nameTrim] || '';
              segments.push(
                <Typography key={`field-${nameTrim}-${match.index}`} variant="body1" style={{ display: 'inline-block', minWidth: '150px', borderBottom: '1px solid #000', margin: '0 5px' }}>
                  {value}
                </Typography>
              );
            }

            lastIndex = match.index + fullMatch.length;
          }

          const remainingText = text.substring(lastIndex);
          if (remainingText) segments.push(remainingText);

          if (segments.length > 0) return <React.Fragment key={`frag-${domNode.key}`}>{segments}</React.Fragment>;
        }
      }
    });
  };

  // Genera PDF a partir del contenido llenado (similar a FilledContractViewer)
  const handleGeneratePDFView = async () => {
    if (!viewFilledData) return;

    const filledContract = viewFilledData;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = filledContract.content;
    tempDiv.style.width = '210mm';
    tempDiv.style.padding = '20mm';
    tempDiv.style.boxSizing = 'border-box';
    tempDiv.style.fontFamily = "'Times New Roman', serif";
    tempDiv.style.lineHeight = '1.5';
    tempDiv.style.textAlign = 'justify';
    tempDiv.style.backgroundColor = '#fff';
    document.body.appendChild(tempDiv);

    try {
      const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // canvas dimensions in px
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Height of a PDF page in canvas pixels
      const pageHeightPx = Math.floor(canvasWidth * (pdfHeight / pdfWidth));

      let remainingHeight = canvasHeight;
      let position = 0;
      let pageIndex = 0;

      while (remainingHeight > 0) {
        const chunkHeight = Math.min(pageHeightPx, remainingHeight);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = chunkHeight;
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, position, canvasWidth, chunkHeight, 0, 0, pageCanvas.width, pageCanvas.height);

        const pageData = pageCanvas.toDataURL('image/png');
        const pageImgHeight = (pageCanvas.height * pdfWidth) / pageCanvas.width;

        if (pageIndex === 0) {
          pdf.addImage(pageData, 'PNG', 0, 0, pdfWidth, pageImgHeight);
        } else {
          pdf.addPage();
          pdf.addImage(pageData, 'PNG', 0, 0, pdfWidth, pageImgHeight);
        }

        remainingHeight -= chunkHeight;
        position += chunkHeight;
        pageIndex += 1;
      }

      pdf.save(`${(filledContract.title || 'contrato').replace(/[^a-z0-9\-_. ]/gi, '')}.pdf`);
      setSnackbar({ open: true, sev: 'success', msg: 'PDF generado exitosamente.' });
    } catch (error) {
      console.error('Error generando el PDF:', error);
      setSnackbar({ open: true, sev: 'error', msg: 'Hubo un error al generar el PDF.' });
    }

    document.body.removeChild(tempDiv);
  };

  const handleSubmitSigning = async () => {
    if (!signingContract) return;
    // validate
    const placeholders = extractPlaceholders(signingContract.content);
    const newlyMissing = [];
    for (const ph of placeholders) {
      const name = ph.name;
      if (ph.type === 'signature') {
        const pad = signaturePads.current[name];
        if (!pad || pad.isEmpty()) newlyMissing.push(name);
      } else {
        const val = filledData[name];
        if (val === undefined || val === null || val === '') newlyMissing.push(name);
      }
    }
    if (newlyMissing.length > 0) {
      setMissingFields(newlyMissing);
      setSnackbar({ open: true, sev: 'warning', msg: `Faltan campos: ${newlyMissing.slice(0,3).join(', ')}${newlyMissing.length>3? '...':''}` });
      const first = newlyMissing[0];
      setTimeout(() => { const el = fieldRefs.current[first]; if (el && el.focus) try { el.focus(); } catch(e){} }, 50);
      return;
    }

    // collect signatures
    const signatures = {};
    for (const [name, pad] of Object.entries(signaturePads.current)) {
      if (pad && !pad.isEmpty()) signatures[`${name}_signature`] = pad.getTrimmedCanvas().toDataURL('image/png');
      else signatures[`${name}_signature`] = '';
    }

    const payload = { filledData: { ...filledData, ...signatures }, parentId: auth?.user?.id };

    try {
      setSubmittingSignature(true);
      const res = await api.post(`/contracts/share/${signingContract.uuid}`, payload);
      setSnackbar({ open: true, sev: 'success', msg: 'Contrato firmado y guardado correctamente.' });
      // refresh lists: remove from contractsList and reload filledContractsList
      // simple approach: refetch dialog data
      const parentId = auth?.user?.id;
      if (parentId) {
        const [contractsRes, filledRes] = await Promise.all([api.get(`/parents/${parentId}/contracts`), api.get(`/parents/${parentId}/filled-contracts`)]);
        setContractsList(Array.isArray(contractsRes.data?.contracts) ? contractsRes.data.contracts : []);
        setFilledContractsList(Array.isArray(filledRes.data?.filledContracts) ? filledRes.data.filledContracts : []);
      }
      setSigningDialogOpen(false);
    } catch (err) {
      console.error('Error submitting filled contract:', err);
      setSnackbar({ open: true, sev: 'error', msg: 'Ocurrió un error al enviar el contrato.' });
    } finally {
      setSubmittingSignature(false);
    }
  };

  // ---------- Derivados (listas para mostrar) ----------
  // ...existing code... (derivedRoutes removed because not used)

  // Estudiantes filtrados
  const studentsToRender = useMemo(() => {
    const id = selectedStudent === 'all' ? null : Number(selectedStudent);
    if (!id) return parentInfo.students;
    return parentInfo.students.filter((s) => s.id === id);
  }, [parentInfo.students, selectedStudent]);

  // Días filtrados
  const daysToRender = useMemo(() => {
    if (selectedDay === 'all') return DAYS;
    return DAYS.filter((d) => d.key === selectedDay);
  }, [selectedDay]);

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

                <Divider sx={{ my: 2 }} />

                <Button
                  variant="outlined"
                  color="primary"
                  fullWidth
                  onClick={handleOpenUpdateDialog}
                >
                  Actualizar Mis Datos
                </Button>
                <div style={{ marginTop: 8 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    onClick={handleOpenContractsDialog}
                  >
                    Firmar Contrato
                  </Button>
                </div>
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

                  {nonEmpty(parentInfo.duePaymentDay) && (
                    <>
                      <Grid item xs={6}><b>Fecha Máxima de Pago:</b></Grid>
                      <Grid item xs={6}>{parentInfo.duePaymentDay} de cada mes</Grid>
                    </>
                  )}

                  {nonEmpty(parentInfo.transportFeeComplete) && (
                    <>
                      <Grid item xs={6}><b>Cuota de Transporte Completa (Q):</b></Grid>
                      <Grid item xs={6}>{parentInfo.transportFeeComplete}</Grid>
                    </>
                  )}

                  {nonEmpty(parentInfo.transportFeeHalf) && (
                    <>
                      <Grid item xs={6}><b>Cuota de Transporte Media (Q):</b></Grid>
                      <Grid item xs={6}>{parentInfo.transportFeeHalf}</Grid>
                    </>
                  )}

                  {/* ---------------- Acción de pagos ---------------- */}
                  <Grid item xs={12} textAlign="center">
                    <Button
                      variant="contained"
                      size="small"
                      sx={{ backgroundColor: '#007BFF' }}
                      onClick={() => { window.location.href = '/parent/payment'; }}
                    >
                      Subir Boleta de Pago
                    </Button>
                  </Grid>
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

                {(nonEmpty(parentInfo.contactPhone) ||
                  nonEmpty(parentInfo.contactEmail) ||
                  nonEmpty(parentInfo.whatsappLink)) && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>Contáctanos</Typography>
                    <Grid container columnSpacing={2} rowSpacing={1}>
                      {nonEmpty(parentInfo.contactPhone) && (
                        <>
                          <Grid item xs={6}><b>Teléfono:</b></Grid>
                          <Grid item xs={6}>{parentInfo.contactPhone}</Grid>
                        </>
                      )}
                      {nonEmpty(parentInfo.contactEmail) && (
                        <>
                          <Grid item xs={6}><b>Email:</b></Grid>
                          <Grid item xs={6}>{parentInfo.contactEmail}</Grid>
                        </>
                      )}
                      {nonEmpty(parentInfo.whatsappLink) && (
                        <>
                          <Grid item xs={6}><b>WhatsApp:</b></Grid>
                          <Grid item xs={6}>
                            <Link
                              href={parentInfo.whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: 'primary.main', textDecoration: 'underline' }}
                            >
                              {parentInfo.whatsappLink}
                            </Link>
                          </Grid>
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
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </SectionCard>
          </Grid>

          {/* ---------------- Horarios por estudiante (tipo "asignar buses") ---------------- */}
          <Grid item xs={12}>
            <SectionCard elevation={3}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  {/* Filtro por día */}
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h6" sx={{ mr: 1 }}>Horarios de Parada</Typography>
                    <ToggleButtonGroup
                      exclusive
                      value={selectedDay}
                      onChange={(_, v) => v && setSelectedDay(v)}
                      size="small"
                    >
                      <ToggleButton value="all">Semana</ToggleButton>
                      {DAYS.map((d) => (
                        <ToggleButton key={d.key} value={d.key}>{d.label}</ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Stack>

                  {/* Filtro por estudiante */}
                  <FormControl size="small" sx={{ minWidth: 240 }}>
                    <InputLabel id="student-filter-label">Estudiante</InputLabel>
                    <Select
                      labelId="student-filter-label"
                      label="Estudiante"
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                    >
                      <MenuItem value="all">Todos</MenuItem>
                      {parentInfo.students.map((st, idx) => (
                        <MenuItem
                          key={`opt-${st.id ?? idx}`}
                          value={st.id ?? `noid-${idx}`}
                          disabled={!st.id}
                        >
                          {st.fullName}{nonEmpty(st.grade) ? ` — ${st.grade}` : ''}{!st.id ? ' (sin ID)' : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                {studentsToRender.length === 0 ? (
                  <Typography fontStyle="italic">No hay estudiantes para mostrar horarios.</Typography>
                ) : (
                  studentsToRender.map((st, idx) => {
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
                      <MuiBox key={`sched-${st.id ?? idx}`} sx={{ mb: idx < studentsToRender.length - 1 ? 3 : 0 }}>
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
                              {daysToRender.map(({ key, label }) => {
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
                                                <Chip size="small" label={"Hora parada"} />
                                                {nonEmpty(slot.time) && (
                                                  <Tooltip title="Hora en punto de parada">
                                                    <Chip size="small" variant="outlined" label={slot.time} />
                                                  </Tooltip>
                                                )}
                                              </Stack>

                                              <Grid container spacing={0.5}>
                                                {nonEmpty(slot.routeNumber) && (
                                                  <>
                                                    <Grid item xs={6}><Typography variant="body2"><b>Ruta:</b></Typography></Grid>
                                                    <Grid item xs={6}><Typography variant="body2">{slot.routeNumber}</Typography></Grid>
                                                  </>
                                                )}

                                                {nonEmpty(slot.note) && (
                                                  <>
                                                    <Grid item xs={6}><Typography variant="body2"><b>Nota parada:</b></Typography></Grid>
                                                    <Grid item xs={6}><Typography variant="body2">{slot.note}</Typography></Grid>
                                                  </>
                                                )}

                                                {nonEmpty(slot.schoolSchedule) && (
                                                  <>
                                                    <Grid item xs={6}><Typography variant="body2"><b>Hora colegio:</b></Typography></Grid>
                                                    <Grid item xs={6}><Typography variant="body2">{slot.schoolSchedule}</Typography></Grid>
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
                        {idx < studentsToRender.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </MuiBox>
                    );
                  })
                )}
              </CardContent>
            </SectionCard>
          </Grid>
        </Grid>
      </Container>

      {/* Diálogo para listar contratos y abrir link de firma */}
      <Dialog open={contractsDialogOpen} onClose={handleCloseContractsDialog} fullWidth maxWidth="sm">
        <DialogTitle>Firmar Contrato</DialogTitle>
        <DialogContent dividers>
          {contractsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <CircularProgress />
            </div>
          ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={12}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Contratos Disponibles</Typography>
                    {contractsLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}><CircularProgress size={20} /></div>
                    ) : (
                      (() => {
                        const available = contractsList.filter(c => !filledContractsList.some(fc => (fc.contractId && fc.contractId === c.id) || (fc.contract && (fc.contract.id === c.id || fc.contract.uuid === c.uuid))));
                        if (!available || available.length === 0) {
                          return <Typography variant="body2" sx={{ color: 'text.secondary' }}>No hay contratos disponibles para firmar.</Typography>;
                        }
                        return (
                          <List>
                            {available.map((c) => (
                              <ListItem key={c.uuid} divider sx={{ mb: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
                                  <div style={{ background: '#e1f5fe', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#01579b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    Disponible
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{c.title || 'Sin título'}</div>
                                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{c.createdAt ? `Creado el ${new Date(c.createdAt).toLocaleDateString()}` : ''}</div>
                                  </div>
                                  <div>
                                    <Button size="small" variant="contained" onClick={() => handleOpenContractShare(c)} sx={{ backgroundColor: '#0288d1' }}>Firmar</Button>
                                  </div>
                                </div>
                              </ListItem>
                            ))}
                          </List>
                        );
                      })()
                    )}
                  </Grid>

                  <Grid item xs={12} md={12}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Contratos Firmados</Typography>
                    {contractsLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}><CircularProgress size={20} /></div>
                    ) : (
                      (() => {
                        if (!filledContractsList || filledContractsList.length === 0) {
                          return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Aún no has firmado ningún contrato.</Typography>;
                        }
                        return (
                          <List>
                            {filledContractsList.map((f) => (
                              <ListItem key={f.uuid} divider sx={{ mb: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
                                  <div style={{ background: '#e8f5e9', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#2e7d32', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    Firmado
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{f.title || f.contract?.title || 'Contrato firmado'}</div>
                                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{f.createdAt ? `Firmado el ${new Date(f.createdAt).toLocaleDateString()}` : ''}</div>
                                  </div>
                                  <div>
                                    <Button size="small" variant="outlined" onClick={() => handleOpenFilledView(f)} sx={{ borderColor: '#2e7d32', color: '#2e7d32' }}>Ver</Button>
                                  </div>
                                </div>
                              </ListItem>
                            ))}
                          </List>
                        );
                      })()
                    )}
                  </Grid>
                </Grid>
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseContractsDialog}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo embebido para firmar */}
      <Dialog open={signingDialogOpen} onClose={() => setSigningDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Firmar: {signingContract?.title || ''}</DialogTitle>
        <DialogContent dividers>
          {!signingContract ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><CircularProgress /></div>
          ) : (
            <div style={{ fontFamily: "'Times New Roman', serif", lineHeight: 1.5 }}>
              {/* Render contract content with inputs and signature canvases */}
              {renderSigningContent(signingContract.content)}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSigningDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmitSigning} disabled={submittingSignature}>{submittingSignature ? 'Enviando...' : 'Enviar y Firmar'}</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para ver contrato firmado embebido (usa mismo render que FilledContractViewer) */}
      <Dialog open={viewFilledOpen} onClose={() => setViewFilledOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Contrato Firmado</DialogTitle>
        <DialogContent dividers>
          {viewFilledLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><CircularProgress /></div>
          ) : !viewFilledData ? (
            <Typography variant="body1">No se encontró el contrato.</Typography>
          ) : (
            <div style={{ padding: 8 }}>
              <Typography variant="h6" gutterBottom>{viewFilledData.title}</Typography>
              <Divider sx={{ mb: 1 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={12}>
                  <div id="contract-preview" style={{ border: '1px solid #ccc', padding: 12, borderRadius: 4, minHeight: 240, backgroundColor: '#fff', overflowY: 'auto', fontFamily: "'Times New Roman', serif", lineHeight: 1.5, textAlign: 'justify' }}>
                    {renderFilledContent(viewFilledData.content)}
                  </div>
                </Grid>
              </Grid>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleGeneratePDFView} disabled={viewFilledLoading || !viewFilledData}>Generar PDF</Button>
          <Button onClick={() => setViewFilledOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

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

      {/* Diálogo para actualizar datos de familia */}
      <UpdateParentInfoDialog
        open={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        initialData={updateDialogData}
        onSaved={() => {
          loadAll();
          setSnackbar({ open: true, sev: 'success', msg: '¡Datos actualizados correctamente!' });
        }}
      />
    </>
  );
};

export default ParentDashboardPage;
