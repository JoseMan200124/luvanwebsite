// src/pages/CorporateProtocolsPage.jsx
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
    Chip,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    CloudUpload as CloudUploadIcon,
    Visibility as VisibilityIcon,
    Add as AddIcon,
    GetApp as DownloadIcon,
    Description as DocumentIcon
} from '@mui/icons-material';
import { useParams, useLocation } from 'react-router-dom';

import api from '../utils/axiosConfig';
import PermissionGuard from '../components/PermissionGuard';
import useIsMobile from '../hooks/useIsMobile';
import { MobileCard, MobileField } from '../components/table/MobileCard';
import RowActions from '../components/table/RowActions';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import usePermissions from '../hooks/usePermissions';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import useClientScope from '../hooks/useClientScope';
import { formatDate } from '../utils/dateFormat';

const PROTOCOL_TYPE_OPTIONS = [
    { value: 'protocolo', label: 'Protocolos' },
    { value: 'reglamento', label: 'Reglamentos' },
];

const CorporateProtocolsPage = () => {
    const { hasPermission } = usePermissions();
    const isMobile = useIsMobile();
    const { fiscalYear, corporationId } = useParams();
    const location = useLocation();

    // Estados principales
    const [protocols, setProtocols] = useState([]);
    const [loading, setLoading] = useState(false);
    const notify = useNotify();
    const confirm = useConfirm();

    // Estados para paginación y filtros
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(10);

    // Filtros: solo consultan al aplicar (ver useFilters)
    const pageFilters = useFilters({
        fields: [
            F.search('search', { placeholder: 'Título o descripción' }),
            F.select('type', { label: 'Tipo', options: PROTOCOL_TYPE_OPTIONS }),
        ],
        onApplied: () => setPage(1),
    });
    const { search, type: typeFilter } = pageFilters.applied;

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

    // Estados para información de la corporación
    const [corporationData, setCorporationData] = useState(null);

    // Obtener datos del estado de navegación si están disponibles
    const stateCorporation = location.state?.corporation;
    const stateFiscalYear = location.state?.fiscalYear;
    const scope = useClientScope({ entity: corporationData || stateCorporation });

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
                corporationId: corporationId, // Filtrar por corporación específica
                ...(search && { search }),
                ...(typeFilter && { type: typeFilter })
            };

            const response = await api.get('/protocols', { params });
            setProtocols(response.data.data || []);
            setTotalPages(response.data.meta?.totalPages || 1);
        } catch (error) {
            console.error('Error al obtener protocolos:', error);
            if (error.response?.status !== 400) {
                notify.fromError(error, 'Error al obtener los protocolos');
            }
            setProtocols([]);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, typeFilter, corporationId, notify]);

    // ---------------------------
    // useEffect para cargar datos de la corporación
    // ---------------------------
    useEffect(() => {
        const fetchCorporationData = async () => {
            if (stateCorporation) {
                setCorporationData(stateCorporation);
                return;
            }
            
            try {
                const response = await api.get(`/corporations/${corporationId}`);
                setCorporationData(response.data);
            } catch (error) {
                console.error('Error al obtener datos de la corporación:', error);
            }
        };

        fetchCorporationData();
    }, [corporationId, stateCorporation]);

    // ---------------------------
    // useEffect para cargar datos iniciales
    // ---------------------------
    useEffect(() => {
        fetchProtocols();
    }, [page, search, typeFilter, fetchProtocols]);

    useRegisterPageRefresh(async () => {
        await fetchProtocols();
    }, [fetchProtocols]);

    // ---------------------------
    // Funciones auxiliares
    // ---------------------------
    const showSnackbar = (message, severity = 'info') => {
        (notify[severity] || notify.info)(message);
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
            formDataToSend.append('corporationId', corporationId); // Asignar a la corporación actual
            formDataToSend.append('isActive', formData.isActive);

            if (selectedFile) {
                formDataToSend.append('pdf', selectedFile);
            }

            if (currentProtocol) {
                await api.put(`/protocols/${currentProtocol.uuid}`, formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showSnackbar('Protocolo/Reglamento actualizado exitosamente.', 'success');
                await fetchProtocols();
            } else {
                await api.post('/protocols', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showSnackbar('Protocolo/Reglamento creado exitosamente.', 'success');
                setPage(1);
                await fetchProtocols();
            }

            setOpenDialog(false);
            resetForm();
        } catch (error) {
            console.error('Error al guardar protocolo:', error);
            const message = error.response?.data?.message || 'Error al guardar el protocolo/reglamento.';
            showSnackbar(message, 'error');
        }
    };

    const handleDelete = async (protocol) => {
        const ok = await confirm({
            title: 'Eliminar protocolo/reglamento',
            message: `Se eliminará "${protocol.title}". Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            onConfirm: () => api.delete(`/protocols/${protocol.uuid}`),
            errorMessage: 'Error al eliminar el protocolo/reglamento',
        });
        if (ok) {
            notify.success('Protocolo/Reglamento eliminado');
            fetchProtocols();
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
    // Acciones del encabezado
    // ---------------------------
    const headerActions = [
        { key: 'create', label: 'Crear nuevo protocolo/reglamento', icon: <AddIcon />, primary: true, permission: 'protocolos-crear', onClick: handleCreate },
    ];

    // ---------------------------
    // Renderizado
    // ---------------------------
    const renderProtocolCard = (protocol) => (
        <MobileCard
            key={protocol.id}
            sx={{ mb: 1.5, borderRadius: '8px' }}
            actions={(
                <>
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
                    <RowActions
                        actions={[
                            { key: 'edit', kind: 'edit', label: 'Editar', icon: <EditIcon fontSize="small" />, permission: 'protocolos-editar', onClick: () => handleEdit(protocol) },
                            { key: 'delete', kind: 'delete', label: 'Eliminar', icon: <DeleteIcon fontSize="small" />, permission: 'protocolos-eliminar', onClick: () => handleDelete(protocol) },
                        ]}
                    />
                </>
            )}
        >
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

            <MobileField label="Creado">{formatDate(protocol.createdAt)}</MobileField>
        </MobileCard>
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
                            Creado: {formatDate(protocol.createdAt)}
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
                <PermissionGuard permission="protocolos-editar">
                    <IconButton onClick={() => handleEdit(protocol)}>
                        <EditIcon />
                    </IconButton>
                </PermissionGuard>
                <PermissionGuard permission="protocolos-eliminar">
                    <IconButton onClick={() => handleDelete(protocol)}>
                        <DeleteIcon />
                    </IconButton>
                </PermissionGuard>
            </Box>
        </ListItem>
    );

    return (
        <PageContainer>
            <PageHeader
                variant="hero"
                tone={scope.tone}
                title="Protocolos y Reglamentos"
                name={(corporationData || stateCorporation)?.name ?? null}
                back={scope.back}
                period={scope.periodLabel(fiscalYear || stateFiscalYear)}
                meta={[`${protocols.length} protocolos encontrados`]}
                actions={headerActions}
            />

            <>
                {/* Filtros */}
                <FilterBar {...pageFilters.barProps} loading={loading} />

                {/* Lista de protocolos */}
                {loading ? (
                    <Box display="flex" justifyContent="center" mt={4}>
                        <CircularProgress />
                    </Box>
                ) : protocols.length === 0 ? (
                    <Typography variant="body1" textAlign="center" mt={4}>
                        No se encontraron protocolos o reglamentos para esta corporación.
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
                        {hasPermission(currentProtocol ? 'protocolos-editar' : 'protocolos-crear') && (
                            <Button onClick={handleSave} variant="contained">
                                {currentProtocol ? 'Actualizar' : 'Crear'}
                            </Button>
                        )}
                    </DialogActions>
                </Dialog>


            </>
        </PageContainer>
    );
};

export default CorporateProtocolsPage;
