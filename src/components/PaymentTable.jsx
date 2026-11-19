// src/components/PaymentTable.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {
    Paper,
    Table,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    Box,
    Chip,
} from '@mui/material';
import { Payment as PaymentIcon, CheckCircle as CheckCircleIcon, Close as CloseIcon, NoteAlt as NoteAltIcon, Download as DownloadIcon, ManageAccounts as ManageAccountsIcon, CalendarMonth as CalendarMonthIcon } from '@mui/icons-material';
import SortableTableHead from './table/SortableTableHead';
import AppTableContainer from './table/AppTableContainer';
import { formatDateShort } from '../utils/dateFormat';
import { formatQ } from '../utils/currency';
import { PAYMENT_STATUS, SERVICE_STATUS, ENROLLMENT_PAYMENT_STATUS } from '../constants/statuses';
import StatusChip from './StatusChip';

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
    penaltyGlobalFrozen: PropTypes.bool,
    frozenPenaltyPeriodsCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
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
        lastPaymentFormatted: formatDateShort(lastPayment, { keepZone: true }),
        // If family discount is configured as percent, show a percent string (e.g. "50%"),
        // otherwise show fixed amount with currency formatting.
        discount: (() => {
            const isPercent = !!(family.discountIsPercent || payment.discountIsPercent);
            const pctRaw = family.specialFeePercentage ?? payment.appliedFamilyDiscountPercent ?? null;
            if (isPercent && pctRaw !== null && typeof pctRaw !== 'undefined' && !Number.isNaN(Number(pctRaw))) {
                const pct = Number(pctRaw) * 100;
                // Round to maximum 2 decimal places to avoid long floats
                const rounded = Math.round(pct * 100) / 100;
                if (Number.isInteger(rounded)) {
                    return `${rounded}%`;
                }
                return `${rounded}%`;
            }
            return formatQ(family.specialFee || family.discount || 0);
        })(),
        requiresInvoice: !!family.requiresInvoice || !!payment.requiresInvoice || false,
        status,
        serviceStatus,
        isDeleted: status === 'ELIMINADO' || !!family.deleted,
        penaltyGlobalFrozen: !!payment.penaltyGlobalFrozen,
        frozenPenaltyPeriodsCount: Number(payment.frozenPenaltyPeriodsCount || 0),
    };
};

const PaymentStatusChip = ({ status }) => (
    <StatusChip domain={PAYMENT_STATUS} value={status} />
);

PaymentStatusChip.propTypes = {
    status: PropTypes.string,
};

export const ServiceStatusChip = ({ serviceStatus, isDeleted }) => {
    if (isDeleted) {
        return <Chip label="Eliminado" size="small" sx={{ backgroundColor: '#000000', color: 'white' }} />;
    }
    return <StatusChip domain={SERVICE_STATUS} value={serviceStatus} />;
};

ServiceStatusChip.propTypes = {
    serviceStatus: PropTypes.string,
    isDeleted: PropTypes.bool,
};

// Cada botón se dibuja solo si recibe su callback: la página decide qué acciones ofrece según los permisos del usuario.
const PaymentActions = React.memo(({ payment, isDeleted, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick }) => {
    const onNotas = onNotesClick || onReceiptClick;
    const onDescarga = onDownloadHistory || onEmailClick;
    return (
        <Box sx={{ display: 'inline-flex', gap: 0.5, justifyContent: 'center' }}>
            {onRegisterClick && (
                <IconButton
                    title={isDeleted ? 'Acción no disponible (familia eliminada)' : 'Registrar Pago'}
                    onClick={() => { if (!isDeleted) {
                        onRegisterClick(payment);
                    } }}
                    disabled={isDeleted}
                >
                    <PaymentIcon />
                </IconButton>
            )}
            {onNotas && (
                <IconButton
                    title={isDeleted ? 'Acción no disponible (familia eliminada)' : 'Notas'}
                    onClick={() => { if (!isDeleted) {
                        onNotas(payment);
                    } }}
                    disabled={isDeleted}
                >
                    <NoteAltIcon />
                </IconButton>
            )}
            {onDescarga && (
                <IconButton title="Descargar Reporte PDF" onClick={() => onDescarga(payment)}>
                    <DownloadIcon />
                </IconButton>
            )}
            {onManageClick && (
                <IconButton title="Gestionar Pagos" onClick={() => onManageClick(payment)}>
                    <ManageAccountsIcon />
                </IconButton>
            )}
            {onManagePeriodsClick && (
                <IconButton title="Gestionar Períodos" onClick={() => onManagePeriodsClick(payment)}>
                    <CalendarMonthIcon />
                </IconButton>
            )}
        </Box>
    );
});

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

const EnrollmentCell = ({ charge }) => {
    const chip = charge && ['PENDIENTE', 'PARCIAL', 'PAGADO'].includes(charge.status);
    if (!chip) {
        return <span>—</span>;
    }
    const pending = charge.status === 'PAGADO' ? '' : `Saldo: ${formatQ(charge.amountDue || 0)}`;
    return <StatusChip domain={ENROLLMENT_PAYMENT_STATUS} value={charge.status} title={pending} />;
};

EnrollmentCell.propTypes = {
    charge: PropTypes.shape({ status: PropTypes.string, amountDue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) }),
};

// Fila de la "vista de inscripción": solo lo relacionado con el cargo de inscripción del ciclo
const EnrollmentRow = React.memo(({ payment, charge, onRegisterClick }) => {
    const view = getPaymentViewModel(payment);
    return (
        <TableRow hover>
            <TableCell align="center" sx={{ borderLeft: '3px solid #2196F3', borderRight: '3px solid #E0E0E0' }}>
                <ServiceStatusChip serviceStatus={view.serviceStatus} isDeleted={view.isDeleted} />
            </TableCell>
            <TableCell align="center" sx={{ borderLeft: '3px solid #E0E0E0', borderRight: '3px solid #4CAF50' }}>
                <EnrollmentCell charge={charge} />
            </TableCell>
            <TableCell align="center">{view.lastName}</TableCell>
            <TableCell align="center">{view.studentsCount}</TableCell>
            <TableCell align="center">{charge ? formatQ(charge.netAmount || 0) : '—'}</TableCell>
            <TableCell align="center">{charge ? formatQ(charge.amountPaid || 0) : '—'}</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700 }}>{charge ? formatQ(charge.amountDue || 0) : '—'}</TableCell>
            <TableCell align="center">
                {onRegisterClick && charge && (
                    <IconButton
                        title={view.isDeleted ? 'Acción no disponible (familia eliminada)' : 'Registrar pago de inscripción'}
                        onClick={() => { if (!view.isDeleted) {
                            onRegisterClick(payment);
                        } }}
                        disabled={view.isDeleted}
                    >
                        <PaymentIcon />
                    </IconButton>
                )}
            </TableCell>
        </TableRow>
    );
});

EnrollmentRow.propTypes = {
    payment: paymentShape,
    charge: PropTypes.object,
    onRegisterClick: PropTypes.func,
};

const PaymentRow = React.memo(({ payment, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick }) => {
    const view = getPaymentViewModel(payment);

    return (
        <TableRow key={payment.id} hover>
            <TableCell align="center" sx={{ borderLeft: '3px solid #2196F3', borderRight: '3px solid #E0E0E0' }}>
                <ServiceStatusChip serviceStatus={view.serviceStatus} isDeleted={view.isDeleted} />
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
            <TableCell align="center">{view.discount}</TableCell>
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


const SERVICE_STATUS_SX = { borderLeft: '3px solid #2196F3', borderRight: '3px solid #E0E0E0', fontWeight: 'bold' };
const PAYMENT_STATUS_SX = { borderLeft: '3px solid #E0E0E0', borderRight: '3px solid #4CAF50', fontWeight: 'bold' };

const ENROLLMENT_COLUMNS = [
    { id: 'serviceStatus', label: 'Estado del Servicio', sortable: true, align: 'center', sx: SERVICE_STATUS_SX },
    { id: 'enrollmentStatus', label: 'Pago de Inscripción', sortable: true, align: 'center', sx: PAYMENT_STATUS_SX },
    { id: 'familyLastName', label: 'Apellidos Familia', sortable: true, align: 'center' },
    { id: 'students', label: 'Cant. Estudiantes', sortable: true, align: 'center' },
    { id: 'amount', label: 'Monto a pagar', align: 'center' },
    { id: 'paid', label: 'Pagado', align: 'center' },
    { id: 'enrollmentDue', label: 'Saldo pendiente', sortable: true, align: 'center' },
    { id: 'actions', label: 'Acciones', align: 'center' },
];

const PAYMENT_COLUMNS = [
    { id: 'serviceStatus', label: 'Estado del Servicio', sortable: true, align: 'center', sx: SERVICE_STATUS_SX },
    { id: 'status', label: 'Estado de Pago', sortable: true, align: 'center', sx: PAYMENT_STATUS_SX },
    { id: 'familyLastName', label: 'Apellidos Familia', sortable: true, align: 'center' },
    { id: 'students', label: 'Cant. Estudiantes', sortable: true, align: 'center' },
    { id: 'routeType', label: 'Tipo de Ruta', sortable: true, align: 'center' },
    { id: 'lastPayment', label: 'Fecha último pago', sortable: true, align: 'center' },
    { id: 'discount', label: 'Descuento', sortable: true, align: 'center' },
    { id: 'invoice', label: 'Envío Factura', sortable: true, align: 'center' },
    { id: 'actions', label: 'Acciones', align: 'center' },
];

const PaymentTable = ({ payments, enrollmentView, enrollmentByUser, onRegisterClick, onReceiptClick, onEmailClick, onManageClick, onNotesClick, onDownloadHistory, onManagePeriodsClick, order, orderBy, onRequestSort }) => {
    const paymentRows = Array.isArray(payments) ? payments : [];

    if (enrollmentView && enrollmentByUser) {
        return (
            <AppTableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                    <SortableTableHead columns={ENROLLMENT_COLUMNS} order={order} orderBy={orderBy} onSort={onRequestSort} />
                    <TableBody>
                        {paymentRows.map(payment => (
                            <EnrollmentRow
                                key={payment.id}
                                payment={payment}
                                charge={enrollmentByUser[payment.User?.id || payment.userId]}
                                onRegisterClick={onRegisterClick}
                            />
                        ))}
                    </TableBody>
                </Table>
            </AppTableContainer>
        );
    }

    return (
        <AppTableContainer component={Paper} sx={{ borderRadius: 2 }}>
            <Table size="small" sx={{ minWidth: 900 }}>
                <SortableTableHead columns={PAYMENT_COLUMNS} order={order} orderBy={orderBy} onSort={onRequestSort} />
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
        </AppTableContainer>
    );
};

PaymentTable.propTypes = {
    payments: PropTypes.array,
    enrollmentView: PropTypes.bool,
    enrollmentByUser: PropTypes.object,
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
