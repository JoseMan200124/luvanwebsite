// src/pages/SchoolContractsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
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
    Divider,
    TextField,
    Grid,
    Pagination,
    CircularProgress,
    Box,
    MenuItem,
    DialogActions,
    useTheme,
    useMediaQuery,
    Chip,
    Card,
    CardContent
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    CloudUpload as CloudUploadIcon,
    ContentCopy as ContentCopyIcon,
    Visibility as VisibilityIcon,
    School as SchoolIcon,
    ArrowBack as ArrowBackIcon,
    CalendarToday,
    Add as AddIcon
} from '@mui/icons-material';
import { Switch, FormControlLabel } from '@mui/material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import SimpleEditor from './SimpleEditor';
import api from '../utils/axiosConfig';
import mammoth from 'mammoth';
import ErrorBoundary from '../components/ErrorBoundary';
import parse from 'html-react-parser';
import SignatureCanvas from 'react-signature-canvas';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import styled from 'styled-components';
import tw from 'twin.macro';

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

// Mobile view: Tarjeta para contrato (contratos originales)
const MobileContractCard = styled(Box)`
    padding: 16px;
    margin-bottom: 12px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
`;

// Mobile view: Tarjeta para contrato llenado
const MobileFilledContractCard = styled(Box)`
    padding: 16px;
    margin-bottom: 12px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
`;

const SchoolContractsPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();
    const { schoolYear, schoolId } = useParams();
    const location = useLocation();

    // Estados para contratos (originales)
    const [contracts, setContracts] = useState([]);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Estados para crear/editar contrato
    const [openEditor, setOpenEditor] = useState(false);
    const [currentContract, setCurrentContract] = useState(null);
    const [contractTitle, setContractTitle] = useState('');
    const [editorData, setEditorData] = useState('');

    // Para placeholders y firmas
    const signatureRefs = useRef({});
    const [formValues, setFormValues] = useState({});

    // Contratos firmados (con paginación y búsqueda)
    const [filledContracts, setFilledContracts] = useState([]);
    const [filledContractsLoading, setFilledContractsLoading] = useState(false);
    const [filledContractsPage, setFilledContractsPage] = useState(1);
    const [filledContractsLimit] = useState(10);
    const [filledContractsTotalPages, setFilledContractsTotalPages] = useState(1);
    const [filledContractsTotalCount, setFilledContractsTotalCount] = useState(0);
    const [filledContractsSearch, setFilledContractsSearch] = useState('');
    const [filledContractsSearchInput, setFilledContractsSearchInput] = useState(''); // Para el input del usuario

    // Nuevo: switch para mostrar solo familias no firmadas por contrato
    const [onlyUnfilled, setOnlyUnfilled] = useState(false);
    // Nuevo: toggle para mostrar familias inactivas. Por defecto false -> mostrar solo activas
    const [showInactive, setShowInactive] = useState(false);
    const MIN_LOADING_MS = 600; // ms mínimo para mostrar el loader y mejorar percepción
    const [unfilledFamilies, setUnfilledFamilies] = useState([]);
    const [unfilledLoading, setUnfilledLoading] = useState(false);
    const [selectedContractUuid, setSelectedContractUuid] = useState(null);

    // Diálogo de confirmación para eliminar contrato llenado
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [filledContractToDelete, setFilledContractToDelete] = useState(null);

    // Estados para información del colegio
    const [schoolData, setSchoolData] = useState(null);

    // Obtener datos del estado de navegación si están disponibles
    const stateSchool = location.state?.school;
    const stateSchoolYear = location.state?.schoolYear;

    // ---------------------------
    // useEffect para cargar contratos del colegio específico
    // ---------------------------
    useEffect(() => {
        const fetchContracts = async () => {
            try {
                const response = await api.get('/contracts', {
                    params: { schoolId: schoolId }
                });
                setContracts(response.data);
                // seleccionar por defecto el primer contrato si existe
                if (Array.isArray(response.data) && response.data.length > 0) {
                    setSelectedContractUuid(response.data[0].uuid);
                }
            } catch (error) {
                console.error('Error al obtener los contratos:', error);
                setSnackbar({
                    open: true,
                    message: 'Error al obtener los contratos.',
                    severity: 'error'
                });
            }
        };
        
        fetchContracts();
    }, [schoolId]);

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
    // useEffect para cargar contratos firmados (paginados)
    // ---------------------------
    useEffect(() => {
        const fetchItems = async () => {
            // Si está activo el switch, consumir endpoint de familias no firmadas
            if (onlyUnfilled) {
                const start = Date.now();
                setUnfilledLoading(true);
                try {
                    if (!selectedContractUuid) {
                        setUnfilledFamilies([]);
                        // No remote call; ensure minimal perception time
                        const elapsed = Date.now() - start;
                        const wait = Math.max(0, MIN_LOADING_MS - elapsed);
                        setTimeout(() => setUnfilledLoading(false), wait);
                        return;
                    }

                    const params = {
                        page: filledContractsPage,
                        limit: filledContractsLimit,
                        schoolId: schoolId,
                        contractUuid: selectedContractUuid
                    };
                    if (filledContractsSearch) params.search = filledContractsSearch;
                    // Por defecto solicitar sólo familias activas al backend salvo que se active "showInactive"
                    params.isActive = !showInactive;

                    const response = await api.get('/contracts/unfilled', { params });
                    const raw = response.data.data || [];
                    // Backend devuelve según el parámetro `active`; asignar directamente
                    setUnfilledFamilies(raw);
                    setFilledContractsTotalPages(response.data.meta.totalPages);
                    const totalCount = response.data.meta?.total ?? 0;
                    setFilledContractsTotalCount(totalCount);
                } catch (error) {
                    console.error('Error al obtener familias no firmadas:', error);
                    const serverMsg = error?.response?.data?.message || error?.message || 'Error desconocido';
                    const status = error?.response?.status;
                    setSnackbar({ open: true, message: `Error ${status || ''}: ${serverMsg}`, severity: 'error' });
                } finally {
                    const elapsed = Date.now() - start;
                    const wait = Math.max(0, MIN_LOADING_MS - elapsed);
                    setTimeout(() => setUnfilledLoading(false), wait);
                }
                return;
            }

            // Comportamiento original: listar contratos llenados
            const start = Date.now();
            setFilledContractsLoading(true);
            try {
                const params = {
                    page: filledContractsPage,
                    limit: filledContractsLimit,
                    schoolId: schoolId
                };
                if (filledContractsSearch) params.search = filledContractsSearch;
                if (selectedContractUuid) params.contractUuid = selectedContractUuid;
                // Por defecto solicitar sólo familias activas al backend salvo que se active "showInactive"
                params.isActive = !showInactive;

                const response = await api.get('/contracts/filled', { params });
                const raw = response.data.data || [];
                // Backend devuelve según el parámetro `active`; asignar directamente
                setFilledContracts(raw);
                setFilledContractsTotalPages(response.data.meta.totalPages);
                const totalCount = response.data.meta?.totalItems ?? response.data.meta?.total ?? response.data.meta?.totalCount ?? response.data.meta?.count ?? 0;
                setFilledContractsTotalCount(totalCount);
            } catch (error) {
                console.error('Error al obtener los contratos firmados:', error);
                const serverMsg = error?.response?.data?.message || error?.message || 'Error desconocido';
                const status = error?.response?.status;
                setSnackbar({ open: true, message: `Error ${status || ''}: ${serverMsg}`, severity: 'error' });
            } finally {
                const elapsed = Date.now() - start;
                const wait = Math.max(0, MIN_LOADING_MS - elapsed);
                setTimeout(() => setFilledContractsLoading(false), wait);
            }
        };
        fetchItems();
    }, [filledContractsPage, filledContractsLimit, schoolId, filledContractsSearch, onlyUnfilled, selectedContractUuid, showInactive]);

    // ---------------------------
    // Función para subir archivo Word y convertirlo a HTML (igual que ContractsManagementPage)
    // ---------------------------
    const handleWordUpload = async (event) => {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.docx')) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                setEditorData(result.value);
            } catch (error) {
                console.error('Error convirtiendo documento Word:', error);
                setSnackbar({
                    open: true,
                    message: 'Error al convertir el documento de Word.',
                    severity: 'error'
                });
            }
        } else {
            setSnackbar({
                open: true,
                message: 'Por favor, sube un archivo de Word (.docx).',
                severity: 'warning'
            });
        }
        event.target.value = null;
    };

    // ---------------------------
    // Función para crear o actualizar contrato
    // ---------------------------
    const handleSaveOrUpdate = async () => {
        if (!contractTitle.trim()) {
            setSnackbar({
                open: true,
                message: 'Por favor, ingresa un título para el contrato.',
                severity: 'warning'
            });
            return;
        }
        try {
            let response;
            if (currentContract) {
                // Actualizar
                response = await api.put(`/contracts/${currentContract.uuid}`, {
                    title: contractTitle,
                    content: editorData,
                    schoolId: parseInt(schoolId) // Asignar al colegio actual
                });
            } else {
                // Crear
                response = await api.post('/contracts', {
                    title: contractTitle,
                    content: editorData,
                    schoolId: parseInt(schoolId) // Asignar al colegio actual
                });
            }

            const { id, uuid, url, School } = response.data;
            const savedContract = {
                id,
                uuid,
                title: contractTitle,
                content: editorData,
                url,
                schoolId: parseInt(schoolId),
                School: School || schoolData
            };

            if (currentContract) {
                setContracts((prev) =>
                    prev.map((c) => (c.id === currentContract.id ? savedContract : c))
                );
                setSnackbar({
                    open: true,
                    message: 'Contrato actualizado exitosamente.',
                    severity: 'success'
                });
            } else {
                setContracts((prev) => [...prev, savedContract]);
                setSnackbar({
                    open: true,
                    message: 'Contrato guardado exitosamente.',
                    severity: 'success'
                });
            }

            handleCloseEditor();
        } catch (error) {
            console.error('Error al guardar/actualizar contrato:', error);
            setSnackbar({
                open: true,
                message: 'Error al guardar/actualizar el contrato.',
                severity: 'error'
            });
        }
    };

    // ---------------------------
    // Funciones para editar, eliminar, copiar enlace
    // ---------------------------
    const handleEdit = (contract) => {
        setCurrentContract(contract);
        setContractTitle(contract.title);
        setEditorData(contract.content);
        setOpenEditor(true);
    };

    const handleDelete = async (uuid) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este contrato?')) return;
        try {
            await api.delete(`/contracts/${uuid}`);
            setContracts((prev) => prev.filter((c) => c.uuid !== uuid));
            setSnackbar({
                open: true,
                message: 'Contrato eliminado exitosamente.',
                severity: 'info'
            });
        } catch (error) {
            console.error('Error al eliminar el contrato:', error);
            setSnackbar({
                open: true,
                message: 'Error al eliminar el contrato.',
                severity: 'error'
            });
        }
    };

    const handleCopyLink = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            setSnackbar({
                open: true,
                message: 'Enlace copiado al portapapeles.',
                severity: 'success'
            });
        } catch (error) {
            console.error('Error al copiar enlace:', error);
            setSnackbar({
                open: true,
                message: 'Error al copiar enlace.',
                severity: 'error'
            });
        }
    };

    const handleViewContract = (contract) => {
        navigate(`/admin/contratos/${contract.uuid}`);
    };

    // ---------------------------
    // Función para extraer placeholders
    // ---------------------------
    const extractPlaceholders = (content) => {
        const regex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
        const out = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const nameTrim = match[1].trim();
            out.push({ name: nameTrim, type: match[2] });
        }
        return out;
    };

    // ---------------------------
    // Funciones auxiliares para renderContent (iguales a ContractsManagementPage)
    // ---------------------------
    const handleChange = (name, value) => {
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleSignature = (name, ref) => {
        signatureRefs.current[name] = ref;
    };

    // ---------------------------
    // Función para renderizar contenido con placeholders (igual a ContractsManagementPage)
    // ---------------------------
    const renderContent = (html) => {
        const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
        return parse(html, {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const txt = domNode.data;
                    const segments = [];
                    let lastIndex = 0;
                    let match;
                    while ((match = placeholderRegex.exec(txt)) !== null) {
                        const [fullMatch, rawName, type] = match;
                        const nameTrim = rawName.trim();
                        const beforeText = txt.slice(lastIndex, match.index);
                        if (beforeText) segments.push(beforeText);
                        if (type === 'signature') {
                            segments.push(
                                <div
                                    key={`sig-${nameTrim}-${match.index}`}
                                    style={{ display: 'block', margin: '20px 0', clear: 'both' }}
                                >
                                    <Typography variant="subtitle1" gutterBottom>
                                        {nameTrim}
                                    </Typography>
                                    <SignatureCanvas
                                        penColor="black"
                                        canvasProps={{
                                            width: 300,
                                            height: 150,
                                            style: { border: '1px solid #000' }
                                        }}
                                        ref={(ref) => handleSignature(nameTrim, ref)}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                            if (signatureRefs.current[nameTrim]) {
                                                signatureRefs.current[nameTrim].clear();
                                            }
                                        }}
                                        style={{ marginTop: '5px' }}
                                    >
                                        Limpiar Firma
                                    </Button>
                                </div>
                            );
                        } else if (type === 'text' || type === 'date' || type === 'number') {
                            segments.push(
                                <input
                                    key={`inp-${nameTrim}-${match.index}`}
                                    placeholder={nameTrim}
                                    type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
                                    value={formValues[nameTrim] || ''}
                                    onChange={(e) => handleChange(nameTrim, e.target.value)}
                                    style={{
                                        display: 'inline-block',
                                        margin: '0 5px',
                                        minWidth: '100px',
                                        border: 'none',
                                        borderBottom: '1px solid #000',
                                        fontSize: '1rem',
                                        fontFamily: 'inherit',
                                        background: 'transparent'
                                    }}
                                />
                            );
                        }
                        lastIndex = match.index + fullMatch.length;
                    }
                    const remainder = txt.slice(lastIndex);
                    if (remainder) segments.push(remainder);
                    if (segments.length > 0) {
                        return <React.Fragment key={`fragment-${domNode.key}`}>{segments}</React.Fragment>;
                    }
                }
            }
        });
    };

    // ---------------------------
    // Funciones para eliminar contrato llenado
    // ---------------------------
    const handleOpenDeleteDialog = (filledContract) => {
        setFilledContractToDelete(filledContract);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setFilledContractToDelete(null);
        setOpenDeleteDialog(false);
    };

    const confirmDeleteFilledContract = async () => {
        if (!filledContractToDelete) return;
        try {
            await api.delete(`/contracts/filled/${filledContractToDelete.id}`);
            setFilledContracts((prev) =>
                prev.filter((fc) => fc.id !== filledContractToDelete.id)
            );
            setSnackbar({
                open: true,
                message: 'Contrato llenado eliminado exitosamente.',
                severity: 'info'
            });
        } catch (error) {
            console.error('Error al eliminar el contrato llenado:', error);
            setSnackbar({
                open: true,
                message: 'Error al eliminar el contrato llenado.',
                severity: 'error'
            });
        } finally {
            handleCloseDeleteDialog();
        }
    };

    // ---------------------------
    // Función para generar PDF
    // ---------------------------
    const handleGeneratePDF = async () => {
        if (!editorData) {
            setSnackbar({
                open: true,
                message: 'No hay contenido para generar el PDF.',
                severity: 'warning'
            });
            return;
        }

        let filledContent = editorData;
        const placeholders = extractPlaceholders(editorData);
        placeholders.forEach((ph) => {
            if (ph.type === 'signature') {
                const sigPad = signatureRefs.current[ph.name];
                if (sigPad && !sigPad.isEmpty()) {
                    const dataUrl = sigPad.getTrimmedCanvas().toDataURL('image/png');
                    filledContent = filledContent.replace(
                        new RegExp(`{{\\s*${ph.name}\\s*:\\s*signature\\s*}}`, 'g'),
                        `<img src="${dataUrl}" style="width: 150px; height: 75px;" />`
                    );
                } else {
                    filledContent = filledContent.replace(
                        new RegExp(`{{\\s*${ph.name}\\s*:\\s*signature\\s*}}`, 'g'),
                        '________________'
                    );
                }
            } else {
                const value = formValues[ph.name] || '________________';
                filledContent = filledContent.replace(
                    new RegExp(`{{\\s*${ph.name}\\s*:\\s*${ph.type}\\s*}}`, 'g'),
                    value
                );
            }
        });

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = filledContent;
        tempDiv.style.padding = '20px';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.fontSize = '14px';
        tempDiv.style.lineHeight = '1.6';
        tempDiv.style.color = '#000';
        tempDiv.style.backgroundColor = '#fff';
        document.body.appendChild(tempDiv);

        try {
            const canvas = await html2canvas(tempDiv, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${contractTitle || 'Contrato'}.pdf`);
            setSnackbar({
                open: true,
                message: 'PDF generado exitosamente.',
                severity: 'success'
            });
        } catch (error) {
            console.error('Error generando PDF:', error);
            setSnackbar({
                open: true,
                message: 'Error al generar el PDF.',
                severity: 'error'
            });
        }
        document.body.removeChild(tempDiv);
    };

    // ---------------------------
    // Cerrar el diálogo de creación/edición
    // ---------------------------
    const handleCloseEditor = () => {
        setOpenEditor(false);
        setCurrentContract(null);
        setContractTitle('');
        setEditorData('');
        signatureRefs.current = {};
        setFormValues({});
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
    // Función para manejar la búsqueda
    // ---------------------------
    const handleSearch = () => {
        // Resetear a la página 1 y actualizar la búsqueda activa
        setFilledContractsPage(1);
        setFilledContractsSearch(filledContractsSearchInput);
    };

    // Función para limpiar la búsqueda
    const handleClearSearch = () => {
        setFilledContractsSearchInput('');
        setFilledContractsSearch('');
        setFilledContractsPage(1);
    };

    // Componente local para renderizar un filled contract (evita duplicación móvil/desktop)
    const RenderFilledContract = ({ filledContract, isMobileView }) => {
        const familyLastName = (
            filledContract?.parent?.FamilyDetail?.familyLastName ||
            filledContract?.parent?.familyLastName ||
            filledContract?.filledData?.familyLastName ||
            ''
        );

            if (isMobileView) {
            return (
                <MobileFilledContractCard key={filledContract.id}>
                    <Typography variant="h6">Familia: {familyLastName}</Typography>
                    <Typography variant="body2" color="textSecondary">
                        Fecha de Creación: {new Date(filledContract.createdAt).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Usuario: {filledContract.parent?.name || filledContract.filledData?.parentName || ''} { (filledContract.parent?.email || filledContract.filledData?.parentEmail) ? `(${filledContract.parent?.email || filledContract.filledData?.parentEmail})` : '' }
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => navigate(`/admin/contratos-llenados/${filledContract.uuid}`)}
                            startIcon={<VisibilityIcon />}
                        >
                            Ver Detalles
                        </Button>
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => window.open(filledContract.pdfUrl, '_blank')}
                            startIcon={<VisibilityIcon />}
                        >
                            Descargar PDF
                        </Button>
                        <IconButton onClick={() => handleOpenDeleteDialog(filledContract)}>
                            <DeleteIcon />
                        </IconButton>
                    </Box>
                </MobileFilledContractCard>
            );
        }

        return (
            <ListItem key={filledContract.id} divider>
                <ListItemText
                    primary={`Familia: ${familyLastName}`}
                    secondary={
                        <>
                            <Typography variant="body2" color="textSecondary">
                                Fecha de Creación: {new Date(filledContract.createdAt).toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Usuario: {filledContract.parent?.name || filledContract.filledData?.parentName || ''} { (filledContract.parent?.email || filledContract.filledData?.parentEmail) ? `(${filledContract.parent?.email || filledContract.filledData?.parentEmail})` : '' }
                            </Typography>
                        </>
                    }
                />
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => navigate(`/admin/contratos-llenados/${filledContract.uuid}`)}
                    startIcon={<VisibilityIcon />}
                    style={{ marginRight: '10px' }}
                >
                    Ver Detalles
                </Button>
                <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => window.open(filledContract.pdfUrl, '_blank')}
                    startIcon={<VisibilityIcon />}
                    style={{ marginRight: '10px' }}
                >
                    Descargar PDF
                </Button>
                <IconButton onClick={() => handleOpenDeleteDialog(filledContract)}>
                    <DeleteIcon />
                </IconButton>
            </ListItem>
        );
    };

    return (
        <PageContainer>
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={handleBackToDashboard}
                            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                        >
                            Volver al Dashboard
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <SchoolIcon sx={{ fontSize: 40 }} />
                        <Box>
                                        <Typography variant="h4" component="h1" gutterBottom>
                                            Contratos - {schoolData?.name || 'Cargando...'}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Chip 
                                                icon={<CalendarToday />}
                                                label={`Ciclo Escolar ${schoolYear || stateSchoolYear}`}
                                                sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                            />
                                            <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 700 }}>
                                                {filledContractsTotalCount} {onlyUnfilled ? 'familias sin firmar contrato' : 'contratos firmados'}
                                            </Typography>
                                        </Box>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            <Container>
                {/* Botón para crear contrato */}
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setOpenEditor(true)}
                    startIcon={<AddIcon />}
                    style={{ marginBottom: '20px' }}
                >
                    Crear Nuevo Contrato
                </Button>

                {/* Lista de contratos */}
                {isMobile ? (
                    <Box>
                        {contracts.map((contract) => (
                            <MobileContractCard key={contract.id}>
                                <Typography variant="h6">{contract.title}</Typography>

                                <Typography variant="body2" color="textSecondary">
                                    Link para compartir: {contract.url}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                    <IconButton onClick={() => handleEdit(contract)}>
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton onClick={() => handleDelete(contract.uuid)}>
                                        <DeleteIcon />
                                    </IconButton>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        onClick={() => handleViewContract(contract)}
                                        startIcon={<VisibilityIcon />}
                                    >
                                        Vista Previa
                                    </Button>
                                    <IconButton onClick={() => handleCopyLink(contract.url)}>
                                        <ContentCopyIcon />
                                    </IconButton>
                                </Box>
                            </MobileContractCard>
                        ))}
                    </Box>
                ) : (
                    <List>
                        {contracts.map((contract) => (
                            <ListItem key={contract.id} divider>
                                <ListItemText
                                    primary={contract.title}
                                    secondary={
                                        <>
                                            <Typography variant="body2" color="textSecondary">
                                                Link para compartir:
                                            </Typography>
                                            <Typography variant="body2" color="textPrimary">
                                                {contract.url}
                                            </Typography>
                                        </>
                                    }
                                />
                                <IconButton edge="end" onClick={() => handleEdit(contract)}>
                                    <EditIcon />
                                </IconButton>
                                <IconButton edge="end" onClick={() => handleDelete(contract.uuid)}>
                                    <DeleteIcon />
                                </IconButton>
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    onClick={() => handleViewContract(contract)}
                                    startIcon={<VisibilityIcon />}
                                    style={{ marginLeft: '10px' }}
                                >
                                    Vista Previa
                                </Button>
                                <IconButton
                                    edge="end"
                                    onClick={() => handleCopyLink(contract.url)}
                                    style={{ marginLeft: '10px' }}
                                >
                                    <ContentCopyIcon />
                                </IconButton>
                            </ListItem>
                        ))}
                    </List>
                )}  

                <Divider style={{ margin: '40px 0' }} />
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                    {onlyUnfilled ? 'Familias sin firmar contrato' : 'Contratos Firmados'}
                </Typography>

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: 2,
                        mt: 2,
                        mb: 2,
                        flexWrap: 'wrap'
                    }}
                >
                    {/* Left: selector y switch, alineado a la izquierda */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TextField
                            select
                            label="Contrato"
                            size="small"
                            value={selectedContractUuid || ''}
                            onChange={(e) => setSelectedContractUuid(e.target.value)}
                            style={{ minWidth: 220 }}
                        >
                            {contracts.map((c) => (
                                <MenuItem key={c.uuid} value={c.uuid}>
                                    {c.title}
                                </MenuItem>
                            ))}
                        </TextField>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={onlyUnfilled}
                                    onChange={(e) => { setOnlyUnfilled(e.target.checked); setFilledContractsPage(1); }}
                                    color="primary"
                                />
                            }
                            label="Sin firmar contrato"
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showInactive}
                                    onChange={(e) => { setShowInactive(e.target.checked); setFilledContractsPage(1); }}
                                    color="primary"
                                />
                            }
                            label="Solo inactivos"
                        />
                    </Box>

                    {/* Right: buscador, alineado a la derecha */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                            label="Buscar por apellido de familia"
                            variant="outlined"
                            size="small"
                            value={filledContractsSearchInput}
                            onChange={(e) => setFilledContractsSearchInput(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearch();
                                }
                            }}
                            style={{ width: isMobile ? '100%' : '300px' }}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSearch}
                            disabled={filledContractsLoading}
                        >
                            Buscar
                        </Button>
                        {filledContractsSearch && (
                            <Button
                                variant="outlined"
                                color="secondary"
                                onClick={handleClearSearch}
                                disabled={filledContractsLoading}
                            >
                                Limpiar
                            </Button>
                        )}
                    </Box>
                </Box>

                <Box style={{ minHeight: '120px' }}>
                    {/* Mostrar únicamente el spinner durante la carga de la vista seleccionada */}
                    { (onlyUnfilled ? unfilledLoading : filledContractsLoading) ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '120px' }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        // Cuando no hay carga, renderizar la vista seleccionada
                        isMobile ? (
                            <Box>
                                {onlyUnfilled ? (
                                    unfilledFamilies.length === 0 ? (
                                        <Typography variant="body1">No se encontraron familias sin firmar contrato.</Typography>
                                    ) : (
                                        <>
                                            {unfilledFamilies.map((f) => (
                                                <MobileFilledContractCard key={f.familyDetailId}>
                                                    <Typography variant="h6">Familia: {f.familyLastName || 'Sin Apellido'}</Typography>
                                                    <Typography variant="body2" color="textSecondary">Usuario: {f.userName || ''} &nbsp; {f.userEmail ? `(${f.userEmail})` : ''}</Typography>
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                                        <Typography variant="caption" color="textSecondary">(Información únicamente)</Typography>
                                                    </Box>
                                                </MobileFilledContractCard>
                                            ))}
                                        </>
                                    )
                                ) : (
                                    filledContracts.length === 0 ? (
                                        <Typography variant="body1">
                                            {filledContractsSearch 
                                                ? 'No se encontraron contratos firmados con ese criterio de búsqueda.'
                                                : 'No se encontraron contratos firmados.'
                                            }
                                        </Typography>
                                    ) : (
                                        <>
                                            {filledContracts.map((filledContract) => (
                                                <RenderFilledContract key={filledContract.id} filledContract={filledContract} isMobileView={true} />
                                            ))}
                                        </>
                                    )
                                )}

                                {filledContractsTotalPages > 1 && (
                                    <Box display="flex" justifyContent="center" mt={2}>
                                        <Pagination
                                            count={filledContractsTotalPages}
                                            page={filledContractsPage}
                                            onChange={(event, value) => setFilledContractsPage(value)}
                                            color="primary"
                                        />
                                    </Box>
                                )}
                            </Box>
                        ) : (
                            <List>
                                {onlyUnfilled ? (
                                    unfilledFamilies.length === 0 ? (
                                        <Typography variant="body1">No se encontraron familias sin firmar contrato.</Typography>
                                    ) : (
                                        <>
                                            {unfilledFamilies.map((f) => (
                                                <ListItem key={f.familyDetailId} divider>
                                                    <ListItemText
                                                        primary={`Familia: ${f.familyLastName || 'Sin Apellido'}`}
                                                        secondary={
                                                            <>
                                                                <Typography variant="body2" color="textSecondary">Usuario: {f.userName || ''} {f.userEmail ? `(${f.userEmail})` : ''}</Typography>
                                                            </>
                                                        }
                                                    />
                                                    <Typography variant="caption" color="textSecondary">(Información únicamente)</Typography>
                                                </ListItem>
                                            ))}
                                        </>
                                    )
                                ) : (
                                    filledContracts.length === 0 ? (
                                        <Typography variant="body1">
                                            {filledContractsSearch 
                                                ? 'No se encontraron contratos firmados con ese criterio de búsqueda.'
                                                : 'No se encontraron contratos firmados.'
                                            }
                                        </Typography>
                                    ) : (
                                        <>
                                            {filledContracts.map((filledContract) => (
                                                <RenderFilledContract key={filledContract.id} filledContract={filledContract} isMobileView={false} />
                                            ))}
                                        </>
                                    )
                                )}

                                {filledContractsTotalPages > 1 && (
                                    <Box display="flex" justifyContent="center" mt={2}>
                                        <Pagination
                                            count={filledContractsTotalPages}
                                            page={filledContractsPage}
                                            onChange={(event, value) => setFilledContractsPage(value)}
                                            color="primary"
                                        />
                                    </Box>
                                )}
                            </List>
                        )
                    )}
                </Box>

                {/* Diálogo Crear/Editar Contrato */}
                <Dialog open={openEditor} onClose={handleCloseEditor} maxWidth="lg" fullWidth>
                    <DialogTitle>{currentContract ? 'Editar Contrato' : 'Crear Contrato'}</DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Título del Contrato"
                                    value={contractTitle}
                                    onChange={(e) => setContractTitle(e.target.value)}
                                    fullWidth
                                    margin="normal"
                                />

                                <div style={{ marginBottom: '10px' }}>
                                    <input
                                        accept=".docx"
                                        style={{ display: 'none' }}
                                        id="upload-word"
                                        type="file"
                                        onChange={handleWordUpload}
                                    />
                                    <label htmlFor="upload-word">
                                        <Button
                                            variant="outlined"
                                            component="span"
                                            startIcon={<CloudUploadIcon />}
                                        >
                                            Subir Word
                                        </Button>
                                    </label>
                                </div>

                                <ErrorBoundary>
                                    <SimpleEditor editorData={editorData} setEditorData={setEditorData} />
                                </ErrorBoundary>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6">Vista Previa del Contrato</Typography>
                                <Divider style={{ margin: '10px 0' }} />
                                <div
                                    style={{
                                        border: '1px solid #ccc',
                                        padding: '20px',
                                        borderRadius: '4px',
                                        minHeight: '400px',
                                        backgroundColor: '#fff',
                                        overflowY: 'auto',
                                        fontFamily: "'Times New Roman', serif",
                                        lineHeight: '1.5',
                                        textAlign: 'justify'
                                    }}
                                    id="contract-preview"
                                >
                                    {renderContent(editorData)}
                                </div>
                            </Grid>
                        </Grid>
                        <div style={{ marginTop: '20px', textAlign: 'right' }}>
                            <Button variant="contained" color="primary" onClick={handleSaveOrUpdate}>
                                {currentContract ? 'Actualizar Contrato' : 'Guardar Contrato'}
                            </Button>
                            <Button variant="contained" style={{ marginLeft: '10px' }} onClick={handleCloseEditor}>
                                Cancelar
                            </Button>
                            <Button
                                variant="outlined"
                                color="secondary"
                                style={{ marginLeft: '10px' }}
                                onClick={handleGeneratePDF}
                            >
                                Generar PDF
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Diálogo de confirmación para eliminar contrato llenado */}
                <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
                    <DialogTitle>Confirmar Eliminación</DialogTitle>
                    <DialogContent>
                        <Typography>
                            ¿Está seguro de que desea eliminar este contrato llenado?
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDeleteDialog} color="primary">
                            Cancelar
                        </Button>
                        <Button onClick={confirmDeleteFilledContract} color="secondary">
                            Eliminar
                        </Button>
                    </DialogActions>
                </Dialog>

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
            </Container>
        </PageContainer>
    );
};

export default SchoolContractsPage;
