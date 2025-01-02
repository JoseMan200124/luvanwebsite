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
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Aunque aquí no hay inputs que llenar (ya está “llenado”), mantenemos la referencia por consistencia
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

    // Renderizar el contenido con los datos en filledContract.filledData
    const renderContent = (content) => {
        // Admite los tipos: text, signature, date, number
        const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;

        return parse(content, {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const text = domNode.data;
                    const segments = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = placeholderRegex.exec(text)) !== null) {
                        const [fullMatch, rawName, type] = match;
                        const nameTrim = rawName.trim();
                        const beforeText = text.substring(lastIndex, match.index);

                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        // Si es firma, text, date, number
                        if (type === 'signature') {
                            // Mostrar la firma si existe
                            const signatureDataUrl =
                                filledContract?.filledData[`${nameTrim}_signature`] || '';
                            if (signatureDataUrl) {
                                segments.push(
                                    <img
                                        key={`sig-${nameTrim}-${match.index}`}
                                        src={signatureDataUrl}
                                        alt={`Firma de ${nameTrim}`}
                                        style={{
                                            width: '200px',
                                            height: '100px',
                                            border: '1px solid #000',
                                            margin: '10px 0'
                                        }}
                                    />
                                );
                            } else {
                                segments.push(
                                    <Typography
                                        key={`sig-placeholder-${nameTrim}-${match.index}`}
                                        variant="subtitle1"
                                        gutterBottom
                                    >
                                        {nameTrim}
                                    </Typography>
                                );
                            }
                        } else {
                            // text, date, number → mostramos valor
                            const value = filledContract?.filledData[nameTrim] || '';
                            segments.push(
                                <Typography
                                    key={`field-${nameTrim}-${match.index}`}
                                    variant="body1"
                                    style={{
                                        display: 'inline-block',
                                        minWidth: '150px',
                                        borderBottom: '1px solid #000',
                                        margin: '0 5px'
                                    }}
                                >
                                    {value}
                                </Typography>
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }
                    // Resto del texto
                    const remainingText = text.substring(lastIndex);
                    if (remainingText) {
                        segments.push(remainingText);
                    }

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

    const handleGeneratePDF = async () => {
        if (!filledContract) return;

        // Crear un div temporal con el contenido
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = filledContract.content;
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
                    <Grid item xs={12} md={6}>
                        <div id="contract-content">
                            {renderContent(filledContract.content)}
                        </div>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6">Vista Previa del Contrato Llenado</Typography>
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
