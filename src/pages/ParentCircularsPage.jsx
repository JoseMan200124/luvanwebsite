import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Pagination,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
  GetApp as DownloadIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import parse from 'html-react-parser';

import ParentNavbar from '../components/ParentNavbar';
import api from '../utils/axiosConfig';

const safeStr = (v) => (v == null ? '' : String(v)).trim();

const formatDateLong = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
};

const withPdfViewerParams = (url) => {
  const u = safeStr(url);
  if (!u) return u;
  // Hash doesn't affect signed URL query params.
  if (u.includes('#')) return u;
  return `${u}#toolbar=0&navpanes=0&scrollbar=0`;
};

const ParentCircularsPage = () => {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);

  const totalPages = useMemo(() => {
    const t = Number(total) || 0;
    const ps = Number(pageSize) || 10;
    return Math.max(1, Math.ceil(t / ps));
  }, [total, pageSize]);

  const fetchCirculars = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/circulars/parent', {
        params: { page, pageSize },
      });
      const data = res?.data || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total) || 0);
    } catch (e) {
      console.error('[ParentCirculars] fetch list error', e);
      const msg = e?.response?.data?.message || 'No se pudieron cargar las circulares.';
      setError(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchCirculars();
  }, [fetchCirculars]);

  const openDetail = async (uuid) => {
    const id = safeStr(uuid);
    if (!id) return;

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);

    try {
      const res = await api.get(`/circulars/parent/${id}`);
      setDetail(res?.data || null);
    } catch (e) {
      console.error('[ParentCirculars] fetch detail error', e);
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
      const res = await api.get(`/circulars/parent/attachments/${id}/url`);
      const url = safeStr(res?.data?.url);
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('[ParentCirculars] download attachment error', e);
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
    <>
      <ParentNavbar />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Circulares</Typography>
            <Typography variant="body2" color="text.secondary">Consulta las circulares que han sido enviadas</Typography>
          </Box>

          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/parent/dashboard')}>
            Volver
          </Button>
        </Box>

        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : items.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <DescriptionIcon sx={{ fontSize: 64, opacity: 0.25 }} />
                <Typography variant="h6" sx={{ mt: 2, fontWeight: 700 }}>No hay circulares</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Las circulares aparecerán aquí cuando estén disponibles
                </Typography>
              </Box>
            ) : (
              <>
                <Grid container spacing={2}>
                  {items.map((c) => (
                    <Grid item xs={12} md={6} key={c.uuid}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                              {safeStr(c.subject) || 'Circular'}
                            </Typography>

                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
                              {safeStr(c.school?.name) && <Chip size="small" label={c.school.name} />}
                              {c.hasAttachment ? <Chip size="small" label="Con adjunto" /> : <Chip size="small" label="Sin adjunto" />}
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              Enviada: {formatDateLong(c.sentAt) || '—'}
                            </Typography>
                          </Box>

                          <Button
                            variant="contained"
                            onClick={() => openDetail(c.uuid)}
                            startIcon={<VisibilityIcon />}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            Ver
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {totalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_, value) => setPage(value)}
                      color="primary"
                    />
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Container>

      <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ pr: 2, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
              {safeStr(detail?.subject) || 'Circular'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enviada: {formatDateLong(detail?.sentAt) || '—'}
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
    </>
  );
};

export default ParentCircularsPage;
