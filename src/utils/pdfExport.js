import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate a PDF from route occupancy data and trigger download.
 * Accepts either:
 * - routes: an array of route objects for a single day, and meta.selectedDayLabel provided
 * - dayMap: an object mapping day keys to arrays of routes, e.g. { monday: [...], tuesday: [...] }
 *
 * @param {Object|Array} data - either array (routes) or map of day => routes
 * @param {Object} meta - { schoolName, schoolYear, generatedAt (Date) }
 */
export function generateRouteOccupancyPDF(data = [], meta = {}) {
  const doc = new jsPDF({ orientation: 'portrait' });
  const schoolName = meta.schoolName || '';
  const schoolYear = meta.schoolYear || '';
  const generatedAt = meta.generatedAt ? new Date(meta.generatedAt) : new Date();

  const timestamp = generatedAt.toLocaleString();
  const title = `Resumen de Ocupación por Ruta`;

  // helper to build a table for a single day; always prints header and starts on fresh page
  const buildTable = (routes = [], dayLabel = '', isFirst = false) => {
    if (!isFirst) {
      doc.addPage();
    }

    // Header for each page
    doc.setFontSize(14);
    doc.text(schoolName || ' ', 14, 14);
    doc.setFontSize(10);
    doc.text(`Ciclo: ${schoolYear}`, 14, 20);
    doc.text(`Generado: ${generatedAt.toLocaleString()}`, 14, 26);

    doc.setFontSize(12);
    doc.text(`${title} ${dayLabel ? `- ${dayLabel}` : ''}`, 14, 36);

    const head = [['Número de Ruta', 'Horario AM', 'Horario MD', 'Horario PM', 'Horario EX', 'Total']];

    const rows = routes.map(r => {
      const am = Number(r.AM) || 0;
      const md = Number(r.MD) || 0;
      const pm = Number(r.PM) || 0;
      const ex = Number(r.EX) || 0;
      const total = am + md + pm + ex;
      return [`Ruta ${r.routeNumber}`, am, md, pm, ex, total];
    });

    const totals = rows.reduce((acc, r) => ({
      AM: acc.AM + (Number(r[1]) || 0),
      MD: acc.MD + (Number(r[2]) || 0),
      PM: acc.PM + (Number(r[3]) || 0),
      EX: acc.EX + (Number(r[4]) || 0),
      total: acc.total + (Number(r[5]) || 0)
    }), { AM: 0, MD: 0, PM: 0, EX: 0, total: 0 });

    rows.push(['Total', totals.AM, totals.MD, totals.PM, totals.EX, totals.total]);

    doc.autoTable({
      startY: 42,
      head: head,
      body: rows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [102, 126, 234], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      theme: 'grid',
      margin: { left: 14, right: 14 }
    });
  };

  // Header
  doc.setFontSize(14);
  doc.text(schoolName || ' ', 14, 14);
  doc.setFontSize(10);
  doc.text(`Ciclo: ${schoolYear}`, 14, 20);
  doc.text(`Generado: ${timestamp}`, 14, 26);

  // If data is an object (dayMap), iterate days in a reasonable order
  const isDayMap = typeof data === 'object' && !Array.isArray(data);
  if (isDayMap) {
    const order = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    let first = true;
    order.forEach(dayKey => {
      if (data[dayKey] && data[dayKey].length >= 0) {
        const label = meta.dayLabels && meta.dayLabels[dayKey] ? meta.dayLabels[dayKey] : dayKey;
        buildTable(data[dayKey], label, first);
        first = false;
      }
    });
  } else {
    // single-day array
    buildTable(data, meta.selectedDayLabel || meta.selectedDay || '', true);
  }

  const safeName = schoolName ? schoolName.replace(/\s+/g, '_') : 'school';
  const fileName = `ocupacion_rutas_${safeName}_${schoolYear || ''}.pdf`;
  doc.save(fileName);
}

/**
 * Generate a PDF from corporate route occupancy data grouped by schedules
 * @param {Object|Array} data - dayMap object { monday: routes[], tuesday: routes[], ... } or single routes array
 * @param {Object} meta - { corporationName, fiscalYear, generatedAt, schedules, dayLabels }
 */
export function generateCorporateRouteOccupancyPDF(data = [], meta = {}) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const corporationName = meta.corporationName || '';
  const fiscalYear = meta.fiscalYear || '';
  const generatedAt = meta.generatedAt ? new Date(meta.generatedAt) : new Date();
  const schedules = meta.schedules || [];

  const timestamp = generatedAt.toLocaleString();
  const title = `Resumen de Ocupación por Ruta y Horario`;

  // Helper to build a table for a single day
  const buildTable = (routes = [], dayLabel = '', isFirst = false) => {
    if (!isFirst) {
      doc.addPage();
    }

    // Header for each page
    doc.setFontSize(14);
    doc.text(corporationName || ' ', 14, 14);
    doc.setFontSize(10);
    doc.text(`Año Fiscal: ${fiscalYear}`, 14, 20);
    doc.text(`Generado: ${timestamp}`, 14, 26);

    doc.setFontSize(12);
    doc.text(`${title} ${dayLabel ? `- ${dayLabel}` : ''}`, 14, 36);

    // Build dynamic header based on schedules
    const headerRow = ['Ruta'];
    schedules.forEach(sched => {
      headerRow.push(`${sched.name} - Entrada`);
      headerRow.push(`${sched.name} - Salida`);
    });
    headerRow.push('Total');

    const head = [headerRow];

    // Build rows
    const rows = routes.map(route => {
      const row = [`Ruta ${route.routeNumber}`];
      let routeTotal = 0;

      schedules.forEach((sched, idx) => {
        const schedData = route.schedules?.[idx] || { entrada: 0, salida: 0 };
        const entrada = Number(schedData.entrada) || 0;
        const salida = Number(schedData.salida) || 0;
        row.push(entrada);
        row.push(salida);
        routeTotal += entrada + salida;
      });

      row.push(routeTotal);
      return row;
    });

    // Add totals row
    const totalsRow = ['Total'];
    let grandTotal = 0;

    schedules.forEach((sched, idx) => {
      let totalEntrada = 0;
      let totalSalida = 0;

      routes.forEach(route => {
        const schedData = route.schedules?.[idx] || { entrada: 0, salida: 0 };
        totalEntrada += Number(schedData.entrada) || 0;
        totalSalida += Number(schedData.salida) || 0;
      });

      totalsRow.push(totalEntrada);
      totalsRow.push(totalSalida);
      grandTotal += totalEntrada + totalSalida;
    });

    totalsRow.push(grandTotal);
    rows.push(totalsRow);

    doc.autoTable({
      startY: 42,
      head: head,
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [25, 118, 210], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      theme: 'grid',
      margin: { left: 14, right: 14 }
    });
  };

  // Check if data is dayMap or single array
  const isDayMap = typeof data === 'object' && !Array.isArray(data);
  
  if (isDayMap) {
    const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let first = true;
    
    order.forEach(dayKey => {
      if (data[dayKey] && data[dayKey].length >= 0) {
        const label = meta.dayLabels && meta.dayLabels[dayKey] ? meta.dayLabels[dayKey] : dayKey;
        buildTable(data[dayKey], label, first);
        first = false;
      }
    });
  } else {
    // Single-day array
    buildTable(data, meta.selectedDayLabel || meta.selectedDay || '', true);
  }

  const safeName = corporationName ? corporationName.replace(/\s+/g, '_') : 'corporation';
  const fileName = `ocupacion_rutas_${safeName}_${fiscalYear || ''}.pdf`;
  doc.save(fileName);
}
