// src/components/paradas/bloqueoPestana.js
// El fetch keepalive de liberarAlCerrar solo llega al cerrar la pestaña: al recargar o navegar el
// bloqueo seguía puesto y el propio usuario quedaba en solo lectura hasta 2 min. Cada pestaña
// recuerda su lockToken (sessionStorage es por pestaña y sobrevive a la recarga) y, al volver a
// abrir el editor, lo libera antes de leer el borrador. Un token que ya no rige no hace nada.
import paradasService from '../../services/paradasService';

const clave = (schoolId) => `paradas-lock-${schoolId}`;

export function recordarBloqueo(schoolId, lockToken) {
    try { sessionStorage.setItem(clave(schoolId), lockToken); } catch (_) { /* sin almacenamiento: expira solo */ }
}

export function olvidarBloqueo(schoolId) {
    try { sessionStorage.removeItem(clave(schoolId)); } catch (_) { /* sin almacenamiento */ }
}

/** Libera el bloqueo que esta pestaña dejó puesto antes de recargar. Nunca falla. */
export async function liberarBloqueoPrevio(schoolId) {
    let token = null;
    try {
        token = sessionStorage.getItem(clave(schoolId));
        sessionStorage.removeItem(clave(schoolId));
    } catch (_) { return; }
    if (!token) return;
    try { await paradasService.liberar(schoolId, token); } catch (_) { /* ya venció o lo tomó otro */ }
}
