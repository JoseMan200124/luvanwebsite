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
    Alert
} from '@mui/material';
import moment from 'moment';
import api from '../utils/axiosConfig';

function PaymentHistorySection() {
    // ================================
    // 1) Fechas por defecto: mes actual
    // ================================
    const defaultStart = moment().startOf('month').format('YYYY-MM-DD');
    const defaultEnd = moment().endOf('month').format('YYYY-MM-DD');

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);
    const [histories, setHistories] = useState([]);

    // Snackbar
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // ================================
    // 2) useEffect para cargar historial al montar
    // ================================
    useEffect(() => {
        fetchHistory();
    }, []);

    // ================================
    // Función para obtener historial
    // ================================
    const fetchHistory = async () => {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            // GET /payments/history?startDate=...&endDate=...
            const res = await api.get('/payments/history', { params });
            setHistories(res.data.histories || []);
        } catch (error) {
            console.error('Error al obtener historial:', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener historial de pagos',
                severity: 'error'
            });
        }
    };

    // ================================
    // Botón para crear snapshot manual
    // ================================
    const handleTakeSnapshot = async () => {
        try {
            const resp = await api.post('/payments/take-snapshot');
            setSnackbar({ open: true, message: resp.data.message, severity: 'success' });
            fetchHistory(); // Actualizamos el historial tras crear/actualizar snapshot
        } catch (error) {
            console.error('Error al crear snapshot:', error);
            setSnackbar({ open: true, message: 'Error al crear snapshot', severity: 'error' });
        }
    };

    return (
        <Box sx={{ mt: 6 }}>
            <Typography variant="h5" gutterBottom>
                Historial de Pagos (Snapshots)
            </Typography>

            {/* Filtros de fecha y botones */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                    label="Fecha Inicio"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
                <TextField
                    label="Fecha Fin"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />

                <Button variant="contained" onClick={fetchHistory}>
                    Buscar Historial
                </Button>

                <Button variant="outlined" onClick={handleTakeSnapshot}>
                    Crear Snapshot
                </Button>
            </Box>

            {/* Tabla con resultados del historial */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Fecha Snapshot</TableCell>
                            <TableCell>Apellido Familia</TableCell>
                            <TableCell>Estado Final</TableCell>
                            <TableCell>Monto Total (Q)</TableCell>
                            <TableCell>Saldo (Q)</TableCell>
                            <TableCell>Total Due (Q)</TableCell>
                            <TableCell>Requiere Factura</TableCell>
                            <TableCell>Exoneración (Q)</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {histories.map((h) => (
                            <TableRow key={h.id}>
                                <TableCell>
                                    {moment(h.snapshotDate).format('DD/MM/YYYY HH:mm')}
                                </TableCell>
                                <TableCell>{h.familyLastName}</TableCell>
                                <TableCell>{h.finalStatus}</TableCell>
                                <TableCell>
                                    {parseFloat(h.montoTotal).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                    {parseFloat(h.leftover).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                    {parseFloat(h.totalDue).toFixed(2)}
                                </TableCell>
                                <TableCell>{h.requiresInvoice ? 'Sí' : 'No'}</TableCell>
                                <TableCell>
                                    {parseFloat(h.exoneratedPenaltyAmount || 0).toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Snackbar de notificaciones */}
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
