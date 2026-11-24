// src/pages/ScheduledSendsPage.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, CircularProgress, Alert, Stack, Table, TableBody, TableCell, TableHead,
    TableRow, Tooltip, Typography,
} from '@mui/material';
import {
    Cancel as CancelIcon, Edit as EditIcon, ExpandMore as ExpandMoreIcon, Replay as ReplayIcon,
    Visibility as VisibilityIcon, ScheduleSend as ScheduleSendIcon,
} from '@mui/icons-material';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import PermissionGuard from '../components/PermissionGuard';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import CircularMasivaModal from '../components/CircularMasivaModal';
import SendNotificationModal from '../components/SendNotificationModal';
import { describeSchedule } from '../components/scheduling/scheduleModel';
import AudienceDetail, { AudienceSummaryText } from '../components/scheduling/AudienceDetail';
import { OUTCOME_REASON_LABEL as REASON_LABEL } from '../utils/outcomeReasons';
import {
    cancelScheduledSend, getScheduledSend, listScheduledSends, resendScheduledSendFailures,
} from '../services/scheduledSendService';
import { formatDateTime } from '../utils/dateFormat';
import { SCHEDULED_SEND_STATUS, SCHEDULED_RUN_STATUS, getStatusLabel } from '../constants/statuses';
import StatusChip from '../components/StatusChip';
import AppDialog from '../components/dialogs/AppDialog';
import { loadCatalog } from '../services/catalogStore';

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
const KIND_LABEL = { circular: 'Circular', notification: 'Notificación' };
const KIND_OPTIONS = [
    { value: 'circular', label: 'Circulares' },
    { value: 'notification', label: 'Notificaciones' },
];
const KIND_PERMISSION = { circular: 'mail-enviar-circular', notification: 'notificaciones-crear' };

// Hora de Guatemala, como se programó (el aviso de la página lo indica).
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
    // Paginación (en el servidor), propia de cada sección
    const table = useTableState();
    const { page, rowsPerPage, setPage } = table;
    const [data, setData] = useState({ total: null, items: [] });
    const [loading, setLoading] = useState(true);
    const showNext = section.status === 'active';
    const tableColumns = [
        { id: 'kind', label: 'Tipo' },
        { id: 'title', label: 'Asunto / Título' },
        { id: 'audience', label: 'Audiencia' },
        { id: 'schedule', label: 'Programación' },
        showNext && { id: 'nextRunAt', label: 'Próximo envío' },
        { id: 'runCount', label: 'Envíos hechos' },
        { id: 'status', label: 'Estado' },
        { id: 'createdBy', label: 'Creado por' },
        { id: 'actions', label: 'Acciones', align: 'right' },
    ].filter(Boolean);
    const columns = tableColumns.length;

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
    }, [page, rowsPerPage, setPage, section.status, kind, refreshKey, onError]);

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
                <AppTableContainer>
                    <Table size="small">
                        <SortableTableHead columns={tableColumns} />
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
                                            <StatusChip domain={SCHEDULED_SEND_STATUS} value={item.status} />
                                        </Tooltip>
                                        {formatDelivery(item.lastRun) && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {item.lastRun.recipientsCount ?? 0} enviados · {item.lastRun.failedRecipientsCount} fallidos
                                            </Typography>
                                        )}
                                        {item.schedule?.recurrence && item.lastRun && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Último envío: {getStatusLabel(SCHEDULED_RUN_STATUS, item.lastRun.status)}
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
                                        <RowActions
                                            actions={[
                                                { key: 'view', kind: 'view', label: 'Ver detalle y envíos realizados', icon: <VisibilityIcon fontSize="small" />, onClick: () => onView(item.uuid) },
                                                item.status === 'active' && { key: 'edit', kind: 'edit', label: 'Editar', icon: <EditIcon fontSize="small" />, permission: KIND_PERMISSION[item.kind], onClick: () => onEdit(item.uuid) },
                                                item.status === 'active' && { key: 'cancel', kind: 'delete', label: 'Cancelar envío programado', icon: <CancelIcon fontSize="small" />, permission: KIND_PERMISSION[item.kind], onClick: () => onCancel(item) },
                                            ]}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <AppTablePagination count={data.total || 0} {...table.paginationProps} />
                </AppTableContainer>
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
    const notify = useNotify();
    const confirm = useConfirm();

    const showError = useCallback((err, fallback) => notify.fromError(err, fallback), [notify]);

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

    const handleResend = async (run) => {
        const { uuid } = detail;
        let result = null;
        const ok = await confirm({
            title: 'Reenviar a fallidos',
            message: `Se enviará el correo únicamente a los ${run?.pendingEmailsCount ?? run?.failedRecipientsCount ?? 0} destinatarios que no lo recibieron. La circular y la notificación ya están publicadas en el sistema y no se duplican.`,
            confirmLabel: 'Reenviar',
            cancelLabel: 'Volver',
            onConfirm: async () => {
                result = await resendScheduledSendFailures(uuid, run.id);
            },
            errorMessage: 'Error al reenviar a los destinatarios fallidos',
        });
        if (!ok) {
            return;
        }
        notify.success(result?.message || 'Reenviando el correo a los destinatarios fallidos');
        refresh();
        try {
            setDetail(await getScheduledSend(uuid));
        } catch (err) {
            showError(err, 'Error al actualizar el detalle');
        }
    };

    const openEdit = async (uuid) => {
        try {
            const item = await getScheduledSend(uuid);
            // El panel de audiencia necesita los colegios del ciclo del envío.
            const schoolsList = await loadCatalog('schools', { cicloEscolarId: item.cicloEscolarId, includeArchived: true });
            setEditSchools(normalizeSchools(schoolsList));
            setEditing(item);
        } catch (err) {
            showError(err, 'Error al abrir el envío para editar.');
        }
    };

    const handleCancel = async (item) => {
        const ok = await confirm({
            title: 'Cancelar envío programado',
            message: `Se cancelará "${itemTitle(item)}" y no se enviará ninguna ocurrencia más. Lo ya enviado no se modifica, y un envío que esté en curso en este momento terminará normalmente. Esta acción no se puede deshacer.`,
            confirmLabel: 'Cancelar envío',
            cancelLabel: 'Volver',
            tone: 'danger',
            onConfirm: () => cancelScheduledSend(item.uuid),
            errorMessage: 'Error al cancelar el envío',
        });
        if (ok) {
            notify.success('Envío programado cancelado');
            refresh();
        }
    };

    const closeEdit = () => setEditing(null);
    const onEdited = (message) => {
        notify.success(message || 'Envío programado actualizado.');
        refresh();
    };

    return (
        <PageContainer width="xl">
            <PageHeader eyebrow={MODULE_GROUPS.clientes} title="Envíos Programados">
                <Alert severity="info">
                    Para programar un envío nuevo, usa "Enviar Circular Masiva" o "Enviar Notificación Push" y elige
                    "Programar envío". Aquí puedes revisar, editar o cancelar los programados. Horas de Guatemala.
                </Alert>
            </PageHeader>

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
                    onCancel={handleCancel}
                />
            ))}

            {/* Detalle */}
            <AppDialog
                open={!!detail}
                onClose={() => setDetail(null)}
                title={detail ? itemTitle(detail) : ''}
                subtitle={detail ? KIND_LABEL[detail.kind] : undefined}
                icon={<ScheduleSendIcon />}
                size="md"
                readOnly
            >
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
                                            <TableCell><StatusChip domain={SCHEDULED_RUN_STATUS} value={run.status} /></TableCell>
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
                                                            <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={() => handleResend(run)}>
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
            </AppDialog>

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
        </PageContainer>
    );
};

export default ScheduledSendsPage;
