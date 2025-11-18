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
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');

    // Contacto de emergencia
    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyRelationship, setEmergencyRelationship] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    
    const [accountFullName, setAccountFullName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    const handleLoginSuccess = (userData) => {        
        setCorporationId(userData.corporationId || '');
        setLastName(userData.lastName || '');
        setFirstName(userData.firstName || '');
        setServiceAddress(userData.serviceAddress || '');
        setZoneOrSector(userData.zoneOrSector || '');
        setRouteType(userData.routeType || 'Completa');
        setEmergencyContact(userData.emergencyContact || '');
        setEmergencyRelationship(userData.emergencyRelationship || '');
        setEmergencyPhone(userData.emergencyPhone || '');
        setAccountFullName(userData.accountFullName || '');
        setAccountEmail(userData.accountEmail || '');

        setIsLoginOpen(false);
        fetchCorporationData(userData.corporationId);
    };

    const fetchCorporationData = async (id) => {
        try {
            const response = await api.get(`/corporations/${id}`);
            
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
            accountEmail
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
            setServiceAddress('');
            setZoneOrSector('');
            setRouteType('Completa');
            setEmergencyContact('');
            setEmergencyRelationship('');
            setEmergencyPhone('');
            setAccountFullName('');
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
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al enviar tu registro. Intenta de nuevo.',
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
