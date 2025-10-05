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
    TablePagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import moment from 'moment';
import 'moment/locale/es';
import api from '../utils/axiosConfig';
import * as XLSX from 'xlsx';

function PaymentHistorySection({ refresh = 0 }) {
    const [snapshotDate, setSnapshotDate] = useState(moment().format('YYYY-MM-DD'));
    const [lastPaymentDate, setLastPaymentDate] = useState("");
    const [selectedMonth, setSelectedMonth] = useState('');
    const currentYear = moment().year();

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
    }, [refresh, page, rowsPerPage, snapshotDate, lastPaymentDate, selectedMonth]);

    const fetchHistory = async () => {
        try {
            const params = {
                snapshotDate,
                lastPaymentDate,
                page,
                limit: rowsPerPage
            };

            // Si el usuario seleccionó un mes, agrega el rango
            if (selectedMonth) {
                const start = moment(`${currentYear}-${selectedMonth}-01`).startOf('month').format('YYYY-MM-DD');
                const end = moment(`${currentYear}-${selectedMonth}-01`).endOf('month').format('YYYY-MM-DD');
                params.monthStart = start;
                params.monthEnd = end;
            }   

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

    // Utilidad para formatear fecha/hora para el nombre del archivo
    const getFormattedDateTime = () => {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    };

    // Función para descargar el historial de pagos en Excel
    const handleDownloadPaymentHistory = async () => {
        try {
            // Construye los mismos filtros que fetchHistory
            const params = {
                snapshotDate,
                lastPaymentDate,
                page: 0,
                limit: 10000 // Un número suficientemente grande para traer todos
            };

            if (selectedMonth) {
                const start = moment(`${currentYear}-${selectedMonth}-01`).startOf('month').format('YYYY-MM-DD');
                const end = moment(`${currentYear}-${selectedMonth}-01`).endOf('month').format('YYYY-MM-DD');
                params.monthStart = start;
                params.monthEnd = end;
            }

            // Pide todos los registros al backend
            const res = await api.get('/payments/history', { params });
            const allHistories = res.data.histories || [];

            if (!allHistories.length) {
                setSnackbar({
                    open: true,
                    message: 'No hay datos de historial para exportar',
                    severity: 'info'
                });
                return;
            }

            const headers = [
                "Colegio",
                "Apellido Familia",
                "Cant. Estudiantes",
                "Estado Final",
                "Próximo Pago",
                "Último Pago",
                "Monto Total (Q)",
                "Saldo (Q)",
                "Multa Acum. (Q)",
                "Total a Pagar (Q)",
                "Abono (Q)",
                "Descuento Familia (Q)",
                "Número de Cuenta",
                "Factura",
                "Exoneración (Q)"
            ];

            const data = [headers];

            allHistories.forEach((h) => {
                data.push([
                    h.schoolName || '',
                    h.familyLastName || '',
                    h.studentCount || 0,
                    h.finalStatus || '',
                    h.nextPaymentDate ? moment(h.nextPaymentDate).format('DD/MM/YYYY') : '',
                    h.lastPaymentDate ? moment(h.lastPaymentDate).format('DD/MM/YYYY') : '',
                    parseFloat(h.montoTotal).toFixed(2),
                    parseFloat(h.leftover).toFixed(2),
                    parseFloat(h.accumulatedPenalty).toFixed(2),
                    parseFloat(h.totalDue).toFixed(2),
                    parseFloat(h.creditBalance).toFixed(2),
                    parseFloat(h.familyDiscount || 0).toFixed(2),
                    h.bankAccountNumber || '',
                    h.requiresInvoice ? 'Sí' : 'No',
                    parseFloat(h.exoneratedPenaltyAmount || 0).toFixed(2)
                ]);
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, "HistorialPagos");
            const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const blob = new Blob([wbout], { type: "application/octet-stream" });
            const fileName = `historial_pagos_${getFormattedDateTime()}.xlsx`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Error al descargar el historial',
                severity: 'error'
            });
        }
    };

    return (
        <Box sx={{ mt: 6 }}>
            <Typography variant="h5" gutterBottom>
                Historial de Pagos
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                    label="Fecha Último Pago"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={lastPaymentDate}
                    onChange={(e) => {
                        setPage(0); // resetear paginación al cambiar fecha
                        setLastPaymentDate(e.target.value);
                        setSelectedMonth(''); // limpiar filtro de mes
                    }}
                />
                <FormControl size="small">
                    <InputLabel>Mes</InputLabel>
                    <Select
                        label="Mes"
                        value={selectedMonth}
                        onChange={e => {
                            setSelectedMonth(e.target.value);
                            setPage(0);
                            setLastPaymentDate(''); // limpiar filtro de fecha
                        }}
                        style={{ minWidth: 100 }}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {moment.localeData('es').months().map((m, idx) => (
                            <MenuItem key={m} value={idx + 1}>
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button
                    variant="outlined"
                    color="success"
                    onClick={handleDownloadPaymentHistory}
                >
                    Descargar Excel
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
                                    <TableCell>Descuento Familia (Q)</TableCell>
                                    <TableCell>Número de Cuenta</TableCell>
                                    <TableCell>Factura</TableCell>
                                    <TableCell>Exoneración (Q)</TableCell>
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
                                                ? moment.parseZone(h.nextPaymentDate).format('DD/MM/YYYY')
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {h.lastPaymentDate
                                                ? moment.parseZone(h.lastPaymentDate).format('DD/MM/YYYY')
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
                                            {parseFloat(h.familyDiscount || 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {h.bankAccountNumber || ''}
                                        </TableCell>
                                        <TableCell>
                                            {h.requiresInvoice ? 'Sí' : 'No'}
                                        </TableCell>
                                        <TableCell>
                                            {parseFloat(h.exoneratedPenaltyAmount || 0).toFixed(2)}
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
