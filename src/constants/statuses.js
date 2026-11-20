// src/constants/statuses.js
// Dominios de estado únicos: etiqueta, color e ícono opcional. Las etiquetas son la única fuente de texto
// de cada estado (chips, filtros, exportaciones y mensajes). El color es el que cada estado ya tenía en
// pantalla: un nombre de la paleta de MUI ('success', 'warning'…) o un hex, que StatusChip pinta igual.
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PauseIcon from '@mui/icons-material/Pause';
import BlockIcon from '@mui/icons-material/Block';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';

export const REQUEST_STATUS = {
    pending: { label: 'Pendiente', color: '#FB8C00', icon: HourglassEmptyIcon },
    in_review: { label: 'En revisión', color: '#42A5F5', icon: AutorenewIcon },
    approved: { label: 'Completada', color: '#4CAF50', icon: CheckCircleIcon },
    completed: { label: 'Completada', color: '#388E3C', icon: CheckCircleIcon },
    rejected: { label: 'Rechazada', color: '#E53935', icon: CancelIcon },
    cancelled: { label: 'Cancelada', color: '#9C27B0' },
};

export const SERVICE_STATUS = {
    ACTIVE: { label: 'Activo', color: 'success', icon: CheckCircleIcon },
    PAUSED: { label: 'Pausado', color: 'warning', icon: PauseIcon },
    SUSPENDED: { label: 'Suspendido', color: 'error', icon: BlockIcon },
    INACTIVE: { label: 'Inactivo', color: '#9e9e9e', icon: RemoveCircleIcon },
    PENDING_START: { label: 'Pendiente de inicio', color: 'info', icon: HourglassEmptyIcon },
};

// CONFIRMADO es el valor que usa la audiencia de envíos; PAGADO el de la tabla de pagos. ATRASADO es un alias viejo de MORA.
export const PAYMENT_STATUS = {
    CONFIRMADO: { label: 'Pagado', color: 'success' },
    PAGADO: { label: 'Pagado', color: 'success' },
    ADELANTADO: { label: 'Adelantado', color: 'info' },
    PENDIENTE: { label: 'Pendiente', color: 'warning' },
    MORA: { label: 'En mora', color: 'error' },
    ATRASADO: { label: 'En mora', color: 'error' },
    PARCIAL: { label: 'Pago parcial', color: '#7c4dff' },
};

export const ENROLLMENT_PAYMENT_STATUS = {
    PENDIENTE: { label: 'Pendiente', color: 'warning' },
    PARCIAL: { label: 'Parcial', color: 'info' },
    PAGADO: { label: 'Pagado', color: 'success' },
    SIN_CARGO: { label: 'Sin cargo de inscripción', color: 'default' },
};

export const RECEIPT_STATUS = {
    PENDIENTE: { label: 'Pendiente', color: '#2196f3' },
    REGISTRADA: { label: 'Registrada', color: '#4caf50' },
    RECHAZADA: { label: 'Rechazada', color: '#9e9e9e' },
};

export const SCHEDULED_SEND_STATUS = {
    active: { label: 'Activo', color: 'primary' },
    completed: { label: 'Completado', color: 'success' },
    partial: { label: 'Parcial', color: 'warning' },
    failed: { label: 'Fallido', color: 'error' },
    skipped: { label: 'Omitido', color: 'default' },
    cancelled: { label: 'Cancelado', color: 'default' },
};

export const SCHEDULED_RUN_STATUS = {
    running: { label: 'Enviando', color: 'info' },
    sent: { label: 'Enviado', color: 'success' },
    partial: { label: 'Parcial', color: 'warning' },
    failed: { label: 'Falló', color: 'error' },
    skipped: { label: 'Omitido', color: 'warning' },
};

export const EMAIL_STATUS = {
    sent: { label: 'Enviado', color: 'success' },
    partial: { label: 'Parcial', color: 'warning' },
    sending: { label: 'Reenviando', color: 'info' },
};

export const MECHANIC_STATUS = {
    pendiente: { label: 'Pendiente', color: 'warning' },
    en_proceso: { label: 'En proceso', color: 'info' },
    completado: { label: 'Completado', color: 'success' },
    cancelado: { label: 'Cancelado', color: 'error' },
};

export const SCHOOL_OPERATION_STATUS = {
    ACTIVE: { label: 'Operando', color: 'success' },
    INACTIVE: { label: 'Sin operación', color: 'default' },
};

export const SCHOOL_ENROLLMENT_STATUS = {
    OPEN: { label: 'Inscripciones abiertas', color: 'primary' },
    CLOSED: { label: 'Inscripciones cerradas', color: 'default' },
};

const EMPTY = '—';

const PALETTE_COLORS = ['default', 'primary', 'secondary', 'error', 'info', 'success', 'warning'];

// true si el color es de la paleta de MUI (va en la prop color del Chip); false si es un hex (va en sx).
export const isPaletteColor = (color) => PALETTE_COLORS.includes(color);

export const getStatusMeta = (domain, value) => {
    if (value === null || value === undefined || value === '') {
        return { label: EMPTY, color: 'default' };
    }
    const raw = String(value).trim();
    const meta = domain?.[raw] || domain?.[raw.toLowerCase()] || domain?.[raw.toUpperCase()];
    return meta || { label: raw, color: 'default' };
};

export const getStatusLabel = (domain, value) => getStatusMeta(domain, value).label;

export const toStatusOptions = (domain, keys) => (keys || Object.keys(domain))
    .map((key) => ({ value: key, label: domain[key].label }));
