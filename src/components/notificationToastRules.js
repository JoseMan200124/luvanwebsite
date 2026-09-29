// src/components/notificationToastRules.js
// Qué notificación recibida se muestra como popup, según rol y tipo. El backend
// ya decide quién recibe cada notificación; esto solo evita saturar con popups.
// Matriz: LuvanWorkspace/plans/2026-09-29-roles-plataforma-design.md §1.5

const ALERTAS_PILOTO = ['ROUTE_NOT_STARTED', 'ROUTE_STARTED_LATE'];
const ALERTAS_PILOTO_SUPERVISOR = [...ALERTAS_PILOTO, 'ROUTE_NOT_ENDED'];
const ALERTAS_MONITORA = [
    'BOARDING_LATE',
    'FIRST_STOP_LATE',
    'SCHOOL_ARRIVAL_LATE',
    'DEPARTURE_LATE',
    'RETURN_FIRST_STOP_LATE',
    'ATTENDANCE_NOT_MARKED',
];

// metadata puede llegar como objeto o como string JSON según el origen.
const parseMetadata = (metadata) => {
    if (metadata && typeof metadata === 'object') return metadata;
    if (typeof metadata === 'string') {
        try {
            const parsed = JSON.parse(metadata);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }
    return {};
};

const alertaDeCumplimiento = (alertTypes) => (notification) =>
    alertTypes.includes(parseMetadata(notification.metadata).alertType);

// roleId -> { type: true | (notification) => boolean }. Roles no listados no ven popup.
const TOAST_RULES_BY_ROLE = {
    1: { // Gestor
        inscripcion: true,
        'boleta-pago': true,
        'reporte-mecanico': true,
        'solicitud-mecanica': true,
        emergencia: true,
        incidente: true,
        'route-compliance-alert': alertaDeCumplimiento(ALERTAS_PILOTO),
    },
    2: { // Administrador
        'boleta-pago': true,
    },
    6: { // Supervisor
        emergencia: true,
        incidente: true,
        'reporte-mecanico': true,
        'solicitud-mecanica': true,
        'route-compliance-alert': alertaDeCumplimiento(ALERTAS_PILOTO_SUPERVISOR),
    },
    7: { // Auxiliar
        inscripcion: true,
        'boleta-pago': true,
        emergencia: true,
        'route-compliance-alert': alertaDeCumplimiento(ALERTAS_MONITORA),
    },
};

export const shouldShowToast = (roleId, notification) => {
    const reglas = TOAST_RULES_BY_ROLE[Number(roleId)];
    const type = notification?.type;
    if (!reglas || !type || !Object.prototype.hasOwnProperty.call(reglas, type)) return false;
    const regla = reglas[type];
    return typeof regla === 'function' ? regla(notification) : regla === true;
};
