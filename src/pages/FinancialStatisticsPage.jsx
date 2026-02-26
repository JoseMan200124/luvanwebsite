// src/pages/FinancialStatisticsPage.jsx

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    useTheme,
    useMediaQuery
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
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import tw from 'twin.macro';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import moment from 'moment-timezone';

moment.tz.setDefault('America/Guatemala');

// Contenedor principal con twin.macro
const PageContainer = tw.div`
  p-8 w-full bg-gray-100 flex flex-col min-h-screen
`;

const FinancialStatisticsPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [data, setData] = useState({
        revenue: [],
        outstandingPayments: [],
        latePayments: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const reportRef = useRef();

    const fetchData = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchData();
    }, [fetchData]);

    // Función para generar PDF sin modificar la lógica
    const generatePDF = async () => {
        const now = moment();
        const dateString = now.format('YYYY_MM_DD_HH_mm');
        const fileName = `estadisticas_financieras_${dateString}.pdf`.toLowerCase();

        const printableArea = reportRef.current.cloneNode(true);

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
        <PageContainer>
            <Typography variant="h4" gutterBottom>
                Estadísticas Financieras
            </Typography>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <Button variant="contained" color="primary" onClick={generatePDF}>
                    Generar PDF
                </Button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '16rem' }}>
                    <CircularProgress />
                </div>
            ) : error ? (
                <Snackbar open={Boolean(error)} autoHideDuration={6000} onClose={() => setError(null)}>
                    <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
                        {error}
                    </Alert>
                </Snackbar>
            ) : (
                <div ref={reportRef} style={{ backgroundColor: '#fff', padding: '16px', overflowX: 'auto' }}>
                    {isMobile ? (
                        // Vista móvil: mostrar 4 gráficas en tarjetas apiladas
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Ingresos Mensuales
                                    </Typography>
                                    <div style={{ width: '100%', height: 300 }}>
                                        <ResponsiveContainer width="100%" height="100%">
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
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Pagos Pendientes
                                    </Typography>
                                    <div style={{ width: '100%', height: 300 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={data.outstandingPayments}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis />
                                                <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                                <Legend />
                                                <Bar dataKey="amount" name="Pendientes" fill="#82ca9d" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Cobros por Mora
                                    </Typography>
                                    <div style={{ width: '100%', height: 400 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={data.latePayments}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis />
                                                <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                                <Legend />
                                                <Bar dataKey="lateFees" name="Cobros por Mora" fill="#ffc658" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Reporte Extra (Ejemplo)
                                    </Typography>
                                    <div style={{ width: '100%', height: 300 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={data.latePayments}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis />
                                                <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                                <Legend />
                                                <Bar dataKey="lateFees" name="Ejemplo" fill="#8884d8" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        // Vista en escritorio: mostrar 4 gráficas en un Grid de 2 columnas
                        <Grid container spacing={4}>
                            <Grid item xs={12} md={6}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Ingresos Mensuales
                                        </Typography>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer width="100%" height="100%">
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
                                        </div>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Pagos Pendientes
                                        </Typography>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.outstandingPayments}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="month" />
                                                    <YAxis />
                                                    <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                                    <Legend />
                                                    <Bar dataKey="amount" name="Pendientes" fill="#82ca9d" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Cobros por Mora
                                        </Typography>
                                        <div style={{ width: '100%', height: 400 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.latePayments}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="month" />
                                                    <YAxis />
                                                    <Tooltip formatter={(value) => `Q ${value.toFixed(2)}`} />
                                                    <Legend />
                                                    <Bar dataKey="lateFees" name="Cobros por Mora" fill="#ffc658" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </div>
            )}
        </PageContainer>
    );
};

export default FinancialStatisticsPage;
