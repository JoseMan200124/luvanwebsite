// src/components/PaymentFilters.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch } from '@mui/material';
import { Search } from '@mui/icons-material';

const PaymentFilters = ({ 
    search, 
    onSearchChange, 
    status, 
    onStatusChange, 
    autoDebit, 
    onAutoDebitChange, 
    showInactive = false,
    onShowInactiveChange = () => {},
    showDeleted = false, 
    onShowDeletedChange = () => {},
    serviceStatus = '',
    onServiceStatusChange = () => {}
}) => {
    return (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
            <TextField size="small" variant="outlined" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Buscar apellido" InputProps={{ startAdornment: <Search /> }} sx={{ width: { xs: '100%', sm: 200 }, flex: { sm: '0 0 200px' } }} />
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 }, width: { xs: '100%', sm: 'auto' } }}>
                <InputLabel>Estado de Pago</InputLabel>
                <Select label="Estado de Pago" value={status} onChange={(e) => onStatusChange(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="PAGADO">Pagado</MenuItem>
                    <MenuItem value="ADELANTADO">Adelantado</MenuItem>
                    <MenuItem value="PENDIENTE">Pendiente</MenuItem>
                    <MenuItem value="MORA">En Mora</MenuItem>
                    <MenuItem value="EN_PROCESO">En Proceso</MenuItem>
                </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 185 }, width: { xs: '100%', sm: 'auto' } }}>
                <InputLabel>Estado del Servicio</InputLabel>
                <Select label="Estado del Servicio" value={serviceStatus} onChange={(e) => onServiceStatusChange(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="ACTIVE">Activo</MenuItem>
                    <MenuItem value="PAUSED">Pausado</MenuItem>
                    <MenuItem value="SUSPENDED">Suspendido</MenuItem>
                    <MenuItem value="INACTIVE">Inactivo</MenuItem>
                    <MenuItem value="ELIMINADO">Eliminado</MenuItem>
                </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 185 }, width: { xs: '100%', sm: 'auto' } }}>
                <InputLabel>Débito Automático</InputLabel>
                <Select label="D/A" value={autoDebit} onChange={(e) => onAutoDebitChange && onAutoDebitChange(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="yes">Sí</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' }, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
                <FormControlLabel
                    control={<Switch size="small" checked={showInactive} onChange={(e) => onShowInactiveChange(e.target.checked)} disabled={serviceStatus === 'INACTIVE'} />}
                    label="Mostrar inactivas"
                    disabled={serviceStatus === 'INACTIVE'}
                    sx={{ m: 0, whiteSpace: 'nowrap', '& .MuiFormControlLabel-label': { fontSize: { xs: '0.95rem', sm: '0.82rem' } } }}
                />
                <FormControlLabel
                    control={<Switch size="small" checked={showDeleted} onChange={(e) => onShowDeletedChange(e.target.checked)} disabled={!!status} />}
                    label="Mostrar eliminadas"
                    disabled={!!status}
                    sx={{ m: 0, whiteSpace: 'nowrap', '& .MuiFormControlLabel-label': { fontSize: { xs: '0.95rem', sm: '0.82rem' } } }}
                />
            </Box>
        </Box>
    );
};

PaymentFilters.propTypes = {
    search: PropTypes.string.isRequired,
    onSearchChange: PropTypes.func.isRequired,
    status: PropTypes.string.isRequired,
    onStatusChange: PropTypes.func.isRequired,
    autoDebit: PropTypes.string.isRequired,
    onAutoDebitChange: PropTypes.func,
    showInactive: PropTypes.bool,
    onShowInactiveChange: PropTypes.func,
    showDeleted: PropTypes.bool,
    onShowDeletedChange: PropTypes.func,
    serviceStatus: PropTypes.string,
    onServiceStatusChange: PropTypes.func,
};

export default React.memo(PaymentFilters);
