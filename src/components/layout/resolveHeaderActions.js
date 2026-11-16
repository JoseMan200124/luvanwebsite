// src/components/layout/resolveHeaderActions.js
// Lógica pura de las acciones del encabezado:
// - resolveHeaderActions: descarta entradas vacías, sin permiso y menús que quedan sin opciones.
// - groupHeaderActions: aplica el patrón Descargar · Cargar · Enviar · Otras · Principal.

const toList = (permission) => (Array.isArray(permission) ? permission : [permission]);

const isAllowed = (permission, hasAnyPermission) => (
    !permission || hasAnyPermission(toList(permission))
);

export const resolveHeaderActions = (actions, hasAnyPermission) => (actions || [])
    .filter(Boolean)
    .filter((action) => isAllowed(action.permission, hasAnyPermission))
    .map((action) => (action.menu
        ? { ...action, menu: action.menu.filter(Boolean).filter((item) => isAllowed(item.permission, hasAnyPermission)) }
        : action))
    .filter((action) => !action.menu || action.menu.length > 0);

// Tipos de acción, en el orden en que se muestran. La principal (Añadir/Crear/Nuevo) va siempre al final.
const HEADER_ACTION_GROUPS = [
    { group: 'download', label: 'Descargar' },
    { group: 'upload', label: 'Cargar' },
    { group: 'send', label: 'Enviar' },
    { group: 'other', label: 'Otras' },
];

// Una acción convertida en opciones de un menú de grupo. Si tenía menú propio, se aplanan sus opciones;
// el deshabilitado (o en curso) de la acción se propaga a cada opción.
const toMenuItems = (action) => {
    const parentDisabled = Boolean(action.disabled || action.loading);
    if (action.menu) {
        return action.menu.map((item) => ({
            key: `${action.key}-${item.key}`,
            label: item.label,
            onClick: item.onClick,
            disabled: Boolean(item.disabled) || parentDisabled,
        }));
    }
    return [{ key: action.key, label: action.label, onClick: action.onClick, disabled: parentDisabled }];
};

/**
 * Patrón único de acciones: Descargar · Cargar · Enviar · Otras · Principal. Cada pantalla marca sus acciones
 * con `group` ('download' | 'upload' | 'send' | 'other'); la principal lleva `primary: true`.
 * - Un tipo con una sola acción se muestra tal cual, con su nombre específico ("Enviar circular").
 * - Un tipo con 2 o más pasa a un menú con el nombre genérico ("Enviar ▾").
 * - "Otras" es siempre un menú, aunque tenga una sola opción. Una acción sin `group` cuenta como "Otras".
 * - Solo puede haber UNA acción principal por pantalla. Si se declaran varias, se usa la primera y las demás
 *   se tratan como secundarias (en desarrollo se avisa por consola para que no pase inadvertido).
 */
export const groupHeaderActions = (actions) => {
    const list = actions || [];
    const primaries = list.filter((action) => action.primary);
    if (primaries.length > 1 && process.env.NODE_ENV !== 'production') {
        console.warn(`[PageHeader] Hay ${primaries.length} acciones principales (${primaries.map((a) => a.key).join(', ')}); solo se usa la primera.`);
    }
    const primary = primaries[0];
    const secondary = list.filter((action) => action !== primary);
    const groupOf = (action) => (HEADER_ACTION_GROUPS.some(({ group }) => group === action.group) ? action.group : 'other');

    const grouped = HEADER_ACTION_GROUPS.flatMap(({ group, label }) => {
        const members = secondary.filter((action) => groupOf(action) === group);
        if (members.length === 0) {
            return [];
        }
        if (members.length === 1 && group !== 'other') {
            return [members[0]];
        }
        return [{ key: `group-${group}`, label, group, menu: members.flatMap(toMenuItems) }];
    });

    return primary ? [...grouped, primary] : grouped;
};
