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
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Crear/Editar
    const [openEditor, setOpenEditor] = useState(false);
    const [currentContract, setCurrentContract] = useState(null);
    const [contractTitle, setContractTitle] = useState('');
    const [editorData, setEditorData] = useState('');

    // Manejo de placeholders en vista previa
    const signatureRefs = useRef({});
    const [formValues, setFormValues] = useState({});

    const navigate = useNavigate();

    // Contratos Llenados (paginación, búsqueda)
    const [filledContracts, setFilledContracts] = useState([]);
    const [filledContractsLoading, setFilledContractsLoading] = useState(false);
    const [filledContractsPage, setFilledContractsPage] = useState(1);
    const [filledContractsLimit] = useState(10);
    const [filledContractsTotalPages, setFilledContractsTotalPages] = useState(1);
    const [filledContractsSearch, setFilledContractsSearch] = useState('');

    // Cargar lista de contratos
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

    // Cargar lista de contratos llenos (paginados)
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

    // Subir archivo Word y convertirlo a HTML
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

    // Crear o actualizar un contrato
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
                    content: editorData
                });
            } else {
                // Crear
                response = await api.post('/contracts', {
                    title: contractTitle,
                    content: editorData
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
                // Actualizamos en la lista
                setContracts((prev) =>
                    prev.map((c) => (c.id === currentContract.id ? savedContract : c))
                );
                setSnackbar({
                    open: true,
                    message: 'Contrato actualizado exitosamente.',
                    severity: 'success'
                });
            } else {
                // Agregamos al final
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

    // Editar
    const handleEdit = (contract) => {
        setCurrentContract(contract);
        setContractTitle(contract.title);
        setEditorData(contract.content);
        setOpenEditor(true);
    };

    // Eliminar
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

    // Cerrar el diálogo de creación/edición
    const handleCloseEditor = () => {
        setOpenEditor(false);
        setCurrentContract(null);
        setContractTitle('');
        setEditorData('');
        signatureRefs.current = {};
        setFormValues({});
    };

    // Copiar link de un contrato
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

    // Extraer placeholders (text|signature|date|number)
    const extractPlaceholders = (content) => {
        const regex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
        const out = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const nameTrim = match[1].trim();
            out.push({ name: nameTrim, type: match[2] });
        }
        // Elimina duplicados
        return Array.from(new Set(out.map(JSON.stringify))).map(JSON.parse);
    };

    const handleChange = (name, value) => {
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleSignature = (name, ref) => {
        signatureRefs.current[name] = ref;
    };

    // Ir a la vista de un contrato en particular
    const handleViewContract = (contract) => {
        navigate(`/admin/contratos/${contract.uuid}`);
    };

    // Renderizar contenido con placeholders
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

                        // Texto antes del placeholder
                        const beforeText = txt.slice(lastIndex, match.index);
                        if (beforeText) segments.push(beforeText);

                        if (type === 'signature') {
                            segments.push(
                                <div
                                    key={`sig-${nameTrim}-${match.index}`}
                                    style={{
                                        display: 'block',
                                        margin: '20px 0',
                                        clear: 'both'
                                    }}
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
                                    type={
                                        type === 'date'
                                            ? 'date'
                                            : type === 'number'
                                                ? 'number'
                                                : 'text'
                                    }
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

                    // Resto del texto después del placeholder
                    const remainder = txt.slice(lastIndex);
                    if (remainder) segments.push(remainder);

                    if (segments.length > 0) {
                        return (
                            <React.Fragment key={`fragment-${domNode.key}`}>
                                {segments}
                            </React.Fragment>
                        );
                    }
                }
            }
        });
    };

    // Eliminar un contrato llenado
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

    // Generar PDF de la vista previa (lo que hay en editorData + placeholders)
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

        // Reemplazamos placeholders con firmas o texto
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
                    // Placeholder vacío => lo borramos
                    filledContent = filledContent.replace(
                        new RegExp(`{{\\s*${ph.name}\\s*:\\s*signature\\s*}}`, 'g'),
                        ''
                    );
                }
            } else {
                // text|date|number
                filledContent = filledContent.replace(
                    new RegExp(`{{\\s*${ph.name}\\s*:\\s*${ph.type}\\s*}}`, 'g'),
                    formValues[ph.name] || ''
                );
            }
        });

        // Crear div temporal y generar PDF
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

            {/* Lista de contratos */}
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
                    style={{ width: '300px' }}
                />
            </Box>

            {filledContractsLoading ? (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <List>
                    {filledContracts.length === 0 ? (
                        <Typography variant="body1">
                            No se encontraron contratos llenados.
                        </Typography>
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
                                                    Fecha de Creación:{' '}
                                                    {new Date(filledContract.createdAt).toLocaleString()}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    Contrato Original:{' '}
                                                    {filledContract.contract.title}
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
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleOpenDeleteDialog(filledContract)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </ListItem>
                            ))
                    )}
                </List>
            )}

            {/* Paginación si hay varias páginas */}
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

            {/* Diálogo Crear/Editar Contrato */}
            <Dialog open={openEditor} onClose={handleCloseEditor} maxWidth="lg" fullWidth>
                <DialogTitle>
                    {currentContract ? 'Editar Contrato' : 'Crear Contrato'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2}>
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
