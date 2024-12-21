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
    Grid
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    CloudUpload as CloudUploadIcon,
    Link as LinkIcon
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

    // ---------------------------
    // Estados para CREAR/EDITAR
    // ---------------------------
    const [openEditor, setOpenEditor] = useState(false);
    const [currentContract, setCurrentContract] = useState(null);
    const [contractTitle, setContractTitle] = useState('');
    const [editorData, setEditorData] = useState('');

    // Para inputs/firma en la vista previa (admin)
    const signatureRefs = useRef({});
    const [formValues, setFormValues] = useState({});

    // ---------------------------
    // Estados para COMPARTIR
    // ---------------------------
    const [openShareDialog, setOpenShareDialog] = useState(false);
    const [sharedContractTitle, setSharedContractTitle] = useState('');
    const [sharedContractContent, setSharedContractContent] = useState('');
    const signatureRefsShare = useRef({});
    const [shareFormValues, setShareFormValues] = useState({});
    const [sharingContractUuid, setSharingContractUuid] = useState(null);

    const navigate = useNavigate();

    // =========================================================================
    //                  OBTENER CONTRATOS AL MONTAR
    // =========================================================================
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

    // =========================================================================
    //                      SUBIR ARCHIVO WORD
    // =========================================================================
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

    // =========================================================================
    //                CREAR O ACTUALIZAR CONTRATO (ADMIN)
    // =========================================================================
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

    // =========================================================================
    //                  EDITAR CONTRATO (ADMIN)
    // =========================================================================
    const handleEdit = (contract) => {
        setCurrentContract(contract);
        setContractTitle(contract.title);
        setEditorData(contract.content);
        setOpenEditor(true);
    };

    // =========================================================================
    //                 ELIMINAR CONTRATO (ADMIN)
    // =========================================================================
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

    // =========================================================================
    //                  CERRAR EDITOR DE CONTRATO
    // =========================================================================
    const handleCloseEditor = () => {
        setOpenEditor(false);
        setCurrentContract(null);
        setContractTitle('');
        setEditorData('');
        signatureRefs.current = {};
        setFormValues({});
    };

    // =========================================================================
    //              CERRAR SNACKBAR DE NOTIFICACIONES
    // =========================================================================
    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // =========================================================================
    //         VER CONTRATO (ADMIN) - EJEMPLO DE VISTA PREVIA
    // =========================================================================
    const handleViewContract = (contract) => {
        navigate(`/admin/contratos/${contract.uuid}`);
    };

    // =========================================================================
    //    GENERAR PDF (ADMIN) DE LA VISTA PREVIA
    // =========================================================================
    const handleGeneratePDF = async () => {
        // 1) contenedor temporal
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editorData;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.backgroundColor = '#fff';
        document.body.appendChild(tempDiv);

        // 2) Reemplazar firmas
        let filledContent = editorData;
        const signatureNames = Object.keys(signatureRefs.current);
        for (const name of signatureNames) {
            const pad = signatureRefs.current[name];
            if (pad && !pad.isEmpty()) {
                const dataUrl = pad.getTrimmedCanvas().toDataURL('image/png');
                filledContent = filledContent.replace(
                    new RegExp(`{{${name}:signature}}`, 'g'),
                    `<img src="${dataUrl}" alt="Firma" style="width:200px; height:100px;" />`
                );
            } else {
                filledContent = filledContent.replace(new RegExp(`{{${name}:signature}}`, 'g'), '');
            }
        }

        // 3) Reemplazar placeholders de texto
        const placeholderRegex = /{{(.*?):(.*?)}}/g;
        filledContent = filledContent.replace(placeholderRegex, (match, name) => {
            return formValues[name] || '';
        });

        tempDiv.innerHTML = filledContent;

        // 4) Generar PDF
        try {
            const canvas = await html2canvas(tempDiv, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${contractTitle}.pdf`);
        } catch (error) {
            console.error('Error generando el PDF:', error);
            setSnackbar({ open: true, message: 'Hubo un error al generar el PDF.', severity: 'error' });
        }

        document.body.removeChild(tempDiv);
    };

    // =========================================================================
    //    EXTRAER PLACEHOLDERS ({{nombre:tipo}})
    // =========================================================================
    const extractPlaceholders = (content) => {
        const regex = /{{(.*?):(.*?)}}/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push({ name: match[1], type: match[2] });
        }
        // Eliminar duplicados
        return Array.from(new Set(matches.map(JSON.stringify))).map(JSON.parse);
    };

    // =========================================================================
    //     MANEJADORES DE INPUTS (ADMIN - VISTA PREVIA)
    // =========================================================================
    const handleChange = (name, value) => {
        setFormValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // =========================================================================
    //     PARSEAR CONTENIDO -> INPUTS (ADMIN - VISTA PREVIA)
    // =========================================================================
    const renderContent = (html) => {
        const placeholderRegex = /{{(.*?):(.*?)}}/g;
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
                                <span
                                    key={`sig-${name}-${match.index}`}
                                    style={{
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                        margin: '0 5px',
                                        border: '1px dashed #888',
                                        width: '300px',
                                        height: '100px',
                                        position: 'relative'
                                    }}
                                >
                                    <SignatureCanvas
                                        penColor="black"
                                        canvasProps={{
                                            width: 300,
                                            height: 100,
                                            style: { display: 'block' }
                                        }}
                                        ref={(canvasRef) => {
                                            if (canvasRef && !signatureRefs.current[name]) {
                                                signatureRefs.current[name] = canvasRef;
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                            if (signatureRefs.current[name]) {
                                                signatureRefs.current[name].clear();
                                            }
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '5px',
                                            right: '5px'
                                        }}
                                    >
                                        Limpiar
                                    </Button>
                                </span>
                            );
                        } else {
                            segments.push(
                                <TextField
                                    key={`field-${name}-${match.index}`}
                                    type={type}
                                    placeholder={name}
                                    value={formValues[name] || ''}
                                    onChange={(e) => handleChange(name, e.target.value)}
                                    style={{
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                        margin: '0 5px',
                                        width: 'auto'
                                    }}
                                />
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }

                    const remainingText = originalText.slice(lastIndex);
                    if (remainingText) {
                        segments.push(remainingText);
                    }

                    return <React.Fragment>{segments}</React.Fragment>;
                }
            },
        });
    };

    // =========================================================================
    //    AL CAMBIAR EDITOR, INICIALIZAR FORM (ADMIN)
    // =========================================================================
    useEffect(() => {
        if (currentContract) {
            const placeholders = extractPlaceholders(editorData);
            const initialValues = {};
            placeholders.forEach((ph) => {
                if (ph.type !== 'signature') {
                    initialValues[ph.name] = '';
                }
            });
            setFormValues(initialValues);
        }
    }, [editorData, currentContract]);

    // =========================================================================
    //                COMPARTIR CONTRATO - ABRIR DIALOG
    // =========================================================================
    const handleShare = async (contract) => {
        try {
            const res = await api.get(`/contracts/share/${contract.uuid}`);
            setSharedContractTitle(res.data.title);
            setSharedContractContent(res.data.content);
            setSharingContractUuid(contract.uuid);
            initShareFormValues(res.data.content);

            setOpenShareDialog(true);
        } catch (error) {
            console.error('Error cargando contrato compartido:', error);
            setSnackbar({
                open: true,
                message: 'No se pudo cargar el contrato para compartir.',
                severity: 'error'
            });
        }
    };

    // Inicializa placeholders del modo "compartir"
    const initShareFormValues = (html) => {
        const placeholders = extractPlaceholders(html);
        const initialValues = {};
        placeholders.forEach((ph) => {
            if (ph.type !== 'signature') {
                initialValues[ph.name] = '';
            }
        });
        setShareFormValues(initialValues);
        signatureRefsShare.current = {};
    };

    // =========================================================================
    //   CERRAR DIALOG DE COMPARTIR
    // =========================================================================
    const handleCloseShareDialog = () => {
        setOpenShareDialog(false);
        setSharedContractTitle('');
        setSharedContractContent('');
        setSharingContractUuid(null);
        signatureRefsShare.current = {};
        setShareFormValues({});
    };

    // =========================================================================
    //   PARSEAR CONTENIDO -> INPUTS (MODO COMPARTIR)
    // =========================================================================
    const renderSharedContent = (html) => {
        const placeholderRegex = /{{(.*?):(.*?)}}/g;
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
                                <span
                                    key={`sig-share-${name}-${match.index}`}
                                    style={{
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                        margin: '0 5px',
                                        border: '1px dashed #888',
                                        width: '300px',
                                        height: '100px',
                                        position: 'relative'
                                    }}
                                >
                                    <SignatureCanvas
                                        penColor="black"
                                        canvasProps={{
                                            width: 300,
                                            height: 100,
                                            style: { display: 'block' }
                                        }}
                                        ref={(canvasRef) => {
                                            if (canvasRef && !signatureRefsShare.current[name]) {
                                                signatureRefsShare.current[name] = canvasRef;
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                            if (signatureRefsShare.current[name]) {
                                                signatureRefsShare.current[name].clear();
                                            }
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '5px',
                                            right: '5px'
                                        }}
                                    >
                                        Limpiar
                                    </Button>
                                </span>
                            );
                        } else {
                            segments.push(
                                <input
                                    key={`field-share-${name}-${match.index}`}
                                    type={type}
                                    placeholder={name}
                                    value={shareFormValues[name] || ''}
                                    onChange={(e) =>
                                        setShareFormValues((prev) => ({
                                            ...prev,
                                            [name]: e.target.value
                                        }))
                                    }
                                    style={{
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                        margin: '0 5px',
                                        width: 'auto'
                                    }}
                                />
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }

                    const remainingText = originalText.slice(lastIndex);
                    if (remainingText) {
                        segments.push(remainingText);
                    }

                    return <React.Fragment>{segments}</React.Fragment>;
                }
            },
        });
    };

    // =========================================================================
    //    ACEPTAR CONTRATO (MODO COMPARTIR) => GENERA PDF Y ENVÍA AL BACKEND
    // =========================================================================
    const handleAcceptShared = async () => {
        // 1) Generar PDF local
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sharedContractContent;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.backgroundColor = '#fff';
        document.body.appendChild(tempDiv);

        // Reemplazar firmas
        let filledContent = sharedContractContent;
        for (const name of Object.keys(signatureRefsShare.current)) {
            const pad = signatureRefsShare.current[name];
            if (pad && !pad.isEmpty()) {
                const dataUrl = pad.getTrimmedCanvas().toDataURL('image/png');
                filledContent = filledContent.replace(
                    new RegExp(`{{${name}:signature}}`, 'g'),
                    `<img src="${dataUrl}" alt="Firma" style="width:200px; height:100px;" />`
                );
            } else {
                filledContent = filledContent.replace(new RegExp(`{{${name}:signature}}`, 'g'), '');
            }
        }

        // Reemplazar campos de texto
        const placeholderRegex = /{{(.*?):(.*?)}}/g;
        filledContent = filledContent.replace(placeholderRegex, (match, fieldName, fieldType) => {
            return shareFormValues[fieldName] || '';
        });
        tempDiv.innerHTML = filledContent;

        let pdfBase64 = '';
        try {
            const canvas = await html2canvas(tempDiv, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            // Obtenemos PDF en Base64
            pdfBase64 = pdf.output('datauristring');
        } catch (error) {
            console.error('Error generando PDF:', error);
            setSnackbar({
                open: true,
                message: 'No se pudo generar el PDF.',
                severity: 'error'
            });
        }
        document.body.removeChild(tempDiv);

        if (!pdfBase64) return;

        // 2) Enviar PDF a /contracts/share/:uuid/finalize
        try {
            await api.post(`/contracts/share/${sharingContractUuid}/finalize`, { pdfBase64 });
            setSnackbar({
                open: true,
                message: 'Contrato compartido llenado, PDF enviado (placeholder GCS).',
                severity: 'success'
            });
            handleCloseShareDialog();
        } catch (error) {
            console.error('Error finalizando contrato:', error);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al enviar el PDF.',
                severity: 'error'
            });
        }
    };

    // =========================================================================
    //                            RENDER
    // =========================================================================
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
                            secondary={`Link para compartir: ${contract.url}`}
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
                            startIcon={<LinkIcon />}
                            style={{ marginLeft: '10px' }}
                        >
                            Vista Previa
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            onClick={() => handleShare(contract)}
                            style={{ marginLeft: '10px' }}
                        >
                            Compartir Contrato
                        </Button>
                    </ListItem>
                ))}
            </List>

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

            {/* DIALOGO: COMPARTIR CONTRATO (HTML RELLENABLE) */}
            <Dialog open={openShareDialog} onClose={handleCloseShareDialog} maxWidth="md" fullWidth>
                <DialogTitle>Contrato Compartido</DialogTitle>
                <DialogContent>
                    <Typography variant="h6" gutterBottom>
                        {sharedContractTitle}
                    </Typography>
                    <Divider style={{ marginBottom: '10px' }} />
                    <div
                        style={{
                            border: '1px solid #ccc',
                            padding: '10px',
                            borderRadius: '4px',
                            minHeight: '300px',
                            backgroundColor: '#f9f9f9',
                            marginBottom: '20px'
                        }}
                    >
                        {renderSharedContent(sharedContractContent)}
                    </div>
                    <Typography variant="body2" color="textSecondary">
                        *Rellene los campos y firme en los espacios indicados.
                    </Typography>
                </DialogContent>
                <div style={{ margin: '20px', textAlign: 'right' }}>
                    <Button variant="contained" onClick={handleAcceptShared}>
                        Aceptar
                    </Button>
                    <Button variant="outlined" style={{ marginLeft: '10px' }} onClick={handleCloseShareDialog}>
                        Cancelar
                    </Button>
                </div>
            </Dialog>

            {/* Snackbar para notificaciones */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default ContractsManagementPage;
