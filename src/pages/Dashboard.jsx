// Dashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import StatsCard from '../components/dashboard/StatsCard';
import IncidentsPerPilotChart from '../components/dashboard/IncidentsPerPilotChart';
import TotalRoutesCompletedChart from '../components/dashboard/TotalRoutesCompletedChart';
import Filters from '../components/dashboard/Filters';
import api from '../utils/axiosConfig';

// Contenedor principal del dashboard
const DashboardContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

// Encabezado del dashboard
const Header = styled.div`
    ${tw`flex flex-col md:flex-row items-center justify-between mb-8`}
`;

// Título del dashboard
const Title = tw.h1`text-3xl font-bold text-gray-800`;

// Grid para las tarjetas de indicadores
const StatsGrid = tw.div`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8`;

// Grid para las gráficas
const ChartsGrid = tw.div`grid grid-cols-1 lg:grid-cols-2 gap-6`;

const Dashboard = () => {
    // Estado de filtros
    const [filters, setFilters] = useState({
        colegio: '',
        mes: '',
        fechaInicio: '',
        fechaFin: ''
    });

    // Estados para guardar los datos de cada indicador
    const [totalRoutesCompleted, setTotalRoutesCompleted] = useState(0);
    const [incidents, setIncidents] = useState([]);

    // Estados de carga y error
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Referencia para generar PDF
    const reportRef = useRef();

    // Construye el query string según los filtros aplicados
    const buildQueryString = () => {
        const queryParams = new URLSearchParams();
        if (filters.colegio) queryParams.append('colegio', filters.colegio);
        if (filters.mes) queryParams.append('mes', filters.mes);
        if (filters.fechaInicio) queryParams.append('fechaInicio', filters.fechaInicio);
        if (filters.fechaFin) queryParams.append('fechaFin', filters.fechaFin);

        return queryParams.toString() ? `?${queryParams.toString()}` : '';
    };

    // Función para llamar a la API y obtener los datos
    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const qs = buildQueryString();
            const [
                totalRoutesRes,
                incidentsRes
            ] = await Promise.all([
                api.get(`/reports/total-routes-completed${qs}`),
                api.get(`/reports/incidents-per-pilot${qs}`)
            ]);

            const trc = totalRoutesRes.data.totalRoutesCompleted || 0;
            const inc = incidentsRes.data.incidents || [];

            setTotalRoutesCompleted(trc);
            setIncidents(inc);

            // Si ninguno de los indicadores tiene datos, se notifica "No hay datos"
            if (trc === 0 && inc.length === 0) {
                setError("No hay datos");
            } else {
                setError(null);
            }
        } catch (err) {
            console.error('Error al obtener datos:', err);
            // En caso de error, se limpian los datos y se notifica "No hay datos"
            setTotalRoutesCompleted(0);
            setIncidents([]);
            setError("No hay datos");
        } finally {
            setLoading(false);
        }
    };

    // Carga inicial
    useEffect(() => {
        fetchData();
    }, []);

    // Función para generar PDF del reporte
    const generatePDF = () => {
        const input = reportRef.current;
        if (!input) return;

        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('Reporte_de_Gestion.pdf');
        });
    };

    // Función para resetear los filtros y recargar los datos
    const handleResetFilters = () => {
        setFilters({
            colegio: '',
            mes: '',
            fechaInicio: '',
            fechaFin: ''
        });
        setTimeout(() => {
            fetchData();
        }, 0);
    };

    return (
        <DashboardContainer>
            {/* Encabezado */}
            <Header>
                <Title>Dashboard</Title>
                <div tw="flex space-x-4">
                    <Button variant="contained" color="primary" onClick={generatePDF}>
                        Generar PDF
                    </Button>
                </div>
            </Header>

            {/* Filtros */}
            <Filters filters={filters} setFilters={setFilters} />

            {/* Botones de Filtrar y Resetear */}
            <div tw="mb-4 flex space-x-3">
                <Button variant="contained" color="primary" onClick={fetchData}>
                    Filtrar
                </Button>
                <Button variant="outlined" color="secondary" onClick={handleResetFilters}>
                    Resetear
                </Button>
            </div>

            {/* Se muestra spinner mientras se cargan los datos; en caso contrario, se renderiza el contenido del dashboard */}
            {loading ? (
                <div tw="flex justify-center items-center h-64">
                    <CircularProgress />
                </div>
            ) : (
                <div ref={reportRef}>
                    <StatsGrid>
                        <StatsCard
                            title="Rutas Completadas"
                            value={totalRoutesCompleted}
                            icon="School"
                        />
                    </StatsGrid>

                    <ChartsGrid>
                        <TotalRoutesCompletedChart data={totalRoutesCompleted} />
                        <IncidentsPerPilotChart data={incidents} />
                    </ChartsGrid>
                </div>
            )}

            {/* Notificación: Si ocurre algún error o no se obtuvieron datos, se muestra "No hay datos" */}
            {error && (
                <Snackbar
                    open={Boolean(error)}
                    autoHideDuration={6000}
                    onClose={() => setError(null)}
                >
                    <Alert onClose={() => setError(null)} severity="info" sx={{ width: '100%' }}>
                        {error}
                    </Alert>
                </Snackbar>
            )}
        </DashboardContainer>
    );
};

export default Dashboard;
