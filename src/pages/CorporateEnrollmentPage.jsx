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
import CorporateEnrollmentModal from '../components/modals/CorporateEnrollmentModal';

const CorporateEnrollmentPage = () => {
    const { corporationId } = useParams();
        
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [isEnrollmentModalOpen, setEnrollmentModalOpen] = useState(true);

    // Campos del formulario de empleado
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');

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

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            corporationId,
            lastName,
            firstName,
            serviceAddress,
            zoneOrSector,
            routeType,
            emergencyContact,
            emergencyRelationship,
            emergencyPhone,
            accountFullName,
            accountEmail,
            accountPassword
        };

        try {
            await api.post(`/public/corporations/enroll/${corporationId}`, payload);
            
            // Redirigir a la página de agradecimiento
            setTimeout(() => {
                navigate('/thank-you', {
                    state: {
                        title: '¡Gracias por inscribirse!',
                        body: 'En breve le llegará un correo electrónico con su usuario.',
                        footer: 'Por favor asegúrese de ingresar desde la aplicación móvil.'
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
            setServiceAddress('');
            setZoneOrSector('');
            setRouteType('Completa');
            setEmergencyContact('');
            setEmergencyRelationship('');
            setEmergencyPhone('');
            setAccountFullName('');
            setAccountEmail('');
            setAccountPassword('');
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al enviar tu registro. Intenta de nuevo.',
                severity: 'error'
            });
        }
    };

    useEffect(() => {
        const fetchCorporationData = async () => {
            try {
                const response = await api.get(`/corporations/${corporationId}`);
                
                if (response.data && response.data.corporation) {
                    // Corporación cargada correctamente
                    console.log('Corporación obtenida:', response.data.corporation);
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
        <>
            <CorporateEnrollmentModal
                open={isEnrollmentModalOpen}
                onClose={() => setEnrollmentModalOpen(false)}
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
                        Formulario de Inscripción de Empleado
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
        </>
    );
};

export default CorporateEnrollmentPage;
