// src/components/enrollment/FamilyEnrollmentFields.jsx
import React from 'react';
import {
    Typography,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Box,
    Divider,
    Autocomplete
} from '@mui/material';
import { MAX_STUDENTS, ROUTE_TYPES, getGradeName, resizeStudents } from '../../utils/familyEnrollmentForm';

const STUDENT_COUNT_OPTIONS = Array.from({ length: MAX_STUDENTS }, (_, index) => index + 1);

const FamilyEnrollmentFields = ({ form, onChange, grades = [], extraFieldDefs = [] }) => {
    const bindField = (field) => ({
        value: form[field],
        onChange: (event) => onChange({ ...form, [field]: event.target.value })
    });

    const setStudentField = (index, field, value) => {
        const students = form.students.map((student, i) => (i === index ? { ...student, [field]: value } : student));
        onChange({ ...form, students });
    };

    const setExtraField = (fieldName, value) => {
        onChange({ ...form, extraFields: { ...form.extraFields, [fieldName]: value } });
    };

    return (
        <>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Información Familiar
            </Typography>
            <TextField label="Apellidos de familia (del alumno NO de los padres)" fullWidth margin="normal" required {...bindField('familyLastName')} />
            <TextField label="Dirección de servicio" fullWidth margin="normal" required {...bindField('serviceAddress')} />
            <TextField label="Zona o sector" fullWidth margin="normal" required {...bindField('zoneOrSector')} />
            <FormControl fullWidth margin="normal">
                <InputLabel>Tipo de ruta</InputLabel>
                <Select label="Tipo de ruta" required {...bindField('routeType')}>
                    {ROUTE_TYPES.map((routeType) => (
                        <MenuItem key={routeType} value={routeType}>{routeType}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
                <InputLabel>Cantidad de alumnos</InputLabel>
                <Select
                    label="Cantidad de alumnos"
                    required
                    value={form.students.length}
                    onChange={(event) => onChange({ ...form, students: resizeStudents(form.students, event.target.value) })}
                >
                    {STUDENT_COUNT_OPTIONS.map((count) => (
                        <MenuItem key={count} value={count}>{count}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {form.students.map((student, index) => (
                <Box key={index} sx={{ mt: 2, pl: 2, borderLeft: '4px solid #ccc', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Alumno #{index + 1}
                    </Typography>
                    <TextField
                        label={`Nombre del alumno #${index + 1}`}
                        fullWidth
                        margin="normal"
                        value={student.fullName}
                        onChange={(event) => setStudentField(index, 'fullName', event.target.value)}
                        required
                    />
                    <Autocomplete
                        options={[{ name: 'PENDIENTE' }, ...grades]}
                        getOptionLabel={getGradeName}
                        isOptionEqualToValue={(option, value) => getGradeName(option) === getGradeName(value)}
                        value={
                            student.grade === 'PENDIENTE'
                                ? { name: 'PENDIENTE' }
                                : grades.find((grade) => getGradeName(grade) === student.grade) || null
                        }
                        onChange={(_event, newValue) => setStudentField(index, 'grade', getGradeName(newValue))}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={`Grado del alumno #${index + 1}`}
                                margin="normal"
                                required
                                helperText={student.grade === 'PENDIENTE'
                                    ? 'Alumno sin grado: será asignado manualmente por un administrador.'
                                    : ''}
                            />
                        )}
                    />
                </Box>
            ))}

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>Datos de la Madre</Typography>
            <TextField label="Nombre madre" fullWidth margin="normal" required {...bindField('motherName')} />
            <TextField label="Celular madre" fullWidth margin="normal" required {...bindField('motherPhone')} />
            <TextField label="Correo madre" type="email" fullWidth margin="normal" required {...bindField('motherEmail')} />

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>Datos del Padre</Typography>
            <TextField label="Nombre padre" fullWidth margin="normal" required {...bindField('fatherName')} />
            <TextField label="Celular padre" fullWidth margin="normal" required {...bindField('fatherPhone')} />
            <TextField label="Correo padre" type="email" fullWidth margin="normal" required {...bindField('fatherEmail')} />

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>Contacto de Emergencia</Typography>
            <TextField label="Contacto emergencia" fullWidth margin="normal" required {...bindField('emergencyContact')} />
            <TextField label="Parentesco" fullWidth margin="normal" required {...bindField('emergencyRelationship')} />
            <TextField label="Celular" fullWidth margin="normal" required {...bindField('emergencyPhone')} />

            {extraFieldDefs.length > 0 && (
                <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="h6" sx={{ mb: 2 }}>Campos Adicionales</Typography>
                    {extraFieldDefs.map((field, idx) => {
                        const value = form.extraFields[field.fieldName] || '';
                        const handleChange = (event) => setExtraField(field.fieldName, event.target.value);
                        return (
                            <Box key={idx} sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    {field.fieldName}
                                    {field.required && ' *'}
                                </Typography>
                                {field.type === 'text' && (
                                    <TextField placeholder={field.fieldName} fullWidth required={field.required} value={value} onChange={handleChange} />
                                )}
                                {field.type === 'number' && (
                                    <TextField type="number" placeholder={field.fieldName} fullWidth required={field.required} value={value} onChange={handleChange} />
                                )}
                                {field.type === 'date' && (
                                    <TextField type="date" fullWidth required={field.required} InputLabelProps={{ shrink: true }} value={value} onChange={handleChange} />
                                )}
                                {field.type === 'select' && (
                                    <FormControl fullWidth required={field.required}>
                                        <InputLabel>{field.fieldName}</InputLabel>
                                        <Select value={value} onChange={handleChange}>
                                            <MenuItem value="">-- Seleccione --</MenuItem>
                                            <MenuItem value="Opción1">Opción1</MenuItem>
                                            <MenuItem value="Opción2">Opción2</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}
                            </Box>
                        );
                    })}
                </>
            )}
        </>
    );
};

export default FamilyEnrollmentFields;
