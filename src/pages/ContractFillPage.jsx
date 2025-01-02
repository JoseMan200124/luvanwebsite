import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    Button,
    Typography,
    CircularProgress,
    Divider,
    Snackbar,
    Alert
} from '@mui/material';
import api from '../utils/axiosConfig';
import parse from 'html-react-parser';
import SignatureCanvas from 'react-signature-canvas';
import ErrorBoundary from '../components/ErrorBoundary';

const ContractFillPage = () => {
    const { uuid } = useParams();
    const [contract, setContract] = useState(null);
    const [filledData, setFilledData] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });
    const signaturePads = useRef({});

    useEffect(() => {
        const fetchContract = async () => {
            try {
                const response = await api.get(`/contracts/share/${uuid}`);
                setContract(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error al obtener el contrato:', error);
                setSnackbar({
                    open: true,
                    message: 'No se pudo cargar el contrato. Verifica el enlace.',
                    severity: 'error'
                });
                setLoading(false);
            }
        };
        fetchContract();
    }, [uuid]);

    // Soportar text|signature|date|number
    const extractPlaceholders = (content) => {
        const regex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
        const placeholders = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const nameTrim = match[1].trim();
            placeholders.push({ name: nameTrim, type: match[2] });
        }
        return Array.from(new Set(placeholders.map(JSON.stringify))).map(JSON.parse);
    };

    const handleChange = (name, value) => {
        setFilledData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSignature = (name, sigPad) => {
        if (sigPad && !signaturePads.current[name]) {
            signaturePads.current[name] = sigPad;
        }
    };

    const handleGeneratePDF = async () => {
        if (!contract) return;

        // Validar “text”
        const placeholders = extractPlaceholders(contract.content);
        for (const ph of placeholders) {
            if (ph.type === 'text') {
                // Si es text y no está lleno
                if (!filledData[ph.name]) {
                    setSnackbar({
                        open: true,
                        message: `Por favor, completa el campo "${ph.name}".`,
                        severity: 'warning'
                    });
                    return;
                }
            }
        }

        // Recolectar firmas
        const signatures = {};
        for (const [name, sigPad] of Object.entries(signaturePads.current)) {
            if (sigPad && !sigPad.isEmpty()) {
                const dataUrl = sigPad.getTrimmedCanvas().toDataURL('image/png');
                signatures[`${name}_signature`] = dataUrl;
            } else {
                signatures[`${name}_signature`] = '';
            }
        }

        const payload = {
            filledData: { ...filledData, ...signatures }
        };

        setSubmitting(true);
        try {
            // Guardar en el backend
            await api.post(`/contracts/share/${uuid}`, payload);
            setSnackbar({
                open: true,
                message: 'Contrato generado y almacenado exitosamente.',
                severity: 'success'
            });
        } catch (error) {
            console.error('Error al generar el contrato:', error);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al generar el contrato.',
                severity: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const renderContent = (html) => {
        const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;

        return parse(html, {
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

                        if (type === 'signature') {
                            segments.push(
                                <div
                                    key={`sig-${nameTrim}-${match.index}`}
                                    style={{ margin: '10px 0' }}
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
                                            if (signaturePads.current[nameTrim]) {
                                                signaturePads.current[nameTrim].clear();
                                            }
                                        }}
                                        style={{ marginTop: '5px' }}
                                    >
                                        Limpiar Firma
                                    </Button>
                                </div>
                            );
                        } else if (type === 'date' || type === 'text' || type === 'number') {
                            segments.push(
                                <input
                                    key={`field-${nameTrim}-${match.index}`}
                                    placeholder={nameTrim}
                                    type={
                                        type === 'date'
                                            ? 'date'
                                            : type === 'number'
                                                ? 'number'
                                                : 'text'
                                    }
                                    value={filledData[nameTrim] || ''}
                                    onChange={(e) => handleChange(nameTrim, e.target.value)}
                                    style={{
                                        display: 'inline-block',
                                        margin: '0 5px',
                                        minWidth: '120px',
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

                        lastIndex = match.index + fullMatch.length;
                    }

                    const remaining = text.substring(lastIndex);
                    if (remaining) {
                        segments.push(remaining);
                    }

                    return (
                        <React.Fragment key={`fragment-${domNode.key}`}>
                            {segments}
                        </React.Fragment>
                    );
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
                <Typography variant="h6">
                    Contrato no encontrado.
                </Typography>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <Typography variant="h4" gutterBottom>
                {contract.title}
            </Typography>
            <Divider style={{ marginBottom: '20px' }} />
            <ErrorBoundary>
                <div
                    style={{
                        fontFamily: "'Times New Roman', serif",
                        lineHeight: '1.5',
                        textAlign: 'justify',
                        border: '1px solid #ccc',
                        padding: '20px',
                        borderRadius: '4px'
                    }}
                >
                    {renderContent(contract.content)}
                </div>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGeneratePDF}
                    disabled={submitting}
                    style={{ marginTop: '20px' }}
                >
                    {submitting ? 'Generando...' : 'Generar y Enviar PDF'}
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

export default ContractFillPage;
