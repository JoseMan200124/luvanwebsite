// src/pages/ParentDashboardPage.jsx
import React, { useEffect, useMemo, useState, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Avatar,
  Paper,
  Collapse,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  MenuBook as MenuBookIcon,
  Info as InfoIcon,
  Call as CallIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
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

// Formatea HH:mm -> h:mm AM/PM (si ya viene con AM/PM, lo deja)
const formatTime12 = (timeStr) => {
  if (!timeStr) return '';
  const s = String(timeStr).trim();
  if (/\b(am|pm)\b/i.test(s)) return s;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
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

  // If the API already provides a semantic `type` (pickup/dropoff), prefer it
  const hasType = sorted.some((s) => s && s.type);
  if (hasType) {
    return sorted.map((s) => {
      const t = (s && s.type) || '';
      const lbl = t === 'pickup' ? 'Entrada' : t === 'dropoff' ? 'Salida' : (s && s._label) || 'Parada';
      return { ...s, _label: lbl };
    });
  }

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
  const { auth, verifyToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const theme = useTheme();

  // Estado de servicio (preferir lo que devuelva backend para reflejar cambios sin relogin)
  const [serviceStatus, setServiceStatus] = useState(() => auth?.user?.serviceStatus || '');
  const isSuspended = serviceStatus === 'SUSPENDED';

  // Mantenerlo en sync con AuthContext cuando llegue un verifyToken()
  useEffect(() => {
    setServiceStatus(auth?.user?.serviceStatus || '');
  }, [auth?.user?.serviceStatus]);

  const lastRefreshRef = useRef(0);

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
  const [plateMap, setPlateMap] = useState({});

  // Filtros
  const [selectedDay, setSelectedDay] = useState('all'); // 'all' | monday | ... | friday
  const [selectedStudent, setSelectedStudent] = useState('all'); // 'all' | <id>

  // Carrusel (solo para Semana + Todos)
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Estado para el diálogo de actualización de datos
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateDialogData, setUpdateDialogData] = useState({});

  const [openContactDialog, setOpenContactDialog] = useState(false);

  // Control de filas expandidas: { [slotKey]: true }
  const [expandedSlots, setExpandedSlots] = useState({});
  const toggleSlot = (k) => setExpandedSlots((p) => ({ ...p, [k]: !p[k] }));

  // null = verificando, true/false = resultado conocido
  const [hasSignedContract, setHasSignedContract] = useState(null);
  // Suspendido específicamente por falta de contrato (sin mora)
  const isSuspendedForNoContract = isSuspended && hasSignedContract === false;

  const cleanPhoneDigits = (phone) => {
    if (!phone) return '';
    return String(phone).replace(/[^0-9]/g, '');
  };

  const openPhone = (phone) => {
    const digits = cleanPhoneDigits(phone);
    if (!digits) return;
    window.location.href = `tel:${digits}`;
  };

  const openEmail = (email) => {
    const e = safeStr(email);
    if (!e) return;
    window.location.href = `mailto:${encodeURIComponent(e)}`;
  };

  const openWhatsApp = (whatsappLink, fallbackPhone) => {
    const direct = safeStr(whatsappLink);
    const url = direct || (cleanPhoneDigits(fallbackPhone) ? `https://wa.me/${cleanPhoneDigits(fallbackPhone)}` : '');
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

      // 1) Resumen de padre/familia + contratos firmados (en paralelo)
      const [res, filledRes] = await Promise.all([
        api.get(`/parents/${userId}/route-info`),
        api.get(`/parents/${userId}/filled-contracts`).catch(() => ({ data: { filledContracts: [] } }))
      ]);
      const rawData = res?.data?.data || {};
      const info = normalizeParentInfo(rawData);
      setParentInfo(info);

      const backendServiceStatus = rawData?.serviceStatus || rawData?.parent?.serviceStatus || rawData?.user?.serviceStatus || '';
      setServiceStatus(backendServiceStatus || auth?.user?.serviceStatus || '');
      const backendSchoolId = rawData.schoolId ?? rawData.school?.id ?? null;

      const filledList = Array.isArray(filledRes.data?.filledContracts) ? filledRes.data.filledContracts : [];
      setHasSignedContract(filledList.length > 0);

      // 2) Si tengo ids de estudiantes, cargo sus scheduleSlots (accesible a "Padre")
      const studentIds = info.students.map((s) => s.id).filter(Boolean);
      if (studentIds.length > 0) {
        const byId = await fetchSlotsByStudentIds(studentIds);
        setSlotsByStudent(byId);
        // Además, pedir placas de buses para las rutas encontradas (igual que la app móvil)
        try {
          const routeSet = new Set();
          Object.values(byId).forEach((arr) => {
            (arr || []).forEach((s) => { if (s && s.routeNumber) routeSet.add(String(s.routeNumber)); });
          });
          // incluir rutas definidas en parentInfo.routes también
          (info.routes || []).forEach((r) => { if (r && r.routeNumber) routeSet.add(String(r.routeNumber)); });
          const routesArr = Array.from(routeSet).filter(Boolean);
          if (routesArr.length > 0) {
            const q = encodeURIComponent(routesArr.join(','));
            const schoolId = backendSchoolId ? encodeURIComponent(backendSchoolId) : null;
            const url = schoolId ? `/buses/plates?routeNumbers=${q}&schoolId=${schoolId}` : `/buses/plates?routeNumbers=${q}`;
            const platesRes = await api.get(url).catch(() => ({ data: { data: [] } }));
            const busesArr = platesRes.data?.data ?? platesRes.data ?? [];
            const pmap = {};
            if (Array.isArray(busesArr)) {
              busesArr.forEach((b) => { if (b && b.routeNumber != null && b.plate != null) pmap[String(b.routeNumber)] = b.plate; });
            }
            setPlateMap(pmap);
          } else {
            setPlateMap({});
          }
        } catch (e) {
          console.warn('[ParentDashboard] Error cargando placas:', e);
          setPlateMap({});
        }
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

  const refreshDashboard = useCallback(async () => {
    try {
      if (verifyToken) {
        await verifyToken();
      }
    } catch (e) {
      // verifyToken ya hace logout si aplica; aquí evitamos romper el flujo
    }
    await loadAll();
  }, [verifyToken, auth?.user?.id]);

  useEffect(() => {
    refreshDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user?.id]);

  useEffect(() => {
    const onFocus = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < 1500) return;
      lastRefreshRef.current = now;
      refreshDashboard();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshDashboard]);

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
      loadAll();
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

  const isCarouselMode = useMemo(() => {
    return selectedStudent === 'all' && parentInfo.students.length > 1;
  }, [parentInfo.students.length, selectedStudent]);

  useEffect(() => {
    // Reset carrusel al cambiar filtros o lista de estudiantes
    setCarouselIndex(0);
  }, [selectedDay, selectedStudent, parentInfo.students.length]);

  const carouselStudent = isCarouselMode ? (parentInfo.students[carouselIndex] || parentInfo.students[0]) : null;
  const studentsListForSchedule = isCarouselMode ? (carouselStudent ? [carouselStudent] : []) : studentsToRender;

  const handlePrevStudent = () => {
    const n = parentInfo.students.length;
    if (n <= 1) return;
    setCarouselIndex((prev) => (prev - 1 + n) % n);
  };

  const handleNextStudent = () => {
    const n = parentInfo.students.length;
    if (n <= 1) return;
    setCarouselIndex((prev) => (prev + 1) % n);
  };

  // Días filtrados
  const daysToRender = useMemo(() => {
    if (selectedDay === 'all') return DAYS;
    return DAYS.filter((d) => d.key === selectedDay);
  }, [selectedDay]);

  const isSingleDayView = selectedDay !== 'all';

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
        {/* Acciones principales (mismo estilo que Colaborador) */}
        <MuiBox sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="secondary"
                startIcon={<DescriptionIcon />}
                sx={{ height: 56 }}
                onClick={handleOpenContractsDialog}
              >
                Contratos
              </Button>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="primary"
                startIcon={<DescriptionIcon />}
                sx={{ height: 56 }}
                onClick={() => navigate('/parent/protocolos')}
                disabled={isSuspended}
              >
                Protocolos y Reglamentos
              </Button>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                startIcon={<InfoIcon />}
                sx={{
                  height: 56,
                  bgcolor: 'info.dark',
                  '&:hover': { bgcolor: 'info.main' },
                }}
                onClick={() => setOpenContactDialog(true)}
              >
                Contáctanos
              </Button>
            </Grid>
          </Grid>
        </MuiBox>

        <Grid container spacing={3}>
          {/* Columna izquierda: perfil (estilo Colaborador) */}
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <MuiBox
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 3,
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  color: '#fff',
                }}
              >
                <Avatar sx={{ width: 72, height: 72, bgcolor: theme.palette.secondary.main }}>
                  {(
                    safeStr(auth?.user?.name || auth?.user?.fullName || auth?.user?.email || parentInfo.familyLastName || 'P')
                      .split(' ')
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || 'P'
                  )}
                </Avatar>
                <MuiBox>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {safeStr(auth?.user?.name || auth?.user?.fullName || 'Padre/Madre')}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Padre
                  </Typography>
                  {nonEmpty(parentInfo.schoolName) && (
                    <Chip
                      size="small"
                      label={parentInfo.schoolName}
                      sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }}
                    />
                  )}
                </MuiBox>
              </MuiBox>

              <CardContent>
                <Grid container spacing={1}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>Perfil Familiar</Typography>
                  </Grid>

                  {nonEmpty(parentInfo.familyLastName) && (
                    <Grid item xs={12}>
                      <Typography variant="body2"><strong>Apellidos familia:</strong> {parentInfo.familyLastName}</Typography>
                    </Grid>
                  )}
                  {nonEmpty(parentInfo.serviceAddress) && (
                    <Grid item xs={12}>
                      <Typography variant="body2"><strong>Dirección servicio:</strong> {parentInfo.serviceAddress}</Typography>
                    </Grid>
                  )}
                  {nonEmpty(parentInfo.zoneOrSector) && (
                    <Grid item xs={12}>
                      <Typography variant="body2"><strong>Zona/Sector:</strong> {parentInfo.zoneOrSector}</Typography>
                    </Grid>
                  )}
                  {nonEmpty(parentInfo.routeType) && (
                    <Grid item xs={12}>
                      <Typography variant="body2"><strong>Tipo ruta:</strong> {parentInfo.routeType}</Typography>
                    </Grid>
                  )}

                  

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>Mis Hijos</Typography>
                  </Grid>
                  {parentInfo.students.length === 0 ? (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">Sin estudiantes registrados.</Typography>
                    </Grid>
                  ) : (
                    parentInfo.students.map((st, idx) => (
                      <Grid item xs={12} key={`st-left-${st.id ?? idx}`}>
                        <Typography variant="body2">
                          <strong>{st.fullName || 'Sin nombre'}</strong>
                          {nonEmpty(st.grade) ? ` — ${st.grade}` : ''}
                        </Typography>
                      </Grid>
                    ))
                  )}

                      <Grid item xs={12} sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          color="primary"
                          fullWidth
                          startIcon={<EditIcon />}
                          onClick={handleOpenUpdateDialog}
                          disabled={isSuspended}
                        >
                          Actualizar Mis Datos
                        </Button>
                      </Grid>
                      <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>Información de Depósito</Typography>
                      </Grid>

                      {nonEmpty(parentInfo.bankName) && (
                        <Grid item xs={12}>
                          <Typography variant="body2"><strong>Banco:</strong> {parentInfo.bankName}</Typography>
                        </Grid>
                      )}
                      {nonEmpty(parentInfo.bankAccount) && (
                        <Grid item xs={12}>
                          <Typography variant="body2"><strong>Cuenta Bancaria:</strong> {parentInfo.bankAccount}</Typography>
                        </Grid>
                      )}
                      {nonEmpty(parentInfo.duePaymentDay) && (
                        <Grid item xs={12}>
                          <Typography variant="body2"><strong>Fecha Máxima de Pago:</strong> {parentInfo.duePaymentDay} de cada mes</Typography>
                        </Grid>
                      )}
                      {nonEmpty(parentInfo.transportFeeComplete) && (
                        <Grid item xs={12}>
                          <Typography variant="body2"><strong>Cuota de Transporte Completa (Q):</strong> {parentInfo.transportFeeComplete}</Typography>
                        </Grid>
                      )}
                      {nonEmpty(parentInfo.transportFeeHalf) && (
                        <Grid item xs={12}>
                          <Typography variant="body2"><strong>Cuota de Transporte Media (Q):</strong> {parentInfo.transportFeeHalf}</Typography>
                        </Grid>
                      )}

                      <Grid item xs={12} sx={{ mt: 1, textAlign: 'center' }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<CloudUploadIcon />}
                          onClick={() => navigate('/parent/payment')}
                          disabled={isSuspendedForNoContract}
                        >
                          Subir Boleta de Pago
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Paper>
          </Grid>

          {/* Columna derecha: horarios + estudiantes */}
          <Grid item xs={12} md={8}>
            <Grid container spacing={3}>
              {isSuspended && (
                <Grid item xs={12}>
                  <SectionCard elevation={3}>
                    <CardContent>
                      {isSuspendedForNoContract ? (
                        <Alert severity="error">
                          <strong>El servicio está suspendido porque aún no se ha firmado el contrato.</strong>
                          <br />
                          Por favor, firma el contrato para activar el servicio y tener acceso completo.
                        </Alert>
                      ) : (
                        <Alert severity="warning">
                          Cuenta suspendida por mora. Si no ha subido su boleta, por favor subirla; si ya fue subida, su pago se encuentra en revisión.
                        </Alert>
                      )}
                    </CardContent>
                  </SectionCard>
                </Grid>
              )}

              {/* Horarios por estudiante */}
              {!isSuspended && (
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
                      <Typography variant="h6" sx={{ mr: 1 }}>Horarios y Paradas</Typography>
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
                  <>
                    {isCarouselMode && (
                      <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <IconButton onClick={handlePrevStudent} aria-label="Anterior estudiante">
                            <ChevronLeftIcon />
                          </IconButton>

                          <MuiBox sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                              {safeStr(carouselStudent?.fullName || 'Estudiante')}{nonEmpty(carouselStudent?.grade) ? ` — ${carouselStudent.grade}` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {carouselIndex + 1} / {parentInfo.students.length}
                            </Typography>
                          </MuiBox>

                          <IconButton onClick={handleNextStudent} aria-label="Siguiente estudiante">
                            <ChevronRightIcon />
                          </IconButton>
                        </Stack>
                      </Paper>
                    )}

                    {studentsListForSchedule.map((st, idx) => {
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
                      <MuiBox key={`sched-${st.id ?? idx}`} sx={{ mb: idx < studentsListForSchedule.length - 1 ? 3 : 0 }}>
                        {!isCarouselMode && (
                          <Typography variant="h6" sx={{ mb: 1 }}>
                            {st.fullName || 'Estudiante'}{nonEmpty(st.grade) ? ` — ${st.grade}` : ''}
                          </Typography>
                        )}

                        {!hasAny ? (
                          <Typography fontStyle="italic" sx={{ mb: 2 }}>
                            Sin horarios registrados para este estudiante.
                          </Typography>
                        ) : (
                          <MuiBox sx={{ overflowX: isSingleDayView ? 'visible' : 'auto' }}>
                            <Stack
                              direction={isSingleDayView ? 'column' : 'row'}
                              spacing={2}
                              sx={{ minHeight: 1, pb: 1, width: '100%' }}
                            >
                              {daysToRender.map(({ key, label }) => {
                                const items = byDay[key];
                                return (
                                  <Paper
                                    key={key}
                                    sx={
                                      isSingleDayView
                                        ? { display: 'block', width: '100%', p: 1, borderRadius: 2 }
                                        : { display: 'inline-block', p: 1, borderRadius: 2, verticalAlign: 'top' }
                                    }
                                    elevation={0}
                                  >
                                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>{label}</Typography>

                                    {items.length === 0 ? (
                                      <MuiBox sx={{ p: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Sin paradas</Typography>
                                      </MuiBox>
                                    ) : (
                                      isSingleDayView ? (
                                        <Grid container spacing={2}>
                                          {items.map((slot, i2) => {
                                            const slotKey = `${st.id ?? 'noid'}-${key}-${i2}-${slot.id ?? i2}`;
                                            const isExpanded = !!expandedSlots[slotKey];
                                            return (
                                              <Grid item xs={12} sm={6} key={slotKey}>
                                                <Paper
                                                  sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch', p: 2, width: '100%', boxSizing: 'border-box', borderRadius: 2 }}
                                                  elevation={1}
                                                >
                                            <IconButton
                                              onClick={() => toggleSlot(slotKey)}
                                              aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                                              sx={{ position: 'absolute', right: 8, top: 8, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                            >
                                              <ExpandMoreIcon />
                                            </IconButton>

                                            <MuiBox sx={{ mb: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                                              <Chip
                                                label={slot._label || 'Parada'}
                                                size="small"
                                                color={slot._label === 'Entrada' ? 'success' : slot._label === 'Salida' ? 'error' : 'default'}
                                                sx={{ mb: 1 }}
                                              />
                                              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1, fontSize: { xs: '0.95rem', md: '1rem' }, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <strong>Hora en parada:</strong>&nbsp;
                                                <MuiBox component="span" sx={{ color: 'primary.main', fontWeight: 800, display: 'inline-block', whiteSpace: 'nowrap' }}>{formatTime12(slot.time) || safeStr(slot.time)}</MuiBox>
                                              </Typography>
                                            </MuiBox>

                                            <MuiBox sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                              {safeStr(slot.routeNumber) && (() => {
                                                const rn = safeStr(slot.routeNumber);
                                                const plate = slot?.bus?.plate || plateMap[String(rn)] || (parentInfo?.routes?.find(r => safeStr(r.routeNumber) === rn)?.plate) || '';
                                                return (
                                                  <MuiBox sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                                                    <Typography variant="body2" sx={{ flex: '0 0 auto' }}><strong>Número de ruta:</strong></Typography>
                                                    <MuiBox component="span" sx={{ whiteSpace: 'nowrap', display: 'inline-block', color: 'text.primary', fontWeight: 600 }}>{slot.routeNumber}{plate ? ` (Placa: ${plate})` : ''}</MuiBox>
                                                  </MuiBox>
                                                );
                                              })()}

                                              {safeStr(slot.schoolSchedule) && (
                                                <Typography variant="body2"><strong>{(slot && (slot._label === 'Entrada' || slot.type === 'pickup')) ? 'Hora entrada' : (slot && (slot._label === 'Salida' || slot.type === 'dropoff')) ? 'Hora salida' : 'Hora colegio'}:</strong> {formatTime12(slot.schoolSchedule) || safeStr(slot.schoolSchedule)}</Typography>
                                              )}

                                              {safeStr(slot.note) && (
                                                <Typography variant="body2"><strong>Parada:</strong> {slot.note}</Typography>
                                              )}

                                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                {(() => {
                                                  const rn = safeStr(slot.routeNumber);
                                                  const routeObj = parentInfo?.routes?.find(r => safeStr(r.routeNumber) === rn);
                                                  if (routeObj && (routeObj.monitoraName || routeObj.monitoraContact)) {
                                                    return (
                                                      <>
                                                        {safeStr(routeObj.monitoraName) && <Typography variant="body2" sx={{ mt: 0.5 }}><strong>Monitora:</strong> {routeObj.monitoraName}</Typography>}
                                                        {safeStr(routeObj.monitoraContact) && <Typography variant="body2" sx={{ mt: 0.5 }}><strong>Teléfono:</strong> {routeObj.monitoraContact}</Typography>}
                                                      </>
                                                    );
                                                  }
                                                  return (
                                                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>Sin información adicional</Typography>
                                                  );
                                                })()}
                                              </Collapse>
                                            </MuiBox>
                                                </Paper>
                                              </Grid>
                                            );
                                          })}
                                        </Grid>
                                      ) : (
                                        items.map((slot, i2) => {
                                          const slotKey = `${st.id ?? 'noid'}-${key}-${i2}-${slot.id ?? i2}`;
                                          const isExpanded = !!expandedSlots[slotKey];
                                          return (
                                            <Paper
                                              key={`${key}-${i2}`}
                                              sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch', p: 2, mb: 2, width: 'max-content', maxWidth: '80vw', boxSizing: 'border-box', borderRadius: 2 }}
                                              elevation={1}
                                            >
                                              <IconButton
                                                onClick={() => toggleSlot(slotKey)}
                                                aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                                                sx={{ position: 'absolute', right: 8, top: 8, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                              >
                                                <ExpandMoreIcon />
                                              </IconButton>

                                              <MuiBox sx={{ mb: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                                                <Chip
                                                    label={slot._label || 'Parada'}
                                                    size="small"
                                                    color={slot._label === 'Entrada' ? 'success' : slot._label === 'Salida' ? 'error' : 'default'}
                                                    sx={{ mb: 1 }}
                                                  />
                                                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1, fontSize: { xs: '0.95rem', md: '1rem' }, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                    <strong>Hora en parada:</strong>&nbsp;
                                                    <MuiBox component="span" sx={{ color: 'primary.main', fontWeight: 800, display: 'inline-block', whiteSpace: 'nowrap' }}>{formatTime12(slot.time) || safeStr(slot.time)}</MuiBox>
                                                  </Typography>
                                              </MuiBox>

                                              <MuiBox sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                {safeStr(slot.routeNumber) && (() => {
                                                  const rn = safeStr(slot.routeNumber);
                                                  const plate = slot?.bus?.plate || plateMap[String(rn)] || (parentInfo?.routes?.find(r => safeStr(r.routeNumber) === rn)?.plate) || '';
                                                  return (
                                                    <MuiBox sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                                                      <Typography variant="body2" sx={{ flex: '0 0 auto' }}><strong>Número de ruta:</strong></Typography>
                                                      <MuiBox component="span" sx={{ whiteSpace: 'nowrap', display: 'inline-block', color: 'text.primary', fontWeight: 600 }}>{slot.routeNumber}{plate ? ` (Placa: ${plate})` : ''}</MuiBox>
                                                    </MuiBox>
                                                  );
                                                })()}

                                                {safeStr(slot.schoolSchedule) && (
                                                  <Typography variant="body2"><strong>{(slot && (slot._label === 'Entrada' || slot.type === 'pickup')) ? 'Hora entrada' : (slot && (slot._label === 'Salida' || slot.type === 'dropoff')) ? 'Hora salida' : 'Hora colegio'}:</strong> {formatTime12(slot.schoolSchedule) || safeStr(slot.schoolSchedule)}</Typography>
                                                )}

                                                {safeStr(slot.note) && (
                                                  <Typography variant="body2"><strong>Parada:</strong> {slot.note}</Typography>
                                                )}

                                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                  {(() => {
                                                    const rn = safeStr(slot.routeNumber);
                                                    const routeObj = parentInfo?.routes?.find(r => safeStr(r.routeNumber) === rn);
                                                    if (routeObj && (routeObj.monitoraName || routeObj.monitoraContact)) {
                                                      return (
                                                        <>
                                                          {safeStr(routeObj.monitoraName) && <Typography variant="body2" sx={{ mt: 0.5 }}><strong>Monitora:</strong> {routeObj.monitoraName}</Typography>}
                                                          {safeStr(routeObj.monitoraContact) && <Typography variant="body2" sx={{ mt: 0.5 }}><strong>Teléfono:</strong> {routeObj.monitoraContact}</Typography>}
                                                        </>
                                                      );
                                                    }
                                                    return (
                                                      <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>Sin información adicional</Typography>
                                                    );
                                                  })()}
                                                </Collapse>
                                              </MuiBox>
                                            </Paper>
                                          );
                                        })
                                      )
                                    )}
                                  </Paper>
                                );
                              })}
                            </Stack>
                          </MuiBox>
                        )}
                        {idx < studentsListForSchedule.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </MuiBox>
                    );
                  })}
                  </>
                )}
              </CardContent>
            </SectionCard>
                </Grid>
              )}

              {/* Estudiantes */}
              
            </Grid>
          </Grid>
        </Grid>
      </Container>

      {/* Dialog: Contáctanos */}
      <Dialog open={openContactDialog} onClose={() => setOpenContactDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <MuiBox>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {safeStr(parentInfo.schoolName) || 'Contacto'}
            </Typography>
            <Typography variant="caption" color="text.secondary">Elige un medio para comunicarte</Typography>
          </MuiBox>
          <IconButton onClick={() => setOpenContactDialog(false)} aria-label="Cerrar">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <MuiBox sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<CallIcon />}
              onClick={() => openPhone(parentInfo.contactPhone)}
              disabled={!safeStr(parentInfo.contactPhone)}
            >
              {safeStr(parentInfo.contactPhone) || 'Llamar'}
            </Button>

            <Button
              fullWidth
              variant="contained"
              color="secondary"
              startIcon={<EmailIcon />}
              onClick={() => openEmail(parentInfo.contactEmail)}
              disabled={!safeStr(parentInfo.contactEmail)}
            >
              {safeStr(parentInfo.contactEmail) || 'Correo'}
            </Button>

            <Button
              fullWidth
              variant="contained"
              color="success"
              startIcon={<WhatsAppIcon />}
              onClick={() => openWhatsApp(parentInfo.whatsappLink, parentInfo.contactPhone)}
              disabled={!safeStr(parentInfo.whatsappLink) && !safeStr(parentInfo.contactPhone)}
            >
              WhatsApp
            </Button>
          </MuiBox>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenContactDialog(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para listar contratos y abrir link de firma */}
      <Dialog open={contractsDialogOpen} onClose={handleCloseContractsDialog} fullWidth maxWidth="sm">
        <DialogTitle>Contratos</DialogTitle>
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
