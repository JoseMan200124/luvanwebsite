// src/components/UpdateEmployeeInfoDialog.jsx
import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    TextField,
    Button,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    Alert,
    Snackbar,
    Box,
    Divider,
    CircularProgress
} from '@mui/material';
import api from '../utils/axiosConfig';

const UpdateEmployeeInfoDialog = ({ open, onClose, initialData = {}, onSaved }) => {
    const [loading, setLoading] = useState(false);

    const [corporationId, setCorporationId] = useState('');

    // Campos del formulario de empleado
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [zoneOrSector, setZoneOrSector] = useState('');
    const [routeType, setRouteType] = useState('Completa');
    const [selectedSchedule, setSelectedSchedule] = useState(-1);

    const [schedules, setSchedules] = useState([]);
    const [extraFields, setExtraFields] = useState([]);
    const [formExtraValues, setFormExtraValues] = useState({});
    const [prefillExtraFields, setPrefillExtraFields] = useState(null);

    const getExtraValue = (fieldName) => {
        if (!formExtraValues) return '';
        if (formExtraValues[fieldName] !== undefined) return formExtraValues[fieldName];
        const target = String(fieldName || '').trim().toLowerCase();
        for (const k of Object.keys(formExtraValues)) {
            if (String(k || '').trim().toLowerCase() === target) return formExtraValues[k];
        }
        return '';
    };

    // Contacto de emergencia
    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyRelationship, setEmergencyRelationship] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');

    const [accountFullName, setAccountFullName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountUsername, setAccountUsername] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [changePassword, setChangePassword] = useState(false);

    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Formato 24h -> 12h con AM/PM (ej: "14:30" -> "2:30 PM")
    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const parts = String(time24).split(':');
        if (parts.length < 2) return time24;
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        if (Number.isNaN(hours)) return time24;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    useEffect(() => {
        if (!open) return;
        // populate from initialData when dialog opens
        setCorporationId(initialData?.corporation?.id || '');
        setFirstName(initialData?.employeeDetail?.firstName || '');
        setLastName(initialData?.employeeDetail?.lastName || '');
        setPhoneNumber(initialData?.phoneNumber || '');
        setServiceAddress(initialData?.employeeDetail?.serviceAddress || '');
        setZoneOrSector(initialData?.employeeDetail?.zoneOrSector || '');
        setPrefillExtraFields(initialData?.employeeDetail?.extraFields || {});
        setRouteType(initialData?.employeeDetail?.routeType || 'Completa');
        setSelectedSchedule(initialData?.selectedSchedule ?? initialData?.employeeDetail?.selectedSchedule ?? -1);
        setFormExtraValues({});
        setEmergencyContact(initialData?.employeeDetail?.emergencyContact || '');
        setEmergencyRelationship(initialData?.employeeDetail?.emergencyRelationship || '');
        setEmergencyPhone(initialData?.employeeDetail?.emergencyPhone || '');
        setAccountFullName(initialData?.accountName || '');
        console.log("initialData: " ,initialData);
        
        setAccountUsername(initialData?.accountFullName || '');
        setAccountEmail( initialData?.email || '');

        // fetch corporation data to load schedules and extraFields
        if (initialData?.corporation?.id || initialData?.corporationId) {
            fetchCorporationData(initialData?.corporation?.id || initialData?.corporationId, initialData?.extraFields || initialData?.employeeDetail?.extraFields || {});
        } else {
            // if no corporation id, clear schedules and extras
            setSchedules([]);
            setExtraFields([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const fetchCorporationData = async (id, prefill = null) => {
        setLoading(true);
        try {
            const response = await api.get(`/corporations/${id}`);

            if (response.data && response.data.corporation) {
                const corp = response.data.corporation;
                if (Array.isArray(corp.schedules)) setSchedules(corp.schedules);
                else if (corp.schedules && typeof corp.schedules === 'string') {
                    try { setSchedules(JSON.parse(corp.schedules)); } catch { setSchedules([]); }
                }

                if (Array.isArray(corp.extraEnrollmentFields)) setExtraFields(corp.extraEnrollmentFields);
                else if (corp.extraEnrollmentFields && typeof corp.extraEnrollmentFields === 'string') {
                    try { setExtraFields(JSON.parse(corp.extraEnrollmentFields)); } catch { setExtraFields([]); }
                }

                // Map prefill into formExtraValues using canonical fieldName
                const prefillObj = prefill && Object.keys(prefill || {}).length > 0 ? prefill : prefillExtraFields;
                if (prefillObj) {
                    const mapped = {};
                    const defs = Array.isArray(corp.extraEnrollmentFields) ? corp.extraEnrollmentFields : (corp.extraEnrollmentFields && typeof corp.extraEnrollmentFields === 'string' ? (() => { try { return JSON.parse(corp.extraEnrollmentFields); } catch { return []; } })() : []);

                    const findKey = (obj, target) => {
                        if (!obj) return null;
                        const t = String(target || '').trim().toLowerCase();
                        for (const k of Object.keys(obj)) {
                            if (String(k || '').trim().toLowerCase() === t) return k;
                        }
                        return null;
                    };

                    if (Array.isArray(defs) && defs.length > 0) {
                        defs.forEach(def => {
                            const fname = def.fieldName || def.label || def.name || '';
                            const keyInPrefill = findKey(prefillObj, fname) || findKey(prefillObj, String(fname).toLowerCase());
                            if (keyInPrefill) {
                                mapped[fname] = prefillObj[keyInPrefill];
                            } else {
                                const lname = String(fname).toLowerCase();
                                if (lname.includes('depart') || lname.includes('zona') || lname.includes('sector')) {
                                    const syn = findKey(prefillObj, 'department') || findKey(prefillObj, 'zoneOrSector') || findKey(prefillObj, 'zona') || findKey(prefillObj, 'zone');
                                    if (syn) mapped[fname] = prefillObj[syn];
                                }
                            }
                        });
                    } else {
                        Object.keys(prefillObj).forEach(k => mapped[k] = prefillObj[k]);
                    }

                    if (Object.keys(mapped).length === 0) {
                        const depKey = findKey(prefillObj, 'department') || findKey(prefillObj, 'zoneOrSector') || findKey(prefillObj, 'zona');
                        if (depKey) mapped['Departamento'] = prefillObj[depKey];
                    }

                    setFormExtraValues(prev => ({ ...mapped, ...prev }));
                    setPrefillExtraFields(null);
                }
            }
        } catch (error) {
            console.error('Error al obtener info de la corporación:', error);
            setSnackbar({ open: true, message: 'No se pudieron obtener los datos de la corporación.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e && e.preventDefault && e.preventDefault();
        const payload = {
            corporationId,
            firstName: firstName || null,
            lastName: lastName || null,
            serviceAddress,
            zoneOrSector: zoneOrSector,
            routeType,
            phoneNumber,
            selectedSchedule,
            emergencyContact,
            emergencyRelationship,
            emergencyPhone,
            accountFullName,
            accountEmail,
            accountPassword,
            extraFields: formExtraValues
        };

        try {
            await api.put(`/update-employee-info/${corporationId}`, payload);

            setSnackbar({ open: true, message: '¡Registro actualizado correctamente!', severity: 'success' });
            onSaved && onSaved();
            // close dialog after brief delay
            setTimeout(() => onClose && onClose(), 1000);
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            const messageToShow = 'Ocurrió un error al enviar tu registro. Intenta de nuevo.';
            setSnackbar({ open: true, message: error?.response?.data?.message || messageToShow, severity: 'error' });
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onClose={() => onClose && onClose()} fullWidth maxWidth="md">
            <DialogTitle>Actualizar Datos de Empleado</DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
                ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>Información del Empleado</Typography>

                        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <TextField label="Nombres" fullWidth margin="normal" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                            <TextField label="Apellidos" fullWidth margin="normal" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </Box>

                        <TextField label="Teléfono" fullWidth margin="normal" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="50241234567" />

                        <TextField label="Dirección de Servicio" fullWidth margin="normal" value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} required placeholder="Ej: Calle Principal 123, Zona 10" />

                        <TextField label="Zona o Sector" fullWidth margin="normal" value={zoneOrSector} onChange={(e) => setZoneOrSector(e.target.value)} required placeholder="Ej: Zona 1, Sector A" />

                        <FormControl fullWidth margin="normal">
                            <InputLabel>Tipo de Ruta</InputLabel>
                            <Select value={routeType} onChange={(e) => setRouteType(e.target.value)} label="Tipo de Ruta" required>
                                <MenuItem value="Completa">Completa</MenuItem>
                                <MenuItem value="Media PM">Media PM</MenuItem>
                                <MenuItem value="Media AM">Media AM</MenuItem>
                            </Select>
                        </FormControl>

                        {schedules && schedules.length > 0 && (
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Horario</InputLabel>
                                <Select value={selectedSchedule} onChange={(e) => setSelectedSchedule(Number(e.target.value))} label="Horario">
                                    <MenuItem value={-1}>-- Seleccione --</MenuItem>
                                    {schedules.map((s, idx) => (
                                        <MenuItem key={idx} value={idx}>{(() => {
                                            const name = s.name || `Horario ${idx+1}`;
                                            const entry = s.entryTime || s.entry || s.startTime || s.entry_time || '';
                                            const exit = s.exitTime || s.exit || s.endTime || s.exit_time || '';
                                            const entryFmt = entry ? formatTime12Hour(entry) : '';
                                            const exitFmt = exit ? formatTime12Hour(exit) : '';
                                            const times = entryFmt || exitFmt ? ` (${entryFmt}${entryFmt && exitFmt ? ' - ' : ''}${exitFmt})` : '';
                                            return name + times;
                                        })()}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="h6" sx={{ mb: 1 }}>Contacto de Emergencia</Typography>
                        <TextField label="Contacto de Emergencia" fullWidth margin="normal" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} required />
                        <TextField label="Parentesco" fullWidth margin="normal" value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} required />
                        <TextField label="Celular" fullWidth margin="normal" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} required />

                        {extraFields.length > 0 && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="h6" sx={{ mb: 1 }}>Campos Adicionales</Typography>
                                {extraFields.map((field, idx) => (
                                    <Box key={idx} sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{field.fieldName}{field.required && ' *'}</Typography>
                                        {field.type === 'text' && (
                                            <TextField placeholder={field.fieldName} fullWidth required={field.required} value={getExtraValue(field.fieldName) || ''} onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })} />
                                        )}
                                        {field.type === 'number' && (
                                            <TextField type="number" placeholder={field.fieldName} fullWidth required={field.required} value={getExtraValue(field.fieldName) || ''} onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })} />
                                        )}
                                        {field.type === 'date' && (
                                            <TextField type="date" fullWidth required={field.required} InputLabelProps={{ shrink: true }} placeholder={field.fieldName} value={getExtraValue(field.fieldName) || ''} onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })} />
                                        )}
                                        {field.type === 'select' && (
                                            <FormControl fullWidth required={field.required}>
                                                <InputLabel>{field.fieldName}</InputLabel>
                                                <Select value={getExtraValue(field.fieldName) || ''} onChange={(e) => setFormExtraValues({ ...formExtraValues, [field.fieldName]: e.target.value })}>
                                                    <MenuItem value="">-- Seleccione --</MenuItem>
                                                    {(field.options || []).map((opt, i) => (<MenuItem key={i} value={opt}>{opt}</MenuItem>))}
                                                </Select>
                                            </FormControl>
                                        )}
                                    </Box>
                                ))}
                            </>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="h6" sx={{ mb: 1 }}>Datos de la Cuenta</Typography>
                        <TextField label="Nombre de usuario" fullWidth margin="normal" value={accountUsername} onChange={(e) => setAccountUsername(e.target.value)} required />
                        <TextField label="Correo electrónico (ingresa tu correo personal)" type="email" fullWidth margin="normal" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} required />

                        <FormControlLabel control={<Checkbox checked={changePassword} onChange={(e) => setChangePassword(e.target.checked)} />} label="¿Cambiar contraseña?" />
                        {changePassword && (<TextField label="Nueva contraseña" type="password" fullWidth margin="normal" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Nueva contraseña opcional" />)}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => onClose && onClose()}>Cerrar</Button>
                <Button variant="contained" onClick={handleSubmit} color="primary">Actualizar Datos</Button>
            </DialogActions>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
            </Snackbar>
        </Dialog>
    );
};

export default UpdateEmployeeInfoDialog;
