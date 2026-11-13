// src/utils/cicloEscolarFilterParams.js
// Helpers puros del filtro de ciclo escolar (sin dependencias de red, se pueden testear).
import { getSelectedCicloEscolarId } from './schoolContext';

export const ALL_CYCLES_VALUE = 'all';

export const getInitialCicloEscolarFilter = () => getSelectedCicloEscolarId() || ALL_CYCLES_VALUE;

export const getCicloEscolarFilterParams = (value) => {
    if (!value || value === ALL_CYCLES_VALUE) {
        return { allCycles: true };
    }
    return { cicloEscolarId: value };
};
