// src/pages/ReportsUsagePage.jsx

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
    useMediaQuery,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack
} from '@mui/material';
import {
    BarChart,
    Bar,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    ResponsiveContainer
} from 'recharts';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import tw from 'twin.macro';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import moment from 'moment-timezone';

moment.tz.setDefault('America/Guatemala');

// Contenedor principal
const PageContainer = tw.div`
  p-8 w-full bg-gray-100 flex flex-col min-h-screen
`;

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const truncateLabel = (str, max = 16) => {
    if (!str) return '';
    const s = String(str);
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
};

/**
 * Devuelve Top N + "Otros" (si hay más de N elementos).
 * - items: array original
 * - nameKey: key del label (ej: pilotName / schoolName)
 * - valueKey: key del valor numérico (ej: totalDistance / usageCount)
 * - topN: número o "all"
 * - otherLabel: etiqueta de agrupación
 * - mapName: función para personalizar el label
 */
const buildTopNWithOthers = ({
                                 items,
                                 nameKey,
                                 valueKey,
                                 topN,
                                 otherLabel = 'Otros',
                                 mapName
                             }) => {
    const arr = Array.isArray(items) ? items : [];

    // Normalizar y filtrar valores 0
    const normalized = arr
        .map((it) => {
            const rawName = it?.[nameKey];
            const name = mapName ? mapName(it) : rawName;
            return {
                ...it,
                [nameKey]: name ?? 'Sin nombre',
                [valueKey]: toNumber(it?.[valueKey])
            };
        })
        .filter((it) => toNumber(it?.[valueKey]) > 0);

    // Ordenar desc
    normalized.sort((a, b) => toNumber(b[valueKey]) - toNumber(a[valueKey]));

    if (topN === 'all') return normalized;

    const n = Math.max(1, Number(topN) || 10);
    const top = normalized.slice(0, n);
    const rest = normalized.slice(n);

    if (rest.length === 0) return top;

    const restSum = rest.reduce((acc, it) => acc + toNumber(it[valueKey]), 0);

    return [
        ...top,
        {
            [nameKey]: otherLabel,
            [valueKey]: restSum
        }
    ];
};

const calcDynamicHeight = (rowsCount, { min = 280, max = 620, perRow = 34 } = {}) => {
    const h = rowsCount * perRow + 80; // padding extra para ejes/legend
    return Math.max(min, Math.min(max, h));
};

const ReportsUsagePage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [data, setData] = useState({
        schools: [],
        incidents: [],
        distancePerPilot: [],
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const reportRef = useRef();

    // Controles TOP-N
    const [distanceTopN, setDistanceTopN] = useState(isMobile ? 10 : 15);
    const [schoolsTopN, setSchoolsTopN] = useState(isMobile ? 8 : 12);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [schoolsRes, incidentsRes, distancePerPilotRes] = await Promise.all([
                api.get('/reports/schools-usage'),
                api.get('/reports/incidents-by-type'),
                api.get('/reports/distance-per-pilot'),
            ]);

            setData({
                schools: schoolsRes.data.schools || [],
                incidents: incidentsRes.data.incidents || [],
                distancePerPilot: distancePerPilotRes.data.distancePerPilot || [],
            });
        } catch (err) {
            console.error('Error fetching report data', err);
            setError('Error al obtener datos de reportes. Por favor, inténtalo de nuevo más tarde.');
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

    // Preparar datos “Top N + Otros” para gráficas con demasiadas categorías
    const distanceChartData = useMemo(() => {
        return buildTopNWithOthers({
            items: data.distancePerPilot,
            nameKey: 'pilotName',
            valueKey: 'totalDistance',
            topN: distanceTopN,
            otherLabel: 'Otros pilotos',
            mapName: (it) => it?.pilotName ?? 'Piloto'
        });
    }, [data.distancePerPilot, distanceTopN]);

    const schoolsChartData = useMemo(() => {
        // En tu API ya devuelves "schools" con { schoolName, usageCount, type }
        // type puede ser 'school' o 'corporation'
        return buildTopNWithOthers({
            items: data.schools,
            nameKey: 'schoolName',
            valueKey: 'usageCount',
            topN: schoolsTopN,
            otherLabel: 'Otros clientes',
            mapName: (it) => {
                const base = it?.schoolName ?? 'Cliente';
                const t = it?.type;
                // marca corporaciones para que no se confundan con colegios
                return t === 'corporation' ? `${base} (Corp.)` : base;
            }
        });
    }, [data.schools, schoolsTopN]);

    const incidentsByTypeData = useMemo(() => {
        // Normalizar count
        const arr = Array.isArray(data.incidents) ? data.incidents : [];
        return arr.map((it) => ({
            ...it,
            count: toNumber(it?.count),
            type: it?.type ?? 'Sin tipo'
        }));
    }, [data.incidents]);

    const distanceHeight = useMemo(() => calcDynamicHeight(distanceChartData.length), [distanceChartData.length]);
    const schoolsHeight = useMemo(() => calcDynamicHeight(schoolsChartData.length), [schoolsChartData.length]);

    const generatePDF = async () => {
        const now = moment();
        const dateString = now.format('YYYY_MM_DD_HH_mm');
        const fileName = `reports_usage_reporte_${dateString}.pdf`.toLowerCase();

        const printableArea = reportRef.current?.cloneNode(true);
        if (!printableArea) return;

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

    const TopNSelect = ({ label, value, onChange, options }) => (
        <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{label}</InputLabel>
            <Select
                label={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((opt) => (
                    <MenuItem key={String(opt.value)} value={opt.value}>
                        {opt.label}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    return (
        <PageContainer>
            <Typography variant="h4" gutterBottom>
                Reportes de Uso
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <Button variant="contained" color="primary" onClick={generatePDF}>
                    Generar PDF
                </Button>

                <TopNSelect
                    label="Top pilotos"
                    value={distanceTopN}
                    onChange={setDistanceTopN}
                    options={[
                        { label: 'Top 10', value: 10 },
                        { label: 'Top 15', value: 15 },
                        { label: 'Top 20', value: 20 },
                        { label: 'Todo', value: 'all' },
                    ]}
                />

                <TopNSelect
                    label="Top clientes"
                    value={schoolsTopN}
                    onChange={setSchoolsTopN}
                    options={[
                        { label: 'Top 8', value: 8 },
                        { label: 'Top 12', value: 12 },
                        { label: 'Top 20', value: 20 },
                        { label: 'Todo', value: 'all' },
                    ]}
                />
            </Stack>

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
                    <Grid container spacing={4}>
                        {/* Distancia por piloto (barras horizontales, Top N + Otros) */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Distancia Total Recorrida por Piloto (km)
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        Mostrando {distanceTopN === 'all' ? 'todo' : `Top ${distanceTopN}`} (resto agrupado como “Otros pilotos”).
                                    </Typography>

                                    <div style={{ width: '100%', height: distanceHeight }}>
                                        <ResponsiveContainer>
                                            <BarChart
                                                data={distanceChartData}
                                                layout="vertical"
                                                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    type="number"
                                                    tickFormatter={(v) => toNumber(v).toLocaleString()}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="pilotName"
                                                    width={isMobile ? 110 : 150}
                                                    tickFormatter={(v) => truncateLabel(v, isMobile ? 12 : 18)}
                                                />
                                                <Tooltip
                                                    formatter={(value) => `${toNumber(value).toFixed(2)} km`}
                                                    labelFormatter={(label) => `Piloto: ${label}`}
                                                />
                                                <Legend />
                                                <Bar dataKey="totalDistance" name="Distancia (km)" fill="#82ca9d" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Uso por clientes (colegios/corporaciones) -> barras horizontales */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Uso por Clientes (Colegios / Corporaciones)
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        Mostrando {schoolsTopN === 'all' ? 'todo' : `Top ${schoolsTopN}`} (resto agrupado como “Otros clientes”).
                                    </Typography>

                                    <div style={{ width: '100%', height: schoolsHeight }}>
                                        <ResponsiveContainer>
                                            <BarChart
                                                data={schoolsChartData}
                                                layout="vertical"
                                                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" allowDecimals={false} />
                                                <YAxis
                                                    type="category"
                                                    dataKey="schoolName"
                                                    width={isMobile ? 120 : 170}
                                                    tickFormatter={(v) => truncateLabel(v, isMobile ? 14 : 22)}
                                                />
                                                <Tooltip
                                                    formatter={(value) => `${toNumber(value)} rutas`}
                                                    labelFormatter={(label) => `Cliente: ${label}`}
                                                />
                                                <Legend />
                                                <Bar dataKey="usageCount" name="Rutas registradas" fill="#82ca9d" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Incidentes por tipo (normalmente pocos; se mantiene vertical) */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Incidentes por Tipo
                                    </Typography>

                                    <div style={{ width: '100%', height: 380 }}>
                                        <ResponsiveContainer>
                                            <BarChart data={incidentsByTypeData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="type"
                                                    interval={0}
                                                    angle={-25}
                                                    textAnchor="end"
                                                    height={60}
                                                    tickFormatter={(v) => truncateLabel(v, 18)}
                                                />
                                                <YAxis allowDecimals={false} />
                                                <Tooltip formatter={(value) => `${toNumber(value)} incidentes`} />
                                                <Legend />
                                                <Bar dataKey="count" name="Cantidad de Incidentes" fill="#ffc658" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </div>
            )}
        </PageContainer>
    );
};

export default ReportsUsagePage;
