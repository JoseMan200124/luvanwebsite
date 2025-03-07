import React, { useState, useEffect } from 'react';
import {
    Paper,
    Typography,
    Grid,
    TextField,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Button,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Snackbar,
    Alert,
    Box,
    TablePagination
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import api from '../utils/axiosConfig';
import moment from 'moment';

const ExtraordinaryPaymentSection = ({ onPaymentCreated }) => {
    // Estado del formulario de registro
    const [formData, setFormData] = useState({
        schoolId: '',
        familyLastName: '',
        eventType: '',
        customPaymentType: '',
        eventDate: '',
        startPoint: '',
        startTime: '',
        endPoint: '',
        endTime: '',
        userCount: '',
        userList: '',
        monitor: 'no',
        decoration: 'no',
        observations: '',
        amount: ''
    });
    // Colegios para el select
    const [schools, setSchools] = useState([]);
    // Familias (FamilyDetail) para el Autocomplete, obtenidas según el colegio seleccionado
    const [families, setFamilies] = useState([]);

    // Estados para el listado de pagos extraordinarios
    const [extraPayments, setExtraPayments] = useState([]);
    const [filterStartDate, setFilterStartDate] = useState(
        moment().startOf('month').format('YYYY-MM-DD')
    );
    const [filterEndDate, setFilterEndDate] = useState(
        moment().endOf('month').format('YYYY-MM-DD')
    );
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalExtraPayments, setTotalExtraPayments] = useState(0);

    // Snackbar para mensajes
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Cargar colegios al montar
    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const res = await api.get('/schools');
                setSchools(res.data.schools || []);
            } catch (error) {
                console.error('Error al obtener colegios:', error);
            }
        };
        fetchSchools();
    }, []);

    // Cuando se cambia el colegio, se consulta el endpoint de familias para ese colegio
    useEffect(() => {
        const fetchFamilies = async () => {
            if (!formData.schoolId) {
                setFamilies([]);
                return;
            }
            try {
                const res = await api.get('/parents/families', { params: { schoolId: formData.schoolId } });
                // Se espera que res.data.families sea un arreglo de objetos con { id, familyLastName }
                setFamilies(res.data.families || []);
            } catch (error) {
                console.error('Error al obtener familias:', error);
            }
        };
        fetchFamilies();
    }, [formData.schoolId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Manejador del Autocomplete para seleccionar familia
    const handleFamilyChange = (event, newValue) => {
        setFormData(prev => ({ ...prev, familyLastName: newValue ? newValue.familyLastName : '' }));
    };

    // Envío del formulario para crear un pago extraordinario
    const handleSubmit = async () => {
        if (!formData.schoolId || !formData.familyLastName || !formData.amount) {
            alert('Por favor complete los campos obligatorios: Colegio, Apellidos de Familia y Monto.');
            return;
        }
        try {
            const response = await api.post('/payments/extraordinary', formData);
            setSnackbar({ open: true, message: response.data.message, severity: 'success' });
            onPaymentCreated && onPaymentCreated(response.data.extraordinaryPayment);
            // Reiniciar formulario
            setFormData({
                schoolId: '',
                familyLastName: '',
                eventType: '',
                customPaymentType: '',
                eventDate: '',
                startPoint: '',
                startTime: '',
                endPoint: '',
                endTime: '',
                userCount: '',
                userList: '',
                monitor: 'no',
                decoration: 'no',
                observations: '',
                amount: ''
            });
            // Refrescar listado de pagos extraordinarios
            setPage(0);
            fetchExtraordinaryPayments(filterStartDate, filterEndDate, 0, rowsPerPage);
        } catch (error) {
            console.error('Error al crear pago extraordinario:', error);
            setSnackbar({ open: true, message: 'Error al crear pago extraordinario', severity: 'error' });
        }
    };

    // Función para obtener el listado de pagos extraordinarios con paginación
    const fetchExtraordinaryPayments = async (startDate, endDate, pageParam = 0, rowsParam = 10) => {
        try {
            const res = await api.get('/payments/extraordinary', {
                params: {
                    startDate,
                    endDate,
                    page: pageParam + 1, // Backend espera página 1-indexada
                    limit: rowsParam
                }
            });
            setExtraPayments(res.data.extraordinaryPayments || []);
            setTotalExtraPayments(res.data.total || 0);
        } catch (error) {
            console.error('Error al obtener pagos extraordinarios:', error);
            setSnackbar({ open: true, message: 'Error al obtener pagos extraordinarios', severity: 'error' });
        }
    };

    // Al montar o al cambiar filtros/paginación, se actualiza el listado
    useEffect(() => {
        fetchExtraordinaryPayments(filterStartDate, filterEndDate, page, rowsPerPage);
    }, [page, rowsPerPage, filterStartDate, filterEndDate]);

    // Función para filtrar por fechas
    const handleFilter = () => {
        setPage(0);
        fetchExtraordinaryPayments(filterStartDate, filterEndDate, 0, rowsPerPage);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Paper elevation={3} style={{ padding: '16px', marginBottom: '32px' }}>
            <Typography variant="h5" gutterBottom>
                Registro de Pago Extraordinario
            </Typography>
            <Grid container spacing={2}>
                {/* Formulario de registro */}
                <Grid item xs={12}>
                    <FormControl variant="outlined" fullWidth>
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            name="schoolId"
                            label="Colegio"
                            value={formData.schoolId}
                            onChange={handleChange}
                        >
                            {schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                    {school.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <Autocomplete
                        options={families}
                        getOptionLabel={(option) => option.familyLastName}
                        onChange={handleFamilyChange}
                        renderInput={(params) => (
                            <TextField {...params} label="Apellidos de Familia" variant="outlined" fullWidth />
                        )}
                        value={families.find(f => f.familyLastName === formData.familyLastName) || null}
                    />
                </Grid>
                <Grid item xs={12}>
                    <FormControl variant="outlined" fullWidth>
                        <InputLabel>Tipo de Evento</InputLabel>
                        <Select
                            name="eventType"
                            label="Tipo de Evento"
                            value={formData.eventType}
                            onChange={handleChange}
                        >
                            <MenuItem value="">
                                <em>Ninguno</em>
                            </MenuItem>
                            <MenuItem value="cumpleaños">Cumpleaños</MenuItem>
                            <MenuItem value="excursión">Excursión</MenuItem>
                            <MenuItem value="shuttle">Shuttle</MenuItem>
                            <MenuItem value="otro">Otro</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                {formData.eventType === 'otro' && (
                    <Grid item xs={12}>
                        <TextField
                            name="customPaymentType"
                            label="Tipo de Pago"
                            variant="outlined"
                            fullWidth
                            value={formData.customPaymentType}
                            onChange={handleChange}
                        />
                    </Grid>
                )}
                {formData.eventType && formData.eventType !== 'otro' && (
                    <>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="eventDate"
                                label="Fecha del Evento"
                                type="date"
                                variant="outlined"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={formData.eventDate}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="startTime"
                                label="Hora de Salida"
                                type="time"
                                variant="outlined"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={formData.startTime}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="startPoint"
                                label="Punto de Salida"
                                variant="outlined"
                                fullWidth
                                value={formData.startPoint}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="endPoint"
                                label="Punto de Llegada"
                                variant="outlined"
                                fullWidth
                                value={formData.endPoint}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="endTime"
                                label="Hora de Llegada"
                                type="time"
                                variant="outlined"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={formData.endTime}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="userCount"
                                label="Cantidad de Usuarios"
                                type="number"
                                variant="outlined"
                                fullWidth
                                value={formData.userCount}
                                onChange={handleChange}
                            />
                        </Grid>
                        {(formData.eventType === 'cumpleaños' || formData.eventType === 'excursión') && (
                            <Grid item xs={12}>
                                <TextField
                                    name="userList"
                                    label="Lista de Usuarios (separados por comas)"
                                    variant="outlined"
                                    fullWidth
                                    value={formData.userList}
                                    onChange={handleChange}
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth variant="outlined">
                                <InputLabel>Monitora</InputLabel>
                                <Select
                                    name="monitor"
                                    label="Monitora"
                                    value={formData.monitor}
                                    onChange={handleChange}
                                >
                                    <MenuItem value="si">Sí</MenuItem>
                                    <MenuItem value="no">No</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth variant="outlined">
                                <InputLabel>Decoración</InputLabel>
                                <Select
                                    name="decoration"
                                    label="Decoración"
                                    value={formData.decoration}
                                    onChange={handleChange}
                                >
                                    <MenuItem value="si">Sí</MenuItem>
                                    <MenuItem value="no">No</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                name="observations"
                                label="Observaciones"
                                variant="outlined"
                                fullWidth
                                multiline
                                rows={3}
                                value={formData.observations}
                                onChange={handleChange}
                            />
                        </Grid>
                    </>
                )}
                <Grid item xs={12}>
                    <TextField
                        name="amount"
                        label="Monto"
                        type="number"
                        variant="outlined"
                        fullWidth
                        value={formData.amount}
                        onChange={handleChange}
                    />
                </Grid>
                <Grid item xs={12}>
                    <Button variant="contained" onClick={handleSubmit}>
                        Guardar Pago Extraordinario
                    </Button>
                </Grid>
            </Grid>

            {/* Sección de listado de pagos extraordinarios */}
            <Box mt={4}>
                <Typography variant="h6" gutterBottom>
                    Listado de Pagos Extraordinarios
                </Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                        <TextField
                            label="Fecha Inicio"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            label="Fecha Fin"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Button variant="outlined" fullWidth onClick={handleFilter}>
                            Filtrar
                        </Button>
                    </Grid>
                </Grid>
                {/* Tabla de pagos extraordinarios */}
                <Box mt={2}>
                    {extraPayments.length > 0 ? (
                        <TableContainer component={Paper}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Colegio</TableCell>
                                        <TableCell>Familia</TableCell>
                                        <TableCell>Tipo de Evento</TableCell>
                                        <TableCell>Fecha</TableCell>
                                        <TableCell>Monto</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {extraPayments.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell>
                                                {payment.School && payment.School.name
                                                    ? payment.School.name
                                                    : payment.schoolId}
                                            </TableCell>
                                            <TableCell>{payment.familyLastName}</TableCell>
                                            <TableCell>{payment.eventType || payment.customPaymentType || '-'}</TableCell>
                                            <TableCell>
                                                {payment.eventDate ? moment(payment.eventDate).format('DD/MM/YYYY') : '-'}
                                            </TableCell>
                                            <TableCell>Q {parseFloat(payment.amount).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography variant="body2" color="textSecondary">
                            No se encontraron pagos extraordinarios para el período seleccionado.
                        </Typography>
                    )}
                </Box>
                <TablePagination
                    component="div"
                    count={totalExtraPayments}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25]}
                    labelRowsPerPage="Filas por página"
                />
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Paper>
    );
};

export default ExtraordinaryPaymentSection;
