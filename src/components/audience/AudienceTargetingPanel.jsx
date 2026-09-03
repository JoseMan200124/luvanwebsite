// src/components/audience/AudienceTargetingPanel.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Accordion, AccordionSummary, AccordionDetails, Alert, Box, Checkbox, Chip,
    CircularProgress, Divider, FormControl, FormHelperText, InputLabel, ListItemText,
    MenuItem, OutlinedInput, Select, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import {
    ROLE_OPTIONS, ROUTE_TYPE_OPTIONS, SERVICE_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS,
    getSchoolEntry, setSchoolIds, setSchoolField, setPadreFilter, setUserIds,
} from './audienceModel';
import FamilyPicker from './FamilyPicker';
import { previewAudience, fetchScheduleCounts } from '../../services/audienceService';
import { listEducationLevels } from '../../services/educationLevelsService';

const MENU_PROPS = { PaperProps: { style: { maxHeight: 280 } } };

const EMPTY_COUNTS = {
    parents: 0, parentsNoRoute: 0, pilots: 0,
    monitoras: 0, supervisors: 0, auxiliars: 0, totalUnique: 0,
};

const ACCORDION_SX = {
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '8px !important',
    '&:before': { display: 'none' },
};

// `grades` y `routeNumbers` llegan como array de strings o de objetos { name },
// según cómo se hayan guardado. Ambos formatos conviven en la base.
const toName = (item) => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'object') return String(item.name || '').trim();
    return String(item).trim();
};

const parseArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(toName).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(toName).filter(Boolean);
        } catch (e) {
            // cae al split por comas
        }
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
};

// `levelGrades` puede llegar como objeto o como string JSON según la capa que
// sirva el colegio.
const parseObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (e) {
            return {};
        }
    }
    return {};
};

const MultiChipSelect = ({ label, options, value, onChange, disabled = false, required = false }) => {
    const allSelected = options.length > 0 && options.every((opt) => value.includes(opt.value));
    const someSelected = !allSelected && options.some((opt) => value.includes(opt.value));

    const handleChange = (event) => {
        const raw = event.target.value;
        if (Array.isArray(raw) && raw.includes('__ALL__')) {
            onChange(allSelected ? [] : options.map((opt) => opt.value));
            return;
        }
        onChange(typeof raw === 'string' ? raw.split(',') : raw);
    };

    return (
        <FormControl
            fullWidth
            size="small"
            disabled={disabled}
            required={required}
            error={required && value.length === 0}
        >
            <InputLabel>{label}</InputLabel>
            <Select
                multiple
                value={value}
                onChange={handleChange}
                input={<OutlinedInput label={label} />}
                renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((item) => {
                            const opt = options.find((o) => o.value === item);
                            return <Chip key={item} label={opt?.label || item} size="small" />;
                        })}
                    </Box>
                )}
                MenuProps={MENU_PROPS}
            >
                <MenuItem value="__ALL__">
                    <Checkbox checked={allSelected} indeterminate={someSelected} />
                    <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontWeight: 600 }} />
                </MenuItem>
                <Divider />
                {options.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                        <Checkbox checked={value.includes(opt.value)} />
                        <ListItemText primary={opt.label} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

/**
 * Selector explícito Todos / Específicos (u otras variantes). Sin opción implícita:
 * el usuario siempre marca algo.
 */
const ScopeToggle = ({ label, options, value, onChange, error = false, helper }) => (
    <Box>
        <Typography
            variant="caption"
            fontWeight={700}
            sx={{ display: 'block', mb: 0.5, color: error ? 'error.main' : 'text.secondary' }}
        >
            {label}{error ? ' — elige una opción' : ''}
        </Typography>
        <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={value}
            onChange={(_, next) => { if (next) onChange(next); }}
            sx={{
                '& .MuiToggleButton-root': { textTransform: 'none', py: 0.5 },
                '& .Mui-selected': {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                    borderColor: 'primary.main',
                },
            }}
        >
            {options.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value}>{opt.label}</ToggleButton>
            ))}
        </ToggleButtonGroup>
        {helper && <FormHelperText error={error}>{helper}</FormHelperText>}
    </Box>
);

/**
 * Bloque de un colegio: rutas, horarios, y alcance académico (nivel O grado).
 * Cada apartado exige elegir explícitamente Todos o Específicos.
 */
const SchoolScopeCard = ({
    school, audience, onChange, cicloEscolarId, levels, showSchedule = false,
    modes, onModeChange, complete,
}) => {
    const entry = getSchoolEntry(audience, school.id);
    const [scheduleCodes, setScheduleCodes] = useState([]);
    const [loadingCounts, setLoadingCounts] = useState(false);
    const reqIdRef = useRef(0);

    const routeMode = modes.route || null;       // 'all' | 'some'
    const scheduleMode = modes.schedule || null; // 'all' | 'some'
    const academicMode = modes.academic || null; // 'all' | 'level' | 'grade'

    const availableRoutes = useMemo(() => parseArray(school.routeNumbers), [school.routeNumbers]);
    const availableGrades = useMemo(() => parseArray(school.grades), [school.grades]);
    const levelGrades = useMemo(() => parseObject(school.levelGrades), [school.levelGrades]);
    const availableLevels = useMemo(
        () => levels.filter((level) => {
            const grades = levelGrades[String(level.id)];
            return Array.isArray(grades) && grades.length > 0;
        }),
        [levels, levelGrades]
    );

    const routeKey = entry.routeNumbers.join('|');
    const wantSchedule = showSchedule && routeMode === 'some' && entry.routeNumbers.length > 0;

    useEffect(() => {
        const load = async () => {
            if (!wantSchedule) { setScheduleCodes([]); return; }
            const reqId = ++reqIdRef.current;
            setLoadingCounts(true);
            try {
                const counts = await fetchScheduleCounts({
                    schoolId: school.id,
                    routeNumbers: entry.routeNumbers,
                    cicloEscolarId,
                });
                if (reqId !== reqIdRef.current) return;
                setScheduleCodes(
                    Object.keys(counts || {}).filter((code) => Number(counts[code] || 0) > 0)
                );
            } catch (err) {
                if (reqId !== reqIdRef.current) return;
                console.error('[AudienceTargetingPanel] Error cargando horarios:', err);
                setScheduleCodes([]);
            } finally {
                if (reqId === reqIdRef.current) setLoadingCounts(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeKey, school.id, cicloEscolarId, wantSchedule]);

    const setField = (field, val) => onChange(setSchoolField(audience, school.id, field, val));

    const handleRouteMode = (next) => {
        onModeChange(school.id, 'route', next);
        if (next === 'all') {
            let a = setSchoolField(audience, school.id, 'routeNumbers', []);
            a = setSchoolField(a, school.id, 'scheduleCodes', []);
            onChange(a);
            onModeChange(school.id, 'schedule', null);
        }
    };
    const handleScheduleMode = (next) => {
        onModeChange(school.id, 'schedule', next);
        if (next === 'all') setField('scheduleCodes', []);
    };
    const handleAcademicMode = (next) => {
        onModeChange(school.id, 'academic', next);
        let a = audience;
        if (next !== 'level') a = setSchoolField(a, school.id, 'levelIds', []);
        if (next !== 'grade') a = setSchoolField(a, school.id, 'grades', []);
        onChange(a);
    };

    const summaryParts = [];
    if (routeMode === 'all') summaryParts.push('todas las rutas');
    else if (routeMode === 'some') summaryParts.push(`${entry.routeNumbers.length} ruta(s)`);
    if (wantSchedule) {
        if (scheduleMode === 'all') summaryParts.push('todos los horarios');
        else if (scheduleMode === 'some') summaryParts.push(`horario ${entry.scheduleCodes.join('/') || '—'}`);
    }
    if (academicMode === 'all') summaryParts.push('todo el colegio');
    else if (academicMode === 'level') summaryParts.push(`${entry.levelIds.length} nivel(es)`);
    else if (academicMode === 'grade') summaryParts.push(`${entry.grades.length} grado(s)`);
    const summary = complete
        ? (summaryParts.join(' · ') || 'Configurado')
        : '⚠ incompleto';

    return (
        <Accordion disableGutters elevation={0} defaultExpanded sx={ACCORDION_SX}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', pr: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{school.name}</Typography>
                    <Typography variant="caption" color={complete ? 'text.secondary' : 'error.main'}>{summary}</Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
                {/* Rutas */}
                {availableRoutes.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        Este colegio no tiene rutas registradas: se incluye a todo el colegio.
                    </Typography>
                ) : (
                    <>
                        <ScopeToggle
                            label="Rutas"
                            options={[
                                { value: 'all', label: 'Todas las rutas' },
                                { value: 'some', label: 'Rutas específicas' },
                            ]}
                            value={routeMode}
                            onChange={handleRouteMode}
                            error={routeMode === null}
                        />
                        {routeMode === 'some' && (
                            <MultiChipSelect
                                label="Rutas"
                                options={availableRoutes.map((route) => ({ value: route, label: `Ruta ${route}` }))}
                                value={entry.routeNumbers}
                                onChange={(val) => setField('routeNumbers', val)}
                                required
                            />
                        )}
                    </>
                )}

                {/* Horario (solo con rol Padres y rutas específicas) */}
                {wantSchedule && (
                    <>
                        <ScopeToggle
                            label="Horario"
                            options={[
                                { value: 'all', label: 'Todos los horarios' },
                                { value: 'some', label: 'Horarios específicos' },
                            ]}
                            value={scheduleMode}
                            onChange={handleScheduleMode}
                            error={scheduleMode === null}
                        />
                        {scheduleMode === 'some' && (
                            loadingCounts ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CircularProgress size={16} />
                                    <Typography variant="caption" color="text.secondary">
                                        Calculando horarios disponibles...
                                    </Typography>
                                </Box>
                            ) : (
                                <MultiChipSelect
                                    label="Horario(s)"
                                    options={scheduleCodes.map((code) => ({ value: code, label: code }))}
                                    value={entry.scheduleCodes}
                                    onChange={(codes) => setField('scheduleCodes', codes)}
                                    disabled={scheduleCodes.length === 0}
                                    required
                                />
                            )
                        )}
                    </>
                )}

                <Divider flexItem />

                {/* Alcance académico: nivel O grado, uno a la vez */}
                <ScopeToggle
                    label="Alcance académico"
                    options={[
                        { value: 'all', label: 'Todo el colegio' },
                        { value: 'level', label: 'Por nivel' },
                        { value: 'grade', label: 'Por grado' },
                    ]}
                    value={academicMode}
                    onChange={handleAcademicMode}
                    error={academicMode === null}
                    helper="Nivel y grado son excluyentes."
                />
                {academicMode === 'level' && (
                    availableLevels.length === 0 ? (
                        <Alert severity="warning">
                            Este colegio no tiene grados asignados a niveles. Usa «Por grado» o configúralo en el colegio.
                        </Alert>
                    ) : (
                        <MultiChipSelect
                            label="Niveles"
                            options={availableLevels.map((level) => ({ value: level.id, label: level.name }))}
                            value={entry.levelIds}
                            onChange={(val) => setField('levelIds', val)}
                            required
                        />
                    )
                )}
                {academicMode === 'grade' && (
                    <MultiChipSelect
                        label="Grados"
                        options={availableGrades.map((grade) => ({ value: grade, label: grade }))}
                        value={entry.grades}
                        onChange={(val) => setField('grades', val)}
                        disabled={availableGrades.length === 0}
                        required
                    />
                )}
            </AccordionDetails>
        </Accordion>
    );
};

const AudienceTargetingPanel = ({ schools = [], value, onChange, cicloEscolarId = null, onPreviewChange }) => {
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [levels, setLevels] = useState([]);
    const previewReqId = useRef(0);

    // El modo no puede derivarse solo de userIds.length: al cambiar a "familias
    // concretas" todavía no hay ninguna elegida y el toggle rebotaría a "filtros".
    const [scopeMode, setScopeMode] = useState(
        (value.userIds || []).length > 0 ? 'families' : 'filters'
    );
    const byFamilies = scopeMode === 'families' || (value.userIds || []).length > 0;

    // Nada implícito: el usuario marca Todos los colegios o Colegios específicos.
    const [schoolsChoice, setSchoolsChoice] = useState(
        (value.scope || []).length > 0 ? 'some' : null
    );
    // Modo explícito por colegio: { [schoolId]: { route, schedule, academic } }.
    const [schoolModes, setSchoolModes] = useState({});
    // Modo explícito global (cuando es Todos los colegios).
    const [globalModes, setGlobalModes] = useState({ schedule: null, academic: null });

    const setSchoolMode = useCallback((schoolId, field, val) => {
        setSchoolModes((prev) => ({
            ...prev,
            [schoolId]: { ...(prev[schoolId] || {}), [field]: val },
        }));
    }, []);

    // `onChange` estable para FamilyPicker: sin esto, elegir cada familia crea un
    // closure nuevo y vuelve a montar todo el subárbol del selector.
    const valueRef = useRef(value);
    valueRef.current = value;
    const handleFamilyIdsChange = useCallback((ids) => {
        onChange(setUserIds(valueRef.current, ids));
    }, [onChange]);

    useEffect(() => {
        let active = true;
        listEducationLevels()
            .then((data) => { if (active) setLevels(data); })
            .catch(() => { if (active) setLevels([]); });
        return () => { active = false; };
    }, []);

    const selectedSchoolIds = useMemo(
        () => (value.scope || []).map((entry) => Number(entry.schoolId)),
        [value.scope]
    );
    const selectedSchools = useMemo(
        () => schools.filter((school) => selectedSchoolIds.includes(Number(school.id))),
        [schools, selectedSchoolIds]
    );
    const padreSelected = (value.roles || []).includes('parents');

    const globalScheduleCodes = useMemo(() => {
        const seen = new Set();
        schools.forEach((school) => {
            (school.schedules || []).forEach((schedule) => {
                if (schedule?.code) seen.add(schedule.code);
            });
        });
        return [...seen].map((code) => ({ value: code, label: code }));
    }, [schools]);

    // Al aparecer un colegio nuevo en el alcance, deriva su modo inicial de lo ya
    // elegido (para no perder selección al reabrir el modal).
    useEffect(() => {
        setSchoolModes((prev) => {
            let changed = false;
            const next = { ...prev };
            selectedSchoolIds.forEach((id) => {
                if (next[id]) return;
                const e = getSchoolEntry(value, id);
                next[id] = {
                    route: e.routeNumbers.length > 0 ? 'some' : null,
                    schedule: e.scheduleCodes.length > 0 ? 'some' : null,
                    academic: e.levelIds.length > 0 ? 'level' : (e.grades.length > 0 ? 'grade' : null),
                };
                changed = true;
            });
            return changed ? next : prev;
        });
    }, [selectedSchoolIds, value]);

    // ---- Completitud secuencial ----
    const schoolComplete = useCallback((schoolId) => {
        const m = schoolModes[schoolId] || {};
        const e = getSchoolEntry(value, schoolId);
        const school = schools.find((s) => Number(s.id) === Number(schoolId));
        const hasRoutes = parseArray(school?.routeNumbers).length > 0;

        if (hasRoutes) {
            const routeOk = m.route === 'all' || (m.route === 'some' && e.routeNumbers.length > 0);
            if (!routeOk) return false;
            if (m.route === 'some' && padreSelected) {
                const schedOk = m.schedule === 'all' || (m.schedule === 'some' && e.scheduleCodes.length > 0);
                if (!schedOk) return false;
            }
        }
        return m.academic === 'all'
            || (m.academic === 'level' && e.levelIds.length > 0)
            || (m.academic === 'grade' && e.grades.length > 0);
    }, [schoolModes, value, padreSelected, schools]);

    const scopeComplete = byFamilies
        ? (value.userIds || []).length > 0
        : schoolsChoice === 'all' || (schoolsChoice === 'some' && selectedSchoolIds.length > 0);

    const rolesComplete = byFamilies || (
        (value.roles || []).length > 0
        && (!padreSelected || (
            (value.padreFilters?.routeTypes || []).length > 0
            && (value.padreFilters?.serviceStatuses || []).length > 0
            && (value.padreFilters?.paymentStatuses || []).length > 0
        ))
    );

    const optionsComplete = byFamilies || (
        schoolsChoice === 'all'
            ? (
                (!padreSelected
                    || globalModes.schedule === 'all'
                    || (globalModes.schedule === 'some' && (value.scheduleCodes || []).length > 0))
                && (globalModes.academic === 'all'
                    || (globalModes.academic === 'level' && (value.levelIds || []).length > 0))
            )
            : (selectedSchoolIds.length > 0 && selectedSchoolIds.every(schoolComplete))
    );

    const allComplete = scopeComplete && rolesComplete && optionsComplete;

    const handleGlobalScheduleMode = (next) => {
        setGlobalModes((m) => ({ ...m, schedule: next }));
        if (next === 'all') onChange({ ...value, scheduleCodes: [] });
    };
    const handleGlobalAcademicMode = (next) => {
        setGlobalModes((m) => ({ ...m, academic: next }));
        if (next !== 'level') onChange({ ...value, levelIds: [] });
    };
    const handleSchoolsChoice = (next) => {
        setSchoolsChoice(next);
        if (next === 'all') {
            setSchoolModes({});
            onChange({ ...setSchoolIds(value, []), scheduleCodes: [], levelIds: [] });
        }
    };

    const audienceKey = JSON.stringify(value);

    useEffect(() => {
        // Familias concretas: los destinatarios SON los userIds elegidos. No hace
        // falta pegarle al backend en cada selección; el conteo es local.
        if ((value.userIds || []).length > 0) {
            previewReqId.current += 1; // invalida cualquier fetch en vuelo
            const n = value.userIds.length;
            const localPreview = {
                counts: { ...EMPTY_COUNTS, parents: n, totalUnique: n },
                sampleEmails: [],
                sampleLimit: 0,
                warnings: [],
            };
            setPreview(localPreview);
            setPreviewLoading(false);
            setPreviewError('');
            if (onPreviewChange) onPreviewChange(localPreview);
            return undefined;
        }

        const load = async () => {
            // No se consulta hasta que las 3 secciones estén completas.
            if (!allComplete) {
                previewReqId.current += 1;
                setPreview(null);
                setPreviewError('');
                setPreviewLoading(false);
                if (onPreviewChange) {
                    onPreviewChange({ counts: EMPTY_COUNTS, sampleEmails: [], sampleLimit: 0, warnings: [] });
                }
                return;
            }

            const reqId = ++previewReqId.current;
            setPreviewLoading(true);
            setPreviewError('');
            try {
                const data = await previewAudience({ audience: value, cicloEscolarId });
                if (reqId !== previewReqId.current) return;
                setPreview(data);
                if (onPreviewChange) onPreviewChange(data);
            } catch (err) {
                if (reqId !== previewReqId.current) return;
                console.error('[AudienceTargetingPanel] Error cargando vista previa:', err);
                setPreview(null);
                setPreviewError('No se pudo calcular la vista previa de destinatarios.');
                if (onPreviewChange) onPreviewChange(null);
            } finally {
                if (reqId === previewReqId.current) setPreviewLoading(false);
            }
        };

        const timer = setTimeout(load, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audienceKey, cicloEscolarId, allComplete]);

    const counts = preview?.counts || EMPTY_COUNTS;

    let scopeHeadline;
    if (byFamilies) {
        scopeHeadline = `${value.userIds.length} familia(s)`;
    } else if (schoolsChoice === 'all') {
        scopeHeadline = 'Todos los colegios';
    } else if (schoolsChoice === 'some') {
        scopeHeadline = `${selectedSchoolIds.length} colegio(s)`;
    } else {
        scopeHeadline = 'Sin elegir';
    }

    let previewBody;
    if (previewLoading) {
        previewBody = (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2">Cargando vista previa...</Typography>
            </Box>
        );
    } else if (previewError) {
        previewBody = <Alert severity="error">{previewError}</Alert>;
    } else {
        previewBody = (
            <>
                {(preview?.warnings || []).map((warning) => (
                    <Alert key={warning} severity="warning" sx={{ mb: 1 }}>{warning}</Alert>
                ))}

                <Stack spacing={0.5}>
                    <Typography variant="body2" fontWeight={700}>Totales (únicos) a enviar:</Typography>
                    <Typography variant="body2">
                        • Padres: <strong>{counts.parents}</strong>
                        {counts.parentsNoRoute > 0 && (
                            <> (incluye <strong>{counts.parentsNoRoute}</strong> sin ruta)</>
                        )}
                    </Typography>
                    <Typography variant="body2">• Monitoras: <strong>{counts.monitoras}</strong></Typography>
                    <Typography variant="body2">• Pilotos: <strong>{counts.pilots}</strong></Typography>
                    <Typography variant="body2">• Supervisores: <strong>{counts.supervisors}</strong></Typography>
                    <Typography variant="body2">• Auxiliares: <strong>{counts.auxiliars}</strong></Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                        • Total únicos: <strong>{counts.totalUnique}</strong>
                    </Typography>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                    Muestra de correos (máx {preview?.sampleLimit || 0})
                </Typography>

                {preview?.sampleEmails?.length ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {preview.sampleEmails.map((email) => (
                            <Chip key={email} label={email} size="small" />
                        ))}
                        {counts.totalUnique > preview.sampleEmails.length && (
                            <Chip
                                label={`+${counts.totalUnique - preview.sampleEmails.length} más`}
                                size="small"
                                disabled
                            />
                        )}
                    </Box>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        No hay destinatarios para esa combinación.
                    </Typography>
                )}
            </>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* 1) Alcance: modo + colegios */}
            <Accordion disableGutters elevation={0} defaultExpanded sx={ACCORDION_SX}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', pr: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            {byFamilies ? 'Alcance' : '1) Alcance'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{scopeHeadline}</Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={scopeMode}
                        onChange={(_, next) => {
                            if (!next || next === scopeMode) return;
                            setScopeMode(next);
                            onChange(next === 'families'
                                ? { ...value, scope: [], scheduleCodes: [], levelIds: [], roles: [], userIds: [] }
                                : setUserIds(value, []));
                        }}
                        sx={{ '& .MuiToggleButton-root': { textTransform: 'none' } }}
                    >
                        <ToggleButton value="filters">Por filtros</ToggleButton>
                        <ToggleButton value="families">Familias concretas</ToggleButton>
                    </ToggleButtonGroup>

                    {byFamilies ? (
                        <>
                            <Alert severity="info">
                                Al elegir familias concretas se ignoran los demás filtros y los roles.
                            </Alert>
                            <FamilyPicker
                                value={value.userIds || []}
                                onChange={handleFamilyIdsChange}
                                cicloEscolarId={cicloEscolarId}
                            />
                        </>
                    ) : (
                        <>
                            <ScopeToggle
                                label="Colegios"
                                options={[
                                    { value: 'all', label: 'Todos los colegios' },
                                    { value: 'some', label: 'Colegios específicos' },
                                ]}
                                value={schoolsChoice}
                                onChange={handleSchoolsChoice}
                                error={schoolsChoice === null}
                            />
                            {schoolsChoice === 'some' && (
                                <MultiChipSelect
                                    label="Colegio(s)"
                                    options={schools.map((school) => ({ value: Number(school.id), label: school.name }))}
                                    value={selectedSchoolIds}
                                    onChange={(ids) => onChange(setSchoolIds(value, ids))}
                                    required
                                />
                            )}
                            {schoolsChoice === 'all' && (
                                <Alert severity="info">
                                    El envío alcanza a todos los colegios del ciclo. Horario y nivel se eligen
                                    de forma global en «Opciones». El grado no aplica (varía por colegio).
                                </Alert>
                            )}
                        </>
                    )}
                </AccordionDetails>
            </Accordion>

            {/* 2) Roles */}
            {!byFamilies && (
                <Accordion
                    disableGutters
                    elevation={0}
                    expanded={scopeComplete}
                    disabled={!scopeComplete}
                    sx={ACCORDION_SX}
                >
                    <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', pr: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>2) Roles</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {!scopeComplete
                                    ? 'Completa el Alcance'
                                    : ((value.roles || []).length > 0 ? `${(value.roles || []).length} rol(es)` : 'Sin roles')}
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
                        <MultiChipSelect
                            label="Roles"
                            options={ROLE_OPTIONS}
                            value={value.roles || []}
                            onChange={(roles) => onChange({ ...value, roles })}
                            required
                        />

                        {padreSelected && (
                            <Accordion defaultExpanded elevation={0} sx={ACCORDION_SX}>
                                <AccordionSummary
                                    expandIcon={<ExpandMore />}
                                    sx={{ backgroundColor: '#f0f4ff', borderRadius: '8px', minHeight: 48 }}
                                >
                                    <Typography variant="body2" fontWeight={600} color="primary">
                                        Filtros adicionales — Padres
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Checkbox
                                            size="small"
                                            sx={{ mt: -0.5 }}
                                            checked={Boolean(value.padreFilters?.includeNoRoute)}
                                            onChange={(e) => onChange(setPadreFilter(value, 'includeNoRoute', e.target.checked))}
                                        />
                                        <Box>
                                            <Typography variant="body2">Incluir familias sin ruta asignada</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Suma a las familias cuyo(s) hijo(s) no tienen ruta en el ciclo actual.
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <MultiChipSelect
                                        label="Tipo de Ruta"
                                        options={ROUTE_TYPE_OPTIONS}
                                        value={value.padreFilters?.routeTypes || []}
                                        onChange={(next) => onChange(setPadreFilter(value, 'routeTypes', next))}
                                        required
                                    />
                                    <MultiChipSelect
                                        label="Estado del Servicio"
                                        options={SERVICE_STATUS_OPTIONS}
                                        value={value.padreFilters?.serviceStatuses || []}
                                        onChange={(next) => onChange(setPadreFilter(value, 'serviceStatuses', next))}
                                        required
                                    />
                                    <MultiChipSelect
                                        label="Estado de Pago"
                                        options={PAYMENT_STATUS_OPTIONS}
                                        value={value.padreFilters?.paymentStatuses || []}
                                        onChange={(next) => onChange(setPadreFilter(value, 'paymentStatuses', next))}
                                        required
                                    />
                                    <FormHelperText>
                                        Tipo de Ruta, Estado del Servicio y Estado de Pago son obligatorios.
                                        «Incluir familias sin ruta» es opcional.
                                    </FormHelperText>
                                </AccordionDetails>
                            </Accordion>
                        )}
                    </AccordionDetails>
                </Accordion>
            )}

            {/* 3) Opciones: horarios / niveles / grados */}
            {!byFamilies && (
                <Accordion
                    disableGutters
                    elevation={0}
                    expanded={scopeComplete && rolesComplete}
                    disabled={!scopeComplete || !rolesComplete}
                    sx={ACCORDION_SX}
                >
                    <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', pr: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>3) Opciones</Typography>
                            <Typography variant="caption" color={optionsComplete ? 'text.secondary' : 'error.main'}>
                                {(!scopeComplete || !rolesComplete)
                                    ? 'Completa lo anterior'
                                    : (optionsComplete ? 'Listo' : 'Faltan opciones')}
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
                        {schoolsChoice === 'all' ? (
                            <>
                                {padreSelected && (
                                    <>
                                        <ScopeToggle
                                            label="Horario"
                                            options={[
                                                { value: 'all', label: 'Todos los horarios' },
                                                { value: 'some', label: 'Horarios específicos' },
                                            ]}
                                            value={globalModes.schedule}
                                            onChange={handleGlobalScheduleMode}
                                            error={globalModes.schedule === null}
                                        />
                                        {globalModes.schedule === 'some' && (
                                            <MultiChipSelect
                                                label="Horario(s)"
                                                options={globalScheduleCodes}
                                                value={value.scheduleCodes || []}
                                                onChange={(codes) => onChange({ ...value, scheduleCodes: codes })}
                                                disabled={globalScheduleCodes.length === 0}
                                                required
                                            />
                                        )}
                                    </>
                                )}
                                <ScopeToggle
                                    label="Alcance académico"
                                    options={[
                                        { value: 'all', label: 'Todos' },
                                        { value: 'level', label: 'Por nivel' },
                                    ]}
                                    value={globalModes.academic}
                                    onChange={handleGlobalAcademicMode}
                                    error={globalModes.academic === null}
                                    helper="El nivel se expande a los grados que cada colegio le tenga asignados."
                                />
                                {globalModes.academic === 'level' && (
                                    <MultiChipSelect
                                        label="Niveles"
                                        options={levels.map((level) => ({ value: level.id, label: level.name }))}
                                        value={value.levelIds || []}
                                        onChange={(ids) => onChange({ ...value, levelIds: ids })}
                                        disabled={levels.length === 0}
                                        required
                                    />
                                )}
                            </>
                        ) : (
                            selectedSchools.map((school) => (
                                <SchoolScopeCard
                                    key={school.id}
                                    school={school}
                                    audience={value}
                                    onChange={onChange}
                                    cicloEscolarId={cicloEscolarId}
                                    levels={levels}
                                    showSchedule={padreSelected}
                                    modes={schoolModes[school.id] || {}}
                                    onModeChange={setSchoolMode}
                                    complete={schoolComplete(school.id)}
                                />
                            ))
                        )}
                    </AccordionDetails>
                </Accordion>
            )}

            {/* Vista previa */}
            <Accordion disableGutters elevation={0} defaultExpanded sx={ACCORDION_SX}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', pr: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>Vista previa</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {allComplete ? `${counts.totalUnique} destinatario(s)` : '—'}
                        </Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2 }}>
                    {allComplete ? previewBody : (
                        <Typography variant="body2" color="text.secondary">
                            Completa las secciones anteriores para calcular los destinatarios.
                        </Typography>
                    )}
                </AccordionDetails>
            </Accordion>
        </Box>
    );
};

export default AudienceTargetingPanel;
