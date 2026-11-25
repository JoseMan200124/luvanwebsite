// src/utils/userClients.js
// Clientes (colegios y corporaciones) de un usuario del listado de Roles, para la columna "Cliente",
// su orden, la vista móvil y el Excel. Supervisores y auxiliares pueden tener varios; el resto, uno.

// Roles que ven todos los clientes. Espejo de GLOBAL_SCOPE_ROLE_IDS en luvanbackend/utils/roleScopes.js.
const GLOBAL_CLIENT_ROLE_IDS = new Set([1, 2, 10]);

const uniqueIds = (...lists) => [...new Set(lists.flat().map(Number).filter(Boolean))];

const byName = (a, b) => a.localeCompare(b, 'es');

/**
 * user: fila de GET /users/non-parents (attached*Schools ya vienen con el id canónico del colegio).
 * schools: catálogo de staffSchoolCatalog ({ id, name, archived }); corporations: [{ id, name }].
 * catalogReady: false mientras el catálogo de colegios carga; un id ausente solo es "eliminado" con el
 * catálogo listo.
 * Devuelve { todos: true } para los roles globales, o { colegios, corporaciones } con nombres ordenados.
 */
export const userClients = (user, { schools = [], corporations = [], catalogReady = true } = {}) => {
    if (GLOBAL_CLIENT_ROLE_IDS.has(Number(user?.roleId))) {
        return { todos: true, colegios: [], corporaciones: [] };
    }

    const schoolIds = uniqueIds(
        user?.attachedSupervisorSchools || [],
        user?.attachedAuxiliarSchools || [],
        user?.School?.id ? [user.School.id] : []
    );
    const schoolName = (id) => {
        const school = schools.find((item) => item.id === id);
        if (school) {
            return school.archived ? `${school.name} (archivado)` : school.name;
        }
        if (Number(user?.School?.id) === id && user.School.name) {
            return user.School.name;
        }
        return catalogReady ? `Colegio eliminado (${id})` : `Colegio ${id}`;
    };

    const corporationIds = uniqueIds(
        user?.attachedSupervisorCorporations || [],
        user?.attachedAuxiliarCorporations || [],
        user?.corporationId ? [user.corporationId] : []
    );
    const corporationName = (id) => {
        const corporation = corporations.find((item) => Number(item.id) === id);
        if (corporation) {
            return corporation.name;
        }
        if (Number(user?.corporation?.id) === id && user.corporation.name) {
            return user.corporation.name;
        }
        return `Corporación ${id}`;
    };

    return {
        todos: false,
        colegios: schoolIds.map(schoolName).sort(byName),
        corporaciones: corporationIds.map(corporationName).sort(byName)
    };
};

/** Lista plana para mostrar, ordenar y exportar: "Todos", o colegios y luego corporaciones. */
export const userClientNames = (clients) => (
    clients.todos ? ['Todos'] : [...clients.colegios, ...clients.corporaciones]
);
