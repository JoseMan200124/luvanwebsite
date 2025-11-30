// src/pages/CorporateEnrollmentPage.jsx

import React, { useState, useEffect } from 'react';
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
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/axiosConfig';
import logoLuvan from '../assets/img/logo-sin-fondo.png';

// Función para convertir tiempo de 24h a 12h con AM/PM
const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

const CorporateEnrollmentPage = () => {
    const { corporationId } = useParams();
        
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [corporationData, setCorporationData] = useState(null);

    // Campos del formulario de colaborador
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');
    const [selectedSchedule, setSelectedSchedule] = useState(-1); // Índice del horario seleccionado

    // Contacto de emergencia
    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyRelationship, setEmergencyRelationship] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');

    // Campos para la creación del usuario
    const [accountFullName, setAccountFullName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Campos dinámicos definidos por la corporación
    const [extraFieldsValues, setExtraFieldsValues] = useState({});

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            corporationId,
            lastName,
            firstName,
            phoneNumber,
            serviceAddress,
            zoneOrSector,
            routeType,
            selectedSchedule, // Horario seleccionado
            emergencyContact,
            emergencyRelationship,
            emergencyPhone,
            accountFullName,
            accountEmail,
            accountPassword
        };
        // Incluir campos extra si existen
        if (extraFieldsValues && Object.keys(extraFieldsValues).length > 0) {
            payload.extraFields = extraFieldsValues;
        }

        try {
            await api.post(`/public/corporations/enroll/${corporationId}`, payload);
            
            // Redirigir a la página de agradecimiento
            setTimeout(() => {
                navigate('/thank-you', {
                    state: {
                        title: '¡Gracias por inscribirse!',
                        body: 'En breve le llegará un correo electrónico con su usuario.',
                        footer: 'Transporte Luvan'
                    }
                });
            }, 2000);
            
            setSnackbar({
                open: true,
                message: '¡Registro enviado correctamente!',
                severity: 'success'
            });

            // Limpiar formulario
            setLastName('');
            setFirstName('');
            setPhoneNumber('');
            setServiceAddress('');
            setZoneOrSector('');
            setRouteType('Completa');
            setSelectedSchedule(-1);
            setEmergencyContact('');
            setEmergencyRelationship('');
            setEmergencyPhone('');
            setAccountFullName('');
            setAccountEmail('');
            setAccountPassword('');
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

    useEffect(() => {
        const fetchCorporationData = async () => {
            try {
                const response = await api.get(`/corporations/${corporationId}`);
                
                if (response.data && response.data.corporation) {
                    const corp = response.data.corporation;
                    
                    // Parse schedules if it's a string
                    if (corp.schedules && typeof corp.schedules === 'string') {
                        try {
                            corp.schedules = JSON.parse(corp.schedules);
                        } catch (e) {
                            corp.schedules = [];
                        }
                    } else if (!Array.isArray(corp.schedules)) {
                        corp.schedules = [];
                    }

                    // Parse extraEnrollmentFields if it was saved as a JSON string
                    if (corp.extraEnrollmentFields && typeof corp.extraEnrollmentFields === 'string') {
                        try {
                            corp.extraEnrollmentFields = JSON.parse(corp.extraEnrollmentFields);
                        } catch (e) {
                            corp.extraEnrollmentFields = [];
                        }
                    } else if (!Array.isArray(corp.extraEnrollmentFields)) {
                        corp.extraEnrollmentFields = [];
                    }

                    // Normalizar cada campo extra al mismo formato que usa el flujo de colegios: { fieldName, type, required, options?, default? }
                    corp.extraEnrollmentFields = (corp.extraEnrollmentFields || []).map((fld, idx) => {
                        if (!fld) return null;
                        if (typeof fld === 'string') {
                            return { fieldName: fld, type: 'text', required: false, options: [], default: '' };
                        }

                        const fieldName = fld.fieldName || fld.label || fld.name || fld.key || `extra_${idx}`;
                        const type = (fld.type || 'text').toLowerCase();
                        const required = fld.required === true || fld.required === 'true' || fld.isRequired === true || false;
                        const options = Array.isArray(fld.options) ? fld.options : (fld.choices || []);
                        const def = fld.default !== undefined ? fld.default : (fld.value !== undefined ? fld.value : '');

                        return { fieldName, type, required, options, default: def };
                    }).filter(Boolean);

                    // Inicializar valores por defecto para campos extra si existen (usar fieldName como clave)
                    if (corp.extraEnrollmentFields.length > 0) {
                        const initial = {};
                        corp.extraEnrollmentFields.forEach(field => {
                            initial[field.fieldName] = field.default !== undefined ? field.default : '';
                        });
                        setExtraFieldsValues(initial);
                    }

                    setCorporationData(corp);
                    console.log('Corporación obtenida:', corp);
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

        fetchCorporationData();
    }, [corporationId]);

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
                        Formulario de Inscripción de Colaborador
                    </Typography>

                    <form onSubmit={handleSubmit} style={{ flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Información del Colaborador
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
                            label="Teléfono del Colaborador"
                            fullWidth
                            margin="normal"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                            placeholder="Ej: 55555555"
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

                        <FormControl fullWidth margin="normal">
                            <InputLabel>Horario</InputLabel>
                            <Select
                                value={selectedSchedule}
                                onChange={(e) => setSelectedSchedule(e.target.value)}
                                label="Horario"
                                required
                            >
                                <MenuItem value={-1}>
                                    <em>Seleccionar horario</em>
                                </MenuItem>
                                {Array.isArray(corporationData?.schedules) && corporationData.schedules.length > 0 ? (
                                    corporationData.schedules.map((schedule, idx) => (
                                        <MenuItem key={idx} value={idx}>
                                            {schedule.name} ({formatTime12Hour(schedule.entryTime)} - {formatTime12Hour(schedule.exitTime)})
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem disabled value={-1}>
                                        No hay horarios configurados
                                    </MenuItem>
                                )}
                            </Select>
                        </FormControl>

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

                        {Array.isArray(corporationData?.extraEnrollmentFields) && corporationData.extraEnrollmentFields.length > 0 && (
                            <>
                                <Divider sx={{ my: 3 }} />
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Campos adicionales
                                </Typography>
                                {corporationData.extraEnrollmentFields.map((field, idx) => {
                                    const fieldName = field.fieldName || field.label || field.name || field.key || `extra_${idx}`;
                                    const key = fieldName;
                                    const label = fieldName;
                                    const type = (field.type || 'text').toLowerCase();

                                    const handleChange = (value) => {
                                        setExtraFieldsValues(prev => ({ ...prev, [fieldName]: value }));
                                    };

                                    if (type === 'select') {
                                        return (
                                            <FormControl fullWidth margin="normal" key={key}>
                                                <InputLabel>{label}</InputLabel>
                                                <Select
                                                    value={extraFieldsValues[fieldName] ?? ''}
                                                    label={label}
                                                    onChange={(e) => handleChange(e.target.value)}
                                                >
                                                    {(Array.isArray(field.options) ? field.options : []).map((opt, i) => (
                                                        <MenuItem key={i} value={opt.value ?? opt}>{opt.label ?? opt}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        );
                                    }

                                    if (type === 'textarea') {
                                        return (
                                            <TextField
                                                key={key}
                                                label={label}
                                                fullWidth
                                                margin="normal"
                                                multiline
                                                rows={4}
                                                value={extraFieldsValues[fieldName] ?? ''}
                                                onChange={(e) => handleChange(e.target.value)}
                                            />
                                        );
                                    }

                                    // Default: text / number / checkbox
                                    if (type === 'checkbox') {
                                        return (
                                            <FormControl key={key} margin="normal">
                                                <InputLabel shrink>{label}</InputLabel>
                                                <Select
                                                    value={extraFieldsValues[fieldName] ? 'true' : 'false'}
                                                    onChange={(e) => handleChange(e.target.value === 'true')}
                                                >
                                                    <MenuItem value={'true'}>Sí</MenuItem>
                                                    <MenuItem value={'false'}>No</MenuItem>
                                                </Select>
                                            </FormControl>
                                        );
                                    }

                                    return (
                                        <TextField
                                            key={key}
                                            label={label}
                                            fullWidth
                                            margin="normal"
                                            type={type === 'number' ? 'number' : 'text'}
                                            value={extraFieldsValues[fieldName] ?? ''}
                                            onChange={(e) => handleChange(e.target.value)}
                                        />
                                    );
                                })}
                            </>
                        )}

                        <Divider sx={{ my: 3 }} />

                        <Typography
                            variant="h6"
                            sx={{
                                backgroundColor: '#47A56B',
                                color: '#FFFFFF',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                mb: 2
                            }}
                        >
                            Campos para Creación de Usuario
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
                            Se creará un usuario individual para acceder al portal y la aplicación móvil.
                            Por favor ingrese los datos de acceso que desea utilizar.
                        </Typography>

                        <TextField
                            label="Nombre Completo para el Usuario"
                            fullWidth
                            margin="normal"
                            value={accountFullName}
                            onChange={(e) => setAccountFullName(e.target.value)}
                            required
                        />
                        
                        <TextField
                            label="Correo del Usuario"
                            type="email"
                            fullWidth
                            margin="normal"
                            value={accountEmail}
                            onChange={(e) => setAccountEmail(e.target.value)}
                            required
                        />
                        
                        <TextField
                            label="Contraseña del Usuario"
                            type="password"
                            fullWidth
                            margin="normal"
                            value={accountPassword}
                            onChange={(e) => setAccountPassword(e.target.value)}
                            required
                            helperText="Mínimo 6 caracteres"
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
                            Enviar
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
    );
};

export default CorporateEnrollmentPage;
