// src/components/filters/filterFields.js
// Catálogo de campos de filtro con etiquetas, anchos y valores iniciales canónicos.
import { getInitialCicloEscolarFilter } from '../../utils/cicloEscolarFilterParams';
import { parseClient, serializeClient } from '../../utils/clientValue';

export const FILTER_WIDTHS = { sm: 150, md: 200, lg: 280 };
export const EMPTY_RANGE = { from: '', to: '' };

export const YES_NO_OPTIONS = [
    { value: 'true', label: 'Sí' },
    { value: 'false', label: 'No' },
];

export const WEEKDAY_OPTIONS = [
    { value: 'monday', label: 'Lunes' },
    { value: 'tuesday', label: 'Martes' },
    { value: 'wednesday', label: 'Miércoles' },
    { value: 'thursday', label: 'Jueves' },
    { value: 'friday', label: 'Viernes' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' },
];

export const SERVICE_STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Activo' },
    { value: 'PAUSED', label: 'Pausado' },
    { value: 'SUSPENDED', label: 'Suspendido' },
    { value: 'INACTIVE', label: 'Inactivo' },
];

// Acepta { valor: etiqueta } o [{ value, label, group? }].
export const toOptions = (source) => (Array.isArray(source)
    ? source
    : Object.entries(source || {}).map(([value, label]) => ({ value, label })));

// Placas únicas de una lista de buses, como opciones de select.
export const toPlateOptions = (buses) => [...new Set((buses || []).map((bus) => bus?.plate).filter(Boolean))]
    .map((plate) => ({ value: plate, label: plate }));

// Números de ruta ordenados de forma natural (2 antes que 10), como opciones de select.
export const toRouteOptions = (routes) => [...new Set((routes || []).filter((route) => route !== null && route !== undefined && route !== '').map(String))]
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    .map((route) => ({ value: route, label: route }));

const serializeRange = (value) => `${value?.from || ''}~${value?.to || ''}`;
const parseRange = (raw) => {
    const [from = '', to = ''] = String(raw).split('~');
    return { from, to };
};
const serializeOption = (value) => (value ? `${value.value}~${value.label ?? ''}` : '');
const parseOption = (raw) => {
    const text = String(raw || '');
    if (!text) {
        return null;
    }
    const index = text.indexOf('~');
    return index < 0 ? { value: text, label: text } : { value: text.slice(0, index), label: text.slice(index + 1) };
};

const base = (key, type, label, extra = {}) => ({ key, type, label, width: 'md', initial: '', ...extra });

export const F = {
    search: (key = 'search', extra = {}) => base(key, 'search', 'Buscar', { width: 'lg', ...extra }),
    select: (key, { options = [], ...extra } = {}) => base(key, 'select', key, {
        allLabel: 'Todos', ...extra, options: toOptions(options),
    }),
    multiSelect: (key, { options = [], ...extra } = {}) => base(key, 'select', key, {
        multiple: true,
        initial: [],
        allLabel: 'Todos',
        serialize: (value) => (value || []).join(','),
        parse: (raw) => String(raw).split(',').filter(Boolean),
        ...extra,
        options: toOptions(options),
    }),
    autocomplete: (key, extra = {}) => base(key, 'autocomplete', key, {
        initial: null, minChars: 2, serialize: serializeOption, parse: parseOption, ...extra,
    }),
    cycle: (extra = {}) => base('cycle', 'cycle', 'Ciclo escolar', {
        initial: getInitialCicloEscolarFilter, allLabel: 'Todos los ciclos', ...extra,
    }),
    client: (extra = {}) => base('client', 'client', 'Cliente', {
        width: 'lg',
        initial: null,
        dependsOn: 'cycle',
        requireParent: false,
        schools: [],
        corporations: [],
        extraOptions: [],
        serialize: serializeClient,
        parse: parseClient,
        ...extra,
    }),
    plate: (extra = {}) => base('plate', 'select', 'Placa', {
        width: 'sm', dependsOn: 'client', allLabel: 'Todas', ...extra, options: toOptions(extra.options || []),
    }),
    route: (extra = {}) => base('route', 'select', 'Ruta', {
        width: 'sm', dependsOn: 'client', allLabel: 'Todas', ...extra, options: toOptions(extra.options || []),
    }),
    schedule: (extra = {}) => base('schedule', 'select', 'Horario', {
        width: 'sm', allLabel: 'Todos', ...extra, options: toOptions(extra.options || []),
    }),
    weekday: (extra = {}) => base('day', 'select', 'Día', {
        width: 'sm', allLabel: 'Todos', ...extra, options: toOptions(extra.options || WEEKDAY_OPTIONS),
    }),
    serviceStatus: (extra = {}) => base('serviceStatus', 'select', 'Estado del servicio', {
        allLabel: 'Todos', ...extra, options: toOptions(extra.options || SERVICE_STATUS_OPTIONS),
    }),
    switch: (key, extra = {}) => base(key, 'switch', key, {
        width: 'auto', initial: false, serialize: (value) => (value ? '1' : '0'), parse: (raw) => raw === '1', ...extra,
    }),
    toggle: (key, extra = {}) => base(key, 'toggle', key, { width: 'auto', ...extra, options: toOptions(extra.options || []) }),
    dateRange: (key = 'dates', extra = {}) => base(key, 'dateRange', 'Fechas', {
        width: 'auto', initial: EMPTY_RANGE, serialize: serializeRange, parse: parseRange, ...extra,
    }),
    monthRange: (key = 'months', extra = {}) => base(key, 'monthRange', 'Meses', {
        width: 'auto', initial: EMPTY_RANGE, serialize: serializeRange, parse: parseRange, ...extra,
    }),
    timeRange: (key = 'hours', extra = {}) => base(key, 'timeRange', 'Horas', {
        width: 'auto', initial: EMPTY_RANGE, serialize: serializeRange, parse: parseRange, ...extra,
    }),
};
