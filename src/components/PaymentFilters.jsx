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
    showDeleted = false, 
    onShowDeletedChange = () => {},
    serviceStatus = '',
    onServiceStatusChange = () => {}
}) => {
    return (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField size="small" variant="outlined" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Buscar apellido" InputProps={{ startAdornment: <Search /> }} />
            <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Estado de Pago</InputLabel>
                <Select label="Estado de Pago" value={status} onChange={(e) => onStatusChange(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="PAGADO">Pagado</MenuItem>
                    <MenuItem value="PENDIENTE">Pendiente</MenuItem>
                    <MenuItem value="MORA">Mora</MenuItem>
                    <MenuItem value="ELIMINADO">Eliminado</MenuItem>
                </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Estado del Servicio</InputLabel>
                <Select label="Estado del Servicio" value={serviceStatus} onChange={(e) => onServiceStatusChange(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="ACTIVE">Activo</MenuItem>
                    <MenuItem value="PAUSED">Pausado</MenuItem>
                    <MenuItem value="SUSPENDED">Suspendido</MenuItem>
                    <MenuItem value="INACTIVE">Inactivo</MenuItem>
                </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Débito Automático</InputLabel>
                <Select label="D/A" value={autoDebit} onChange={(e) => onAutoDebitChange && onAutoDebitChange(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="yes">Sí</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                </Select>
            </FormControl>
            <FormControlLabel
                control={<Switch size="small" checked={showDeleted} onChange={(e) => onShowDeletedChange(e.target.checked)} disabled={!!status} />}
                label="Mostrar eliminadas"
                disabled={!!status}
            />
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
    showDeleted: PropTypes.bool,
    onShowDeletedChange: PropTypes.func,
    serviceStatus: PropTypes.string,
    onServiceStatusChange: PropTypes.func,
};

export default React.memo(PaymentFilters);
