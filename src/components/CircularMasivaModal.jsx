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
} from '@mui/material';
import { FileUpload, ExpandMore } from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import api from '../utils/axiosConfig';

const DEFAULT_COUNTS = { AM: 0, MD: 0, PM: 0, EX: 0 };

const scheduleLabel = (code) => {
    switch (code) {
        case 'AM': return 'AM (Mañana)';
        case 'MD': return 'MD (Mediodía)';
        case 'PM': return 'PM (Tarde)';
        case 'EX': return 'EX (Extra)';
        default: return 'Horario';
    }
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
    // 2) Luego horario
    const [selectedSchedule, setSelectedSchedule] = useState('');

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
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // IDs para evitar race conditions (respuestas viejas pisan estado nuevo)
    const countsReqId = useRef(0);
    const previewReqId = useRef(0);

    const currentSchool = useMemo(() => {
        if (selectedSchool === 'all') return null;
        return schools.find(s => String(s.id) === String(selectedSchool)) || null;
    }, [selectedSchool, schools]);

    const availableRoutes = useMemo(() => {
        if (!currentSchool) return [];
        const rn = Array.isArray(currentSchool.routeNumbers) ? currentSchool.routeNumbers : [];
        return rn.map(r => String(r)).filter(Boolean);
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

    const selectedRouteOptions = useMemo(
        () => routeOptions.filter(opt => selectedRoutes.includes(opt.value)),
        [routeOptions, selectedRoutes]
    );

    const renderCompactTags = (value, getTagProps) => {
        const maxShown = 3;
        const shown = value.slice(0, maxShown);
        const hiddenCount = value.length - shown.length;
        return (
            <>
                {shown.map((option, index) => (
                    <Chip key={option.value} label={option.label} size="small" {...getTagProps({ index })} />
                ))}
                {hiddenCount > 0 && <Chip label={`+${hiddenCount} más`} size="small" disabled />}
            </>
        );
    };

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

    const handleSelectAllRoutes = () => setSelectedRoutes(availableRoutes);

    const handleClearRoutes = () => {
        setSelectedRoutes([]);
        setSelectedSchedule('');
        setScheduleCounts(DEFAULT_COUNTS);
        setPreview(null);
    };

    // =========================
    // RESET al cambiar colegio
    // =========================
    useEffect(() => {
        setSelectedRoutes([]);
        setSelectedSchedule('');
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
                setSelectedSchedule('');
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
                setScheduleCounts({
                    AM: Number(counts.AM || 0),
                    MD: Number(counts.MD || 0),
                    PM: Number(counts.PM || 0),
                    EX: Number(counts.EX || 0),
                });

                // Si el horario actual ya no aplica (0), lo limpiamos (sin loop)
                if (selectedSchedule && Number(counts[selectedSchedule] || 0) <= 0) {
                    setSelectedSchedule('');
                    setPreview(null);
                }
            } catch (err) {
                if (reqId !== countsReqId.current) return;
                console.error('[CircularMasivaModal] Error cargando counts:', err);
                setScheduleCounts(DEFAULT_COUNTS);
                setSelectedSchedule('');
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
            if (selectedSchool === 'all') return;
            if (!currentSchool) return;
            if (selectedRoutes.length === 0) return;

            if (!selectedSchedule) {
                setPreview(null);
                return;
            }

            // si el horario está en 0, no pedimos preview
            if (Number(scheduleCounts[selectedSchedule] || 0) <= 0) {
                setPreview(null);
                return;
            }

            const reqId = ++previewReqId.current;
            setPreviewLoading(true);

            try {
                const resp = await api.post('/mail/send-circular/preview', {
                    schoolId: currentSchool.id,
                    routeNumbers: selectedRoutes,
                    scheduleCode: selectedSchedule,
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
    }, [selectedSchedule, currentSchool?.id]);

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
        if (selectedSchool !== 'all' && selectedRoutes.length > 0 && !selectedSchedule) {
            setSnackbar({ open: true, message: 'Selecciona un horario para las rutas elegidas.', severity: 'error' });
            return;
        }

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('body', message);
            formData.append('schoolId', selectedSchool);
            formData.append('useSmtp', true);

            if (selectedSchool !== 'all' && selectedRoutes.length > 0) {
                formData.append('routeNumbers', JSON.stringify(selectedRoutes));
                formData.append('scheduleCode', selectedSchedule);
            }

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
            setSelectedSchedule('');
            setScheduleCounts(DEFAULT_COUNTS);
            setPreview(null);
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
                <DialogTitle>Enviar Circular Masiva</DialogTitle>

                <DialogContent>
                    {/* Colegio */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            value={selectedSchool}
                            label="Colegio"
                            onChange={(e) => setSelectedSchool(e.target.value)}
                        >
                            <MenuItem value="all">
                                <em>Todos</em>
                            </MenuItem>
                            {schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                    {school.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            Flujo: 1) Rutas ➜ 2) Horario ➜ 3) Vista previa ➜ Enviar.
                        </FormHelperText>
                    </FormControl>

                    {/* 1) Rutas */}
                    {selectedSchool !== 'all' && (
                        <Box sx={{ mt: 1 }}>
                            <Accordion disableGutters elevation={0} square defaultExpanded>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle1" fontWeight={600}>1) Rutas</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedRoutes.length ? `${selectedRoutes.length} seleccionadas` : 'Ninguna seleccionada'}
                                            {availableRoutes.length ? ` • ${availableRoutes.length} disponibles` : ''}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>

                                <AccordionDetails>
                                    {availableRoutes.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Este colegio no tiene rutas registradas.
                                        </Typography>
                                    ) : (
                                        <>
                                            <Stack direction="row" spacing={1} sx={{ mb: 1 }} useFlexGap flexWrap="wrap">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={handleSelectAllRoutes}
                                                    disabled={selectedRoutes.length === availableRoutes.length}
                                                >
                                                    Seleccionar todas
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={handleClearRoutes}
                                                    disabled={selectedRoutes.length === 0}
                                                >
                                                    Limpiar
                                                </Button>

                                                {countsLoading && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                                                        <CircularProgress size={16} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            Calculando horarios disponibles...
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Stack>

                                            <Autocomplete
                                                multiple
                                                disableCloseOnSelect
                                                disablePortal
                                                options={routeOptions}
                                                value={selectedRouteOptions}
                                                onChange={(_, newValue) => {
                                                    // newValue son objetos {value,label}
                                                    setSelectedRoutes(newValue.map(v => v.value));
                                                }}
                                                getOptionLabel={(option) => option.label}
                                                renderOption={(props, option, { selected }) => (
                                                    <li {...props} key={option.value}>
                                                        <Checkbox style={{ marginRight: 8 }} checked={selected} />
                                                        {option.label}
                                                    </li>
                                                )}
                                                renderTags={renderCompactTags}
                                                ListboxProps={{ style: { maxHeight: 260, overflow: 'auto' } }}
                                                filterSelectedOptions
                                                fullWidth
                                                size="small"
                                                noOptionsText="Sin coincidencias"
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Buscar y seleccionar rutas"
                                                        placeholder="Escribe para filtrar..."
                                                    />
                                                )}
                                            />

                                            {selectedRoutes.length > 0 && (
                                                <>
                                                    <Divider sx={{ my: 1.5 }} />
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {selectedRouteOptions.slice(0, 10).map(opt => (
                                                            <Chip key={opt.value} label={opt.label} size="small" />
                                                        ))}
                                                        {selectedRoutes.length > 10 && (
                                                            <Chip label={`+${selectedRoutes.length - 10} más`} size="small" disabled />
                                                        )}
                                                    </Box>
                                                </>
                                            )}

                                            <FormHelperText sx={{ mt: 1 }}>
                                                Selecciona al menos una ruta para habilitar el horario.
                                            </FormHelperText>
                                        </>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    )}

                    {/* 2) Horario */}
                    {selectedSchool !== 'all' && (
                        <Box sx={{ mt: 1.25 }}>
                            <Accordion disableGutters elevation={0} square defaultExpanded>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle1" fontWeight={600}>2) Horario</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedSchedule ? scheduleLabel(selectedSchedule) : 'Sin seleccionar'}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>

                                <AccordionDetails>
                                    <FormHelperText sx={{ mb: 1 }}>
                                        Se habilitan horarios que realmente tienen padres en las rutas seleccionadas.
                                    </FormHelperText>

                                    <ToggleButtonGroup
                                        value={selectedSchedule}
                                        exclusive
                                        onChange={(_, val) => setSelectedSchedule(val ?? '')}
                                        fullWidth
                                        size="small"
                                        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 1 } }}
                                    >
                                        <ToggleButton value="AM" disabled={scheduleDisabled('AM')}>
                                            <Stack spacing={0.2} alignItems="center">
                                                <Typography variant="body2" fontWeight={700}>AM</Typography>
                                                <Typography variant="caption" color="text.secondary">{scheduleCounts.AM} padres</Typography>
                                            </Stack>
                                        </ToggleButton>

                                        <ToggleButton value="MD" disabled={scheduleDisabled('MD')}>
                                            <Stack spacing={0.2} alignItems="center">
                                                <Typography variant="body2" fontWeight={700}>MD</Typography>
                                                <Typography variant="caption" color="text.secondary">{scheduleCounts.MD} padres</Typography>
                                            </Stack>
                                        </ToggleButton>

                                        <ToggleButton value="PM" disabled={scheduleDisabled('PM')}>
                                            <Stack spacing={0.2} alignItems="center">
                                                <Typography variant="body2" fontWeight={700}>PM</Typography>
                                                <Typography variant="caption" color="text.secondary">{scheduleCounts.PM} padres</Typography>
                                            </Stack>
                                        </ToggleButton>

                                        <ToggleButton value="EX" disabled={scheduleDisabled('EX')}>
                                            <Stack spacing={0.2} alignItems="center">
                                                <Typography variant="body2" fontWeight={700}>EX</Typography>
                                                <Typography variant="caption" color="text.secondary">{scheduleCounts.EX} padres</Typography>
                                            </Stack>
                                        </ToggleButton>
                                    </ToggleButtonGroup>

                                    {selectedRoutes.length === 0 && (
                                        <Alert severity="info" sx={{ mt: 1 }}>
                                            Selecciona rutas para habilitar horarios.
                                        </Alert>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    )}

                    {/* 3) Vista previa */}
                    {selectedSchool !== 'all' && selectedRoutes.length > 0 && (
                        <Box sx={{ mt: 1.25 }}>
                            <Accordion disableGutters elevation={0} square defaultExpanded>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Typography variant="subtitle1" fontWeight={600}>3) Vista previa</Typography>
                                </AccordionSummary>

                                <AccordionDetails>
                                    {!selectedSchedule ? (
                                        <Alert severity="warning">Selecciona un horario para ver la vista previa.</Alert>
                                    ) : previewLoading ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={18} />
                                            <Typography variant="body2">Cargando vista previa...</Typography>
                                        </Box>
                                    ) : !preview ? (
                                        <Alert severity="info">No hay vista previa para esa combinación.</Alert>
                                    ) : (
                                        <>
                                            <Stack spacing={0.5}>
                                                <Typography variant="body2" fontWeight={700}>
                                                    Totales (únicos) a enviar:
                                                </Typography>

                                                <Typography variant="body2">• Padres: <strong>{preview.counts?.parents ?? 0}</strong></Typography>
                                                <Typography variant="body2">• Monitoras: <strong>{preview.counts?.monitoras ?? 0}</strong></Typography>
                                                <Typography variant="body2">• Pilotos: <strong>{preview.counts?.pilots ?? 0}</strong></Typography>
                                                <Typography variant="body2">• Supervisores: <strong>{preview.counts?.supervisors ?? 0}</strong></Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                    • Total únicos: <strong>{preview.counts?.totalUnique ?? 0}</strong>
                                                </Typography>
                                            </Stack>

                                            <Divider sx={{ my: 1.5 }} />

                                            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                                                Muestra de correos (máx {preview.sampleLimit || 0})
                                            </Typography>

                                            {preview.sampleEmails?.length ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {preview.sampleEmails.map((email) => (
                                                        <Chip key={email} label={email} size="small" />
                                                    ))}
                                                    {(preview.counts?.totalUnique ?? 0) > (preview.sampleEmails.length ?? 0) && (
                                                        <Chip
                                                            label={`+${(preview.counts.totalUnique - preview.sampleEmails.length)} más`}
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
                        </Box>
                    )}

                    {/* Asunto y mensaje */}
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Asunto"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Mensaje"
                        multiline
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />

                    {/* Archivo */}
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                            Seleccionar Archivo
                            <input type="file" hidden onChange={handleFileChange} />
                        </Button>
                        {file && <Box sx={{ mt: 1 }}>{file.name}</Box>}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={onClose} disabled={sending}>Cancelar</Button>
                    <Button onClick={handleSendCircular} variant="contained" disabled={sending}>
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
