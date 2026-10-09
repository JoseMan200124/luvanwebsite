// src/components/scheduling/ScheduleSection.jsx
import {
    Alert, Box, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem,
    Radio, RadioGroup, Select, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
    FREQUENCIES, WEEKDAYS, buildSchedulePayload, describeSchedule, validateSchedule,
} from './scheduleModel';

const ScheduleSection = ({ value, onChange, allowSendNow = true, stepLabel = '5) ¿Cuándo enviar?' }) => {
    const set = (patch) => onChange({ ...value, ...patch });
    const validation = validateSchedule(value);
    const isScheduled = value.mode === 'scheduled';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary">{stepLabel}</Typography>

            {allowSendNow && (
                <RadioGroup row value={value.mode} onChange={(e) => set({ mode: e.target.value })}>
                    <FormControlLabel value="now" control={<Radio size="small" />} label="Enviar ahora" />
                    <FormControlLabel value="scheduled" control={<Radio size="small" />} label="Programar envío" />
                </RadioGroup>
            )}

            {isScheduled && (
                <>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <TextField
                            type="datetime-local"
                            size="small"
                            label="Primer envío (hora de Guatemala)"
                            InputLabelProps={{ shrink: true }}
                            value={value.startAt}
                            onChange={(e) => set({ startAt: e.target.value })}
                        />
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                            <InputLabel id="schedule-frequency-label">Repetir</InputLabel>
                            <Select
                                labelId="schedule-frequency-label"
                                label="Repetir"
                                value={value.frequency}
                                onChange={(e) => set({ frequency: e.target.value })}
                            >
                                {FREQUENCIES.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>

                    {value.frequency === 'weekly' && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                                Días de envío (toca un día para marcarlo o desmarcarlo)
                            </Typography>
                            <ToggleButtonGroup
                                size="small"
                                color="primary"
                                value={value.daysOfWeek}
                                onChange={(_, days) => set({ daysOfWeek: days || [] })}
                                sx={{ flexWrap: 'wrap' }}
                            >
                                {WEEKDAYS.map((d) => <ToggleButton key={d.value} value={d.value}>{d.label}</ToggleButton>)}
                            </ToggleButtonGroup>
                        </Box>
                    )}

                    {value.frequency === 'monthly' && (
                        <TextField
                            type="number"
                            size="small"
                            label="Día del mes"
                            inputProps={{ min: 1, max: 31 }}
                            value={value.dayOfMonth}
                            onChange={(e) => set({ dayOfMonth: e.target.value })}
                            helperText="Vacío = el mismo día del primer envío. Si el mes no tiene ese día, se envía el último día del mes."
                        />
                    )}

                    {value.frequency !== 'once' && (
                        <TextField
                            type="date"
                            size="small"
                            label="Repetir hasta (opcional)"
                            InputLabelProps={{ shrink: true }}
                            value={value.endDate}
                            onChange={(e) => set({ endDate: e.target.value })}
                            helperText="Sin fecha de fin se repite hasta que lo canceles en Envíos Programados."
                        />
                    )}

                    {validation.valid ? (
                        <Alert severity="info" sx={{ py: 0.5 }}>
                            {describeSchedule(buildSchedulePayload(value))}. Los destinatarios se calculan en cada envío,
                            con los datos de ese momento. Puedes verlo, editarlo o cancelarlo en "Envíos Programados".
                        </Alert>
                    ) : (
                        <FormHelperText error>{validation.message}</FormHelperText>
                    )}
                </>
            )}
        </Box>
    );
};

export default ScheduleSection;
