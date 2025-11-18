// src/pages/EmployeesPage.jsx
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
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TablePagination,
    InputAdornment,
    TableSortLabel,
    TextField,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import { 
    Business as CorporationIcon, 
    CalendarToday,
    ArrowBack,
    Search,
    Edit,
    Delete,
    Add,
    ExpandMore,
    Work as DepartmentIcon,
    AccessTime
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import EmployeeScheduleModal from '../components/modals/EmployeeScheduleModal';

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
    }
    
    & .MuiAccordionSummary-root {
        background-color: #f8f9fa;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        min-height: 56px;
        
        &:hover {
            background-color: #e9ecef;
        }
        
        &.Mui-expanded {
            background-color: #e3f2fd;
        }
    }
    
    & .MuiAccordionDetails-root {
        padding: 24px;
        background-color: #ffffff;
    }
`;

const EmployeesPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { fiscalYear, corporationId } = useParams();

    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Diálogos
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
    
    // Estado de la corporación
    const [corporationData, setCorporationData] = useState(location.state?.corporation || null);
    
    // Formulario de empleado
    const [employeeForm, setEmployeeForm] = useState({
        name: '',
        email: '',
        password: '',
        cellphone: '',
        department: '',
        position: '',
        nit: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        scheduleSlots: [] // Horarios individuales del empleado
    });
    
    // Estados de acordeón
    const [expandedPanels, setExpandedPanels] = useState({
        basicInfo: true,
        contactInfo: false,
        schedules: false
    });

    const fetchCorporationData = useCallback(async () => {
        if (!corporationId || corporationData) return;
        
        try {
            const response = await api.get(`/corporations/${corporationId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            const corp = response.data.corporation;
            
            // Los campos JSON ya vienen parseados desde el backend gracias a los getters del modelo
            setCorporationData(corp);
            
            console.log('[EmployeesPage] Corporation loaded:', {
                name: corp.name,
                routeNumbers: corp.routeNumbers,
                departments: corp.departments,
                businessHours: corp.businessHours
            });
        } catch (err) {
            console.error('Error fetching corporation data:', err);
        }
    }, [auth.token, corporationId, corporationData]);

    const fetchEmployees = useCallback(async () => {
        if (!corporationId) return;
        
        setLoading(true);
        try {
            const response = await api.get(`/corporations/${corporationId}/employees`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    fiscalYear: fiscalYear
                }
            });
            
            const employeesData = response.data.employees || [];
            setEmployees(employeesData);
            setFilteredEmployees(employeesData);
        } catch (err) {
            console.error('Error fetching employees:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener empleados', 
                severity: 'error' 
            });
        } finally {
            setLoading(false);
        }
    }, [auth.token, corporationId, fiscalYear]);

    useEffect(() => {
        if (auth.token && corporationId) {
            fetchCorporationData();
            fetchEmployees();
        }
    }, [auth.token, corporationId, fetchCorporationData, fetchEmployees]);

    // Filtrado y ordenamiento
    useEffect(() => {
        let filtered = [...employees];
        
        // Búsqueda
        if (searchQuery.trim()) {
            filtered = filtered.filter(emp => 
                emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.FamilyDetail?.department?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        
        // Filtro por estado
        if (statusFilter) {
            filtered = filtered.filter(emp => {
                const state = Number(emp.state);
                return statusFilter === 'active' ? state === 1 : state === 0;
            });
        }
        
        // Filtro por departamento
        if (departmentFilter) {
            filtered = filtered.filter(emp => 
                emp.FamilyDetail?.department === departmentFilter
            );
        }
        
        // Ordenamiento
        if (sortBy) {
            filtered.sort((a, b) => {
                let aVal, bVal;
                
                switch (sortBy) {
                    case 'name':
                        aVal = a.name || '';
                        bVal = b.name || '';
                        break;
                    case 'email':
                        aVal = a.email || '';
                        bVal = b.email || '';
                        break;
                    case 'department':
                        aVal = a.FamilyDetail?.department || '';
                        bVal = b.FamilyDetail?.department || '';
                        break;
                    case 'status':
                        aVal = Number(a.state);
                        bVal = Number(b.state);
                        break;
                    default:
                        return 0;
                }
                
                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });
        }
        
        setFilteredEmployees(filtered);
        setPage(0);
    }, [employees, searchQuery, statusFilter, departmentFilter, sortBy, sortOrder]);

    const handleSort = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const handleBackToDashboard = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}`, {
            state: {
                fiscalYear: fiscalYear,
                corporation: corporationData
            }
        });
    };

    const handleOpenCreateDialog = () => {
        setEmployeeForm({
            name: '',
            email: '',
            password: '',
            cellphone: '',
            department: '',
            position: '',
            nit: '',
            address: '',
            emergencyContact: '',
            emergencyPhone: '',
            scheduleSlots: []
        });
        setExpandedPanels({
            basicInfo: true,
            contactInfo: false,
            schedules: false
        });
        setOpenCreateDialog(true);
    };

    const handleOpenEditDialog = (employee) => {
        setSelectedEmployee(employee);
        setEmployeeForm({
            name: employee.name || '',
            email: employee.email || '',
            password: '', // No mostramos la contraseña
            cellphone: employee.FamilyDetail?.motherCellphone || '',
            department: employee.FamilyDetail?.department || '',
            position: employee.FamilyDetail?.position || '',
            nit: employee.FamilyDetail?.nit || '',
            address: employee.FamilyDetail?.mainAddress || '',
            emergencyContact: employee.FamilyDetail?.emergencyContact || '',
            emergencyPhone: employee.FamilyDetail?.emergencyPhone || '',
            scheduleSlots: employee.ScheduleSlots || []
        });
        setExpandedPanels({
            basicInfo: true,
            contactInfo: false,
            schedules: false
        });
        setOpenEditDialog(true);
    };

    const handleOpenDeleteDialog = (employee) => {
        setSelectedEmployee(employee);
        setOpenDeleteDialog(true);
    };

    const handleOpenScheduleDialog = (employee) => {
        setSelectedEmployee(employee);
        setOpenScheduleDialog(true);
    };

    const handleCloseDialogs = () => {
        setOpenCreateDialog(false);
        setOpenEditDialog(false);
        setOpenDeleteDialog(false);
        setOpenScheduleDialog(false);
        setSelectedEmployee(null);
    };

    const handleFormChange = (field, value) => {
        setEmployeeForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedPanels(prev => ({ ...prev, [panel]: isExpanded }));
    };

    const handleCreateEmployee = async () => {
        try {
            const payload = {
                name: employeeForm.name,
                email: employeeForm.email,
                password: employeeForm.password,
                roleId: 8, // Empleado role
                corporationId: corporationId,
                state: 1,
                familyDetail: {
                    motherCellphone: employeeForm.cellphone,
                    department: employeeForm.department,
                    position: employeeForm.position,
                    nit: employeeForm.nit,
                    mainAddress: employeeForm.address,
                    emergencyContact: employeeForm.emergencyContact,
                    emergencyPhone: employeeForm.emergencyPhone
                },
                scheduleSlots: employeeForm.scheduleSlots
            };
            
            await api.post(`/corporations/${corporationId}/employees`, payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Empleado creado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchEmployees();
        } catch (err) {
            console.error('Error creating employee:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al crear empleado',
                severity: 'error'
            });
        }
    };

    const handleUpdateEmployee = async () => {
        if (!selectedEmployee) return;
        
        try {
            const payload = {
                name: employeeForm.name,
                email: employeeForm.email,
                familyDetail: {
                    motherCellphone: employeeForm.cellphone,
                    department: employeeForm.department,
                    position: employeeForm.position,
                    nit: employeeForm.nit,
                    mainAddress: employeeForm.address,
                    emergencyContact: employeeForm.emergencyContact,
                    emergencyPhone: employeeForm.emergencyPhone
                }
            };
            
            // Si se proporciona contraseña, incluirla
            if (employeeForm.password) {
                payload.password = employeeForm.password;
            }
            
            await api.put(`/corporations/${corporationId}/employees/${selectedEmployee.id}`, payload, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Empleado actualizado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchEmployees();
        } catch (err) {
            console.error('Error updating employee:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al actualizar empleado',
                severity: 'error'
            });
        }
    };

    const handleDeleteEmployee = async () => {
        if (!selectedEmployee) return;
        
        try {
            await api.delete(`/users/${selectedEmployee.id}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            
            setSnackbar({
                open: true,
                message: 'Empleado eliminado exitosamente',
                severity: 'success'
            });
            
            handleCloseDialogs();
            fetchEmployees();
        } catch (err) {
            console.error('Error deleting employee:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al eliminar empleado',
                severity: 'error'
            });
        }
    };

    const currentCorporation = corporationData || location.state?.corporation;
    const currentFiscalYear = fiscalYear || location.state?.fiscalYear;
    
    // Obtener lista única de departamentos para filtro
    const departments = [...new Set(employees.map(emp => emp.FamilyDetail?.department).filter(Boolean))];

    const paginatedEmployees = filteredEmployees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderEmployeeDialog = (isEdit = false) => (
        <Dialog 
            open={isEdit ? openEditDialog : openCreateDialog} 
            onClose={handleCloseDialogs}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                {isEdit ? 'Editar Empleado' : 'Crear Nuevo Empleado'}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    {/* Información Básica */}
                    <StyledAccordion 
                        expanded={expandedPanels.basicInfo}
                        onChange={handleAccordionChange('basicInfo')}
                    >
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                Información Básica
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Nombre Completo"
                                        value={employeeForm.name}
                                        onChange={(e) => handleFormChange('name', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        type="email"
                                        value={employeeForm.email}
                                        onChange={(e) => handleFormChange('email', e.target.value)}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label={isEdit ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                                        type="password"
                                        value={employeeForm.password}
                                        onChange={(e) => handleFormChange('password', e.target.value)}
                                        required={!isEdit}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teléfono"
                                        value={employeeForm.cellphone}
                                        onChange={(e) => handleFormChange('cellphone', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Departamento</InputLabel>
                                        <Select
                                            value={employeeForm.department}
                                            label="Departamento"
                                            onChange={(e) => handleFormChange('department', e.target.value)}
                                        >
                                            <MenuItem value="">
                                                <em>Ninguno</em>
                                            </MenuItem>
                                            {currentCorporation?.departments?.map((dept, idx) => (
                                                <MenuItem key={idx} value={dept}>{dept}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Puesto / Cargo"
                                        value={employeeForm.position}
                                        onChange={(e) => handleFormChange('position', e.target.value)}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </StyledAccordion>

                    {/* Información de Contacto */}
                    <StyledAccordion 
                        expanded={expandedPanels.contactInfo}
                        onChange={handleAccordionChange('contactInfo')}
                    >
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                Información de Contacto
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="NIT"
                                        value={employeeForm.nit}
                                        onChange={(e) => handleFormChange('nit', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Dirección"
                                        value={employeeForm.address}
                                        onChange={(e) => handleFormChange('address', e.target.value)}
                                        multiline
                                        rows={2}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Contacto de Emergencia"
                                        value={employeeForm.emergencyContact}
                                        onChange={(e) => handleFormChange('emergencyContact', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teléfono de Emergencia"
                                        value={employeeForm.emergencyPhone}
                                        onChange={(e) => handleFormChange('emergencyPhone', e.target.value)}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </StyledAccordion>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCloseDialogs}>Cancelar</Button>
                <Button 
                    onClick={isEdit ? handleUpdateEmployee : handleCreateEmployee}
                    variant="contained"
                    disabled={!employeeForm.name || !employeeForm.email || (!isEdit && !employeeForm.password)}
                >
                    {isEdit ? 'Actualizar' : 'Crear'}
                </Button>
            </DialogActions>
        </Dialog>
    );

    return (
        <PageContainer>
            {/* Header */}
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={handleBackToDashboard}
                            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                        >
                            Volver al Dashboard
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CorporationIcon sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Empleados - {currentCorporation?.name || 'Corporación'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Año Fiscal ${currentFiscalYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                    {filteredEmployees.length} empleados
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            {/* Filtros y acciones */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Buscar por nombre, email o departamento..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Estado</InputLabel>
                                <Select
                                    value={statusFilter}
                                    label="Estado"
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="active">Activos</MenuItem>
                                    <MenuItem value="inactive">Inactivos</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Departamento</InputLabel>
                                <Select
                                    value={departmentFilter}
                                    label="Departamento"
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {departments.map((dept, idx) => (
                                        <MenuItem key={idx} value={dept}>{dept}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<Add />}
                                onClick={handleOpenCreateDialog}
                            >
                                Nuevo Empleado
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Tabla de empleados */}
            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : filteredEmployees.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="h6" color="text.secondary">
                                No se encontraron empleados
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'name'}
                                                    direction={sortBy === 'name' ? sortOrder : 'asc'}
                                                    onClick={() => handleSort('name')}
                                                >
                                                    Nombre
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'email'}
                                                    direction={sortBy === 'email' ? sortOrder : 'asc'}
                                                    onClick={() => handleSort('email')}
                                                >
                                                    Email
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortBy === 'department'}
                                                    direction={sortBy === 'department' ? sortOrder : 'asc'}
                                                    onClick={() => handleSort('department')}
                                                >
                                                    Departamento
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">Horarios</TableCell>
                                            <TableCell align="center">
                                                <TableSortLabel
                                                    active={sortBy === 'status'}
                                                    direction={sortBy === 'status' ? sortOrder : 'asc'}
                                                    onClick={() => handleSort('status')}
                                                >
                                                    Estado
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedEmployees.map((employee) => (
                                            <TableRow key={employee.id} hover>
                                                <TableCell>{employee.name}</TableCell>
                                                <TableCell>{employee.email}</TableCell>
                                                <TableCell>
                                                    {employee.FamilyDetail?.department ? (
                                                        <Chip 
                                                            icon={<DepartmentIcon />}
                                                            label={employee.FamilyDetail.department}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            N/A
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Chip
                                                        label={`${employee.ScheduleSlots?.length || 0} horarios`}
                                                        size="small"
                                                        color="secondary"
                                                        variant="outlined"
                                                        icon={<AccessTime />}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Chip
                                                        label={Number(employee.state) === 1 ? 'Activo' : 'Inactivo'}
                                                        color={Number(employee.state) === 1 ? 'success' : 'default'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenScheduleDialog(employee)}
                                                        color="secondary"
                                                    >
                                                        <AccessTime />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenEditDialog(employee)}
                                                        color="primary"
                                                    >
                                                        <Edit />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenDeleteDialog(employee)}
                                                        color="error"
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={filteredEmployees.length}
                                page={page}
                                onPageChange={(e, newPage) => setPage(newPage)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(e) => {
                                    setRowsPerPage(parseInt(e.target.value, 10));
                                    setPage(0);
                                }}
                                labelRowsPerPage="Filas por página:"
                                rowsPerPageOptions={[10, 25, 50, 100]}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Diálogos */}
            {renderEmployeeDialog(false)}
            {renderEmployeeDialog(true)}

            {/* Diálogo de eliminar */}
            <Dialog open={openDeleteDialog} onClose={handleCloseDialogs}>
                <DialogTitle>Confirmar Eliminación</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Está seguro que desea eliminar al empleado "{selectedEmployee?.name}"?
                        Esta acción no se puede deshacer.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialogs}>Cancelar</Button>
                    <Button onClick={handleDeleteEmployee} color="error" variant="contained">
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de horario completo igual al de estudiantes */}
            <EmployeeScheduleModal 
                employee={selectedEmployee}
                corporation={corporationData}
                open={openScheduleDialog}
                onClose={handleCloseDialogs}
                onScheduleUpdated={async () => {
                    await fetchEmployees();
                    setSnackbar({
                        open: true,
                        message: 'Horario actualizado correctamente',
                        severity: 'success'
                    });
                }}
            />

            {/* Snackbar */}
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

export default EmployeesPage;
