// src/pages/SchoolEnrollmentPage.jsx

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
    Chip,
    Divider,
    CircularProgress,
    Autocomplete
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/axiosConfig';
import logoLuvan from '../assets/img/logo-sin-fondo.png';

const parseArrayField = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const normalizeGrades = (value) => (
    parseArrayField(value)
        .map((grade) => {
            if (typeof grade === 'string') {
                const name = grade.trim();
                return name ? { name } : null;
            }
            if (grade && typeof grade === 'object') {
                const name = String(grade.name || grade.label || grade.value || '').trim();
                return name ? { ...grade, name } : null;
            }
            return null;
        })
        .filter(Boolean)
);

const getGradeName = (grade) => {
    if (typeof grade === 'string') return grade;
    return String(grade?.name || grade?.label || grade?.value || '').trim();
};

const SchoolEnrollmentPage = () => {
    const { schoolId } = useParams();
        
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);

    const [grades, setGrades] = useState([]);
    const [extraFields, setExtraFields] = useState([]);
    const [schoolInfo, setSchoolInfo] = useState(null);
    const [enrollmentBlockedMessage, setEnrollmentBlockedMessage] = useState('');

    const [familyLastName, setFamilyLastName] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');
    const [studentsCount, setStudentsCount] = useState(1);
    const [students, setStudents] = useState([{ fullName: '', grade: '' }]);

    const [motherName, setMotherName] = useState('');
    const [motherPhone, setMotherPhone] = useState('');
    const [motherEmail, setMotherEmail] = useState('');

    const [fatherName, setFatherName] = useState('');
    const [fatherPhone, setFatherPhone] = useState('');
    const [fatherEmail, setFatherEmail] = useState('');

    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyRelationship, setEmergencyRelationship] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');

    const [accountFullName, setAccountFullName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');

    const [formExtraValues, setFormExtraValues] = useState({});

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    useEffect(() => {
        const count = Number(studentsCount);
        const newArray = [...students];

        if (count > newArray.length) {
            const diff = count - newArray.length;
            for (let i = 0; i < diff; i++) {
                newArray.push({ fullName: '', grade: '' });
            }
        } else if (count < newArray.length) {
            newArray.splice(count);
        }
        setStudents(newArray);
        // eslint-disable-next-line
    }, [studentsCount]);

    const handleChangeStudentField = (index, field, value) => {
        setStudents((prev) => {
            const clone = [...prev];
            clone[index][field] = value;
            return clone;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (enrollmentBlockedMessage) {
            setSnackbar({
                open: true,
                message: enrollmentBlockedMessage,
                severity: 'warning'
            });
            return;
        }

        const finalStudentsCount = students.length;
        const payload = {
            schoolId,
            familyLastName,
            serviceAddress,
            zoneOrSector,
            routeType,
            studentsCount: finalStudentsCount,
            students: students.map((st) => ({
                fullName: st.fullName,
                grade: st.grade
            })),
            motherName,
            motherPhone,
            motherEmail,
            fatherName,
            fatherPhone,
            fatherEmail,
            emergencyContact,
            emergencyRelationship,
            emergencyPhone,
            accountFullName,
            accountEmail,
            accountPassword,
            specialFee: 0,
            extraFields: formExtraValues
        };

        try {
            const response = await api.post(`/public/schools/enroll/${schoolId}`, payload, {
                skipAuth: true,
                skipSchoolCycleContext: true
            });
            const existingUserIdentity = !!response?.data?.existingUserIdentity;
            
            // Redirigir a la página de agradecimiento
            setTimeout(() => {
                navigate('/thank-you', {
                    state: {
                        title: '¡Gracias por inscribirse!',
                        body: existingUserIdentity
                            ? 'Tu familia quedó inscrita en este ciclo. Ingresa con la contraseña que ya usabas para tu usuario.'
                            : 'En breve le llegará un correo electrónico con su usuario.',
                        footer: 'Transportes Luvan'
                    }
                });
            }, 2000);
            
            setSnackbar({
                open: true,
                message: existingUserIdentity
                    ? 'Registro enviado correctamente. Usa tu contraseña actual para ingresar.'
                    : '¡Registro enviado correctamente!',
                severity: 'success'
            });

            setFamilyLastName('');
            setServiceAddress('');
            setZoneOrSector('');
            setRouteType('Completa');
            setStudentsCount(1);
            setStudents([{ fullName: '', grade: '' }]);
            setMotherName('');
            setMotherPhone('');
            setMotherEmail('');
            setFatherName('');
            setFatherPhone('');
            setFatherEmail('');
            setEmergencyContact('');
            setEmergencyRelationship('');
            setEmergencyPhone('');
            setAccountFullName('');
            setAccountEmail('');
            setAccountPassword('');
            setFormExtraValues({});
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
                    setGrades([]);
                    setExtraFields([]);
                }
            } catch (error) {
                console.error('Error al obtener info del colegio:', error);
                setSchoolInfo(null);
                setSnackbar({
                    open: true,
                    message: 'No se pudieron obtener los datos del colegio.',
                    severity: 'error'
                });
            } finally {
                setLoading(false);
            }
        };

        fetchSchoolData();
    }, [schoolId]);

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
                        backgroundColor: '#0D3FE2',
                        color: '#FFFFFF',
                        padding: '1rem',
                        textAlign: 'center',
                        borderRadius: '8px',
                        mb: 3
                    }}
                >
                    Formulario de Inscripción
                </Typography>

                {schoolInfo && (
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {schoolInfo.name}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            <Chip
                                label={String(schoolInfo.operationStatus || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Operando' : 'Sin operación'}
                                color={String(schoolInfo.operationStatus || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'success' : 'default'}
                                size="small"
                                variant={String(schoolInfo.operationStatus || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'filled' : 'outlined'}
                            />
                            <Chip
                                label={String(schoolInfo.enrollmentStatus || 'OPEN').toUpperCase() === 'OPEN' ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
                                color={String(schoolInfo.enrollmentStatus || 'OPEN').toUpperCase() === 'OPEN' ? 'primary' : 'default'}
                                size="small"
                                variant={String(schoolInfo.enrollmentStatus || 'OPEN').toUpperCase() === 'OPEN' ? 'filled' : 'outlined'}
                            />
                        </Box>
                    </Box>
                )}

                {enrollmentBlockedMessage ? (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        {enrollmentBlockedMessage}
                    </Alert>
                ) : (
                <form onSubmit={handleSubmit} style={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Información Familiar
                    </Typography>
                    <TextField
                        label="Apellidos de familia (del alumno NO de los padres)"
                        fullWidth
                        margin="normal"
                        value={familyLastName}
                        onChange={(e) => setFamilyLastName(e.target.value)}
                        required
                    />
                    <TextField
                        label="Dirección de servicio"
                        fullWidth
                        margin="normal"
                        value={serviceAddress}
                        onChange={(e) => setServiceAddress(e.target.value)}
                        required
                    />
                    <TextField
                        label="Zona o sector"
                        fullWidth
                        margin="normal"
                        value={zoneOrSector}
                        onChange={(e) => setZoneOrSector(e.target.value)}
                        required
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel>Tipo de ruta</InputLabel>
                        <Select
                            value={routeType}
                            onChange={(e) => setRouteType(e.target.value)}
                            label="Tipo de ruta"
                            required
                        >
                            <MenuItem value="Completa">Completa</MenuItem>
                            <MenuItem value="Media PM">Media PM</MenuItem>
                            <MenuItem value="Media AM">Media AM</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth margin="normal">
                        <InputLabel>Cantidad de alumnos</InputLabel>
                        <Select
                            value={studentsCount}
                            onChange={(e) => setStudentsCount(e.target.value)}
                            label="Cantidad de alumnos"
                            required
                        >
                            <MenuItem value={1}>1</MenuItem>
                            <MenuItem value={2}>2</MenuItem>
                            <MenuItem value={3}>3</MenuItem>
                            <MenuItem value={4}>4</MenuItem>
                        </Select>
                    </FormControl>

                    {students.map((st, index) => (
                        <Box
                            key={index}
                            sx={{
                                mt: 2,
                                pl: 2,
                                borderLeft: '4px solid #ccc',
                                mb: 2
                            }}
                        >
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                Alumno #{index + 1}
                            </Typography>
                            <TextField
                                label={`Nombre del alumno #${index + 1}`}
                                fullWidth
                                margin="normal"
                                value={st.fullName}
                                onChange={(e) =>
                                    handleChangeStudentField(index, 'fullName', e.target.value)
                                }
                                required
                            />
                            <Autocomplete
                                options={grades}
                                getOptionLabel={getGradeName}
                                isOptionEqualToValue={(option, value) => getGradeName(option) === getGradeName(value)}
                                value={
                                    grades.find((g) => getGradeName(g) === st.grade) || null
                                }
                                onChange={(event, newValue) =>
                                    handleChangeStudentField(
                                        index,
                                        'grade',
                                        getGradeName(newValue)
                                    )
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={`Grado del alumno #${index + 1}`}
                                        margin="normal"
                                        required
                                    />
                                )}
                            />
                        </Box>
                    ))}

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Datos de la Madre
                    </Typography>
                    <TextField
                        label="Nombre madre"
                        fullWidth
                        margin="normal"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        required
                    />
                    <TextField
                        label="Celular madre"
                        fullWidth
                        margin="normal"
                        value={motherPhone}
                        onChange={(e) => setMotherPhone(e.target.value)}
                        required
                    />
                    <TextField
                        label="Correo madre"
                        type="email"
                        fullWidth
                        margin="normal"
                        value={motherEmail}
                        onChange={(e) => setMotherEmail(e.target.value)}
                        required
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Datos del Padre
                    </Typography>
                    <TextField
                        label="Nombre padre"
                        fullWidth
                        margin="normal"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        required
                    />
                    <TextField
                        label="Celular padre"
                        fullWidth
                        margin="normal"
                        value={fatherPhone}
                        onChange={(e) => setFatherPhone(e.target.value)}
                        required
                    />
                    <TextField
                        label="Correo padre"
                        type="email"
                        fullWidth
                        margin="normal"
                        value={fatherEmail}
                        onChange={(e) => setFatherEmail(e.target.value)}
                        required
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Contacto de Emergencia
                    </Typography>
                    <TextField
                        label="Contacto emergencia"
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
                        value={accountFullName}
                        onChange={(e) => setAccountFullName(e.target.value)}
                        required
                    />
                    <TextField
                        label="Correo del usuario"
                        type="email"
                        fullWidth
                        margin="normal"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        required
                    />
                    <TextField
                        label="Contraseña del usuario"
                        type="password"
                        fullWidth
                        margin="normal"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        required
                    />

                    <Divider sx={{ my: 3 }} />

                    {extraFields.length > 0 && (
                        <>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Campos Adicionales
                            </Typography>
                            {extraFields.map((field, idx) => (
                                <Box key={idx} sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        {field.fieldName}
                                        {field.required && ' *'}
                                    </Typography>

                                    {field.type === 'text' && (
                                        <TextField
                                            placeholder={field.fieldName}
                                            fullWidth
                                            required={field.required}
                                            value={formExtraValues[field.fieldName] || ''}
                                            onChange={(e) =>
                                                setFormExtraValues({
                                                    ...formExtraValues,
                                                    [field.fieldName]: e.target.value
                                                })
                                            }
                                        />
                                    )}

                                    {field.type === 'number' && (
                                        <TextField
                                            type="number"
                                            placeholder={field.fieldName}
                                            fullWidth
                                            required={field.required}
                                            value={formExtraValues[field.fieldName] || ''}
                                            onChange={(e) =>
                                                setFormExtraValues({
                                                    ...formExtraValues,
                                                    [field.fieldName]: e.target.value
                                                })
                                            }
                                        />
                                    )}

                                    {field.type === 'date' && (
                                        <TextField
                                            type="date"
                                            fullWidth
                                            required={field.required}
                                            InputLabelProps={{ shrink: true }}
                                            placeholder={field.fieldName}
                                            value={formExtraValues[field.fieldName] || ''}
                                            onChange={(e) =>
                                                setFormExtraValues({
                                                    ...formExtraValues,
                                                    [field.fieldName]: e.target.value
                                                })
                                            }
                                        />
                                    )}

                                    {field.type === 'select' && (
                                        <FormControl fullWidth required={field.required}>
                                            <InputLabel>{field.fieldName}</InputLabel>
                                            <Select
                                                value={formExtraValues[field.fieldName] || ''}
                                                onChange={(e) =>
                                                    setFormExtraValues({
                                                        ...formExtraValues,
                                                        [field.fieldName]: e.target.value
                                                    })
                                                }
                                            >
                                                <MenuItem value="">-- Seleccione --</MenuItem>
                                                <MenuItem value="Opción1">Opción1</MenuItem>
                                                <MenuItem value="Opción2">Opción2</MenuItem>
                                            </Select>
                                        </FormControl>
                                    )}
                                </Box>
                            ))}
                        </>
                    )}

                    <Button
                        type="submit"
                        variant="contained"
                        sx={{
                            backgroundColor: '#47A56B',
                            color: '#FFFFFF',
                            marginTop: '1.5rem',
                            padding: '0.75rem',
                            width: '100%',
                            fontSize: '1rem'
                        }}
                    >
                        Enviar
                    </Button>

                    <Box
                        sx={{
                            mt: 2,
                            p: 1.5,
                            backgroundColor: '#f0f7f4',
                            border: '1px solid #c8e6c9',
                            borderRadius: 1,
                            textAlign: 'center'
                        }}
                    >
                        <Typography variant="caption" sx={{ color: '#555' }}>
                            📧 El correo de confirmación será enviado desde{' '}
                            <strong>haricodeoficial@gmail.com</strong>. Si no lo encuentras en tu
                            bandeja de entrada, revisa tu carpeta de <em>spam</em> o{' '}
                            <em>correo no deseado</em>.
                        </Typography>
                    </Box>
                </form>
                )}

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

export default SchoolEnrollmentPage;
