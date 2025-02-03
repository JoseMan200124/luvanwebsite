// frontend/src/pages/Dashboard.jsx

import React, { useEffect, useState, useRef } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { Button, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

import StatsCard from '../components/dashboard/StatsCard';
import OutstandingPaymentsChart from '../components/dashboard/OutstandingPaymentsChart';
import LatePaymentsChart from '../components/dashboard/LatePaymentsChart';
import IncidentsPerPilotChart from '../components/dashboard/IncidentsPerPilotChart';
import TotalRoutesCompletedChart from '../components/dashboard/TotalRoutesCompletedChart';
import OnTimeRoutesPerPilotChart from '../components/dashboard/OnTimeRoutesPerPilotChart';
import AverageDelayPerRouteChart from '../components/dashboard/AverageDelayPerRouteChart';
import PaymentStatusesChart from '../components/dashboard/PaymentStatusesChart';
import Filters from '../components/dashboard/Filters';
import api from '../utils/axiosConfig';

const DashboardContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const Header = styled.div`
    ${tw`flex flex-col md:flex-row items-center justify-between mb-8`}
`;

const Title = tw.h1`text-3xl font-bold text-gray-800`;

const StatsGrid = tw.div`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8`;

const ChartsGrid = tw.div`grid grid-cols-1 lg:grid-cols-2 gap-6`;

const Dashboard = () => {
    // State para manejar filtros
    const [filters, setFilters] = useState({
        colegio: '',
        ruta: '',
        mes: '',
        fechaInicio: '',
        fechaFin: '',
    });

    // Estados para los indicadores
    const [outstandingPayments, setOutstandingPayments] = useState([]);
    const [latePayments, setLatePayments] = useState([]);
    const [totalRoutesCompleted, setTotalRoutesCompleted] = useState(0);
    const [paymentStatuses, setPaymentStatuses] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const reportRef = useRef();

    useEffect(() => {
        // Función para obtener todos los datos necesarios desde el backend
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [
                    outstandingPaymentsRes,
                    latePaymentsRes,
                    totalRoutesRes,
                    paymentStatusesRes
                ] = await Promise.all([
                    api.get('/reports/outstanding-payments'),
                    api.get('/reports/late-payments'),
                    api.get('/reports/total-routes-completed'),
                    api.get('/reports/payment-statuses')
                ]);

                setOutstandingPayments(outstandingPaymentsRes.data.outstandingPayments);
                setLatePayments(latePaymentsRes.data.latePayments);
                setTotalRoutesCompleted(totalRoutesRes.data.totalRoutesCompleted);
                setPaymentStatuses(paymentStatusesRes.data.paymentStatuses);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Error al obtener datos de indicadores. Por favor, inténtalo de nuevo más tarde.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [filters]);

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
            pdf.save('Reporte_de_Gestión.pdf');
        });
    };

    // Función para generar Excel
    const generateExcel = () => {
        const workbook = XLSX.utils.book_new();

        // Datos de Pagos Pendientes
        const outstandingPaymentsSheet = XLSX.utils.json_to_sheet(outstandingPayments);
        XLSX.utils.book_append_sheet(workbook, outstandingPaymentsSheet, 'Pagos Pendientes');

        // Datos de Cobros por Mora
        const latePaymentsSheet = XLSX.utils.json_to_sheet(latePayments);
        XLSX.utils.book_append_sheet(workbook, latePaymentsSheet, 'Cobros por Mora');

        // Datos de Total de Rutas Completadas
        const totalRoutesSheet = XLSX.utils.json_to_sheet([{ totalRoutesCompleted }]);
        XLSX.utils.book_append_sheet(workbook, totalRoutesSheet, 'Total Rutas Completadas');

        // Datos de Estados de Pagos
        const paymentStatusesSheet = XLSX.utils.json_to_sheet(paymentStatuses);
        XLSX.utils.book_append_sheet(workbook, paymentStatusesSheet, 'Estados de Pagos');

        // Puedes agregar más hojas si es necesario

        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array',
        });

        const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(dataBlob, 'Reporte_de_Gestión.xlsx');
    };

    return (
        <DashboardContainer>
            <Header>
                <Title>Dashboard</Title>
                <div tw="flex space-x-4">
                    <Button variant="contained" color="primary" onClick={generatePDF}>
                        Generar PDF
                    </Button>
                    <Button variant="contained" color="secondary" onClick={generateExcel}>
                        Generar Excel
                    </Button>
                </div>
            </Header>
            <Filters filters={filters} setFilters={setFilters} />
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
                    <StatsGrid>
                        {/* Indicadores Existentes */}
                        <StatsCard
                            title="Pagos Pendientes (Quetzales)"
                            value={outstandingPayments.reduce((acc, curr) => acc + curr.amount, 0)}
                            icon="PendingActions"
                        />
                        <StatsCard
                            title="Cobros por Mora (Quetzales)"
                            value={latePayments.reduce((acc, curr) => acc + curr.lateFees, 0)}
                            icon="ReportProblem"
                        />
                        <StatsCard
                            title="Total de Rutas Completadas"
                            value={totalRoutesCompleted}
                            icon="School"
                        />
                        {/* Puedes agregar más StatsCard si tienes otros indicadores */}
                    </StatsGrid>
                    <ChartsGrid>
                        {/* Gráficas Existentes */}
                        <OutstandingPaymentsChart data={outstandingPayments} />
                        <LatePaymentsChart data={latePayments} />
                        <TotalRoutesCompletedChart data={totalRoutesCompleted} />
                        <IncidentsPerPilotChart filters={filters} />
                        <OnTimeRoutesPerPilotChart filters={filters} />
                        <AverageDelayPerRouteChart filters={filters} />
                        {/* Nuevas Gráficas */}
                        <PaymentStatusesChart data={paymentStatuses} />
                        {/* Puedes agregar más gráficas si tienes otros indicadores */}
                    </ChartsGrid>
                </div>
            )}
        </DashboardContainer>
    );
};

export default Dashboard;
