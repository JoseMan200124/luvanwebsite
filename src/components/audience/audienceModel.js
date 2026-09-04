// src/components/audience/audienceModel.js
//
// Contrato de audiencia compartido por el modal de circulares y el de push.
// Debe mantenerse alineado con luvanbackend/services/audienceTargetingBuilder.js.

export const ROLE_OPTIONS = [
    { value: 'parents',     label: 'Padres' },
    { value: 'monitoras',   label: 'Monitoras' },
    { value: 'pilots',      label: 'Pilotos' },
    { value: 'supervisors', label: 'Supervisores' },
    { value: 'auxiliars',   label: 'Auxiliares' },
];

export const ROUTE_TYPE_OPTIONS = [
    { value: 'Completa', label: 'Completa' },
    { value: 'Media AM', label: 'Media AM' },
    { value: 'Media PM', label: 'Media PM' },
];

export const SERVICE_STATUS_OPTIONS = [
    { value: 'ACTIVE',    label: 'Activo' },
    { value: 'PAUSED',    label: 'Pausado' },
    { value: 'SUSPENDED', label: 'Suspendido' },
];

export const PAYMENT_STATUS_OPTIONS = [
    { value: 'CONFIRMADO', label: 'Pagado' },
    { value: 'ADELANTADO', label: 'Adelantado' },
    { value: 'PENDIENTE',  label: 'Pendiente' },
    { value: 'MORA',       label: 'En Mora' },
    { value: 'EN_PROCESO', label: 'En Proceso' },
];

export const EMPTY_PADRE_FILTERS = {
    routeTypes: [],
    serviceStatuses: [],
    paymentStatuses: [],
    includeNoRoute: false,
};

export const EMPTY_SCHOOL_ENTRY = { routeNumbers: [], scheduleCodes: [], grades: [], levelIds: [] };

export const EMPTY_AUDIENCE = {
    scope: [],          // vacío = todos los colegios
    scheduleCodes: [],  // solo aplica con scope vacío
    levelIds: [],       // solo aplica con scope vacío
    userIds: [],        // familias concretas; excluyente
    roles: [],
    padreFilters: { ...EMPTY_PADRE_FILTERS },
};

export const getSchoolEntry = (audience, schoolId) =>
    (audience.scope || []).find((entry) => String(entry.schoolId) === String(schoolId))
    || { schoolId: Number(schoolId), ...EMPTY_SCHOOL_ENTRY };

/**
 * Reemplaza la lista de colegios conservando lo ya elegido en los que siguen.
 */
export const setSchoolIds = (audience, schoolIds) => {
    const wanted = schoolIds.map(Number);
    const scope = wanted.map((schoolId) => {
        const existing = (audience.scope || []).find((entry) => Number(entry.schoolId) === schoolId);
        return existing || { schoolId, ...EMPTY_SCHOOL_ENTRY };
    });
    return {
        ...audience,
        scope,
        // Los globales solo tienen sentido sin colegios seleccionados.
        scheduleCodes: scope.length === 0 ? audience.scheduleCodes : [],
        levelIds: scope.length === 0 ? audience.levelIds : [],
    };
};

export const setSchoolField = (audience, schoolId, field, value) => ({
    ...audience,
    scope: (audience.scope || []).map((entry) => {
        if (Number(entry.schoolId) !== Number(schoolId)) return entry;
        const next = { ...entry, [field]: value };
        // Sin rutas no hay horario que elegir.
        if (field === 'routeNumbers' && value.length === 0) next.scheduleCodes = [];
        return next;
    }),
});

export const setPadreFilter = (audience, field, value) => ({
    ...audience,
    padreFilters: { ...audience.padreFilters, [field]: value },
});

export const setUserIds = (audience, userIds) => ({ ...audience, userIds });

/**
 * Mismas reglas que valida el backend en validateAudience().
 */
export const validateAudience = (audience) => {
    if (!audience) return { valid: false, message: 'Selecciona destinatarios.' };

    // Familias concretas: no aplica nada más.
    if ((audience.userIds || []).length > 0) return { valid: true, message: null };

    if ((audience.roles || []).length === 0) {
        return { valid: false, message: 'Selecciona al menos un rol de destinatarios.' };
    }

    if (audience.roles.includes('parents')) {
        const { routeTypes, serviceStatuses, paymentStatuses } = audience.padreFilters || {};
        if (!routeTypes || routeTypes.length === 0) {
            return { valid: false, message: 'Selecciona al menos un Tipo de Ruta en los filtros de Padres.' };
        }
        if (!serviceStatuses || serviceStatuses.length === 0) {
            return { valid: false, message: 'Selecciona al menos un Estado del Servicio en los filtros de Padres.' };
        }
        if (!paymentStatuses || paymentStatuses.length === 0) {
            return { valid: false, message: 'Selecciona al menos un Estado de Pago en los filtros de Padres.' };
        }
    }

    return { valid: true, message: null };
};

/**
 * True cuando el alcance del colegio es únicamente "familias sin ruta":
 * en ese caso el horario no aplica, porque no hay ruta a la que pertenezca.
 */
export const isScheduleNotApplicable = (audience, schoolId) => {
    const entry = getSchoolEntry(audience, schoolId);
    return entry.routeNumbers.length === 0 && audience.padreFilters?.includeNoRoute === true;
};
