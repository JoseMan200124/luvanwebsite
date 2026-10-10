// src/components/audience/ScopeRules.jsx
import { useState } from 'react';
import { Alert, Box, ButtonBase, Collapse, Typography } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';

const cycleLabelFor = (schools, cicloEscolarId) => {
    if (!cicloEscolarId) return null;
    const match = schools.find((school) => Number(school.cicloEscolarId) === Number(cicloEscolarId));
    const cycle = match?.cicloEscolar;
    return cycle?.label || cycle?.nombre || `#${cicloEscolarId}`;
};

const RULES_BY_MODE = {
    families: () => [
        '- Se listan familias de todo el sistema, sin importar el ciclo escolar en el que estés trabajando.',
        '- Solo aparecen familias con un colegio en operación (activo y en su ciclo vigente). No se listan las de colegios pausados, archivados o de ciclos anteriores.',
        '- El apellido que se muestra es el del ciclo de su colegio en operación.',
        '- Al elegir familias concretas se ignoran los demás filtros y los roles.',
        '- Cada familia recibe el envío una sola vez. En circulares, la familia la ve en su ciclo vigente.',
    ],
    schools: ({ cycle, cycleLocked }) => [
        cycle
            ? `- Estás trabajando en el ciclo escolar ${cycle}: solo se listan colegios de ese ciclo.`
            : '- Solo se listan colegios del ciclo escolar vigente.',
        cycleLocked
            ? '- El ciclo de este envío quedó fijado al crearlo y no se puede cambiar al editarlo. Para enviar a otro ciclo, crea un envío nuevo desde ese ciclo.'
            : '- No se puede cambiar de ciclo desde este formulario: para enviar a colegios de otro ciclo, cambia el ciclo escolar en la pantalla y vuelve a abrirlo.',
        '- Los destinatarios son los de esos colegios en ese ciclo.',
    ],
    all: ({ cycle, cycleLocked }) => [
        cycle
            ? `- El envío alcanza a todos los colegios del ciclo escolar ${cycle}.`
            : '- El envío alcanza a todos los colegios del ciclo escolar vigente.',
        cycleLocked
            ? '- El ciclo de este envío quedó fijado al crearlo y no se puede cambiar al editarlo.'
            : '- No se puede cambiar de ciclo desde este formulario: cambia el ciclo escolar en la pantalla y vuelve a abrirlo.',
        '- Horario y nivel se eligen de forma global en «Opciones». El grado no aplica (varía por colegio).',
    ],
};

/**
 * Reglas del alcance que el usuario debe tener presentes según lo que eligió
 * (familias concretas, colegios específicos o todos los colegios).
 * `cycleLocked`: el ciclo ya quedó fijado (edición de un envío programado).
 * Carga contraído: se expande con un clic en el encabezado.
 */
const ScopeRules = ({ mode, schools = [], cicloEscolarId = null, cycleLocked = false }) => {
    const [expanded, setExpanded] = useState(false);

    const buildRules = RULES_BY_MODE[mode];
    if (!buildRules) return null;

    const rules = buildRules({ cycle: cycleLabelFor(schools, cicloEscolarId), cycleLocked });
    return (
        <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
            <ButtonBase
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                sx={{ width: '100%', justifyContent: 'space-between', textAlign: 'left' }}
            >
                <Typography variant="subtitle2">
                    Reglas de este alcance {expanded ? '' : '(clic para ver)'}
                </Typography>
                {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </ButtonBase>
            <Collapse in={expanded} unmountOnExit>
                <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {rules.map((rule) => (
                        <Typography key={rule} variant="body2">{rule}</Typography>
                    ))}
                </Box>
            </Collapse>
        </Alert>
    );
};

export default ScopeRules;
