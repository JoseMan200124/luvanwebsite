// src/components/PaymentTable.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Table, TableHead, TableRow, TableCell, TableBody, IconButton, TableContainer, Paper, Box, Chip, TableSortLabel } from '@mui/material';
import { Payment as PaymentIcon, CheckCircle as CheckCircleIcon, Close as CloseIcon, NoteAlt as NoteAltIcon, Download as DownloadIcon, ManageAccounts as ManageAccountsIcon, CalendarMonth as CalendarMonthIcon } from '@mui/icons-material';
import moment from 'moment';

const PaymentRow = React.memo(({ p, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick }) => {
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
    const isDeleted = status === 'ELIMINADO' || !!family.deleted;
    
    const serviceStatus = p.serviceStatus || family.serviceStatus || 'ACTIVE';
    
    // Mapeo de chips para estado de pago
    const getPaymentStatusChip = () => {
        if (status === 'CONFIRMADO' || status === 'ADELANTADO') {
            return <Chip label="Pagado" size="small" color="success" />;
        } else if (status === 'MORA' || status === 'ATRASADO') {
            return <Chip label="Mora" size="small" color="error" />;
        } else if (status === 'PENDIENTE') {
            return <Chip label="Pendiente" size="small" color="warning" />;
        } else if (status === 'EN_PROCESO') {
            return <Chip label="En Proceso" size="small" color="warning" />;
        } else if (status === 'ELIMINADO') {
            return <Chip label="Eliminado" size="small" sx={{ backgroundColor: '#000000', color: 'white' }} />;
        }
        return <Chip label={status || '-'} size="small" />;
    };
    
    // Mapeo de chips para estado del servicio
    const getServiceStatusChip = () => {
        if (serviceStatus === 'ACTIVE') {
            return <Chip label="Activo" size="small" color="success" />;
        } else if (serviceStatus === 'PAUSED') {
            return <Chip label="Pausado" size="small" color="warning" />;
        } else if (serviceStatus === 'SUSPENDED') {
            return <Chip label="Suspendido" size="small" color="error" />;
        } else if (serviceStatus === 'INACTIVE') {
            return <Chip label="Inactivo" size="small" sx={{ backgroundColor: '#9e9e9e', color: 'white' }} />;
        } else if (serviceStatus === 'DELETED') {
            return <Chip label="Eliminado" size="small" sx={{ backgroundColor: '#000000', color: 'white' }} />;
        }
        return <Chip label="-" size="small" />;
    };

    return (
        <TableRow key={p.id} hover>
            <TableCell align="center" sx={{ borderLeft: '3px solid #2196F3', borderRight: '3px solid #E0E0E0' }}>
                {getServiceStatusChip()}
            </TableCell>
            <TableCell align="center" sx={{ borderLeft: '3px solid #E0E0E0', borderRight: '3px solid #4CAF50' }}>
                {getPaymentStatusChip()}
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
                    <IconButton
                        title={isDeleted ? 'Acción no disponible (familia eliminada)' : 'Registrar Pago'}
                        onClick={() => { if (!isDeleted && onRegisterClick) onRegisterClick(p); }}
                        disabled={isDeleted}
                    >
                        <PaymentIcon />
                    </IconButton>
                    <IconButton
                        title={isDeleted ? 'Acción no disponible (familia eliminada)' : 'Notas'}
                        onClick={() => { if (!isDeleted) { if (onNotesClick) onNotesClick(p); else if (onReceiptClick) onReceiptClick(p); } }}
                        disabled={isDeleted}
                    >
                        <NoteAltIcon />
                    </IconButton>
                    <IconButton title="Descargar Reporte PDF" onClick={() => (onDownloadHistory ? onDownloadHistory(p) : (onEmailClick && onEmailClick(p)))}><DownloadIcon /></IconButton>
                    <IconButton title="Gestionar Pagos" onClick={() => onManageClick && onManageClick(p)}><ManageAccountsIcon /></IconButton>
                    <IconButton title="Gestionar Períodos" onClick={() => onManagePeriodsClick && onManagePeriodsClick(p)}><CalendarMonthIcon /></IconButton>
                </Box>
            </TableCell>
        </TableRow>
    );
});

PaymentRow.propTypes = {
    p: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        User: PropTypes.shape({
            FamilyDetail: PropTypes.shape({
                familyLastName: PropTypes.string,
                Students: PropTypes.array,
                routeType: PropTypes.string,
                specialFee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                discount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                requiresInvoice: PropTypes.bool,
                automaticDebit: PropTypes.bool,
                autoDebit: PropTypes.bool,
                serviceStatus: PropTypes.string,
                deleted: PropTypes.bool,
            }),
        }),
        automaticDebit: PropTypes.bool,
        lastPaymentDate: PropTypes.string,
        lastPaidDate: PropTypes.string,
        lastPayment: PropTypes.string,
        requiresInvoice: PropTypes.bool,
        finalStatus: PropTypes.string,
        serviceStatus: PropTypes.string,
    }),
    onRegisterClick: PropTypes.func,
    onReceiptClick: PropTypes.func,
    onEmailClick: PropTypes.func,
    onManageClick: PropTypes.func,
    onNotesClick: PropTypes.func,
    onDownloadHistory: PropTypes.func,
    onManagePeriodsClick: PropTypes.func,
};

const PaymentTable = ({ payments, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick, order, orderBy, onRequestSort }) => {
    // This component is now a controlled renderer: sorting is performed by the parent.
    // It receives `order` ('asc'|'desc'), `orderBy` (key), and `onRequestSort(property)` to toggle sorting.

    return (
        <TableContainer component={Paper}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell align="center" sx={{ borderLeft: '3px solid #2196F3', borderRight: '3px solid #E0E0E0', fontWeight: 'bold' }}>
                            <TableSortLabel
                                active={orderBy === 'serviceStatus'}
                                direction={orderBy === 'serviceStatus' ? order : 'asc'}
                                onClick={() => onRequestSort?.('serviceStatus')}
                            >
                                Estado del Servicio
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center" sx={{ borderLeft: '3px solid #E0E0E0', borderRight: '3px solid #4CAF50', fontWeight: 'bold' }}>
                            <TableSortLabel
                                active={orderBy === 'status'}
                                direction={orderBy === 'status' ? order : 'asc'}
                                onClick={() => onRequestSort?.('status')}
                            >
                                Estado de Pago
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'familyLastName'}
                                direction={orderBy === 'familyLastName' ? order : 'asc'}
                                onClick={() => onRequestSort?.('familyLastName')}
                            >
                                Apellidos Familia
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'students'}
                                direction={orderBy === 'students' ? order : 'asc'}
                                onClick={() => onRequestSort?.('students')}
                            >
                                Cant. Estudiantes
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'routeType'}
                                direction={orderBy === 'routeType' ? order : 'asc'}
                                onClick={() => onRequestSort?.('routeType')}
                            >
                                Tipo de Ruta
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'lastPayment'}
                                direction={orderBy === 'lastPayment' ? order : 'asc'}
                                onClick={() => onRequestSort?.('lastPayment')}
                            >
                                Fecha último pago
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'discount'}
                                direction={orderBy === 'discount' ? order : 'asc'}
                                onClick={() => onRequestSort?.('discount')}
                            >
                                Descuento
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                            <TableSortLabel
                                active={orderBy === 'invoice'}
                                direction={orderBy === 'invoice' ? order : 'asc'}
                                onClick={() => onRequestSort?.('invoice')}
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
                            onManagePeriodsClick={onManagePeriodsClick}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

PaymentTable.propTypes = {
    payments: PropTypes.array,
    onRegisterClick: PropTypes.func,
    onReceiptClick: PropTypes.func,
    onEmailClick: PropTypes.func,
    onManageClick: PropTypes.func,
    onNotesClick: PropTypes.func,
    onDownloadHistory: PropTypes.func,
    onManagePeriodsClick: PropTypes.func,
    order: PropTypes.oneOf(['asc', 'desc']),
    orderBy: PropTypes.string,
    onRequestSort: PropTypes.func,
};

export default React.memo(PaymentTable);
