// src/services/catalogStore.js
// Catálogos compartidos (colegios, corporaciones, buses, pilotos, monitoras) con caché en memoria.
// El ciclo (y el colegio, para padres y colaboradores) entra en la clave porque el interceptor de axios
// lo agrega a cada pedido.
import api from '../utils/axiosConfig';
import { getSelectedCicloEscolarId, getSelectedSchoolId } from '../utils/schoolContext';
import { createCatalogCache } from './catalogCache';

const pickList = (key) => (data) => (Array.isArray(data) ? data : (data?.[key] || []));

export const CATALOGS = {
    schools: { url: '/schools', pick: pickList('schools') },
    corporations: { url: '/corporations', pick: pickList('corporations') },
    buses: { url: '/buses/simple', pick: pickList('buses') },
    pilots: { url: '/users/pilots', pick: pickList('users') },
    monitors: { url: '/users/monitors', pick: pickList('users') },
};

const fetchCatalog = async (name, params, { skipSchoolCycleContext } = {}) => {
    const catalog = CATALOGS[name];
    const config = { params };
    if (skipSchoolCycleContext) {
        config.skipSchoolCycleContext = true;
    }
    const response = await api.get(catalog.url, config);
    return catalog.pick(response.data);
};

const cache = createCatalogCache(fetchCatalog);

// Mismo criterio que el interceptor: el ciclo de la ruta /escuelas/ciclo/:id gana sobre el seleccionado.
const contextKey = ({ skipSchoolCycleContext } = {}) => {
    if (skipSchoolCycleContext) {
        return 'sin-ciclo';
    }
    const routeCycle = /\/escuelas\/ciclo\/(\d+)(?:\/|$)/.exec(window.location.pathname);
    const cycle = routeCycle ? routeCycle[1] : (getSelectedCicloEscolarId() || '');
    return `${cycle}:${getSelectedSchoolId() || ''}`;
};

export const loadCatalog = (name, params = {}, options = {}) => cache.load(name, params, {
    ...options,
    contextKey: contextKey(options),
});

export const peekCatalog = (name, params = {}, options = {}) => cache.peek(name, params, {
    contextKey: contextKey(options),
});

export const invalidateCatalog = (name) => cache.invalidate(name);

export const clearCatalogs = () => cache.clear();
