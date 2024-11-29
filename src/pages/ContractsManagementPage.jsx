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
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    CloudUpload as CloudUploadIcon,
    Link as LinkIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import SimpleEditor from './SimpleEditor';
import axios from 'axios';
import mammoth from 'mammoth';
import ErrorBoundary from '../components/ErrorBoundary';
import parse from 'html-react-parser';
import SignatureCanvas from 'react-signature-canvas';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ContractsManagementPage = () => {
    const [contracts, setContracts] = useState([]);
    const [openEditor, setOpenEditor] = useState(false);
    const [currentContract, setCurrentContract] = useState(null);
    const [contractTitle, setContractTitle] = useState('');
    const [editorData, setEditorData] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [signaturePads, setSignaturePads] = useState({});
    const sigCanvasRefs = useRef({});

    const navigate = useNavigate();

    // Función para obtener todos los contratos al cargar el componente
    useEffect(() => {
        const fetchContracts = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/contracts');
                setContracts(response.data);
            } catch (error) {
                console.error('Error al obtener los contratos:', error);
                setSnackbar({ open: true, message: 'Error al obtener los contratos.', severity: 'error' });
            }
        };

        fetchContracts();
    }, []);

    // Función para manejar la subida y conversión de documentos Word
    const handleWordUpload = async (event) => {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.docx')) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                const html = result.value;

                // Configura el editor con el HTML convertido
                setEditorData(html);
            } catch (error) {
                console.error('Error converting Word document:', error);
                setSnackbar({ open: true, message: 'Hubo un error al convertir el documento de Word. Por favor, inténtelo de nuevo.', severity: 'error' });
            }
        } else {
            setSnackbar({ open: true, message: 'Por favor, suba un archivo de Word (.docx) válido.', severity: 'warning' });
        }

        event.target.value = null;
    };

    // Función para guardar o actualizar un contrato
    const handleSaveOrUpdate = async () => {
        if (!contractTitle.trim()) {
            setSnackbar({ open: true, message: 'Por favor, ingrese un título para el contrato.', severity: 'warning' });
            return;
        }

        try {
            let response;
            if (currentContract) {
                // Actualizar contrato existente
                response = await axios.put(`http://localhost:5000/api/contracts/${currentContract.uuid}`, {
                    title: contractTitle,
                    content: editorData,
                });
            } else {
                // Guardar nuevo contrato
                response = await axios.post('http://localhost:5000/api/contracts', {
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
                url,
            };

            if (currentContract) {
                setContracts(contracts.map((c) => (c.id === currentContract.id ? savedContract : c)));
                setSnackbar({ open: true, message: 'Contrato actualizado exitosamente.', severity: 'success' });
            } else {
                setContracts([...contracts, savedContract]);
                setSnackbar({ open: true, message: 'Contrato guardado exitosamente.', severity: 'success' });
            }

            handleCloseEditor();
        } catch (error) {
            console.error('Error al guardar/actualizar el contrato:', error);
            setSnackbar({ open: true, message: 'Error al guardar/actualizar el contrato.', severity: 'error' });
        }
    };

    // Función para editar un contrato existente
    const handleEdit = (contract) => {
        setCurrentContract(contract);
        setContractTitle(contract.title);
        setEditorData(contract.content);
        setOpenEditor(true);
    };

    // Función para eliminar un contrato
    const handleDelete = async (contractUuid) => {
        if (window.confirm('¿Está seguro de que desea eliminar este contrato?')) {
            try {
                await axios.delete(`http://localhost:5000/api/contracts/${contractUuid}`);
                setContracts(contracts.filter((c) => c.uuid !== contractUuid));
                setSnackbar({ open: true, message: 'Contrato eliminado exitosamente.', severity: 'info' });
            } catch (error) {
                console.error('Error al eliminar el contrato:', error);
                setSnackbar({ open: true, message: 'Error al eliminar el contrato.', severity: 'error' });
            }
        }
    };

    // Función para cerrar el editor de contratos
    const handleCloseEditor = () => {
        setOpenEditor(false);
        setContractTitle('');
        setEditorData('');
        setCurrentContract(null);
        setSignaturePads({});
    };

    // Función para cerrar el Snackbar de notificaciones
    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // Función para ver el contrato (vista previa)
    const handleViewContract = (contract) => {
        navigate(`/admin/contratos/${contract.uuid}`);
    };

    // Función para generar el PDF desde la vista previa
    const handleGeneratePDF = async () => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editorData;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.backgroundColor = '#fff';
        document.body.appendChild(tempDiv);

        // Reemplazar placeholders con los valores llenados
        let filledContent = editorData;

        // Obtener datos de las firmas
        for (const [name, pad] of Object.entries(signaturePads)) {
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

        // Reemplazar otros placeholders
        const placeholderRegex = /{{(.*?):(.*?)}}/g;
        filledContent = filledContent.replace(placeholderRegex, (match, name, type) => {
            return formValues[name] || '';
        });

        tempDiv.innerHTML = filledContent;

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
            setSnackbar({ open: true, message: 'Hubo un error al generar el PDF. Por favor, inténtelo de nuevo.', severity: 'error' });
        }

        document.body.removeChild(tempDiv);
    };

    // Función para extraer placeholders del contenido
    const extractPlaceholders = (content) => {
        const regex = /{{(.*?):(.*?)}}/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push({ name: match[1], type: match[2] });
        }
        return Array.from(new Set(matches.map(JSON.stringify))).map(JSON.parse); // Eliminar duplicados
    };

    // Función para manejar cambios en los campos de entrada
    const handleChange = (name, value) => {
        setFormValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Estado para los valores de los campos (excepto firmas)
    const [formValues, setFormValues] = useState({});

    // Actualizar los valores de los campos cuando cambia el contenido del editor
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

    // Función para manejar cambios en los campos de firma
    const handleSignatureChange = (name, pad) => {
        setSignaturePads((prev) => ({
            ...prev,
            [name]: pad,
        }));
    };

    // Función para renderizar el contenido con placeholders reemplazados
    const renderContent = (content) => {
        const options = {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const regex = /{{(.*?):(.*?)}}/g;
                    const text = domNode.data;
                    const segments = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = regex.exec(text)) !== null) {
                        const beforeText = text.substring(lastIndex, match.index);
                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        const [fullMatch, name, type] = match;
                        const key = `${name}_${type}_${match.index}`;

                        if (type === 'signature') {
                            segments.push(
                                <div key={key} style={{ border: '1px solid #000', width: '300px', height: '150px', margin: '10px 0' }}>
                                    <SignatureCanvas
                                        penColor="black"
                                        canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }}
                                        ref={(ref) => {
                                            if (ref) {
                                                sigCanvasRefs.current[name] = ref;
                                                handleSignatureChange(name, ref);
                                            }
                                        }}
                                    />
                                    <Button variant="outlined" onClick={() => sigCanvasRefs.current[name]?.clear()}>
                                        Limpiar Firma
                                    </Button>
                                </div>
                            );
                        } else {
                            segments.push(
                                <TextField
                                    key={key}
                                    label={name}
                                    type={type}
                                    value={formValues[name] || ''}
                                    onChange={(e) => handleChange(name, e.target.value)}
                                    style={{ margin: '10px 0' }}
                                    fullWidth
                                />
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }

                    const remainingText = text.substring(lastIndex);
                    if (remainingText) {
                        segments.push(remainingText);
                    }

                    if (segments.length === 1 && typeof segments[0] === 'string') {
                        return null; // No replacements needed, keep original text
                    }

                    return segments;
                }
            },
        };

        return parse(content, options);
    };

    return (
        <div style={{ padding: '20px' }}>
            <Typography variant="h4" gutterBottom>
                Gestión de Contratos
            </Typography>
            <Button variant="contained" color="primary" onClick={() => setOpenEditor(true)} startIcon={<CloudUploadIcon />}>
                Crear Nuevo Contrato
            </Button>
            <List>
                {contracts.map((contract) => (
                    <ListItem key={contract.id} divider>
                        <ListItemText primary={contract.title} />
                        <IconButton edge="end" aria-label="edit" onClick={() => handleEdit(contract)}>
                            <EditIcon />
                        </IconButton>
                        <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(contract.uuid)}>
                            <DeleteIcon />
                        </IconButton>
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => handleViewContract(contract)}
                            startIcon={<LinkIcon />}
                        >
                            Ver Contrato
                        </Button>
                    </ListItem>
                ))}
            </List>

            {/* Editor de Contratos */}
            <Dialog open={openEditor} onClose={handleCloseEditor} maxWidth="lg" fullWidth>
                <DialogTitle>{currentContract ? 'Editar Contrato' : 'Crear Contrato'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2}>
                        {/* Editor */}
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
                                    <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />}>
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

                        {/* Vista Previa */}
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

                    {/* Botones de Acción */}
                    <div style={{ marginTop: '20px', textAlign: 'right' }}>
                        <Button variant="contained" color="primary" onClick={handleSaveOrUpdate}>
                            {currentContract ? 'Actualizar Contrato' : 'Guardar Contrato'}
                        </Button>
                        <Button variant="contained" style={{ marginLeft: '10px' }} onClick={handleCloseEditor}>
                            Cancelar
                        </Button>
                        <Button variant="outlined" color="secondary" style={{ marginLeft: '10px' }} onClick={handleGeneratePDF}>
                            Generar PDF
                        </Button>
                    </div>
                </DialogContent>
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
