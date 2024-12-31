// src/pages/ContractFillPage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    Button,
    Typography,
    CircularProgress,
    Divider,
    Snackbar,
    Alert,
    TextField
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
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
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
                    message: 'No se pudo cargar el contrato. Por favor, verifica el enlace.',
                    severity: 'error'
                });
                setLoading(false);
            }
        };

        fetchContract();
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

    // Manejar cambios en inputs
    const handleChange = (name, value) => {
        setFilledData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Manejar firma
    const handleSignature = (name, sigPad) => {
        if (sigPad && !signaturePads.current[name]) {
            signaturePads.current[name] = sigPad;
        }
    };

    // Manejar generación y envío de PDF
    const handleGeneratePDF = async () => {
        // Validar campos requeridos
        const placeholders = extractPlaceholders(contract.content);
        for (let ph of placeholders) {
            if (ph.type === 'text' && !filledData[ph.name]) {
                setSnackbar({
                    open: true,
                    message: `Por favor, completa el campo "${ph.name}".`,
                    severity: 'warning'
                });
                return;
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
            filledData: { ...filledData, ...signatures },
        };

        setSubmitting(true);
        try {
            const response = await api.post(`/contracts/share/${uuid}`, payload);
            setSnackbar({
                open: true,
                message: 'Contrato generado y almacenado exitosamente.',
                severity: 'success'
            });
            // Opcional: redirigir o realizar alguna acción adicional
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

    // Renderizar contenido del contrato con campos llenables y firmas
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
                                            if (signaturePads.current[name]) {
                                                signaturePads.current[name].clear();
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
                                    value={filledData[name] || ''}
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

                    return <React.Fragment key={`fragment-${domNode.key}`}>{segments}</React.Fragment>;
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
            <Divider style={{ marginBottom: '20px' }} />
            <ErrorBoundary>
                <form noValidate autoComplete="off">
                    {renderContent(contract.content)}
                </form>
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
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default ContractFillPage;
