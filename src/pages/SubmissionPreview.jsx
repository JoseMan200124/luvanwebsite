// src/pages/SubmissionPreview.jsx

import React from 'react';
import {
    Typography,
    TextField,
    Box,
    Divider,
} from '@mui/material';
import logoLuvan from '../assets/img/logo-sin-fondo.png';

const SubmissionPreview = ({ submission }) => {
    if (!submission) {
        return (
            <Typography variant="body1" color="error">
                No hay datos para mostrar (submission es nulo).
            </Typography>
        );
    }

    // Parsear submission.data si es string
    let data = submission.data;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (err) {
            data = {};
        }
    }

    const {
        familyLastName,
        serviceAddress,
        zoneOrSector,
        routeType,
        studentsCount,
        students = [],
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
        extraFields
    } = data;

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '800px',
                margin: '0 auto',
                backgroundColor: '#f7f7f7',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px',
                // Ajuste responsivo para pantallas muy pequeñas
                '@media (max-width: 480px)': {
                    padding: '10px',
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

            {/* Título */}
            <Typography
                variant="h4"
                gutterBottom
                sx={{
                    backgroundColor: '#0D3FE2',
                    color: '#FFFFFF',
                    padding: '1rem',
                    textAlign: 'center',
                    borderRadius: '8px',
                    mb: 3,
                    width: '100%'
                }}
            >
                Vista Previa de Formulario
            </Typography>

            <Typography variant="h6" sx={{ mb: 2, width: '100%' }}>
                Información Familiar
            </Typography>
            <TextField
                label="Apellidos de familia (del alumno NO de los padres)"
                fullWidth
                margin="normal"
                value={familyLastName || ''}
                disabled
            />
            <TextField
                label="Dirección de servicio"
                fullWidth
                margin="normal"
                value={serviceAddress || ''}
                disabled
            />
            <TextField
                label="Zona o sector"
                fullWidth
                margin="normal"
                value={zoneOrSector || ''}
                disabled
            />
            <TextField
                label="Tipo de ruta"
                fullWidth
                margin="normal"
                value={routeType || ''}
                disabled
            />
            <TextField
                label="Cantidad de alumnos"
                fullWidth
                margin="normal"
                value={studentsCount || ''}
                disabled
            />

            {students.map((st, index) => (
                <Box
                    key={index}
                    sx={{
                        mt: 2,
                        pl: 2,
                        borderLeft: '4px solid #ccc',
                        mb: 2,
                    }}
                >
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Alumno #{index + 1}
                    </Typography>
                    <TextField
                        label={`Nombre del alumno #${index + 1}`}
                        fullWidth
                        margin="normal"
                        value={st.fullName || ''}
                        disabled
                    />
                    <TextField
                        label={`Grado del alumno #${index + 1}`}
                        fullWidth
                        margin="normal"
                        value={st.grade || ''}
                        disabled
                    />
                </Box>
            ))}

            <Divider sx={{ my: 3, width: '100%' }} />

            <Typography variant="h6" sx={{ mb: 2, width: '100%' }}>
                Datos de la Madre
            </Typography>
            <TextField
                label="Nombre madre"
                fullWidth
                margin="normal"
                value={motherName || ''}
                disabled
            />
            <TextField
                label="Celular madre"
                fullWidth
                margin="normal"
                value={motherPhone || ''}
                disabled
            />
            <TextField
                label="Correo madre"
                fullWidth
                margin="normal"
                value={motherEmail || ''}
                disabled
            />

            <Divider sx={{ my: 3, width: '100%' }} />

            <Typography variant="h6" sx={{ mb: 2, width: '100%' }}>
                Datos del Padre
            </Typography>
            <TextField
                label="Nombre padre"
                fullWidth
                margin="normal"
                value={fatherName || ''}
                disabled
            />
            <TextField
                label="Celular padre"
                fullWidth
                margin="normal"
                value={fatherPhone || ''}
                disabled
            />
            <TextField
                label="Correo padre"
                fullWidth
                margin="normal"
                value={fatherEmail || ''}
                disabled
            />

            <Divider sx={{ my: 3, width: '100%' }} />

            {/* SECCIÓN IV: Contacto de Emergencia */}
            <Typography variant="h6" sx={{ mb: 2, width: '100%' }}>
                Contacto de Emergencia
            </Typography>
            <TextField
                label="Contacto emergencia"
                fullWidth
                margin="normal"
                value={emergencyContact || ''}
                disabled
            />
            <TextField
                label="Parentesco"
                fullWidth
                margin="normal"
                value={emergencyRelationship || ''}
                disabled
            />
            <TextField
                label="Celular"
                fullWidth
                margin="normal"
                value={emergencyPhone || ''}
                disabled
            />

            <Divider sx={{ my: 3, width: '100%' }} />

            {/* SECCIÓN V: Datos del Usuario */}
            <Typography
                variant="h6"
                sx={{
                    backgroundColor: '#47A56B',
                    color: '#FFFFFF',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    mb: 2,
                    width: '100%'
                }}
            >
                Datos del Usuario (Solo Lectura)
            </Typography>
            <TextField
                label="Nombre completo de persona a cargo"
                fullWidth
                margin="normal"
                value={accountFullName || ''}
                disabled
            />
            <TextField
                label="Correo del usuario"
                fullWidth
                margin="normal"
                value={accountEmail || ''}
                disabled
            />

            <Divider sx={{ my: 3, width: '100%' }} />

            {extraFields && Object.keys(extraFields).length > 0 && (
                <>
                    <Typography variant="h6" sx={{ mb: 2, width: '100%' }}>
                        Campos Adicionales
                    </Typography>
                    {Object.entries(extraFields).map(([fieldName, fieldValue], idx) => (
                        <TextField
                            key={idx}
                            label={fieldName}
                            fullWidth
                            margin="normal"
                            value={String(fieldValue)}
                            disabled
                        />
                    ))}
                </>
            )}
        </Box>
    );
};

export default SubmissionPreview;
