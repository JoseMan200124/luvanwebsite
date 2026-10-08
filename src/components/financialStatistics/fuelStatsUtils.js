// src/components/financialStatistics/fuelStatsUtils.js
// Constantes y helpers puros de la pestaña Combustible. El backend calcula las
// métricas; aquí solo se formatea y se adapta para gráficos.

import moment from 'moment-timezone';

export const FUEL_TYPES = [
    { key: 'diesel', label: 'Diesel', color: '#1976D2' },
    { key: 'ion_diesel', label: 'Ion Diesel', color: '#2e7d32' },
    { key: 'super', label: 'Super', color: '#E65100' },
    { key: 'regular', label: 'Regular', color: '#7b1fa2' }
];

export const FUELING_REASONS = [
    { key: 'ruta', label: 'Ruta Normal' },
    { key: 'mecanico', label: 'Visita al Mecánico' },
    { key: 'excursion', label: 'Excursión/Evento' },
    { key: 'admin', label: 'Administrativo' },
    { key: 'suplente', label: 'Suplente' }
];

export const GRANULARITIES = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'quarter', label: 'Trimestre' },
    { key: 'year', label: 'Año' }
];
export const ALL_OPTION = '__ALL__';

export const DATE_PRESETS = [
    { key: 'thisMonth', label: 'Este mes' },
    { key: 'thisQuarter', label: 'Este trimestre' },
    { key: 'ytd', label: 'Año a la fecha' },
    { key: 'last6Months', label: 'Últimos 6 meses' }
];

/** `today` debe venir de getCurrentDateSync() para respetar la fecha simulada. */
export const computePresetRange = (presetKey, today) => {
    const t = moment(today).startOf('day');
    const fmt = (m) => m.format('YYYY-MM');
    switch (presetKey) {
        case 'thisMonth': return { fromMonth: fmt(t), toMonth: fmt(t), granularity: 'day' };
        case 'thisQuarter': return { fromMonth: fmt(t.clone().startOf('quarter')), toMonth: fmt(t), granularity: 'week' };
        case 'ytd': return { fromMonth: fmt(t.clone().startOf('year')), toMonth: fmt(t), granularity: 'month' };
        case 'last6Months': return { fromMonth: fmt(t.clone().subtract(5, 'month')), toMonth: fmt(t), granularity: 'month' };
        default: return null;
    }
};

/**
 * Meses Desde/Hasta → días para el backend: del día 1 del primer mes al último
 * día del segundo, cortando en hoy para no graficar días futuros vacíos.
 */
export const monthRangeToDates = (fromMonth, toMonth, today) => {
    const [a, b] = toMonth < fromMonth ? [toMonth, fromMonth] : [fromMonth, toMonth];
    const from = moment(`${a}-01`, 'YYYY-MM-DD').startOf('month');
    const endOfTo = moment(`${b}-01`, 'YYYY-MM-DD').endOf('month').startOf('day');
    const t = moment(today).startOf('day');
    const to = endOfTo.isAfter(t) && !t.isBefore(from) ? t : endOfTo;
    return { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') };
};

const selectedValues = (selected) => (Array.isArray(selected) && !selected.includes(ALL_OPTION) ? selected : []);

export const buildClientsParam = (selected) => {
    const values = selectedValues(selected);
    return values.length > 0 ? values.join(',') : 'all';
};
export const buildListParam = (selected) => {
    const values = selectedValues(selected);
    return values.length > 0 ? values.join(',') : undefined;
};

const formatNumber = (v) => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatMoney = (v) => (v === null || v === undefined ? 'N/A' : `Q ${formatNumber(v)}`);
export const formatGallons = (v) => (v === null || v === undefined ? 'N/A' : `${formatNumber(v)} gal`);
export const formatPercent = (v) => (v === null || v === undefined ? 'N/A' : `${Number(v).toFixed(1)}%`);

export const typesWithData = (byType) => FUEL_TYPES.filter((t) => Number(byType?.[t.key]?.gallons) > 0);

export const clientTagLabel = (client) => {
    if (client.clientType === 'corporation') return 'Corporación';
    if (client.clientType === 'none') return 'Sin cliente';
    return client.cicloEscolarAnio ? String(client.cicloEscolarAnio) : '—';
};

export const reasonLabel = (key) => FUELING_REASONS.find((r) => r.key === key)?.label || key;

// Precio: null se conserva para que la línea tenga un hueco (no caiga a 0).
export const toPriceChartData = (series) => series.map((s) => {
    const point = { label: s.label };
    for (const t of FUEL_TYPES) point[t.key] = s.byType?.[t.key]?.price ?? null;
    return point;
});

export const toSpendChartData = (series) => series.map((s) => {
    const point = { label: s.label };
    for (const t of FUEL_TYPES) point[t.key] = s.byType?.[t.key]?.amount ?? 0;
    return point;
});
