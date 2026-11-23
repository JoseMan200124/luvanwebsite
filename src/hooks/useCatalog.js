// src/hooks/useCatalog.js
// Lee un catálogo desde el caché compartido. La primera pantalla que lo pide lo carga; las demás lo reutilizan.
import { useCallback, useEffect, useState } from 'react';
import { invalidateCatalog, loadCatalog, peekCatalog } from '../services/catalogStore';
import { stableStringify } from '../services/catalogCache';

export const useCatalog = (name, params = {}, { enabled = true, skipSchoolCycleContext = false } = {}) => {
    const paramsKey = stableStringify(params || {});
    const [version, setVersion] = useState(0);
    const [state, setState] = useState(() => {
        const cached = enabled ? peekCatalog(name, params || {}, { skipSchoolCycleContext }) : undefined;
        return { data: cached || [], loading: enabled && !cached, error: null };
    });

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }
        let active = true;
        setState((prev) => ({ ...prev, loading: true, error: null }));
        loadCatalog(name, JSON.parse(paramsKey), { skipSchoolCycleContext })
            .then((data) => {
                if (active) {
                    setState({ data, loading: false, error: null });
                }
            })
            .catch((error) => {
                if (active) {
                    setState({ data: [], loading: false, error });
                }
            });
        return () => {
            active = false;
        };
    }, [name, paramsKey, enabled, skipSchoolCycleContext, version]);

    const reload = useCallback(() => {
        invalidateCatalog(name);
        setVersion((prev) => prev + 1);
    }, [name]);

    return { ...state, reload };
};

export const useSchools = (params, options) => useCatalog('schools', params, options);
export const useCorporations = (params, options) => useCatalog('corporations', params, options);
export const useBuses = (params, options) => useCatalog('buses', params, options);
export const usePilots = (params, options) => useCatalog('pilots', params, options);
export const useMonitors = (params, options) => useCatalog('monitors', params, options);
