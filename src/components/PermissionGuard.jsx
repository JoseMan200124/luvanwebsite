// src/components/PermissionGuard.jsx
import React from 'react';
import PropTypes from 'prop-types';
import usePermissions from '../hooks/usePermissions';

/**
 * Componente que renderiza su contenido solo si el usuario tiene los permisos necesarios
 * @param {Object} props
 * @param {string|string[]} props.permission - Permiso(s) requerido(s)
 * @param {boolean} props.requireAll - Si es true, requiere todos los permisos. Si es false (default), requiere al menos uno
 * @param {React.ReactNode} props.children - Contenido a renderizar si tiene permisos
 * @param {React.ReactNode} props.fallback - Contenido a renderizar si NO tiene permisos (opcional)
 * @returns {React.ReactNode}
 */
const PermissionGuard = ({ 
    permission, 
    requireAll = false, 
    children, 
    fallback = null 
}) => {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

    // Si no se proporciona permiso, no renderizar nada
    if (!permission) {
        return fallback;
    }

    // Convertir a array si es string
    const permissions = Array.isArray(permission) ? permission : [permission];

    // Verificar permisos
    let hasAccess = false;
    
    if (permissions.length === 1) {
        hasAccess = hasPermission(permissions[0]);
    } else if (requireAll) {
        hasAccess = hasAllPermissions(permissions);
    } else {
        hasAccess = hasAnyPermission(permissions);
    }

    // Renderizar contenido o fallback
    return hasAccess ? children : fallback;
};

PermissionGuard.propTypes = {
    permission: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.arrayOf(PropTypes.string)
    ]).isRequired,
    requireAll: PropTypes.bool,
    children: PropTypes.node.isRequired,
    fallback: PropTypes.node,
};

export default PermissionGuard;
