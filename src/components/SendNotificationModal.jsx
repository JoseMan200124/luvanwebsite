// src/components/SendNotificationModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    OutlinedInput,
    Typography,
    Box,
    Alert,
    CircularProgress,
    Divider,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from '@mui/material';
import { Notifications as NotificationsIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { sendManualNotification } from '../services/notificationService';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Role definitions with their targeting group:
 * - operational : Piloto, Monitora  → route-only filters (no payment/service/routeType)
 * - family      : Padre             → route + scheduleSlot + payment/service/routeType filters
 * - admin       : Supervisor, Auxiliar → school-level only
 */
const ROLES = [
    { value: 'Piloto',     label: 'Piloto',     group: 'operational' },
    { value: 'Monitora',   label: 'Monitora',   group: 'operational' },
    { value: 'Padre',      label: 'Padre',      group: 'family'      },
    { value: 'Supervisor', label: 'Supervisor', group: 'admin'       },
    { value: 'Auxiliar',   label: 'Auxiliar',   group: 'admin'       },
];

const ROUTE_TYPE_OPTIONS = [
    { value: 'Completa', label: 'Completa' },
    { value: 'Media AM', label: 'Media AM' },
    { value: 'Media PM', label: 'Media PM' },
];

const SERVICE_STATUS_OPTIONS = [
    { value: 'ACTIVE',     label: 'Activo'     },
    { value: 'PAUSED',     label: 'Pausado'    },
    { value: 'SUSPENDED',  label: 'Suspendido' },
];

const PAYMENT_STATUS_OPTIONS = [
    { value: 'CONFIRMADO', label: 'Confirmado' },
    { value: 'PENDIENTE',  label: 'Pendiente'  },
    { value: 'MORA',       label: 'En Mora'    },
];

const MENU_PROPS = { PaperProps: { style: { maxHeight: 280 } } };
const MAX_MESSAGE_LENGTH = 255;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns route numbers from the school that have at least one of the
 * selected schedule codes assigned. Falls back to all route numbers when
 * routeSchedules data is unavailable or no schedules are selected.
 */
function getFilteredRouteNumbers(school, scheduleCodes) {
    if (!school) return [];
    const allRouteNumbers = Array.isArray(school.routeNumbers) ? school.routeNumbers : [];
    if (scheduleCodes.length === 0) return allRouteNumbers;

    let routeSchedules = school.routeSchedules;
    if (typeof routeSchedules === 'string') {
        try { routeSchedules = JSON.parse(routeSchedules); } catch { routeSchedules = []; }
    }
    if (!Array.isArray(routeSchedules) || routeSchedules.length === 0) return allRouteNumbers;

    return allRouteNumbers.filter((rn) => {
        const rs = routeSchedules.find((r) => String(r.routeNumber) === String(rn));
        if (!rs || !Array.isArray(rs.schedules)) return true; // no mapping → include
        return rs.schedules.some((s) => scheduleCodes.includes(s.code));
    });
}

/**
 * Builds the targeting criteria object from form state using role-grouped anyOf blocks.
 *
 * - Operational roles (Piloto, Monitora): route scope only, no schedule slot filtering
 * - Padre: route scope + schedule slot filtering + optional payment/service/routeType filters
 * - Admin roles (Supervisor, Auxiliar, Gestor): school scope only
 *
 * Multiple role groups → anyOf (union)
 * Multiple conditions within a role group → allOf (intersection)
 */
function buildTargetingCriteria(form) {
    if (form.roles.length === 0) return null;

    const operationalRoles = form.roles.filter((r) => ['Piloto', 'Monitora'].includes(r));
    const familyRoles      = form.roles.filter((r) => r === 'Padre');

    const anyOfBlocks = [];

    // Build a route block. When withSlotFilter=true, propagates scheduleCodes as
    // per-entry scheduleCode so the targeting service filters parents' ScheduleSlots.
    const buildRouteScope = (withSlotFilter) => {
        const schoolIds = form.schoolIds.map(Number);

        if (schoolIds.length === 0) {
            // Todos los colegios: only scheduleCodes can further restrict (for Padre)
            return withSlotFilter && form.scheduleCodes.length > 0
                ? { scheduleCodes: form.scheduleCodes }
                : null;
        }

        if (schoolIds.length === 1) {
            // Single school: can also scope by specific route numbers
            const schoolId = schoolIds[0];
            if (form.routeNumbers.length > 0) {
                const base = { clientType: 'school', clientId: schoolId, routeNumbers: form.routeNumbers };
                if (withSlotFilter && form.scheduleCodes.length > 0) {
                    return { routes: form.scheduleCodes.map((sc) => ({ ...base, scheduleCode: sc })) };
                }
                return { routes: [base] };
            }
            if (withSlotFilter && form.scheduleCodes.length > 0) {
                return { allOf: [{ schoolIds }, { scheduleCodes: form.scheduleCodes }] };
            }
            return { schoolIds };
        }

        // Multiple schools: school-level scope only (routes are ambiguous across schools)
        if (withSlotFilter && form.scheduleCodes.length > 0) {
            return { allOf: [{ schoolIds }, { scheduleCodes: form.scheduleCodes }] };
        }
        return { schoolIds };
    };

    // Operational roles — route scope only
    if (operationalRoles.length > 0) {
        const routeScope = buildRouteScope(false);
        const parts = [{ roles: operationalRoles }];
        if (routeScope) parts.push(routeScope);
        anyOfBlocks.push(parts.length === 1 ? parts[0] : { allOf: parts });
    }

    // Padre — route scope with slot filtering + additional family filters
    if (familyRoles.length > 0) {
        const routeScope = buildRouteScope(true);
        const parts = [{ roles: ['Padre'] }];
        if (routeScope) parts.push(routeScope);
        const { routeTypes, serviceStatuses, paymentStatuses } = form.padreFilters;
        if (routeTypes.length      > 0) parts.push({ routeTypes });
        if (serviceStatuses.length > 0) parts.push({ serviceStatuses });
        if (paymentStatuses.length > 0) parts.push({ paymentStatuses });
        anyOfBlocks.push(parts.length === 1 ? parts[0] : { allOf: parts });
    }

    // Admin roles — school scope only (Supervisor, Auxiliar)
    const adminRoles = form.roles.filter((r) => ['Supervisor', 'Auxiliar'].includes(r));
    if (adminRoles.length > 0) {
        const parts = [{ roles: adminRoles }];
        if (form.schoolIds.length > 0) parts.push({ schoolIds: form.schoolIds.map(Number) });
        anyOfBlocks.push(parts.length === 1 ? parts[0] : { allOf: parts });
    }

    if (anyOfBlocks.length === 0) return null;
    if (anyOfBlocks.length === 1) return anyOfBlocks[0];
    return { anyOf: anyOfBlocks };
}

// ─── Sub-component ────────────────────────────────────────────────────────────

const MultiChipSelect = ({ label, options, value, onChange, disabled = false }) => {
    const allSelected = options.length > 0 && options.every((o) => value.includes(o.value));
    const someSelected = !allSelected && options.some((o) => value.includes(o.value));

    const handleChange = (event) => {
        const raw = event.target.value;
        if (Array.isArray(raw) && raw.includes('__ALL__')) {
            onChange({ target: { value: allSelected ? [] : options.map((o) => o.value) } });
        } else {
            onChange(event);
        }
    };

    return (
        <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel>{label}</InputLabel>
            <Select
                multiple
                value={value}
                onChange={handleChange}
                input={<OutlinedInput label={label} />}
                renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((v) => {
                            const opt = options.find((o) => o.value === v);
                            return <Chip key={v} label={opt?.label || v} size="small" />;
                        })}
                    </Box>
                )}
                MenuProps={MENU_PROPS}
            >
                <MenuItem value="__ALL__">
                    <Checkbox checked={allSelected} indeterminate={someSelected} />
                    <ListItemText
                        primary="Seleccionar todos"
                        primaryTypographyProps={{ fontWeight: 600 }}
                    />
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

// ─── Form state ───────────────────────────────────────────────────────────────

const EMPTY_PADRE_FILTERS = { routeTypes: [], serviceStatuses: [], paymentStatuses: [] };

const EMPTY_FORM = {
    schoolIds:     [],  // selected school IDs (empty = todos los colegios)
    scheduleCodes: [],  // selected schedule codes (drives route number filtering)
    routeNumbers:  [],  // filtered by scheduleCodes; only usable when exactly 1 school selected
    roles:         [],
    padreFilters:  { ...EMPTY_PADRE_FILTERS },
    title:         '',
    message:       '',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @param {{ open: boolean, onClose: () => void, schools: Array }} props
 *   schools – array already loaded in SchoolYearSelectionPage (includes routeSchedules).
 */
const SendNotificationModal = ({ open, onClose, schools = [] }) => {
    const [form, setForm]       = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState(false);

    // Unique schedule codes for selected schools (union), or all schools if none selected
    const availableScheduleCodes = useMemo(() => {
        const sourceSchools = form.schoolIds.length > 0
            ? schools.filter((s) => form.schoolIds.includes(s.id))
            : schools;
        const seen = new Set();
        return sourceSchools.flatMap((school) =>
            (school.schedules || [])
                .filter((s) => !seen.has(s.code) && seen.add(s.code))
                .map((s) => ({ code: s.code, name: s.name || s.code }))
        );
    }, [form.schoolIds, schools]);

    // Route numbers only available when exactly 1 school is selected
    const singleSchool = form.schoolIds.length === 1
        ? schools.find((s) => s.id === form.schoolIds[0]) || null
        : null;
    const filteredRouteNumbers = getFilteredRouteNumbers(singleSchool, form.scheduleCodes);
    const padreSelected = form.roles.includes('Padre');

    // Purge route numbers that are no longer in the filtered list when schedules change
    useEffect(() => {
        const currentSingle = form.schoolIds.length === 1
            ? schools.find((s) => s.id === form.schoolIds[0]) || null
            : null;
        const filtered = getFilteredRouteNumbers(currentSingle, form.scheduleCodes);
        setForm((prev) => ({
            ...prev,
            routeNumbers: prev.routeNumbers.filter((rn) => filtered.includes(rn)),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.scheduleCodes]);

    // Clear Padre sub-filters when Padre role is deselected
    useEffect(() => {
        if (!form.roles.includes('Padre')) {
            setForm((prev) => ({ ...prev, padreFilters: { ...EMPTY_PADRE_FILTERS } }));
        }
    }, [form.roles]);

    const set = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
        setError('');
    };

    const setMulti = (field) => (event) => {
        const { value } = event.target;
        setForm((prev) => ({
            ...prev,
            [field]: typeof value === 'string' ? value.split(',') : value,
        }));
        setError('');
    };

    // School multi-select: reset dependent fields when selection changes
    const setSchoolIds = (event) => {
        const { value } = event.target;
        const newIds = typeof value === 'string' ? value.split(',') : value;
        setForm((prev) => ({ ...prev, schoolIds: newIds, scheduleCodes: [], routeNumbers: [] }));
        setError('');
    };

    const setPadreFilter = (field) => (event) => {
        const { value } = event.target;
        setForm((prev) => ({
            ...prev,
            padreFilters: {
                ...prev.padreFilters,
                [field]: typeof value === 'string' ? value.split(',') : value,
            },
        }));
    };

    const handleClose = () => {
        if (loading) return;
        setForm(EMPTY_FORM);
        setError('');
        setSuccess(false);
        onClose();
    };

    const handleSend = async () => {
        setError('');

        if (!form.title.trim()) { setError('El título es requerido.'); return; }
        if (!form.message.trim()) { setError('El mensaje es requerido.'); return; }
        if (form.message.length > MAX_MESSAGE_LENGTH) {
            setError(`El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`);
            return;
        }
        if (form.roles.length === 0) {
            setError('Selecciona al menos un rol de destinatario.');
            return;
        }
        if (form.roles.includes('Padre')) {
            const { routeTypes, serviceStatuses, paymentStatuses } = form.padreFilters;
            if (routeTypes.length === 0) {
                setError('Selecciona al menos un Tipo de Ruta en los filtros de Padre.');
                return;
            }
            if (serviceStatuses.length === 0) {
                setError('Selecciona al menos un Estado del Servicio en los filtros de Padre.');
                return;
            }
            if (paymentStatuses.length === 0) {
                setError('Selecciona al menos un Estado de Pago en los filtros de Padre.');
                return;
            }
        }

        const targetingCriteria = buildTargetingCriteria(form);
        if (!targetingCriteria) {
            setError('No se pudo construir el criterio de destinatarios. Verifica los filtros.');
            return;
        }

        setLoading(true);
        try {
            await sendManualNotification({
                title: form.title.trim(),
                message: form.message.trim(),
                targetingCriteria,
            });
            setSuccess(true);
            setTimeout(handleClose, 1500);
        } catch (err) {
            setError(err?.response?.data?.message || 'Error al enviar la notificación.');
        } finally {
            setLoading(false);
        }
    };

    const remaining = MAX_MESSAGE_LENGTH - form.message.length;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsIcon color="primary" />
                Enviar Notificación Push
            </DialogTitle>

            <DialogContent dividers>
                {success ? (
                    <Alert severity="success" sx={{ mt: 1 }}>
                        ¡Notificación enviada correctamente!
                    </Alert>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>

                        {/* ── Alcance ── */}
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
                            Alcance
                        </Typography>

                        {/* 1. Colegios (multi-select; vacío = todos los colegios) */}
                        <MultiChipSelect
                            label="Colegio(s)"
                            options={schools.map((s) => ({ value: s.id, label: s.name }))}
                            value={form.schoolIds}
                            onChange={setSchoolIds}
                        />

                        {/* 2. Horarios — drives available route numbers */}
                        <MultiChipSelect
                            label="Horario(s)"
                            options={availableScheduleCodes.map((sc) => ({
                                value: sc.code,
                                label: `${sc.code} — ${sc.name}`,
                            }))}
                            value={form.scheduleCodes}
                            onChange={setMulti('scheduleCodes')}
                            disabled={availableScheduleCodes.length === 0}
                        />

                        {/* 3. Números de Ruta — available only when exactly 1 school is selected */}
                        <MultiChipSelect
                            label="Números de Ruta"
                            options={filteredRouteNumbers.map((rn) => ({ value: rn, label: `Ruta ${rn}` }))}
                            value={form.routeNumbers}
                            onChange={setMulti('routeNumbers')}
                            disabled={form.schoolIds.length !== 1 || filteredRouteNumbers.length === 0}
                        />

                        <Divider />

                        {/* ── Roles ── */}
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
                            Roles destinatarios
                        </Typography>

                        <MultiChipSelect
                            label="Roles"
                            options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                            value={form.roles}
                            onChange={setMulti('roles')}
                        />

                        {/* Padre sub-filters — only shown when Padre is selected */}
                        {padreSelected && (
                            <Accordion
                                defaultExpanded
                                elevation={0}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: '8px !important',
                                    '&:before': { display: 'none' },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ backgroundColor: '#f0f4ff', borderRadius: '8px', minHeight: 48 }}
                                >
                                    <Typography variant="body2" fontWeight={600} color="primary">
                                        Filtros adicionales — Padres
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                                    <MultiChipSelect
                                        label="Tipo de Ruta"
                                        options={ROUTE_TYPE_OPTIONS}
                                        value={form.padreFilters.routeTypes}
                                        onChange={setPadreFilter('routeTypes')}
                                    />
                                    <MultiChipSelect
                                        label="Estado del Servicio"
                                        options={SERVICE_STATUS_OPTIONS}
                                        value={form.padreFilters.serviceStatuses}
                                        onChange={setPadreFilter('serviceStatuses')}
                                    />
                                    <MultiChipSelect
                                        label="Estado de Pago"
                                        options={PAYMENT_STATUS_OPTIONS}
                                        value={form.padreFilters.paymentStatuses}
                                        onChange={setPadreFilter('paymentStatuses')}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        )}

                        <Divider />

                        {/* ── Contenido ── */}
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
                            Contenido de la notificación
                        </Typography>

                        <TextField
                            label="Título"
                            value={form.title}
                            onChange={set('title')}
                            fullWidth
                            size="small"
                            required
                            inputProps={{ maxLength: 100 }}
                        />

                        <TextField
                            label="Mensaje"
                            value={form.message}
                            onChange={set('message')}
                            fullWidth
                            size="small"
                            required
                            multiline
                            minRows={3}
                            maxRows={6}
                            inputProps={{ maxLength: MAX_MESSAGE_LENGTH }}
                            helperText={
                                <Typography
                                    component="span"
                                    variant="caption"
                                    color={remaining < 20 ? 'error' : 'text.secondary'}
                                >
                                    {remaining} caracteres restantes
                                </Typography>
                            }
                        />

                        {error && <Alert severity="error">{error}</Alert>}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleClose} disabled={loading}>
                    Cancelar
                </Button>
                {!success && (
                    <Button
                        onClick={handleSend}
                        variant="contained"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={16} /> : <NotificationsIcon />}
                    >
                        {loading ? 'Enviando...' : 'Enviar Notificación'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default SendNotificationModal;
