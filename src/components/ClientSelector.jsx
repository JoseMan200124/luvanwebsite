import { Autocomplete, ListSubheader, TextField } from '@mui/material';
import { getCicloEscolarOptionLabel } from '../services/cicloEscolarService';

export const CORPORATIONS_GROUP_LABEL = 'Corporaciones';

// Encabezado de sección del selector (colegios por ciclo escolar y Corporaciones). Se pasa a `renderGroup` de un Autocomplete con `groupBy`.
export const renderClientGroup = (params) => (
    <li key={params.key}>
        <ListSubheader disableSticky sx={{ lineHeight: 1.6, color: '#1976d2', fontWeight: 800, bgcolor: 'background.paper' }}>
            {params.group}
        </ListSubheader>
        <ul style={{ padding: 0 }}>{params.children}</ul>
    </li>
);

const getSchoolCycleGroupLabel = (school) =>
    getCicloEscolarOptionLabel(school?.cicloEscolar) || (school?.cicloEscolarId ? `Ciclo ${school.cicloEscolarId}` : 'Sin ciclo escolar');

// Opciones de cliente: colegios agrupados por ciclo escolar y una sección de Corporaciones, todo en orden alfabético.
const buildClientOptions = (schools = [], corporations = []) => [
    ...schools.map((school) => ({
        label: school.name,
        value: `school-${school.id}`,
        type: 'school',
        id: school.id,
        groupLabel: getSchoolCycleGroupLabel(school)
    })),
    ...corporations.map((corporation) => ({
        label: corporation.name,
        value: `corp-${corporation.id}`,
        type: 'corp',
        id: corporation.id,
        groupLabel: CORPORATIONS_GROUP_LABEL
    }))
].sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, 'es') || a.label.localeCompare(b.label, 'es'));

// Dos clientes son el mismo si coinciden en tipo e id (el valor guardado de un registro no trae `value`).
const isSameClient = (a, b) => a?.type === b?.type && String(a?.id) === String(b?.id);

// Id de colegio o de corporación del cliente elegido, o '' si no hay uno de ese tipo.
export const getClientSchoolId = (client) => (client?.type === 'school' ? String(client.id) : '');
export const getClientCorporationId = (client) => (client?.type === 'corp' ? String(client.id) : '');

/**
 * Filtro "Cliente" unificado: colegios por ciclo y corporaciones en un solo selector.
 * `value` es una opción devuelta por `onChange` (o null).
 */
const ClientSelector = ({
    schools,
    corporations,
    value,
    onChange,
    size = 'small',
    fullWidth = true,
    helperText,
    sx
}) => {
    const options = buildClientOptions(schools, corporations);

    return (
        <Autocomplete
            size={size}
            fullWidth={fullWidth}
            sx={sx}
            options={options}
            value={value ? (options.find((option) => isSameClient(option, value)) || value) : null}
            onChange={(event, newValue) => onChange(newValue)}
            getOptionLabel={(option) => option?.label || ''}
            groupBy={(option) => option.groupLabel}
            renderGroup={renderClientGroup}
            isOptionEqualToValue={isSameClient}
            noOptionsText="Sin coincidencias"
            clearOnEscape
            renderInput={(params) => <TextField {...params} label="Cliente" helperText={helperText} />}
        />
    );
};

export default ClientSelector;
