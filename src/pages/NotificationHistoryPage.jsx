import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import moment from 'moment-timezone';

import ScheduledOriginChip from '../components/ScheduledOriginChip';
import { getCicloEscolarOptionLabel } from '../services/cicloEscolarService';
import { getNotificationHistoryDetail, listNotificationHistory } from '../services/notificationService';
import { getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import { formatDateTime } from '../utils/dateFormat';

const safeStr = (v) => (v == null ? '' : String(v)).trim();

const MAX_VISIBLE_SCHOOL_NAMES = 2;

const getRoleLabel = (role) => {
  const normalizedRole = safeStr(role).toLowerCase();
  if (normalizedRole === 'padre' || normalizedRole === 'padres') {
      return 'Familia';
  }
  return safeStr(role) || 'Sin rol';
};

const getRecipientLabel = (recipient) => {
  const name = safeStr(recipient?.name) || `Usuario ${recipient?.id}`;
  const email = safeStr(recipient?.email) || 'Sin correo';
  return `${name} - ${email}`;
};

// Celda "Audiencia": el backend resuelve `audience` desde el targetingCriteria
// (usuarios concretos / uno o varios colegios / todos) y los roles destinatarios.
const renderAudience = (audience) => {
  if (!audience) {
      return '—';
  }

  if (audience.kind === 'users') {
    const count = Number(audience.usersCount) || 0;
    return (
      <Chip
        label={`${count} ${count === 1 ? 'usuario específico' : 'usuarios específicos'}`}
        size="small"
        variant="outlined"
        color="secondary"
        sx={{ fontWeight: 700 }}
      />
    );
  }

  const names = Array.isArray(audience.schoolNames) ? audience.schoolNames : [];
  const roles = Array.isArray(audience.roleNames) ? audience.roleNames : [];

  const schoolsLabel = names.length > MAX_VISIBLE_SCHOOL_NAMES
    ? `${names.slice(0, MAX_VISIBLE_SCHOOL_NAMES).join(', ')} +${names.length - MAX_VISIBLE_SCHOOL_NAMES}`
    : names.join(', ');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
      {names.length > 0 ? (
        <Tooltip title={names.join(', ')}>
          <Typography variant="body2" component="span">{schoolsLabel}</Typography>
        </Tooltip>
      ) : (
        <Chip label="Todos los colegios" size="small" variant="outlined" color="primary" sx={{ fontWeight: 700 }} />
      )}
      {roles.map((role) => (
        <Chip key={role} label={getRoleLabel(role)} size="small" sx={{ fontWeight: 700 }} />
      ))}
    </Box>
  );
};

const renderRecipientsCount = (count) => {
  if (count == null) {
    return (
      <Tooltip title="Envío anterior al registro de destinatarios">
        <Typography variant="body2" color="text.secondary" component="span">—</Typography>
      </Tooltip>
    );
  }
  return count;
};

// Columnas de la tabla
const COLUMNS = [
  { id: 'createdAt', label: 'Enviada', sortable: true },
  { id: 'title', label: 'Título', sortable: true },
  { id: 'mensaje', label: 'Mensaje' },
  { id: 'audiencia', label: 'Audiencia' },
  { id: 'destinatarios', label: 'Destinatarios', align: 'center' },
  { id: 'enviada_por', label: 'Enviada por' },
  { id: 'acciones', label: 'Acciones', align: 'right' },
];

const NotificationHistoryPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  // Paginación y orden (en el servidor)
  const table = useTableState({ defaultOrderBy: 'createdAt', defaultOrder: 'desc' });
  const { page, rowsPerPage, orderBy: sortBy, order: sortDirection } = table;

  const pageFilters = useFilters({
    fields: [
      F.cycle(),
      F.search('q', { placeholder: 'Título o mensaje' }),
      F.dateRange('dates'),
    ],
    onApplied: table.resetPage,
  });
  const { cycle: selectedCicloEscolar, q, dates } = pageFilters.applied;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientsOpen, setRecipientsOpen] = useState(false);

  const listParams = useMemo(() => {
    const params = {
      page: page + 1,
      pageSize: rowsPerPage,
      sortBy,
      sortDirection: String(sortDirection || 'desc').toUpperCase(),
    };

    const query = safeStr(q);
    if (query) {
        params.q = query;
    }

    // Un valor explícito evita que axiosConfig inyecte el ciclo del contexto.
    Object.assign(params, getCicloEscolarFilterParams(selectedCicloEscolar));

    if (dates.from) {
        params.startDate = moment(dates.from).startOf('day').toDate().toISOString();
    }
    if (dates.to) {
        params.endDate = moment(dates.to).endOf('day').toDate().toISOString();
    }

    return params;
  }, [page, rowsPerPage, q, selectedCicloEscolar, dates, sortBy, sortDirection]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await listNotificationHistory(listParams);
      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total) || 0);
    } catch (e) {
      console.error('[NotificationHistory] fetch error', e);
      setError(e?.response?.data?.message || 'No se pudo cargar el historial de notificaciones.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listParams]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

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
      setDetail(await getNotificationHistoryDetail(id));
    } catch (e) {
      console.error('[NotificationHistory] detail error', e);
      setDetailError(e?.response?.data?.message || 'No se pudo cargar el detalle de la notificación.');
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

  return (
    <PageContainer width="xl">
      <PageHeader
        eyebrow={MODULE_GROUPS.clientes}
        title="Historial de Notificaciones"
        subtitle="Notificaciones push enviadas manualmente desde el sistema"
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
                  <TableCell colSpan={7}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No hay notificaciones para mostrar.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.uuid} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.sentAt) || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {safeStr(r.title) || 'Notificación'}
                        </Typography>
                        {r.isScheduled && <ScheduledOriginChip />}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Tooltip title={safeStr(r.message)}>
                        <Typography variant="body2" noWrap>{safeStr(r.message) || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{renderAudience(r.audience)}</TableCell>
                    <TableCell align="center">{renderRecipientsCount(r.recipientsCount)}</TableCell>
                    <TableCell>{safeStr(r.sender?.name) || '—'}</TableCell>
                    <TableCell align="right">
                      <RowActions
                        actions={[
                          { key: 'view', kind: 'view', label: 'Ver detalle', icon: <VisibilityIcon fontSize="small" />, onClick: () => openDetail(r.uuid) },
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

      <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ pr: 2, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
                {safeStr(detail?.title) || 'Notificación'}
              </Typography>
              {detail?.isScheduled && <ScheduledOriginChip />}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Enviada: {formatDateTime(detail?.sentAt) || '—'}
              {safeStr(detail?.sender?.name) ? ` · Por: ${safeStr(detail.sender.name)}` : ''}
              {detail?.cicloEscolar ? ` · ${getCicloEscolarOptionLabel(detail.cicloEscolar)}` : ''}
            </Typography>
          </Box>
          <IconButton onClick={closeDetail} aria-label="Cerrar">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : detailError ? (
            <Alert severity="error">{detailError}</Alert>
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#1976d2', fontWeight: 800 }}>
                  Audiencia
                </Typography>
                {renderAudience(detail?.audience)}
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#1976d2', fontWeight: 800 }}>
                  Mensaje
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {safeStr(detail?.message) || '—'}
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#1976d2', fontWeight: 800 }}>
                    Destinatarios{detail?.hasRecipients ? ` (${detail.recipientsCount})` : ''}
                  </Typography>

                  {detail?.hasRecipients && (
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
                  )}
                </Box>

                {!detail?.hasRecipients && (
                  <Alert severity="info">
                    Este envío es anterior al registro de destinatarios; solo se conoce la audiencia.
                  </Alert>
                )}

                {detail?.hasRecipients && recipientsOpen && (
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
                                      alignItems: 'center',
                                      gap: 1,
                                      p: 1.25,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 2,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                      {getRecipientLabel(recipient)}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={getRoleLabel(recipient.role)}
                                      variant="filled"
                                      color="default"
                                      sx={{ fontWeight: 700 }}
                                    />
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
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDetail}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default NotificationHistoryPage;
