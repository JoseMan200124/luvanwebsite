// src/components/feedback/notifyModel.js
// Lógica pura de los avisos: duración por tipo, mensaje a partir de un error de axios y cola sin repetidos.

export const NOTIFY_DURATIONS = {
    success: 4000,
    info: 4000,
    warning: 6000,
    error: 8000,
};

// El aviso de correo duplicado es largo (nombra el rol y el colegio asociados).
export const DUPLICATE_EMAIL_DURATION = 15000;

// null = el aviso queda abierto hasta que el usuario lo cierre.
export const getDuration = (severity, override) => {
    if (override === null) {
        return null;
    }
    if (typeof override === 'number' && override > 0) {
        return override;
    }
    return NOTIFY_DURATIONS[severity] ?? NOTIFY_DURATIONS.info;
};

const hasText = (value) => typeof value === 'string' && value.trim() !== '';

// Mensaje que manda el backend (message, o si no error) o el texto de respaldo de la pantalla.
export const getErrorMessage = (err, fallback = 'Ocurrió un error inesperado') => {
    const data = err?.response?.data;
    if (data && typeof data === 'object') {
        if (hasText(data.message)) {
            return data.message;
        }
        if (hasText(data.error)) {
            return data.error;
        }
    }
    return fallback;
};

// El backend marca el correo duplicado con roleLabel (lo muestra DuplicateEmailAlert).
export const isDuplicateEmailError = (err) => Boolean(err?.response?.data?.roleLabel);

// Agrega un aviso a la cola, salvo que sea idéntico al último pendiente (o al que está en pantalla si no hay pendientes).
export const enqueue = (queue, current, item) => {
    const last = queue.length > 0 ? queue[queue.length - 1] : current;
    if (last && typeof item.message === 'string' && last.message === item.message && last.severity === item.severity) {
        return queue;
    }
    return [...queue, item];
};
