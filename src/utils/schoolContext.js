const SELECTED_SCHOOL_ID_KEY = 'selectedSchoolId';
const SELECTED_CICLO_ESCOLAR_ID_KEY = 'selectedCicloEscolarId';
const SELECTED_SCHOOL_CONTEXT_KEY = 'selectedSchoolContext';

const SCHOOL_CONTEXT_REQUIRED_ROLE_IDS = new Set([3, 8]);

const safeString = (value) => (value === undefined || value === null ? '' : String(value));

export const isSchoolContextRequiredRole = (roleId) => (
    SCHOOL_CONTEXT_REQUIRED_ROLE_IDS.has(Number(roleId))
);

export const getDefaultPathForRole = (roleId) => {
    const parsedRoleId = Number(roleId);
    if (parsedRoleId === 3) return '/parent/dashboard';
    if (parsedRoleId === 8) return '/colaborador/dashboard';
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
        const rawContext = localStorage.getItem(SELECTED_SCHOOL_CONTEXT_KEY);
        if (rawContext) {
            const parsed = JSON.parse(rawContext);
            return normalizeSchoolContext(parsed);
        }
    } catch (error) {
        localStorage.removeItem(SELECTED_SCHOOL_CONTEXT_KEY);
    }

    const schoolId = localStorage.getItem(SELECTED_SCHOOL_ID_KEY) || '';
    const cicloEscolarId = localStorage.getItem(SELECTED_CICLO_ESCOLAR_ID_KEY) || '';
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

    localStorage.setItem(SELECTED_SCHOOL_ID_KEY, normalized.schoolId);
    localStorage.setItem(SELECTED_CICLO_ESCOLAR_ID_KEY, normalized.cicloEscolarId);
    localStorage.setItem(SELECTED_SCHOOL_CONTEXT_KEY, JSON.stringify(normalized));
    return normalized;
};

export const clearStoredSchoolContext = (options = {}) => {
    localStorage.removeItem(SELECTED_SCHOOL_ID_KEY);
    localStorage.removeItem(SELECTED_SCHOOL_CONTEXT_KEY);
    if (!options.preserveCycle) {
        localStorage.removeItem(SELECTED_CICLO_ESCOLAR_ID_KEY);
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