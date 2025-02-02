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
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

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

    // Función para generar PDF
    const generatePDF = () => {
        const input = reportRef.current;
        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('Estadisticas_Financieras.pdf');
        });
    };

    // Función para generar Excel
    const generateExcel = () => {
        const workbook = XLSX.utils.book_new();

        // Datos de Ingresos
        const revenueSheet = XLSX.utils.json_to_sheet(data.revenue);
        XLSX.utils.book_append_sheet(workbook, revenueSheet, 'Ingresos');

        // Datos de Pagos Pendientes
        const outstandingSheet = XLSX.utils.json_to_sheet(data.outstandingPayments);
        XLSX.utils.book_append_sheet(workbook, outstandingSheet, 'Pagos Pendientes');

        // Datos de Cobros por Mora
        const latePaymentsSheet = XLSX.utils.json_to_sheet(data.latePayments);
        XLSX.utils.book_append_sheet(workbook, latePaymentsSheet, 'Cobros por Mora');

        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array',
        });

        const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(dataBlob, 'Estadisticas_Financieras.xlsx');
    };

    return (
        <div tw="p-8">
            <Typography variant="h4" gutterBottom>
                Estadísticas Financieras
            </Typography>

            {/* Botones para generar reportes */}
            <div tw="flex space-x-4 mb-4">
                <Button variant="contained" color="primary" onClick={generatePDF}>
                    Generar PDF
                </Button>
                <Button variant="contained" color="secondary" onClick={generateExcel}>
                    Generar Excel
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
                <div ref={reportRef}>
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
