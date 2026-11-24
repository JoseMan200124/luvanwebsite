// src/components/ScheduleThresholdsDialog.jsx
import React, { useEffect, useState, useMemo } from 'react';
import {
    Typography,
    Box,
    TextField,
    Chip,
    Tabs,
    Tab
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Schedule } from '@mui/icons-material';
import { getScheduleColor, getScheduleLabel } from '../utils/scheduleConfig';
import { formatClock } from '../utils/dateFormat';
import AppDialog from './dialogs/AppDialog';

// Extraído para que cambiar de pestaña solo re-renderice este diálogo, no la tabla de rutas completa.
// roleTabsEnabled=false oculta el selector Auxiliar/Supervisor y fija el contenido en Supervisor —
// lo usa CorporateBusesPage porque las rutas de corporación no tienen monitora (RouteAssignment.
// monitoraId solo se setea para rutas de colegio), así que los campos Auxiliar no aplican.
export default function ScheduleThresholdsDialog({
    open,
    routeNumber,
    scheduleCodes,
    scheduleNames,
    scheduleTimes,
    thresholds,
    onThresholdChange,
    onClose,
    onSave,
    saving,
    roleTabsEnabled = true
}) {
    const [activeTab, setActiveTab] = useState(0);
    // 0 = Auxiliar (campos de la monitora), 1 = Supervisor (piloto). Ignorado si roleTabsEnabled es false.
    const [activeRoleTab, setActiveRoleTab] = useState(0);
    const theme = useTheme();

    useEffect(() => {
        if (open) {
            setActiveTab(0);
            setActiveRoleTab(0);
        }
    }, [open, routeNumber]);

    const effectiveRoleTab = roleTabsEnabled ? activeRoleTab : 1;

    const sortedCodes = useMemo(() => {
        const timeToMinutes = (hhmm) => {
            if (!hhmm) {
                return Infinity;
            }
            const [h, m] = hhmm.split(':').map(Number);
            return h * 60 + m;
        };
        return [...scheduleCodes].sort((a, b) => timeToMinutes(scheduleTimes[a]) - timeToMinutes(scheduleTimes[b]));
    }, [scheduleCodes, scheduleTimes]);

    const tabColors = useMemo(() => {
        const map = {};
        sortedCodes.forEach((code) => {
            const colorKey = getScheduleColor(code);
            map[code] = theme.palette[colorKey]?.main || theme.palette.text.primary;
        });
        return map;
    }, [sortedCodes, theme]);

    const activeTabColor = tabColors[sortedCodes[activeTab]] || theme.palette.text.primary;

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            title={`Horarios de la ruta ${routeNumber}`}
            icon={<Schedule />}
            size="sm"
            onSubmit={onSave}
            submitLabel="Guardar horarios"
            submitting={saving}
            readOnly={!(onSave)}
        >
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                {effectiveRoleTab === 0
                    ? 'Configura estas horas para que el sistema avise automáticamente a los Auxiliares cuando la ruta se atrasa. Deja un campo vacío si no aplica.'
                    : 'Configura estas horas para que el sistema avise automáticamente a los Supervisores cuando los recorridos se retrasan. Deja un campo vacío si no aplica.'}
            </Typography>
            {roleTabsEnabled && (
                <Tabs
                    value={activeRoleTab}
                    onChange={(e, newValue) => setActiveRoleTab(newValue)}
                    sx={{ mb: 2, minHeight: 36 }}
                    TabIndicatorProps={{ sx: { transition: 'none' } }}
                >
                    <Tab label="Auxiliar" disableRipple sx={{ minHeight: 36, py: 1 }} />
                    <Tab label="Supervisor" disableRipple sx={{ minHeight: 36, py: 1 }} />
                </Tabs>
            )}
            {sortedCodes.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
                    No hay turnos configurados todavía. Configuralos primero para poder definir horarios de esta ruta.
                </Typography>
            ) : (
                <>
                    <Tabs
                        value={activeTab}
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        variant="scrollable"
                        scrollButtons="auto"
                        TabIndicatorProps={{
                            sx: {
                                transition: 'none',
                                backgroundColor: activeTabColor
                            }
                        }}
                        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                    >
                        {sortedCodes.map((code) => (
                            <Tab
                                key={code}
                                label={code}
                                disableRipple
                                sx={{
                                    transition: 'none',
                                    '&.Mui-selected': {
                                        color: tabColors[code]
                                    }
                                }}
                            />
                        ))}
                    </Tabs>
                    {sortedCodes.map((code, index) => {
                if (index !== activeTab) {
                    return null;
                }
                const entry = thresholds[code] || {};
                const isAM = code === 'AM';
                return (
                    <Box key={code}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <Typography variant="subtitle1">{scheduleNames[code] || getScheduleLabel(code)}</Typography>
                            {scheduleTimes[code] && (
                                <Chip
                                    label={`Hora colegio: ${formatClock(scheduleTimes[code])}`}
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                        </Box>
                        {effectiveRoleTab === 1 ? (
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <TextField
                                    type="time"
                                    size="small"
                                    sx={{ flex: '1 1 45%' }}
                                    label="Hora máxima para iniciar el recorrido"
                                    helperText="Avisa al supervisor si a esta hora el piloto aún no ha iniciado este recorrido."
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ step: 300 }}
                                    value={entry.routeStartMaxTime || ''}
                                    onChange={(e) => onThresholdChange(code, 'routeStartMaxTime', e.target.value)}
                                />
                                <TextField
                                    type="number"
                                    size="small"
                                    sx={{ flex: '1 1 45%' }}
                                    label="Margen para finalizar (min)"
                                    helperText="Minutos desde que el piloto inicia el recorrido; si se pasa sin finalizar, avisa al supervisor."
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ min: 0 }}
                                    value={entry.routeEndMarginMinutes || ''}
                                    onChange={(e) => onThresholdChange(code, 'routeEndMarginMinutes', e.target.value)}
                                />
                            </Box>
                        ) : isAM ? (
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <TextField
                                    type="time"
                                    size="small"
                                    sx={{ flex: '1 1 45%' }}
                                    label="Hora máxima para abordar la unidad"
                                    helperText="Avisa si a esta hora la monitora aún no marca que abordó."
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ step: 300 }}
                                    value={entry.boardingTime || ''}
                                    onChange={(e) => onThresholdChange(code, 'boardingTime', e.target.value)}
                                />
                                <TextField
                                    type="time"
                                    size="small"
                                    sx={{ flex: '1 1 45%' }}
                                    label="Hora de inicio (primera parada)"
                                    helperText="Avisa si a esta hora aún no marcan la primera parada."
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ step: 300 }}
                                    value={entry.firstStopTime || ''}
                                    onChange={(e) => onThresholdChange(code, 'firstStopTime', e.target.value)}
                                />
                                <TextField
                                    type="time"
                                    size="small"
                                    sx={{ flex: '1 1 45%' }}
                                    label="Hora de llegada al colegio"
                                    helperText="Avisa si a esta hora aún no marcan la llegada."
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ step: 300 }}
                                    value={entry.schoolArrivalTime || ''}
                                    onChange={(e) => onThresholdChange(code, 'schoolArrivalTime', e.target.value)}
                                />
                            </Box>
                        ) : (
                            <Box>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                    <TextField
                                        type="time"
                                        size="small"
                                        fullWidth
                                        label="Hora máxima de salida del colegio"
                                        helperText="Avisa si a esta hora aún no marcan la salida."
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ step: 300 }}
                                        value={entry.schoolDepartureMaxTime || ''}
                                        onChange={(e) => onThresholdChange(code, 'schoolDepartureMaxTime', e.target.value)}
                                    />
                                    <TextField
                                        type="number"
                                        size="small"
                                        fullWidth
                                        label="Margen primera parada (min)"
                                        helperText="No es hora fija: minutos de espera después de la salida real."
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: 0 }}
                                        value={entry.firstStopMarginMinutes || ''}
                                        onChange={(e) => onThresholdChange(code, 'firstStopMarginMinutes', e.target.value)}
                                    />
                                </Box>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2.5 }}>
                                    Ejemplo: si el margen es 60 min y el bus marca salida a las 12:00pm, la alerta se dispara si no marcan la primera parada del regreso antes de la 1:00pm.
                                </Typography>
                            </Box>
                        )}
                    </Box>
                );
            })}
                </>
            )}
        </AppDialog>
    );
}
