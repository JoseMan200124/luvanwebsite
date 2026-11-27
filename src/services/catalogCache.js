// src/services/catalogCache.js
// Caché en memoria, pura: guarda el resultado de cada catálogo por nombre + contexto + parámetros,
// y une los pedidos simultáneos en uno solo. Los errores no se guardan.

export const stableStringify = (value) => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const entries = Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
};

export const createCatalogCache = (fetcher) => {
    const data = new Map();
    const inflight = new Map();

    const keyOf = (name, params, contextKey = '') => `${name}|${contextKey}|${stableStringify(params || {})}`;

    const load = (name, params = {}, options = {}) => {
        const { force = false, contextKey = '', ...fetchOptions } = options;
        const key = keyOf(name, params, contextKey);
        if (!force && data.has(key)) {
            return Promise.resolve(data.get(key));
        }
        if (!force && inflight.has(key)) {
            return inflight.get(key);
        }
        const promise = fetcher(name, params, fetchOptions)
            .then((result) => {
                data.set(key, result);
                return result;
            })
            .finally(() => {
                if (inflight.get(key) === promise) {
                    inflight.delete(key);
                }
            });
        inflight.set(key, promise);
        return promise;
    };

    const peek = (name, params = {}, { contextKey = '' } = {}) => data.get(keyOf(name, params, contextKey));

    const invalidate = (name) => {
        [...data.keys()]
            .filter((key) => key.startsWith(`${name}|`))
            .forEach((key) => data.delete(key));
        // Una petición en vuelo trae datos previos a la invalidación: no debe reutilizarse.
        [...inflight.keys()]
            .filter((key) => key.startsWith(`${name}|`))
            .forEach((key) => inflight.delete(key));
    };

    const clear = () => {
        data.clear();
        inflight.clear();
    };

    return { load, peek, invalidate, clear };
};
