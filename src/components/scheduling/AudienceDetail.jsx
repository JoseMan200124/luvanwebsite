// src/components/scheduling/AudienceDetail.jsx
// Vista de solo lectura de la audiencia de un envío programado: a quién llega
// (roles), con qué alcance (colegios, rutas, horarios, grados, niveles o familias
// concretas) y con qué filtros de padres. Lee `audienceDetail` del detalle del API.
import { Fragment, useState } from 'react';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import {
    PAYMENT_STATUS_OPTIONS, ROLE_OPTIONS, ROUTE_TYPE_OPTIONS, SERVICE_STATUS_OPTIONS,
} from '../audience/audienceModel';

const labelOf = (options, value) => options.find((option) => option.value === value)?.label || value;
const labelsOf = (options, values) => (values || []).map((value) => labelOf(options, value)).join(', ');

const Row = ({ title, children }) => (
    <Box>
        <Typography variant="caption" color="text.secondary" component="div">{title}</Typography>
        {children}
    </Box>
);

// Nombre del campo a la izquierda (gris) y su valor a la derecha, en un recuadro:
// mismo estilo para Destinatarios y Filtros de padres.
const FieldGrid = ({ rows }) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            columnGap: 2,
            rowGap: 0.5,
            mt: 0.25,
            p: 1,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
        }}
    >
        {rows.map((row) => (
            <Fragment key={row.name}>
                <Typography variant="body2" color="text.secondary">{row.name}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.value}</Typography>
            </Fragment>
        ))}
    </Box>
);

// Opciones elegidas de un colegio: "Rutas: 1, 2 · Horarios: AM · Grados: ...".
const schoolRestrictions = (school) => [
    school.routeNumbers.length > 0 && `Rutas: ${school.routeNumbers.join(', ')}`,
    school.scheduleCodes.length > 0 && `Horarios: ${school.scheduleCodes.join(', ')}`,
    school.levels.length > 0 && `Niveles: ${school.levels.join(', ')}`,
    school.grades.length > 0 && `Grados: ${school.grades.join(', ')}`,
].filter(Boolean);

const SchoolsList = ({ schools }) => (
    <Box
        component="ul"
        sx={{ m: 0, pl: 2.5, maxHeight: 220, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, py: 0.5, pr: 1 }}
    >
        {schools.map((school) => {
            const restrictions = schoolRestrictions(school);
            return (
                <Typography key={school.id} component="li" variant="body2" sx={{ py: 0.25 }}>
                    <strong>{school.label}</strong>
                    {' — '}
                    <Typography component="span" variant="body2" color="text.secondary">
                        {restrictions.length > 0 ? restrictions.join(' · ') : 'todo el colegio'}
                    </Typography>
                </Typography>
            );
        })}
    </Box>
);

// Con todas las opciones marcadas, "Todos" se lee mejor que repetir la lista.
const filterValue = (options, values) => (values.length === options.length ? 'Todos' : labelsOf(options, values));

const PadreFilters = ({ filters }) => {
    const rows = [
        filters.routeTypes.length > 0 && { name: 'Tipo de ruta', value: filterValue(ROUTE_TYPE_OPTIONS, filters.routeTypes) },
        filters.serviceStatuses.length > 0 && { name: 'Estado del servicio', value: filterValue(SERVICE_STATUS_OPTIONS, filters.serviceStatuses) },
        filters.paymentStatuses.length > 0 && { name: 'Estado de pago', value: filterValue(PAYMENT_STATUS_OPTIONS, filters.paymentStatuses) },
        { name: 'Familias sin ruta', value: filters.includeNoRoute ? 'Incluidas' : 'No incluidas' },
    ].filter(Boolean);

    return (
        <Row title="Filtros de padres">
            <FieldGrid rows={rows} />
        </Row>
    );
};

const FAMILIES_PAGE = 50;

// Se muestran las primeras 50; «Ver todas» despliega el resto (con scroll).
const FamiliesList = ({ families }) => {
    const [showAll, setShowAll] = useState(false);
    const total = families.members.length;
    const visible = showAll ? families.members : families.members.slice(0, FAMILIES_PAGE);

    return (
        <>
            <Row title="Destinatarios">
                <FieldGrid
                    rows={[
                        { name: 'Alcance', value: 'Familias concretas' },
                        { name: 'Total', value: `${families.count} familia(s)` },
                    ]}
                />
            </Row>
            <Row title={`Familias (${showAll ? total : visible.length} de ${total})`}>
                {/* Columnas: el orden alfabético se lee de arriba abajo. */}
                <Box
                    component="ul"
                    sx={{
                        m: 0,
                        py: 0.5,
                        px: 1.5,
                        listStyle: 'none',
                        columnWidth: 260,
                        columnGap: 2,
                        maxHeight: 240,
                        overflowY: 'auto',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                    }}
                >
                    {visible.map((member, index) => (
                        // El apellido puede repetirse entre familias: se usa el índice.
                        // eslint-disable-next-line react/no-array-index-key
                        <Box component="li" key={`${member.name}-${index}`} sx={{ py: 0.5, breakInside: 'avoid' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{member.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                                {member.email || 'Sin correo'}
                            </Typography>
                        </Box>
                    ))}
                </Box>
                {total > FAMILIES_PAGE && (
                    <Button size="small" onClick={() => setShowAll((prev) => !prev)} sx={{ mt: 0.5, px: 0 }}>
                        {showAll ? 'Ver solo las primeras 50' : `Ver todas (faltan ${total - FAMILIES_PAGE})`}
                    </Button>
                )}
            </Row>
        </>
    );
};

const AudienceDetail = ({ detail }) => {
    if (!detail) return <Typography variant="body2">—</Typography>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {detail.mode === 'families' && <FamiliesList families={detail.families} />}

            {detail.mode !== 'families' && (
                <Row title="Destinatarios">
                    <FieldGrid rows={[{ name: 'Roles', value: labelsOf(ROLE_OPTIONS, detail.roles) || '—' }]} />
                </Row>
            )}

            {detail.mode === 'schools' && (
                <Row title={`Colegios (${detail.schools.length})`}>
                    <SchoolsList schools={detail.schools} />
                </Row>
            )}

            {detail.mode === 'all' && (
                <Row title="Colegios">
                    <Typography variant="body2">Todos los colegios</Typography>
                    {detail.global?.scheduleCodes.length > 0 && (
                        <Typography variant="body2" color="text.secondary">Horarios: {detail.global.scheduleCodes.join(', ')}</Typography>
                    )}
                    {detail.global?.levels.length > 0 && (
                        <Typography variant="body2" color="text.secondary">Niveles: {detail.global.levels.join(', ')}</Typography>
                    )}
                </Row>
            )}

            {detail.padreFilters && <PadreFilters filters={detail.padreFilters} />}
        </Box>
    );
};

/**
 * Resumen corto para la columna "Audiencia" de la tabla (texto, no chips): el
 * detalle completo está en el diálogo; los nombres de colegio salen en el tooltip.
 */
export const AudienceSummaryText = ({ summary }) => {
    if (!summary) return '—';

    const roles = (summary.roleNames || []).join(', ');
    let scope;
    if (summary.kind === 'users') scope = `${summary.usersCount} familia(s) concreta(s)`;
    else if (summary.kind === 'all') scope = 'Todos los colegios';
    else scope = summary.schoolNames.length === 1 ? summary.schoolNames[0] : `${summary.schoolNames.length} colegios`;

    const text = (
        <Box>
            <Typography variant="body2">{scope}</Typography>
            {roles && <Typography variant="caption" color="text.secondary">{roles}</Typography>}
        </Box>
    );
    if (summary.kind !== 'schools' || summary.schoolNames.length < 2) return text;

    return <Tooltip title={summary.schoolNames.join(', ')}>{text}</Tooltip>;
};

export default AudienceDetail;
