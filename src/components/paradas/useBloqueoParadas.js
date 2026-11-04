// src/components/paradas/useBloqueoParadas.js
// Heartbeat cada 30 s mientras el editor tiene el bloqueo; liberación best-effort al cerrar la
// pestaña (pagehide + fetch keepalive) y, al recargar, al reabrir el editor (bloqueoPestana.js).
// Si la liberación no llega, el bloqueo expira a los 2 min.
// Con cambios sin guardar no se libera: el PUT de visibilitychange (useAutoguardadoParadas) podría
// llegar después de la liberación y perderse con LOCK_LOST; el bloqueo expira solo.
import { useEffect, useRef } from 'react';
import paradasService, { codigoError, liberarAlCerrar } from '../../services/paradasService';
import { olvidarBloqueo, recordarBloqueo } from './bloqueoPestana';

const HEARTBEAT_MS = 30000;

export default function useBloqueoParadas({ schoolId, lockToken, activo, hayPendiente, onPerdido }) {
    const alPerder = useRef(onPerdido);
    alPerder.current = onPerdido;
    const pendienteRef = useRef(hayPendiente);
    pendienteRef.current = hayPendiente;

    useEffect(() => {
        if (!activo || !lockToken) return undefined;
        const id = setInterval(async () => {
            try {
                await paradasService.heartbeat(schoolId, lockToken);
            } catch (err) {
                if (codigoError(err) === 'LOCK_LOST') alPerder.current?.(err.response.data);
                // otros errores (red): el siguiente heartbeat reintenta; el servidor da 2 min de gracia
            }
        }, HEARTBEAT_MS);
        return () => clearInterval(id);
    }, [schoolId, lockToken, activo]);

    // Si la pestaña se recarga, el cleanup no corre: el token queda recordado y el editor lo libera al reabrir.
    useEffect(() => {
        if (!lockToken) return undefined;
        recordarBloqueo(schoolId, lockToken);
        return () => olvidarBloqueo(schoolId);
    }, [schoolId, lockToken]);

    useEffect(() => {
        if (!lockToken) return undefined;
        const alSalir = () => { if (!pendienteRef.current?.()) liberarAlCerrar(schoolId, lockToken); };
        window.addEventListener('pagehide', alSalir);
        return () => window.removeEventListener('pagehide', alSalir);
    }, [schoolId, lockToken]);
}
