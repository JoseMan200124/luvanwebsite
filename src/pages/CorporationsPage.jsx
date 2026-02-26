// src/pages/CorporationsPage.jsx

import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Grid,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    TextField,
    Chip,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    FormControlLabel,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { 
    Business as CorporationIcon, 
    ContentCopy, 
    Edit, 
    Delete,
    Add,
    ExpandMore,
    CalendarToday
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import styled from 'styled-components';
import tw from 'twin.macro';
import PermissionGuard from '../components/PermissionGuard';

const PageContainer = styled.div`
    ${tw`bg-gray-50 min-h-screen w-full`}
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;

    @media (max-width: 640px) {
        padding: 1rem;
    }
`;

const HeaderCard = styled(Card)`
    ${tw`mb-6 shadow-lg`}
    background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
    color: white;
`;

const CorporationCard = styled(Card)`
    ${tw`cursor-pointer transition-all duration-300`}
    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }
`;

const StyledAccordion = styled(Accordion)`
    &.MuiAccordion-root {
        border: 1px solid rgba(0, 0, 0, 0.12);
        box-shadow: none;
        margin-bottom: 8px;
        border-radius: 8px !important;
        overflow: hidden;
        
        &:before {
            display: none;
        }
        
        &.Mui-expanded {
            margin-bottom: 8px;
        }
    }
    
    & .MuiAccordionSummary-root {
        background-color: #f8f9fa;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        min-height: 56px;
        transition: background-color 0.3s ease;
        
        &:hover {
            background-color: #e9ecef;
        }
        
        &.Mui-expanded {
            min-height: 56px;
            background-color: #e3f2fd;
        }
    }
    
    & .MuiAccordionDetails-root {
        padding: 24px;
        background-color: #ffffff;
    }
    
    & .MuiAccordionSummary-expandIconWrapper {
        transition: transform 0.3s ease;
        
        &.Mui-expanded {
            transform: rotate(180deg);
        }
    }
`;

const StyledAccordionSummary = styled(AccordionSummary)`
    & .MuiAccordionSummary-content {
        margin: 12px 0;
        
        &.Mui-expanded {
            margin: 12px 0;
        }
    }
`;

// Función para convertir tiempo de 24h a 12h con AM/PM
const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

const CorporationsPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();

    const [corporations, setCorporations] = useState([]);
    const [selectedFiscalYear, setSelectedFiscalYear] = useState(new Date().getFullYear().toString());
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Estados para diálogos
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [selectedCorporation, setSelectedCorporation] = useState(null);
    
    // Estados para formulario
    const [formData, setFormData] = useState({
        name: '',
        contactPhone: '',
        contactEmail: '',
        address: '',
        city: '',
        contactPerson: '',
        routeNumbers: [],
        routeSchedules: [],
        schedules: [],
        extraEnrollmentFields: [],
        whatsappLink: '',
        state: 1
    });
    
    const [newRouteNumber, setNewRouteNumber] = useState('');
    const [corporationSchedules, setCorporationSchedules] = useState([]);
    const [corporationRouteNumbers, setCorporationRouteNumbers] = useState([]);
    const [corporationRouteSchedules, setCorporationRouteSchedules] = useState([]);
    const [newScheduleName, setNewScheduleName] = useState('');
    const [newScheduleEntry, setNewScheduleEntry] = useState('');
    const [newScheduleExit, setNewScheduleExit] = useState('');
    
    // Estado para controlar acordeones expandidos
    const [expandedPanels, setExpandedPanels] = useState({
        basicInfo: true,
        schedules: false,
        routes: false,
        extraFields: false
    });

    // Años fiscales disponibles
    const currentYear = new Date().getFullYear();
    const fiscalYears = [
        { id: (currentYear - 1).toString(), name: `Año Fiscal ${currentYear - 1}` },
        { id: currentYear.toString(), name: `Año Fiscal ${currentYear}` },
        { id: (currentYear + 1).toString(), name: `Año Fiscal ${currentYear + 1}` }
    ];

    const fetchCorporations = useCallback(async () => {
        setLoading(true);
        try {
            const params = { fiscalYear: selectedFiscalYear };
            try {
                const roleId = Number(auth.user?.roleId || 0);
                if (roleId && ![1, 2].includes(roleId)) params.assignedOnly = true;
            } catch (e) { /* ignore */ }

            const response = await api.get('/corporations', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params
            });
            const rawCorporations = Array.isArray(response.data.corporations) 
                ? response.data.corporations 
                : [];
            
            const processedCorporations = rawCorporations.map((corp) => {
                let parsedDepartments = [];
                if (typeof corp.departments === 'string' && corp.departments.trim()) {
                    try {
                        parsedDepartments = JSON.parse(corp.departments);
                    } catch {
                        parsedDepartments = [];
                    }
                } else if (Array.isArray(corp.departments)) {
                    parsedDepartments = corp.departments;
                }
                
                let parsedRoutes = [];
                if (typeof corp.routeNumbers === 'string' && corp.routeNumbers.trim()) {
                    try {
                        parsedRoutes = JSON.parse(corp.routeNumbers);
                    } catch {
                        parsedRoutes = [];
                    }
                } else if (Array.isArray(corp.routeNumbers)) {
                    parsedRoutes = corp.routeNumbers;
                }
                
                let parsedBusinessHours = { start: '08:00', end: '17:00' };
                if (typeof corp.businessHours === 'string' && corp.businessHours.trim()) {
                    try {
                        parsedBusinessHours = JSON.parse(corp.businessHours);
                    } catch {
                        // keep default
                    }
                } else if (typeof corp.businessHours === 'object' && corp.businessHours !== null) {
                    parsedBusinessHours = corp.businessHours;
                }
                
                let parsedExtraFields = [];
                if (typeof corp.extraEnrollmentFields === 'string' && corp.extraEnrollmentFields.trim()) {
                    try {
                        parsedExtraFields = JSON.parse(corp.extraEnrollmentFields);
                    } catch {
                        parsedExtraFields = [];
                    }
                } else if (Array.isArray(corp.extraEnrollmentFields)) {
                    parsedExtraFields = corp.extraEnrollmentFields;
                }
                
                return {
                    ...corp,
                    departments: Array.isArray(parsedDepartments) ? parsedDepartments : [],
                    routeNumbers: Array.isArray(parsedRoutes) ? parsedRoutes : [],
                    businessHours: parsedBusinessHours,
                    extraEnrollmentFields: Array.isArray(parsedExtraFields) ? parsedExtraFields : [],
                    colaboradoresCount: Number(corp.colaboradoresCount) || 0,
                    transportFee: Number(corp.transportFee) || 0
                };
            });
            
            setCorporations(processedCorporations);
        } catch (err) {
            console.error('Error fetching corporations:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener las corporaciones', 
                severity: 'error' 
            });
        } finally {
            setLoading(false);
        }
    }, [auth.token, selectedFiscalYear]);

    useEffect(() => {
        if (auth.token && selectedFiscalYear) {
            fetchCorporations();
        }
    }, [auth.token, selectedFiscalYear, fetchCorporations]);

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchCorporations();
    }, [fetchCorporations]);

    const handleCorporationSelect = (corporation) => {
        navigate(`/admin/corporaciones/${selectedFiscalYear}/${corporation.id}`, {
            state: {
                fiscalYear: selectedFiscalYear,
                corporation: corporation
            }
        });
    };

    const handleCopyEnrollLink = (corporationId) => {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/corporations/enroll/${corporationId}`;
        navigator.clipboard.writeText(link)
            .then(() => {
                setSnackbar({
                    open: true,
                    message: 'Enlace de inscripción copiado al portapapeles',
                    severity: 'success'
                });
            })
            .catch(() => {
                setSnackbar({
                    open: true,
                    message: 'Error al copiar enlace',
                    severity: 'error'
                });
            });
    };

    const handleOpenCreateDialog = () => {
        setFormData({
            name: '',
            contactPhone: '',
            contactEmail: '',
            address: '',
            city: '',
            contactPerson: '',
            routeNumbers: [],
            routeSchedules: [],
            schedules: [],
            extraEnrollmentFields: [],
            whatsappLink: '',
            state: 1
        });
        setCorporationSchedules([]);
        setCorporationRouteNumbers([]);
        setCorporationRouteSchedules([]);
        setExpandedPanels({
            basicInfo: true,
            schedules: false,
            routes: false,
            extraFields: false
        });
        setOpenCreateDialog(true);
    };

    const handleOpenEditDialog = async (corporation) => {
        // Asegurar que extraEnrollmentFields sea siempre un array
        let extraFields = [];
        if (typeof corporation.extraEnrollmentFields === 'string' && corporation.extraEnrollmentFields.trim()) {
            try {
                extraFields = JSON.parse(corporation.extraEnrollmentFields);
            } catch {
                extraFields = [];
            }
        } else if (Array.isArray(corporation.extraEnrollmentFields)) {
            extraFields = corporation.extraEnrollmentFields;
        }
        
        // Parsear schedules
        let parsedSchedules = [];
        if (Array.isArray(corporation.schedules)) {
            parsedSchedules = corporation.schedules;
        } else if (typeof corporation.schedules === 'string' && corporation.schedules.trim()) {
            try {
                parsedSchedules = JSON.parse(corporation.schedules);
            } catch {
                parsedSchedules = [];
            }
        }
        setCorporationSchedules(Array.isArray(parsedSchedules) ? parsedSchedules : []);
        
        // Parsear routeNumbers
        let parsedRoutes = [];
        if (Array.isArray(corporation.routeNumbers)) {
            parsedRoutes = corporation.routeNumbers;
        } else if (typeof corporation.routeNumbers === 'string' && corporation.routeNumbers.trim()) {
            try {
                parsedRoutes = JSON.parse(corporation.routeNumbers);
            } catch {
                parsedRoutes = [];
            }
        }
        setCorporationRouteNumbers(Array.isArray(parsedRoutes) ? parsedRoutes : []);
        
        // Cargar routeSchedules desde el backend
        try {
            const detail = await api.get(`/corporations/${corporation.id}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const rs = (detail.data && detail.data.corporation && Array.isArray(detail.data.corporation.routeSchedules)) 
                ? detail.data.corporation.routeSchedules 
                : [];
            setCorporationRouteSchedules(rs);
        } catch (err) {
            console.error('Error loading route schedules:', err);
            setCorporationRouteSchedules([]);
        }
        
        setSelectedCorporation(corporation);
        setFormData({
            name: corporation.name || '',
            contactPhone: corporation.contactPhone || '',
            contactEmail: corporation.contactEmail || '',
            address: corporation.address || '',
            city: corporation.city || '',
            contactPerson: corporation.contactPerson || '',
            routeNumbers: parsedRoutes,
            routeSchedules: corporation.routeSchedules || [],
            schedules: parsedSchedules,
            extraEnrollmentFields: Array.isArray(extraFields) ? extraFields : [],
            whatsappLink: corporation.whatsappLink || '',
            state: corporation.state !== undefined ? corporation.state : 1
        });
        setExpandedPanels({
            basicInfo: true,
            schedules: false,
            routes: false,
            extraFields: false
        });
        setOpenEditDialog(true);
    };

    const handleOpenDeleteDialog = (corporation) => {
        setSelectedCorporation(corporation);
        setOpenDeleteDialog(true);
    };

    const handleCloseDialogs = () => {
        setOpenCreateDialog(false);
        setOpenEditDialog(false);
        setOpenDeleteDialog(false);
        setSelectedCorporation(null);
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddExtraField = () => {
        setFormData(prev => ({
            ...prev,
            extraEnrollmentFields: [
                ...prev.extraEnrollmentFields,
                { fieldName: '', type: 'text', required: false }
            ]
        }));
    };

    const handleRemoveExtraField = (index) => {
        setFormData(prev => ({
            ...prev,
            extraEnrollmentFields: prev.extraEnrollmentFields.filter((_, i) => i !== index)
        }));
    };

    const handleChangeExtraField = (index, field, value) => {
        setFormData(prev => {
            const clone = [...prev.extraEnrollmentFields];
            clone[index][field] = value;
            return { ...prev, extraEnrollmentFields: clone };
        });
    };

    const handleAddRouteNumber = () => {
        if (newRouteNumber.trim()) {
            setCorporationRouteNumbers(prev => [...prev, newRouteNumber.trim()]);
            setNewRouteNumber('');
        }
    };

    const handleRemoveRouteNumber = (index) => {
        const routeToRemove = corporationRouteNumbers[index];
        setCorporationRouteNumbers(prev => prev.filter((_, i) => i !== index));
        // También remover de routeSchedules
        setCorporationRouteSchedules(prev => prev.filter(rs => rs.routeNumber !== routeToRemove));
    };

    const handleChangeRouteNumber = (index, newValue) => {
        const oldValue = corporationRouteNumbers[index];
        setCorporationRouteNumbers(prev => {
            const updated = [...prev];
            updated[index] = newValue;
            return updated;
        });
        // Actualizar también en routeSchedules
        setCorporationRouteSchedules(prev => {
            return prev.map(rs => rs.routeNumber === oldValue ? { ...rs, routeNumber: newValue } : rs);
        });
    };

    const handleAddSchedule = () => {
        if (newScheduleName.trim() && newScheduleEntry && newScheduleExit) {
            setCorporationSchedules(prev => [
                ...prev,
                {
                    name: newScheduleName.trim(),
                    entryTime: newScheduleEntry,
                    exitTime: newScheduleExit
                }
            ]);
            setNewScheduleName('');
            setNewScheduleEntry('');
            setNewScheduleExit('');
        }
    };

    const handleRemoveSchedule = (index) => {
        const scheduleToRemove = corporationSchedules[index];
        setCorporationSchedules(prev => prev.filter((_, i) => i !== index));
        // También remover de routeSchedules
        setCorporationRouteSchedules(prev => {
            return prev.map(rs => ({
                ...rs,
                schedules: (rs.schedules || []).filter(s => s.name !== scheduleToRemove.name)
            }));
        });
    };

    const handleChangeSchedule = (index, field, value) => {
        setCorporationSchedules(prev => {
            const updated = [...prev];
            updated[index][field] = value;
            return updated;
        });
    };

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedPanels(prev => ({ ...prev, [panel]: isExpanded }));
    };

    const handleCreateCorporation = async () => {
        try {
            const payload = {
                name: formData.name,
                address: formData.address,
                city: formData.city,
                contactPerson: formData.contactPerson,
                contactEmail: formData.contactEmail,
                contactPhone: formData.contactPhone,
                whatsappLink: formData.whatsappLink || null,
                extraEnrollmentFields: Array.isArray(formData.extraEnrollmentFields) ? formData.extraEnrollmentFields : [],
                routeNumbers: Array.isArray(corporationRouteNumbers) ? corporationRouteNumbers : [],
                routeSchedules: Array.isArray(corporationRouteSchedules) ? corporationRouteSchedules : [],
                schedules: Array.isArray(corporationSchedules) ? corporationSchedules : [],
                state: formData.state || 1
            };
            
            await api.post('/corporations', payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Corporación creada exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchCorporations();
        } catch (err) {
            console.error('Error creating corporation:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al crear corporación',
                severity: 'error'
            });
        }
    };

    const handleUpdateCorporation = async () => {
        if (!selectedCorporation) return;
        
        try {
            const payload = {
                name: formData.name,
                address: formData.address,
                city: formData.city,
                contactPerson: formData.contactPerson,
                contactEmail: formData.contactEmail,
                contactPhone: formData.contactPhone,
                whatsappLink: formData.whatsappLink || null,
                extraEnrollmentFields: Array.isArray(formData.extraEnrollmentFields) ? formData.extraEnrollmentFields : [],
                routeNumbers: Array.isArray(corporationRouteNumbers) ? corporationRouteNumbers : [],
                routeSchedules: Array.isArray(corporationRouteSchedules) ? corporationRouteSchedules : [],
                schedules: Array.isArray(corporationSchedules) ? corporationSchedules : [],
                state: formData.state || 1
            };
            
            await api.put(`/corporations/${selectedCorporation.id}`, payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Corporación actualizada exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchCorporations();
        } catch (err) {
            console.error('Error updating corporation:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al actualizar corporación',
                severity: 'error'
            });
        }
    };

    const handleDeleteCorporation = async () => {
        if (!selectedCorporation) return;
        
        try {
            await api.delete(`/corporations/${selectedCorporation.id}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Corporación eliminada exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchCorporations();
        } catch (err) {
            console.error('Error deleting corporation:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al eliminar corporación',
                severity: 'error'
            });
        }
    };

    const renderCorporationDialog = (isEdit = false) => (
        <Dialog 
            open={isEdit ? openEditDialog : openCreateDialog} 
            onClose={handleCloseDialogs}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                {isEdit ? 'Editar Corporación' : 'Añadir Nueva Corporación'}
            </DialogTitle>
            <DialogContent sx={{ px: 3, py: 2 }}>
                {/* Sección: Información Básica */}
                <StyledAccordion 
                    expanded={expandedPanels.basicInfo}
                    onChange={handleAccordionChange('basicInfo')}
                    TransitionProps={{ unmountOnExit: false }}
                >
                    <StyledAccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            📋 Información Básica
                        </Typography>
                    </StyledAccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                fullWidth
                                label="Nombre de la Corporación"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                required
                            />
                            <TextField
                                fullWidth
                                label="Ciudad"
                                value={formData.city}
                                onChange={(e) => handleInputChange('city', e.target.value)}
                            />
                            <TextField
                                fullWidth
                                label="Dirección"
                                value={formData.address}
                                onChange={(e) => handleInputChange('address', e.target.value)}
                                multiline
                                rows={2}
                            />
                            <TextField
                                fullWidth
                                label="Persona de Contacto"
                                value={formData.contactPerson}
                                onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                            />
                            <TextField
                                fullWidth
                                label="Teléfono de Contacto"
                                value={formData.contactPhone}
                                onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                            />
                            <TextField
                                fullWidth
                                label="Email de Contacto"
                                type="email"
                                value={formData.contactEmail}
                                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                            />
                            <TextField
                                fullWidth
                                label="Enlace de WhatsApp"
                                value={formData.whatsappLink}
                                onChange={(e) => handleInputChange('whatsappLink', e.target.value)}
                                placeholder="https://wa.me/50212345678"
                                helperText="Enlace directo para contacto por WhatsApp"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={formData.state === 1}
                                        onChange={(e) => handleInputChange('state', e.target.checked ? 1 : 0)}
                                    />
                                }
                                label="Corporación Activa"
                            />
                        </Box>
                    </AccordionDetails>
                </StyledAccordion>

                {/* Sección: Horarios */}
                <StyledAccordion 
                    expanded={expandedPanels.schedules}
                    onChange={handleAccordionChange('schedules')}
                    TransitionProps={{ unmountOnExit: false }}
                >
                    <StyledAccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            🕐 Horarios de la Corporación
                        </Typography>
                    </StyledAccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                                <TextField
                                    label="Nombre del Horario"
                                    value={newScheduleName}
                                    onChange={(e) => setNewScheduleName(e.target.value)}
                                    placeholder="Ej: AM, PM, Nocturno"
                                    sx={{ flex: 2 }}
                                />
                                <TextField
                                    label="Hora de Entrada"
                                    type="time"
                                    value={newScheduleEntry}
                                    onChange={(e) => setNewScheduleEntry(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1 }}
                                />
                                <TextField
                                    label="Hora de Salida"
                                    type="time"
                                    value={newScheduleExit}
                                    onChange={(e) => setNewScheduleExit(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1 }}
                                />
                                <Button 
                                    variant="contained" 
                                    onClick={handleAddSchedule}
                                    startIcon={<Add />}
                                    disabled={!newScheduleName.trim() || !newScheduleEntry || !newScheduleExit}
                                >
                                    Agregar
                                </Button>
                            </Box>
                            
                            {Array.isArray(corporationSchedules) && corporationSchedules.map((schedule, index) => (
                                <Paper key={index} sx={{ p: 2, border: '1px solid #e0e0e0' }}>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <TextField
                                            label="Nombre"
                                            value={schedule.name}
                                            onChange={(e) => handleChangeSchedule(index, 'name', e.target.value)}
                                            sx={{ flex: 2 }}
                                        />
                                        <TextField
                                            label="Hora de Entrada"
                                            type="time"
                                            value={schedule.entryTime}
                                            onChange={(e) => handleChangeSchedule(index, 'entryTime', e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            sx={{ flex: 1 }}
                                        />
                                        <TextField
                                            label="Hora de Salida"
                                            type="time"
                                            value={schedule.exitTime}
                                            onChange={(e) => handleChangeSchedule(index, 'exitTime', e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            sx={{ flex: 1 }}
                                        />
                                        <IconButton 
                                            color="error" 
                                            onClick={() => handleRemoveSchedule(index)}
                                        >
                                            <Delete />
                                        </IconButton>
                                    </Box>
                                </Paper>
                            ))}
                            
                            {corporationSchedules.length === 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    No hay horarios agregados. Los horarios permiten definir diferentes turnos para los colaboradores.
                                </Typography>
                            )}
                        </Box>
                    </AccordionDetails>
                </StyledAccordion>

                {/* Sección: Rutas */}
                <StyledAccordion 
                    expanded={expandedPanels.routes}
                    onChange={handleAccordionChange('routes')}
                    TransitionProps={{ unmountOnExit: false }}
                >
                    <StyledAccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            🚌 Números de Ruta
                        </Typography>
                    </StyledAccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Nuevo Número de Ruta"
                                    value={newRouteNumber}
                                    onChange={(e) => setNewRouteNumber(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddRouteNumber();
                                        }
                                    }}
                                />
                                <Button 
                                    variant="contained" 
                                    onClick={handleAddRouteNumber}
                                    startIcon={<Add />}
                                >
                                    Agregar
                                </Button>
                            </Box>

                            {corporationRouteNumbers.map((rn, idx) => {
                                const entry = (corporationRouteSchedules || []).find(x => String(x.routeNumber) === String(rn)) || { routeNumber: String(rn), schedules: [] };
                                const selectedSchedules = new Set((entry.schedules || []).map(s => s && s.name).filter(Boolean));
                                
                                const toggleSchedule = (scheduleName, checked) => {
                                    setCorporationRouteSchedules(prev => {
                                        const arr = Array.isArray(prev) ? [...prev] : [];
                                        let i = arr.findIndex(x => String(x.routeNumber) === String(rn));
                                        if (i === -1) { 
                                            arr.push({ routeNumber: String(rn), schedules: [] }); 
                                            i = arr.length - 1; 
                                        }
                                        const curr = Array.isArray(arr[i].schedules) ? [...arr[i].schedules] : [];
                                        const idxByName = curr.findIndex(s => s && s.name === scheduleName);
                                        
                                        if (checked) {
                                            const scheduleObj = corporationSchedules.find(s => s.name === scheduleName);
                                            if (scheduleObj) {
                                                const cleaned = {
                                                    name: scheduleObj.name,
                                                    entryTime: scheduleObj.entryTime,
                                                    exitTime: scheduleObj.exitTime
                                                };
                                                if (idxByName === -1) curr.push(cleaned); 
                                                else curr[idxByName] = cleaned;
                                            }
                                        } else {
                                            if (idxByName !== -1) curr.splice(idxByName, 1);
                                        }
                                        
                                        arr[i] = { routeNumber: String(rn), schedules: curr };
                                        return arr;
                                    });
                                };

                                return (
                                    <Paper key={idx} sx={{ p: 2, border: '1px solid #e0e0e0' }}>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                                            <TextField
                                                fullWidth
                                                value={rn}
                                                onChange={(e) => handleChangeRouteNumber(idx, e.target.value)}
                                                label={`Número de Ruta #${idx + 1}`}
                                            />
                                            <IconButton size="small" color="error" onClick={() => handleRemoveRouteNumber(idx)}>
                                                <Delete />
                                            </IconButton>
                                        </Box>
                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                                            Horarios asignados a esta ruta:
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {corporationSchedules.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    Agregue horarios en la sección de arriba para poder asignarlos a esta ruta
                                                </Typography>
                                            ) : (
                                                Array.isArray(corporationSchedules) && corporationSchedules.map((sch, si) => {
                                                    const label = `${sch.name} (${formatTime12Hour(sch.entryTime)} - ${formatTime12Hour(sch.exitTime)})`;
                                                    const checked = selectedSchedules.has(sch.name);
                                                    return (
                                                        <FormControlLabel
                                                            key={`rn-${idx}-sch-${si}`}
                                                            control={
                                                                <Checkbox 
                                                                    size="small" 
                                                                    checked={checked} 
                                                                    onChange={(e) => toggleSchedule(sch.name, e.target.checked)} 
                                                                />
                                                            }
                                                            label={label}
                                                        />
                                                    );
                                                })
                                            )}
                                        </Box>
                                    </Paper>
                                );
                            })}
                            
                            {corporationRouteNumbers.length === 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    No hay rutas agregadas
                                </Typography>
                            )}
                        </Box>
                    </AccordionDetails>
                </StyledAccordion>

                {/* Sección: Campos de Inscripción Extra */}
                <StyledAccordion 
                    expanded={expandedPanels.extraFields}
                    onChange={handleAccordionChange('extraFields')}
                    TransitionProps={{ unmountOnExit: false }}
                >
                    <StyledAccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            � Campos de Inscripción Extra
                        </Typography>
                    </StyledAccordionSummary>
                    <AccordionDetails>
                        <Box>
                            <Button 
                                variant="outlined" 
                                onClick={handleAddExtraField}
                                startIcon={<Add />}
                                sx={{ mb: 2 }}
                            >
                                Agregar Campo
                            </Button>
                            {Array.isArray(formData.extraEnrollmentFields) && formData.extraEnrollmentFields.map((field, index) => (
                                <Box 
                                    key={index}
                                    sx={{ 
                                        display: 'flex', 
                                        gap: 2, 
                                        mb: 2, 
                                        p: 2, 
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 1,
                                        alignItems: 'center'
                                    }}
                                >
                                    <TextField
                                        fullWidth
                                        label="Nombre del Campo"
                                        value={field.fieldName}
                                        onChange={(e) => handleChangeExtraField(index, 'fieldName', e.target.value)}
                                    />
                                    <FormControl sx={{ minWidth: 150 }}>
                                        <InputLabel>Tipo</InputLabel>
                                        <Select
                                            value={field.type}
                                            onChange={(e) => handleChangeExtraField(index, 'type', e.target.value)}
                                            label="Tipo"
                                        >
                                            <MenuItem value="text">Texto</MenuItem>
                                            <MenuItem value="email">Email</MenuItem>
                                            <MenuItem value="number">Número</MenuItem>
                                            <MenuItem value="tel">Teléfono</MenuItem>
                                            <MenuItem value="date">Fecha</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={field.required}
                                                onChange={(e) => handleChangeExtraField(index, 'required', e.target.checked)}
                                            />
                                        }
                                        label="Requerido"
                                    />
                                    <IconButton 
                                        color="error" 
                                        onClick={() => handleRemoveExtraField(index)}
                                    >
                                        <Delete />
                                    </IconButton>
                                </Box>
                            ))}
                            {(!Array.isArray(formData.extraEnrollmentFields) || formData.extraEnrollmentFields.length === 0) && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    No hay campos extra agregados. Estos campos aparecerán en el formulario de inscripción pública.
                                </Typography>
                            )}
                        </Box>
                    </AccordionDetails>
                </StyledAccordion>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCloseDialogs}>Cancelar</Button>
                <Button 
                    onClick={isEdit ? handleUpdateCorporation : handleCreateCorporation}
                    variant="contained"
                    disabled={!formData.name.trim()}
                >
                    {isEdit ? 'Guardar Cambios' : 'Crear Corporación'}
                </Button>
            </DialogActions>
        </Dialog>
    );

    return (
        <PageContainer>
            {/* Header */}
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CalendarToday sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Gestión de Transportes Corporativos
                            </Typography>
                            <Typography variant="h6" sx={{ opacity: 0.9 }}>
                                Selecciona el año fiscal y corporación para gestionar
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            {/* Selector de Año Fiscal */}
            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
                            Año Fiscal
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <FormControl fullWidth variant="outlined" sx={{ maxWidth: 300 }}>
                                <InputLabel>Seleccionar Año Fiscal</InputLabel>
                                <Select
                                    value={selectedFiscalYear}
                                    onChange={(e) => setSelectedFiscalYear(e.target.value)}
                                    label="Seleccionar Año Fiscal"
                                >
                                    {fiscalYears.map((year) => (
                                        <MenuItem key={year.id} value={year.id}>
                                            {year.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <PermissionGuard permission="corporaciones-crear">    
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleOpenCreateDialog}
                                        >
                                        Añadir Corporación
                                    </Button>
                                </PermissionGuard>
                                
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Lista de Corporaciones */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                        Corporaciones - {fiscalYears.find(y => y.id === selectedFiscalYear)?.name}
                    </Typography>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : corporations.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CorporationIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                            <Typography variant="h6" color="textSecondary">
                                No hay corporaciones disponibles para este año fiscal
                            </Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            {corporations.map((corporation) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={corporation.id}>
                                    <CorporationCard>
                                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                            <CorporationIcon 
                                                sx={{ 
                                                    fontSize: 48, 
                                                    color: 'primary.main', 
                                                    mb: 2 
                                                }} 
                                            />
                                            <Typography 
                                                variant="h6" 
                                                component="h3" 
                                                gutterBottom
                                                sx={{ 
                                                    fontWeight: 'bold',
                                                    minHeight: '2.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {corporation.name}
                                            </Typography>

                                            {/* Total de Colaboradores */}
                                            <Typography 
                                                variant="body2" 
                                                color="text.secondary" 
                                                sx={{ mb: 1, fontWeight: 600 }}
                                            >
                                                Total de Colaboradores: {corporation.colaboradoresCount || 0}
                                            </Typography>
                                            
                                            {/* Botón principal de gestionar */}
                                            <Button 
                                                variant="contained" 
                                                color="primary"
                                                size="small"
                                                sx={{ borderRadius: 2, mb: 2 }}
                                                onClick={() => handleCorporationSelect(corporation)}
                                            >
                                                Gestionar
                                            </Button>

                                            {/* Botones de acciones */}
                                            <Box sx={{ 
                                                display: 'flex', 
                                                justifyContent: 'center', 
                                                gap: 1,
                                                borderTop: '1px solid #e0e0e0',
                                                pt: 1.5
                                            }}>
                                                <Tooltip title="Copiar enlace de inscripción">
                                                    <IconButton 
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyEnrollLink(corporation.id);
                                                        }}
                                                    >
                                                        <ContentCopy fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Editar corporación">
                                                    <IconButton 
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenEditDialog(corporation);
                                                        }}
                                                    >
                                                        <Edit fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <PermissionGuard permission="corporaciones-eliminar">
                                                    <Tooltip title="Eliminar corporación">
                                                        <IconButton 
                                                            size="small"
                                                            color="error"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenDeleteDialog(corporation);
                                                            }}
                                                        >
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </PermissionGuard>
                                            </Box>
                                        </CardContent>
                                    </CorporationCard>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </CardContent>
            </Card>

            {/* Diálogo de Crear/Editar */}
            {renderCorporationDialog(false)}
            {renderCorporationDialog(true)}

            {/* Diálogo de Eliminar */}
            <Dialog open={openDeleteDialog} onClose={handleCloseDialogs}>
                <DialogTitle>Confirmar Eliminación</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Está seguro que desea eliminar la corporación "{selectedCorporation?.name}"?
                        Esta acción no se puede deshacer.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialogs}>Cancelar</Button>
                    <Button onClick={handleDeleteCorporation} color="error" variant="contained">
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar de notificaciones */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert 
                    onClose={() => setSnackbar({ ...snackbar, open: false })} 
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default CorporationsPage;
