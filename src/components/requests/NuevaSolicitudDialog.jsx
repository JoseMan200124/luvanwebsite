import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import {
    Box, TextField, MenuItem, Typography, List, ListItemButton, ListItemText, Radio, CircularProgress, Alert,
} from '@mui/material';
import { AddCircleOutline as AddIcon } from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import AppDialog from '../dialogs/AppDialog';
import api from '../../utils/axiosConfig';
import useNotify from '../../hooks/useNotify';
import { useCurrentDate } from '../../hooks/useCurrentDate';
import { createRequest, VALID_REQUEST_TYPES } from '../../services/requestService';
import { agruparFamilias, filtrarFamilias, etiquetaFamilia, opcionesRutas, opcionesHorarios } from '../../utils/solicitudesFamilias';

const PRIORIDADES = [
    { value: 'low', label: 'Baja' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' },
];

const FORM_INICIAL = { requestType: '', title: '', description: '', priority: 'medium', dueDate: null };

/**
 * Crear una solicitud a nombre de UNA familia del colegio: ruta → horario → familia → datos.
 * Solo se monta en la vista de solicitudes de un colegio operativo (RequestsPage decide).
 */
const NuevaSolicitudDialog = ({ open, schoolId, onClose, onCreated }) => {
    const notify = useNotify();
    const { currentDate } = useCurrentDate();
    const hoy = currentDate.format('YYYY-MM-DD');

    const [rutas, setRutas] = useState([]);
    const [cargandoRutas, setCargandoRutas] = useState(false);
    const [routeNumber, setRouteNumber] = useState('');
    const [scheduleCode, setScheduleCode] = useState('');
    const [filas, setFilas] = useState([]);
    const [cargandoFamilias, setCargandoFamilias] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [familiaId, setFamiliaId] = useState(null);
    const [form, setForm] = useState(FORM_INICIAL);
    const [enviando, setEnviando] = useState(false);

    // Al abrir: reiniciar y cargar rutas y horarios del colegio.
    useEffect(() => {
        if (!open) {
            return;
        }
        // Ignora respuestas de una ruta (o apertura) anterior.
        let vigente = true;
        setRouteNumber('');
        setScheduleCode('');
        setFilas([]);
        setBusqueda('');
        setFamiliaId(null);
        setForm(FORM_INICIAL);
        setCargandoRutas(true);
        api.get(`/schools/${schoolId}/route-schedules`)
            .then((res) => {
                if (vigente) {
                    setRutas(Array.isArray(res.data?.routeSchedules) ? res.data.routeSchedules : []);
                }
            })
            .catch(() => {
                if (vigente) {
                    setRutas([]);
                    notify.error('No se pudieron cargar las rutas del colegio');
                }
            })
            .finally(() => {
                if (vigente) {
                    setCargandoRutas(false);
                }
            });
        return () => {
            vigente = false;
        };
    }, [open, schoolId, notify]);

    const opcionesRuta = useMemo(() => opcionesRutas(rutas), [rutas]);
    const opcionesHorario = useMemo(() => opcionesHorarios(rutas, routeNumber), [rutas, routeNumber]);

    // Al cambiar de ruta: limpiar familias y elegir el horario solo si la ruta tiene uno.
    const elegirRuta = (valor) => {
        const horarios = opcionesHorarios(rutas, valor);
        setRouteNumber(valor);
        setScheduleCode(horarios.length === 1 ? horarios[0].scheduleCode : '');
        setFilas([]);
        setFamiliaId(null);
    };

    // Al elegir ruta y horario: cargar alumnos y agruparlos por familia.
    useEffect(() => {
        if (!routeNumber || !scheduleCode) {
            return;
        }
        // Ignora respuestas de una ruta (o apertura) anterior.
        let vigente = true;
        setFamiliaId(null);
        setBusqueda('');
        setCargandoFamilias(true);
        api.get(`/routes/students/${schoolId}/${routeNumber}/${scheduleCode}`, { params: { day: 'all' } })
            .then((res) => {
                if (vigente) {
                    setFilas(Array.isArray(res.data?.students) ? res.data.students : []);
                }
            })
            .catch(() => {
                if (vigente) {
                    setFilas([]);
                    notify.error('No se pudieron cargar las familias de la ruta');
                }
            })
            .finally(() => {
                if (vigente) {
                    setCargandoFamilias(false);
                }
            });
        return () => {
            vigente = false;
        };
    }, [routeNumber, scheduleCode, schoolId, notify]);

    const familias = useMemo(() => agruparFamilias(filas), [filas]);
    const visibles = useMemo(() => filtrarFamilias(familias, busqueda), [familias, busqueda]);
    const familia = familias.find((f) => f.parentUserId === familiaId) || null;
    const esBaja = form.requestType === 'service_cancellation';
    const puedeEnviar = Boolean(familia && form.requestType && form.title.trim() && (!esBaja || form.description.trim()));

    const cambiar = (campo) => (evento) => setForm((anterior) => ({ ...anterior, [campo]: evento.target.value }));

    const enviar = async () => {
        if (!puedeEnviar || enviando) {
            return;
        }
        setEnviando(true);
        try {
            await createRequest({
                requestType: form.requestType,
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                priority: form.priority,
                schoolId: Number.parseInt(schoolId, 10),
                targetUserId: familia.parentUserId,
                dueDate: form.dueDate,
                metadata: { routeNumber, scheduleCode, studentIds: familia.alumnos.map((alumno) => alumno.id) },
            });
            notify.success('Solicitud creada. La familia recibió el aviso.');
            onCreated();
            onClose();
        } catch (error) {
            notify.error(error?.response?.data?.message || 'No se pudo crear la solicitud');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            title="Nueva solicitud"
            subtitle="Elige la ruta, el horario y la familia, y completa los datos. La familia recibirá el aviso."
            icon={<AddIcon />}
            size="md"
            onSubmit={enviar}
            submitLabel="Crear solicitud"
            submitting={enviando}
            submitDisabled={!puedeEnviar}
        >
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <TextField
                        select
                        fullWidth
                        label="1. Ruta"
                        value={routeNumber}
                        onChange={(e) => elegirRuta(e.target.value)}
                        disabled={cargandoRutas}
                        helperText={!cargandoRutas && opcionesRuta.length === 0 ? 'Este colegio no tiene rutas con horario.' : ' '}
                        slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } } } }}
                    >
                        {opcionesRuta.map((opcion) => <MenuItem key={opcion.routeNumber} value={opcion.routeNumber}>{opcion.label}</MenuItem>)}
                    </TextField>
                    <TextField
                        select
                        fullWidth
                        label="2. Horario"
                        value={scheduleCode}
                        onChange={(e) => setScheduleCode(e.target.value)}
                        disabled={!routeNumber}
                        helperText={routeNumber ? ' ' : 'Primero elige la ruta.'}
                    >
                        {opcionesHorario.map((opcion) => <MenuItem key={opcion.scheduleCode} value={opcion.scheduleCode}>{opcion.label}</MenuItem>)}
                    </TextField>
                </Box>

                {routeNumber && scheduleCode && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>3. Familia (elige una)</Typography>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Buscar por apellido o nombre del alumno"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        {cargandoFamilias ? <CircularProgress size={24} /> : (
                            <List dense sx={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #E5EAF2', borderRadius: 2 }}>
                                {visibles.length === 0 && (
                                    <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
                                        {familias.length === 0 ? 'No hay familias en esta ruta y horario.' : 'Ninguna familia coincide con la búsqueda.'}
                                    </Typography>
                                )}
                                {visibles.map((f) => (
                                    <ListItemButton key={f.parentUserId} selected={f.parentUserId === familiaId} onClick={() => setFamiliaId(f.parentUserId)}>
                                        <Radio edge="start" size="small" checked={f.parentUserId === familiaId} tabIndex={-1} />
                                        <ListItemText primary={etiquetaFamilia(f)} />
                                    </ListItemButton>
                                ))}
                            </List>
                        )}
                    </Box>
                )}

                {familia && (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>4. Datos de la solicitud</Typography>
                        <TextField select fullWidth label="Tipo" value={form.requestType} onChange={cambiar('requestType')}>
                            {Object.entries(VALID_REQUEST_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                        </TextField>
                        <TextField fullWidth label="Título" value={form.title} onChange={cambiar('title')} required />
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label={esBaja ? 'Descripción (obligatoria para una baja)' : 'Descripción'}
                            value={form.description}
                            onChange={cambiar('description')}
                            required={esBaja}
                        />
                        <TextField select fullWidth label="Prioridad" value={form.priority} onChange={cambiar('priority')}>
                            {PRIORIDADES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                        </TextField>
                        <LocalizationProvider dateAdapter={AdapterMoment}>
                            <DatePicker
                                label="Fecha límite (opcional)"
                                value={form.dueDate ? moment(form.dueDate, 'YYYY-MM-DD') : null}
                                onChange={(valor) => setForm((anterior) => ({ ...anterior, dueDate: valor?.isValid() ? valor.format('YYYY-MM-DD') : null }))}
                                minDate={moment(hoy, 'YYYY-MM-DD')}
                                format="DD/MM/YYYY"
                                slotProps={{ textField: { fullWidth: true, helperText: 'La familia no ve esta fecha.' }, field: { clearable: true } }}
                            />
                        </LocalizationProvider>
                        <Alert severity="info">Se registrará a nombre de la {etiquetaFamilia(familia)}.</Alert>
                    </Box>
                )}
            </Box>
        </AppDialog>
    );
};

NuevaSolicitudDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    schoolId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func.isRequired,
    onCreated: PropTypes.func.isRequired,
};

export default NuevaSolicitudDialog;
