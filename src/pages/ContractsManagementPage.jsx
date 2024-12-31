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
    DialogActions
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    CloudUpload as CloudUploadIcon,
    ContentCopy as ContentCopyIcon,
    Visibility as VisibilityIcon
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

const ContractsManagementPage = () => {
    const [contracts, setContracts] = useState([]);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Estados para CREAR/EDITAR
    const [openEditor, setOpenEditor] = useState(false);
    const [currentContract, setCurrentContract] = useState(null);
    const [contractTitle, setContractTitle] = useState('');
    const [editorData, setEditorData] = useState('');

    // Para inputs/firma en la vista previa (admin)
    const signatureRefs = useRef({});
    const [formValues, setFormValues] = useState({});

    const navigate = useNavigate();

    // ============================
    // Estados y Variables para filledContracts
    // ============================
    const [filledContracts, setFilledContracts] = useState([]);
    const [filledContractsLoading, setFilledContractsLoading] = useState(false);
    const [filledContractsPage, setFilledContractsPage] = useState(1);
    const [filledContractsLimit] = useState(10); // Puedes ajustar el límite por página
    const [filledContractsTotalPages, setFilledContractsTotalPages] = useState(1);
    const [filledContractsSearch, setFilledContractsSearch] = useState('');

    // ============================
    // OBTENER CONTRATOS AL MONTAR
    // ============================
    useEffect(() => {
        const fetchContracts = async () => {
            try {
                const response = await api.get('/contracts');
                setContracts(response.data);
            } catch (error) {
                console.error('Error al obtener los contratos:', error);
                setSnackbar({ open: true, message: 'Error al obtener los contratos.', severity: 'error' });
            }
        };
        fetchContracts();
    }, []);

    // ============================
    // OBTENER CONTRATOS LLENADOS (Paginación)
    // ============================
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
                setSnackbar({ open: true, message: 'Error al obtener los contratos llenados.', severity: 'error' });
            } finally {
                setFilledContractsLoading(false);
            }
        };
        fetchFilledContracts();
    }, [filledContractsPage, filledContractsLimit]);

    // ============================
    // SUBIR ARCHIVO WORD
    // ============================
    const handleWordUpload = async (event) => {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.docx')) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                const html = result.value;
                setEditorData(html);
            } catch (error) {
                console.error('Error convirtiendo documento Word:', error);
                setSnackbar({
                    open: true,
                    message: 'Hubo un error al convertir el documento de Word.',
                    severity: 'error'
                });
            }
        } else {
            setSnackbar({
                open: true,
                message: 'Por favor, suba un archivo de Word (.docx).',
                severity: 'warning'
            });
        }
        event.target.value = null;
    };

    // ============================
    // CREAR O ACTUALIZAR CONTRATO (ADMIN)
    // ============================
    const handleSaveOrUpdate = async () => {
        if (!contractTitle.trim()) {
            setSnackbar({
                open: true,
                message: 'Por favor, ingrese un título para el contrato.',
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
                });
            } else {
                // Crear nuevo
                response = await api.post('/contracts', {
                    title: contractTitle,
                    content: editorData,
                });
            }
            const { id, uuid, url } = response.data;
            const savedContract = {
                id,
                uuid,
                title: contractTitle,
                content: editorData,
                url
            };

            if (currentContract) {
                // Actualizamos la lista local
                setContracts((prev) =>
                    prev.map((c) => (c.id === currentContract.id ? savedContract : c))
                );
                setSnackbar({ open: true, message: 'Contrato actualizado exitosamente.', severity: 'success' });
            } else {
                // Agregamos a la lista
                setContracts((prev) => [...prev, savedContract]);
                setSnackbar({ open: true, message: 'Contrato guardado exitosamente.', severity: 'success' });
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

    // ============================
    // EDITAR CONTRATO (ADMIN)
    // ============================
    const handleEdit = (contract) => {
        setCurrentContract(contract);
        setContractTitle(contract.title);
        setEditorData(contract.content);
        setOpenEditor(true);
    };

    // ============================
    // ELIMINAR CONTRATO (ADMIN)
    // ============================
    const handleDelete = async (contractUuid) => {
        if (window.confirm('¿Está seguro de que desea eliminar este contrato?')) {
            try {
                await api.delete(`/contracts/${contractUuid}`);
                setContracts((prev) => prev.filter((c) => c.uuid !== contractUuid));
                setSnackbar({ open: true, message: 'Contrato eliminado exitosamente.', severity: 'info' });
            } catch (error) {
                console.error('Error al eliminar el contrato:', error);
                setSnackbar({
                    open: true,
                    message: 'Error al eliminar el contrato.',
                    severity: 'error'
                });
            }
        }
    };

    // ============================
    // CERRAR EDITOR DE CONTRATO
    // ============================
    const handleCloseEditor = () => {
        setOpenEditor(false);
        setCurrentContract(null);
        setContractTitle('');
        setEditorData('');
        signatureRefs.current = {};
        setFormValues({});
    };

    // ============================
    // COPIAR ENLACE AL PORTAPAPELES
    // ============================
    const handleCopyLink = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            setSnackbar({ open: true, message: 'Enlace copiado al portapapeles.', severity: 'success' });
        } catch (error) {
            console.error('Error al copiar el enlace:', error);
            setSnackbar({ open: true, message: 'Error al copiar el enlace.', severity: 'error' });
        }
    };

    // ============================
    // EXTRAER PLACEHOLDERS ({{nombre:tipo}})
    // ============================
    const extractPlaceholders = (content) => {
        const regex = /{{\s*([^:{}\s]+)\s*:\s*(text|signature|date)\s*}}/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push({ name: match[1], type: match[2] });
        }
        // Eliminar duplicados
        return Array.from(new Set(matches.map(JSON.stringify))).map(JSON.parse);
    };

    // ============================
    // MANEJADORES DE INPUTS (ADMIN - VISTA PREVIA)
    // ============================
    const handleChange = (name, value) => {
        setFormValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // ============================
    // MANEJADOR DE FIRMA
    // ============================
    const handleSignature = (name, ref) => {
        signatureRefs.current[name] = ref;
    };

    // ============================
    // VISTA PREVIA DE CONTRATO
    // ============================
    const handleViewContract = (contract) => {

        navigate(`/admin/contratos/${contract.uuid}`);
    };

    // ============================
    // PARSEAR CONTENIDO -> INPUTS (ADMIN - VISTA PREVIA)
    // ============================
    const renderContent = (html) => {
        const placeholderRegex = /{{\s*([^:{}\s]+)\s*:\s*(text|signature|date)\s*}}/g;
        return parse(html, {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const originalText = domNode.data;
                    if (!originalText) return domNode;

                    if (!placeholderRegex.test(originalText)) {
                        return domNode;
                    }
                    placeholderRegex.lastIndex = 0;

                    const segments = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = placeholderRegex.exec(originalText)) !== null) {
                        const [fullMatch, name, type] = match;
                        const beforeText = originalText.slice(lastIndex, match.index);

                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        if (type === 'signature') {
                            segments.push(
                                <div key={`sig-${name}-${match.index}`} style={{ margin: '10px 0' }}>
                                    <Typography variant="subtitle1" gutterBottom>{name}</Typography>
                                    <SignatureCanvas
                                        penColor="black"
                                        canvasProps={{
                                            width: 300,
                                            height: 150,
                                            style: { border: '1px solid #000' }
                                        }}
                                        ref={(ref) => handleSignature(name, ref)}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                            if (signatureRefs.current[name]) {
                                                signatureRefs.current[name].clear();
                                            }
                                        }}
                                        style={{ marginTop: '5px' }}
                                    >
                                        Limpiar Firma
                                    </Button>
                                </div>
                            );
                        } else if (type === 'text' || type === 'date') {
                            segments.push(
                                <TextField
                                    key={`field-${name}-${match.index}`}
                                    label={name}
                                    type={type === 'date' ? 'date' : 'text'}
                                    InputLabelProps={type === 'date' ? { shrink: true } : {}}
                                    value={formValues[name] || ''}
                                    onChange={(e) => handleChange(name, e.target.value)}
                                    style={{ margin: '10px 0', width: '100%' }}
                                    variant="outlined"
                                />
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }

                    const remainingText = originalText.slice(lastIndex);
                    if (remainingText) {
                        segments.push(remainingText);
                    }

                    return <React.Fragment key={`fragment-${domNode.key}`}>{segments.map((segment, index) =>
                        typeof segment === 'string' ? <span key={index}>{segment}</span> : segment
                    )}</React.Fragment>;
                }
            },
        });
    };

    // ============================
    // ELIMINAR CONTRATO LLENADO (ADMIN)
    // ============================

    // Estado para controlar el diálogo de confirmación de eliminación
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [filledContractToDelete, setFilledContractToDelete] = useState(null);

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
            setFilledContracts((prev) => prev.filter((fc) => fc.id !== filledContractToDelete.id));
            setSnackbar({ open: true, message: 'Contrato llenado eliminado exitosamente.', severity: 'info' });
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

    // ============================
    // GENERAR PDF DE CONTRATO (ADMIN)
    // ============================
    const handleGeneratePDF = async () => {
        if (!editorData) {
            setSnackbar({
                open: true,
                message: 'No hay contenido para generar el PDF.',
                severity: 'warning'
            });
            return;
        }

        // Reemplazar placeholders con valores actuales
        let filledContent = editorData;

        const placeholders = extractPlaceholders(editorData);
        placeholders.forEach((ph) => {
            if (ph.type === 'text' || ph.type === 'date') {
                filledContent = filledContent.replace(
                    new RegExp(`{{\\s*${ph.name}\\s*:\\s*${ph.type}\\s*}}`, 'g'),
                    formValues[ph.name] || ''
                );
            } else if (ph.type === 'signature') {
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
            }
        });

        // Crear un div temporal para renderizar el contenido
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = filledContent;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.backgroundColor = '#fff';
        document.body.appendChild(tempDiv);

        // Generar PDF usando html2canvas y jsPDF
        try {
            const canvas = await html2canvas(tempDiv, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${contractTitle || 'Contrato'}.pdf`);
            setSnackbar({
                open: true,
                message: 'PDF generado exitosamente.',
                severity: 'success'
            });
        } catch (error) {
            console.error('Error generando el PDF:', error);
            setSnackbar({
                open: true,
                message: 'Hubo un error al generar el PDF.',
                severity: 'error'
            });
        }

        // Limpiar el div temporal
        document.body.removeChild(tempDiv);
    };

    // ============================
    // RENDER
    // ============================
    return (
        <div style={{ padding: '20px' }}>
            <Typography variant="h4" gutterBottom>
                Gestión de Contratos
            </Typography>

            <Button
                variant="contained"
                color="primary"
                onClick={() => setOpenEditor(true)}
                startIcon={<CloudUploadIcon />}
                style={{ marginBottom: '20px' }}
            >
                Crear Nuevo Contrato
            </Button>

            {/* LISTA DE CONTRATOS */}
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
                        <IconButton edge="end" aria-label="edit" onClick={() => handleEdit(contract)}>
                            <EditIcon />
                        </IconButton>
                        <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => handleDelete(contract.uuid)}
                        >
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
                            aria-label="copy-link"
                            onClick={() => handleCopyLink(contract.url)}
                            style={{ marginLeft: '10px' }}
                        >
                            <ContentCopyIcon />
                        </IconButton>
                    </ListItem>
                ))}
            </List>

            {/* SECCIÓN DE CONTRATOS LLENADOS */}
            <Divider style={{ margin: '40px 0' }} />
            <Typography variant="h5" gutterBottom>
                Contratos Llenos
            </Typography>

            {/* Barra de Búsqueda */}
            <Box display="flex" justifyContent="flex-end" mb={2}>
                <TextField
                    label="Buscar Contratos Llenados"
                    variant="outlined"
                    size="small"
                    value={filledContractsSearch}
                    onChange={(e) => setFilledContractsSearch(e.target.value)}
                    style={{ width: '300px' }}
                />
            </Box>

            {/* Lista de Contratos Llenados */}
            {filledContractsLoading ? (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <List>
                    {filledContracts.length === 0 ? (
                        <Typography variant="body1">No se encontraron contratos llenados.</Typography>
                    ) : (
                        filledContracts
                            .filter(fc => {
                                // Filtrado en el frontend basado en la búsqueda
                                const searchLower = filledContractsSearch.toLowerCase();
                                return (
                                    fc.title.toLowerCase().includes(searchLower) ||
                                    fc.contract.title.toLowerCase().includes(searchLower)
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
                                    <IconButton
                                        edge="end"
                                        aria-label="delete-filled-contract"
                                        onClick={() => handleOpenDeleteDialog(filledContract)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </ListItem>
                            ))
                    )}
                </List>
            )}

            {/* Controles de Paginación */}
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

            {/* DIALOGO: CREAR/EDITAR CONTRATO (ADMIN) */}
            <Dialog open={openEditor} onClose={handleCloseEditor} maxWidth="lg" fullWidth>
                <DialogTitle>
                    {currentContract ? 'Editar Contrato' : 'Crear Contrato'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2}>
                        {/* Panel izquierdo: Editor */}
                        <Grid item xs={12} md={6} style={{ position: 'relative' }}>
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
                                <SimpleEditor
                                    editorData={editorData}
                                    setEditorData={setEditorData}
                                />
                            </ErrorBoundary>
                        </Grid>

                        {/* Panel derecho: Vista previa (admin) */}
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6">Vista Previa del Contrato</Typography>
                            <Divider style={{ margin: '10px 0' }} />
                            <div
                                style={{
                                    border: '1px solid #ccc',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    minHeight: '400px',
                                    backgroundColor: '#f9f9f9',
                                    overflowY: 'auto',
                                }}
                                id="contract-preview"
                            >
                                {renderContent(editorData)}
                            </div>
                        </Grid>
                    </Grid>

                    {/* Botones de Acción (admin) */}
                    <div style={{ marginTop: '20px', textAlign: 'right' }}>
                        <Button variant="contained" color="primary" onClick={handleSaveOrUpdate}>
                            {currentContract ? 'Actualizar Contrato' : 'Guardar Contrato'}
                        </Button>
                        <Button
                            variant="contained"
                            style={{ marginLeft: '10px' }}
                            onClick={handleCloseEditor}
                        >
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

            {/* DIALOGO: CONFIRMACIÓN DE ELIMINACIÓN */}
            <Dialog
                open={openDeleteDialog}
                onClose={handleCloseDeleteDialog}
            >
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

            {/* Snackbar para notificaciones */}
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
        </div>
    );

};

export default ContractsManagementPage;
