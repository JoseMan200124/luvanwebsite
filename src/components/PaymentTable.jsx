// src/components/PaymentTable.jsx
import React from 'react';
import { Table, TableHead, TableRow, TableCell, TableBody, IconButton, TableContainer, Paper, Box, Chip, TableSortLabel } from '@mui/material';
import { Payment as PaymentIcon, CheckCircle as CheckCircleIcon, Close as CloseIcon, NoteAlt as NoteAltIcon, Download as DownloadIcon, ManageAccounts as ManageAccountsIcon } from '@mui/icons-material';
import moment from 'moment';

const PaymentRow = React.memo(({ p, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory }) => {
    const family = p.User?.FamilyDetail || {};
    const lastName = family.familyLastName || '-';
    const autoDebit = !!(p.automaticDebit || family.automaticDebit || family.autoDebit);
    const studentsCount = (family.Students || []).length || 0;
    const routeType = family.routeType || '-';
    const lastPayment = p.lastPaymentDate || p.lastPaidDate || p.lastPayment || null;
    const lastPaymentFormatted = lastPayment ? moment.parseZone(lastPayment).format('DD/MM/YY') : '—';
    const discount = Number(family.specialFee || family.discount || 0).toFixed(2);
    const requiresInvoice = !!family.requiresInvoice || !!p.requiresInvoice || false;
    const status = (p.finalStatus || '').toUpperCase();
    
    // V2: Mapeo de colores para estados
    let statusColor = 'orange'; // PENDIENTE por defecto
    if (status === 'CONFIRMADO' || status === 'ADELANTADO') {
        statusColor = 'green'; // Al día
    } else if (status === 'MORA' || status === 'ATRASADO') {
        statusColor = 'red'; // Deudas/mora
    } else if (status === 'EN_PROCESO') {
        statusColor = '#ff9800'; // Amarillo/naranja (parcial)
    } else if (status === 'INACTIVO') {
        statusColor = '#9e9e9e'; // Gris
    }

    return (
        <TableRow key={p.id} hover>
            <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: statusColor }} aria-label={`estado-${status || 'unknown'}`} />
                </Box>
            </TableCell>
            <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <span>{lastName}</span>
                    {autoDebit && <Chip label="D/A" size="small" color="primary" sx={{ height: 22, fontSize: '0.75rem' }} />}
                </Box>
            </TableCell>
            <TableCell align="center">{studentsCount}</TableCell>
            <TableCell align="center">{routeType}</TableCell>
            <TableCell align="center">{lastPaymentFormatted}</TableCell>
            <TableCell align="center">Q {discount}</TableCell>
            <TableCell align="center">
                {requiresInvoice ? <CheckCircleIcon color="success" fontSize="small" /> : <CloseIcon color="error" fontSize="small" />}
            </TableCell>
            <TableCell align="center">
                <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                    <IconButton title="Registrar Pago" onClick={() => onRegisterClick && onRegisterClick(p)}><PaymentIcon /></IconButton>
                    <IconButton title="Notas" onClick={() => (onNotesClick ? onNotesClick(p) : (onReceiptClick && onReceiptClick(p)))}><NoteAltIcon /></IconButton>
                    <IconButton title="Descargar Reporte PDF" onClick={() => (onDownloadHistory ? onDownloadHistory(p) : (onEmailClick && onEmailClick(p)))}><DownloadIcon /></IconButton>
                    <IconButton title="Gestionar Pagos" onClick={() => onManageClick && onManageClick(p)}><ManageAccountsIcon /></IconButton>
                </Box>
            </TableCell>
        </TableRow>
    );
});

const PaymentTable = ({ payments, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, order, orderBy, onRequestSort }) => {
    // This component is now a controlled renderer: sorting is performed by the parent.
    // It receives `order` ('asc'|'desc'), `orderBy` (key), and `onRequestSort(property)` to toggle sorting.

    return (
        <TableContainer component={Paper}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell align="center">Estado</TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'familyLastName'}
                                direction={orderBy === 'familyLastName' ? order : 'asc'}
                                onClick={() => onRequestSort && onRequestSort('familyLastName')}
                            >
                                Apellidos Familia
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'students'}
                                direction={orderBy === 'students' ? order : 'asc'}
                                onClick={() => onRequestSort && onRequestSort('students')}
                            >
                                Cant. Estudiantes
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'routeType'}
                                direction={orderBy === 'routeType' ? order : 'asc'}
                                onClick={() => onRequestSort && onRequestSort('routeType')}
                            >
                                Tipo de Ruta
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'lastPayment'}
                                direction={orderBy === 'lastPayment' ? order : 'asc'}
                                onClick={() => onRequestSort && onRequestSort('lastPayment')}
                            >
                                Fecha último pago
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'discount'}
                                direction={orderBy === 'discount' ? order : 'asc'}
                                onClick={() => onRequestSort && onRequestSort('discount')}
                            >
                                Descuento
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'invoice'}
                                direction={orderBy === 'invoice' ? order : 'asc'}
                                onClick={() => onRequestSort && onRequestSort('invoice')}
                            >
                                Envío Factura
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">Acciones</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {(Array.isArray(payments) ? payments : []).map(p => (
                        <PaymentRow
                            key={p.id}
                            p={p}
                            onRegisterClick={onRegisterClick}
                            onReceiptClick={onReceiptClick}
                            onEmailClick={onEmailClick}
                            onDownloadHistory={onDownloadHistory}
                            onManageClick={onManageClick}
                            onNotesClick={onNotesClick}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default React.memo(PaymentTable);
