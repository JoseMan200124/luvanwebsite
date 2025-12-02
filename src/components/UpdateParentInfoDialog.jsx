// src/components/UpdateParentInfoDialog.jsx
import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    TextField,
    Button,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    Alert,
    Snackbar,
    Box,
    Divider,
    CircularProgress,
    Autocomplete
} from '@mui/material';
import api from '../utils/axiosConfig';

const UpdateParentInfoDialog = ({ open, onClose, initialData = {}, onSaved }) => {
    const [loading, setLoading] = useState(false);

    const [schoolId, setSchoolId] = useState('');
    const [grades, setGrades] = useState([]);
    const [extraFields, setExtraFields] = useState([]);

    // Información familiar
    const [familyLastName, setFamilyLastName] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');
    const [studentsCount, setStudentsCount] = useState(1);
    const [students, setStudents] = useState([{ fullName: '', grade: '' }]);

    // Datos de la madre
    const [motherName, setMotherName] = useState('');
    const [motherPhone, setMotherPhone] = useState('');
    const [motherEmail, setMotherEmail] = useState('');

    // Datos del padre
    const [fatherName, setFatherName] = useState('');
    const [fatherPhone, setFatherPhone] = useState('');
    const [fatherEmail, setFatherEmail] = useState('');

    // Contacto de emergencia
    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyRelationship, setEmergencyRelationship] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');

    // Datos de la cuenta
    const [accountFullName, setAccountFullName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [changePassword, setChangePassword] = useState(false);

    // Campos extras
    const [formExtraValues, setFormExtraValues] = useState({});

    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        if (!open) return;

        // Populate from initialData when dialog opens
        setSchoolId(initialData?.schoolId || '');
        setFamilyLastName(initialData?.familyLastName || '');
        setServiceAddress(initialData?.serviceAddress || '');
        setZoneOrSector(initialData?.zoneOrSector || '');
        setRouteType(initialData?.routeType || 'Completa');
        setStudentsCount(initialData?.studentsCount || 1);
        setStudents(initialData?.students?.length > 0 ? initialData.students : [{ fullName: '', grade: '' }]);
        setMotherName(initialData?.motherName || '');
        setMotherPhone(initialData?.motherPhone || '');
        setMotherEmail(initialData?.motherEmail || '');
        setFatherName(initialData?.fatherName || '');
        setFatherPhone(initialData?.fatherPhone || '');
        setFatherEmail(initialData?.fatherEmail || '');
        setEmergencyContact(initialData?.emergencyContact || '');
        setEmergencyRelationship(initialData?.emergencyRelationship || '');
        setEmergencyPhone(initialData?.emergencyPhone || '');
        setAccountFullName(initialData?.accountFullName || '');
        setAccountEmail(initialData?.accountEmail || '');
        setFormExtraValues(initialData?.extraFields || {});

        // Fetch school data
        if (initialData?.schoolId) {
            fetchSchoolData(initialData.schoolId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const fetchSchoolData = async (id) => {
        setLoading(true);
        try {
            const response = await api.get(`/schools/${id}`);

            if (response.data && response.data.school) {
                const { school } = response.data;
                if (Array.isArray(school.grades)) {
                    setGrades(school.grades);
                } else {
                    setGrades([]);
                }

                let parsedExtraFields = [];
                if (Array.isArray(school.extraEnrollmentFields)) {
                    parsedExtraFields = school.extraEnrollmentFields;
                } else if (school.extraEnrollmentFields) {
                    try {
                        parsedExtraFields = JSON.parse(school.extraEnrollmentFields) || [];
                    } catch {
                        parsedExtraFields = [];
                    }
                }
                setExtraFields(parsedExtraFields);
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

    // Sync students array when studentsCount changes
    useEffect(() => {
        const count = Number(studentsCount);
        setStudents(prev => {
            const newArray = [...prev];
            if (count > newArray.length) {
                const diff = count - newArray.length;
                for (let i = 0; i < diff; i++) {
                    newArray.push({ fullName: '', grade: '' });
                }
            } else if (count < newArray.length) {
                newArray.splice(count);
            }
            return newArray;
        });
    }, [studentsCount]);

    const handleChangeStudentField = (index, field, value) => {
        setStudents(prev => {
            const clone = [...prev];
            clone[index] = { ...clone[index], [field]: value };
            return clone;
        });
    };

    const handleSubmit = async (e) => {
        e && e.preventDefault && e.preventDefault();

        if (!familyLastName || !serviceAddress || !zoneOrSector) {
            setSnackbar({ open: true, message: 'Por favor, completa los campos requeridos.', severity: 'error' });
            return;
        }

        const payload = {
            familyLastName,
            serviceAddress,
            zoneOrSector,
            routeType,
            studentsCount: students.length,
            students: students.map(st => ({
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
            extraFields: formExtraValues
        };

        if (changePassword && accountPassword) {
            payload.accountPassword = accountPassword;
        }

        try {
            await api.put(`/update-parent-info/${schoolId}`, payload);

            setSnackbar({ open: true, message: '¡Información actualizada correctamente!', severity: 'success' });
            onSaved && onSaved();
            setTimeout(() => onClose && onClose(), 1000);
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            setSnackbar({
                open: true,
                message: error?.response?.data?.message || 'Ocurrió un error al actualizar la información.',
                severity: 'error'
            });
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onClose={() => onClose && onClose()} fullWidth maxWidth="md">
            <DialogTitle>Actualizar Datos de Familia</DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
                ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                        
                        {/* Información Familiar */}
                        <Typography variant="h6" sx={{ mb: 1 }}>Información Familiar</Typography>

                        <TextField
                            label="Apellido de familia (del alumno)"
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
                            <InputLabel>Tipo de Ruta</InputLabel>
                            <Select
                                value={routeType}
                                onChange={(e) => setRouteType(e.target.value)}
                                label="Tipo de Ruta"
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
                            >
                                <MenuItem value={1}>1</MenuItem>
                                <MenuItem value={2}>2</MenuItem>
                                <MenuItem value={3}>3</MenuItem>
                                <MenuItem value={4}>4</MenuItem>
                            </Select>
                        </FormControl>

                        {/* Estudiantes */}
                        {students.map((st, index) => (
                            <Box
                                key={index}
                                sx={{
                                    mt: 2,
                                    pl: 2,
                                    borderLeft: '4px solid #144CCC',
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
                                    onChange={(e) => handleChangeStudentField(index, 'fullName', e.target.value)}
                                    required
                                />
                                {grades.length > 0 ? (
                                    <Autocomplete
                                        options={grades}
                                        getOptionLabel={(option) => option.name}
                                        isOptionEqualToValue={(option, value) => option.name === value?.name}
                                        value={grades.find((g) => g.name === st.grade) || null}
                                        onChange={(event, newValue) =>
                                            handleChangeStudentField(index, 'grade', newValue ? newValue.name : '')
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
                                ) : (
                                    <TextField
                                        label={`Grado del alumno #${index + 1}`}
                                        fullWidth
                                        margin="normal"
                                        value={st.grade}
                                        onChange={(e) => handleChangeStudentField(index, 'grade', e.target.value)}
                                        required
                                    />
                                )}
                            </Box>
                        ))}

                        <Divider sx={{ my: 2 }} />

                        {/* Datos de la Madre */}
                        <Typography variant="h6" sx={{ mb: 1 }}>Datos de la Madre</Typography>
                        <TextField label="Nombre de la madre" fullWidth margin="normal" value={motherName} onChange={(e) => setMotherName(e.target.value)} required />
                        <TextField label="Celular de la madre" fullWidth margin="normal" value={motherPhone} onChange={(e) => setMotherPhone(e.target.value)} required />
                        <TextField label="Correo de la madre" type="email" fullWidth margin="normal" value={motherEmail} onChange={(e) => setMotherEmail(e.target.value)} required />

                        <Divider sx={{ my: 2 }} />

                        {/* Datos del Padre */}
                        <Typography variant="h6" sx={{ mb: 1 }}>Datos del Padre</Typography>
                        <TextField label="Nombre del padre" fullWidth margin="normal" value={fatherName} onChange={(e) => setFatherName(e.target.value)} required />
                        <TextField label="Celular del padre" fullWidth margin="normal" value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} required />
                        <TextField label="Correo del padre" type="email" fullWidth margin="normal" value={fatherEmail} onChange={(e) => setFatherEmail(e.target.value)} required />

                        <Divider sx={{ my: 2 }} />

                        {/* Contacto de Emergencia */}
                        <Typography variant="h6" sx={{ mb: 1 }}>Contacto de Emergencia</Typography>
                        <TextField label="Contacto de Emergencia" fullWidth margin="normal" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} required />
                        <TextField label="Parentesco" fullWidth margin="normal" value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} required />
                        <TextField label="Celular" fullWidth margin="normal" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} required />

                        {/* Campos Adicionales */}
                        {extraFields.length > 0 && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="h6" sx={{ mb: 1 }}>Campos Adicionales</Typography>
                                {extraFields.map((field, idx) => (
                                    <Box key={idx} sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{field.fieldName}{field.required && ' *'}</Typography>
                                        {field.type === 'text' && (
                                            <TextField
                                                placeholder={field.fieldName}
                                                fullWidth
                                                required={field.required}
                                                value={formExtraValues[field.fieldName] || ''}
                                                onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                            />
                                        )}
                                        {field.type === 'number' && (
                                            <TextField
                                                type="number"
                                                placeholder={field.fieldName}
                                                fullWidth
                                                required={field.required}
                                                value={formExtraValues[field.fieldName] || ''}
                                                onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                            />
                                        )}
                                        {field.type === 'date' && (
                                            <TextField
                                                type="date"
                                                fullWidth
                                                required={field.required}
                                                InputLabelProps={{ shrink: true }}
                                                value={formExtraValues[field.fieldName] || ''}
                                                onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                            />
                                        )}
                                        {field.type === 'select' && (
                                            <FormControl fullWidth required={field.required}>
                                                <InputLabel>{field.fieldName}</InputLabel>
                                                <Select
                                                    value={formExtraValues[field.fieldName] || ''}
                                                    onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}
                                                >
                                                    <MenuItem value="">-- Seleccione --</MenuItem>
                                                    {(field.options || []).map((opt, i) => (
                                                        <MenuItem key={i} value={opt}>{opt}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        )}
                                    </Box>
                                ))}
                            </>
                        )}

                        <Divider sx={{ my: 2 }} />

                        {/* Datos de la Cuenta */}
                        <Typography variant="h6" sx={{ mb: 1 }}>Datos de la Cuenta</Typography>
                        <TextField label="Nombre completo" fullWidth margin="normal" value={accountFullName} onChange={(e) => setAccountFullName(e.target.value)} required />
                        <TextField label="Correo electrónico" type="email" fullWidth margin="normal" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} required />

                        <FormControlLabel
                            control={<Checkbox checked={changePassword} onChange={(e) => setChangePassword(e.target.checked)} />}
                            label="¿Cambiar contraseña?"
                        />
                        {changePassword && (
                            <TextField
                                label="Nueva contraseña"
                                type="password"
                                fullWidth
                                margin="normal"
                                value={accountPassword}
                                onChange={(e) => setAccountPassword(e.target.value)}
                                placeholder="Nueva contraseña"
                            />
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => onClose && onClose()}>Cerrar</Button>
                <Button variant="contained" onClick={handleSubmit} color="primary">Actualizar Datos</Button>
            </DialogActions>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
            </Snackbar>
        </Dialog>
    );
};

export default UpdateParentInfoDialog;
