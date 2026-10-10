// src/components/scheduling/scheduleModel.js
// Modelo del bloque "¿Cuándo enviar?" compartido por los modales de circular y
// notificación. Usa la hora REAL (no useCurrentDate): el job del backend dispara
// con el reloj real, así que validar contra una fecha simulada dejaría programar
// envíos "futuros" que en realidad ya pasaron.
//
// Las horas son SIEMPRE de Guatemala, sin importar la zona del navegador: el
// valor viaja como texto `YYYY-MM-DDTHH:mm` y el backend lo interpreta así.
import moment from 'moment-timezone';

export const SCHEDULE_TIMEZONE = 'America/Guatemala';
const LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm';
const DATE_FORMAT = 'YYYY-MM-DD';
// Mismo límite que el backend (scheduleRules.MAX_AHEAD_MS).
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

export const WEEKDAYS = [
    { value: 1, label: 'Lun', name: 'lunes' },
    { value: 2, label: 'Mar', name: 'martes' },
    { value: 3, label: 'Mié', name: 'miércoles' },
    { value: 4, label: 'Jue', name: 'jueves' },
    { value: 5, label: 'Vie', name: 'viernes' },
    { value: 6, label: 'Sáb', name: 'sábado' },
    { value: 7, label: 'Dom', name: 'domingo' },
];

export const FREQUENCIES = [
    { value: 'once', label: 'No repetir (una sola vez)' },
    { value: 'daily', label: 'Todos los días' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensual' },
];

export const EMPTY_SCHEDULE = {
    mode: 'now',
    startAt: '',
    frequency: 'once',
    daysOfWeek: [],
    dayOfMonth: '',
    endDate: '',
};

const invalid = (message) => ({ valid: false, message });

export function validateSchedule(value, now = new Date()) {
    if (value.mode !== 'scheduled') return { valid: true };

    const start = moment.tz(value.startAt, LOCAL_FORMAT, true, SCHEDULE_TIMEZONE);
    if (!start.isValid()) return invalid('Indica la fecha y hora del envío.');
    if (start.valueOf() < now.getTime() + 60 * 1000) return invalid('La fecha de envío debe ser al menos un minuto en el futuro.');
    if (start.valueOf() > now.getTime() + MAX_AHEAD_MS) return invalid('La fecha de envío no puede ser a más de un año.');

    if (value.frequency === 'weekly' && value.daysOfWeek.length === 0) {
        return invalid('Selecciona al menos un día de la semana.');
    }
    if (value.frequency === 'monthly' && value.dayOfMonth !== '') {
        const day = Number(value.dayOfMonth);
        if (!Number.isInteger(day) || day < 1 || day > 31) return invalid('El día del mes debe estar entre 1 y 31.');
    }
    if (value.frequency !== 'once' && value.endDate) {
        if (moment.tz(value.endDate, DATE_FORMAT, true, SCHEDULE_TIMEZONE).isBefore(start, 'day')) {
            return invalid('La fecha de fin no puede ser anterior al primer envío.');
        }
    }
    return { valid: true };
}

export function buildSchedulePayload(value) {
    if (value.frequency === 'once') return { startAt: value.startAt, recurrence: null };
    return {
        startAt: value.startAt,
        recurrence: {
            frequency: value.frequency,
            daysOfWeek: value.frequency === 'weekly' ? [...value.daysOfWeek].sort((a, b) => a - b) : [],
            dayOfMonth: value.frequency === 'monthly' && value.dayOfMonth !== '' ? Number(value.dayOfMonth) : null,
            endDate: value.endDate || null,
        },
    };
}

// Para editar: el primer envío se precarga con la próxima ocurrencia (siempre
// futura), así guardar sin tocar la programación sigue siendo válido.
export function scheduleFromPayload(schedule, nextRunAt) {
    const recurrence = schedule?.recurrence || null;
    return {
        mode: 'scheduled',
        startAt: nextRunAt ? moment(nextRunAt).tz(SCHEDULE_TIMEZONE).format(LOCAL_FORMAT) : (schedule?.startAt || ''),
        frequency: recurrence?.frequency || 'once',
        daysOfWeek: recurrence?.daysOfWeek || [],
        dayOfMonth: recurrence?.dayOfMonth ? String(recurrence.dayOfMonth) : '',
        endDate: recurrence?.endDate || '',
    };
}

function joinSpanish(items) {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

export function describeSchedule(schedule) {
    if (!schedule?.startAt) return '';
    const start = moment(schedule.startAt, LOCAL_FORMAT);
    const time = start.format('h:mm A');
    const recurrence = schedule.recurrence;

    if (!recurrence) return `Una sola vez, el ${start.format('DD/MM/YYYY')} a las ${time}`;

    let text;
    if (recurrence.frequency === 'daily') {
        text = `Todos los días a las ${time}`;
    } else if (recurrence.frequency === 'weekly') {
        const names = WEEKDAYS.filter((d) => (recurrence.daysOfWeek || []).includes(d.value)).map((d) => d.name);
        text = `Cada ${joinSpanish(names)} a las ${time}`;
    } else {
        const day = recurrence.dayOfMonth || start.date();
        text = `El día ${day} de cada mes a las ${time}`;
        if (day > 28) text += ' (o el último día, si el mes es más corto)';
    }
    text += `, desde el ${start.format('DD/MM/YYYY')}`;
    text += recurrence.endDate
        ? ` hasta el ${moment(recurrence.endDate, 'YYYY-MM-DD').format('DD/MM/YYYY')}`
        : ', sin fecha de fin';
    return text;
}
