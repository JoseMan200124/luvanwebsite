// src/pages/SchoolProtocolsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Button,
    List,
    ListItem,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    IconButton,
    Snackbar,
    Alert,
    TextField,
    Grid,
    Pagination,
    CircularProgress,
    Box,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    useTheme,
    useMediaQuery,
    Chip,
    Card,
    CardContent,
    CardActions,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    CloudUpload as CloudUploadIcon,
    Visibility as VisibilityIcon,
    School as SchoolIcon,
    Add as AddIcon,
    GetApp as DownloadIcon,
    Description as DocumentIcon,
    ArrowBack as ArrowBackIcon,
    CalendarToday
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import tw from 'twin.macro';

import api from '../utils/axiosConfig';

// Styled components similares a SchoolUsersPage
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
`;

// Contenedor principal responsive
const Container = styled.div`
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
    @media (max-width: 600px) {
        padding: 10px;
    }
`;

// Mobile view: Tarjeta para protocolo/reglamento
const MobileProtocolCard = styled(Card)`
    margin-bottom: 12px;
    border-radius: 8px;
`;

const SchoolProtocolsPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();
    const { schoolYear, schoolId } = useParams();
    const location = useLocation();

    // Estados principales
    const [protocols, setProtocols] = useState([]);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Estados para paginación y filtros
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(10);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // Estados para crear/editar protocolo
    const [openDialog, setOpenDialog] = useState(false);
    const [currentProtocol, setCurrentProtocol] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'protocolo',
        isActive: true
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileError, setFileError] = useState('');

    // Estados para confirmación de eliminación
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [protocolToDelete, setProtocolToDelete] = useState(null);

    // Estados para información del colegio
    const [schoolData, setSchoolData] = useState(null);

    // Obtener datos del estado de navegación si están disponibles
    const stateSchool = location.state?.school;
    const stateSchoolYear = location.state?.schoolYear;

    // ---------------------------
    // Funciones para cargar datos
    // ---------------------------
    const fetchProtocols = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit,
                isActive: true,
                schoolId: schoolId, // Filtrar por colegio específico
                ...(search && { search }),
                ...(typeFilter && { type: typeFilter })
            };

            const response = await api.get('/protocols', { params });
            setProtocols(response.data.data);
            setTotalPages(response.data.meta.totalPages);
        } catch (error) {
            console.error('Error al obtener protocolos:', error);
            showSnackbar('Error al obtener protocolos.', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, typeFilter, schoolId]);

    // ---------------------------
    // useEffect para cargar datos del colegio
    // ---------------------------
    useEffect(() => {
        const fetchSchoolData = async () => {
            if (stateSchool) {
                setSchoolData(stateSchool);
                return;
            }
            
            try {
                const response = await api.get(`/schools/${schoolId}`);
                setSchoolData(response.data);
            } catch (error) {
                console.error('Error al obtener datos del colegio:', error);
            }
        };

        fetchSchoolData();
    }, [schoolId, stateSchool]);

    // ---------------------------
    // useEffect para cargar datos iniciales
    // ---------------------------
    useEffect(() => {
        fetchProtocols();
    }, [page, search, typeFilter, fetchProtocols]);

    // ---------------------------
    // Funciones auxiliares
    // ---------------------------
    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const closeSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            type: 'protocolo',
            isActive: true
        });
        setSelectedFile(null);
        setFileError('');
        setCurrentProtocol(null);
    };

    // ---------------------------
    // Funciones para manejo de archivos
    // ---------------------------
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        setFileError('');

        if (file) {
            if (file.type !== 'application/pdf') {
                setFileError('Solo se permiten archivos PDF.');
                setSelectedFile(null);
                return;
            }

            if (file.size > 50 * 1024 * 1024) { // 50MB
                setFileError('El archivo no puede superar los 50MB.');
                setSelectedFile(null);
                return;
            }

            setSelectedFile(file);
        }
    };

    // ---------------------------
    // Funciones CRUD
    // ---------------------------
    const handleCreate = () => {
        resetForm();
        setOpenDialog(true);
    };

    const handleEdit = (protocol) => {
        setCurrentProtocol(protocol);
        setFormData({
            title: protocol.title,
            description: protocol.description || '',
            type: protocol.type,
            isActive: protocol.isActive
        });
        setSelectedFile(null);
        setFileError('');
        setOpenDialog(true);
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            showSnackbar('El título es obligatorio.', 'warning');
            return;
        }

        if (!currentProtocol && !selectedFile) {
            showSnackbar('Debe seleccionar un archivo PDF.', 'warning');
            return;
        }

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title.trim());
            formDataToSend.append('description', formData.description.trim());
            formDataToSend.append('type', formData.type);
            formDataToSend.append('schoolId', schoolId); // Asignar al colegio actual
            formDataToSend.append('isActive', formData.isActive);

            if (selectedFile) {
                formDataToSend.append('pdf', selectedFile);
            }

            if (currentProtocol) {
                await api.put(`/protocols/${currentProtocol.uuid}`, formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showSnackbar('Protocolo/Reglamento actualizado exitosamente.', 'success');
                // Stay on current page after update
                await fetchProtocols();
            } else {
                await api.post('/protocols', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showSnackbar('Protocolo/Reglamento creado exitosamente.', 'success');
                // New item likely on first page: navigate to page 1 and refresh
                setPage(1);
                await fetchProtocols();
            }

            // Close dialog and reset once data refreshed
            setOpenDialog(false);
            resetForm();
        } catch (error) {
            console.error('Error al guardar protocolo:', error);
            const message = error.response?.data?.message || 'Error al guardar el protocolo/reglamento.';
            showSnackbar(message, 'error');
        }
    };

    const handleOpenDeleteDialog = (protocol) => {
        setProtocolToDelete(protocol);
        setOpenDeleteDialog(true);
    };

    const handleDelete = async () => {
        if (!protocolToDelete) return;

        try {
            await api.delete(`/protocols/${protocolToDelete.uuid}`);
            showSnackbar('Protocolo/Reglamento eliminado exitosamente.', 'info');
            setOpenDeleteDialog(false);
            setProtocolToDelete(null);
            fetchProtocols();
        } catch (error) {
            console.error('Error al eliminar protocolo:', error);
            showSnackbar('Error al eliminar el protocolo/reglamento.', 'error');
        }
    };

    // ---------------------------
    // Funciones para visualización
    // ---------------------------
    const handleViewPdf = (protocol) => {
        if (protocol.pdfUrl) {
            window.open(protocol.pdfUrl, '_blank');
        }
    };

    const handleDownloadPdf = async (protocol) => {
        try {
            const response = await api.get(`/protocols/${protocol.uuid}/pdf`);
            if (response.data.pdfUrl) {
                const link = document.createElement('a');
                link.href = response.data.pdfUrl;
                link.download = `${protocol.title}.pdf`;
                link.click();
            }
        } catch (error) {
            console.error('Error al descargar PDF:', error);
            showSnackbar('Error al descargar el PDF.', 'error');
        }
    };

    // ---------------------------
    // Funciones para filtros
    // ---------------------------
    const handleSearchChange = (event) => {
        setSearch(event.target.value);
        setPage(1);
    };

    const handleTypeFilterChange = (event) => {
        setTypeFilter(event.target.value);
        setPage(1);
    };

    const clearFilters = () => {
        setSearch('');
        setTypeFilter('');
        setPage(1);
    };

    // ---------------------------
    // Navegación
    // ---------------------------
    const handleBackToDashboard = () => {
        navigate(`/admin/escuelas/${schoolYear || stateSchoolYear}/${schoolId}`, {
            state: {
                schoolYear: schoolYear || stateSchoolYear,
                school: stateSchool
            }
        });
    };

    // ---------------------------
    // Renderizado
    // ---------------------------
    const renderProtocolCard = (protocol) => (
        <MobileProtocolCard key={protocol.id}>
            <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                    <DocumentIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" component="div">
                        {protocol.title}
                    </Typography>
                </Box>

                <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                    <Chip
                        label={protocol.type === 'protocolo' ? 'Protocolo' : 'Reglamento'}
                        color={protocol.type === 'protocolo' ? 'primary' : 'secondary'}
                        size="small"
                    />
                    <Chip
                        label={protocol.isActive ? 'Activo' : 'Inactivo'}
                        color={protocol.isActive ? 'success' : 'error'}
                        size="small"
                    />
                </Box>

                {protocol.description && (
                    <Typography variant="body2" color="text.secondary" mb={1}>
                        {protocol.description}
                    </Typography>
                )}

                <Typography variant="body2" color="text.secondary">
                    <strong>Creado:</strong> {new Date(protocol.createdAt).toLocaleDateString()}
                </Typography>
            </CardContent>

            <CardActions>
                <Button
                    size="small"
                    onClick={() => handleViewPdf(protocol)}
                    startIcon={<VisibilityIcon />}
                >
                    Ver PDF
                </Button>
                <Button
                    size="small"
                    onClick={() => handleDownloadPdf(protocol)}
                    startIcon={<DownloadIcon />}
                >
                    Descargar
                </Button>
                <IconButton size="small" onClick={() => handleEdit(protocol)}>
                    <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => handleOpenDeleteDialog(protocol)}>
                    <DeleteIcon />
                </IconButton>
            </CardActions>
        </MobileProtocolCard>
    );

    const renderProtocolListItem = (protocol) => (
        <ListItem key={protocol.id} divider>
            <ListItemText
                primary={
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="h6">{protocol.title}</Typography>
                        <Chip
                            label={protocol.type === 'protocolo' ? 'Protocolo' : 'Reglamento'}
                            color={protocol.type === 'protocolo' ? 'primary' : 'secondary'}
                            size="small"
                        />
                        <Chip
                            label={protocol.isActive ? 'Activo' : 'Inactivo'}
                            color={protocol.isActive ? 'success' : 'error'}
                            size="small"
                        />
                    </Box>
                }
                secondary={
                    <Box>
                        {protocol.description && (
                            <Typography variant="body2" color="text.secondary">
                                {protocol.description}
                            </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                            Creado: {new Date(protocol.createdAt).toLocaleDateString()}
                        </Typography>
                    </Box>
                }
            />
            <Box display="flex" gap={1}>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleViewPdf(protocol)}
                    startIcon={<VisibilityIcon />}
                >
                    Ver PDF
                </Button>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleDownloadPdf(protocol)}
                    startIcon={<DownloadIcon />}
                >
                    Descargar
                </Button>
                <IconButton onClick={() => handleEdit(protocol)}>
                    <EditIcon />
                </IconButton>
                <IconButton onClick={() => handleOpenDeleteDialog(protocol)}>
                    <DeleteIcon />
                </IconButton>
            </Box>
        </ListItem>
    );

    return (
        <PageContainer>
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={handleBackToDashboard}
                            sx={{ 
                                color: 'white',
                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                            }}
                        >
                            Volver al Dashboard
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <SchoolIcon sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Protocolos y Reglamentos - {schoolData?.name || 'Cargando...'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Ciclo Escolar ${schoolYear || stateSchoolYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                    {protocols.length} protocolos encontrados
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            <Container>
                {/* Botón para crear nuevo protocolo */}
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCreate}
                    startIcon={<AddIcon />}
                    style={{ marginBottom: '20px' }}
                >
                    Crear Nuevo Protocolo/Reglamento
                </Button>

                {/* Filtros */}
                <Card style={{ marginBottom: '20px' }}>
                    <CardContent>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={6} md={4}>
                                <TextField
                                    label="Buscar"
                                    value={search}
                                    onChange={handleSearchChange}
                                    fullWidth
                                    size="small"
                                    placeholder="Título o descripción..."
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Tipo</InputLabel>
                                    <Select
                                        value={typeFilter}
                                        onChange={handleTypeFilterChange}
                                        label="Tipo"
                                    >
                                        <MenuItem value="">Todos</MenuItem>
                                        <MenuItem value="protocolo">Protocolos</MenuItem>
                                        <MenuItem value="reglamento">Reglamentos</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Button
                                    variant="outlined"
                                    onClick={clearFilters}
                                    fullWidth
                                >
                                    Limpiar Filtros
                                </Button>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Lista de protocolos */}
                {loading ? (
                    <Box display="flex" justifyContent="center" mt={4}>
                        <CircularProgress />
                    </Box>
                ) : protocols.length === 0 ? (
                    <Typography variant="body1" textAlign="center" mt={4}>
                        No se encontraron protocolos o reglamentos para este colegio.
                    </Typography>
                ) : isMobile ? (
                    <Box>
                        {protocols.map(renderProtocolCard)}
                    </Box>
                ) : (
                    <List>
                        {protocols.map(renderProtocolListItem)}
                    </List>
                )}

                {/* Paginación */}
                {totalPages > 1 && (
                    <Box display="flex" justifyContent="center" mt={3}>
                        <Pagination
                            count={totalPages}
                            page={page}
                            onChange={(event, value) => setPage(value)}
                            color="primary"
                        />
                    </Box>
                )}

                {/* Diálogo para crear/editar protocolo */}
                <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>
                        {currentProtocol ? 'Editar Protocolo/Reglamento' : 'Crear Nuevo Protocolo/Reglamento'}
                    </DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2} style={{ marginTop: '8px' }}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Título *"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Tipo *</InputLabel>
                                    <Select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        label="Tipo *"
                                    >
                                        <MenuItem value="protocolo">Protocolo</MenuItem>
                                        <MenuItem value="reglamento">Reglamento</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Descripción"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    fullWidth
                                    multiline
                                    rows={3}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                    }
                                    label="Protocolo/Reglamento Activo"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Box>
                                    <input
                                        accept="application/pdf"
                                        style={{ display: 'none' }}
                                        id="pdf-upload"
                                        type="file"
                                        onChange={handleFileChange}
                                    />
                                    <label htmlFor="pdf-upload">
                                        <Button
                                            variant="outlined"
                                            component="span"
                                            startIcon={<CloudUploadIcon />}
                                            fullWidth
                                        >
                                            {currentProtocol ? 'Cambiar archivo PDF' : 'Seleccionar archivo PDF *'}
                                        </Button>
                                    </label>
                                    {selectedFile && (
                                        <Typography variant="body2" color="primary" mt={1}>
                                            Archivo seleccionado: {selectedFile.name}
                                        </Typography>
                                    )}
                                    {fileError && (
                                        <Typography variant="body2" color="error" mt={1}>
                                            {fileError}
                                        </Typography>
                                    )}
                                </Box>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} variant="contained">
                            {currentProtocol ? 'Actualizar' : 'Crear'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Diálogo de confirmación para eliminar */}
                <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
                    <DialogTitle>Confirmar Eliminación</DialogTitle>
                    <DialogContent>
                        <Typography>
                            ¿Está seguro de que desea eliminar este protocolo/reglamento?
                            <br />
                            <strong>{protocolToDelete?.title}</strong>
                            <br />
                            Esta acción no se puede deshacer.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDeleteDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleDelete} color="error" variant="contained">
                            Eliminar
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Snackbar */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={closeSnackbar}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={closeSnackbar}
                        severity={snackbar.severity}
                        sx={{ width: '100%' }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Container>
        </PageContainer>
    );
};

export default SchoolProtocolsPage;
