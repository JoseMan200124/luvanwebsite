// src/components/financialStatistics/fuelStatsPdf.js
// PDF de la pestaña Combustible dibujado con jsPDF/autoTable (no es captura de pantalla).
// Sigue el mismo formato que el reporte de la pestaña Ingresos.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment-timezone';
import {
    ADMIN_REASON, GRANULARITIES, clientTagLabel, formatChange, formatGallons, formatMoney, formatPercent, reasonLabel
} from './fuelStatsUtils';

const MARGIN_X = 12;
const TITLE = 'Reporte de Estadísticas de Combustible';
const HEAD_STYLES = { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold', fontSize: 7 };
const BASE_STYLES = { fontSize: 7, cellPadding: 1.6, textColor: [30, 30, 30] };
const TOTAL_FILL = [227, 242, 253];
const ADMIN_FILL = [243, 229, 245];

const hexToRgb = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Fila de tarjetas tipo KPI, igual que el reporte de Ingresos.
const drawKpiRow = (pdf, kpis, y, pageWidth) => {
    const gap = 4;
    const boxWidth = (pageWidth - MARGIN_X * 2 - gap * (kpis.length - 1)) / kpis.length;
    const boxHeight = 22;
    kpis.forEach((kpi, i) => {
        const x = MARGIN_X + i * (boxWidth + gap);
        pdf.setDrawColor(225);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');

        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(107, 114, 128);
        pdf.text(kpi.label.toUpperCase(), x + 3, y + 6.5);

        const [r, g, b] = hexToRgb(kpi.color);
        pdf.setFontSize(12.5);
        pdf.setTextColor(r, g, b);
        pdf.text(kpi.value, x + 3, y + 14.5);

        if (kpi.sub) {
            pdf.setFont(undefined, 'normal');
            pdf.setFontSize(7);
            pdf.setTextColor(107, 114, 128);
            pdf.text(kpi.sub, x + 3, y + 19.5, { maxWidth: boxWidth - 6 });
        }
    });
    return y + boxHeight;
};

export const generateFuelStatsPdf = (result, { visibleTypes, filtersLabel, rangeLabel }) => {
    if (!result) return;
    const now = moment();
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const granularityLabel = (GRANULARITIES.find((g) => g.key === result.granularity)?.label || result.granularity).toLowerCase();
    const { totals, changes } = result;

    // --- Encabezado ---
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(17, 24, 39);
    pdf.text(TITLE, MARGIN_X, 16);

    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`${rangeLabel}  ·  Agrupado por ${granularityLabel}`, MARGIN_X, 22);
    pdf.text(filtersLabel, MARGIN_X, 27, { maxWidth: pageWidth - MARGIN_X * 2 });
    pdf.text(`Generado el ${now.format('DD/MM/YYYY HH:mm')} (hora Guatemala)`, pageWidth - MARGIN_X, 16, { align: 'right' });

    pdf.setDrawColor(230);
    pdf.line(MARGIN_X, 31, pageWidth - MARGIN_X, 31);

    // --- Tarjetas: resumen general y precio por tipo ---
    const vsPrev = (pct) => `${formatChange(pct)} vs período anterior`;
    let cursorY = drawKpiRow(pdf, [
        { label: 'Gasto total', value: formatMoney(totals.amount), sub: vsPrev(changes.amount), color: '#E65100' },
        { label: 'Galones', value: formatGallons(totals.gallons), sub: vsPrev(changes.gallons), color: '#1976D2' },
        { label: 'Registros', value: String(totals.records), sub: vsPrev(changes.records), color: '#111827' },
        {
            label: 'Cargas administrativas',
            value: formatMoney(totals.admin.amount),
            sub: `${formatGallons(totals.admin.gallons)} · ${totals.admin.records} registro${totals.admin.records === 1 ? '' : 's'}`,
            color: '#7b1fa2'
        }
    ], 35, pageWidth) + 4;

    if (visibleTypes.length > 0) {
        cursorY = drawKpiRow(pdf, visibleTypes.map((t) => ({
            label: `Precio/galón · ${t.label}`,
            value: formatMoney(totals.byType[t.key].price),
            sub: `${formatGallons(totals.byType[t.key].gallons)} · ${vsPrev(changes.priceByType[t.key])}`,
            color: t.color
        })), cursorY, pageWidth) + 4;
    }

    // --- Tablas ---
    const priceHead = visibleTypes.map((t) => `Precio ${t.label}`);
    const priceRow = (byType) => visibleTypes.map((t) => formatMoney(byType?.[t.key]?.price));

    const section = (title, head, body, { highlightRow } = {}) => {
        let y = cursorY + 6;
        if (y > pageHeight - 30) {
            pdf.addPage();
            y = 22;
        }
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(17, 24, 39);
        pdf.text(title, MARGIN_X, y);

        const numericColumns = {};
        head.forEach((_, i) => { if (i > 0) numericColumns[i] = { halign: 'right' }; });

        autoTable(pdf, {
            startY: y + 2,
            margin: { left: MARGIN_X, right: MARGIN_X, top: 20, bottom: 14 },
            head: [head],
            body,
            styles: BASE_STYLES,
            headStyles: HEAD_STYLES,
            alternateRowStyles: { fillColor: [247, 247, 248] },
            columnStyles: numericColumns,
            didParseCell: (data) => {
                if (data.section !== 'body' || !highlightRow) return;
                const style = highlightRow(data.row.index);
                if (style) Object.assign(data.cell.styles, style);
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    pdf.setFont(undefined, 'bold');
                    pdf.setFontSize(10);
                    pdf.setTextColor(17, 24, 39);
                    pdf.text(`${TITLE} (continuación)`, MARGIN_X, 12);
                    pdf.setFont(undefined, 'normal');
                    pdf.setFontSize(8);
                    pdf.setTextColor(107, 114, 128);
                    pdf.text(rangeLabel, pageWidth - MARGIN_X, 12, { align: 'right' });
                }
            }
        });
        cursorY = pdf.lastAutoTable.finalY;
    };

    const periodBody = result.series.map((s) => [s.label, String(s.records), formatGallons(s.gallons), formatMoney(s.amount), ...priceRow(s.byType)]);
    periodBody.push(['TOTAL', String(totals.records), formatGallons(totals.gallons), formatMoney(totals.amount), ...priceRow(totals.byType)]);
    section('Por período', ['Período', 'Registros', 'Galones', 'Gasto', ...priceHead], periodBody, {
        highlightRow: (i) => (i === periodBody.length - 1 ? { fontStyle: 'bold', fillColor: TOTAL_FILL } : null)
    });

    section('Por cliente', ['Cliente', 'Ciclo / Tipo', 'Registros', 'Galones', 'Gasto', '% del gasto', 'Administrativo', ...priceHead],
        result.byClient.map((c) => [
            c.name, clientTagLabel(c), String(c.records), formatGallons(c.gallons), formatMoney(c.amount),
            formatPercent(c.shareOfAmount), c.adminAmount > 0 ? `${formatMoney(c.adminAmount)} (${c.adminRecords})` : '—', ...priceRow(c.byType)
        ]));

    const adminIndex = result.byReason.findIndex((r) => r.reason === ADMIN_REASON);
    section('Por razón de carga', ['Razón', 'Registros', 'Galones', 'Gasto', '% del gasto'],
        result.byReason.map((r) => [reasonLabel(r.reason), String(r.records), formatGallons(r.gallons), formatMoney(r.amount), formatPercent(r.shareOfAmount)]),
        { highlightRow: (i) => (i === adminIndex ? { fontStyle: 'bold', fillColor: ADMIN_FILL, textColor: [123, 31, 162] } : null) });

    // --- Pie de página ---
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Página ${i} de ${pageCount}`, pageWidth - MARGIN_X, pageHeight - 6, { align: 'right' });
    }

    pdf.save(`estadisticas_combustible_${now.format('YYYY_MM_DD_HH_mm')}.pdf`);
};
