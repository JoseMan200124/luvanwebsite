// src/pages/FinancialStatisticsPage.jsx

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    OutlinedInput,
    FormControlLabel,
    ToggleButton,
    ToggleButtonGroup,
    TextField,
    Tooltip,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    Paper
} from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import api from '../utils/axiosConfig';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import { getCurrentDateSync } from '../hooks/useCurrentDate';
import tw from 'twin.macro';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import moment from 'moment-timezone';

moment.tz.setDefault('America/Guatemala');

// Contenedor principal con twin.macro
const PageContainer = tw.div`
  p-8 w-full bg-gray-100 flex flex-col min-h-screen
`;

// ----------------------------------------------------------------------------
// Presentación: el backend calcula TODAS las métricas; el frontend sólo formatea.
// `null`/`undefined` => "N/A" (p. ej. divisiones por cero resueltas en el backend).
// ----------------------------------------------------------------------------
const formatMoneyOrNA = (value) => (value === null || value === undefined)
    ? 'N/A'
    : `Q ${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercentOrNA = (value) => (value === null || value === undefined)
    ? 'N/A'
    : `${Number(value).toFixed(1)}%`;
const formatTrend = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const sign = Number(value) >= 0 ? '+' : '';
    return `${sign}${Number(value).toFixed(1)}%`;
};
const basisValue = (obj, basis) => (obj && typeof obj === 'object') ? obj[basis] : null;

// Descriptores de métricas reutilizados por la tabla (por colegio) y las tarjetas (global).
const METRIC_COLUMNS = [
    { key: 'familiasActivas', label: 'Familias Activas', type: 'int', color: '#1976d2' },
    { key: 'tasaDePago', label: 'Tasa de Pago', type: 'percent', color: '#4caf50' },
    { key: 'tasaDeMora', label: 'Tasa de Mora', type: 'percent', color: '#f44336' },
    { key: 'tasaPuntualidad', label: 'Puntualidad', type: 'percent', color: '#00897b' },
    { key: 'eficienciaCobro', label: 'Eficiencia de Cobro', type: 'percent', color: '#2196f3' },
    { key: 'ingresoTarifa', label: 'Ingreso por Tarifa', type: 'money', basis: true, color: '#4caf50' },
    { key: 'ingresoPorMora', label: 'Ingreso por Mora', type: 'money', basis: true, color: '#ff9800' },
    { key: 'ingresoTotal', label: 'Ingreso Total', type: 'money', basis: true, color: '#2e7d32' },
    { key: 'tendencia', label: 'Tendencia', type: 'trend', basis: true, color: '#607d8b' },
    { key: 'promedioPorFamilia', label: 'Prom. por Familia', type: 'money', basis: true, color: '#5e35b1' },
    { key: 'totalDescuentos', label: 'Total Descuentos', type: 'money', color: '#795548' },
    { key: 'descuentosMoraExonerados', label: 'Mora Exonerada', type: 'money', color: '#607d8b' },
    { key: 'totalPendiente', label: 'Total Pendiente', type: 'money', color: '#f44336' },
    { key: 'moraPendiente', label: 'Mora Pendiente', type: 'money', color: '#d32f2f' },
    { key: 'creditoAcumulado', label: 'Crédito Acumulado', type: 'money', color: '#9c27b0' }
];

const formatMetric = (metrics, col, basis) => {
    if (!metrics) return 'N/A';
    let raw = metrics[col.key];
    if (col.basis) raw = basisValue(raw, basis);
    if (col.type === 'percent') return formatPercentOrNA(raw);
    if (col.type === 'trend') return formatTrend(raw);
    if (col.type === 'int') return (raw === null || raw === undefined) ? 'N/A' : String(raw);
    return formatMoneyOrNA(raw);
};

// Tooltip text helper por métrica (explica qué mide y alcance/base cuando aplica)
const getMetricTooltip = (key) => {
    switch (key) {
        case 'tasaDePago':
            return "Porcentaje de familias que completaron el pago de su cuota en el período seleccionado. El denominador solo incluye familias con estado Activo o Suspendido (las que están usando el servicio ese mes). Las familias Pausadas o Inactivas no tienen cuota y no entran en el cálculo. La condición de 'Activo'/'Suspendido' se evalúa según el estado que tenían al cierre del período seleccionado.";
        case 'tasaDeMora':
            return "Porcentaje de familias con cuota en el período seleccionado (Activo o Suspendido) que tienen mora generada en ese mes específico. No incluye mora arrastrada de meses anteriores — esa se muestra en 'Mora Pendiente'. La pertenencia a 'Activo'/'Suspendido' se evalúa según el estado que tenían al cierre del período seleccionado.";
        case 'eficienciaCobro':
            return "Porcentaje del monto facturado en el período que ya fue cobrado. Fórmula: (monto cobrado ÷ monto neto facturado) × 100. El monto neto ya tiene descontados los descuentos especiales de cada familia.";
        case 'tendencia':
            return "Variación porcentual del ingreso del período seleccionado respecto al mes inmediato anterior. Verde (+) = más recaudado; rojo (−) = menos. Calculada con la base activa (Caja o Devengado).";
        case 'tasaPuntualidad':
            return "De las familias que completaron su pago en el período seleccionado, qué porcentaje lo hizo antes o exactamente en la fecha límite de pago (sin generar mora).";
        case 'ingresoTarifa':
        case 'ingresoTotal':
            return "Total de tarifas de colegiatura cobradas en el rango seleccionado. Base Caja: se agrupa por fecha de recepción del pago. Base Devengado: se agrupa por el mes al que corresponde la cuota. No incluye pagos extraordinarios.";
        case 'ingresoPorMora':
            return "Total cobrado por concepto de mora en el período seleccionado. Base Caja: pagos de mora recibidos en este mes. Base Devengado: mora asignada al período correspondiente.";
        case 'promedioMensual':
            return "Ingreso promedio mensual en lo que va del año (acumulado ÷ meses transcurridos). Varía según la base Caja/Devengado.";
        case 'promedioPorFamilia':
            return "Ingreso del período seleccionado dividido entre el número de familias activas (Activo o Suspendido) al cierre del período. La clasificación de 'Activo'/'Suspendido' se evalúa según el estado que tenían al cierre del período seleccionado.";
        case 'totalPendiente':
            return "Suma de cuotas de colegiatura sin pagar acumuladas hasta el cierre del período seleccionado. Incluye todas las familias del ciclo, independientemente de su estado actual. No incluye mora (ver 'Mora Pendiente').";
        case 'moraPendiente':
            return "Suma total de penalidades por mora sin pagar hasta el cierre del período seleccionado. Incluye todas las familias del ciclo porque la mora no desaparece al cambiar de estado.";
        case 'creditoAcumulado':
            return "Saldo a favor total de todas las familias del ciclo al cierre del período seleccionado. Incluye familias pausadas o inactivas porque el crédito es un derecho de la familia independientemente de su estado.";
        case 'totalDescuentos':
            return "Suma de descuentos aplicados a las cuotas en el período seleccionado para familias con cuota activa. Incluye descuentos permanentes y extraordinarios. La condición de 'con cuota activa' se evalúa según el estado que tenían al cierre del período seleccionado. No incluye exoneraciones de mora.";
        case 'descuentosMoraExonerados':
            return "Mora perdonada o condonada en el período seleccionado; representa deuda generada que se decidió no cobrar. Se reporta para familias con cuota activa y la condición se evalúa según el estado que tenían al cierre del período seleccionado.";
        default:
            return '';
    }
};

const FinancialStatisticsPage = () => {
    const reportRef = useRef();

    const [schools, setSchools] = useState([]);
    const [allSchoolsSelected, setAllSchoolsSelected] = useState(true);
    const [selectedSchoolIds, setSelectedSchoolIds] = useState([]);
    const [fromMonth, setFromMonth] = useState(() => getCurrentDateSync().clone().subtract(5, 'month').format('YYYY-MM'));
    const [toMonth, setToMonth] = useState(() => getCurrentDateSync().format('YYYY-MM'));
    const [groupBy, setGroupBy] = useState('school'); // 'school' | 'none'
    const [metricsBasis, setMetricsBasis] = useState('caja'); // 'caja' | 'devengado'

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSchools = useCallback(async () => {
        try {
            const res = await api.get('/schools');
            setSchools(res.data.schools || []);
        } catch (e) {
            console.error('fetchSchools error', e);
        }
    }, []);

    const fetchStatistics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const schoolIdsParam = (allSchoolsSelected || selectedSchoolIds.length === 0)
                ? 'all'
                : selectedSchoolIds.join(',');
            const res = await api.get('/financial-statistics', {
                params: { schoolIds: schoolIdsParam, from: fromMonth, to: toMonth, groupBy }
            });
            setResult(res.data || null);
        } catch (e) {
            console.error('fetchStatistics error', e);
            setError('Error al obtener las estadísticas financieras. Por favor, inténtalo de nuevo más tarde.');
            setResult(null);
        } finally {
            setLoading(false);
        }
    }, [allSchoolsSelected, selectedSchoolIds, fromMonth, toMonth, groupBy]);

    useEffect(() => {
        fetchSchools();
    }, [fetchSchools]);

    useEffect(() => {
        // Carga inicial con los filtros por defecto.
        fetchStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchStatistics();
    }, [fetchStatistics]);

    const handleSchoolSelectChange = (event) => {
        const value = event.target.value;
        setSelectedSchoolIds(typeof value === 'string' ? value.split(',').map(Number) : value);
    };

    let rangeLabel = '';
    if (result) {
        const fromLabel = moment(`${result.from}-01`).format('MMMM YYYY');
        const toLabel = moment(`${result.to}-01`).format('MMMM YYYY');
        rangeLabel = `${fromLabel} — ${toLabel}`;
    }

    // Función para generar PDF (se conserva la lógica original; envuelve el contenido del reporte).
    const generatePDF = async () => {
        if (!reportRef.current) return;
        const now = moment();
        const dateString = now.format('YYYY_MM_DD_HH_mm');
        const fileName = `estadisticas_financieras_${dateString}.pdf`.toLowerCase();

        const printableArea = reportRef.current.cloneNode(true);

        const tempDiv = document.createElement('div');
        tempDiv.style.padding = '20px';
        tempDiv.style.backgroundColor = '#fff';
        tempDiv.style.color = '#000';
        tempDiv.style.width = '297mm';
        tempDiv.style.minHeight = '210mm';
        tempDiv.style.margin = '0 auto';

        const heading = document.createElement('h2');
        heading.style.textAlign = 'center';
        heading.textContent = 'Reporte de Estadísticas Financieras';

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
        const pdf = new jsPDF('l', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(fileName);

        tempDiv.remove();
    };

    const renderSchoolTable = () => {
        const colegios = result?.colegios || [];
        const totales = result?.totales?.metrics || null;
        const basisLabel = metricsBasis === 'devengado' ? 'Devengado' : 'Caja';
        return (
            <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
                    <TableHead>
                        <TableRow sx={{ background: '#f1f5f9' }}>
                            <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1 }}>Colegio</TableCell>
                            {METRIC_COLUMNS.map((col) => {
                                const tooltip = getMetricTooltip(col.key);
                                return (
                                    <TableCell key={col.key} align="right" sx={{ fontWeight: 700 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                            <span>{col.label}{col.basis ? ` (${basisLabel})` : ''}</span>
                                            {tooltip ? (
                                                <Tooltip title={tooltip} arrow>
                                                    <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                                </Tooltip>
                                            ) : null}
                                        </Box>
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {colegios.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={METRIC_COLUMNS.length + 1} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                    No hay colegios para el filtro seleccionado.
                                </TableCell>
                            </TableRow>
                        ) : colegios.map((colegio) => (
                            <TableRow key={colegio.schoolId} hover>
                                <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                                    {colegio.schoolName}
                                </TableCell>
                                {METRIC_COLUMNS.map((col) => {
                                    const text = formatMetric(colegio.metrics, col, metricsBasis);
                                    let trendColor;
                                    if (col.type === 'trend' && text !== 'N/A') {
                                        trendColor = text.startsWith('-') ? '#f44336' : '#4caf50';
                                    }
                                    return (
                                        <TableCell key={col.key} align="right" sx={{ color: trendColor }}>{text}</TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                        {totales && colegios.length > 0 && (
                            <TableRow sx={{ background: '#eef2ff' }}>
                                <TableCell sx={{ fontWeight: 800, position: 'sticky', left: 0, background: '#eef2ff', zIndex: 1 }}>TOTAL</TableCell>
                                {METRIC_COLUMNS.map((col) => (
                                    <TableCell key={col.key} align="right" sx={{ fontWeight: 800 }}>
                                        {formatMetric(totales, col, metricsBasis)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    const renderGlobalCards = () => {
        const metrics = result?.metrics || null;
        const count = result?.schoolIds?.length || 0;
        const basisLabel = metricsBasis === 'devengado' ? 'Devengado' : 'Caja';
        return (
            <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.secondary' }}>
                    Totales globales de {count} colegio{count === 1 ? '' : 's'}{rangeLabel ? ` — ${rangeLabel}` : ''}
                </Typography>
                <Grid container spacing={2}>
                    {METRIC_COLUMNS.map((col) => (
                        <Grid item xs={12} sm={6} md={3} key={col.key}>
                            <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', height: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {col.label}{col.basis ? ` (${basisLabel})` : ''}
                                    </Typography>
                                    {getMetricTooltip(col.key) ? (
                                        <Tooltip title={getMetricTooltip(col.key)} arrow>
                                            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                        </Tooltip>
                                    ) : null}
                                </Box>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: col.color }}>
                                    {formatMetric(metrics, col, metricsBasis)}
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    };

    let reportContent;
    if (!result) {
        reportContent = (
            <Typography variant="body2" color="textSecondary">
                No hay datos para mostrar con los filtros seleccionados.
            </Typography>
        );
    } else if (groupBy === 'school') {
        reportContent = renderSchoolTable();
    } else {
        reportContent = renderGlobalCards();
    }

    return (
        <PageContainer>
            <Typography variant="h4" gutterBottom>
                Estadísticas Financieras
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Todas las métricas se calculan en el backend sobre el ciclo escolar vigente de cada colegio.
            </Typography>

            {/* Filtros */}
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="flex-start">
                        <Grid item xs={12} md={4}>
                            <FormControlLabel
                                control={(
                                    <Checkbox
                                        checked={allSchoolsSelected}
                                        onChange={(e) => setAllSchoolsSelected(e.target.checked)}
                                    />
                                )}
                                label="Todos los colegios"
                            />
                            <FormControl fullWidth size="small" disabled={allSchoolsSelected} sx={{ mt: 1 }}>
                                <InputLabel id="schools-multiselect-label">Colegios</InputLabel>
                                <Select
                                    labelId="schools-multiselect-label"
                                    multiple
                                    value={selectedSchoolIds}
                                    onChange={handleSchoolSelectChange}
                                    input={<OutlinedInput label="Colegios" />}
                                    renderValue={(selected) => schools
                                        .filter((s) => selected.includes(s.id))
                                        .map((s) => s.name)
                                        .join(', ')}
                                >
                                    {schools.map((school) => (
                                        <MenuItem key={school.id} value={school.id}>
                                            <Checkbox checked={selectedSchoolIds.includes(school.id)} />
                                            <ListItemText primary={school.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={6} md={2}>
                            <TextField
                                fullWidth
                                size="small"
                                type="month"
                                label="Desde"
                                value={fromMonth}
                                onChange={(e) => setFromMonth(e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                            />
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <TextField
                                fullWidth
                                size="small"
                                type="month"
                                label="Hasta"
                                value={toMonth}
                                onChange={(e) => setToMonth(e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                            />
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <ToggleButtonGroup
                                    size="small"
                                    exclusive
                                    value={groupBy}
                                    onChange={(e, v) => { if (v) setGroupBy(v); }}
                                >
                                    <ToggleButton value="school">Ver por colegio</ToggleButton>
                                    <ToggleButton value="none">Ver totales globales</ToggleButton>
                                </ToggleButtonGroup>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">Base</Typography>
                                    <Tooltip title="Caja = dinero efectivamente cobrado (por fecha de pago). Devengado = lo que correspondía facturar en el período." arrow>
                                        <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                    </Tooltip>
                                    <ToggleButtonGroup
                                        size="small"
                                        exclusive
                                        value={metricsBasis}
                                        onChange={(e, v) => { if (v) setMetricsBasis(v); }}
                                    >
                                        <ToggleButton value="caja">Caja</ToggleButton>
                                        <ToggleButton value="devengado">Devengado</ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                        <Button variant="contained" color="primary" onClick={fetchStatistics} disabled={loading}>
                            Aplicar filtros
                        </Button>
                        <Button variant="outlined" color="primary" onClick={generatePDF} disabled={loading || !result}>
                            Generar PDF
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '16rem' }}>
                    <CircularProgress />
                </div>
            ) : (
                <div ref={reportRef} style={{ backgroundColor: '#fff', padding: '16px', overflowX: 'auto' }}>
                    <Typography variant="h6" gutterBottom>
                        {groupBy === 'school' ? 'Detalle por colegio' : 'Totales globales'}
                        {rangeLabel ? ` · ${rangeLabel}` : ''}
                    </Typography>
                    {reportContent}
                </div>
            )}

            <Snackbar open={Boolean(error)} autoHideDuration={6000} onClose={() => setError(null)}>
                <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default FinancialStatisticsPage;
