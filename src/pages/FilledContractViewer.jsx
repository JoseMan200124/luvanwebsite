// src/pages/FilledContractViewer.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/axiosConfig';
import {
    Button,
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

const FilledContractViewer = () => {
    const { uuid } = useParams();
    const [filledContract, setFilledContract] = useState(null);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const signaturePads = useRef({});

    useEffect(() => {
        const fetchFilledContract = async () => {
            try {
                const response = await api.get(`/contracts/filled/${uuid}`);
                setFilledContract(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error al obtener el contrato llenado:', error);
                setSnackbar({
                    open: true,
                    message: 'No se pudo cargar el contrato llenado. Por favor, verifica el enlace.',
                    severity: 'error'
                });
                setLoading(false);
            }
        };

        fetchFilledContract();
    }, [uuid]);

    // Extraer placeholders
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

    // Función para renderizar el contenido con los datos llenados
    const renderContent = (content) => {
        return parse(content, {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const text = domNode.data;
                    const placeholderRegex = /{{\s*([^:{}\s]+)\s*:\s*(text|signature|date)\s*}}/g;
                    const segments = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = placeholderRegex.exec(text)) !== null) {
                        const [fullMatch, name, type] = match;
                        const beforeText = text.substring(lastIndex, match.index);
                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        if (type === 'signature') {
                            // Mostrar la imagen de la firma si existe
                            const signatureDataUrl = filledContract.filledData[`${name}_signature`];
                            if (signatureDataUrl) {
                                segments.push(
                                    <img
                                        key={`sig-${name}-${match.index}`}
                                        src={signatureDataUrl}
                                        alt={`Firma de ${name}`}
                                        style={{ width: '200px', height: '100px', border: '1px solid #000', margin: '10px 0' }}
                                    />
                                );
                            } else {
                                segments.push(
                                    <Typography key={`sig-placeholder-${name}-${match.index}`} variant="subtitle1" gutterBottom>
                                        {name}
                                    </Typography>
                                );
                            }
                        } else if (type === 'text' || type === 'date') {
                            const value = filledContract.filledData[name] || '';
                            segments.push(
                                <Typography
                                    key={`field-${name}-${match.index}`}
                                    variant="body1"
                                    style={{ display: 'inline-block', minWidth: '150px', borderBottom: '1px solid #000', margin: '0 5px' }}
                                >
                                    {value}
                                </Typography>
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }

                    const remainingText = text.substring(lastIndex);
                    if (remainingText) {
                        segments.push(remainingText);
                    }

                    return <React.Fragment key={`fragment-${domNode.key}`}>{segments}</React.Fragment>;
                }
            },
        });
    };

    // Manejar generación y descarga de PDF
    const handleGeneratePDF = async () => {
        if (!filledContract) return;

        // Crear un div temporal para renderizar el contenido
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = filledContract.content;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.backgroundColor = '#fff';
        document.body.appendChild(tempDiv);

        // Reemplazar placeholders con datos llenados
        const filledContent = renderContent(filledContract.content);

        // Generar PDF usando html2canvas y jsPDF
        try {
            const canvas = await html2canvas(tempDiv, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${filledContract.title}.pdf`);
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

    if (loading) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <CircularProgress />
            </div>
        );
    }

    if (!filledContract) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <Typography variant="h6">Contrato llenado no encontrado.</Typography>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <Typography variant="h4" gutterBottom>
                {filledContract.title}
            </Typography>
            <Divider style={{ marginBottom: '20px' }} />
            <ErrorBoundary>
                <Grid container spacing={2}>
                    {/* Contenido del Contrato */}
                    <Grid item xs={12} md={6}>
                        <div id="contract-content">
                            {renderContent(filledContract.content)}
                        </div>
                    </Grid>

                    {/* Vista Previa */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6">Vista Previa del Contrato Llenado</Typography>
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
                            {renderContent(filledContract.content)}
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

export default FilledContractViewer;
