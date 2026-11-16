// src/components/ScheduledOriginChip.jsx
import { Chip, Tooltip } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';

/**
 * Indica el ORIGEN de una circular o notificación del historial: salió de un envío programado
 * (ya fue enviada). No significa que esté pendiente de enviarse.
 */
const ScheduledOriginChip = () => (
  <Tooltip title="Ya fue enviada: salió automáticamente de un envío programado">
    <Chip size="small" color="info" variant="outlined" icon={<ScheduleIcon />} label="Vía envío programado" sx={{ fontWeight: 700, flexShrink: 0 }} />
  </Tooltip>
);

export default ScheduledOriginChip;
