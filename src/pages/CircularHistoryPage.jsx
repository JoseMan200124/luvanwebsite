import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment-timezone';
import parse from 'html-react-parser';
import tw from 'twin.macro';

import api from '../utils/axiosConfig';
import CicloEscolarFilter, { ALL_CYCLES_VALUE } from '../components/CicloEscolarFilter';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const safeStr = (v) => (v == null ? '' : String(v)).trim();

const ALL_CLIENTS_VALUE = 'all';

const withPdfViewerParams = (url) => {
  const u = safeStr(url);
  if (!u) return u;
  if (u.includes('#')) return u;
  return `${u}#toolbar=0&navpanes=0&scrollbar=0`;
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
};

const parseJsonMaybe = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const getTotalUnique = (counts) => {
  const parsed = parseJsonMaybe(counts);
  if (!parsed) return null;
  const v = parsed.totalUnique;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const CircularHistoryPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [q, setQ] = useState('');
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(() => localStorage.getItem('selectedSchoolId') || ALL_CLIENTS_VALUE);
  const [selectedCicloEscolar, setSelectedCicloEscolar] = useState(() => localStorage.getItem('selectedCicloEscolarId') || ALL_CYCLES_VALUE);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);

  const listParams = useMemo(() => {
    const params = {
      page: page + 1,
      pageSize: rowsPerPage,
      // Evita que axiosConfig inyecte el contexto automáticamente.
      // 'all' significa: sin filtro por cliente.
      schoolId: selectedSchool || ALL_CLIENTS_VALUE,
    };

    const query = safeStr(q);
    if (query) params.q = query;

    if (selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE) {
      params.cicloEscolarId = selectedCicloEscolar;
    }

    if (startDate) params.startDate = moment(startDate).startOf('day').toDate().toISOString();
    if (endDate) params.endDate = moment(endDate).endOf('day').toDate().toISOString();

    return params;
  }, [page, rowsPerPage, q, selectedSchool, selectedCicloEscolar, startDate, endDate]);

  const fetchSchools = useCallback(async () => {
    try {
      const res = await api.get('/schools', {
        params: { includeArchived: true, allCycles: true },
        skipSchoolCycleContext: true,
      });
      const list = res?.data?.schools;
      setSchools(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('[CircularHistory] schools fetch error', e);
      setSchools([]);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
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

  const handleRefresh = async () => {
    await fetchRows();
  };

  const handleCycleChange = (value) => {
    setSelectedCicloEscolar(value);
    localStorage.setItem('selectedCicloEscolarId', String(value || ALL_CYCLES_VALUE));
    setPage(0);
  };

  const openDetail = async (uuid) => {
    const id = safeStr(uuid);
    if (!id) return;

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);

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
  };

  const downloadAttachment = async (attachmentUuid) => {
    const id = safeStr(attachmentUuid);
    if (!id) return;

    try {
      const res = await api.get(`/circulars/admin/attachments/${id}/url`);
      const url = safeStr(res?.data?.url);
      if (!url) return;
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
    <Container>
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Historial de Circulares</Typography>
              <Typography variant="body2" color="text.secondary">Circulares enviadas desde el sistema</Typography>
            </Box>

            <Tooltip title="Refrescar">
              <span>
                <IconButton onClick={handleRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Buscar"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Asunto o contenido"
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <LocalizationProvider dateAdapter={AdapterMoment}>
                <DatePicker
                  label="Desde"
                  value={startDate}
                  onChange={(v) => {
                    setStartDate(v);
                    setPage(0);
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} md={2}>
              <LocalizationProvider dateAdapter={AdapterMoment}>
                <DatePicker
                  label="Hasta"
                  value={endDate}
                  onChange={(v) => {
                    setEndDate(v);
                    setPage(0);
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Cliente"
                value={selectedSchool || ALL_CLIENTS_VALUE}
                onChange={(e) => {
                  setSelectedSchool(String(e.target.value || ALL_CLIENTS_VALUE));
                  setPage(0);
                }}
              >
                <MenuItem value={ALL_CLIENTS_VALUE}>Todos</MenuItem>
                {schools.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {safeStr(s.name) || `Colegio ${s.id}`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={2}>
              <CicloEscolarFilter
                value={selectedCicloEscolar}
                onChange={handleCycleChange}
                fullWidth
                size="small"
              />
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
          )}
        </CardContent>
      </Card>

      <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Enviada</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Asunto</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Colegio</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">Destinatarios</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="center">Adjunto</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>

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
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {safeStr(r.subject) || 'Circular'}
                      </Typography>
                    </TableCell>
                    <TableCell>{safeStr(r.school?.name) || '—'}</TableCell>
                    <TableCell align="right">{getTotalUnique(r.counts) ?? '—'}</TableCell>
                    <TableCell align="center">{r.hasAttachment ? 'Sí' : 'No'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver detalle">
                        <span>
                          <IconButton onClick={() => openDetail(r.uuid)} size="small">
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ pr: 2, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
              {safeStr(detail?.subject) || 'Circular'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enviada: {formatDateTime(detail?.sentAt) || '—'}
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
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Mensaje
                </Typography>
                <Box sx={{ '& p': { marginTop: 0 } }}>
                  {safeStr(detail?.body) ? parse(String(detail.body)) : <Typography variant="body2">—</Typography>}
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Adjuntos
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
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDetail}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CircularHistoryPage;
