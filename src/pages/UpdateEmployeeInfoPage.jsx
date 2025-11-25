// src/pages/UpdateEmployeeInfoPage.jsx

import React, { useState, useContext } from 'react';
import {
    Typography,
    TextField,
    Button,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Alert,
    Snackbar,
    Box,
    Divider,
    CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axiosConfig';
import LoginModal from '../components/modals/LoginModal';
import logoLuvan from '../assets/img/logo-sin-fondo.png';
import { AuthContext } from '../context/AuthProvider';

const UpdateEmployeeInfoPage = () => {
    const navigate = useNavigate();

    const { logout } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(true); // Estado para controlar el modal de login

    const [corporationId, setCorporationId] = useState('');

    // Campos del formulario de empleado
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');
    const [selectedSchedule, setSelectedSchedule] = useState(-1);

    const [schedules, setSchedules] = useState([]);
    const [extraFields, setExtraFields] = useState([]);
    const [formExtraValues, setFormExtraValues] = useState({});
    const [prefillExtraFields, setPrefillExtraFields] = useState(null);

    const getExtraValue = (fieldName) => {
        if (!formExtraValues) return '';
        if (formExtraValues[fieldName] !== undefined) return formExtraValues[fieldName];
        const target = String(fieldName || '').trim().toLowerCase();
        for (const k of Object.keys(formExtraValues)) {
            if (String(k || '').trim().toLowerCase() === target) return formExtraValues[k];
        }
        return '';
    };

    // Contacto de emergencia
    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyRelationship, setEmergencyRelationship] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    
    const [accountFullName, setAccountFullName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountUsername, setAccountUsername] = useState('');
    const [accountPassword, setAccountPassword] = useState('');

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    const handleLoginSuccess = (userData) => {        
        setCorporationId(userData.corporationId || '');
        setLastName(userData.lastName || '');
        setFirstName(userData.firstName || '');
        setPhoneNumber(userData.phoneNumber || '');
        setServiceAddress(userData.serviceAddress || '');
        setZoneOrSector(userData.zoneOrSector || '');
        // Save extraFields from prefill and map after corp data loads
        setPrefillExtraFields(userData.extraFields || {});
        setRouteType(userData.routeType || 'Completa');
        setSelectedSchedule(userData.selectedSchedule ?? -1);
        // don't set formExtraValues directly; we will map prefill fields to canonical fieldName after corp data is loaded
        setFormExtraValues({});
        setEmergencyContact(userData.emergencyContact || '');
        setEmergencyRelationship(userData.emergencyRelationship || '');
        setEmergencyPhone(userData.emergencyPhone || '');
        setAccountFullName(userData.accountFullName || '');
        setAccountUsername(userData.accountFullName || '');
        setAccountEmail(userData.accountEmail || '');

        setIsLoginOpen(false);
        // Pass prefill extraFields directly to avoid async state update race
        fetchCorporationData(userData.corporationId, userData.extraFields || {});
    };

    const fetchCorporationData = async (id, prefill = null) => {
        try {
            const response = await api.get(`/corporations/${id}`);
            
            if (response.data && response.data.corporation) {
                // Corporación cargada correctamente
                console.log('Corporación obtenida:', response.data.corporation);
                const corp = response.data.corporation;
                // Load schedules and extra enrollment fields if present
                if (Array.isArray(corp.schedules)) setSchedules(corp.schedules);
                else if (corp.schedules && typeof corp.schedules === 'string') {
                    try { setSchedules(JSON.parse(corp.schedules)); } catch { setSchedules([]); }
                }

                if (Array.isArray(corp.extraEnrollmentFields)) setExtraFields(corp.extraEnrollmentFields);
                else if (corp.extraEnrollmentFields && typeof corp.extraEnrollmentFields === 'string') {
                    try { setExtraFields(JSON.parse(corp.extraEnrollmentFields)); } catch { setExtraFields([]); }
                }

                // Map prefill (passed directly or from state) into formExtraValues using the canonical fieldName from corp.extraEnrollmentFields
                const prefillObj = prefill && Object.keys(prefill || {}).length > 0 ? prefill : prefillExtraFields;
                if (prefillObj) {
                    const mapped = {};
                    const defs = Array.isArray(corp.extraEnrollmentFields) ? corp.extraEnrollmentFields : (corp.extraEnrollmentFields && typeof corp.extraEnrollmentFields === 'string' ? (() => { try { return JSON.parse(corp.extraEnrollmentFields); } catch { return []; } })() : []);

                    const findKey = (obj, target) => {
                        if (!obj) return null;
                        const t = String(target || '').trim().toLowerCase();
                        for (const k of Object.keys(obj)) {
                            if (String(k || '').trim().toLowerCase() === t) return k;
                        }
                        return null;
                    };

                    if (Array.isArray(defs) && defs.length > 0) {
                        defs.forEach(def => {
                            const fname = def.fieldName || def.label || def.name || '';
                            const keyInPrefill = findKey(prefillObj, fname) || findKey(prefillObj, String(fname).toLowerCase());
                            if (keyInPrefill) {
                                mapped[fname] = prefillObj[keyInPrefill];
                            } else {
                                // fallback: try to match common synonyms
                                const lname = String(fname).toLowerCase();
                                if (lname.includes('depart') || lname.includes('zona') || lname.includes('sector')) {
                                    const syn = findKey(prefillObj, 'department') || findKey(prefillObj, 'zoneOrSector') || findKey(prefillObj, 'zona') || findKey(prefillObj, 'zone');
                                    if (syn) mapped[fname] = prefillObj[syn];
                                }
                            }
                        });
                    } else {
                        // no defs: copy all
                        Object.keys(prefillObj).forEach(k => mapped[k] = prefillObj[k]);
                    }

                    // final fallback: if mapped empty and prefill has department-like top-level, set a Departamento key
                    if (Object.keys(mapped).length === 0) {
                        const depKey = findKey(prefillObj, 'department') || findKey(prefillObj, 'zoneOrSector') || findKey(prefillObj, 'zona');
                        if (depKey) mapped['Departamento'] = prefillObj[depKey];
                    }

                    setFormExtraValues(prev => ({ ...mapped, ...prev }));
                    setPrefillExtraFields(null);
                }
            }
        } catch (error) {
            console.error('Error al obtener info de la corporación:', error);
            setSnackbar({
                open: true,
                message: 'No se pudieron obtener los datos de la corporación.',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            corporationId,
            lastName,
            firstName,
            serviceAddress,
            zoneOrSector: zoneOrSector,
            routeType,
            phoneNumber,
            selectedSchedule,
            emergencyContact,
            emergencyRelationship,
            emergencyPhone,
            accountFullName: accountUsername || accountFullName,
            accountEmail,
            accountPassword,
            extraFields: formExtraValues
        };

        try {
            await api.put(`/update-employee-info/${corporationId}`, payload);

            setSnackbar({
                open: true,
                message: '¡Registro actualizado correctamente!',
                severity: 'success'
            });

            setLastName('');
            setFirstName('');
            setPhoneNumber('');
            setServiceAddress('');
            setZoneOrSector('');
            setRouteType('Completa');
            setSelectedSchedule(-1);
            setFormExtraValues({});
            setEmergencyContact('');
            setEmergencyRelationship('');
            setEmergencyPhone('');
            setAccountFullName('');
            setAccountUsername('');
            setAccountPassword('');
            setAccountEmail('');

            // Redirigir a la página de agradecimiento
            setTimeout(() => {
                navigate('/thank-you', {
                    state: {
                        title: '¡Datos actualizados!',
                        body: 'Los datos han sido actualizados correctamente.',
                        footer: ''
                    }
                });

                setTimeout(() => {
                    logout();
                }, 3000);
            }, 2000);
        } catch (error) {
            console.error('Error al enviar formulario:', error);

            const messageToShow = 'Ocurrió un error al enviar tu registro. Intenta de nuevo.';
            setSnackbar({
                open: true,
                message: error?.response?.data?.message || messageToShow,
                severity: 'error'
            });
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    backgroundColor: '#f7f7f7',
                    minHeight: '100vh',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px'
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <LoginModal
                open={isLoginOpen}
                onLoginSuccess={handleLoginSuccess}
                disableEscapeKeyDown
                disableBackdropClick
            />

            <Box
                sx={{
                    backgroundColor: '#f7f7f7',
                    minHeight: '100vh',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px'
                }}
            >
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
                        '@media (max-width: 480px)': {
                            padding: '20px',
                            minHeight: 'auto',
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        <img
                            src={logoLuvan}
                            alt="Logo Transportes Luvan"
                            style={{ maxWidth: '150px', height: 'auto' }}
                        />
                    </Box>

                    <Typography
                        variant="h4"
                        gutterBottom
                        sx={{
                            backgroundColor: '#1976d2',
                            color: '#FFFFFF',
                            padding: '1rem',
                            textAlign: 'center',
                            borderRadius: '8px',
                            mb: 3
                        }}
                    >
                        Actualizar Datos de Empleado
                    </Typography>

                    <form onSubmit={handleSubmit} style={{ flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Información del Empleado
                        </Typography>
                        
                        <TextField
                            label="Apellidos"
                            fullWidth
                            margin="normal"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />
                        
                        <TextField
                            label="Nombres"
                            fullWidth
                            margin="normal"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />

                        
                        <TextField
                            label="Teléfono"
                            fullWidth
                            margin="normal"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="50241234567"
                        />

                        <TextField
                            label="Dirección de Servicio"
                            fullWidth
                            margin="normal"
                            value={serviceAddress}
                            onChange={(e) => setServiceAddress(e.target.value)}
                            required
                            placeholder="Ej: Calle Principal 123, Zona 10"
                        />

                        <TextField
                            label="Zona o Sector"
                            fullWidth
                            margin="normal"
                            value={zoneOrSector}
                            onChange={(e) => setZoneOrSector(e.target.value)}
                            required
                            placeholder="Ej: Zona 1, Sector A"
                        />

                        <FormControl fullWidth margin="normal">
                            <InputLabel>Tipo de Ruta</InputLabel>
                            <Select
                                value={routeType}
                                onChange={(e) => setRouteType(e.target.value)}
                                label="Tipo de Ruta"
                                required
                            >
                                <MenuItem value="Completa">Completa</MenuItem>
                                <MenuItem value="Media PM">Media PM</MenuItem>
                                <MenuItem value="Media AM">Media AM</MenuItem>
                            </Select>
                        </FormControl>

                        {schedules && schedules.length > 0 && (
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Horario</InputLabel>
                                <Select
                                    value={selectedSchedule}
                                    onChange={(e) => setSelectedSchedule(Number(e.target.value))}
                                    label="Horario"
                                >
                                    <MenuItem value={-1}>-- Seleccione --</MenuItem>
                                    {schedules.map((s, idx) => (
                                        <MenuItem key={idx} value={idx}>{s.name || `Horario ${idx+1}`}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Contacto de Emergencia
                        </Typography>
                        
                        <TextField
                            label="Contacto de Emergencia"
                            fullWidth
                            margin="normal"
                            value={emergencyContact}
                            onChange={(e) => setEmergencyContact(e.target.value)}
                            required
                        />
                        
                        <TextField
                            label="Parentesco"
                            fullWidth
                            margin="normal"
                            value={emergencyRelationship}
                            onChange={(e) => setEmergencyRelationship(e.target.value)}
                            required
                        />
                        
                        <TextField
                            label="Celular"
                            fullWidth
                            margin="normal"
                            value={emergencyPhone}
                            onChange={(e) => setEmergencyPhone(e.target.value)}
                            required
                        />

                        <Divider sx={{ my: 3 }} />

                        {extraFields.length > 0 && (
                            <>
                                <Typography variant="h6" sx={{ mb: 2 }}>Campos Adicionales</Typography>
                                {extraFields.map((field, idx) => (
                                    <Box key={idx} sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{field.fieldName}{field.required && ' *'}</Typography>

                                        {field.type === 'text' && (
                                            <TextField
                                                placeholder={field.fieldName}
                                                fullWidth
                                                required={field.required}
                                                value={getExtraValue(field.fieldName) || ''}
                                                onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                            />
                                        )}

                                        {field.type === 'number' && (
                                            <TextField
                                                type="number"
                                                placeholder={field.fieldName}
                                                fullWidth
                                                required={field.required}
                                                value={getExtraValue(field.fieldName) || ''}
                                                onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                            />
                                        )}

                                        {field.type === 'date' && (
                                            <TextField
                                                type="date"
                                                fullWidth
                                                required={field.required}
                                                InputLabelProps={{ shrink: true }}
                                                placeholder={field.fieldName}
                                                value={getExtraValue(field.fieldName) || ''}
                                                onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                            />
                                        )}

                                        {field.type === 'select' && (
                                            <FormControl fullWidth required={field.required}>
                                                <InputLabel>{field.fieldName}</InputLabel>
                                                <Select
                                                    value={getExtraValue(field.fieldName) || ''}
                                                    onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                                >
                                                    <MenuItem value="">-- Seleccione --</MenuItem>
                                                    {(field.options || []).map((opt, i) => (<MenuItem key={i} value={opt}>{opt}</MenuItem>))}
                                                </Select>
                                            </FormControl>
                                        )}
                                    </Box>
                                ))}
                            </>
                        )}

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="h6" sx={{ mb: 2 }}>Datos de la Cuenta</Typography>

                        <TextField
                            label="Nombre de usuario"
                            fullWidth
                            margin="normal"
                            value={accountUsername}
                            onChange={(e) => setAccountUsername(e.target.value)}
                            required
                        />

                        <TextField
                            label="Correo electrónico"
                            type="email"
                            fullWidth
                            margin="normal"
                            value={accountEmail}
                            onChange={(e) => setAccountEmail(e.target.value)}
                            required
                        />

                        <TextField
                            label="Contraseña (dejar en blanco para no cambiar)"
                            type="password"
                            fullWidth
                            margin="normal"
                            value={accountPassword}
                            onChange={(e) => setAccountPassword(e.target.value)}
                            placeholder="Nueva contraseña opcional"
                        />

                        <Button
                            type="submit"
                            variant="contained"
                            sx={{
                                backgroundColor: '#1976d2',
                                color: '#FFFFFF',
                                marginTop: '1.5rem',
                                padding: '0.75rem',
                                width: '100%',
                                fontSize: '1rem',
                                '&:hover': {
                                    backgroundColor: '#1565c0'
                                }
                            }}
                        >
                            Actualizar Datos
                        </Button>
                    </form>

                    <Box sx={{ mt: 4, textAlign: 'center', color: '#777' }}>
                        <Divider sx={{ mb: 1 }} />
                        <Typography variant="body2">
                            Todos los derechos reservados a Transportes Luvan
                        </Typography>
                        <Typography variant="body2">
                            Desarrollado por{' '}
                            <a
                                href="https://haricode.com"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                haricode.com
                            </a>
                        </Typography>
                    </Box>

                    <Snackbar
                        open={snackbar.open}
                        autoHideDuration={6000}
                        onClose={() => setSnackbar({ ...snackbar, open: false })}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert
                            onClose={() => setSnackbar({ ...snackbar, open: false })}
                            severity={snackbar.severity}
                            sx={{ width: '100%' }}
                        >
                            {snackbar.message}
                        </Alert>
                    </Snackbar>
                </Box>
            </Box>
        </>
    );
};

export default UpdateEmployeeInfoPage;
