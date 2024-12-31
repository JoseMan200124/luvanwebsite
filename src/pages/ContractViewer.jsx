// src/pages/ContractViewer.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/axiosConfig';
import {
    Button,
    TextField,
    Typography,
    CircularProgress,
    Grid,
    Divider,
    Snackbar,
    Alert
} from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ErrorBoundary from '../components/ErrorBoundary';
import parse from 'html-react-parser';
import SignatureCanvas from 'react-signature-canvas';

const ContractViewer = () => {
    const { uuid } = useParams();
    const [contract, setContract] = useState(null);
    const [formValues, setFormValues] = useState({});
    const [loading, setLoading] = useState(true);
    const sigCanvasRefs = useRef({});
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Fetch the contract data on component mount
    useEffect(() => {
        const fetchContract = async () => {
            try {
                const response = await api.get(`/contracts/${uuid}`);
                setContract(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error al obtener el contrato:', error);
                setSnackbar({
                    open: true,
                    message: 'Error al obtener el contrato.',
                    severity: 'error'
                });
                setLoading(false);
            }
        };

        fetchContract();
    }, [uuid]);

    // Initialize form values based on placeholders
    useEffect(() => {
        if (contract) {
            const placeholders = extractPlaceholders(contract.content);
            const initialValues = {};
            placeholders.forEach((ph) => {
                if (ph.type !== 'signature') {
                    initialValues[ph.name] = '';
                }
            });
            setFormValues(initialValues);
        }
    }, [contract]);

    // Function to extract placeholders from the contract content
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

    // Handle changes in text/date inputs
    const handleChange = (name, value) => {
        setFormValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Handle PDF generation
    const handleGeneratePDF = async () => {
        if (!contract) return;

        let filledContent = contract.content;

        // Reemplazar firmas con imágenes
        const signatureNames = Object.keys(sigCanvasRefs.current);
        signatureNames.forEach((name) => {
            const pad = sigCanvasRefs.current[name];
            if (pad && !pad.isEmpty()) {
                const dataUrl = pad.getTrimmedCanvas().toDataURL('image/png');
                // Escapar caracteres especiales en el nombre para el regex
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                filledContent = filledContent.replace(
                    new RegExp(`{{\\s*${escapedName}\\s*:\\s*signature\\s*}}`, 'g'),
                    `<img src="${dataUrl}" alt="Firma" style="width:200px; height:100px;" />`
                );
            } else {
                // Eliminar el placeholder si no hay firma
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                filledContent = filledContent.replace(new RegExp(`{{\\s*${escapedName}\\s*:\\s*signature\\s*}}`, 'g'), '');
            }
        });

        // Reemplazar otros placeholders (text y date) con los valores ingresados
        const placeholderRegex = /{{\s*([^:{}\s]+)\s*:\s*(text|signature|date)\s*}}/g;
        filledContent = filledContent.replace(placeholderRegex, (match, name, type) => {
            if (type === 'text' || type === 'date') {
                return formValues[name] || '';
            }
            return match; // Dejar las firmas ya reemplazadas
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
            pdf.save(`${contract.title}.pdf`);
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

    // Función para renderizar el contenido con placeholders reemplazados por componentes
    const renderContent = (content) => {
        const placeholderRegex = /{{\s*([^:{}\s]+)\s*:\s*(text|signature|date)\s*}}/g;
        return parse(content, {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const text = domNode.data;
                    const segments = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = placeholderRegex.exec(text)) !== null) {
                        const [fullMatch, name, type] = match;
                        const beforeText = text.substring(lastIndex, match.index);
                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        // Generar una clave única para cada segmento
                        const key = `${name}_${type}_${match.index}`;

                        if (type === 'signature') {
                            segments.push(
                                <div key={key} style={{ border: '1px solid #000', width: '300px', height: '150px', margin: '10px 0' }}>
                                    <Typography variant="subtitle1" gutterBottom>{name}</Typography>
                                    <SignatureCanvas
                                        penColor="black"
                                        canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }}
                                        ref={(ref) => {
                                            if (ref && !sigCanvasRefs.current[name]) {
                                                sigCanvasRefs.current[name] = ref;
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            if (sigCanvasRefs.current[name]) {
                                                sigCanvasRefs.current[name].clear();
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
                                    key={key}
                                    label={name}
                                    type={type === 'date' ? 'date' : 'text'}
                                    InputLabelProps={type === 'date' ? { shrink: true } : {}}
                                    value={formValues[name] || ''}
                                    onChange={(e) => handleChange(name, e.target.value)}
                                    style={{ margin: '10px 0' }}
                                    fullWidth
                                    variant="outlined"
                                />
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }

                    const remainingText = text.substring(lastIndex);
                    if (remainingText) {
                        segments.push(remainingText);
                    }

                    // Si no se encontraron placeholders, no reemplazar
                    if (segments.length === 0) {
                        return null;
                    }

                    return (
                        <React.Fragment key={`fragment-${match ? match.index : 'no-match'}`}>
                            {segments.map((segment, index) =>
                                typeof segment === 'string' ? <span key={index}>{segment}</span> : segment
                            )}
                        </React.Fragment>
                    );
                }
            },
        });
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <CircularProgress />
            </div>
        );
    }

    if (!contract) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <Typography variant="h6">Contrato no encontrado.</Typography>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <Typography variant="h4" gutterBottom>
                {contract.title}
            </Typography>
            <ErrorBoundary>
                <Grid container spacing={2}>
                    {/* Contenido Editable */}
                    <Grid item xs={12} md={6}>
                        <div id="contract-content">
                            {renderContent(contract.content)}
                        </div>
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
                            {renderContent(contract.content)}
                        </div>
                    </Grid>
                </Grid>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGeneratePDF}
                    style={{ marginTop: '20px' }}
                >
                    Generar PDF
                </Button>
            </ErrorBoundary>
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

export default ContractViewer;
