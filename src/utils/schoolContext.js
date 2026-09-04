const SELECTED_SCHOOL_ID_KEY = 'selectedSchoolId';
const SELECTED_CICLO_ESCOLAR_ID_KEY = 'selectedCicloEscolarId';
const SELECTED_SCHOOL_CONTEXT_KEY = 'selectedSchoolContext';

const SCHOOL_CONTEXT_REQUIRED_ROLE_IDS = new Set([3, 8, 9]);

const safeString = (value) => (value === undefined || value === null ? '' : String(value));

// --- Contexto colegio + ciclo: aislado por pestaña ---
// localStorage es compartido entre todas las pestañas del mismo origen y el
// interceptor de axios lo lee en vivo en cada request; sin aislar, cambiar el
// colegio/ciclo en una pestaña se filtra a las demás (datos de un contexto, UI de
// otro). El colegio y el ciclo son un par y deben moverse juntos.
//
// Fuente de verdad por pestaña: sessionStorage (propio de cada pestaña, sobrevive
// al recargar, no se comparte). localStorage guarda solo el "último usado" para
// sembrar una pestaña NUEVA que todavía no eligió nada. Una caché en memoria fija
// el valor tras la primera lectura para no releer storage y para que un cambio en
// otra pestaña no se cuele a media sesión.
//
// Orden de lectura: sessionStorage (elección de esta pestaña) -> localStorage
// (último usado, solo si esta pestaña nunca eligió). Escritura: ambas + memoria.
const tabScopedCache = Object.create(null); // key -> valor | null; ausente = sin hidratar

const readTabScoped = (key) => {
    try {
        return sessionStorage.getItem(key) || localStorage.getItem(key) || null;
    } catch {
        return null;
    }
};

const getTabScoped = (key) => {
    if (!(key in tabScopedCache)) {
        tabScopedCache[key] = readTabScoped(key);
    }
    return tabScopedCache[key];
};

const setTabScoped = (key, value) => {
    const normalized = (value === undefined || value === null || value === '')
        ? null
        : String(value);
    tabScopedCache[key] = normalized;
    try {
        if (normalized === null) {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, normalized);
            localStorage.setItem(key, normalized);
        }
    } catch {
        /* storage no disponible: el valor en memoria alcanza para esta pestaña */
    }
    return normalized;
};

export const getSelectedCicloEscolarId = () => getTabScoped(SELECTED_CICLO_ESCOLAR_ID_KEY);
export const setSelectedCicloEscolarId = (value) => setTabScoped(SELECTED_CICLO_ESCOLAR_ID_KEY, value);

export const getSelectedSchoolId = () => getTabScoped(SELECTED_SCHOOL_ID_KEY);

export const isSchoolContextRequiredRole = (roleId) => (
    SCHOOL_CONTEXT_REQUIRED_ROLE_IDS.has(Number(roleId))
);

export const getDefaultPathForRole = (roleId) => {
    const parsedRoleId = Number(roleId);
    if (parsedRoleId === 3) return '/parent/dashboard';
    if (parsedRoleId === 8) return '/colaborador/dashboard';
    if (parsedRoleId === 9) return '/admin/colegios';
    return '/admin/dashboard';
};

export const normalizeSchoolContext = (context = {}) => {
    const school = context.school || {};
    const cicloEscolar = context.cicloEscolar || {};
    const schoolId = safeString(context.schoolId || school.id).trim();
    const cicloEscolarId = safeString(context.cicloEscolarId || school.cicloEscolarId).trim();
    const cicloEscolarName = safeString(
        cicloEscolar.label || cicloEscolar.nombre || context.cicloEscolarName || ''
    ).trim();

    return {
        membershipId: safeString(context.id || context.membershipId).trim(),
        userId: context.userId || null,
        roleId: context.roleId || null,
        status: safeString(context.status || 'ACTIVE').trim().toUpperCase(),
        schoolId,
        schoolName: safeString(school.name || context.schoolName).trim(),
        cicloEscolarId,
        cicloEscolarName,
        cicloEscolarYear: cicloEscolar.anio || context.cicloEscolarYear || '',
        operationStatus: safeString(school.operationStatus || context.operationStatus || 'ACTIVE').trim().toUpperCase(),
        enrollmentStatus: safeString(school.enrollmentStatus || context.enrollmentStatus || 'OPEN').trim().toUpperCase()
    };
};

export const getStoredSchoolContext = () => {
    try {
        const rawContext = getTabScoped(SELECTED_SCHOOL_CONTEXT_KEY);
        if (rawContext) {
            const parsed = JSON.parse(rawContext);
            return normalizeSchoolContext(parsed);
        }
    } catch {
        // blob corrupto: se descarta y se cae al fallback de claves sueltas
        setTabScoped(SELECTED_SCHOOL_CONTEXT_KEY, null);
    }

    const schoolId = getSelectedSchoolId() || '';
    const cicloEscolarId = getSelectedCicloEscolarId() || '';
    if (!schoolId && !cicloEscolarId) return null;

    return normalizeSchoolContext({ schoolId, cicloEscolarId });
};

export const hasStoredSchoolContext = () => {
    const context = getStoredSchoolContext();
    return !!(context?.schoolId && context?.cicloEscolarId);
};

export const setStoredSchoolContext = (context) => {
    const normalized = normalizeSchoolContext(context);
    if (!normalized.schoolId || !normalized.cicloEscolarId) return null;

    setTabScoped(SELECTED_SCHOOL_ID_KEY, normalized.schoolId);
    setSelectedCicloEscolarId(normalized.cicloEscolarId);
    setTabScoped(SELECTED_SCHOOL_CONTEXT_KEY, JSON.stringify(normalized));
    return normalized;
};

export const clearStoredSchoolContext = (options = {}) => {
    setTabScoped(SELECTED_SCHOOL_ID_KEY, null);
    setTabScoped(SELECTED_SCHOOL_CONTEXT_KEY, null);
    if (!options.preserveCycle) {
        setSelectedCicloEscolarId(null);
    }
};

export const getSchoolContextLabel = (context) => {
    const normalized = normalizeSchoolContext(context || {});
    const schoolLabel = normalized.schoolName || (normalized.schoolId ? `Colegio ${normalized.schoolId}` : 'Colegio');
    const cycleLabel = normalized.cicloEscolarName
        || (normalized.cicloEscolarYear ? `Ciclo ${normalized.cicloEscolarYear}` : 'Ciclo escolar');
    return `${schoolLabel} - ${cycleLabel}`;
};

export const findMatchingStoredContext = (contexts = []) => {
    const stored = getStoredSchoolContext();
    if (!stored?.schoolId || !stored?.cicloEscolarId) return null;

    return contexts.find((context) => {
        const normalized = normalizeSchoolContext(context);
        return normalized.schoolId === stored.schoolId
            && normalized.cicloEscolarId === stored.cicloEscolarId;
    }) || null;
};