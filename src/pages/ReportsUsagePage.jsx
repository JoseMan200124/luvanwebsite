// src/pages/ReportsUsagePage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { Typography, Grid, Card, CardContent, Button } from '@mui/material';
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
        routes: [
            { routeName: 'Ruta 1', usageCount: 120 },
            { routeName: 'Ruta 2', usageCount: 80 },
            { routeName: 'Ruta 3', usageCount: 150 },
            { routeName: 'Ruta 4', usageCount: 60 },
            { routeName: 'Ruta 5', usageCount: 200 },
        ],
        schools: [
            { schoolName: 'Colegio San Martín', usageCount: 200 },
            { schoolName: 'Instituto Belgrano', usageCount: 150 },
            { schoolName: 'Escuela Nacional', usageCount: 100 },
            { schoolName: 'Colegio del Sur', usageCount: 50 },
        ],
        incidents: [
            { date: 'Enero', mechanical: 2, electrical: 1, accidents: 0 },
            { date: 'Febrero', mechanical: 1, electrical: 2, accidents: 1 },
            { date: 'Marzo', mechanical: 3, electrical: 1, accidents: 0 },
            { date: 'Abril', mechanical: 2, electrical: 0, accidents: 2 },
            { date: 'Mayo', mechanical: 1, electrical: 1, accidents: 1 },
        ],
    });

    const reportRef = useRef();

    useEffect(() => {
        // Llamadas a la API para obtener datos
        const fetchData = async () => {
            try {
                const [routesRes, schoolsRes, incidentsRes] = await Promise.all([
                    api.get('/reports/routes-usage'),
                    api.get('/reports/schools-usage'),
                    api.get('/reports/incidents'),
                ]);

                setData({
                    routes: routesRes.data,
                    schools: schoolsRes.data,
                    incidents: incidentsRes.data,
                });
            } catch (error) {
                console.error('Error fetching report data', error);
            }
        };

        // fetchData();
    }, []);

    // Función para generar PDF
    const generatePDF = () => {
        const input = reportRef.current;
        html2canvas(input).then((canvas) => {
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

        // Datos de Uso por Rutas
        const routesSheet = XLSX.utils.json_to_sheet(data.routes);
        XLSX.utils.book_append_sheet(workbook, routesSheet, 'Uso por Rutas');

        // Datos de Uso por Colegios
        const schoolsSheet = XLSX.utils.json_to_sheet(data.schools);
        XLSX.utils.book_append_sheet(workbook, schoolsSheet, 'Uso por Colegios');

        // Datos de Incidentes
        const incidentsSheet = XLSX.utils.json_to_sheet(data.incidents);
        XLSX.utils.book_append_sheet(workbook, incidentsSheet, 'Incidentes');

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

            <div ref={reportRef}>
                <Grid container spacing={4}>
                    {/* Gráfico de Uso por Rutas */}
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Uso por Rutas
                                </Typography>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={data.routes}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="routeName" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="usageCount" name="Cantidad de Uso" fill="#8884d8" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Gráfico de Uso por Colegios */}
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
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Gráfico de Incidentes */}
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Incidentes por Tipo
                                </Typography>
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={data.incidents}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="mechanical"
                                            name="Mecánicos"
                                            stroke="#8884d8"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="electrical"
                                            name="Eléctricos"
                                            stroke="#82ca9d"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="accidents"
                                            name="Accidentes"
                                            stroke="#ffc658"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </div>
        </div>
    );
};

export default ReportsUsagePage;
