// Dashboard.jsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import StatsCard from '../components/dashboard/StatsCard';
import IncidentsPerPilotChart from '../components/dashboard/IncidentsPerPilotChart';
import TotalRoutesCompletedChart from '../components/dashboard/TotalRoutesCompletedChart';
import api from '../utils/axiosConfig';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F } from '../components/filters/filterFields';
import { getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';

const MONTH_OPTIONS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    .map((month) => ({ value: month, label: month }));

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
    // Colegios del filtro. Los reportes filtran por el NOMBRE del colegio, por eso el valor es el nombre.
    const [schools, setSchools] = useState([]);

    const schoolNames = [...new Set(schools.map((school) => school.name).filter(Boolean))];
    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.select('colegio', {
                label: 'Colegio',
                dependsOn: 'cycle',
                requireParent: false,
                options: schoolNames.map((name) => ({ value: name, label: name })),
            }),
            F.select('mes', { label: 'Mes', width: 'sm', options: MONTH_OPTIONS }),
            F.dateRange('dates'),
        ],
    });
    const { cycle, colegio, mes, dates } = pageFilters.applied;
    const draftCycle = pageFilters.draft.cycle;

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const response = await api.get('/schools', { params: { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true } });
                setSchools(response.data.schools || []);
            } catch (err) {
                console.error('Error fetching schools:', err);
                setSchools([]);
            }
        };

        fetchSchools();
    }, [draftCycle]);

    // Estados para guardar los datos de cada indicador
    const [totalRoutesCompleted, setTotalRoutesCompleted] = useState(0);
    const [incidents, setIncidents] = useState([]);

    // Estados de carga y error
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Referencia para generar PDF
    const reportRef = useRef();

    // Función para llamar a la API con los filtros aplicados
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const queryParams = new URLSearchParams(getCicloEscolarFilterParams(cycle));
            if (colegio) {
                queryParams.append('colegio', colegio);
            }
            if (mes) {
                queryParams.append('mes', mes);
            }
            if (dates.from) {
                queryParams.append('fechaInicio', dates.from);
            }
            if (dates.to) {
                queryParams.append('fechaFin', dates.to);
            }
            const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
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
    }, [cycle, colegio, mes, dates.from, dates.to]);

    // Carga inicial y cada vez que se aplican o limpian los filtros
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Función para generar PDF del reporte
    const generatePDF = () => {
        const input = reportRef.current;
        if (!input) {
            return;
        }

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
            <FilterBar {...pageFilters.barProps} loading={loading} />

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
