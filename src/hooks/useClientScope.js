// src/hooks/useClientScope.js
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { buildBackTarget, formatPeriodLabel, getScopeType } from '../utils/clientScope';

/**
 * Ámbito colegio/corporación de la pantalla actual, leído de la ruta.
 * No carga datos: `entity` (colegio o corporación) y `cicloEscolar` solo viajan en el state de Volver
 * para que el dashboard muestre el nombre sin parpadeo.
 *
 * @param {{ level?: 'section' | 'dashboard', entity?: object, cicloEscolar?: object }} options
 */
const useClientScope = ({ level = 'section', entity = null, cicloEscolar = null } = {}) => {
    const params = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const { schoolId, corporationId } = params;
    const type = getScopeType({ schoolId, corporationId });
    const cicloEscolarId = params.cicloEscolarId || location.state?.cicloEscolarId || '';
    const fiscalYear = params.fiscalYear || location.state?.fiscalYear || '';

    const stateEntity = type === 'corporate' ? location.state?.corporation : location.state?.school;
    const backEntity = entity || stateEntity || null;
    const backCiclo = cicloEscolar || location.state?.cicloEscolar || null;

    const target = useMemo(() => buildBackTarget({
        level,
        type,
        cicloEscolarId,
        schoolId,
        fiscalYear,
        corporationId,
        entity: backEntity,
        cicloEscolar: backCiclo,
    }), [level, type, cicloEscolarId, schoolId, fiscalYear, corporationId, backEntity, backCiclo]);

    const goBack = useCallback(() => {
        navigate(target.path, target.state ? { state: target.state } : undefined);
    }, [navigate, target]);

    const periodLabel = useCallback((value) => formatPeriodLabel(type, value), [type]);

    const back = useMemo(() => ({ label: target.label, onClick: goBack }), [target.label, goBack]);

    return {
        type,
        tone: type,
        schoolId,
        corporationId,
        cicloEscolarId,
        fiscalYear,
        periodLabel,
        back,
    };
};

export default useClientScope;
