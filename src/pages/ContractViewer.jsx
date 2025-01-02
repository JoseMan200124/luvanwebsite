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

const ContractViewer = () => {
    const { uuid } = useParams();
    const [contract, setContract] = useState(null);
    const [formValues, setFormValues] = useState({});
    const [loading, setLoading] = useState(true);
    const sigCanvasRefs = useRef({});
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

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

    useEffect(() => {
        if (contract) {
            const placeholders = extractPlaceholders(contract.content);
            const initVals = {};
            placeholders.forEach((ph) => {
                if (ph.type !== 'signature') {
                    initVals[ph.name] = '';
                }
            });
            setFormValues(initVals);
        }
    }, [contract]);

    // Soportamos text, signature, date, number
    const extractPlaceholders = (content) => {
        const regex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
        const result = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const nameTrim = match[1].trim();
            result.push({ name: nameTrim, type: match[2] });
        }
        return Array.from(new Set(result.map(JSON.stringify))).map(JSON.parse);
    };

    const handleChange = (name, value) => {
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleGeneratePDF = async () => {
        if (!contract) return;

        let filledContent = contract.content;

        // Reemplazar firmas
        Object.keys(sigCanvasRefs.current).forEach((name) => {
            const pad = sigCanvasRefs.current[name];
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (pad && !pad.isEmpty()) {
                const dataUrl = pad.getTrimmedCanvas().toDataURL('image/png');
                filledContent = filledContent.replace(
                    new RegExp(`{{\\s*${escapedName}\\s*:\\s*signature\\s*}}`, 'g'),
                    `<img src="${dataUrl}" alt="Firma" style="width:200px; height:100px;" />`
                );
            } else {
                // Eliminar
                filledContent = filledContent.replace(
                    new RegExp(`{{\\s*${escapedName}\\s*:\\s*signature\\s*}}`, 'g'),
                    ''
                );
            }
        });

        // Reemplazar text/date/number
        const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
        filledContent = filledContent.replace(placeholderRegex, (all, rawName, type) => {
            const nameTrim = rawName.trim();
            if (type === 'text' || type === 'date' || type === 'number') {
                return formValues[nameTrim] || '';
            }
            return all; // signature ya se manejó arriba
        });

        // Generar PDF
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
            pdf.save(`${contract.title}.pdf`);
        } catch (err) {
            console.error('Error generando PDF:', err);
            setSnackbar({
                open: true,
                message: 'Hubo un error al generar el PDF.',
                severity: 'error'
            });
        }

        document.body.removeChild(tempDiv);
    };

    // Render placeholders
    const renderContent = (content) => {
        const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;

        return parse(content, {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const txt = domNode.data;
                    const segments = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = placeholderRegex.exec(txt)) !== null) {
                        const [full, rawName, type] = match;
                        const nameTrim = rawName.trim();

                        const beforeText = txt.substring(lastIndex, match.index);
                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        if (type === 'signature') {
                            segments.push(
                                <div
                                    key={`sig-${nameTrim}-${match.index}`}
                                    style={{
                                        border: '1px solid #000',
                                        width: '300px',
                                        height: '150px',
                                        margin: '10px 0'
                                    }}
                                >
                                    <Typography variant="subtitle1" gutterBottom>
                                        {nameTrim}
                                    </Typography>
                                    <SignatureCanvas
                                        penColor="black"
                                        canvasProps={{ width: 300, height: 150 }}
                                        ref={(ref) => {
                                            if (ref) {
                                                sigCanvasRefs.current[nameTrim] = ref;
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            if (sigCanvasRefs.current[nameTrim]) {
                                                sigCanvasRefs.current[nameTrim].clear();
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
                                        background: 'transparent',
                                        verticalAlign: 'baseline'
                                    }}
                                />
                            );
                        }

                        lastIndex = match.index + full.length;
                    }

                    const remainder = txt.substring(lastIndex);
                    if (remainder) {
                        segments.push(remainder);
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
                    {/* Contenido */}
                    <Grid item xs={12} md={6}>
                        <div id="contract-content">
                            {renderContent(contract.content)}
                        </div>
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
