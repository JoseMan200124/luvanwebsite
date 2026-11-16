// src/pages/ScheduledSendsPage.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import moment from 'moment-timezone';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, CircularProgress, Dialog,
    DialogActions, DialogContent, DialogTitle, IconButton,
    Snackbar, Alert, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
    TableRow, Tooltip, Typography,
} from '@mui/material';
import {
    Cancel as CancelIcon, Edit as EditIcon, ExpandMore as ExpandMoreIcon, Replay as ReplayIcon,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../utils/axiosConfig';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PermissionGuard from '../components/PermissionGuard';
import CircularMasivaModal from '../components/CircularMasivaModal';
import SendNotificationModal from '../components/SendNotificationModal';
import { SCHEDULE_TIMEZONE, describeSchedule } from '../components/scheduling/scheduleModel';
import AudienceDetail, { AudienceSummaryText } from '../components/scheduling/AudienceDetail';
import { OUTCOME_REASON_LABEL as REASON_LABEL } from '../utils/outcomeReasons';
import {
    cancelScheduledSend, getScheduledSend, listScheduledSends, resendScheduledSendFailures,
} from '../services/scheduledSendService';

// Secciones desplegables de la vista (una por estado). `hint` explica qué significa cada estado.
const SECTIONS = [
    { status: 'active', label: 'Activos', hint: 'Pendientes de enviarse o con múltiples envíos', color: 'primary' },
    { status: 'completed', label: 'Completados', hint: 'Publicados y con el correo entregado a todos', color: 'success' },
    { status: 'partial', label: 'Parciales', hint: 'Publicados, pero el correo no llegó a todos', color: 'warning' },
    { status: 'failed', label: 'Fallidos', hint: 'No se pudo publicar: nadie lo recibió', color: 'error' },
    { status: 'skipped', label: 'Omitidos', hint: 'Sin destinatarios o fuera de la hora programada', color: 'default' },
    { status: 'cancelled', label: 'Cancelados', hint: 'No se enviarán más ocurrencias', color: 'default' },
];
const DEFAULT_EXPANDED = { active: true };
const STATUS_CHIP = {
    active: { label: 'Activo', color: 'primary' },
    completed: { label: 'Completado', color: 'success' },
    partial: { label: 'Parcial', color: 'warning' },
    failed: { label: 'Fallido', color: 'error' },
    skipped: { label: 'Omitido', color: 'default' },
    cancelled: { label: 'Cancelado', color: 'default' },
};
const RUN_CHIP = {
    running: { label: 'Enviando', color: 'info' },
    sent: { label: 'Enviado', color: 'success' },
    partial: { label: 'Parcial', color: 'warning' },
    failed: { label: 'Falló', color: 'error' },
    skipped: { label: 'Omitido', color: 'warning' },
};
const KIND_LABEL = { circular: 'Circular', notification: 'Notificación' };
const KIND_OPTIONS = [
    { value: 'circular', label: 'Circulares' },
    { value: 'notification', label: 'Notificaciones' },
];
const KIND_PERMISSION = { circular: 'mail-enviar-circular', notification: 'notificaciones-crear' };

// Hora de Guatemala, como se programó (el aviso de la página lo indica).
const formatDateTime = (value) => (value ? moment(value).tz(SCHEDULE_TIMEZONE).format('DD/MM/YYYY HH:mm') : '—');
// Reparto del correo cuando algunos destinatarios no lo recibieron (envío parcial o fallido).
const formatDelivery = (run) => (run?.failedRecipientsCount > 0
    ? `Correo enviado a ${run.recipientsCount ?? 0} y falló a ${run.failedRecipientsCount} destinatarios`
    : '');
const itemTitle = (item) => (item.kind === 'circular' ? item.content?.subject : item.content?.title) || '—';

// Mismo procesamiento de colegios que CicloEscolarSelectionPage (grades llega como string JSON).
const normalizeSchools = (raw) => (Array.isArray(raw) ? raw : []).map((school) => {
    let grades = [];
    if (Array.isArray(school.grades)) {
        grades = school.grades;
    }
    else if (typeof school.grades === 'string' && school.grades.trim()) {
        try { grades = JSON.parse(school.grades); } catch { grades = []; }
    }
    return { ...school, grades: Array.isArray(grades) ? grades : [] };
});

// Una sección desplegable por estado. Carga su propia lista (con su paginación) aunque esté cerrada,
// para mostrar siempre cuántos envíos tiene.
const StatusSection = ({ section, kind, refreshKey, expanded, onToggle, onError, onView, onEdit, onCancel }) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [data, setData] = useState({ total: null, items: [] });
    const [loading, setLoading] = useState(true);
    const showNext = section.status === 'active';
    const columns = showNext ? 9 : 8;

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            try {
                const result = await listScheduledSends({
                    page: page + 1,
                    pageSize: rowsPerPage,
                    status: section.status,
                    ...(kind ? { kind } : {}),
                });
                const lastPage = Math.max(0, Math.ceil((result.total || 0) / rowsPerPage) - 1);
                if (!ignore && page > lastPage) {
                    // La página quedó fuera de rango: se vuelve a la última (el cambio dispara otra carga).
                    setPage(lastPage);
                    return;
                }
                if (!ignore) {
                    setData({ total: result.total, items: result.items || [] });
                }
            } catch (err) {
                if (!ignore) {
                    onError(err, 'Error al cargar los envíos programados.');
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        })();
        return () => { ignore = true; };
    }, [page, rowsPerPage, section.status, kind, refreshKey, onError]);

    const hasItems = (data.total || 0) > 0;

    return (
        <Accordion
            expanded={expanded}
            onChange={onToggle}
            disableGutters
            elevation={0}
            variant="outlined"
            sx={{ mb: 1.5, '&::before': { display: 'none' } }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`${section.status}-content`} id={`${section.status}-header`}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700 }}>{section.label}</Typography>
                    {data.total === null
                        ? <CircularProgress size={16} />
                        : <Chip size="small" label={data.total} color={hasItems ? section.color : 'default'} variant={hasItems ? 'filled' : 'outlined'} />}
                    <Typography variant="body2" color="text.secondary">{section.hint}</Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Asunto / Título</TableCell>
                                <TableCell>Audiencia</TableCell>
                                <TableCell>Programación</TableCell>
                                {showNext && <TableCell>Próximo envío</TableCell>}
                                <TableCell>Envíos hechos</TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell>Creado por</TableCell>
                                <TableCell align="right">Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading && (
                                <TableRow><TableCell colSpan={columns} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                            )}
                            {!loading && data.items.length === 0 && (
                                <TableRow><TableCell colSpan={columns} align="center">No hay envíos en esta sección.</TableCell></TableRow>
                            )}
                            {!loading && data.items.map((item) => (
                                <TableRow key={item.uuid} hover>
                                    <TableCell><Chip size="small" label={KIND_LABEL[item.kind]} /></TableCell>
                                    <TableCell>{itemTitle(item)}</TableCell>
                                    <TableCell><AudienceSummaryText summary={item.audienceSummary} /></TableCell>
                                    <TableCell>{describeSchedule(item.schedule)}</TableCell>
                                    {showNext && <TableCell>{formatDateTime(item.nextRunAt)}</TableCell>}
                                    <TableCell>{item.runCount}</TableCell>
                                    <TableCell>
                                        <Tooltip title={formatDelivery(item.lastRun)}>
                                            <Chip size="small" color={STATUS_CHIP[item.status]?.color} label={STATUS_CHIP[item.status]?.label || item.status} />
                                        </Tooltip>
                                        {formatDelivery(item.lastRun) && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {item.lastRun.recipientsCount ?? 0} enviados · {item.lastRun.failedRecipientsCount} fallidos
                                            </Typography>
                                        )}
                                        {item.schedule?.recurrence && item.lastRun && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Último envío: {RUN_CHIP[item.lastRun.status]?.label || item.lastRun.status}
                                            </Typography>
                                        )}
                                        {REASON_LABEL[item.lastRun?.outcomeReason] && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {REASON_LABEL[item.lastRun.outcomeReason]}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{item.createdBy?.name || '—'}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        <Tooltip title="Ver detalle y envíos realizados">
                                            <IconButton size="small" onClick={() => onView(item.uuid)}><VisibilityIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                        {item.status === 'active' && (
                                            <PermissionGuard permission={KIND_PERMISSION[item.kind]}>
                                                <>
                                                    <Tooltip title="Editar">
                                                        <IconButton size="small" onClick={() => onEdit(item.uuid)}><EditIcon fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Cancelar envío programado">
                                                        <IconButton size="small" color="error" onClick={() => onCancel(item)}><CancelIcon fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                </>
                                            </PermissionGuard>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={data.total || 0}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                        rowsPerPageOptions={[10, 20, 50]}
                        labelRowsPerPage="Filas por página"
                    />
                </TableContainer>
            </AccordionDetails>
        </Accordion>
    );
};

const ScheduledSendsPage = () => {
    // Cada sección se vuelve a montar (key con el tipo) al aplicar, así su paginación arranca en la página 1.
    const pageFilters = useFilters({
        fields: [F.select('kind', { label: 'Tipo', options: KIND_OPTIONS })],
    });
    const { kind } = pageFilters.applied;
    const [expanded, setExpanded] = useState(DEFAULT_EXPANDED);
    // Se incrementa para que todas las secciones vuelvan a cargar su lista.
    const [refreshKey, setRefreshKey] = useState(0);
    const [detail, setDetail] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editSchools, setEditSchools] = useState([]);
    const [toCancel, setToCancel] = useState(null);
    const [toResend, setToResend] = useState(null);
    const [resending, setResending] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showError = useCallback((err, fallback) => setSnackbar({
        open: true, severity: 'error', message: err?.response?.data?.message || fallback,
    }), []);

    const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

    // El botón de refrescar global recarga todas las secciones sin perder filtro ni secciones abiertas.
    useRegisterPageRefresh(refresh);

    const toggleSection = (status) => (_, isOpen) => setExpanded((prev) => ({ ...prev, [status]: isOpen }));

    const openDetail = async (uuid) => {
        try {
            setDetail(await getScheduledSend(uuid));
        } catch (err) {
            showError(err, 'Error al cargar el detalle.');
        }
    };

    // Un reenvío a fallidos corre en segundo plano: mientras haya una ejecución en curso se
    // refresca solo el detalle; las secciones se recargan una vez cuando termina.
    const detailUuid = detail?.uuid;
    const hasRunningRun = !!detail?.runs?.some((run) => run.status === 'running');
    useEffect(() => {
        if (!detailUuid || !hasRunningRun) {
            return undefined;
        }
        const timer = setTimeout(async () => {
            try {
                setDetail(await getScheduledSend(detailUuid));
            } catch {
                // Se reintenta en el siguiente ciclo si el detalle sigue abierto.
            }
        }, 4000);
        return () => clearTimeout(timer);
    }, [detailUuid, hasRunningRun, detail]);

    const wasRunning = useRef(false);
    useEffect(() => {
        if (wasRunning.current && !hasRunningRun) {
            refresh();
        }
        wasRunning.current = hasRunningRun;
    }, [hasRunningRun, refresh]);

    const confirmResend = async () => {
        setResending(true);
        try {
            const result = await resendScheduledSendFailures(detail.uuid, toResend.id);
            setSnackbar({ open: true, severity: 'success', message: result?.message || 'Reenviando el correo a los destinatarios fallidos.' });
            setToResend(null);
            setDetail(await getScheduledSend(detail.uuid));
            refresh();
        } catch (err) {
            showError(err, 'Error al reenviar a los destinatarios fallidos.');
        } finally {
            setResending(false);
        }
    };

    const openEdit = async (uuid) => {
        try {
            const item = await getScheduledSend(uuid);
            // El panel de audiencia necesita los colegios del ciclo del envío.
            const response = await api.get('/schools', { params: { cicloEscolarId: item.cicloEscolarId, includeArchived: true } });
            setEditSchools(normalizeSchools(response.data?.schools));
            setEditing(item);
        } catch (err) {
            showError(err, 'Error al abrir el envío para editar.');
        }
    };

    const confirmCancel = async () => {
        try {
            await cancelScheduledSend(toCancel.uuid);
            setSnackbar({ open: true, severity: 'success', message: 'Envío programado cancelado.' });
            setToCancel(null);
            refresh();
        } catch (err) {
            showError(err, 'Error al cancelar el envío.');
        }
    };

    const closeEdit = () => setEditing(null);
    const onEdited = (message) => {
        setSnackbar({ open: true, severity: 'success', message: message || 'Envío programado actualizado.' });
        refresh();
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" sx={{ mb: 1 }}>Envíos Programados</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                Para programar un envío nuevo, usa "Enviar Circular Masiva" o "Enviar Notificación Push" y elige
                "Programar envío". Aquí puedes revisar, editar o cancelar los programados. Horas de Guatemala.
            </Alert>

            <FilterBar {...pageFilters.barProps} />

            {SECTIONS.map((section) => (
                <StatusSection
                    key={`${section.status}-${kind}`}
                    section={section}
                    kind={kind}
                    refreshKey={refreshKey}
                    expanded={!!expanded[section.status]}
                    onToggle={toggleSection(section.status)}
                    onError={showError}
                    onView={openDetail}
                    onEdit={openEdit}
                    onCancel={setToCancel}
                />
            ))}

            {/* Detalle */}
            <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
                <DialogTitle>{detail ? `${KIND_LABEL[detail.kind]}: ${itemTitle(detail)}` : ''}</DialogTitle>
                <DialogContent dividers>
                    {detail && (
                        <Stack spacing={2}>
                            <Typography variant="body2"><strong>Programación:</strong> {describeSchedule(detail.schedule)}</Typography>
                            <Typography variant="body2"><strong>Próximo envío:</strong> {formatDateTime(detail.nextRunAt)}</Typography>
                            <Box><Typography variant="body2" sx={{ mb: 0.5 }}><strong>Audiencia</strong></Typography><AudienceDetail detail={detail.audienceDetail} /></Box>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                <strong>{detail.kind === 'circular' ? 'Mensaje' : 'Mensaje push'}:</strong>{' '}
                                {detail.kind === 'circular' ? detail.content?.body : detail.content?.message}
                            </Typography>
                            {detail.kind === 'circular' && (
                                <Typography variant="body2">
                                    <strong>Correo:</strong> {detail.content?.sendEmail ? 'Sí' : 'No'} · <strong>Adjunto:</strong> {detail.attachment?.name || 'Sin adjunto'}
                                </Typography>
                            )}
                            <Typography variant="subtitle2">Envíos realizados</Typography>
                            {detail.runs.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Todavía no se ha enviado.</Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Programado para</TableCell>
                                            <TableCell>Resultado</TableCell>
                                            <TableCell>Destinatarios</TableCell>
                                            <TableCell>Detalle</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {detail.runs.map((run) => (
                                            <TableRow key={run.scheduledFor}>
                                                <TableCell>{formatDateTime(run.scheduledFor)}</TableCell>
                                                <TableCell><Chip size="small" color={RUN_CHIP[run.status]?.color} label={RUN_CHIP[run.status]?.label || run.status} /></TableCell>
                                                <TableCell>
                                                    {run.failedRecipientsCount > 0
                                                        ? `${run.recipientsCount ?? 0} enviados · ${run.failedRecipientsCount} fallidos`
                                                        : (run.recipientsCount ?? '—')}
                                                </TableCell>
                                                <TableCell>{[REASON_LABEL[run.outcomeReason], run.errorMessage].filter(Boolean).join(' · ') || '—'}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                    {run.canResend && (
                                                        <PermissionGuard permission={KIND_PERMISSION[detail.kind]}>
                                                            <Tooltip title="Envía el correo solo a quienes no lo recibieron. No duplica la circular ni la notificación en el sistema.">
                                                                <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={() => setToResend(run)}>
                                                                    Reenviar a fallidos
                                                                </Button>
                                                            </Tooltip>
                                                        </PermissionGuard>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions><Button onClick={() => setDetail(null)}>Cerrar</Button></DialogActions>
            </Dialog>

            {/* Confirmar reenvío a fallidos */}
            <Dialog open={!!toResend} onClose={() => !resending && setToResend(null)}>
                <DialogTitle>Reenviar a fallidos</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Se enviará el correo únicamente a los {toResend?.pendingEmailsCount ?? toResend?.failedRecipientsCount ?? 0} destinatarios que no lo recibieron.
                        La circular y la notificación ya están publicadas en el sistema y no se duplican.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setToResend(null)} disabled={resending}>Volver</Button>
                    <Button variant="contained" onClick={confirmResend} disabled={resending}>
                        {resending ? 'Reenviando…' : 'Reenviar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmar cancelación */}
            <Dialog open={!!toCancel} onClose={() => setToCancel(null)}>
                <DialogTitle>Cancelar envío programado</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        ¿Cancelar "{toCancel ? itemTitle(toCancel) : ''}"? No se enviará ninguna ocurrencia más.
                        Lo ya enviado no se modifica, y un envío que esté en curso en este momento terminará normalmente. Esta acción no se puede deshacer.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setToCancel(null)}>Volver</Button>
                    <Button color="error" variant="contained" onClick={confirmCancel}>Cancelar envío</Button>
                </DialogActions>
            </Dialog>

            <CircularMasivaModal
                open={editing?.kind === 'circular'}
                onClose={closeEdit}
                schools={editSchools}
                cicloEscolarId={editing?.cicloEscolarId || null}
                editing={editing?.kind === 'circular' ? editing : null}
                onSuccess={onEdited}
            />
            <SendNotificationModal
                open={editing?.kind === 'notification'}
                onClose={closeEdit}
                schools={editSchools}
                cicloEscolarId={editing?.cicloEscolarId || null}
                editing={editing?.kind === 'notification' ? editing : null}
                onSuccess={onEdited}
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ScheduledSendsPage;
