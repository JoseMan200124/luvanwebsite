// src/pages/ScheduledSendsPage.jsx
import { useCallback, useEffect, useState } from 'react';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import moment from 'moment-timezone';
import {
    Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Snackbar, Alert, Stack, Tab,
    Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs,
    Tooltip, Typography,
} from '@mui/material';
import {
    Cancel as CancelIcon, Edit as EditIcon, Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../utils/axiosConfig';
import PermissionGuard from '../components/PermissionGuard';
import CircularMasivaModal from '../components/CircularMasivaModal';
import SendNotificationModal from '../components/SendNotificationModal';
import { SCHEDULE_TIMEZONE, describeSchedule } from '../components/scheduling/scheduleModel';
import AudienceDetail, { AudienceSummaryText } from '../components/scheduling/AudienceDetail';
import {
    cancelScheduledSend, getScheduledSend, listScheduledSends,
} from '../services/scheduledSendService';

const STATUS_TABS = [
    { value: 'active', label: 'Activos' },
    { value: 'completed', label: 'Completados' },
    { value: 'failed', label: 'Fallidos' },
    { value: 'cancelled', label: 'Cancelados' },
    { value: '', label: 'Todos' },
];
const STATUS_CHIP = {
    active: { label: 'Activo', color: 'primary' },
    completed: { label: 'Completado', color: 'success' },
    failed: { label: 'Fallido', color: 'error' },
    cancelled: { label: 'Cancelado', color: 'default' },
};
const RUN_CHIP = {
    running: { label: 'Enviando', color: 'info' },
    sent: { label: 'Enviado', color: 'success' },
    failed: { label: 'Falló', color: 'error' },
    skipped: { label: 'Omitido', color: 'warning' },
};
const KIND_LABEL = { circular: 'Circular', notification: 'Notificación' };
const KIND_PERMISSION = { circular: 'mail-enviar-circular', notification: 'notificaciones-crear' };

// Hora de Guatemala, como se programó (el aviso de la página lo indica).
const formatDateTime = (value) => (value ? moment(value).tz(SCHEDULE_TIMEZONE).format('DD/MM/YYYY HH:mm') : '—');
const itemTitle = (item) => (item.kind === 'circular' ? item.content?.subject : item.content?.title) || '—';

// Mismo procesamiento de colegios que CicloEscolarSelectionPage (grades llega como string JSON).
const normalizeSchools = (raw) => (Array.isArray(raw) ? raw : []).map((school) => {
    let grades = [];
    if (Array.isArray(school.grades)) grades = school.grades;
    else if (typeof school.grades === 'string' && school.grades.trim()) {
        try { grades = JSON.parse(school.grades); } catch { grades = []; }
    }
    return { ...school, grades: Array.isArray(grades) ? grades : [] };
});

const ScheduledSendsPage = () => {
    const [status, setStatus] = useState('active');
    const [kind, setKind] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [data, setData] = useState({ total: 0, items: [] });
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editSchools, setEditSchools] = useState([]);
    const [toCancel, setToCancel] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showError = (err, fallback) => setSnackbar({
        open: true, severity: 'error', message: err?.response?.data?.message || fallback,
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await listScheduledSends({
                page: page + 1,
                pageSize: rowsPerPage,
                ...(status ? { status } : {}),
                ...(kind ? { kind } : {}),
            });
            setData({ total: result.total, items: result.items || [] });
        } catch (err) {
            setSnackbar({ open: true, severity: 'error', message: err?.response?.data?.message || 'Error al cargar los envíos programados.' });
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, status, kind]);

    useEffect(() => { load(); }, [load]);

    // El botón de refrescar global recarga la lista sin perder pestaña ni filtros.
    useRegisterPageRefresh(load);

    const openDetail = async (uuid) => {
        try {
            setDetail(await getScheduledSend(uuid));
        } catch (err) {
            showError(err, 'Error al cargar el detalle.');
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
            load();
        } catch (err) {
            showError(err, 'Error al cancelar el envío.');
        }
    };

    const closeEdit = () => setEditing(null);
    const onEdited = (message) => {
        setSnackbar({ open: true, severity: 'success', message: message || 'Envío programado actualizado.' });
        load();
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" sx={{ mb: 1 }}>Envíos Programados</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                Para programar un envío nuevo, usa "Enviar Circular Masiva" o "Enviar Notificación Push" y elige
                "Programar envío". Aquí puedes revisar, editar o cancelar los programados. Horas de Guatemala.
            </Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                <Tabs value={status} onChange={(_, v) => { setStatus(v); setPage(0); }} variant="scrollable" scrollButtons="auto">
                    {STATUS_TABS.map((t) => <Tab key={t.label} value={t.value} label={t.label} />)}
                </Tabs>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="kind-filter-label">Tipo</InputLabel>
                    <Select labelId="kind-filter-label" label="Tipo" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}>
                        <MenuItem value="">Todos</MenuItem>
                        <MenuItem value="circular">Circulares</MenuItem>
                        <MenuItem value="notification">Notificaciones</MenuItem>
                    </Select>
                </FormControl>
            </Stack>

            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Asunto / Título</TableCell>
                            <TableCell>Audiencia</TableCell>
                            <TableCell>Programación</TableCell>
                            <TableCell>Próximo envío</TableCell>
                            <TableCell>Envíos hechos</TableCell>
                            <TableCell>Estado</TableCell>
                            <TableCell>Creado por</TableCell>
                            <TableCell align="right">Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && (
                            <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                        )}
                        {!loading && data.items.length === 0 && (
                            <TableRow><TableCell colSpan={9} align="center">No hay envíos programados con estos filtros.</TableCell></TableRow>
                        )}
                        {!loading && data.items.map((item) => (
                            <TableRow key={item.uuid} hover>
                                <TableCell><Chip size="small" label={KIND_LABEL[item.kind]} /></TableCell>
                                <TableCell>{itemTitle(item)}</TableCell>
                                <TableCell><AudienceSummaryText summary={item.audienceSummary} /></TableCell>
                                <TableCell>{describeSchedule(item.schedule)}</TableCell>
                                <TableCell>{formatDateTime(item.nextRunAt)}</TableCell>
                                <TableCell>{item.runCount}</TableCell>
                                <TableCell>
                                    <Chip size="small" color={STATUS_CHIP[item.status]?.color} label={STATUS_CHIP[item.status]?.label || item.status} />
                                </TableCell>
                                <TableCell>{item.createdBy?.name || '—'}</TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    <Tooltip title="Ver detalle y envíos realizados">
                                        <IconButton size="small" onClick={() => openDetail(item.uuid)}><VisibilityIcon fontSize="small" /></IconButton>
                                    </Tooltip>
                                    {item.status === 'active' && (
                                        <PermissionGuard permission={KIND_PERMISSION[item.kind]}>
                                            <>
                                                <Tooltip title="Editar">
                                                    <IconButton size="small" onClick={() => openEdit(item.uuid)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Cancelar envío programado">
                                                    <IconButton size="small" color="error" onClick={() => setToCancel(item)}><CancelIcon fontSize="small" /></IconButton>
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
                    count={data.total}
                    page={page}
                    onPageChange={(_, p) => setPage(p)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                    rowsPerPageOptions={[10, 20, 50]}
                    labelRowsPerPage="Filas por página"
                />
            </TableContainer>

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
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {detail.runs.map((run) => (
                                            <TableRow key={run.scheduledFor}>
                                                <TableCell>{formatDateTime(run.scheduledFor)}</TableCell>
                                                <TableCell><Chip size="small" color={RUN_CHIP[run.status]?.color} label={RUN_CHIP[run.status]?.label || run.status} /></TableCell>
                                                <TableCell>{run.recipientsCount ?? '—'}</TableCell>
                                                <TableCell>{run.errorMessage || '—'}</TableCell>
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

            {/* Confirmar cancelación */}
            <Dialog open={!!toCancel} onClose={() => setToCancel(null)}>
                <DialogTitle>Cancelar envío programado</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        ¿Cancelar "{toCancel ? itemTitle(toCancel) : ''}"? No se enviará ninguna ocurrencia más.
                        Lo ya enviado no se modifica. Esta acción no se puede deshacer.
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
