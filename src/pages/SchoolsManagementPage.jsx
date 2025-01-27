// src/pages/SchoolsManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    TextField,
    IconButton,
    Tooltip,
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Alert,
    CircularProgress,
    Chip,
    Popover,
    Box,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
} from '@mui/material';
import { Edit, Delete, Add, ContentCopy } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';

// Contenedor con twin.macro
const SchoolsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const SchoolsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    // Estados para rutas y grados
    const [schoolRoutes, setSchoolRoutes] = useState([]);
    const [schoolGrades, setSchoolGrades] = useState([]); // Nuevo estado para grados

    // Estados para Popover de grados adicionales
    const [anchorEl, setAnchorEl] = useState(null);
    const [popoverGrades, setPopoverGrades] = useState([]);

    // ============================
    // 1) Cargar lista de colegios
    // ============================
    const fetchSchools = async () => {
        setLoading(true);
        try {
            const response = await api.get('/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            // La respuesta es { schools: [...] }
            let fetchedSchools = Array.isArray(response.data.schools) ? response.data.schools : [];

            // Parsear schedules y grades si son cadenas JSON
            fetchedSchools = fetchedSchools.map((school) => {
                let parsedSchedules = [];
                if (typeof school.schedules === 'string' && school.schedules.trim()) {
                    try {
                        parsedSchedules = JSON.parse(school.schedules);
                    } catch (err) {
                        console.error('Error parseando schedules JSON:', err);
                        parsedSchedules = [];
                    }
                } else if (Array.isArray(school.schedules)) {
                    parsedSchedules = school.schedules;
                }

                let parsedGrades = [];
                if (typeof school.grades === 'string' && school.grades.trim()) {
                    try {
                        parsedGrades = JSON.parse(school.grades);
                    } catch (err) {
                        console.error('Error parseando grades JSON:', err);
                        parsedGrades = [];
                    }
                } else if (Array.isArray(school.grades)) {
                    parsedGrades = school.grades;
                }

                return {
                    ...school,
                    schedules: parsedSchedules,
                    grades: parsedGrades,
                };
            });

            setSchools(fetchedSchools);
            setLoading(false);
        } catch (err) {
            console.error('Error al obtener los colegios:', err);
            setSnackbar({ open: true, message: 'Error al obtener colegios', severity: 'error' });
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchools();
    }, [auth.token]);

    // ============================
    // 2) Crear un colegio (modal vacío)
    // ============================
    const handleAddSchool = () => {
        setSelectedSchool({
            id: null,
            name: '',
            address: '',
            city: '',
            contactPerson: '',
            contactEmail: '',
            contactPhone: '',
            transportFeeComplete: '',
            transportFeeHalf: '',
            duePaymentDay: ''
        });
        // Routes y grades vacío
        setSchoolRoutes([]);
        setSchoolGrades([]);
        setOpenDialog(true);
    };

    // ============================
    // 3) Editar un colegio
    // ============================
    const handleEditClick = (school) => {
        // Si el backend ya retorna transportFeeComplete y transportFeeHalf, los guardamos.
        // En caso de que no vengan, los inicializamos para evitar "undefined".
        const transportFeeCompleteValue =
            school.transportFeeComplete !== undefined && school.transportFeeComplete !== null
                ? school.transportFeeComplete
                : '';
        const transportFeeHalfValue =
            school.transportFeeHalf !== undefined && school.transportFeeHalf !== null
                ? school.transportFeeHalf
                : '';
        const duePaymentDayValue =
            school.duePaymentDay !== undefined && school.duePaymentDay !== null
                ? school.duePaymentDay
                : '';

        setSelectedSchool({
            ...school,
            transportFeeComplete: transportFeeCompleteValue,
            transportFeeHalf: transportFeeHalfValue,
            duePaymentDay: duePaymentDayValue
        });

        // Manejar routes
        if (typeof school.schedules === 'string' && school.schedules.trim()) {
            try {
                const parsed = JSON.parse(school.schedules);
                if (Array.isArray(parsed)) {
                    setSchoolRoutes(parsed);
                } else {
                    setSchoolRoutes([]);
                }
            } catch (err) {
                console.error('Error parseando schedules JSON:', err);
                setSchoolRoutes([]);
            }
        }
        else if (Array.isArray(school.schedules)) {
            setSchoolRoutes(school.schedules);
        } else {
            setSchoolRoutes([]);
        }

        // Manejar grades
        if (typeof school.grades === 'string' && school.grades.trim()) {
            try {
                const parsedGrades = JSON.parse(school.grades);
                if (Array.isArray(parsedGrades)) {
                    setSchoolGrades(parsedGrades);
                } else {
                    setSchoolGrades([]);
                }
            } catch (err) {
                console.error('Error parseando grades JSON:', err);
                setSchoolGrades([]);
            }
        }
        else if (Array.isArray(school.grades)) {
            setSchoolGrades(school.grades);
        } else {
            setSchoolGrades([]);
        }

        setOpenDialog(true);
    };

    // ============================
    // 4) Eliminar colegio
    // ============================
    const handleDeleteClick = async (schoolId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este colegio?')) {
            try {
                await api.delete(`/schools/${schoolId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({ open: true, message: 'Colegio eliminado exitosamente', severity: 'success' });
                fetchSchools();
            } catch (err) {
                console.error('Error al eliminar colegio:', err);
                setSnackbar({ open: true, message: 'Error al eliminar colegio', severity: 'error' });
            }
        }
    };

    // ============================
    // 5) Cerrar el modal
    // ============================
    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedSchool(null);
        setSchoolRoutes([]);
        setSchoolGrades([]); // Resetear grades
    };

    // ============================
    // 6) Manejadores de input simple
    // ============================
    const handleInputChange = (e) => {
        setSelectedSchool((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    // ============ Manejo de schoolRoutes (UI Dinámica) ============
    const handleAddRoute = () => {
        setSchoolRoutes((prev) => [
            ...prev,
            { day: '', times: [''], type: 'ruta Completa' } // Añadir campo 'type' por defecto
        ]);
    };

    const handleRemoveRoute = (routeIndex) => {
        setSchoolRoutes((prev) => {
            const newArr = [...prev];
            newArr.splice(routeIndex, 1);
            return newArr;
        });
    };

    const handleRouteChange = (e, routeIndex) => {
        const { value } = e.target;
        setSchoolRoutes((prev) => {
            const clone = [...prev];
            clone[routeIndex].day = value;
            return clone;
        });
    };

    const handleRouteTypeChange = (e, routeIndex) => {
        const { value } = e.target;
        setSchoolRoutes((prev) => {
            const clone = [...prev];
            clone[routeIndex].type = value;
            return clone;
        });
    };

    const handleAddTime = (routeIndex) => {
        setSchoolRoutes((prev) => {
            const clone = [...prev];
            clone[routeIndex].times.push('');
            return clone;
        });
    };

    const handleRemoveTime = (routeIndex, timeIndex) => {
        setSchoolRoutes((prev) => {
            const clone = [...prev];
            clone[routeIndex].times.splice(timeIndex, 1);
            return clone;
        });
    };

    const handleTimeChange = (e, routeIndex, timeIndex) => {
        const { value } = e.target;
        setSchoolRoutes((prev) => {
            const clone = [...prev];
            clone[routeIndex].times[timeIndex] = value;
            return clone;
        });
    };

    // ============ Manejo de schoolGrades (UI Dinámica) ============
    const handleAddGrade = () => {
        setSchoolGrades((prev) => [
            ...prev,
            { name: '' }
        ]);
    };

    const handleRemoveGrade = (gradeIndex) => {
        setSchoolGrades((prev) => {
            const newArr = [...prev];
            newArr.splice(gradeIndex, 1);
            return newArr;
        });
    };

    const handleGradeChange = (e, gradeIndex) => {
        const { value } = e.target;
        setSchoolGrades((prev) => {
            const clone = [...prev];
            clone[gradeIndex].name = value;
            return clone;
        });
    };

    // ============================
    // 7) Guardar (crear o actualizar)
    // ============================
    const handleSave = async () => {
        if (!selectedSchool) return;

        // Validaciones específicas para transportFeeComplete y transportFeeHalf
        if (Number(selectedSchool.transportFeeComplete) < 0) {
            setSnackbar({
                open: true,
                message: 'La cuota de transporte completa no puede ser negativa.',
                severity: 'error'
            });
            return;
        }
        if (Number(selectedSchool.transportFeeHalf) < 0) {
            setSnackbar({
                open: true,
                message: 'La cuota de transporte media no puede ser negativa.',
                severity: 'error'
            });
            return;
        }
        if (
            Number(selectedSchool.duePaymentDay) < 1 ||
            Number(selectedSchool.duePaymentDay) > 31
        ) {
            setSnackbar({
                open: true,
                message: 'El día de pago debe estar entre 1 y 31.',
                severity: 'error'
            });
            return;
        }

        try {
            // Armamos el payload, incluyendo transportFeeComplete y transportFeeHalf
            const payload = {
                name: selectedSchool.name,
                address: selectedSchool.address,
                city: selectedSchool.city,
                contactPerson: selectedSchool.contactPerson,
                contactEmail: selectedSchool.contactEmail,
                contactPhone: selectedSchool.contactPhone,
                schedules: schoolRoutes, // array => se guardará como JSON en el backend
                grades: schoolGrades, // Nuevo campo
                transportFeeComplete: selectedSchool.transportFeeComplete || 0.0,
                transportFeeHalf: selectedSchool.transportFeeHalf || 0.0,
                duePaymentDay: selectedSchool.duePaymentDay || 1
            };

            if (selectedSchool.id) {
                // Update
                await api.put(`/schools/${selectedSchool.id}`, payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({ open: true, message: 'Colegio actualizado exitosamente', severity: 'success' });
            } else {
                // Create
                await api.post('/schools', payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({ open: true, message: 'Colegio creado exitosamente', severity: 'success' });
            }

            fetchSchools();
            handleDialogClose();
        } catch (err) {
            console.error('Error al guardar el colegio:', err);
            setSnackbar({ open: true, message: 'Error al guardar el colegio', severity: 'error' });
        }
    };

    // ============================
    // 8) Búsqueda, paginación, etc.
    // ============================
    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Filtrar
    const filteredSchools = schools.filter((sch) =>
        sch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sch.city || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ============================
    // NUEVO: Copiar enlace
    // ============================
    const handleCopyLink = (schoolId) => {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/schools/enroll/${schoolId}`;

        navigator.clipboard.writeText(link).then(() => {
            setSnackbar({
                open: true,
                message: 'Enlace copiado al portapapeles',
                severity: 'success',
            });
        }).catch((err) => {
            console.error('Error copiando enlace:', err);
            setSnackbar({
                open: true,
                message: 'No se pudo copiar el enlace',
                severity: 'error'
            });
        });
    };

    // ============================
    // Manejo del Popover para grados adicionales
    // ============================
    const handlePopoverOpen = (event, grades) => {
        setAnchorEl(event.currentTarget);
        setPopoverGrades(grades);
    };

    const handlePopoverClose = () => {
        setAnchorEl(null);
        setPopoverGrades([]);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'grades-popover' : undefined;

    return (
        <SchoolsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Colegios
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <TextField
                    label="Buscar colegios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: '300px' }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={handleAddSchool}
                >
                    Añadir Colegio
                </Button>
            </div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Ciudad</TableCell>
                                    <TableCell>Dirección</TableCell>
                                    <TableCell>Contacto</TableCell>
                                    <TableCell>Teléfono</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Grados</TableCell> {/* Nueva columna */}
                                    <TableCell align="center">Formulario</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredSchools
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((school) => {
                                        const maxVisibleGrades = 3;
                                        const visibleGrades = school.grades.slice(0, maxVisibleGrades);
                                        const remainingGrades = school.grades.length - maxVisibleGrades;

                                        return (
                                            <TableRow key={school.id}>
                                                <TableCell>{school.name}</TableCell>
                                                <TableCell>{school.city}</TableCell>
                                                <TableCell>{school.address}</TableCell>
                                                <TableCell>{school.contactPerson}</TableCell>
                                                <TableCell>{school.contactPhone}</TableCell>
                                                <TableCell>{school.contactEmail}</TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {visibleGrades.map((grade, index) => (
                                                            <Chip
                                                                key={index}
                                                                label={grade.name}
                                                                size="small"
                                                                color="primary"
                                                            />
                                                        ))}
                                                        {remainingGrades > 0 && (
                                                            <Chip
                                                                label={`+${remainingGrades} más`}
                                                                size="small"
                                                                onClick={(e) => handlePopoverOpen(e, school.grades.slice(maxVisibleGrades))}
                                                                clickable
                                                                color="secondary"
                                                            />
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Copiar enlace">
                                                        <IconButton onClick={() => handleCopyLink(school.id)}>
                                                            <ContentCopy />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Editar">
                                                        <IconButton onClick={() => handleEditClick(school)}>
                                                            <Edit />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Eliminar">
                                                        <IconButton onClick={() => handleDeleteClick(school.id)}>
                                                            <Delete />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                }
                                {filteredSchools.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} align="center">
                                            No se encontraron colegios.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredSchools.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}

            {/* Diálogo para Crear/Editar Colegio */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {selectedSchool?.id ? 'Editar Colegio' : 'Añadir Colegio'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="name"
                        label="Nombre"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.name : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="city"
                        label="Ciudad"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.city : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="address"
                        label="Dirección"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.address : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="contactPerson"
                        label="Persona de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPerson : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactPhone"
                        label="Teléfono de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPhone : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactEmail"
                        label="Email de Contacto"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactEmail : ''}
                        onChange={handleInputChange}
                    />

                    {/* Campos NUEVOS: transportFeeComplete y transportFeeHalf */}
                    <TextField
                        margin="dense"
                        name="transportFeeComplete"
                        label="Cuota de Transporte Completa (Q)"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.transportFeeComplete : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="transportFeeHalf"
                        label="Cuota de Transporte Media (Q)"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.transportFeeHalf : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="duePaymentDay"
                        label="Día de Pago (1-31)"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.duePaymentDay : ''}
                        onChange={handleInputChange}
                        required
                    />

                    {/* Título actualizado: Rutas */}
                    <Typography variant="h6" style={{ marginTop: '1rem' }}>
                        Rutas
                    </Typography>
                    {schoolRoutes.map((route, routeIndex) => (
                        <Paper key={routeIndex} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle1">
                                    Ruta #{routeIndex + 1}
                                </Typography>
                                <IconButton
                                    onClick={() => handleRemoveRoute(routeIndex)}
                                    color="error"
                                    size="small"
                                >
                                    <Delete />
                                </IconButton>
                            </div>
                            <TextField
                                margin="dense"
                                name="day"
                                label="Día/Días"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={route.day}
                                onChange={(e) => handleRouteChange(e, routeIndex)}
                                required
                            />

                            {/* Nuevo: Select para Tipo de Ruta */}
                            <FormControl fullWidth variant="outlined" margin="dense" required>
                                <InputLabel id={`route-type-label-${routeIndex}`}>Tipo de Ruta</InputLabel>
                                <Select
                                    labelId={`route-type-label-${routeIndex}`}
                                    label="Tipo de Ruta"
                                    value={route.type}
                                    onChange={(e) => handleRouteTypeChange(e, routeIndex)}
                                    name="type"
                                >
                                    <MenuItem value="ruta Completa">Ruta Completa</MenuItem>
                                    <MenuItem value="media AM">Media AM</MenuItem>
                                    <MenuItem value="media PM">Media PM</MenuItem>
                                </Select>
                            </FormControl>

                            <Typography variant="subtitle2" style={{ marginTop: '0.5rem' }}>
                                Horas
                            </Typography>
                            {route.times.map((timeValue, timeIndex) => (
                                <div
                                    key={timeIndex}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        marginBottom: '0.5rem'
                                    }}
                                >
                                    <TextField
                                        label="Hora (HH:MM)"
                                        variant="outlined"
                                        type="time"
                                        value={timeValue}
                                        onChange={(e) => handleTimeChange(e, routeIndex, timeIndex)}
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                        required
                                    />
                                    <IconButton
                                        onClick={() => handleRemoveTime(routeIndex, timeIndex)}
                                        color="error"
                                        size="small"
                                    >
                                        <Delete />
                                    </IconButton>
                                </div>
                            ))}
                            <Button
                                variant="outlined"
                                startIcon={<Add />}
                                onClick={() => handleAddTime(routeIndex)}
                            >
                                Agregar hora
                            </Button>
                        </Paper>
                    ))}

                    <Button
                        variant="contained"
                        style={{ marginTop: '1rem' }}
                        onClick={handleAddRoute}
                        startIcon={<Add />}
                    >
                        Agregar Ruta
                    </Button>

                    {/* Nueva Sección: Gestión de Grados */}
                    <Typography variant="h6" style={{ marginTop: '2rem' }}>
                        Grados del Colegio
                    </Typography>
                    {schoolGrades.map((grade, gradeIndex) => (
                        <Paper key={gradeIndex} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle1">
                                    Grado #{gradeIndex + 1}
                                </Typography>
                                <IconButton
                                    onClick={() => handleRemoveGrade(gradeIndex)}
                                    color="error"
                                    size="small"
                                >
                                    <Delete />
                                </IconButton>
                            </div>
                            <TextField
                                margin="dense"
                                name="name"
                                label="Nombre del Grado"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={grade.name}
                                onChange={(e) => handleGradeChange(e, gradeIndex)}
                                required
                            />
                        </Paper>
                    ))}

                    <Button
                        variant="outlined"
                        style={{ marginTop: '1rem' }}
                        onClick={handleAddGrade}
                        startIcon={<Add />}
                    >
                        Agregar Grado
                    </Button>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        color="primary"
                        variant="contained"
                    >
                        {selectedSchool?.id ? 'Guardar Cambios' : 'Crear Colegio'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Popover para Grados Adicionales */}
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handlePopoverClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle1">Grados Adicionales:</Typography>
                    {popoverGrades.map((grade, index) => (
                        <Chip
                            key={index}
                            label={grade.name}
                            size="small"
                            color="primary"
                            sx={{ m: 0.5 }}
                        />
                    ))}
                </Box>
            </Popover>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </SchoolsContainer>
    );

};

export default SchoolsManagementPage;
