// Dashboard.jsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import tw from 'twin.macro';
import { CircularProgress } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import StatsCard from '../components/dashboard/StatsCard';
import IncidentsPerPilotChart from '../components/dashboard/IncidentsPerPilotChart';
import TotalRoutesCompletedChart from '../components/dashboard/TotalRoutesCompletedChart';
import api from '../utils/axiosConfig';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import useNotify from '../hooks/useNotify';
import { F } from '../components/filters/filterFields';
import { getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';

const MONTH_OPTIONS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    .map((month) => ({ value: month, label: month }));

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
    const notify = useNotify();

    // Referencia para generar PDF
    const reportRef = useRef();

    // Función para llamar a la API con los filtros aplicados
    const fetchData = useCallback(async () => {
        setLoading(true);

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
                notify.info('No hay datos para los filtros aplicados');
            }
        } catch (err) {
            console.error('Error al obtener datos:', err);
            setTotalRoutesCompleted(0);
            setIncidents([]);
            notify.fromError(err, 'Error al obtener los datos del dashboard');
        } finally {
            setLoading(false);
        }
    }, [cycle, colegio, mes, dates.from, dates.to, notify]);

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
        <PageContainer width="xl">
            <PageHeader title="Dashboard" actions={[{ key: 'pdf', label: 'Generar PDF', group: 'download', onClick: generatePDF }]} />

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

        </PageContainer>
    );
};

export default Dashboard;
