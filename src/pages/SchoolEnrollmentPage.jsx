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
    Divider,
    CircularProgress
} from '@mui/material';
import { useParams } from 'react-router-dom';
import api from '../utils/axiosConfig';
import logoLuvan from '../assets/img/logo-sin-fondo.png';

const SchoolEnrollmentPage = () => {
    const { schoolId } = useParams();

    // Estados para la carga de datos
    const [loading, setLoading] = useState(true);
    const [grades, setGrades] = useState([]);

    // Campos extra definidos en el colegio
    const [extraFields, setExtraFields] = useState([]);

    // SECCIÓN I
    const [familyLastName, setFamilyLastName] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');
    const [studentsCount, setStudentsCount] = useState(1);

    // Array de alumnos:
    const [students, setStudents] = useState([{ fullName: '', grade: '' }]);

    // SECCIÓN II
    const [motherName, setMotherName] = useState('');
    const [motherPhone, setMotherPhone] = useState('');
    const [motherEmail, setMotherEmail] = useState('');

    // SECCIÓN III
    const [fatherName, setFatherName] = useState('');
    const [fatherPhone, setFatherPhone] = useState('');
    const [fatherEmail, setFatherEmail] = useState('');

    // SECCIÓN IV
    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyRelationship, setEmergencyRelationship] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');

    // DATOS USUARIO PADRE
    const [accountFullName, setAccountFullName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');

    // Objeto para guardar los valores de los campos extra
    const [formExtraValues, setFormExtraValues] = useState({});

    // SNACKBAR
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Ajustar longitud de `students` según `studentsCount`
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
    }, [studentsCount]);

    // Manejar cambios en los campos de cada alumno
    const handleChangeStudentField = (index, field, value) => {
        setStudents((prev) => {
            const clone = [...prev];
            clone[index][field] = value;
            return clone;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const finalStudentsCount = students.length;

        // Construimos objeto con todos los campos
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
            specialFee: 0, // si requieres algún ajuste

            // Aquí enviamos los valores extra
            extraFields: formExtraValues
        };

        try {
            await api.post(`/public/schools/enroll/${schoolId}`, payload);

            setSnackbar({
                open: true,
                message: '¡Registro enviado correctamente!',
                severity: 'success'
            });

            // Limpieza
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
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al enviar tu registro. Intenta de nuevo.',
                severity: 'error'
            });
        }
    };

    // Fetch de datos del colegio: grados y extraFields
    useEffect(() => {
        const fetchSchoolData = async () => {
            try {
                const response = await api.get(`/schools/${schoolId}`);
                if (response.data && response.data.school) {
                    const { school } = response.data;

                    // Grades
                    if (Array.isArray(school.grades)) {
                        setGrades(school.grades);
                    } else {
                        setGrades([]);
                    }

                    // Extra fields (arreglo con fieldName, type, required)
                    let parsedExtraFields = [];
                    if (Array.isArray(school.extraEnrollmentFields)) {
                        parsedExtraFields = school.extraEnrollmentFields;
                    } else {
                        try {
                            parsedExtraFields = JSON.parse(school.extraEnrollmentFields) || [];
                        } catch {
                            parsedExtraFields = [];
                        }
                    }
                    setExtraFields(parsedExtraFields);

                } else {
                    setGrades([]);
                    setExtraFields([]);
                }
            } catch (error) {
                console.error('Error al obtener info del colegio:', error);
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
                    minHeight: '80vh'
                }}
            >
                {/* Logo */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <img src={logoLuvan} alt="Logo Transportes Luvan" style={{ maxWidth: '150px' }} />
                </Box>

                {/* Título del Formulario */}
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

                {/* Formulario */}
                <form onSubmit={handleSubmit} style={{ flexGrow: 1 }}>
                    {/* SECCIÓN I */}
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
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Grado del alumno #{index + 1}</InputLabel>
                                <Select
                                    value={st.grade}
                                    onChange={(e) =>
                                        handleChangeStudentField(index, 'grade', e.target.value)
                                    }
                                    label={`Grado del alumno #${index + 1}`}
                                    required
                                >
                                    {grades.map((grade, idx) => (
                                        <MenuItem key={idx} value={grade.name}>
                                            {grade.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    ))}

                    <Divider sx={{ my: 3 }} />

                    {/* SECCIÓN II */}
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

                    {/* SECCIÓN III */}
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

                    {/* SECCIÓN IV */}
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

                    {/* SECCIÓN V */}
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

                    {/* CAMPOS EXTRA DEFINIDOS POR EL COLEGIO */}
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
                                                {/* Ejemplo de opciones fijas */}
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
                </form>

                {/* Footer */}
                <Box sx={{ mt: 4, textAlign: 'center', color: '#777' }}>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2">
                        Todos los derechos reservados a Transportes Luvan
                    </Typography>
                    <Typography variant="body2">
                        Desarrollado por <a href="https://haricode.com" target="_blank" rel="noopener noreferrer">haricode.com</a>
                    </Typography>
                </Box>

                {/* Snackbar */}
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
