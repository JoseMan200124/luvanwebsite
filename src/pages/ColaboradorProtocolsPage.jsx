// src/pages/ColaboradorProtocolsPage.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Description as DescriptionIcon,
  LibraryBooks as LibraryBooksIcon,
  MenuBook as MenuBookIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { AuthContext } from '../context/AuthProvider';
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

const typeLabel = (t) => (t === 'protocolo' ? 'Protocolo' : t === 'reglamento' ? 'Reglamento' : 'Documento');

const typeChipColor = (t) => {
  if (t === 'protocolo') return 'info';
  if (t === 'reglamento') return 'secondary';
  return 'default';
};

const tabs = [
  { key: 'all', label: 'Todos', icon: <LibraryBooksIcon fontSize="small" /> },
  { key: 'protocolo', label: 'Protocolos', icon: <DescriptionIcon fontSize="small" /> },
  { key: 'reglamento', label: 'Reglamentos', icon: <MenuBookIcon fontSize="small" /> },
];

const ColaboradorProtocolsPage = () => {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const userId = auth?.user?.id;

  const fetchProtocols = async () => {
    setLoading(true);
    setError('');
    try {
      if (!userId) throw new Error('Usuario no autenticado');

      const params = tab === 'all' ? {} : { type: tab };
      const res = await api.get(`/protocols/parent/${userId}`, { params });
      const data = res?.data?.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[ColaboradorProtocols] fetch error', e);
      const msg = e?.response?.data?.message || 'No se pudieron cargar los documentos.';
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProtocols();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab]);

  const emptyTitle = useMemo(() => {
    if (tab === 'protocolo') return 'No hay protocolos disponibles';
    if (tab === 'reglamento') return 'No hay reglamentos disponibles';
    return 'No hay documentos disponibles';
  }, [tab]);

  const emptySubtitle = 'Los documentos aparecerán aquí cuando estén disponibles';

  const openPdf = (pdfUrl) => {
    const url = safeStr(pdfUrl);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <ParentNavbar />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Protocolos y Reglamentos</Typography>
            <Typography variant="body2" color="text.secondary">Consulta documentos disponibles para tu corporación</Typography>
          </Box>

          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/colaborador/dashboard')}>
            Volver
          </Button>
        </Box>

        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
              sx={{ mb: 2 }}
            >
              {tabs.map((t) => (
                <Tab
                  key={t.key}
                  value={t.key}
                  icon={t.icon}
                  iconPosition="start"
                  label={t.label}
                />
              ))}
            </Tabs>

            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : items.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <DescriptionIcon sx={{ fontSize: 64, opacity: 0.25 }} />
                <Typography variant="h6" sx={{ mt: 2, fontWeight: 700 }}>{emptyTitle}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{emptySubtitle}</Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {items.map((doc) => (
                  <Grid item xs={12} md={6} key={doc.uuid || doc.id}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                            {safeStr(doc.title) || 'Documento'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
                            <Chip size="small" color={typeChipColor(doc.type)} label={typeLabel(doc.type)} />
                            {safeStr(doc.school?.name) && <Chip size="small" label={doc.school.name} />}
                            {safeStr(doc.corporation?.name) && <Chip size="small" label={doc.corporation.name} />}
                          </Box>

                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Publicado: {formatDateLong(doc.createdAt) || '—'}
                          </Typography>

                          {safeStr(doc.description) && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {doc.description}
                            </Typography>
                          )}
                        </Box>

                        <Button
                          variant="contained"
                          onClick={() => openPdf(doc.pdfUrl)}
                          disabled={!safeStr(doc.pdfUrl)}
                          startIcon={<DescriptionIcon />}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          Ver PDF
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Card>
      </Container>
    </>
  );
};

export default ColaboradorProtocolsPage;
