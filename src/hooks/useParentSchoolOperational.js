import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { getStoredSchoolContext, isSchoolContextRequiredRole, normalizeSchoolContext } from '../utils/schoolContext';

export const SCHOOL_NOT_OPERATIONAL_MESSAGE = 'El colegio está sin operaciones. Solo puedes consultar la información; no es posible realizar modificaciones.';

const PARENT_ROLE_ID = 3;
const CACHE_TTL_MS = 30000;
let cache = { key: null, at: 0, promise: null };

// Una sola petición a /auth/me/contexts compartida por todos los consumidores durante CACHE_TTL_MS.
// Se guarda la lista de contextos, no el resultado derivado: este depende del colegio/ciclo guardado
// en el momento de usarla, que puede cambiar (p. ej. tras elegir otro colegio).
const fetchContexts = (token) => {
    const now = Date.now();
    if (cache.key === token && cache.promise && now - cache.at < CACHE_TTL_MS) {
        return cache.promise;
    }
    const promise = api.get('/auth/me/contexts', { skipSchoolCycleContext: true })
        .then((response) => (Array.isArray(response.data?.contexts) ? response.data.contexts : [])
            .map(normalizeSchoolContext)
            .filter((context) => context.schoolId && context.cicloEscolarId));
    cache = { key: token, at: now, promise };
    promise.catch(() => {
        if (cache.promise === promise) {
            cache = { key: null, at: 0, promise: null };
        }
    });
    return promise;
};

const findCurrentContext = (contexts) => {
    const stored = getStoredSchoolContext();
    return contexts.find((context) => (
        context.schoolId === stored?.schoolId && context.cicloEscolarId === stored?.cicloEscolarId
    )) || (contexts.length === 1 ? contexts[0] : null);
};

// Estado del contexto escolar del usuario:
// - operational: si el colegio vigente del padre está en operación (siempre true para otros roles, y
//   también si no se identifica el contexto: el backend sigue siendo la autoridad).
// - hasMultipleContexts: si hay más de un contexto, o sea, algo que cambiar.
export function useSchoolContextStatus() {
    const { auth } = useContext(AuthContext);
    const roleId = auth?.user?.roleId;
    const [status, setStatus] = useState({ operational: true, hasMultipleContexts: false });

    useEffect(() => {
        if (!isSchoolContextRequiredRole(roleId) || !auth?.token) {
            return undefined;
        }
        let mounted = true;
        fetchContexts(auth.token)
            .then((contexts) => {
                if (!mounted) {
                    return;
                }
                const current = findCurrentContext(contexts);
                setStatus({
                    operational: Number(roleId) === PARENT_ROLE_ID && current ? current.isOperational : true,
                    hasMultipleContexts: contexts.length > 1
                });
            })
            .catch((err) => {
                console.error('[useSchoolContextStatus] No se pudo consultar el contexto escolar:', err);
            });
        return () => {
            mounted = false;
        };
    }, [roleId, auth?.token]);

    return status;
}

// Indica si el colegio vigente del padre está en operación. Para otros roles siempre es true.
export default function useParentSchoolOperational() {
    return useSchoolContextStatus().operational;
}
