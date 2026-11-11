// src/components/FailureMappingFormDialog.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
    FormControl, InputLabel, Select, Alert, Box, Typography,
    CircularProgress, Autocomplete, Chip, ListSubheader,
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment-timezone';
import api from '../utils/axiosConfig';
import {
    FAILURE_TYPES, CONFLICT_CODES, FORCEABLE_CODE, createFailureMappingWeb, updateFailureMapping,
} from '../services/failureMappingService';
import { getCicloEscolarYear } from '../services/cicloEscolarService';
import ClientSelector from './ClientSelector';
import {
    MODOS_MAPEO, emptyForm, recordToForm, validateForm, buildCreatePayload, buildUpdatePayload,
} from '../utils/failureMappingForm';

const TZ = 'America/Guatemala';
// El valor guardado sigue siendo incidente/accidente; aquí se muestra con el texto de la app del supervisor.
const GRAVEDAD_OPTIONS = {
    incidente: 'Problema menor',
    accidente: 'Problema mayor',
};

// Pregunta Sí/No que guarda un booleano en el formulario.
const SiNoSelect = ({ label, value, onChange }) => (
    <FormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select value={value ? 'si' : 'no'} label={label} onChange={(e) => onChange(e.target.value === 'si')}>
            <MenuItem value="si">Sí</MenuItem>
            <MenuItem value="no">No</MenuItem>
        </Select>
    </FormControl>
);

const GROUP_CLIENT_BUSES = 'Buses del cliente';
const GROUP_OTHER_BUSES = 'Otros buses';

// Se busca por placa, cliente o ruta.
const filterPlates = createFilterOptions({
    stringify: (o) => `${o.plate} ${o.clientName} ${o.route}`,
});

const compareRoutes = (a, b) => String(a).localeCompare(String(b), 'es', { numeric: true });

const FailureMappingFormDialog = ({ open, onClose, onSaved, record = null }) => {
    const isEdit = Boolean(record?.id);
    const [form, setForm] = useState(emptyForm);
    // Clientes de todos los ciclos (incluidos archivados): un registro manual puede ser de cualquier ciclo,
    // sin depender del filtro de ciclo de la página.
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    // Todos los buses (con su cliente y ruta actuales) y los números de ruta del cliente elegido
    const [allBuses, setAllBuses] = useState([]);
    const [routeNumbers, setRouteNumbers] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    // Conflicto 409 con otros registros o con la placa: { message, code }
    const [conflict, setConflict] = useState(null);
    // Evita el doble guardado: `saving` (estado) se actualiza tras el render, un segundo clic llega antes
    const guardandoRef = useRef(false);
    // La fecha no cae en el año escolar de ningún ciclo del colegio: se pregunta a cuál pertenece el registro
    const [cicloPendiente, setCicloPendiente] = useState(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        setForm(record ? recordToForm(record) : emptyForm());
        setError('');
        setConflict(null);
        setCicloPendiente(null);
    }, [open, record]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        let cancelled = false;
        api.get('/schools', { params: { allCycles: true, includeArchived: true } })
            .then((response) => {
                if (!cancelled) {
                    setSchools(Array.isArray(response.data) ? response.data : (response.data?.schools || []));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setSchools([]);
                }
            });
        api.get('/corporations', { params: { allCycles: true } })
            .then((response) => {
                if (!cancelled) {
                    setCorporations(Array.isArray(response.data) ? response.data : (response.data?.corporations || []));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCorporations([]);
                }
            });
        api.get('/buses/simple', { params: { includeDecommissioned: true } })
            .then((response) => {
                if (!cancelled) {
                    setAllBuses(Array.isArray(response.data?.buses) ? response.data.buses : []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setAllBuses([]);
                }
            });
        return () => { cancelled = true; };
    }, [open]);

    useEffect(() => {
        if (!open || !form.clientId) {
            setRouteNumbers([]);
            return undefined;
        }
        let cancelled = false;
        const url = form.clientType === 'school'
            ? `/routes/school/${form.clientId}/numbers`
            : `/routes/corporation/${form.clientId}/numbers`;
        api.get(url)
            .then((response) => {
                if (!cancelled) {
                    setRouteNumbers((response.data?.routeNumbers || []).map(String));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setRouteNumbers([]);
                }
            });
        return () => { cancelled = true; };
    }, [open, form.clientType, form.clientId]);

    const set = (patch) => {
        setConflict(null);
        setCicloPendiente(null);
        setForm((prev) => ({ ...prev, ...patch }));
    };

    // El selector unificado usa type 'school' | 'corp'; el formulario guarda 'school' | 'corporation'.
    const clientValue = form.clientId
        ? { type: form.clientType === 'school' ? 'school' : 'corp', id: form.clientId }
        : null;

    const handleClientChange = (client) => {
        set({
            clientType: client?.type === 'school' ? 'school' : 'corporation',
            clientId: client ? client.id : '',
            placa: '',
            numeroRuta: '',
        });
    };

    // Solo se aceptan placas que existen en el sistema (buses sin borrado lógico).
    // Elegir una opción del cliente trae su ruta; una placa de otro cliente conserva la ruta ya elegida.
    const handlePlacaSelect = (option) => {
        if (!option) {
            set({ placa: '' });
            return;
        }
        set({
            placa: option.plate,
            numeroRuta: option.ofClient && option.route ? option.route : form.numeroRuta,
        });
    };

    // Dos secciones: los buses actuales del cliente elegido (por ruta) y el resto (por placa).
    const plateOptions = useMemo(() => {
        const pertenece = (b) => (form.clientType === 'school'
            ? b.schoolId != null && String(b.schoolId) === String(form.clientId)
            : b.corporationId != null && String(b.corporationId) === String(form.clientId));
        // Hay una fila de colegio por ciclo: el nombre lleva el año (ej. "Julio Verne 2026")
        const schoolsById = new Map(schools.map((sc) => [String(sc.id), sc]));
        const nombreCliente = (b) => {
            if (b.school?.name) {
                const year = getCicloEscolarYear(schoolsById.get(String(b.schoolId))?.cicloEscolar);
                return year ? `${b.school.name} ${year}` : b.school.name;
            }
            return b.corporation?.name || '';
        };
        return allBuses
            .map((b) => {
                const ofClient = pertenece(b);
                return {
                    id: b.id,
                    plate: String(b.plate).toUpperCase(),
                    route: b.routeNumber ? String(b.routeNumber) : '',
                    clientName: nombreCliente(b),
                    decommissioned: Boolean(b.decommissioned),
                    ofClient,
                    group: ofClient ? GROUP_CLIENT_BUSES : GROUP_OTHER_BUSES,
                };
            })
            .sort((a, b) => {
                if (a.ofClient !== b.ofClient) {
                    return a.ofClient ? -1 : 1;
                }
                if (a.ofClient && a.route !== b.route) {
                    return compareRoutes(a.route || '~', b.route || '~');
                }
                return a.plate.localeCompare(b.plate, 'es', { numeric: true });
            });
    }, [allBuses, schools, form.clientType, form.clientId]);

    const handleSave = async (force = false, cicloColegioId = null) => {
        if (guardandoRef.current) {
            return;
        }
        const validation = validateForm(form);
        if (validation) {
            setError(validation);
            return;
        }
        // Un registro existente puede traer una placa que ya no existe; solo se exige al cambiarla.
        const placaConservada = isEdit && record?.placaBus === form.placa;
        if (form.modo === 'falla' && !placaConservada && !plateOptions.some((o) => o.plate === form.placa)) {
            setError('La placa no existe en el sistema. Elige una de la lista.');
            return;
        }
        // Placa de otro cliente: no hay una ruta del bus que usar, la ruta es obligatoria
        const placaDelCliente = plateOptions.some((o) => o.plate === form.placa && o.ofClient);
        if (form.modo === 'falla' && !placaDelCliente && !form.numeroRuta) {
            setError('La placa no es de este cliente: selecciona la ruta.');
            return;
        }
        guardandoRef.current = true;
        setSaving(true);
        setError('');
        try {
            if (isEdit) {
                await updateFailureMapping(record.id, buildUpdatePayload(form, force, cicloColegioId));
            } else {
                await createFailureMappingWeb(buildCreatePayload(form, force, cicloColegioId));
            }
            onSaved();
        } catch (err) {
            const data = err?.response?.data;
            if (err?.response?.status === 409 && data?.code === 'CICLO_REQUERIDO') {
                setCicloPendiente(data);
            } else if (err?.response?.status === 409 && CONFLICT_CODES.includes(data?.code)) {
                setConflict({ message: data.message, code: data.code });
            } else {
                setError(data?.message || 'No se pudo guardar el mapeo de fallas.');
            }
        } finally {
            guardandoRef.current = false;
            setSaving(false);
        }
    };

    const showFalla = form.modo === 'falla';
    const placaValue = form.placa
        ? (plateOptions.find((o) => o.plate === form.placa && o.ofClient)
            || plateOptions.find((o) => o.plate === form.placa)
            // Placa de un registro viejo que ya no existe: se muestra para poder editar lo demás
            || { id: `legacy-${form.placa}`, plate: form.placa, route: '', clientName: '', decommissioned: false, ofClient: false, group: 'Placa sin registro en el sistema' })
        : null;
    const esDiaAnterior = form.dia && moment(form.dia).isBefore(moment.tz(TZ), 'day');

    // Rutas del cliente; si el registro trae una que ya no existe, se conserva para poder mostrarla.
    const routeOptions = useMemo(() => {
        const list = [...routeNumbers];
        if (form.numeroRuta && !list.includes(String(form.numeroRuta))) {
            list.push(String(form.numeroRuta));
        }
        return list.sort(compareRoutes);
    }, [routeNumbers, form.numeroRuta]);

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
                <DialogTitle>{isEdit ? 'Editar mapeo de fallas' : 'Nuevo registro de mapeo de fallas'}</DialogTitle>
                <DialogContent dividers>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {isEdit
                            ? 'Estás editando un registro existente. Los cambios reemplazan los datos actuales.'
                            : 'Este registro se guardará como ingreso manual a tu nombre.'}
                    </Alert>
                    {esDiaAnterior && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {`Registro de un día anterior (${moment(form.dia).format('dddd D [de] MMMM [de] YYYY')}). Afectará los totales del reporte PDF de ${moment(form.dia).format('MMMM YYYY')}.`}
                        </Alert>
                    )}
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {cicloPendiente && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>{cicloPendiente.message}</Typography>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                                {(cicloPendiente.opciones || []).map((o) => (
                                    <Button
                                        key={o.colegioId}
                                        size="small"
                                        variant="outlined"
                                        color="inherit"
                                        disabled={saving}
                                        onClick={() => handleSave(false, o.colegioId)}
                                    >
                                        {[o.nombre, o.cicloEscolarAnio].filter(Boolean).join(' ')}
                                        {o.desde && o.hasta
                                            ? ` (${moment(o.desde).format('DD/MM/YYYY')} – ${moment(o.hasta).format('DD/MM/YYYY')})`
                                            : ''}
                                    </Button>
                                ))}
                            </Box>
                        </Alert>
                    )}
                    {conflict && (
                        <Alert
                            severity="error"
                            variant="filled"
                            sx={{ mb: 2, fontWeight: 600 }}
                            action={conflict.code === FORCEABLE_CODE ? (
                                <Button color="inherit" size="small" disabled={saving} onClick={() => handleSave(true)}>
                                    Guardar de todos modos
                                </Button>
                            ) : undefined}
                        >
                            {conflict.message}
                        </Alert>
                    )}

                    <Box display="flex" flexDirection="column" gap={2}>
                        <FormControl fullWidth>
                            <InputLabel>Tipo de registro</InputLabel>
                            <Select value={form.modo} label="Tipo de registro" onChange={(e) => set({ modo: e.target.value })}>
                                {Object.entries(MODOS_MAPEO).map(([key, label]) => (
                                    <MenuItem key={key} value={key}>{label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <ClientSelector
                            schools={schools}
                            corporations={corporations}
                            value={clientValue}
                            onChange={handleClientChange}
                            size="medium"
                        />

                        <DatePicker
                            label="Día del registro"
                            value={form.dia}
                            onChange={(val) => set({ dia: val })}
                            disableFuture
                            format="DD/MM/YYYY"
                            slotProps={{ textField: { fullWidth: true } }}
                        />

                        {showFalla && (
                            <>
                                <Box display="flex" gap={2}>
                                    <Autocomplete
                                        fullWidth
                                        disabled={!form.clientId}
                                        options={plateOptions}
                                        groupBy={(o) => o.group}
                                        getOptionLabel={(o) => o.plate}
                                        filterOptions={filterPlates}
                                        isOptionEqualToValue={(o, v) => o.id === v.id}
                                        value={placaValue}
                                        onChange={(_, value) => handlePlacaSelect(value)}
                                        renderGroup={(params) => (
                                            <li key={params.key}>
                                                <ListSubheader disableSticky sx={{ lineHeight: 1.6, color: '#1976d2', fontWeight: 800, bgcolor: 'background.paper' }}>
                                                    {params.group}
                                                </ListSubheader>
                                                <ul style={{ padding: 0 }}>{params.children}</ul>
                                            </li>
                                        )}
                                        renderOption={(props, o) => (
                                            <li {...props} key={o.id}>
                                                <Box display="flex" flexDirection="column" width="100%">
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Typography variant="body2" fontWeight={700}>{o.plate}</Typography>
                                                        {o.decommissioned && <Chip size="small" label="De baja" variant="outlined" />}
                                                    </Box>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {[o.clientName || 'Sin cliente', o.route ? `Ruta ${o.route}` : null].filter(Boolean).join(' · ')}
                                                    </Typography>
                                                </Box>
                                            </li>
                                        )}
                                        noOptionsText="No existe una placa con ese texto en el sistema"
                                        renderInput={(params) => (
                                            <TextField {...params} label="Placa" />
                                        )}
                                    />
                                    <FormControl fullWidth disabled={!form.clientId}>
                                        <InputLabel>Ruta</InputLabel>
                                        <Select
                                            value={form.numeroRuta}
                                            label="Ruta"
                                            onChange={(e) => set({ numeroRuta: e.target.value })}
                                            MenuProps={{ PaperProps: { style: { maxHeight: 48 * 6 } } }}
                                        >
                                            <MenuItem value=""><em>Sin ruta</em></MenuItem>
                                            {routeOptions.map((r) => (
                                                <MenuItem key={r} value={r}>{`Ruta ${r}`}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>
                                <Box display="flex" gap={2}>
                                    <FormControl fullWidth>
                                        <InputLabel>¿Qué tan grave fue?</InputLabel>
                                        <Select value={form.tipo} label="¿Qué tan grave fue?" onChange={(e) => set({ tipo: e.target.value })}>
                                            {Object.entries(GRAVEDAD_OPTIONS).map(([key, label]) => (
                                                <MenuItem key={key} value={key}>{label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControl fullWidth>
                                        <InputLabel>Tipo de falla</InputLabel>
                                        <Select value={form.tipoFalla} label="Tipo de falla" onChange={(e) => set({ tipoFalla: e.target.value })}>
                                            {Object.entries(FAILURE_TYPES).map(([key, label]) => (
                                                <MenuItem key={key} value={key}>{label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>
                                {form.tipoFalla === 'otro' && (
                                    <TextField
                                        label="Detalle de la falla"
                                        value={form.otroFallaDetalle}
                                        onChange={(e) => set({ otroFallaDetalle: e.target.value })}
                                        fullWidth
                                    />
                                )}
                                <Box display="flex" flexWrap="wrap" gap={2}>
                                    <Box flex={1} minWidth={200}>
                                        <SiNoSelect label="¿Afectó el recorrido?" value={form.routeAffected} onChange={(v) => set({ routeAffected: v })} />
                                    </Box>
                                    <Box flex={1} minWidth={200}>
                                        <SiNoSelect label="¿Pudo continuar la ruta?" value={form.pudoContinuarRuta} onChange={(v) => set({ pudoContinuarRuta: v })} />
                                    </Box>
                                    <Box flex={1} minWidth={200}>
                                        <SiNoSelect label="¿Se utilizó bus suplente?" value={form.seUtilizoBusSuplente} onChange={(v) => set({ seUtilizoBusSuplente: v })} />
                                    </Box>
                                </Box>
                            </>
                        )}

                        {!showFalla && (
                            <Typography variant="body2" color="textSecondary">
                                {form.modo === 'sin_fallas'
                                    ? 'Se registrará que el cliente no tuvo fallas ese día (aplica a todos los buses).'
                                    : 'Se registrará que el cliente no tuvo operación ese día (por ejemplo, sin clases).'}
                            </Typography>
                        )}

                        <TextField
                            label="Descripción"
                            value={form.descripcion}
                            onChange={(e) => set({ descripcion: e.target.value })}
                            multiline
                            minRows={3}
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} color="inherit" disabled={saving}>Cancelar</Button>
                    <Button
                        onClick={() => handleSave(false)}
                        variant="contained"
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {isEdit ? 'Guardar cambios' : 'Guardar registro'}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default FailureMappingFormDialog;
