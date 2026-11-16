// src/components/filters/fields/fieldSx.js
import { FILTER_WIDTHS } from '../filterFields';

// Ancho estándar de un campo: 100% en móvil, ancho fijo por token desde `sm`.
export const getFieldSx = (width) => (width === 'auto'
    ? { width: { xs: '100%', sm: 'auto' } }
    : { width: { xs: '100%', sm: FILTER_WIDTHS[width] || FILTER_WIDTHS.md } });
