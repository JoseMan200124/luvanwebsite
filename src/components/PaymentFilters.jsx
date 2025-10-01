// src/components/PaymentFilters.jsx
import React from 'react';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Search } from '@mui/icons-material';

const PaymentFilters = ({ search, onSearchChange, status, onStatusChange, autoDebit, onAutoDebitChange }) => {
    return (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField size="small" variant="outlined" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Buscar apellido" InputProps={{ startAdornment: <Search /> }} />
            <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Estado</InputLabel>
                <Select label="Estado" value={status} onChange={(e) => onStatusChange(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="PAGADO">Pagado</MenuItem>
                    <MenuItem value="PENDIENTE">Pago Pendiente</MenuItem>
                    <MenuItem value="MORA">Mora</MenuItem>
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
        </Box>
    );
};

export default React.memo(PaymentFilters);
