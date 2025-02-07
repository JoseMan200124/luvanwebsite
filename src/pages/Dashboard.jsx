// Dashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import StatsCard from '../components/dashboard/StatsCard';
import OutstandingPaymentsChart from '../components/dashboard/OutstandingPaymentsChart';
import LatePaymentsChart from '../components/dashboard/LatePaymentsChart';
import IncidentsPerPilotChart from '../components/dashboard/IncidentsPerPilotChart';
import TotalRoutesCompletedChart from '../components/dashboard/TotalRoutesCompletedChart';
import PaymentStatusesChart from '../components/dashboard/PaymentStatusesChart';
import Filters from '../components/dashboard/Filters';
import api from '../utils/axiosConfig';

// Styled container
const DashboardContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

// Header style for the top of the page
const Header = styled.div`
    ${tw`flex flex-col md:flex-row items-center justify-between mb-8`}
`;

// Title for the dashboard
const Title = tw.h1`text-3xl font-bold text-gray-800`;

// A grid for the top stats cards
const StatsGrid = tw.div`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8`;

// A grid for the bottom charts
const ChartsGrid = tw.div`grid grid-cols-1 lg:grid-cols-2 gap-6`;

const Dashboard = () => {
    // Filtros
    const [filters, setFilters] = useState({
        colegio: '',
        mes: '',
        fechaInicio: '',
        fechaFin: ''
    });

    // States donde guardamos data
    const [outstandingPayments, setOutstandingPayments] = useState([]);
    const [latePayments, setLatePayments] = useState([]);
    const [totalRoutesCompleted, setTotalRoutesCompleted] = useState(0);
    const [paymentStatuses, setPaymentStatuses] = useState([]);
    const [incidents, setIncidents] = useState([]);

    // Loading / error
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Ref para generar PDF
    const reportRef = useRef();

    // Construye query string
    const buildQueryString = () => {
        const queryParams = new URLSearchParams();
        if (filters.colegio) queryParams.append('colegio', filters.colegio);
        if (filters.mes) queryParams.append('mes', filters.mes);
        if (filters.fechaInicio) queryParams.append('fechaInicio', filters.fechaInicio);
        if (filters.fechaFin) queryParams.append('fechaFin', filters.fechaFin);

        const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return qs;
    };

    // Llama a la API
    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const qs = buildQueryString();
            const [
                outstandingPaymentsRes,
                latePaymentsRes,
                totalRoutesRes,
                paymentStatusesRes,
                incidentsRes
            ] = await Promise.all([
                api.get(`/reports/outstanding-payments${qs}`),
                api.get(`/reports/late-payments${qs}`),
                api.get(`/reports/total-routes-completed${qs}`),
                api.get(`/reports/payment-statuses${qs}`),
                api.get(`/reports/incidents-per-pilot${qs}`)
            ]);

            setOutstandingPayments(outstandingPaymentsRes.data.outstandingPayments || []);
            setLatePayments(latePaymentsRes.data.latePayments || []);
            setTotalRoutesCompleted(totalRoutesRes.data.totalRoutesCompleted || 0);
            setPaymentStatuses(paymentStatusesRes.data.paymentStatuses || []);
            setIncidents(incidentsRes.data.incidents || []);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Error al obtener datos de indicadores. Intenta de nuevo más tarde.');
        } finally {
            setLoading(false);
        }
    };

    // Carga inicial
    useEffect(() => {
        fetchData();
    }, []);

    // Genera PDF
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

    // Resetea los filtros
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
            {/* Header */}
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

            {/* Botones Filtrar/Reset */}
            <div tw="mb-4 flex space-x-3">
                <Button
                    variant="contained"
                    color="primary"
                    onClick={fetchData}
                >
                    Filtrar
                </Button>

                <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleResetFilters}
                >
                    Resetear
                </Button>
            </div>

            {/* Loading / Error / Dashboard */}
            {loading ? (
                <div tw="flex justify-center items-center h-64">
                    <CircularProgress />
                </div>
            ) : error ? (
                <Snackbar
                    open={Boolean(error)}
                    autoHideDuration={6000}
                    onClose={() => setError(null)}
                >
                    <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
                        {error}
                    </Alert>
                </Snackbar>
            ) : (
                <div ref={reportRef}>
                    {/* Tarjetas */}
                    <StatsGrid>
                        <StatsCard
                            title="Pagos Pendientes (Q)"
                            value={outstandingPayments.reduce((acc, curr) => acc + curr.amount, 0)}
                            icon="PendingActions"
                        />
                        <StatsCard
                            title="Cobros por Mora (Q)"
                            value={latePayments.reduce((acc, curr) => acc + curr.lateFees, 0)}
                            icon="ReportProblem"
                        />
                        <StatsCard
                            title="Rutas Completadas"
                            value={totalRoutesCompleted}
                            icon="School"
                        />
                    </StatsGrid>

                    {/* Gráficas */}
                    <ChartsGrid>
                        <OutstandingPaymentsChart data={outstandingPayments} />
                        <LatePaymentsChart data={latePayments} />
                        <TotalRoutesCompletedChart data={totalRoutesCompleted} />
                        <IncidentsPerPilotChart data={incidents} />
                        <PaymentStatusesChart data={paymentStatuses} />
                    </ChartsGrid>
                </div>
            )}
        </DashboardContainer>
    );
};

export default Dashboard;
