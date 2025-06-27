// src/pages/ContractsManagementPage.jsx
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
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    useTheme,
    useMediaQuery,
    Chip
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    CloudUpload as CloudUploadIcon,
    ContentCopy as ContentCopyIcon,
    Visibility as VisibilityIcon,
    School as SchoolIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import SimpleEditor from './SimpleEditor';
import api from '../utils/axiosConfig';
import mammoth from 'mammoth';
import ErrorBoundary from '../components/ErrorBoundary';
import parse from 'html-react-parser';
import SignatureCanvas from 'react-signature-canvas';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import styled from 'styled-components';

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

// Opcionales: estilos para separar títulos y valores en mobile
const MobileLabel = styled(Typography)`
    font-weight: bold;
    font-size: 0.9rem;
    color: #555;
`;
const MobileValue = styled(Typography)`
    font-size: 1rem;
`;

// El componente principal
const ContractsManagementPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();

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

    // Selector de colegio (en editor)
    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);

    // Diálogo para asignar colegio a contrato existente
    const [openAssignDialog, setOpenAssignDialog] = useState(false);
    const [contractToAssign, setContractToAssign] = useState(null);
    const [assignSelectedSchool, setAssignSelectedSchool] = useState('');

    // Para placeholders y firmas
    const signatureRefs = useRef({});
    const [formValues, setFormValues] = useState({});

    // Contratos llenados (con paginación y búsqueda)
    const [filledContracts, setFilledContracts] = useState([]);
    const [filledContractsLoading, setFilledContractsLoading] = useState(false);
    const [filledContractsPage, setFilledContractsPage] = useState(1);
    const [filledContractsLimit] = useState(10);
    const [filledContractsTotalPages, setFilledContractsTotalPages] = useState(1);
    const [filledContractsSearch, setFilledContractsSearch] = useState('');

    // Diálogo de confirmación para eliminar contrato llenado
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [filledContractToDelete, setFilledContractToDelete] = useState(null);

    // ---------------------------
    // useEffect para cargar contratos
    // ---------------------------
    useEffect(() => {
        const fetchContracts = async () => {
            try {
                const response = await api.get('/contracts');
                setContracts(response.data);
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
    }, []);

    // ---------------------------
    // useEffect para cargar colegios
    // ---------------------------
    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const response = await api.get('/schools');
                const list = Array.isArray(response.data)
                    ? response.data
                    : Array.isArray(response.data?.schools)
                        ? response.data.schools
                        : Array.isArray(response.data?.data)
                            ? response.data.data
                            : [];
                setSchools(list);
            } catch (error) {
                console.error('Error al obtener colegios:', error);
                setSnackbar({
                    open: true,
                    message: 'No se pudieron cargar los colegios.',
                    severity: 'error'
                });
            }
        };
        fetchSchools();
    }, []);

    // ---------------------------
    // useEffect para cargar contratos llenados (paginados)
    // ---------------------------
    useEffect(() => {
        const fetchFilledContracts = async () => {
            setFilledContractsLoading(true);
            try {
                const response = await api.get('/contracts/filled', {
                    params: {
                        page: filledContractsPage,
                        limit: filledContractsLimit
                    }
                });
                setFilledContracts(response.data.data);
                setFilledContractsTotalPages(response.data.meta.totalPages);
            } catch (error) {
                console.error('Error al obtener los contratos llenados:', error);
                setSnackbar({
                    open: true,
                    message: 'Error al obtener los contratos llenados.',
                    severity: 'error'
                });
            } finally {
                setFilledContractsLoading(false);
            }
        };
        fetchFilledContracts();
    }, [filledContractsPage, filledContractsLimit]);

    // ---------------------------
    // Función para subir archivo Word y convertirlo a HTML
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
                    schoolId: selectedSchool
                });
            } else {
                // Crear
                response = await api.post('/contracts', {
                    title: contractTitle,
                    content: editorData,
                    schoolId: selectedSchool
                });
            }

            const { id, uuid, url, schoolId, School } = response.data;
            const savedContract = {
                id,
                uuid,
                title: contractTitle,
                content: editorData,
                url,
                schoolId,
                School
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
    // Funciones para editar, eliminar, copiar enlace y asignar colegio
    // ---------------------------
    const handleEdit = (contract) => {
        setCurrentContract(contract);
        setContractTitle(contract.title);
        setEditorData(contract.content);
        setSelectedSchool(contract.schoolId ?? null);
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

    // Abrir diálogo de asignación de colegio
    const handleOpenAssignDialog = (contract) => {
        setContractToAssign(contract);
        setAssignSelectedSchool('');
        setOpenAssignDialog(true);
    };

    const handleCloseAssignDialog = () => {
        setContractToAssign(null);
        setAssignSelectedSchool('');
        setOpenAssignDialog(false);
    };

    const handleAssignSchool = async () => {
        if (!contractToAssign || !assignSelectedSchool) return;
        try {
            const response = await api.put(`/contracts/${contractToAssign.uuid}`, {
                schoolId: assignSelectedSchool
            });

            // Actualizar contratos en estado
            setContracts((prev) =>
                prev.map((c) =>
                    c.id === contractToAssign.id
                        ? { ...c, schoolId: assignSelectedSchool, School: schools.find((s) => s.id === assignSelectedSchool) }
                        : c
                )
            );
            setSnackbar({
                open: true,
                message: 'Colegio asignado correctamente.',
                severity: 'success'
            });
            handleCloseAssignDialog();
        } catch (error) {
            console.error('Error al asignar colegio:', error);
            setSnackbar({
                open: true,
                message: 'No se pudo asignar el colegio.',
                severity: 'error'
            });
        }
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
        return Array.from(new Set(out.map(JSON.stringify))).map(JSON.parse);
    };

    const handleChange = (name, value) => {
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleSignature = (name, ref) => {
        signatureRefs.current[name] = ref;
    };

    // ---------------------------
    // Función para renderizar contenido con placeholders
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
                        `<img src="${dataUrl}" alt="Firma" style="width:200px; height:100px;" />`
                    );
                } else {
                    filledContent = filledContent.replace(
                        new RegExp(`{{\\s*${ph.name}\\s*:\\s*signature\\s*}}`, 'g'),
                        ''
                    );
                }
            } else {
                filledContent = filledContent.replace(
                    new RegExp(`{{\\s*${ph.name}\\s*:\\s*${ph.type}\\s*}}`, 'g'),
                    formValues[ph.name] || ''
                );
            }
        });

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = filledContent;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.fontFamily = "'Times New Roman', serif";
        tempDiv.style.lineHeight = '1.5';
        tempDiv.style.textAlign = 'justify';
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
        setSelectedSchool(null);
        signatureRefs.current = {};
        setFormValues({});
    };

    return (
        <Container>
            <Typography variant="h4" gutterBottom>
                Gestión de Contratos
            </Typography>

            {/* Botón para crear contrato */}
            <Button
                variant="contained"
                color="primary"
                onClick={() => setOpenEditor(true)}
                startIcon={<CloudUploadIcon />}
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

                            {/* Colegio asignado */}
                            {contract.schoolId ? (
                                <Chip
                                    label={contract.School?.name || 'Colegio asignado'}
                                    size="small"
                                    color="success"
                                    style={{ marginTop: '4px' }}
                                />
                            ) : (
                                <Chip
                                    label="Sin colegio"
                                    size="small"
                                    color="warning"
                                    style={{ marginTop: '4px' }}
                                />
                            )}

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
                                {!contract.schoolId && (
                                    <IconButton
                                        onClick={() => handleOpenAssignDialog(contract)}
                                        title="Asignar colegio"
                                    >
                                        <SchoolIcon />
                                    </IconButton>
                                )}
                            </Box>
                        </MobileContractCard>
                    ))}
                </Box>
            ) : (
                <List>
                    {contracts.map((contract) => (
                        <ListItem key={contract.id} divider>
                            <ListItemText
                                primary={
                                    <>
                                        {contract.title}{' '}
                                        {contract.schoolId ? (
                                            <Chip
                                                label={contract.School?.name || 'Colegio asignado'}
                                                size="small"
                                                color="success"
                                                style={{ marginLeft: '6px' }}
                                            />
                                        ) : (
                                            <Chip
                                                label="Sin colegio"
                                                size="small"
                                                color="warning"
                                                style={{ marginLeft: '6px' }}
                                            />
                                        )}
                                    </>
                                }
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
                            {!contract.schoolId && (
                                <IconButton
                                    edge="end"
                                    onClick={() => handleOpenAssignDialog(contract)}
                                    style={{ marginLeft: '10px' }}
                                    title="Asignar colegio"
                                >
                                    <SchoolIcon />
                                </IconButton>
                            )}
                        </ListItem>
                    ))}
                </List>
            )}

            <Divider style={{ margin: '40px 0' }} />
            <Typography variant="h5" gutterBottom>
                Contratos Llenos
            </Typography>

            <Box display="flex" justifyContent="flex-end" mb={2}>
                <TextField
                    label="Buscar Contratos Llenados"
                    variant="outlined"
                    size="small"
                    value={filledContractsSearch}
                    onChange={(e) => setFilledContractsSearch(e.target.value)}
                    style={{ width: isMobile ? '100%' : '300px' }}
                />
            </Box>

            {filledContractsLoading ? (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <CircularProgress />
                </div>
            ) : isMobile ? (
                <Box>
                    {filledContracts.length === 0 ? (
                        <Typography variant="body1">No se encontraron contratos llenados.</Typography>
                    ) : (
                        filledContracts
                            .filter((fc) => {
                                const s = filledContractsSearch.toLowerCase();
                                return (
                                    fc.title.toLowerCase().includes(s) ||
                                    fc.contract.title.toLowerCase().includes(s)
                                );
                            })
                            .map((filledContract) => (
                                <MobileFilledContractCard key={filledContract.id}>
                                    <Typography variant="h6">{filledContract.title}</Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Fecha de Creación: {new Date(filledContract.createdAt).toLocaleString()}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Contrato Original: {filledContract.contract.title}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                        <Button
                                            variant="outlined"
                                            color="primary"
                                            onClick={() =>
                                                navigate(`/admin/contratos-llenados/${filledContract.uuid}`)
                                            }
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
                            ))
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
                    {filledContracts.length === 0 ? (
                        <Typography variant="body1">No se encontraron contratos llenados.</Typography>
                    ) : (
                        filledContracts
                            .filter((fc) => {
                                const s = filledContractsSearch.toLowerCase();
                                return (
                                    fc.title.toLowerCase().includes(s) ||
                                    fc.contract.title.toLowerCase().includes(s)
                                );
                            })
                            .map((filledContract) => (
                                <ListItem key={filledContract.id} divider>
                                    <ListItemText
                                        primary={filledContract.title}
                                        secondary={
                                            <>
                                                <Typography variant="body2" color="textSecondary">
                                                    Fecha de Creación: {new Date(filledContract.createdAt).toLocaleString()}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    Contrato Original: {filledContract.contract.title}
                                                </Typography>
                                            </>
                                        }
                                    />
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={() =>
                                            navigate(`/admin/contratos-llenados/${filledContract.uuid}`)
                                        }
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
                            ))
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
            )}

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

                            {/* Selector de colegio */}
                            <FormControl fullWidth margin="normal">
                                <InputLabel id="school-select-label">Colegio vinculado</InputLabel>
                                <Select
                                    labelId="school-select-label"
                                    value={selectedSchool ?? ''}
                                    label="Colegio vinculado"
                                    onChange={(e) => setSelectedSchool(e.target.value || null)}
                                >
                                    <MenuItem value="">
                                        <em>Sin colegio</em>
                                    </MenuItem>
                                    {(Array.isArray(schools) ? schools : []).map((s) => (
                                        <MenuItem key={s.id} value={s.id}>
                                            {s.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

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

            {/* Diálogo para asignar colegio */}
            <Dialog open={openAssignDialog} onClose={handleCloseAssignDialog}>
                <DialogTitle>Asignar Colegio al Contrato</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="assign-school-label">Colegios</InputLabel>
                        <Select
                            labelId="assign-school-label"
                            value={assignSelectedSchool}
                            label="Colegios"
                            onChange={(e) => setAssignSelectedSchool(e.target.value)}
                        >
                            {(Array.isArray(schools) ? schools : []).map((s) => (
                                <MenuItem key={s.id} value={s.id}>
                                    {s.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseAssignDialog}>Cancelar</Button>
                    <Button
                        onClick={handleAssignSchool}
                        variant="contained"
                        disabled={!assignSelectedSchool}
                    >
                        Asignar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo para confirmar eliminación de Contrato Llenado */}
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
    );
};

export default ContractsManagementPage;
