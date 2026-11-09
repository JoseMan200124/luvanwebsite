// src/components/paradas/textoParada.js
import { DIAS } from './paradasModel';

const textoDias = (days) => DIAS.filter(d => (days || []).includes(d.key)).map(d => d.corto).join(' ') || 'sin días';

export const textoParada = (p) => [
    p.franja || 'sin franja',
    p.routeNumber ? `Ruta ${p.routeNumber}` : 'sin ruta',
    p.time || 'sin hora',
    textoDias(p.days),
    p.note || null,
].filter(Boolean).join(' · ');

export const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
export const fechaCorta = (v) => (v ? new Date(v).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit' }) : '');
