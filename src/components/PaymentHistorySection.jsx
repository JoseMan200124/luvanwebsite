// src/pages/PaymentHistorySection.jsx

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Snackbar,
    Alert,
    TablePagination
} from '@mui/material';
import moment from 'moment';
import api from '../utils/axiosConfig';

function PaymentHistorySection() {
    const [snapshotDate, setSnapshotDate] = useState(moment().format('YYYY-MM-DD'));

    // Aquí guardamos la data que viene del backend (solo la "página" actual)
    const [histories, setHistories] = useState([]);
    // Total de registros que coinciden con la fecha, sin importar la página actual
    const [totalRecords, setTotalRecords] = useState(0);

    // Manejamos el estado de paginación:
    // page => página actual
    // rowsPerPage => cuántos registros traer por página
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    useEffect(() => {
        fetchHistory();
        // Cada vez que cambie page, rowsPerPage o snapshotDate
        // se hará una nueva búsqueda en el backend
    }, [page, rowsPerPage, snapshotDate]);

    const fetchHistory = async () => {
        try {
            const params = {
                snapshotDate,
                page,
                limit: rowsPerPage
            };

            const res = await api.get('/payments/history', { params });
            const { totalRecords, histories } = res.data;

            setTotalRecords(totalRecords || 0);
            setHistories(histories || []);
        } catch (error) {
            console.error('Error al obtener historial:', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener historial de pagos',
                severity: 'error'
            });
        }
    };

    // Se agrupa localmente el arreglo 'histories' (que ya está paginado) por schoolName
    // Ten en cuenta que 'histories' es solo la porción correspondiente a la página actual
    const groupedHistories = histories.reduce((acc, curr) => {
        const key = curr.schoolName || 'Sin Colegio';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(curr);
        return acc;
    }, {});

    // Manejadores para la paginación del "TablePagination" global:
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0); // al cambiar el tamaño, volvemos a la página 0
    };

    return (
        <Box sx={{ mt: 6 }}>
            <Typography variant="h5" gutterBottom>
                Historial de Pagos
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                    label="Fecha"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={snapshotDate}
                    onChange={(e) => {
                        setPage(0); // resetear paginación al cambiar fecha
                        setSnapshotDate(e.target.value);
                    }}
                />
                <Button variant="contained" onClick={fetchHistory}>
                    Ver Historial
                </Button>
            </Box>

            {/* Renderizamos múltiples tablas, una por cada colegio */}
            {Object.keys(groupedHistories).map((schoolName) => (
                <Box key={schoolName} sx={{ mb: 4 }}>
                    <Typography variant="h6" gutterBottom>
                        Colegio: {schoolName}
                    </Typography>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Apellido Familia</TableCell>
                                    <TableCell>Cant. Estudiantes</TableCell>
                                    <TableCell>Estado Final</TableCell>
                                    <TableCell>Próximo Pago</TableCell>
                                    <TableCell>Último Pago</TableCell>
                                    <TableCell>Monto Total (Q)</TableCell>
                                    <TableCell>Saldo (Q)</TableCell>
                                    <TableCell>Multa Acum. (Q)</TableCell>
                                    <TableCell>Total a Pagar (Q)</TableCell>
                                    <TableCell>Abono (Q)</TableCell>
                                    <TableCell>Medio de Pago</TableCell>
                                    <TableCell>Factura</TableCell>
                                    <TableCell>Exoneración (Q)</TableCell>
                                    <TableCell>Fecha Historial</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {groupedHistories[schoolName].map((h, idx) => (
                                    <TableRow key={`${h.familyLastName}-${idx}`}>
                                        <TableCell>{h.familyLastName}</TableCell>
                                        <TableCell>{h.studentCount}</TableCell>
                                        <TableCell>{h.finalStatus}</TableCell>
                                        <TableCell>
                                            {h.nextPaymentDate
                                                ? moment(h.nextPaymentDate).format('DD/MM/YYYY')
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {h.lastPaymentDate
                                                ? moment(h.lastPaymentDate).format('DD/MM/YYYY')
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {parseFloat(h.montoTotal).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {parseFloat(h.leftover).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {parseFloat(h.accumulatedPenalty).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {parseFloat(h.totalDue).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {parseFloat(h.creditBalance).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {h.paymentMethod || 'Deposito'}
                                        </TableCell>
                                        <TableCell>
                                            {h.requiresInvoice ? 'Sí' : 'No'}
                                        </TableCell>
                                        <TableCell>
                                            {parseFloat(h.exoneratedPenaltyAmount || 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {moment(h.snapshotDate).format('DD/MM/YYYY HH:mm')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            ))}

            {/* Paginador Global (aplicado a todos los registros) */}
            <TablePagination
                component="div"
                count={totalRecords}        // total de registros en la BD (sin filtrar por paginación)
                page={page}                 // página actual
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}   // cuántos registros se muestran en cada página
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Filas por página"
                rowsPerPageOptions={[5, 10, 25, 50]}
            />

            {/* Snackbar para mensajes de error o info */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export default PaymentHistorySection;
