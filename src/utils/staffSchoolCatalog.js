// src/utils/staffSchoolCatalog.js
// Colegios que se pueden asignar a Supervisor/Auxiliar ("Clientes a cargo").
//
// Un colegio es su grupo (Schools.schoolGroupId): existe como una fila por ciclo escolar, cada una con
// su id. El selector muestra una opción por grupo con el id CANÓNICO: la fila más reciente del grupo,
// archivadas incluidas. Es el mismo id que el backend manda en attachedSupervisorSchools /
// attachedAuxiliarSchools (utils/schoolIdentity.js, buildCanonicalSchoolIdMap), así que web y backend
// coinciden sin comparar nombres.
//
// Un grupo está archivado cuando todas sus filas tienen cycleStatus ARCHIVED. Esos colegios solo se
// ofrecen a quien ya los tenía asignados al abrir el diálogo: conservar la asignación mantiene su
// acceso al historial en la web, pero no se asigna staff nuevo a colegios cerrados.

const groupKey = (school) => (school?.schoolGroupId ? `g:${school.schoolGroupId}` : `s:${school?.id}`);

const isRowArchived = (school) => String(school?.cycleStatus || '').trim().toUpperCase() === 'ARCHIVED';

/**
 * latestRows: GET /schools?latestPerSchool=true&includeArchived=true (una fila por grupo).
 * allRows:    GET /schools?allCycles=true&includeArchived=true (todas las filas no eliminadas).
 */
export const buildStaffSchoolCatalog = (latestRows = [], allRows = []) => {
    const liveGroups = new Set(allRows.filter((school) => !isRowArchived(school)).map(groupKey));
    const canonicalByGroup = new Map(latestRows.map((school) => [groupKey(school), Number(school.id)]));

    const schools = latestRows
        .map((school) => ({
            id: Number(school.id),
            name: school.name,
            schoolGroupId: school.schoolGroupId ?? null,
            archived: !liveGroups.has(groupKey(school))
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

    const canonicalIdBySchoolId = new Map();
    for (const school of [...allRows, ...latestRows]) {
        const canonicalId = canonicalByGroup.get(groupKey(school));
        if (canonicalId) {
            canonicalIdBySchoolId.set(Number(school.id), canonicalId);
        }
    }
    return { schools, canonicalIdBySchoolId };
};

/** Ids canónicos (uno por colegio) de cualquier fila-ciclo. Un id desconocido se conserva. */
export const toCanonicalSchoolIds = (schoolIds, canonicalIdBySchoolId) => [...new Set(
    (schoolIds || [])
        .map((id) => Number(id))
        .filter(Boolean)
        .map((id) => canonicalIdBySchoolId.get(id) ?? id)
)];

/** Opciones del selector: colegios con alguna fila viva más los archivados asignados al abrir el diálogo. */
export const visibleStaffSchoolOptions = (schools, initiallyAssignedIds = []) => {
    const assigned = new Set(initiallyAssignedIds.map(Number));
    return schools.filter((school) => !school.archived || assigned.has(school.id));
};

/** Texto de un colegio en el selector. Un id fuera del catálogo es un colegio eliminado. */
export const staffSchoolLabel = (schools, schoolId) => {
    const school = schools.find((item) => item.id === Number(schoolId));
    if (!school) {
        return `Colegio eliminado (${schoolId})`;
    }
    return school.archived ? `${school.name} (archivado)` : school.name;
};

/**
 * Texto del selector cerrado. catalogState: 'cargando' | 'listo' | 'error'. Sin catálogo no se puede
 * saber si un id es de un colegio eliminado: mientras carga se avisa y, si la carga falló, se muestran
 * los ids tal cual en vez de marcarlos como eliminados.
 */
export const staffSchoolsSummary = (schools, selectedIds, catalogState) => {
    if (selectedIds.length === 0) {
        return '';
    }
    if (catalogState === 'cargando') {
        return 'Cargando…';
    }
    if (catalogState === 'error') {
        return selectedIds.join(', ');
    }
    return selectedIds.map((id) => staffSchoolLabel(schools, id)).join(', ');
};
