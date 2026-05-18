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
    Stack,
    Typography
} from '@mui/material';
import {
    ArrowForward as ArrowForwardIcon,
    CalendarMonth as CalendarMonthIcon,
    Logout as LogoutIcon,
    School as SchoolIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import {
    getDefaultPathForRole,
    getSchoolContextLabel,
    normalizeSchoolContext,
    setStoredSchoolContext
} from '../utils/schoolContext';

const operationStatusMeta = {
    ACTIVE: { label: 'Operando', color: 'success' },
    INACTIVE: { label: 'Sin operación', color: 'default' }
};

const enrollmentStatusMeta = {
    OPEN: { label: 'Inscripciones abiertas', color: 'primary' },
    CLOSED: { label: 'Inscripciones cerradas', color: 'default' }
};

const getStatusMeta = (map, status, fallbackLabel) => {
    const normalized = String(status || '').toUpperCase();
    return map[normalized] || { label: fallbackLabel || normalized || 'Sin estado', color: 'default' };
};

const SchoolContextSelectionPage = () => {
    const { auth, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [contexts, setContexts] = useState([]);
    const [error, setError] = useState('');

    const nextPath = location.state?.nextPath || getDefaultPathForRole(auth.user?.roleId);
    const forceChoice = !!location.state?.forceChoice;

    const sortedContexts = useMemo(() => (
        [...contexts].sort((a, b) => {
            const yearA = Number(a.cicloEscolarYear || 0);
            const yearB = Number(b.cicloEscolarYear || 0);
            if (yearA !== yearB) return yearB - yearA;
            return getSchoolContextLabel(a).localeCompare(getSchoolContextLabel(b), 'es');
        })
    ), [contexts]);

    useEffect(() => {
        const loadContexts = async () => {
            if (!auth?.token) return;

            setLoading(true);
            setError('');
            try {
                const response = await api.get('/auth/me/contexts', { skipSchoolCycleContext: true });
                const rawContexts = Array.isArray(response.data?.contexts) ? response.data.contexts : [];
                const normalizedContexts = rawContexts
                    .map(normalizeSchoolContext)
                    .filter((context) => context.schoolId && context.cicloEscolarId && context.status === 'ACTIVE');

                setContexts(normalizedContexts);

                if (!forceChoice && normalizedContexts.length === 1) {
                    setStoredSchoolContext(normalizedContexts[0]);
                    navigate(nextPath, { replace: true });
                }
            } catch (err) {
                console.error('Error cargando contextos:', err);
                setError('No se pudieron obtener tus colegios y ciclos escolares.');
            } finally {
                setLoading(false);
            }
        };

        loadContexts();
    }, [auth?.token, forceChoice, navigate, nextPath]);

    const handleSelectContext = (context) => {
        setStoredSchoolContext(context);
        navigate(nextPath, { replace: true });
    };

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6f8', py: { xs: 3, md: 6 } }}>
            <Container maxWidth="lg">
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 3 }}>
                    <Box>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Selecciona colegio y ciclo
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Tus datos se cargan según el colegio y ciclo escolar activo.
                        </Typography>
                    </Box>
                    <Button variant="outlined" color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
                        Cerrar sesión
                    </Button>
                </Stack>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : sortedContexts.length === 0 ? (
                    <Alert severity="warning">
                        Tu usuario no tiene un colegio y ciclo escolar activo asignado. Contacta al administrador para revisar tu acceso.
                    </Alert>
                ) : (
                    <Grid container spacing={2.5}>
                        {sortedContexts.map((context) => {
                            const operation = getStatusMeta(operationStatusMeta, context.operationStatus, 'Sin operación');
                            const enrollment = getStatusMeta(enrollmentStatusMeta, context.enrollmentStatus, 'Inscripciones cerradas');
                            return (
                                <Grid item xs={12} md={6} lg={4} key={`${context.schoolId}-${context.cicloEscolarId}`}>
                                    <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                                <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 1.5, width: 44, height: 44, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                                    <SchoolIcon />
                                                </Box>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                                        {context.schoolName || `Colegio ${context.schoolId}`}
                                                    </Typography>
                                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                                                        <CalendarMonthIcon fontSize="small" color="action" />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {context.cicloEscolarName || `Ciclo ${context.cicloEscolarYear || context.cicloEscolarId}`}
                                                        </Typography>
                                                    </Stack>
                                                </Box>
                                            </Stack>

                                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                                <Chip label={operation.label} color={operation.color} size="small" variant={context.operationStatus === 'ACTIVE' ? 'filled' : 'outlined'} />
                                                <Chip label={enrollment.label} color={enrollment.color} size="small" variant={context.enrollmentStatus === 'OPEN' ? 'filled' : 'outlined'} />
                                            </Stack>

                                            <Button
                                                variant="contained"
                                                endIcon={<ArrowForwardIcon />}
                                                onClick={() => handleSelectContext(context)}
                                                sx={{ mt: 'auto' }}
                                            >
                                                Entrar
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Container>
        </Box>
    );
};

export default SchoolContextSelectionPage;