// src/pages/SchoolEnrollmentPage.jsx

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    Typography,
    TextField,
    Button,
    Alert,
    Snackbar,
    Box,
    Chip,
    Divider,
    CircularProgress,
    Stack
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/axiosConfig';
import logoLuvan from '../assets/img/logo-sin-fondo.png';
import { AuthContext } from '../context/AuthProvider';
import { PermissionsContext } from '../context/PermissionsProvider';
import FamilyEnrollmentFields from '../components/enrollment/FamilyEnrollmentFields';
import EnrollmentLoginStep from '../components/enrollment/EnrollmentLoginStep';
import {
    buildFamilyPayload,
    emptyFamilyForm,
    formFromPrefill,
    hasValidStudent,
    normalizeGrades,
    parseArrayField
} from '../utils/familyEnrollmentForm';
import { getReenrollmentForm, submitReenrollment } from '../services/familyReenrollmentService';
import { normalizeSchoolContext, setStoredSchoolContext } from '../utils/schoolContext';

const REENROLL_VIEW_PERMISSION = 'padre-reinscripcion-ver';
const STEPS = { CHOOSE: 'choose', LOGIN: 'login', PUBLIC: 'public', REENROLL: 'reenroll' };
const EMPTY_ACCOUNT = { fullName: '', email: '', password: '' };

const SchoolEnrollmentPage = () => {
    const { schoolId } = useParams();
    const navigate = useNavigate();
    const { logout } = useContext(AuthContext);
    const { permissionsLoaded, hasPermission } = useContext(PermissionsContext);
    const canReenroll = permissionsLoaded && hasPermission(REENROLL_VIEW_PERMISSION);

    const [loading, setLoading] = useState(true);
    const [schoolInfo, setSchoolInfo] = useState(null);
    const [grades, setGrades] = useState([]);
    const [extraFields, setExtraFields] = useState([]);
    const [enrollmentBlockedMessage, setEnrollmentBlockedMessage] = useState('');

    const [step, setStep] = useState(STEPS.CHOOSE);
    const [form, setForm] = useState(emptyFamilyForm);
    const [account, setAccount] = useState(EMPTY_ACCOUNT);
    const [loginEmail, setLoginEmail] = useState('');
    const [emailConflict, setEmailConflict] = useState(false);

    const [reenrollData, setReenrollData] = useState(null);
    const [reenrollLoading, setReenrollLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const autoReenrollStartedRef = useRef(false);

    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const showSnackbar = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

    useEffect(() => {
        const fetchSchoolData = async () => {
            try {
                const response = await api.get(`/schools/${schoolId}`, {
                    skipAuth: true,
                    skipSchoolCycleContext: true
                });

                if (response.data?.school) {
                    const { school } = response.data;
                    const enrollmentStatus = String(school.enrollmentStatus || 'OPEN').toUpperCase();
                    setSchoolInfo(school);
                    setEnrollmentBlockedMessage(school.canCreateNewUsers === false || enrollmentStatus === 'CLOSED'
                        ? (school.newUserCreationMessage || 'Este enlace pertenece a un ciclo anterior. Solicita el enlace del ciclo más reciente.')
                        : '');
                    setGrades(normalizeGrades(school.grades));
                    setExtraFields(parseArrayField(school.extraEnrollmentFields));
                } else {
                    setSchoolInfo(null);
                    setEnrollmentBlockedMessage('No se pudo validar el colegio para inscripción.');
                }
            } catch (error) {
                console.error('Error al obtener info del colegio:', error);
                setSchoolInfo(null);
                setSnackbar({ open: true, message: 'No se pudieron obtener los datos del colegio.', severity: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchSchoolData();
    }, [schoolId]);

    const loadReenrollment = useCallback(async () => {
        // Evita que el auto-arranque vuelva a disparar al recargarse los permisos tras el login.
        autoReenrollStartedRef.current = true;
        setStep(STEPS.REENROLL);
        setReenrollLoading(true);
        try {
            const data = await getReenrollmentForm(schoolId);
            const defs = parseArrayField(data?.school?.extraEnrollmentFields);
            setGrades(normalizeGrades(data?.school?.grades));
            setExtraFields(defs);
            setForm(formFromPrefill(data?.prefill, defs));
            setReenrollData({ account: data?.account || null, eligibility: data?.eligibility || null });
        } catch (error) {
            console.error('Error al cargar la reinscripción:', error);
            setReenrollData(null);
            setSnackbar({
                open: true,
                message: error?.response?.status === 403
                    ? 'Tu cuenta no tiene acceso a la reinscripción de familias.'
                    : (error?.response?.data?.message || 'No se pudo cargar tu información para la reinscripción.'),
                severity: 'error'
            });
            setStep(STEPS.CHOOSE);
        } finally {
            setReenrollLoading(false);
        }
    }, [schoolId]);

    // Una sesión con permiso de reinscripción (p. ej. desde el banner del dashboard) entra directo.
    useEffect(() => {
        if (loading || enrollmentBlockedMessage || !canReenroll || autoReenrollStartedRef.current) return;
        loadReenrollment();
    }, [loading, enrollmentBlockedMessage, canReenroll, loadReenrollment]);

    const handleSwitchAccount = () => {
        // logout() navega a /login; volvemos enseguida a este mismo enlace.
        logout();
        navigate(`/schools/enroll/${schoolId}`, { replace: true });
        setReenrollData(null);
        setForm(emptyFamilyForm());
        setStep(STEPS.LOGIN);
    };

    const goToLoginFromConflict = () => {
        setEmailConflict(false);
        setLoginEmail(account.email.trim());
        setStep(STEPS.LOGIN);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePublicSubmit = async (event) => {
        event.preventDefault();
        if (!hasValidStudent(form.students)) {
            showSnackbar('Agrega al menos un alumno con nombre y grado.', 'warning');
            return;
        }

        setSubmitting(true);
        setEmailConflict(false);
        try {
            await api.post(`/public/schools/enroll/${schoolId}`, {
                ...buildFamilyPayload(form),
                accountFullName: account.fullName,
                accountEmail: account.email,
                accountPassword: account.password
            }, {
                skipAuth: true,
                skipSchoolCycleContext: true
            });

            showSnackbar('¡Registro enviado correctamente!');
            setForm(emptyFamilyForm());
            setAccount(EMPTY_ACCOUNT);
            setTimeout(() => {
                navigate('/thank-you', {
                    state: {
                        title: '¡Gracias por inscribirse!',
                        body: 'En breve le llegará un correo electrónico con su usuario.',
                        footer: 'Transportes Luvan'
                    }
                });
            }, 2000);
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            if (error?.response?.data?.code === 'EMAIL_ALREADY_REGISTERED') {
                setEmailConflict(true);
                return;
            }
            showSnackbar(error?.response?.data?.message || 'Ocurrió un error al enviar tu registro. Intenta de nuevo.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const selectNewSchoolContext = async (result) => {
        try {
            const response = await api.get('/auth/me/contexts', { skipSchoolCycleContext: true });
            const contexts = Array.isArray(response.data?.contexts) ? response.data.contexts.map(normalizeSchoolContext) : [];
            const match = contexts.find((context) => (
                context.schoolId === String(result?.schoolId) && context.cicloEscolarId === String(result?.cicloEscolarId)
            ));
            if (match) setStoredSchoolContext(match);
        } catch {
            // Sin contexto guardado, el portal le pedirá elegirlo en /select-context.
        }
    };

    const handleReenrollSubmit = async (event) => {
        event.preventDefault();
        if (!hasValidStudent(form.students)) {
            showSnackbar('Agrega al menos un alumno con nombre y grado.', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitReenrollment(schoolId, buildFamilyPayload(form));
            await selectNewSchoolContext(result);
            navigate('/thank-you', {
                state: {
                    title: '¡Reinscripción recibida!',
                    body: 'Tu familia quedó inscrita en el nuevo ciclo. Sigue usando tu mismo usuario y contraseña en la web y en la app.',
                    footer: 'Transportes Luvan'
                }
            });
        } catch (error) {
            console.error('Error al enviar la reinscripción:', error);
            showSnackbar(error?.response?.data?.message || 'No se pudo enviar la reinscripción. Intenta de nuevo.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const renderChooseStep = () => (
        <Box sx={{ textAlign: 'center', my: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
                ¿Tu familia ya estuvo inscrita con Transportes Luvan en un ciclo anterior?
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: '#555' }}>
                Si ya tienes usuario, inicia sesión para inscribirte al nuevo ciclo con tu misma cuenta.
                Así no se crea una cuenta duplicada.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                <Button variant="contained" onClick={() => setStep(STEPS.LOGIN)} sx={{ backgroundColor: '#0D3FE2' }}>
                    Sí, ya tengo cuenta
                </Button>
                <Button variant="outlined" onClick={() => setStep(STEPS.PUBLIC)}>
                    No, es mi primera inscripción
                </Button>
            </Stack>
        </Box>
    );

    const renderReenrollStep = () => {
        if (reenrollLoading || !reenrollData) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }

        const { account: sessionAccount, eligibility } = reenrollData;
        const accountBox = (
            <Alert severity="info" sx={{ mb: 3 }} action={(
                <Button color="inherit" size="small" onClick={handleSwitchAccount}>
                    No soy yo
                </Button>
            )}>
                Inscribiendo con la cuenta de <strong>{sessionAccount?.name}</strong> ({sessionAccount?.email}).
            </Alert>
        );

        if (eligibility?.alreadyEnrolled) {
            return (
                <>
                    {accountBox}
                    <Alert severity="success" sx={{ mb: 2 }}>
                        Tu familia ya está inscrita en este ciclo escolar.
                    </Alert>
                    <Button variant="contained" onClick={() => navigate('/parent/dashboard')}>
                        Ir a mi portal
                    </Button>
                </>
            );
        }

        if (eligibility && !eligibility.canEnroll) {
            return (
                <>
                    {accountBox}
                    <Alert severity="warning">
                        {eligibility.blockedMessage || 'Este colegio no está recibiendo inscripciones.'}
                    </Alert>
                </>
            );
        }

        return (
            <form onSubmit={handleReenrollSubmit} style={{ flexGrow: 1 }}>
                {accountBox}
                <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
                    Revisa y actualiza los datos de tu familia. Elige el grado de cada alumno para este nuevo ciclo.
                </Typography>
                <FamilyEnrollmentFields form={form} onChange={setForm} grades={grades} extraFieldDefs={extraFields} />
                {!hasValidStudent(form.students) && (
                    <Typography variant="body2" sx={{ mt: 2, color: '#c62828' }}>
                        Debes ingresar al menos un alumno con nombre y grado.
                    </Typography>
                )}
                <Button
                    type="submit"
                    variant="contained"
                    disabled={!hasValidStudent(form.students) || submitting}
                    sx={{ backgroundColor: '#47A56B', color: '#FFFFFF', marginTop: '1.5rem', padding: '0.75rem', width: '100%', fontSize: '1rem' }}
                >
                    {submitting ? 'Enviando...' : 'Enviar reinscripción'}
                </Button>
            </form>
        );
    };

    const renderPublicStep = () => (
        <form onSubmit={handlePublicSubmit} style={{ flexGrow: 1 }}>
            <Alert severity="info" sx={{ mb: 3 }} action={(
                <Button color="inherit" size="small" onClick={() => setStep(STEPS.LOGIN)}>
                    Iniciar sesión
                </Button>
            )}>
                ¿Tu familia ya tiene cuenta Luvan? Inicia sesión para no crear una cuenta duplicada.
            </Alert>

            <FamilyEnrollmentFields form={form} onChange={setForm} grades={grades} extraFieldDefs={extraFields} />

            <Divider sx={{ my: 3 }} />
            <Typography
                variant="h6"
                sx={{ backgroundColor: '#47A56B', color: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '4px', mb: 2 }}
            >
                Campos para creación de usuario
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
                Un usuario por familia. No se puede crear más de un usuario familiar,
                por lo que se solicita ingresar el dato de quien estará a cargo del portal.
            </Typography>
            <TextField
                label="Nombre completo de persona a cargo"
                fullWidth
                margin="normal"
                value={account.fullName}
                onChange={(event) => setAccount({ ...account, fullName: event.target.value })}
                required
            />
            <TextField
                label="Correo del usuario"
                type="email"
                fullWidth
                margin="normal"
                value={account.email}
                onChange={(event) => {
                    setEmailConflict(false);
                    setAccount({ ...account, email: event.target.value });
                }}
                required
            />
            <TextField
                label="Contraseña del usuario"
                type="password"
                fullWidth
                margin="normal"
                value={account.password}
                onChange={(event) => setAccount({ ...account, password: event.target.value })}
                required
            />

            {emailConflict && (
                <Alert severity="warning" sx={{ mt: 2 }} action={(
                    <Button color="inherit" size="small" onClick={goToLoginFromConflict}>
                        Iniciar sesión y reinscribirme
                    </Button>
                )}>
                    Este correo ya tiene una cuenta en Transportes Luvan. Inicia sesión con esa cuenta para inscribir a tu familia en el nuevo ciclo.
                </Alert>
            )}

            {!hasValidStudent(form.students) && (
                <Typography variant="body2" sx={{ mt: 2, color: '#c62828' }}>
                    Debes ingresar al menos un alumno con nombre y grado.
                </Typography>
            )}

            <Button
                type="submit"
                variant="contained"
                disabled={!hasValidStudent(form.students) || submitting}
                sx={{ backgroundColor: '#47A56B', color: '#FFFFFF', marginTop: '1.5rem', padding: '0.75rem', width: '100%', fontSize: '1rem' }}
            >
                {submitting ? 'Enviando...' : 'Enviar'}
            </Button>

            <Box sx={{ mt: 2, p: 1.5, backgroundColor: '#f0f7f4', border: '1px solid #c8e6c9', borderRadius: 1, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#555' }}>
                    📧 El correo de confirmación será enviado desde{' '}
                    <strong>haricodeoficial@gmail.com</strong>. Si no lo encuentras en tu
                    bandeja de entrada, revisa tu carpeta de <em>spam</em> o{' '}
                    <em>correo no deseado</em>.
                </Typography>
            </Box>
        </form>
    );

    const renderStep = () => {
        if (enrollmentBlockedMessage) {
            return <Alert severity="warning" sx={{ mb: 3 }}>{enrollmentBlockedMessage}</Alert>;
        }
        if (step === STEPS.LOGIN) {
            return (
                <EnrollmentLoginStep
                    initialEmail={loginEmail}
                    onSuccess={loadReenrollment}
                    onBack={() => setStep(STEPS.CHOOSE)}
                    onPasswordExpired={() => navigate('/force-password-change')}
                />
            );
        }
        if (step === STEPS.REENROLL) return renderReenrollStep();
        if (step === STEPS.PUBLIC) return renderPublicStep();
        return renderChooseStep();
    };

    if (loading) {
        return (
            <Box sx={{ backgroundColor: '#f7f7f7', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                <CircularProgress />
            </Box>
        );
    }

    const operationActive = String(schoolInfo?.operationStatus || 'ACTIVE').toUpperCase() === 'ACTIVE';
    const enrollmentOpen = String(schoolInfo?.enrollmentStatus || 'OPEN').toUpperCase() === 'OPEN';

    return (
        <Box sx={{ backgroundColor: '#f7f7f7', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <Box
                sx={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    maxWidth: '700px',
                    width: '100%',
                    boxShadow: 3,
                    padding: '30px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '80vh',
                    '@media (max-width: 480px)': { padding: '20px', minHeight: 'auto' }
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <img src={logoLuvan} alt="Logo Transportes Luvan" style={{ maxWidth: '150px', height: 'auto' }} />
                </Box>

                <Typography
                    variant="h4"
                    gutterBottom
                    sx={{ backgroundColor: '#0D3FE2', color: '#FFFFFF', padding: '1rem', textAlign: 'center', borderRadius: '8px', mb: 3 }}
                >
                    {step === STEPS.REENROLL ? 'Reinscripción' : 'Formulario de Inscripción'}
                </Typography>

                {schoolInfo && (
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{schoolInfo.cicloEscolar?.anio ? `${schoolInfo.name} ${schoolInfo.cicloEscolar.anio}` : schoolInfo.name}</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            <Chip
                                label={operationActive ? 'Operando' : 'Sin operación'}
                                color={operationActive ? 'success' : 'default'}
                                size="small"
                                variant={operationActive ? 'filled' : 'outlined'}
                            />
                            <Chip
                                label={enrollmentOpen ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
                                color={enrollmentOpen ? 'primary' : 'default'}
                                size="small"
                                variant={enrollmentOpen ? 'filled' : 'outlined'}
                            />
                        </Box>
                    </Box>
                )}

                {renderStep()}

                <Box sx={{ mt: 4, textAlign: 'center', color: '#777' }}>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2">Todos los derechos reservados a Transportes Luvan</Typography>
                    <Typography variant="body2">
                        Desarrollado por{' '}
                        <a href="https://www.haricode.tech" target="_blank" rel="noopener noreferrer">Haricode</a>
                    </Typography>
                </Box>

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
        </Box>
    );
};

export default SchoolEnrollmentPage;
