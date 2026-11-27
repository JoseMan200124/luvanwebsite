// src/utils/dateFormat.js
// Formatos únicos de fecha y hora. Un valor vacío o inválido se muestra igual en todas las pantallas: '—'.
// { keepZone: true } lee la fecha con la zona con la que viene (moment.parseZone), sin pasarla a la hora
// de Guatemala: lo usan las fechas de Pagos guardadas a medianoche UTC, para que no se corran un día.
import moment from 'moment-timezone';
import { APP_TIMEZONE } from './momentSetup';

export const EMPTY_VALUE = '—';

const isEmpty = (value) => value === null || value === undefined || value === '';

// Los textos se leen como ISO 8601 (así moment no avisa por formatos ambiguos); si no lo son, como los lee Date.
// Date, número y moment se aceptan tal cual.
// { utc: true }: un texto sin zona se toma como UTC y se muestra en la hora de Guatemala (antes moment.utc(x).tz(...)).
const parse = (value, { keepZone = false, utc = false } = {}) => {
    if (isEmpty(value)) {
        return null;
    }
    let parsed;
    if (typeof value === 'string') {
        if (keepZone) {
            parsed = moment.parseZone(value, moment.ISO_8601);
        } else if (utc) {
            parsed = moment.utc(value, moment.ISO_8601).tz(APP_TIMEZONE);
        } else {
            parsed = moment(value, moment.ISO_8601);
        }
        if (!parsed.isValid()) {
            parsed = moment(new Date(value));
        }
    } else {
        parsed = moment(value);
    }
    return parsed.isValid() ? parsed : null;
};

const formatter = (pattern) => (value, options) => {
    const parsed = parse(value, options);
    return parsed ? parsed.format(pattern) : EMPTY_VALUE;
};

export const formatDate = formatter('DD/MM/YYYY');
// Fecha corta: solo donde el espacio de la tabla lo pide (Pagos).
export const formatDateShort = formatter('DD/MM/YY');
export const formatDateTime = formatter('DD/MM/YYYY hh:mm A');
export const formatTime = formatter('hh:mm A');
export const formatMonth = formatter('MMMM YYYY');
export const formatDateLong = formatter('D [de] MMMM [de] YYYY');

// Hora del día que viene como texto ('07:30:00', '19:05', '7:30 PM'): no es una fecha y no se convierte de zona.
// Se muestra como la mostraban los horarios: '7:30 AM', sin cero adelante. Un texto que no es una hora queda tal cual.
export const formatClock = (value) => {
    if (isEmpty(value)) {
        return EMPTY_VALUE;
    }
    const text = String(value).trim();
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:([ap])\.?\s*m\.?)?$/i.exec(text);
    if (!match) {
        return text;
    }
    let hours = Number(match[1]);
    if (match[3]) {
        if (hours < 1 || hours > 12) {
            return text;
        }
        hours = (hours % 12) + (match[3].toLowerCase() === 'p' ? 12 : 0);
    } else if (hours > 23) {
        return text;
    }
    const hours12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hours12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`;
};

export const toApiDate = (value, options) => {
    const parsed = parse(value, options);
    return parsed ? parsed.format('YYYY-MM-DD') : null;
};

export const toApiMonth = (value, options) => {
    const parsed = parse(value, options);
    return parsed ? parsed.format('YYYY-MM') : null;
};
