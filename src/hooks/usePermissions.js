// src/hooks/usePermissions.js
import { useContext } from 'react';
import { AuthContext } from '../context/AuthProvider';

/**
 * Hook para verificar permisos del usuario
 * @returns {Object} Objeto con funciones y estado de permisos
 */
const usePermissions = () => {
    const { auth } = useContext(AuthContext);

    /**
     * Verifica si el usuario tiene un permiso específico
     * @param {string} permissionKey - La clave del permiso a verificar (ej: 'horarios-carga-masiva')
     * @returns {boolean} true si el usuario tiene el permiso, false en caso contrario
     */
    const hasPermission = (permissionKey) => {
        if (!auth.permissions || !permissionKey) {
            return false;
        }
        return auth.permissions[permissionKey] === true;
    };

    /**
     * Verifica si el usuario tiene al menos uno de los permisos especificados
     * @param {string[]} permissionKeys - Array de claves de permisos
     * @returns {boolean} true si el usuario tiene al menos uno de los permisos
     */
    const hasAnyPermission = (permissionKeys) => {
        if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) {
            return false;
        }
        return permissionKeys.some(key => hasPermission(key));
    };

    /**
     * Verifica si el usuario tiene todos los permisos especificados
     * @param {string[]} permissionKeys - Array de claves de permisos
     * @returns {boolean} true si el usuario tiene todos los permisos
     */
    const hasAllPermissions = (permissionKeys) => {
        if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) {
            return false;
        }
        return permissionKeys.every(key => hasPermission(key));
    };

    /**
     * Verifica si el usuario tiene uno de los roles especificados
     * @param {string[]} roles - Array de nombres de roles
     * @returns {boolean} true si el usuario tiene uno de los roles
     */
    const hasRole = (roles) => {
        if (!auth.user || !auth.user.role) {
            return false;
        }
        if (typeof roles === 'string') {
            return auth.user.role === roles;
        }
        if (Array.isArray(roles)) {
            return roles.includes(auth.user.role);
        }
        return false;
    };

    return {
        permissions: auth.permissions || {},
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,
        isLoading: auth.permissionsLoading || false,
    };
};

export default usePermissions;
