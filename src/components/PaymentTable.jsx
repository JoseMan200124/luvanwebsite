// src/components/PaymentTable.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    TableContainer,
    Paper,
    Box,
    Chip,
    TableSortLabel,
} from '@mui/material';
import { Payment as PaymentIcon, CheckCircle as CheckCircleIcon, Close as CloseIcon, NoteAlt as NoteAltIcon, Download as DownloadIcon, ManageAccounts as ManageAccountsIcon, CalendarMonth as CalendarMonthIcon } from '@mui/icons-material';
import moment from 'moment';

const paymentShape = PropTypes.shape({
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
});

const getPaymentViewModel = (payment = {}) => {
    const family = payment.User?.FamilyDetail || {};
    const lastPayment = payment.lastPaymentDate || payment.lastPaidDate || payment.lastPayment || null;
    const status = (payment.finalStatus || '').toUpperCase();
    const serviceStatus = payment.serviceStatus || family.serviceStatus || 'ACTIVE';

    return {
        lastName: family.familyLastName || '-',
        autoDebit: !!(payment.automaticDebit || family.automaticDebit || family.autoDebit),
        studentsCount: family.studentsCount || 0,
        routeType: family.routeType || '-',
        lastPaymentFormatted: lastPayment ? moment.parseZone(lastPayment).format('DD/MM/YY') : '—',
        discount: Number(family.specialFee || family.discount || 0).toFixed(2),
        requiresInvoice: !!family.requiresInvoice || !!payment.requiresInvoice || false,
        status,
        serviceStatus,
        isDeleted: status === 'ELIMINADO' || !!family.deleted,
    };
};

const PaymentStatusChip = ({ status }) => {
    if (status === 'CONFIRMADO' || status === 'ADELANTADO') {
        return <Chip label="Pagado" size="small" color="success" />;
    }
    if (status === 'MORA' || status === 'ATRASADO') {
        return <Chip label="Mora" size="small" color="error" />;
    }
    if (status === 'PENDIENTE') {
        return <Chip label="Pendiente" size="small" color="warning" />;
    }
    if (status === 'EN_PROCESO') {
        return <Chip label="En Proceso" size="small" color="warning" />;
    }
    if (status === 'ELIMINADO') {
        return <Chip label="Eliminado" size="small" sx={{ backgroundColor: '#000000', color: 'white' }} />;
    }
    return <Chip label={status || '-'} size="small" />;
};

PaymentStatusChip.propTypes = {
    status: PropTypes.string,
};

const ServiceStatusChip = ({ serviceStatus }) => {
    if (serviceStatus === 'ACTIVE') {
        return <Chip label="Activo" size="small" color="success" />;
    }
    if (serviceStatus === 'PAUSED') {
        return <Chip label="Pausado" size="small" color="warning" />;
    }
    if (serviceStatus === 'SUSPENDED') {
        return <Chip label="Suspendido" size="small" color="error" />;
    }
    if (serviceStatus === 'INACTIVE') {
        return <Chip label="Inactivo" size="small" sx={{ backgroundColor: '#9e9e9e', color: 'white' }} />;
    }
    if (serviceStatus === 'DELETED') {
        return <Chip label="Eliminado" size="small" sx={{ backgroundColor: '#000000', color: 'white' }} />;
    }
    return <Chip label="-" size="small" />;
};

ServiceStatusChip.propTypes = {
    serviceStatus: PropTypes.string,
};

const PaymentActions = React.memo(({ payment, isDeleted, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick }) => (
    <Box sx={{ display: 'inline-flex', gap: 0.5, justifyContent: 'center' }}>
        <IconButton
            title={isDeleted ? 'Acción no disponible (familia eliminada)' : 'Registrar Pago'}
            onClick={() => { if (!isDeleted && onRegisterClick) onRegisterClick(payment); }}
            disabled={isDeleted}
        >
            <PaymentIcon />
        </IconButton>
        <IconButton
            title={isDeleted ? 'Acción no disponible (familia eliminada)' : 'Notas'}
            onClick={() => { if (!isDeleted) { if (onNotesClick) onNotesClick(payment); else if (onReceiptClick) onReceiptClick(payment); } }}
            disabled={isDeleted}
        >
            <NoteAltIcon />
        </IconButton>
        <IconButton title="Descargar Reporte PDF" onClick={() => { if (onDownloadHistory) onDownloadHistory(payment); else onEmailClick?.(payment); }}>
            <DownloadIcon />
        </IconButton>
        <IconButton title="Gestionar Pagos" onClick={() => onManageClick?.(payment)}>
            <ManageAccountsIcon />
        </IconButton>
        <IconButton title="Gestionar Períodos" onClick={() => onManagePeriodsClick?.(payment)}>
            <CalendarMonthIcon />
        </IconButton>
    </Box>
));

PaymentActions.propTypes = {
    payment: paymentShape,
    isDeleted: PropTypes.bool,
    onRegisterClick: PropTypes.func,
    onReceiptClick: PropTypes.func,
    onEmailClick: PropTypes.func,
    onManageClick: PropTypes.func,
    onNotesClick: PropTypes.func,
    onDownloadHistory: PropTypes.func,
    onManagePeriodsClick: PropTypes.func,
};

const PaymentRow = React.memo(({ payment, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick }) => {
    const view = getPaymentViewModel(payment);

    return (
        <TableRow key={payment.id} hover>
            <TableCell align="center" sx={{ borderLeft: '3px solid #2196F3', borderRight: '3px solid #E0E0E0' }}>
                <ServiceStatusChip serviceStatus={view.serviceStatus} />
            </TableCell>
            <TableCell align="center" sx={{ borderLeft: '3px solid #E0E0E0', borderRight: '3px solid #4CAF50' }}>
                <PaymentStatusChip status={view.status} />
            </TableCell>
            <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <span>{view.lastName}</span>
                    {view.autoDebit && <Chip label="D/A" size="small" color="primary" sx={{ height: 22, fontSize: '0.75rem' }} />}
                </Box>
            </TableCell>
            <TableCell align="center">{view.studentsCount}</TableCell>
            <TableCell align="center">{view.routeType}</TableCell>
            <TableCell align="center">{view.lastPaymentFormatted}</TableCell>
            <TableCell align="center">Q {view.discount}</TableCell>
            <TableCell align="center">
                {view.requiresInvoice ? <CheckCircleIcon color="success" fontSize="small" /> : <CloseIcon color="error" fontSize="small" />}
            </TableCell>
            <TableCell align="center">
                <PaymentActions
                    payment={payment}
                    isDeleted={view.isDeleted}
                    onRegisterClick={onRegisterClick}
                    onReceiptClick={onReceiptClick}
                    onEmailClick={onEmailClick}
                    onDownloadHistory={onDownloadHistory}
                    onManageClick={onManageClick}
                    onNotesClick={onNotesClick}
                    onManagePeriodsClick={onManagePeriodsClick}
                />
            </TableCell>
        </TableRow>
    );
});

PaymentRow.propTypes = {
    payment: paymentShape,
    onRegisterClick: PropTypes.func,
    onReceiptClick: PropTypes.func,
    onEmailClick: PropTypes.func,
    onManageClick: PropTypes.func,
    onNotesClick: PropTypes.func,
    onDownloadHistory: PropTypes.func,
    onManagePeriodsClick: PropTypes.func,
};

const PaymentTable = ({ payments, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick, order, orderBy, onRequestSort }) => {
    const paymentRows = Array.isArray(payments) ? payments : [];

    return (
        <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 900 }}>
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
                    {paymentRows.map(payment => (
                        <PaymentRow
                            key={payment.id}
                            payment={payment}
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
