// src/services/paradasService.js
// Editor de carga masiva de paradas (backend: /api/bulk-schedule/paradas/:schoolId).
// skipSchoolCycleContext: el servidor deriva colegio y ciclo de :schoolId; si el interceptor
// inyectara el ciclo/colegio de la pestaña, un valor distinto daría 400 SCOPE_INCONSISTENTE.
import api from '../utils/axiosConfig';

const OPCIONES = { skipSchoolCycleContext: true };
const base = (schoolId) => `/bulk-schedule/paradas/${schoolId}`;
const datos = (r) => r.data;

export const codigoError = (err) => err?.response?.data?.code || null;
export const mensajeError = (err, porDefecto = 'Ocurrió un error inesperado') =>
    err?.response?.data?.message || (err?.response ? porDefecto : 'Sin conexión con el servidor');

// 409 REINTENTAR (deadlock o espera de bloqueo vencida en MySQL): el rollback dejó todo igual,
// así que se reintenta UNA vez sola; si vuelve a fallar, el error llega a la pantalla.
async function conReintento(fn) {
    try {
        return await fn();
    } catch (err) {
        if (codigoError(err) !== 'REINTENTAR') {
            throw err;
        }
        return fn();
    }
}

const paradasService = {
    contexto: (schoolId) => api.get(`${base(schoolId)}/context`, OPCIONES).then(datos),
    familias: (schoolId) => api.get(`${base(schoolId)}/familias`, OPCIONES).then(datos),
    borrador: (schoolId) => api.get(`${base(schoolId)}/draft`, OPCIONES).then(datos),
    tomarBloqueo: (schoolId, { force = false, nuevo = false } = {}) =>
        conReintento(() => api.post(`${base(schoolId)}/draft/lock`, { force, nuevo }, OPCIONES)).then(datos),
    heartbeat: (schoolId, lockToken) => api.put(`${base(schoolId)}/draft/lock/heartbeat`, { lockToken }, OPCIONES),
    liberar: (schoolId, lockToken) => api.post(`${base(schoolId)}/draft/lock/release`, { lockToken }, OPCIONES),
    guardarFamilias: (schoolId, body) =>
        conReintento(() => api.put(`${base(schoolId)}/draft/familias`, body, OPCIONES)).then(datos),
    descartar: (schoolId, lockToken) =>
        conReintento(() => api.delete(`${base(schoolId)}/draft`, { ...OPCIONES, data: { lockToken } })),
    snapshot: (schoolId, familyIds) => api.post(`${base(schoolId)}/snapshot`, { familyIds }, OPCIONES).then(datos),
    exportar: (schoolId, body) => api.post(`${base(schoolId)}/export`, body, OPCIONES).then(datos),
    abrirArchivo: (schoolId, sello) => api.post(`${base(schoolId)}/export/unseal`, sello, OPCIONES).then(datos),
    procesar: (schoolId, body) =>
        conReintento(() => api.post(`${base(schoolId)}/draft/process`, body, OPCIONES)).then(datos),
};

/**
 * Liberar el bloqueo al cerrar la pestaña. fetch nativo con keepalive: axios no lo soporta y
 * sendBeacon no envía Authorization. Mejor esfuerzo: si el navegador no completa el preflight
 * CORS, el bloqueo expira solo a los 2 minutos.
 */
export function liberarAlCerrar(schoolId, lockToken) {
    if (!schoolId || !lockToken) {
        return;
    }
    try {
        fetch(`${api.defaults.baseURL}${base(schoolId)}/draft/lock/release`, {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ lockToken }),
        }).catch(() => {});
    } catch (_) {
        // sin acción: el bloqueo expira solo
    }
}

export default paradasService;
