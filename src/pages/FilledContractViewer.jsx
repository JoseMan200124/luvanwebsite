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

    // Aunque aquí no hay inputs que llenar (el contrato ya está lleno),
    // conservamos la referencia de firma por consistencia
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
                    message: 'No se pudo cargar el contrato llenado. Verifica el enlace.',
                    severity: 'error'
                });
                setLoading(false);
            }
        };
        fetchFilledContract();
    }, [uuid]);

    // Renderizamos el contenido (con firmas y textos ya llenos)
    const renderContent = (content) => {
        // Soporta {text|signature|date|number} pero ya vienen con data en filledContract.filledData
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

                        // Texto antes del placeholder
                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        if (type === 'signature') {
                            // Mostramos la firma si existe en filledContract.filledData
                            const signatureDataUrl =
                                filledContract?.filledData[`${nameTrim}_signature`] || '';
                            if (signatureDataUrl) {
                                segments.push(
                                    <div
                                        key={`sig-${nameTrim}-${match.index}`}
                                        style={{
                                            display: 'block',
                                            margin: '20px 0',
                                            clear: 'both'
                                        }}
                                    >
                                        <img
                                            src={signatureDataUrl}
                                            alt={`Firma de ${nameTrim}`}
                                            style={{
                                                width: '200px',
                                                height: '100px',
                                                border: '1px solid #000'
                                            }}
                                        />
                                    </div>
                                );
                            } else {
                                // Si no hay firma, solo un texto
                                segments.push(
                                    <div
                                        key={`sig-placeholder-${nameTrim}-${match.index}`}
                                        style={{
                                            display: 'block',
                                            margin: '20px 0',
                                            clear: 'both',
                                            border: '1px solid #000',
                                            width: '200px',
                                            height: '100px'
                                        }}
                                    >
                                        <Typography variant="subtitle1" gutterBottom>
                                            {nameTrim}
                                        </Typography>
                                    </div>
                                );
                            }
                        } else {
                            // Campos text, date, number => se muestran con su valor
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

                    // Texto restante después del último placeholder
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

    // Generamos PDF a partir del contenido ya "llenado"
    const handleGeneratePDF = async () => {
        if (!filledContract) return;

        const previewDiv = document.getElementById('contract-preview');
        if (!previewDiv) return;

        // Clone the preview div off-screen without any overflow/height constraints
        // so html2canvas captures the full content, not just the visible scroll area.
        const clone = previewDiv.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.top = '-99999px';
        clone.style.left = '-99999px';
        clone.style.width = previewDiv.scrollWidth + 'px';
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        document.body.appendChild(clone);

        try {
            const canvas = await html2canvas(clone, { scale: 2, useCORS: true });
            document.body.removeChild(clone);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();

            // How many canvas pixels correspond to one PDF mm
            const pxPerMm = canvas.width / pdfWidth;
            const pageHeightPx = Math.floor(pdfPageHeight * pxPerMm);
            const ctx = canvas.getContext('2d');

            // Finds the nearest row above `ideal` that is mostly white,
            // so we never split a page mid-character.
            const findSplitRow = (ideal) => {
                const scanDistance = Math.floor(40 * pxPerMm); // scan up to ~40 mm upward
                const threshold = 0.97; // 97 % of pixels must be near-white
                for (let y = ideal; y > ideal - scanDistance && y > 0; y--) {
                    const { data } = ctx.getImageData(0, y, canvas.width, 1);
                    let whiteCount = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) whiteCount++;
                    }
                    if (whiteCount / (canvas.width) >= threshold) return y;
                }
                return ideal; // fallback: use the ideal boundary as-is
            };

            let offsetY = 0;
            let pageIndex = 0;

            while (offsetY < canvas.height) {
                const idealSplit = offsetY + pageHeightPx;
                const splitY =
                    idealSplit >= canvas.height
                        ? canvas.height
                        : findSplitRow(idealSplit);

                const sliceHeightPx = splitY - offsetY;
                const sliceHeightMm = sliceHeightPx / pxPerMm;

                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeightPx;
                pageCanvas
                    .getContext('2d')
                    .drawImage(canvas, 0, offsetY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

                if (pageIndex > 0) pdf.addPage();
                pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, sliceHeightMm);

                offsetY = splitY;
                pageIndex++;
            }

            pdf.save(`${filledContract.title}.pdf`);
            setSnackbar({ open: true, message: 'PDF generado exitosamente.', severity: 'success' });
        } catch (error) {
            if (document.body.contains(clone)) document.body.removeChild(clone);
            console.error('Error generando el PDF:', error);
            setSnackbar({ open: true, message: 'Hubo un error al generar el PDF.', severity: 'error' });
        }
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
