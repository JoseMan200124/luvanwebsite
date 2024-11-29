// src/pages/ContractViewer.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button, TextField, Typography, CircularProgress, Grid, Divider } from '@mui/material';
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
    const [signaturePads, setSignaturePads] = useState({});
    const sigCanvasRefs = useRef({});

    useEffect(() => {
        const fetchContract = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/contracts/${uuid}`);
                setContract(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error al obtener el contrato:', error);
                alert('Error al obtener el contrato.');
                setLoading(false);
            }
        };

        fetchContract();
    }, [uuid]);

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

    const extractPlaceholders = (content) => {
        const regex = /{{(.*?):(.*?)}}/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push({ name: match[1], type: match[2] });
        }
        return Array.from(new Set(matches.map(JSON.stringify))).map(JSON.parse); // Eliminar duplicados
    };

    const handleChange = (name, value) => {
        setFormValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleGeneratePDF = async () => {
        if (!contract) return;

        // Reemplazar placeholders con los valores llenados
        let filledContent = contract.content;

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

        // Crear un div temporal para renderizar el contenido
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = filledContent;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.backgroundColor = '#fff';
        document.body.appendChild(tempDiv);

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
            alert('Hubo un error al generar el PDF. Por favor, inténtelo de nuevo.');
        }

        document.body.removeChild(tempDiv);
    };

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
                                                setSignaturePads((prev) => ({
                                                    ...prev,
                                                    [name]: ref,
                                                }));
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

    if (loading) {
        return <CircularProgress />;
    }

    if (!contract) {
        return <Typography variant="h6">Contrato no encontrado.</Typography>;
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
                <Button variant="contained" color="primary" onClick={handleGeneratePDF} style={{ marginTop: '20px' }}>
                    Generar PDF
                </Button>
            </ErrorBoundary>
        </div>
    );
};

export default ContractViewer;
