import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Stack,
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Replay as ReplayIcon,
  Visibility as VisibilityIcon,
  MailOutline as MailOutlineIcon,
} from '@mui/icons-material';
import moment from 'moment-timezone';
import parse from 'html-react-parser';

import api from '../utils/axiosConfig';
import PermissionGuard from '../components/PermissionGuard';
import ScheduledOriginChip from '../components/ScheduledOriginChip';
import { OUTCOME_REASON_LABEL } from '../utils/outcomeReasons';
import { getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import { getClientSchoolId } from '../utils/clientValue';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import { formatDateTime } from '../utils/dateFormat';
import { EMAIL_STATUS } from '../constants/statuses';
import AppDialog from '../components/dialogs/AppDialog';

const safeStr = (v) => (v == null ? '' : String(v)).trim();

const ALL_CLIENTS_VALUE = 'all';

const MAX_VISIBLE_SCHOOL_NAMES = 2;

// Resultado de la entrega por correo. Sin dato (null): circulares anteriores o enviadas sin correo.
const emailDeliveryText = (item) => {
  const sent = Number(item?.emailSentCount) || 0;
  const failed = Number(item?.emailFailedCount) || 0;
  if (failed <= 0) {
    return '';
  }
  return sent > 0
    ? `Correo enviado a ${sent} y falló a ${failed} destinatarios`
    : `El correo no se pudo enviar a ninguno de los ${failed} destinatarios`;
};

// Mientras un reenvío corre en segundo plano ('sending') se refresca solo. Un 'sending' que
// aún permite reenviar quedó huérfano (reinicio del servidor): no se espera por él.
const isResendInProgress = (item) => item?.emailStatus === 'sending' && !item?.canResend;

const renderEmailStatus = (item) => {
  const chip = EMAIL_STATUS[item?.emailStatus];
  if (!chip) {
    return '—';
  }
  const text = emailDeliveryText(item);
  return (
    <Tooltip title={text}>
      <Box component="span" sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <Chip size="small" color={chip.color} label={chip.label} sx={{ fontWeight: 700 }} />
        {text && (
          <Typography variant="caption" color="text.secondary">
            {Number(item.emailSentCount) || 0} enviados · {Number(item.emailFailedCount) || 0} fallidos
          </Typography>
        )}
        {OUTCOME_REASON_LABEL[item.emailOutcomeReason] && (
          <Typography variant="caption" color="text.secondary">
            {OUTCOME_REASON_LABEL[item.emailOutcomeReason]}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

// Celda "Audiencia": el backend resuelve `audience` desde el targeting de la
// circular (todos / uno o varios colegios / familias concretas).
const renderAudience = (row) => {
  const audience = row?.audience;
  const names = Array.isArray(audience?.schoolNames) ? audience.schoolNames : [];

  const schoolsLabel = names.length > MAX_VISIBLE_SCHOOL_NAMES
    ? `${names.slice(0, MAX_VISIBLE_SCHOOL_NAMES).join(', ')} +${names.length - MAX_VISIBLE_SCHOOL_NAMES}`
    : names.join(', ');
  const schoolsText = names.length > 0 ? (
    <Tooltip title={names.join(', ')}>
      <Typography variant="body2" component="span">{schoolsLabel}</Typography>
    </Tooltip>
  ) : null;

  if (audience?.kind === 'families') {
    const count = Number(audience.familiesCount) || 0;
    return (
      <Chip
        label={`${count} ${count === 1 ? 'familia específica' : 'familias específicas'}`}
        size="small"
        variant="outlined"
        color="secondary"
        sx={{ fontWeight: 700 }}
      />
    );
  }

  if (audience?.kind === 'schools' && schoolsText) {
      return schoolsText;
  }

  // Sin `audience` (respuesta antigua) solo se conoce el colegio único de la fila.
  if (!audience && safeStr(row?.school?.name)) {
      return safeStr(row.school.name);
  }

  return (
    <Chip
      label="Todos los colegios"
      size="small"
      variant="outlined"
      color="primary"
      sx={{ fontWeight: 700 }}
    />
  );
};

const withPdfViewerParams = (url) => {
  const u = safeStr(url);
  if (!u) {
      return u;
  }
  if (u.includes('#')) {
      return u;
  }
  return `${u}#toolbar=0&navpanes=0&scrollbar=0`;
};

const getRecipientLabel = (recipient) => {
  const name = safeStr(recipient?.name) || `Usuario ${recipient?.id}`;
  const email = safeStr(recipient?.email) || 'Sin correo';
  return `${name} - ${email}`;
};

const getRecipientRoleLabel = (role) => {
  const normalizedRole = safeStr(role).toLowerCase();
  if (normalizedRole === 'padre' || normalizedRole === 'padres') {
      return 'Familia';
  }
  return safeStr(role) || 'Sin rol';
};

// Columnas de la tabla
const COLUMNS = [
  { id: 'sentAt', label: 'Enviada', sortable: true },
  { id: 'subject', label: 'Asunto', sortable: true },
  { id: 'audiencia', label: 'Audiencia' },
  { id: 'correo', label: 'Correo' },
  { id: 'archivo_adjunto', label: 'Archivo adjunto', align: 'center' },
  { id: 'acciones', label: 'Acciones', align: 'right' },
];

const CircularHistoryPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  // Paginación y orden (en el servidor)
  const table = useTableState({ defaultOrderBy: 'sentAt', defaultOrder: 'desc' });
  const { page, rowsPerPage, orderBy: sortBy, order: sortDirection } = table;

  const [schools, setSchools] = useState([]);

  const pageFilters = useFilters({
    fields: [
      F.cycle(),
      F.client({ schools, corporations: [] }),
      F.search('q', { placeholder: 'Asunto o contenido' }),
      F.dateRange('dates'),
    ],
    onApplied: table.resetPage,
  });
  const { cycle: selectedCicloEscolar, client: selectedClient, q, dates } = pageFilters.applied;
  const draftCycle = pageFilters.draft.cycle;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const notify = useNotify();
  const confirm = useConfirm();

  const listParams = useMemo(() => {
    const params = {
      page: page + 1,
      pageSize: rowsPerPage,
      // Evita que axiosConfig inyecte el contexto automáticamente.
      // 'all' significa: sin filtro por cliente.
      schoolId: getClientSchoolId(selectedClient) || ALL_CLIENTS_VALUE,
      sortBy,
      sortDirection: String(sortDirection || 'desc').toUpperCase(),
      // "Todos los ciclos" envía allCycles: así el interceptor no inyecta el ciclo de la pestaña.
      ...getCicloEscolarFilterParams(selectedCicloEscolar),
    };

    const query = safeStr(q);
    if (query) {
        params.q = query;
    }

    if (dates.from) {
        params.startDate = moment(dates.from).startOf('day').toDate().toISOString();
    }
    if (dates.to) {
        params.endDate = moment(dates.to).endOf('day').toDate().toISOString();
    }

    return params;
  }, [page, rowsPerPage, q, selectedClient, selectedCicloEscolar, dates, sortBy, sortDirection]);

  // Los colegios del selector siguen al ciclo que se está eligiendo
  const fetchSchools = useCallback(async () => {
    try {
      const res = await api.get('/schools', {
        params: { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true },
      });
      const list = res?.data?.schools;
      setSchools(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('[CircularHistory] schools fetch error', e);
      setSchools([]);
    }
  }, [draftCycle]);

  // `silent`: recarga en segundo plano (sondeo de un reenvío) sin reemplazar la tabla por el spinner.
  const fetchRows = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError('');

    try {
      const res = await api.get('/circulars/admin', { params: listParams });
      const data = res?.data || {};
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total) || 0);
    } catch (e) {
      console.error('[CircularHistory] fetch error', e);
      const msg = e?.response?.data?.message || 'No se pudo cargar el historial de circulares.';
      setError(msg);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listParams]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const filteredRecipientGroups = useMemo(() => {
    const groups = Array.isArray(detail?.recipientGroups) ? detail.recipientGroups : [];
    const query = safeStr(recipientSearch).toLowerCase();

    if (!query) {
        return groups;
    }

    return groups
      .map((group) => {
        const users = Array.isArray(group?.users) ? group.users : [];
        const filteredUsers = users.filter((user) => {
          const haystack = [group?.schoolName, user?.name, user?.email, user?.role]
            .map((value) => safeStr(value).toLowerCase())
            .join(' ');
          return haystack.includes(query);
        });

        return { ...group, users: filteredUsers };
      })
      .filter((group) => group.users.length > 0);
  }, [detail?.recipientGroups, recipientSearch]);

  const refreshDetail = useCallback(async (uuid) => {
    try {
      const res = await api.get(`/circulars/admin/${uuid}`);
      // Si el diálogo se cerró mientras llegaba la respuesta, no se vuelve a poblar el detalle.
      setDetail((prev) => (prev?.uuid === uuid ? res?.data || null : prev));
    } catch (e) {
      console.warn('[CircularHistory] detail refresh error', e);
    }
  }, []);

  const handleResend = async (item) => {
    const { uuid } = item;
    let res = null;
    const ok = await confirm({
      title: 'Reenviar a fallidos',
      message: `Se enviará el correo únicamente a los ${item?.emailPendingCount ?? item?.emailFailedCount ?? 0} destinatarios que no lo recibieron. La circular y la notificación ya están publicadas en el sistema y no se duplican.`,
      confirmLabel: 'Reenviar',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        res = await api.post(`/circulars/admin/${uuid}/resend-failed`);
      },
      errorMessage: 'No se pudo reenviar a los destinatarios fallidos',
    });
    if (!ok) {
      return;
    }
    notify.success(res?.data?.message || 'Reenviando el correo a los destinatarios fallidos');
    fetchRows();
    if (detail?.uuid === uuid) {
      refreshDetail(uuid);
    }
  };

  // Un reenvío corre en segundo plano: mientras haya uno en curso se refresca la lista y el detalle.
  const resendInProgress = rows.some(isResendInProgress) || isResendInProgress(detail);
  useEffect(() => {
    if (!resendInProgress) {
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchRows({ silent: true });
      if (detail?.uuid) {
        refreshDetail(detail.uuid);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [resendInProgress, rows, detail, fetchRows, refreshDetail]);

  const openDetail = async (uuid) => {
    const id = safeStr(uuid);
    if (!id) {
        return;
    }

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    setRecipientSearch('');
    setRecipientsOpen(false);

    try {
      const res = await api.get(`/circulars/admin/${id}`);
      setDetail(res?.data || null);
    } catch (e) {
      console.error('[CircularHistory] detail error', e);
      const msg = e?.response?.data?.message || 'No se pudo cargar el detalle de la circular.';
      setDetailError(msg);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
    setRecipientSearch('');
    setRecipientsOpen(false);
  };

  const downloadAttachment = async (attachmentUuid) => {
    const id = safeStr(attachmentUuid);
    if (!id) {
        return;
    }

    try {
      const res = await api.get(`/circulars/admin/attachments/${id}/url`);
      const url = safeStr(res?.data?.url);
      if (!url) {
          return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('[CircularHistory] download attachment error', e);
    }
  };
  const renderAttachmentPreview = (attachment) => {
    const url = safeStr(attachment?.downloadUrl);
    if (!url) {
      return (
        <Typography variant="body2" color="text.secondary">
          Archivo no disponible.
        </Typography>
      );
    }
    const mime = safeStr(attachment?.mimeType).toLowerCase();

    if (mime.startsWith('image/')) {
      return (
        <Box
          component="img"
          src={url}
          alt={safeStr(attachment?.originalName) || 'Adjunto'}
          sx={{
            width: '100%',
            maxHeight: 520,
            objectFit: 'contain',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        />
      );
    }

    const isPdf = mime === 'application/pdf' || url.toLowerCase().includes('.pdf');
    if (isPdf) {
      return (
        <Box
          sx={{
            width: '100%',
            height: 520,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <iframe
            title={safeStr(attachment?.originalName) || 'Vista previa'}
            src={withPdfViewerParams(url)}
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        </Box>
      );
    }

    return (
      <Typography variant="body2" color="text.secondary">
        No se puede previsualizar este tipo de archivo.
      </Typography>
    );
  };

  return (
    <PageContainer width="xl">
      <PageHeader
        eyebrow={MODULE_GROUPS.clientes}
        title="Historial de Circulares"
        subtitle="Circulares enviadas desde el sistema"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <FilterBar {...pageFilters.barProps} loading={loading} />

      <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <AppTableContainer>
          <Table size="small">
            <SortableTableHead columns={COLUMNS} cellSx={{ fontWeight: 800 }} {...table.sortProps} />

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No hay circulares para mostrar.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.uuid} hover>
                    <TableCell>{formatDateTime(r.sentAt) || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 520 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {safeStr(r.subject) || 'Circular'}
                        </Typography>
                        {r.isScheduled && <ScheduledOriginChip />}
                      </Box>
                    </TableCell>
                    <TableCell>{renderAudience(r)}</TableCell>
                    <TableCell>{renderEmailStatus(r)}</TableCell>
                    <TableCell align="center">{r.hasAttachment ? 'Sí' : 'No'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <RowActions
                        actions={[
                          { key: 'view', kind: 'view', label: 'Ver detalle', icon: <VisibilityIcon fontSize="small" />, onClick: () => openDetail(r.uuid) },
                          r.canResend && { key: 'resend', kind: 'other', color: 'warning', label: 'Reenviar a fallidos', tooltip: 'Reenviar el correo solo a quienes no lo recibieron', icon: <ReplayIcon fontSize="small" />, permission: 'mail-enviar-circular', onClick: () => handleResend(r) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AppTableContainer>

        <AppTablePagination count={total} {...table.paginationProps} />
      </Paper>

      <AppDialog
        open={detailOpen}
        onClose={closeDetail}
        title={safeStr(detail?.subject) || 'Circular'}
        subtitle={`Enviada: ${formatDateTime(detail?.sentAt)}`}
        icon={<MailOutlineIcon />}
        size="md"
        readOnly
      >
        {detail?.isScheduled && (
          <Box sx={{ mb: 2 }}>
            <ScheduledOriginChip />
          </Box>
        )}
        {detailLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : detailError ? (
          <Alert severity="error">{detailError}</Alert>
        ) : (
          <>
            {EMAIL_STATUS[detail?.emailStatus] && detail.emailStatus !== 'sent' && (
              <Alert
                severity={detail.emailStatus === 'sending' ? 'info' : 'warning'}
                sx={{ mb: 2 }}
                action={detail.canResend ? (
                  <PermissionGuard permission="mail-enviar-circular">
                    <Button color="inherit" size="small" startIcon={<ReplayIcon />} onClick={() => handleResend(detail)}>
                      Reenviar a fallidos
                    </Button>
                  </PermissionGuard>
                ) : undefined}
              >
                {detail.emailStatus === 'sending'
                  ? 'Reenviando el correo a los destinatarios que no lo recibieron…'
                  : `${emailDeliveryText(detail) || 'El correo no se pudo entregar a algunos destinatarios'}. La circular sí está publicada en el sistema.`}
              </Alert>
            )}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#1976d2', fontWeight: 800 }}>
                  Destinatarios
                </Typography>

                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={() => setRecipientsOpen((value) => !value)}
                  endIcon={
                    <ExpandMoreIcon
                      sx={{
                        transform: recipientsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms',
                      }}
                    />
                  }
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                    borderColor: 'rgba(25, 118, 210, 0.24)',
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      borderColor: 'primary.main',
                    },
                    whiteSpace: 'nowrap',
                  }}
                  aria-label={recipientsOpen ? 'Ocultar destinatarios' : 'Mostrar destinatarios'}
                >
                  {recipientsOpen ? 'Ocultar' : 'Mostrar'}
                </Button>
              </Box>

              {recipientsOpen && (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    label="Buscar destinatario"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Nombre, correo, rol o colegio"
                    sx={{ mb: 1.5 }}
                  />

                  <Box
                    sx={{
                      maxHeight: 360,
                      overflowY: 'auto',
                      pr: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.5,
                      backgroundColor: 'background.paper',
                    }}
                  >
                    {filteredRecipientGroups.length > 0 ? (
                      <Stack spacing={2}>
                        {filteredRecipientGroups.map((group) => (
                          <Box key={String(group.schoolId || group.schoolName)}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                              <Chip
                                label={group.schoolName || 'Sin colegio'}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 700 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {group.users.length} usuario{group.users.length === 1 ? '' : 's'}
                              </Typography>
                            </Box>

                            <Stack spacing={1}>
                              {group.users.map((recipient) => (
                                <Box
                                  key={recipient.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    gap: 2,
                                    p: 1.25,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {getRecipientLabel(recipient)}
                                      </Typography>
                                      <Chip
                                        size="small"
                                        label={getRecipientRoleLabel(recipient.role)}
                                        variant="filled"
                                        color="default"
                                        sx={{ fontWeight: 700 }}
                                      />
                                    </Box>
                                  </Box>
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No hay destinatarios que coincidan con la búsqueda.
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#1976d2', fontWeight: 800 }}>
                Mensaje
              </Typography>
              <Box sx={{ '& p': { marginTop: 0 } }}>
                {safeStr(detail?.body) ? parse(String(detail.body)) : <Typography variant="body2">—</Typography>}
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#1976d2', fontWeight: 800 }}>
                Archivo adjunto
              </Typography>

              {Array.isArray(detail?.attachments) && detail.attachments.length > 0 ? (
                <Grid container spacing={1}>
                  {detail.attachments.map((a) => (
                    <Grid item xs={12} key={a.uuid}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                                {safeStr(a.originalName) || 'Adjunto'}
                              </Typography>
                              {safeStr(a.mimeType) && (
                                <Typography variant="caption" color="text.secondary">{a.mimeType}</Typography>
                              )}
                            </Box>

                            <Button
                              variant="contained"
                              startIcon={<DownloadIcon />}
                              onClick={() => downloadAttachment(a.uuid)}
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              Descargar
                            </Button>
                          </Box>

                          {renderAttachmentPreview(a)}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography variant="body2">No hay adjuntos.</Typography>
              )}
            </Box>
          </>
        )}
      </AppDialog>


    </PageContainer>
  );
};

export default CircularHistoryPage;
