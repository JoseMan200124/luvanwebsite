// src/hooks/useManageableRoles.js
import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

/**
 * Pirámide de roles: qué roles puede gestionar el usuario autenticado.
 * La regla vive en el backend (GET /users/manageable-roles); si la consulta
 * falla no se gestiona a nadie (falla cerrado). El backend valida igual cada acción.
 */
const useManageableRoles = () => {
    const { auth } = useContext(AuthContext);
    const userId = auth?.user?.id;
    const [manageableRoleIds, setManageableRoleIds] = useState(() => new Set());
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!userId) {
            return undefined;
        }
        let cancelado = false;
        api.get('/users/manageable-roles')
            .then(({ data }) => {
                if (!cancelado) {
                    setManageableRoleIds(new Set((data?.manageableRoleIds || []).map(Number)));
                }
            })
            .catch((err) => {
                console.error('[useManageableRoles] Error:', err);
                if (!cancelado) {
                    setManageableRoleIds(new Set());
                }
            })
            .finally(() => {
                if (!cancelado) {
                    setLoaded(true);
                }
            });
        return () => {
            cancelado = true;
        };
    }, [userId]);

    const canManageRoleId = useCallback(
        (roleId) => manageableRoleIds.has(Number(roleId)),
        [manageableRoleIds]
    );
    const isSelf = useCallback(
        (user) => Boolean(userId) && Number(user?.id) === Number(userId),
        [userId]
    );
    const canManageUser = useCallback(
        (user) => !isSelf(user) && canManageRoleId(user?.roleId),
        [isSelf, canManageRoleId]
    );
    const canEditUser = useCallback(
        (user) => isSelf(user) || canManageRoleId(user?.roleId),
        [isSelf, canManageRoleId]
    );

    return { loaded, canManageRoleId, isSelf, canManageUser, canEditUser };
};

export default useManageableRoles;
