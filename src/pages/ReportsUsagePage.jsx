// src/pages/ReportsUsagePage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { Typography, Grid, Card, CardContent, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
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

// IMPORTACIÓN DE MOMENT-TIMEZONE PARA MANEJO DE FECHAS EN GUATEMALA:
import moment from 'moment-timezone';
moment.tz.setDefault('America/Guatemala');

const ReportsUsagePage = () => {
    const [data, setData] = useState({
        schools: [],
        incidents: [],
        distancePerPilot: [],
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const reportRef = useRef();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [schoolsRes, incidentsRes, distancePerPilotRes] = await Promise.all([
                    api.get('/reports/schools-usage'),
                    api.get('/reports/incidents-by-type'),
                    api.get('/reports/distance-per-pilot'),
                ]);

                setData({
                    schools: schoolsRes.data.schools,
                    incidents: incidentsRes.data.incidents,
                    distancePerPilot: distancePerPilotRes.data.distancePerPilot,
                });
            } catch (error) {
                console.error('Error fetching report data', error);
                setError('Error al obtener datos de reportes. Por favor, inténtalo de nuevo más tarde.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Generar PDF con estilo
    const generatePDF = async () => {
        const now = moment();
        const dateString = now.format('YYYY_MM_DD_HH_mm');
        const fileName = `reports_usage_reporte_${dateString}.pdf`.toLowerCase();

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
        heading.textContent = 'Reporte de Uso';

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
                Reportes de Uso
            </Typography>

            {/* Botón para generar PDF (se elimina Excel) */}
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
                <div
                    ref={reportRef}
                    style={{ backgroundColor: '#fff', padding: '16px' }}
                >
                    <Grid container spacing={4}>
                        {/* Distancia Total Recorrida por Piloto */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Distancia Total Recorrida por Piloto (km)
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={data.distancePerPilot}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="pilotName" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => value.toFixed(2)} />
                                            <Legend />
                                            <Bar dataKey="totalDistance" name="Distancia (km)" fill="#82ca9d" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Uso por Colegios */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Uso por Colegios
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={data.schools}
                                                dataKey="usageCount"
                                                nameKey="schoolName"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                fill="#82ca9d"
                                                label
                                            />
                                            <Tooltip formatter={(value) => value} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Incidentes por Tipo */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Incidentes por Tipo
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={data.incidents}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="type" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => value} />
                                            <Legend />
                                            <Bar dataKey="count" name="Cantidad de Incidentes" fill="#ffc658" />
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

export default ReportsUsagePage;
