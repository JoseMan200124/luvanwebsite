// src/utils/currency.js
// Formato único de montos: 'Q 1,234.50'. Se usa el formato numérico en-US porque es el mismo que es-GT
// (coma de miles y punto decimal) y no depende de los datos de idioma del navegador.

const isEmpty = (value) => value === null || value === undefined || value === '';

const toNumber = (value) => {
    if (isEmpty(value)) {
        return null;
    }
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
};

export const formatNumber = (value, { decimals = 0, nullText = '—' } = {}) => {
    const number = toNumber(value);
    if (number === null) {
        return nullText;
    }
    return number.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const formatQ = (value, { nullText = '—' } = {}) => {
    const number = toNumber(value);
    if (number === null) {
        return nullText;
    }
    const sign = number < 0 ? '-' : '';
    return `${sign}Q ${formatNumber(Math.abs(number), { decimals: 2 })}`;
};

// Lee un monto escrito por el usuario: 'Q 1,234.50' → 1234.5.
export const parseAmount = (text) => {
    const cleaned = String(text ?? '').replace(/q/gi, '').replace(/[\s,]/g, '');
    if (cleaned === '') {
        return null;
    }
    const number = Number(cleaned);
    return Number.isNaN(number) ? null : number;
};
