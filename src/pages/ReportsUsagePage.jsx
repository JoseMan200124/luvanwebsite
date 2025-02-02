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
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

const ReportsUsagePage = () => {
    const [data, setData] = useState({
        // routes: [], // Removido
        schools: [],
        incidents: [],
        distancePerPilot: [], // Nueva métrica
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const reportRef = useRef();

    useEffect(() => {
        // Llamadas a la API para obtener datos
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [schoolsRes, incidentsRes, distancePerPilotRes] = await Promise.all([
                    api.get('/reports/schools-usage'),
                    api.get('/reports/incidents-by-type'),
                    api.get('/reports/distance-per-pilot'), // Nueva llamada
                ]);

                setData({
                    schools: schoolsRes.data.schools,
                    incidents: incidentsRes.data.incidents,
                    distancePerPilot: distancePerPilotRes.data.distancePerPilot, // Asignación de la nueva métrica
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
            pdf.save('Reporte_de_Uso.pdf');
        });
    };

    // Función para generar Excel
    const generateExcel = () => {
        const workbook = XLSX.utils.book_new();

        // Datos de Uso por Colegios
        const schoolsSheet = XLSX.utils.json_to_sheet(data.schools);
        XLSX.utils.book_append_sheet(workbook, schoolsSheet, 'Uso por Colegios');

        // Datos de Incidentes
        const incidentsSheet = XLSX.utils.json_to_sheet(data.incidents);
        XLSX.utils.book_append_sheet(workbook, incidentsSheet, 'Incidentes por Tipo');

        // Datos de Distancia por Piloto
        const distancePerPilotSheet = XLSX.utils.json_to_sheet(data.distancePerPilot);
        XLSX.utils.book_append_sheet(workbook, distancePerPilotSheet, 'Distancia por Piloto');

        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array',
        });

        const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(dataBlob, 'Reporte_de_Uso.xlsx');
    };

    return (
        <div tw="p-8">
            <Typography variant="h4" gutterBottom>
                Reportes de Uso
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
                        {/* Nueva Gráfica: Distancia Total Recorrida por Piloto */}
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

                        {/* Gráfica de Uso por Colegios */}
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

                        {/* Gráfica de Incidentes por Tipo */}
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
