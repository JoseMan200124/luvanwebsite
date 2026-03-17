// src/components/modals/EditSchedulesModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Paper,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  Grid,
  Chip,
  Typography
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { updateSchoolSchedules, validateSchedules, formatScheduleChange } from '../../services/scheduleService';

const EditSchedulesModal = ({ open, onClose, school, onSuccess }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const DAY_OPTIONS = [
    { key: 'monday', label: 'Lun' },
    { key: 'tuesday', label: 'Mar' },
    { key: 'wednesday', label: 'Mié' },
    { key: 'thursday', label: 'Jue' },
    { key: 'friday', label: 'Vie' }
  ];

  const ALL_DAY_KEYS = DAY_OPTIONS.map(d => d.key);

  useEffect(() => {
    if (open) {
      const scheduleArray = Array.isArray(school?.schedules)
        ? school.schedules.map(s => ({
          code: s?.code || '',
          name: s?.name || '',
          times: Array.isArray(s?.times) ? s.times : ['N/A'],
          days: Array.isArray(s?.days) ? s.days : []
        }))
        : [];
      setSchedules(scheduleArray);
      setError(null);
      setSuccess(null);
    }
  }, [open, school]);

  const isAllDaysSelected = (days) => {
    if (!Array.isArray(days) || days.length === 0) return true;
    return ALL_DAY_KEYS.every(day => days.includes(day));
  };

  const handleAddSchedule = () => {
    setSchedules(prev => ([
      ...prev,
      {
        code: '',
        name: '',
        times: ['N/A'],
        days: []
      }
    ]));
  };

  const handleRemoveSchedule = (index) => {
    setSchedules(prev => prev.filter((_, i) => i !== index));
  };

  const handleScheduleCodeChange = (index, value) => {
    const upper = (value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    setSchedules(prev => {
      const clone = [...prev];
      clone[index] = {
        ...clone[index],
        code: upper,
        name: clone[index].name || (upper ? `HORARIO ${upper}` : '')
      };
      return clone;
    });
  };

  const handleScheduleNameChange = (index, value) => {
    setSchedules(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], name: value };
      return clone;
    });
  };

  const handleTimeChange = (index, value) => {
    setSchedules(prev => {
      const clone = [...prev];
      clone[index] = {
        ...clone[index],
        times: [value ? value : 'N/A']
      };
      return clone;
    });
  };

  const handleToggleDay = (scheduleIndex, dayKey) => {
    setSchedules(prev => {
      const clone = [...prev];
      const rawCurrent = Array.isArray(clone[scheduleIndex].days) ? [...clone[scheduleIndex].days] : [];
      const current = isAllDaysSelected(rawCurrent) ? [...ALL_DAY_KEYS] : rawCurrent;

      if (current.includes(dayKey)) {
        const next = current.filter(d => d !== dayKey);
        clone[scheduleIndex] = {
          ...clone[scheduleIndex],
          days: next.length === ALL_DAY_KEYS.length ? [] : next
        };
      } else {
        const next = [...current, dayKey];
        clone[scheduleIndex] = {
          ...clone[scheduleIndex],
          days: next.length === ALL_DAY_KEYS.length ? [] : next
        };
      }

      return clone;
    });
  };

  const handleSelectAllDays = (scheduleIndex) => {
    setSchedules(prev => {
      const clone = [...prev];
      clone[scheduleIndex] = {
        ...clone[scheduleIndex],
        days: []
      };
      return clone;
    });
  };

  const buildPayloadSchedules = () => {
    return schedules
      .filter(s => s && s.code)
      .map(s => {
        const entry = {
          code: s.code.toUpperCase(),
          name: s.name || `HORARIO ${s.code.toUpperCase()}`,
          times: Array.isArray(s.times) && s.times[0] && s.times[0] !== 'N/A' ? [s.times[0]] : ['N/A']
        };

        if (Array.isArray(s.days) && s.days.length > 0) {
          entry.days = s.days;
        }

        return entry;
      });
  };

  const validateLocalSchedules = () => {
    const schedulesWithCode = schedules.filter(s => s && s.code);
    const invalidCode = schedulesWithCode.find(s => !/^[A-Z]{2,4}$/.test(s.code));
    if (invalidCode) {
      return `Codigo de horario invalido: "${invalidCode.code}". Use 2 a 4 letras mayusculas (ej: AM, VE).`;
    }

    const codeCounts = {};
    schedulesWithCode.forEach(s => {
      codeCounts[s.code] = (codeCounts[s.code] || 0) + 1;
    });
    const dupCode = Object.keys(codeCounts).find(code => codeCounts[code] > 1);
    if (dupCode) {
      return `Codigo de horario duplicado: "${dupCode}".`;
    }

    return null;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const localError = validateLocalSchedules();
      if (localError) {
        setError(localError);
        setLoading(false);
        return;
      }

      const payloadSchedules = buildPayloadSchedules();

      const validation = validateSchedules(payloadSchedules);
      if (!validation.valid) {
        setError(validation.errors.join('; '));
        setLoading(false);
        return;
      }

      const result = await updateSchoolSchedules(school.id, payloadSchedules);

      if (result.scheduleChanges?.changes?.length > 0) {
        const changes = result.scheduleChanges.changes
          .map(change => formatScheduleChange(change))
          .join('\n');
        setSuccess(`Horarios actualizados. Cambios propagados:\n${changes}`);
      } else {
        setSuccess('Horarios actualizados exitosamente (sin cambios detectados)');
      }

      if (onSuccess) {
        onSuccess(result);
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Error al actualizar horarios');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Editar Horarios de {school?.name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{success}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {schedules.map((sch, scheduleIndex) => {
            const codeError = sch.code && (sch.code.length < 2 || !/^[A-Z]{2,4}$/.test(sch.code));
            const codeDuplicate = sch.code && schedules.filter((s, i) => i !== scheduleIndex && s.code === sch.code).length > 0;

            return (
              <Paper key={scheduleIndex} sx={{ p: 2, border: (codeError || codeDuplicate) ? '1px solid #f44336' : '1px solid #e0e0e0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {sch.code ? `Horario ${sch.code}` : `Horario #${scheduleIndex + 1}`}
                  </Typography>
                  <Tooltip title="Eliminar horario">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveSchedule(scheduleIndex)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Código"
                      variant="outlined"
                      size="small"
                      value={sch.code || ''}
                      onChange={(e) => handleScheduleCodeChange(scheduleIndex, e.target.value)}
                      placeholder="AM"
                      inputProps={{ maxLength: 4, style: { textTransform: 'uppercase' } }}
                      error={!!(codeError || codeDuplicate)}
                      helperText={
                        codeDuplicate ? 'Código duplicado' :
                        codeError ? '2-4 letras (ej: AM, VE)' : ''
                      }
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={12} sm={5}>
                    <TextField
                      label="Nombre"
                      variant="outlined"
                      size="small"
                      value={sch.name || ''}
                      onChange={(e) => handleScheduleNameChange(scheduleIndex, e.target.value)}
                      placeholder="HORARIO AM"
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Hora base (HH:mm)"
                      variant="outlined"
                      size="small"
                      type="time"
                      value={Array.isArray(sch.times) ? (sch.times[0] === 'N/A' ? '' : sch.times[0]) : ''}
                      onChange={(e) => handleTimeChange(scheduleIndex, e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Días aplicables
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      key="all-days"
                      label="Todos"
                      size="small"
                      variant={isAllDaysSelected(sch.days) ? 'filled' : 'outlined'}
                      color={isAllDaysSelected(sch.days) ? 'primary' : 'default'}
                      onClick={() => handleSelectAllDays(scheduleIndex)}
                      sx={{ cursor: 'pointer' }}
                    />
                    {DAY_OPTIONS.map(({ key, label }) => {
                      const allSelected = isAllDaysSelected(sch.days);
                      const active = allSelected || (Array.isArray(sch.days) && sch.days.includes(key));
                      return (
                        <Chip
                          key={key}
                          label={label}
                          size="small"
                          variant={active ? 'filled' : 'outlined'}
                          color={active ? 'primary' : 'default'}
                          onClick={() => handleToggleDay(scheduleIndex, key)}
                          sx={{ cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              </Paper>
            );
          })}

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddSchedule}
            sx={{ alignSelf: 'flex-start' }}
          >
            Agregar Horario
          </Button>

          {schedules.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No hay horarios definidos. Haz clic en "Agregar Horario" para crear uno.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || schedules.length === 0}
        >
          {loading ? <CircularProgress size={24} /> : 'Guardar Cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditSchedulesModal;
