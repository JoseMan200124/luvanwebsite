// src/utils/clientScope.js
// Lógica pura del ámbito colegio/corporación de las pantallas hero (sin React, se puede testear).

export const SCHOOLS_PATH = '/admin/escuelas';
export const CORPORATIONS_PATH = '/admin/corporaciones';

const SELECTION_LABELS = {
    school: 'Volver a Colegios',
    corporate: 'Volver a Corporaciones',
};

export const getScopeType = ({ schoolId, corporationId } = {}) => (
    corporationId && !schoolId ? 'corporate' : 'school'
);

export const formatPeriodLabel = (type, value) => {
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (!text) {
        return '';
    }
    return type === 'corporate' ? `Año Fiscal ${text}` : `Ciclo Escolar ${text}`;
};

const getSelectionPath = (type) => (type === 'corporate' ? CORPORATIONS_PATH : SCHOOLS_PATH);

export const buildHubPath = ({ type, cicloEscolarId, schoolId, fiscalYear, corporationId }) => {
    if (type === 'corporate') {
        return fiscalYear && corporationId ? `${CORPORATIONS_PATH}/${fiscalYear}/${corporationId}` : CORPORATIONS_PATH;
    }
    return cicloEscolarId && schoolId ? `${SCHOOLS_PATH}/ciclo/${cicloEscolarId}/${schoolId}` : SCHOOLS_PATH;
};

/**
 * Destino del botón Volver.
 * - level 'section': al dashboard del colegio o corporación, con el state que ese dashboard espera.
 * - level 'dashboard': a la selección de colegios o corporaciones.
 * Si faltan ids en la ruta, vuelve a la selección (nunca navigate(-1)).
 */
export const buildBackTarget = ({
    level = 'section',
    type,
    cicloEscolarId,
    schoolId,
    fiscalYear,
    corporationId,
    entity = null,
    cicloEscolar = null,
}) => {
    const selectionPath = getSelectionPath(type);
    const toSelection = { path: selectionPath, label: SELECTION_LABELS[type] || SELECTION_LABELS.school, state: undefined };

    if (level === 'dashboard') {
        return toSelection;
    }

    const path = buildHubPath({ type, cicloEscolarId, schoolId, fiscalYear, corporationId });
    if (path === selectionPath) {
        return toSelection;
    }

    const state = type === 'corporate'
        ? { fiscalYear, corporation: entity }
        : { cicloEscolarId, cicloEscolar, school: entity };
    return { path, label: 'Volver al Dashboard', state };
};
