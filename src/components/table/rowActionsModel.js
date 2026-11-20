// src/components/table/rowActionsModel.js
// Lógica pura de las acciones por fila: descarta vacías y sin permiso, ordena y separa las que van al menú "Más".

export const ROW_ACTION_KINDS = ['view', 'edit', 'other', 'delete'];
export const MAX_INLINE_ROW_ACTIONS = 3;

const toList = (permission) => (Array.isArray(permission) ? permission : [permission]);

const kindIndex = (action) => {
    const index = ROW_ACTION_KINDS.indexOf(action.kind);
    return index === -1 ? ROW_ACTION_KINDS.indexOf('other') : index;
};

export const splitRowActions = (actions, hasAnyPermission) => {
    const visible = (actions || [])
        .filter(Boolean)
        .filter((action) => !action.permission || hasAnyPermission(toList(action.permission)))
        .map((action, index) => ({ action, index }))
        .sort((a, b) => (kindIndex(a.action) - kindIndex(b.action)) || (a.index - b.index))
        .map((entry) => entry.action);

    if (visible.length <= MAX_INLINE_ROW_ACTIONS) {
        return { inline: visible, overflow: [] };
    }
    return {
        inline: visible.slice(0, MAX_INLINE_ROW_ACTIONS - 1),
        overflow: visible.slice(MAX_INLINE_ROW_ACTIONS - 1),
    };
};
