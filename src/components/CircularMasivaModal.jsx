// src/components/CircularMasivaModal.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ListItemText,
    TextField,
    Button,
    Snackbar,
    Alert,
    Box,
    Checkbox,
    FormHelperText,
    Typography,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Stack,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    OutlinedInput,
} from '@mui/material';
import { FileUpload, ExpandMore, Notifications as NotificationsIcon } from '@mui/icons-material';
import api from '../utils/axiosConfig';
import { DEFAULT_SCHEDULE_CODES, getScheduleLabel } from '../utils/scheduleConfig';

const MENU_PROPS = { PaperProps: { style: { maxHeight: 280 } } };

const ROUTE_TYPE_OPTIONS = [
    { value: 'Completa', label: 'Completa' },
    { value: 'Media AM', label: 'Media AM' },
    { value: 'Media PM', label: 'Media PM' },
];

const SERVICE_STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Activo' },
    { value: 'PAUSED', label: 'Pausado' },
    { value: 'SUSPENDED', label: 'Suspendido' },
];

const PAYMENT_STATUS_OPTIONS = [
    { value: 'CONFIRMADO',  label: 'Pagado' },
    { value: 'ADELANTADO',  label: 'Adelantado' },
    { value: 'PENDIENTE',   label: 'Pendiente' },
    { value: 'MORA',        label: 'En Mora' },
    { value: 'EN_PROCESO',  label: 'En Proceso' },
];

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

const SingleChipSelect = ({ label, options, value, onChange, disabled = false, allowAll = false, allLabel = 'Todos' }) => {
    return (
        <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel>{label}</InputLabel>
            <Select
                value={value}
                onChange={onChange}
                input={<OutlinedInput label={label} />}
                renderValue={(selected) => {
                    const selectedStr = String(selected ?? '');
                    const opt = options.find((o) => String(o.value) === selectedStr);
                    const chipLabel = allowAll && selectedStr === 'all' ? allLabel : (opt?.label || selectedStr);
                    return <Chip label={chipLabel} size="small" />;
                }}
                MenuProps={MENU_PROPS}
            >
                {allowAll && (
                    <MenuItem value="all">
                        <ListItemText primary={<em>{allLabel}</em>} />
                    </MenuItem>
                )}
                {options.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                        <ListItemText primary={opt.label} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

// Build default counts object dynamically from schedule codes
const buildDefaultCounts = (codes = DEFAULT_SCHEDULE_CODES) =>
    Object.fromEntries(codes.map(c => [c, 0]));

const DEFAULT_COUNTS = buildDefaultCounts();

const DEFAULT_PREVIEW_COUNTS = {
    parents: 0,
    monitoras: 0,
    pilots: 0,
    supervisors: 0,
    auxiliars: 0,
    totalUnique: 0,
};

const EMPTY_PADRE_FILTERS = { routeTypes: [], serviceStatuses: [], paymentStatuses: [] };

const scheduleLabel = (code) => {
    if (!code) return 'Horario';
    const label = getScheduleLabel(code);
    return `${code} (${label})`;
};

const arraysEqual = (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (String(a[i]) !== String(b[i])) return false;
    }
    return true;
};

const CircularMasivaModal = ({ open, onClose, schools, onSuccess }) => {
    const [selectedSchool, setSelectedSchool] = useState('all');

    // 1) Rutas primero
    const [selectedRoutes, setSelectedRoutes] = useState([]); // strings
    // 2) Luego horario(s)
    const [selectedSchedules, setSelectedSchedules] = useState([]);

    // Counts reales por horario para esas rutas
    const [scheduleCounts, setScheduleCounts] = useState(DEFAULT_COUNTS);

    // Preview (muestra de correos)
    const [countsLoading, setCountsLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [preview, setPreview] = useState(null);

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);

    const [sending, setSending] = useState(false);
    const [sendEmail, setSendEmail] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [padreFilters, setPadreFilters] = useState({ ...EMPTY_PADRE_FILTERS });

    const selectedRoutesKey = useMemo(() => [...(selectedRoutes || [])].map(String).sort().join('|'), [selectedRoutes]);
    const padreFiltersKey = useMemo(() => JSON.stringify(padreFilters || EMPTY_PADRE_FILTERS), [padreFilters]);

    // Si no hay roles seleccionados, el modal debe mostrar 0 destinatarios
    const effectivePreview = useMemo(() => {
        if (!selectedRoles || selectedRoles.length === 0) {
            return {
                criteria: null,
                counts: DEFAULT_PREVIEW_COUNTS,
                sampleEmails: [],
                sampleLimit: 0,
            };
        }
        return preview;
    }, [selectedRoles, preview]);

    // IDs para evitar race conditions (respuestas viejas pisan estado nuevo)
    const countsReqId = useRef(0);
    const previewReqId = useRef(0);
    const initializedSchoolRef = useRef(false);

    const currentSchool = useMemo(() => {
        if (selectedSchool === 'all') return null;
        return schools.find(s => String(s.id) === String(selectedSchool)) || null;
    }, [selectedSchool, schools]);

    // Normalizar routeNumbers que pueden venir como array, string JSON o CSV
    const parseRouteNumbers = (rn) => {
        if (!rn) return [];
        if (Array.isArray(rn)) return rn.map(r => r != null ? String(r) : '').filter(Boolean);
        if (typeof rn === 'string' && rn.trim()) {
            try {
                const parsed = JSON.parse(rn);
                if (Array.isArray(parsed)) return parsed.map(r => r != null ? String(r) : '').filter(Boolean);
                return String(rn).split(',').map(s => s.trim()).filter(Boolean);
            } catch (e) {
                return String(rn).split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        return [];
    };

    const availableRoutes = useMemo(() => {
        if (!currentSchool) return [];
        return parseRouteNumbers(currentSchool.routeNumbers);
    }, [currentSchool]);

    // key estable para detectar cambios reales de availableRoutes
    const availableRoutesKey = useMemo(() => {
        // ordenar para que el key no cambie solo por orden
        return [...availableRoutes].sort().join('|');
    }, [availableRoutes]);

    const routeOptions = useMemo(
        () => availableRoutes.map(r => ({ value: r, label: `Ruta ${r}` })),
        [availableRoutes]
    );

    const roleOptions = useMemo(
        () => ([
            { value: 'parents', label: 'Padres' },
            { value: 'monitoras', label: 'Monitoras' },
            { value: 'pilots', label: 'Pilotos' },
            { value: 'supervisors', label: 'Supervisores' },
            { value: 'auxiliars', label: 'Auxiliares' },
        ]),
        []
    );


    const padreSelected = selectedRoles.includes('parents');

    useEffect(() => {
        if (!padreSelected) {
            setPadreFilters({ ...EMPTY_PADRE_FILTERS });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [padreSelected]);

    const schoolOptions = useMemo(
        () => (Array.isArray(schools) ? schools : []).map((s) => ({ value: String(s.id), label: s.name })),
        [schools]
    );
    const allowAllSchools = schoolOptions.length > 1;

    const schoolIdsForAll = useMemo(
        () => (Array.isArray(schools) ? schools : []).map((s) => String(s.id)).filter(Boolean),
        [schools]
    );

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        const maxSize = 5 * 1024 * 1024;
        if (selectedFile && selectedFile.size > maxSize) {
            setSnackbar({ open: true, message: 'El archivo no puede superar los 5MB.', severity: 'error' });
            e.target.value = null;
            setFile(null);
            return;
        }
        setFile(selectedFile);
    };

    const setMulti = (setter) => (event) => {
        const { value } = event.target;
        setter(typeof value === 'string' ? value.split(',') : value);
    };

    useEffect(() => {
        if (!open) {
            initializedSchoolRef.current = false;
            return;
        }

        if (initializedSchoolRef.current) return;

        if (schoolOptions.length === 1) {
            setSelectedSchool(String(schoolOptions[0].value));
        } else {
            setSelectedSchool('all');
        }

        initializedSchoolRef.current = true;
    }, [open, schoolOptions.length]);

    // =========================
    // RESET al cambiar colegio
    // =========================
    useEffect(() => {
        setSelectedRoutes([]);
        setSelectedSchedules([]);
        setScheduleCounts(DEFAULT_COUNTS);
        setPreview(null);
        setCountsLoading(false);
        setPreviewLoading(false);
    }, [selectedSchool]);

    // =========================================================
    // SANITIZAR rutas seleccionadas cuando cambie availableRoutes
    // (sin loop: solo setState si realmente cambia)
    // =========================================================
    useEffect(() => {
        if (!currentSchool) return;

        if (!selectedRoutes.length) return;

        const filtered = selectedRoutes.filter(r => availableRoutes.includes(String(r)));
        if (!arraysEqual(filtered, selectedRoutes)) {
            // SOLO si cambió realmente
            setSelectedRoutes(filtered);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableRoutesKey, currentSchool?.id]);

    // ==========================================
    // Cargar counts por horario cuando cambian rutas
    // ==========================================
    useEffect(() => {
        const loadCounts = async () => {
            if (selectedSchool === 'all') return;
            if (!currentSchool) return;

            if (selectedRoutes.length === 0) {
                setScheduleCounts(DEFAULT_COUNTS);
                setSelectedSchedules([]);
                setPreview(null);
                return;
            }

            const reqId = ++countsReqId.current;
            setCountsLoading(true);

            try {
                const resp = await api.post('/mail/send-circular/preview', {
                    schoolId: currentSchool.id,
                    routeNumbers: selectedRoutes,
                    // SIN scheduleCode => el backend devuelve scheduleCountsParents para habilitar botones
                });

                if (reqId !== countsReqId.current) return;

                const counts = resp.data?.scheduleCountsParents || DEFAULT_COUNTS;
                // Dynamically map all codes from the response
                const newCounts = {};
                Object.keys({ ...DEFAULT_COUNTS, ...counts }).forEach(k => {
                    newCounts[k] = Number(counts[k] || 0);
                });
                setScheduleCounts(newCounts);

                const validSchedules = (selectedSchedules || []).filter((code) => Number(counts[String(code)] || 0) > 0);
                if (!arraysEqual(validSchedules, selectedSchedules)) {
                    setSelectedSchedules(validSchedules);
                }
                if (validSchedules.length === 0) {
                    setPreview(null);
                }
            } catch (err) {
                if (reqId !== countsReqId.current) return;
                console.error('[CircularMasivaModal] Error cargando counts:', err);
                setScheduleCounts(DEFAULT_COUNTS);
                setSelectedSchedules([]);
                setPreview(null);
                setSnackbar({ open: true, message: 'No se pudieron calcular los horarios disponibles.', severity: 'error' });
            } finally {
                if (reqId === countsReqId.current) setCountsLoading(false);
            }
        };

        loadCounts();
        // OJO: no incluimos scheduleCounts ni preview aquí para evitar cascadas
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRoutes, currentSchool?.id]);

    // ==========================================
    // Cargar preview cuando cambia horario
    // ==========================================
    useEffect(() => {
        const loadPreview = async () => {
            if (selectedSchool !== 'all') {
                if (!currentSchool) return;
                if (selectedRoutes.length === 0) return;
            }

            // Si no hay roles, NO pedimos preview al backend: en UI debe verse todo en 0.
            if (!selectedRoles || selectedRoles.length === 0) {
                setPreview(null);
                return;
            }

            // Si se seleccionó el rol padres, debe haber al menos un horario válido.
            if (selectedSchool !== 'all' && selectedRoles.includes('parents') && selectedSchedules.length === 0) {
                setPreview(null);
                return;
            }

            if (selectedSchool !== 'all' && selectedSchedules.some((code) => Number(scheduleCounts[code] || 0) <= 0)) {
                setPreview(null);
                return;
            }

            const reqId = ++previewReqId.current;
            setPreviewLoading(true);

            try {
                const resp = await api.post('/mail/send-circular/preview', {
                    schoolId: selectedSchool,
                    schoolIds: selectedSchool === 'all' ? schoolIdsForAll : undefined,
                    routeNumbers: selectedSchool === 'all' ? [] : selectedRoutes,
                    scheduleCodes: selectedSchool === 'all' ? undefined : selectedSchedules,
                    recipientRoles: selectedRoles,
                    padreFilters: padreSelected ? padreFilters : undefined,
                });

                if (reqId !== previewReqId.current) return;

                const data = resp.data || {};
                setPreview({
                    criteria: data.criteria,
                    counts: data.counts,
                    sampleEmails: data.sampleEmails || [],
                    sampleLimit: data.sampleLimit || 0,
                });
            } catch (err) {
                if (reqId !== previewReqId.current) return;
                console.error('[CircularMasivaModal] Error cargando preview:', err);
                setPreview(null);
                setSnackbar({ open: true, message: 'No se pudo cargar la vista previa.', severity: 'error' });
            } finally {
                if (reqId === previewReqId.current) setPreviewLoading(false);
            }
        };

        loadPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSchedules, currentSchool?.id, selectedRoles, selectedRoutesKey, padreFiltersKey, padreSelected]);

    const availableScheduleCodes = Object.keys(scheduleCounts).filter((code) => Number(scheduleCounts[code] || 0) > 0);
    const allSchedulesSelected = availableScheduleCodes.length > 0 && availableScheduleCodes.every((code) => selectedSchedules.includes(code));

    const handleSelectAllSchedules = (event) => {
        const checked = event.target.checked;
        setSelectedSchedules(checked ? [...availableScheduleCodes] : []);
    };

    const handleScheduleChange = (_, nextValue) => {
        if (nextValue === null) return;
        setSelectedSchedules(nextValue || []);
    };

    const scheduleDisabled = (code) => {
        if (selectedRoutes.length === 0) return true;
        return Number(scheduleCounts[code] || 0) <= 0;
    };

    const handleSendCircular = async () => {
        if (!subject || !message) {
            setSnackbar({ open: true, message: 'Asunto y mensaje son requeridos.', severity: 'error' });
            return;
        }

        // Ruta → Horario obligatorio
        if (
            selectedSchool !== 'all' &&
            selectedRoutes.length > 0 &&
            selectedRoles.includes('parents') &&
            selectedSchedules.length === 0
        ) {
            setSnackbar({ open: true, message: 'Selecciona al menos un horario para las rutas elegidas.', severity: 'error' });
            return;
        }

        // Debe seleccionarse al menos un rol
        if (!selectedRoles || selectedRoles.length === 0) {
            setSnackbar({ open: true, message: 'Selecciona al menos un rol de destinatarios.', severity: 'error' });
            return;
        }

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('body', message);
            formData.append('schoolId', selectedSchool);
            if (selectedSchool === 'all') {
                formData.append('schoolIds', JSON.stringify(schoolIdsForAll));
            }
            formData.append('useSmtp', true);

            if (selectedSchool !== 'all' && selectedRoutes.length > 0) {
                formData.append('routeNumbers', JSON.stringify(selectedRoutes));
                formData.append('scheduleCodes', JSON.stringify(selectedSchedules));
            }

            // Incluir roles seleccionados para que el backend pueda filtrar destinatarios
            formData.append('recipientRoles', JSON.stringify(selectedRoles));

            if (padreSelected) {
                formData.append('padreFilters', JSON.stringify(padreFilters));
            }

            // Push SIEMPRE
            formData.append('sendPush', 'true');

            // Correo opcional
            formData.append('sendEmail', sendEmail ? 'true' : 'false');

            if (file) formData.append('file', file);

            await api.post('/mail/send-circular', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSnackbar({ open: true, message: 'Circular enviada correctamente.', severity: 'success' });
            if (onSuccess) onSuccess();

            // Reset total
            setSubject('');
            setMessage('');
            setFile(null);
            setSelectedSchool('all');
            setSelectedRoutes([]);
            setSelectedSchedules([]);
            setScheduleCounts(DEFAULT_COUNTS);
            setPreview(null);
            setSendEmail(false);
            setPadreFilters({ ...EMPTY_PADRE_FILTERS });
            onClose();
        } catch (error) {
            console.error('Error al enviar circular:', error);
            setSnackbar({ open: true, message: 'Error al enviar la circular.', severity: 'error' });
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NotificationsIcon color="primary" />
                    Enviar Circular Masiva
                </DialogTitle>

                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
                        <Alert 
                            severity="info" 
                            sx={{ 
                                py: 1, 
                                px: 1.5, 
                                '& .MuiAlert-icon': { mt: '2px' },
                                fontSize: '0.875rem',
                            }}
                        >
                            Las circulares estarán disponibles en el historial de circulares del sistema y en la app/web para las familias que quieran consultar las circulares recibidas.
                        </Alert>

                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
                            Alcance
                        </Typography>

                        <Box>
                            <SingleChipSelect
                                label="Colegio"
                                options={schoolOptions}
                                value={String(selectedSchool)}
                                onChange={(e) => setSelectedSchool(String(e.target.value))}
                                allowAll={allowAllSchools}
                                allLabel="Todos"
                            />
                            {selectedSchool !== 'all' && (
                                <FormHelperText>
                                    Flujo: 1) Rutas ➜ 2) Horario ➜ 3) Roles ➜ 4) Vista previa ➜ Enviar.
                                </FormHelperText>
                            )}
                        </Box>

                        <Divider />

                        {/* 1) Rutas */}
                        {selectedSchool !== 'all' && (
                            <Accordion
                                disableGutters
                                elevation={0}
                                defaultExpanded
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: '8px !important',
                                    '&:before': { display: 'none' },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMore />}
                                    sx={{
                                        minHeight: 48,
                                        '&.Mui-expanded': { minHeight: 48 },
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle1" fontWeight={600}>1) Rutas</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedRoutes.length ? `${selectedRoutes.length} seleccionadas` : 'Ninguna seleccionada'}
                                            {availableRoutes.length ? ` • ${availableRoutes.length} disponibles` : ''}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>

                                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
                                    {availableRoutes.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Este colegio no tiene rutas registradas.
                                        </Typography>
                                    ) : (
                                        <>
                                            <MultiChipSelect
                                                label="Rutas"
                                                options={routeOptions}
                                                value={selectedRoutes}
                                                onChange={setMulti(setSelectedRoutes)}
                                            />

                                            {countsLoading && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CircularProgress size={16} />
                                                    <Typography variant="caption" color="text.secondary">
                                                        Calculando horarios disponibles...
                                                    </Typography>
                                                </Box>
                                            )}

                                            <FormHelperText>
                                                Selecciona al menos una ruta para habilitar el horario.
                                            </FormHelperText>
                                        </>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        )}

                        {/* 2) Horario */}
                        {selectedSchool !== 'all' && (
                            <Accordion
                                disableGutters
                                elevation={0}
                                defaultExpanded
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: '8px !important',
                                    '&:before': { display: 'none' },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMore />}
                                    sx={{
                                        minHeight: 48,
                                        '&.Mui-expanded': { minHeight: 48 },
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle1" fontWeight={600}>2) Horario</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedSchedules.length ? selectedSchedules.map(scheduleLabel).join(', ') : 'Sin seleccionar'}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>

                                <AccordionDetails sx={{ pt: 2 }}>
                                    <FormHelperText sx={{ mb: 1 }}>
                                        Se habilitan horarios que realmente tienen padres en las rutas seleccionadas.
                                    </FormHelperText>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                                        <Checkbox
                                            checked={allSchedulesSelected}
                                            indeterminate={!allSchedulesSelected && selectedSchedules.length > 0}
                                            onChange={handleSelectAllSchedules}
                                            disabled={availableScheduleCodes.length === 0}
                                            size="small"
                                        />
                                        <Typography variant="body2">Seleccionar todos los horarios disponibles</Typography>
                                    </Box>

                                    <ToggleButtonGroup
                                        value={selectedSchedules}
                                        onChange={handleScheduleChange}
                                        fullWidth
                                        size="small"
                                        multiple
                                        sx={{
                                            '& .MuiToggleButton-root': { textTransform: 'none', py: 1, border: '1px solid', borderColor: 'divider', borderRadius: 0 },
                                            '& .MuiToggleButton-root:first-of-type': { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                                            '& .MuiToggleButton-root:last-of-type': { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
                                            '& .MuiToggleButton-root:not(:first-of-type)': { borderLeft: 0 },
                                            '& .MuiToggleButton-root.Mui-selected': {
                                                bgcolor: 'background.paper',
                                                color: 'primary.main',
                                                borderColor: 'primary.main',
                                                borderLeft: '1px solid',
                                                borderLeftColor: 'primary.main',
                                                '&:hover': { bgcolor: 'action.hover' },
                                            },
                                            '& .MuiToggleButton-root .count': { color: 'text.secondary' },
                                            '& .MuiToggleButton-root.Mui-selected .count': { color: 'primary.main' },
                                            '& .MuiToggleButton-root.Mui-selected:disabled': { opacity: 0.6 },
                                        }}
                                    >
                                        {Object.keys(scheduleCounts).map(code => (
                                            <ToggleButton key={code} value={code} disabled={scheduleDisabled(code)}>
                                                <Stack spacing={0.2} alignItems="center">
                                                    <Typography variant="body2" fontWeight={700}>{code}</Typography>
                                                    <Typography variant="caption" className="count">{scheduleCounts[code] || 0} padres</Typography>
                                                </Stack>
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>

                                    {selectedRoutes.length === 0 && (
                                        <Alert severity="info" sx={{ mt: 1 }}>
                                            Selecciona rutas para habilitar horarios.
                                        </Alert>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        )}

                        {/* 3) Roles */}
                        {(selectedSchool === 'all' || (selectedSchool !== 'all' && selectedRoutes.length > 0)) && (
                            <Accordion
                                disableGutters
                                elevation={0}
                                defaultExpanded
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: '8px !important',
                                    '&:before': { display: 'none' },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMore />}
                                    sx={{
                                        minHeight: 48,
                                        '&.Mui-expanded': { minHeight: 48 },
                                    }}
                                >
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        {selectedSchool === 'all' ? '1) Roles' : '3) Roles'}
                                    </Typography>
                                </AccordionSummary>

                                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
                                    <FormHelperText>
                                        Selecciona los roles a los que quieres enviar la circular.
                                    </FormHelperText>
                                    <MultiChipSelect
                                        label="Roles"
                                        options={roleOptions}
                                        value={selectedRoles}
                                        onChange={setMulti(setSelectedRoles)}
                                    />

                                    {padreSelected && (
                                        <Accordion
                                            defaultExpanded={false}
                                            elevation={0}
                                            sx={{
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: '8px !important',
                                                '&:before': { display: 'none' },
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMore />}
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
                                                    value={padreFilters.routeTypes}
                                                    onChange={(e) => setPadreFilters((prev) => ({
                                                        ...prev,
                                                        routeTypes: Array.isArray(e.target.value) ? e.target.value : [],
                                                    }))}
                                                />
                                                <MultiChipSelect
                                                    label="Estado del Servicio"
                                                    options={SERVICE_STATUS_OPTIONS}
                                                    value={padreFilters.serviceStatuses}
                                                    onChange={(e) => setPadreFilters((prev) => ({
                                                        ...prev,
                                                        serviceStatuses: Array.isArray(e.target.value) ? e.target.value : [],
                                                    }))}
                                                />
                                                <MultiChipSelect
                                                    label="Estado de Pago"
                                                    options={PAYMENT_STATUS_OPTIONS}
                                                    value={padreFilters.paymentStatuses}
                                                    onChange={(e) => setPadreFilters((prev) => ({
                                                        ...prev,
                                                        paymentStatuses: Array.isArray(e.target.value) ? e.target.value : [],
                                                    }))}
                                                />
                                            </AccordionDetails>
                                        </Accordion>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        )}

                        {/* 4) Vista previa */}
                        {(selectedSchool === 'all' || selectedRoutes.length > 0) && (
                            <Accordion
                                disableGutters
                                elevation={0}
                                defaultExpanded
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: '8px !important',
                                    '&:before': { display: 'none' },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMore />}
                                    sx={{
                                        minHeight: 48,
                                        '&.Mui-expanded': { minHeight: 48 },
                                    }}
                                >
                                    <Typography variant="subtitle1" fontWeight={600}>4) Vista previa</Typography>
                                </AccordionSummary>

                                <AccordionDetails sx={{ pt: 2 }}>
                                    {selectedSchool !== 'all' && selectedRoles.includes('parents') && selectedSchedules.length === 0 ? (
                                        <Alert severity="warning">Selecciona un horario para ver la vista previa.</Alert>
                                    ) : previewLoading ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={18} />
                                            <Typography variant="body2">Cargando vista previa...</Typography>
                                        </Box>
                                    ) : !effectivePreview ? (
                                        <Alert severity="info">No hay vista previa para esa combinación.</Alert>
                                    ) : (
                                        <>
                                            {selectedSchool !== 'all' && (
                                                <Alert severity="info" sx={{ mb: 1 }}>
                                                    La vista previa muestra los destinatarios según los roles seleccionados para este colegio.
                                                </Alert>
                                            )}

                                            <Stack spacing={0.5}>
                                                <Typography variant="body2" fontWeight={700}>
                                                    Totales (únicos) a enviar:
                                                </Typography>

                                                <Typography variant="body2">• Padres: <strong>{effectivePreview?.counts?.parents ?? 0}</strong></Typography>
                                                <Typography variant="body2">• Monitoras: <strong>{effectivePreview?.counts?.monitoras ?? 0}</strong></Typography>
                                                <Typography variant="body2">• Pilotos: <strong>{effectivePreview?.counts?.pilots ?? 0}</strong></Typography>
                                                <Typography variant="body2">• Supervisores: <strong>{effectivePreview?.counts?.supervisors ?? 0}</strong></Typography>
                                                <Typography variant="body2">• Auxiliares: <strong>{effectivePreview?.counts?.auxiliars ?? 0}</strong></Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                    • Total únicos: <strong>{effectivePreview?.counts?.totalUnique ?? 0}</strong>
                                                </Typography>
                                            </Stack>

                                            <Divider sx={{ my: 1.5 }} />

                                            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                                                Muestra de correos (máx {effectivePreview.sampleLimit || 0})
                                            </Typography>

                                            {effectivePreview.sampleEmails?.length ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {effectivePreview.sampleEmails.map((email) => (
                                                        <Chip key={email} label={email} size="small" />
                                                    ))}
                                                    {(effectivePreview?.counts?.totalUnique ?? 0) > (effectivePreview.sampleEmails.length ?? 0) && (
                                                        <Chip
                                                            label={`+${(effectivePreview?.counts?.totalUnique - effectivePreview.sampleEmails.length)} más`}
                                                            size="small"
                                                            disabled
                                                        />
                                                    )}
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    No hay correos para esa combinación.
                                                </Typography>
                                            )}
                                        </>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        )}

                        <Divider />

                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
                            Contenido de la circular
                        </Typography>

                        <TextField
                            fullWidth
                            size="small"
                            label="Asunto"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                        <TextField
                            fullWidth
                            size="small"
                            label="Mensaje"
                            multiline
                            minRows={3}
                            maxRows={6}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Button variant="outlined" component="label" startIcon={<FileUpload />} size="small">
                                Seleccionar Archivo
                                <input type="file" hidden onChange={handleFileChange} />
                            </Button>
                            {file && <Typography variant="body2">{file.name}</Typography>}
                        </Box>

                        <FormControl component="fieldset" variant="standard">
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Checkbox
                                    checked={sendEmail}
                                    onChange={(e) => setSendEmail(e.target.checked)}
                                />
                                <Typography variant="body2">Enviar correo (opcional)</Typography>
                            </Stack>
                            <FormHelperText>
                                Enviar correo es opcional, al marcar esta opción se enviará correo electrónico a los destinatarios.
                            </FormHelperText>
                        </FormControl>

                    </Box>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={onClose} disabled={sending}>Cancelar</Button>
                    <Button
                        onClick={handleSendCircular}
                        variant="contained"
                        disabled={sending || selectedRoles.length === 0}
                        startIcon={sending ? <CircularProgress size={16} /> : <NotificationsIcon />}
                    >
                        {sending ? 'Enviando...' : 'Enviar Circular'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default CircularMasivaModal;
