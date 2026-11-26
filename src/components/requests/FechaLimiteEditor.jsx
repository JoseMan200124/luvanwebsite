import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Box, Button, Typography } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import useNotify from '../../hooks/useNotify';
import { updateRequestDueDate } from '../../services/requestService';
import { formatDate } from '../../utils/dateFormat';
import { ESTADOS_ABIERTOS } from '../../utils/solicitudesFamilias';

/** Fecha límite del detalle de una solicitud: solo lectura o editable (staff con solicitudes-actualizar-estado). */
const FechaLimiteEditor = ({ request, editable, hoy, onSaved }) => {
    const notify = useNotify();
    const [valor, setValor] = useState(request.dueDate || null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => { setValor(request.dueDate || null); }, [request.id, request.dueDate]);

    // Mismo criterio que el backend (fechaLimiteEditable): solo en solicitudes abiertas.
    const puedeEditar = editable && ESTADOS_ABIERTOS.includes(request.status);
    if (!puedeEditar) {
        return <Typography variant="body1" sx={{ fontWeight: 600 }}>{request.dueDate ? formatDate(request.dueDate) : 'Sin fecha límite'}</Typography>;
    }

    const guardar = async () => {
        setGuardando(true);
        try {
            const res = await updateRequestDueDate(request.id, valor);
            notify.success(res.message || 'Fecha límite actualizada');
            onSaved(res.request);
        } catch (error) {
            notify.error(error?.response?.data?.message || 'No se pudo cambiar la fecha límite');
        } finally {
            setGuardando(false);
        }
    };

    return (
        // Apilado: la columna del detalle es angosta y, lado a lado con el botón, la fecha quedaba cortada.
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
            <LocalizationProvider dateAdapter={AdapterMoment}>
                <DatePicker
                    value={valor ? moment(valor, 'YYYY-MM-DD') : null}
                    onChange={(v) => setValor(v?.isValid() ? v.format('YYYY-MM-DD') : null)}
                    // Sin mínimo mientras no cambie: una fecha ya vencida no se marca como error.
                    minDate={valor === (request.dueDate || null) ? undefined : moment(hoy, 'YYYY-MM-DD')}
                    format="DD/MM/YYYY"
                    slotProps={{ textField: { size: 'small', fullWidth: true }, field: { clearable: true } }}
                    sx={{ width: '100%', maxWidth: 240 }}
                />
            </LocalizationProvider>
            <Button variant="outlined" size="small" onClick={guardar} disabled={guardando || valor === (request.dueDate || null)}>
                Guardar
            </Button>
        </Box>
    );
};

FechaLimiteEditor.propTypes = {
    request: PropTypes.shape({
        id: PropTypes.number.isRequired,
        status: PropTypes.string,
        dueDate: PropTypes.string,
    }).isRequired,
    editable: PropTypes.bool.isRequired,
    hoy: PropTypes.string.isRequired,
    onSaved: PropTypes.func.isRequired,
};

export default FechaLimiteEditor;
