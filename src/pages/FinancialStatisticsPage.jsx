// src/pages/FinancialStatisticsPage.jsx

import React, { useEffect, useState, useRef } from 'react';
import {
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
} from '@mui/material';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import moment from 'moment-timezone';

// Configuración de la zona horaria de Guatemala:
moment.tz.setDefault('America/Guatemala');

const FinancialStatisticsPage = () => {
    const [data, setData] = useState({
        revenue: [],
        outstandingPayments: [],
        latePayments: [],
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const reportRef = useRef();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [revenueRes, outstandingRes, lateRes] = await Promise.all([
                    api.get('/reports/revenue'),
                    api.get('/reports/outstanding-payments'),
                    api.get('/reports/late-payments'),
                ]);

                setData({
                    revenue: revenueRes.data.revenue,
                    outstandingPayments: outstandingRes.data.outstandingPayments,
                    latePayments: lateRes.data.latePayments,
                });
            } catch (error) {
                console.error('Error fetching financial data', error);
                setError('Error al obtener datos financieros. Por favor, inténtalo de nuevo más tarde.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Función para generar PDF con estilo mejorado
    const generatePDF = async () => {
        const now = moment();
        const dateString = now.format('YYYY_MM_DD_HH_mm');
        const fileName = `estadisticas_financieras_${dateString}.pdf`.toLowerCase();

        // Creamos una copia del contenido
        const printableArea = reportRef.current.cloneNode(true);

        // Contenedor temporal
        const tempDiv = document.createElement('div');
        tempDiv.style.padding = '20px';
        tempDiv.style.backgroundColor = '#fff';
        tempDiv.style.color = '#000';
        tempDiv.style.width = '210mm';
        tempDiv.style.minHeight = '297mm';
        tempDiv.style.margin = '0 auto';

        const heading = document.createElement('h2');
        heading.style.textAlign = 'center';
        heading.textContent = 'Reporte de Estadísticas Financieras';

        const dateInfo = document.createElement('p');
        dateInfo.style.textAlign = 'center';
        dateInfo.style.marginBottom = '20px';
        dateInfo.textContent = `Generado el: ${now.format('DD/MM/YYYY HH:mm')} (hora Guatemala)`;

        tempDiv.appendChild(heading);
        tempDiv.appendChild(dateInfo);
        tempDiv.appendChild(printableArea);

        document.body.appendChild(tempDiv);

        const canvas = await html2canvas(tempDiv, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(fileName);

        document.body.removeChild(tempDiv);
    };

    return (
        <div tw="p-8">
            <Typography variant="h4" gutterBottom>
                Estadísticas Financieras
            </Typography>

            {/* Botón para generar PDF (ya no hay Excel) */}
            <div tw="flex space-x-4 mb-4">
                <Button variant="contained" color="primary" onClick={generatePDF}>
                    Generar PDF
                </Button>
            </div>

            {loading ? (
                <div tw="flex justify-center items-center h-64">
                    <CircularProgress />
                </div>
            ) : error ? (
                <Snackbar open={Boolean(error)} autoHideDuration={6000} onClose={() => setError(null)}>
                    <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
                        {error}
                    </Alert>
                </Snackbar>
            ) : (
                <div ref={reportRef} style={{ backgroundColor: '#fff', padding: '16px' }}>
                    <Grid container spacing={4}>
                        {/* Gráfico de Ingresos */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Ingresos Mensuales
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={data.revenue}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="amount"
                                                name="Ingresos"
                                                stroke="#8884d8"
                                                activeDot={{ r: 8 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Gráfico de Pagos Pendientes */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Pagos Pendientes
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={data.outstandingPayments}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                            <Legend />
                                            <Bar dataKey="amount" name="Pendientes" fill="#82ca9d" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Gráfico de Cobros por Mora */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Cobros por Mora
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={data.latePayments}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                            <Legend />
                                            <Bar
                                                dataKey="lateFees"
                                                name="Cobros por Mora"
                                                fill="#ffc658"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </div>
            )}
        </div>
    );
};

export default FinancialStatisticsPage;
