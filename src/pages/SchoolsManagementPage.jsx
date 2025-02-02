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
    Checkbox,
    FormControl,
    FormControlLabel,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { Edit, Delete, Add, ContentCopy, FileUpload } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';

// Contenedor con estilos
const SchoolsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

/**
 * Función para formatear fecha/hora (para nombrar la plantilla de Excel, etc.)
 */
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

const SchoolsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    // Lista de colegios
    const [schools, setSchools] = useState([]);

    // Manejo de modal (crear/editar)
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);

    // Alertas / Snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Búsqueda / paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    // Manejo de "Horarios" y "grades" al editar/crear
    const [schoolSchedules, setSchoolSchedules] = useState([]);
    const [schoolGrades, setSchoolGrades] = useState([]);

    // Manejo de extra fields (un solo nombre => fieldName)
    const [schoolExtraFields, setSchoolExtraFields] = useState([]);

    // Popover para mostrar +n grados
    const [anchorEl, setAnchorEl] = useState(null);
    const [popoverGrades, setPopoverGrades] = useState([]);

    // Carga Masiva
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    /**
     * Obtener lista de Colegios
     */
    const fetchSchools = async () => {
        setLoading(true);
        try {
            const response = await api.get('/schools', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            let fetchedSchools = Array.isArray(response.data.schools) ? response.data.schools : [];

            // Parsear "schedules", "grades" y "extraEnrollmentFields"
            fetchedSchools = fetchedSchools.map((school) => {
                let parsedSchedules = [];
                if (typeof school.schedules === 'string' && school.schedules.trim()) {
                    try {
                        parsedSchedules = JSON.parse(school.schedules);
                    } catch {
                        parsedSchedules = [];
                    }
                } else if (Array.isArray(school.schedules)) {
                    parsedSchedules = school.schedules;
                }

                let parsedGrades = [];
                if (typeof school.grades === 'string' && school.grades.trim()) {
                    try {
                        parsedGrades = JSON.parse(school.grades);
                    } catch {
                        parsedGrades = [];
                    }
                } else if (Array.isArray(school.grades)) {
                    parsedGrades = school.grades;
                }

                let parsedExtraFields = [];
                if (
                    typeof school.extraEnrollmentFields === 'string' &&
                    school.extraEnrollmentFields.trim()
                ) {
                    try {
                        parsedExtraFields = JSON.parse(school.extraEnrollmentFields);
                    } catch {
                        parsedExtraFields = [];
                    }
                } else if (Array.isArray(school.extraEnrollmentFields)) {
                    parsedExtraFields = school.extraEnrollmentFields;
                }

                return {
                    ...school,
                    schedules: parsedSchedules,
                    grades: parsedGrades,
                    extraEnrollmentFields: parsedExtraFields
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

    /**
     * Añadir Colegio
     */
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
        setSchoolSchedules([]);
        setSchoolGrades([]);
        setSchoolExtraFields([]);
        setOpenDialog(true);
    };

    /**
     * Editar Colegio
     */
    const handleEditClick = (school) => {
        const transportFeeCompleteValue = school.transportFeeComplete ?? '';
        const transportFeeHalfValue = school.transportFeeHalf ?? '';
        const duePaymentDayValue = school.duePaymentDay ?? '';

        setSelectedSchool({
            ...school,
            transportFeeComplete: transportFeeCompleteValue,
            transportFeeHalf: transportFeeHalfValue,
            duePaymentDay: duePaymentDayValue
        });

        // Schedules
        let parsedSchedules = [];
        if (Array.isArray(school.schedules)) {
            parsedSchedules = school.schedules;
        } else {
            try {
                parsedSchedules = JSON.parse(school.schedules) || [];
            } catch {
                parsedSchedules = [];
            }
        }
        setSchoolSchedules(parsedSchedules);

        // Grades
        let parsedGrades = [];
        if (Array.isArray(school.grades)) {
            parsedGrades = school.grades;
        } else {
            try {
                parsedGrades = JSON.parse(school.grades) || [];
            } catch {
                parsedGrades = [];
            }
        }
        setSchoolGrades(parsedGrades);

        // Extra Fields
        let parsedExtraFields = [];
        if (Array.isArray(school.extraEnrollmentFields)) {
            parsedExtraFields = school.extraEnrollmentFields;
        } else {
            try {
                parsedExtraFields = JSON.parse(school.extraEnrollmentFields) || [];
            } catch {
                parsedExtraFields = [];
            }
        }
        setSchoolExtraFields(parsedExtraFields);

        setOpenDialog(true);
    };

    /**
     * Eliminar Colegio
     */
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

    /**
     * Cerrar Modal
     */
    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedSchool(null);
        setSchoolSchedules([]);
        setSchoolGrades([]);
        setSchoolExtraFields([]);
    };

    /**
     * Manejo de Inputs (colegio)
     */
    const handleInputChange = (e) => {
        setSelectedSchool((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    // Horarios
    const handleAddSchedule = () => {
        setSchoolSchedules((prev) => [...prev, { day: '', times: [''] }]);
    };
    const handleRemoveSchedule = (scheduleIndex) => {
        setSchoolSchedules((prev) => {
            const newArr = [...prev];
            newArr.splice(scheduleIndex, 1);
            return newArr;
        });
    };
    const handleScheduleDayChange = (e, scheduleIndex) => {
        const { value } = e.target;
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[scheduleIndex].day = value;
            return clone;
        });
    };
    const handleAddTime = (scheduleIndex) => {
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[scheduleIndex].times.push('');
            return clone;
        });
    };
    const handleRemoveTime = (scheduleIndex, timeIndex) => {
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[scheduleIndex].times.splice(timeIndex, 1);
            return clone;
        });
    };
    const handleTimeChange = (e, scheduleIndex, timeIndex) => {
        const { value } = e.target;
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[scheduleIndex].times[timeIndex] = value;
            return clone;
        });
    };

    // Grados
    const handleAddGrade = () => {
        setSchoolGrades((prev) => [...prev, { name: '' }]);
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

    // Extra Fields (un solo campo => fieldName)
    const handleAddExtraField = () => {
        setSchoolExtraFields((prev) => [
            ...prev,
            { fieldName: '', type: 'text', required: false }
        ]);
    };
    const handleRemoveExtraField = (index) => {
        setSchoolExtraFields((prev) => {
            const clone = [...prev];
            clone.splice(index, 1);
            return clone;
        });
    };
    const handleChangeExtraField = (index, field, value) => {
        setSchoolExtraFields((prev) => {
            const clone = [...prev];
            clone[index][field] = value;
            return clone;
        });
    };

    /**
     * Guardar (Crear/Actualizar)
     */
    const handleSave = async () => {
        if (!selectedSchool) return;

        // Validaciones simples
        if (Number(selectedSchool.transportFeeComplete) < 0 || Number(selectedSchool.transportFeeHalf) < 0) {
            setSnackbar({
                open: true,
                message: 'Las cuotas de transporte no pueden ser negativas.',
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
            const payload = {
                name: selectedSchool.name,
                address: selectedSchool.address,
                city: selectedSchool.city,
                contactPerson: selectedSchool.contactPerson,
                contactEmail: selectedSchool.contactEmail,
                contactPhone: selectedSchool.contactPhone,
                schedules: schoolSchedules,
                grades: schoolGrades,
                transportFeeComplete: Number(selectedSchool.transportFeeComplete) || 0.0,
                transportFeeHalf: Number(selectedSchool.transportFeeHalf) || 0.0,
                duePaymentDay: Number(selectedSchool.duePaymentDay) || 1,

                // Guardar extraEnrollmentFields con un solo campo (fieldName)
                extraEnrollmentFields: schoolExtraFields
            };

            if (selectedSchool.id) {
                // Actualizar
                await api.put(`/schools/${selectedSchool.id}`, payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({ open: true, message: 'Colegio actualizado exitosamente', severity: 'success' });
            } else {
                // Crear
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

    /**
     * Búsqueda y paginación
     */
    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };
    const handleSearchChange = (e) => setSearchQuery(e.target.value);
    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredSchools = schools.filter((sch) =>
        sch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sch.city || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    /**
     * Copiar enlace del formulario de inscripción
     */
    const handleCopyLink = (schoolId) => {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/schools/enroll/${schoolId}`;

        navigator.clipboard.writeText(link)
            .then(() => {
                setSnackbar({
                    open: true,
                    message: 'Enlace copiado al portapapeles',
                    severity: 'success',
                });
            })
            .catch((err) => {
                console.error('Error copiando enlace:', err);
                setSnackbar({
                    open: true,
                    message: 'No se pudo copiar el enlace',
                    severity: 'error'
                });
            });
    };

    /**
     * Popover => ver +N grados
     */
    const handlePopoverOpen = (event, grades) => {
        setAnchorEl(event.currentTarget);
        setPopoverGrades(grades);
    };
    const handlePopoverClose = () => {
        setAnchorEl(null);
        setPopoverGrades([]);
    };
    const openPopover = Boolean(anchorEl);
    const popoverId = openPopover ? 'grades-popover' : undefined;

    /**
     * Carga Masiva (bulk)
     */
    const handleOpenBulkDialog = () => {
        setBulkFile(null);
        setBulkResults(null);
        setOpenBulkDialog(true);
    };
    const handleCloseBulkDialog = () => {
        setOpenBulkDialog(false);
    };
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setBulkFile(file);
    };

    const handleUploadBulk = async () => {
        if (!bulkFile) return;
        setBulkLoading(true);
        setBulkResults(null);

        const formData = new FormData();
        formData.append('file', bulkFile);

        try {
            const resp = await api.post('/schools/bulk-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            setBulkResults(resp.data);
            fetchSchools();
        } catch (error) {
            console.error('Error al subir colegios masivamente:', error);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al procesar la carga masiva',
                severity: 'error'
            });
        }
        setBulkLoading(false);
    };

    const downloadFilename = `colegios_template_${getFormattedDateTime()}.xlsx`;

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
                <div>
                    <Button
                        variant="contained"
                        color="info"
                        startIcon={<FileUpload />}
                        style={{ marginRight: '8px' }}
                        onClick={handleOpenBulkDialog}
                    >
                        Carga Masiva
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Add />}
                        onClick={handleAddSchool}
                    >
                        Añadir Colegio
                    </Button>
                </div>
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
                                    <TableCell>Grados</TableCell>
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
                                                                onClick={(e) =>
                                                                    handlePopoverOpen(e, school.grades.slice(maxVisibleGrades))
                                                                }
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
                                        );
                                    })}
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
                        inputProps={{ min: '0', step: '0.01' }}
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
                        inputProps={{ min: '0', step: '0.01' }}
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
                        inputProps={{ min: '1', max: '31' }}
                    />

                    {/* Horarios */}
                    <Typography variant="h6" style={{ marginTop: '1rem' }}>
                        Horarios
                    </Typography>
                    {schoolSchedules.map((sch, scheduleIndex) => (
                        <Paper key={scheduleIndex} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle1">
                                    Horario #{scheduleIndex + 1}
                                </Typography>
                                <IconButton
                                    onClick={() => handleRemoveSchedule(scheduleIndex)}
                                    color="error"
                                    size="small"
                                >
                                    <Delete />
                                </IconButton>
                            </div>
                            <TextField
                                margin="dense"
                                name="day"
                                label="Día (ej: Lunes)"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={sch.day}
                                onChange={(e) => handleScheduleDayChange(e, scheduleIndex)}
                                required
                            />
                            <Typography variant="subtitle2" style={{ marginTop: '0.5rem' }}>
                                Horas
                            </Typography>
                            {sch.times.map((timeValue, timeIndex) => (
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
                                        onChange={(e) => handleTimeChange(e, scheduleIndex, timeIndex)}
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                        required
                                    />
                                    <IconButton
                                        onClick={() => handleRemoveTime(scheduleIndex, timeIndex)}
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
                                onClick={() => handleAddTime(scheduleIndex)}
                            >
                                Agregar hora
                            </Button>
                        </Paper>
                    ))}
                    <Button
                        variant="contained"
                        style={{ marginTop: '1rem' }}
                        onClick={handleAddSchedule}
                        startIcon={<Add />}
                    >
                        Agregar Horario
                    </Button>

                    {/* Grados */}
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

                    {/* CAMPOS EXTRA DE INSCRIPCIÓN */}
                    <Typography variant="h6" style={{ marginTop: '2rem' }}>
                        Campos Extra de Inscripción
                    </Typography>
                    {schoolExtraFields.map((field, idx) => (
                        <Paper key={idx} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle1">
                                    Campo #{idx + 1}
                                </Typography>
                                <IconButton
                                    onClick={() => handleRemoveExtraField(idx)}
                                    color="error"
                                    size="small"
                                >
                                    <Delete />
                                </IconButton>
                            </div>
                            {/* Un solo nombre para placeholder y nombre interno => fieldName */}
                            <TextField
                                margin="dense"
                                label="Nombre del Campo"
                                type="text"
                                fullWidth
                                value={field.fieldName || ''}
                                onChange={(e) => handleChangeExtraField(idx, 'fieldName', e.target.value)}
                                required
                            />

                            <FormControl fullWidth margin="dense">
                                <InputLabel>Tipo</InputLabel>
                                <Select
                                    value={field.type || 'text'}
                                    onChange={(e) => handleChangeExtraField(idx, 'type', e.target.value)}
                                >
                                    <MenuItem value="text">Texto</MenuItem>
                                    <MenuItem value="number">Número</MenuItem>
                                    <MenuItem value="date">Fecha</MenuItem>
                                    <MenuItem value="select">Select/Combo</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!field.required}
                                        onChange={(e) => handleChangeExtraField(idx, 'required', e.target.checked)}
                                    />
                                }
                                label="Requerido"
                            />
                        </Paper>
                    ))}
                    <Button
                        variant="outlined"
                        style={{ marginTop: '1rem' }}
                        onClick={handleAddExtraField}
                        startIcon={<Add />}
                    >
                        Agregar Campo Extra
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

            {/* Popover => ver +N grados */}
            <Popover
                id={popoverId}
                open={openPopover}
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

            {/* Diálogo Carga Masiva */}
            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Colegios</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Sube un archivo Excel/CSV con las columnas necesarias.
                        <br />
                        <strong>¡No necesitas usar JSON!</strong> <br />
                        Para <em>Horarios</em> puedes escribir algo como: <br />
                        <code>Lunes=08:00,09:00;Martes=07:00,09:30</code> <br />
                        Para <em>Grados</em>, simplemente: <br />
                        <code>Kinder,Primero,Segundo</code>
                    </Typography>
                    <Button
                        variant="outlined"
                        color="success"
                        href="/plantillas/plantilla_colegios.xlsx"
                        download={downloadFilename}
                        sx={{ mr: 2 }}
                    >
                        Descargar Plantilla
                    </Button>

                    <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                        Seleccionar Archivo
                        <input
                            type="file"
                            hidden
                            onChange={handleFileChange}
                            accept=".xlsx, .xls, .csv"
                        />
                    </Button>
                    {bulkFile && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {bulkFile.name}
                        </Typography>
                    )}

                    {bulkLoading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                            <CircularProgress size={24} />
                            <Typography variant="body2" sx={{ ml: 2 }}>
                                Procesando archivo...
                            </Typography>
                        </Box>
                    )}

                    {bulkResults && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="info">
                                <Typography>
                                    <strong>Colegios creados/actualizados:</strong> {bulkResults.successCount}
                                </Typography>
                                <Typography>
                                    <strong>Errores:</strong> {bulkResults.errorsCount}
                                </Typography>
                                {bulkResults.errorsList && bulkResults.errorsList.length > 0 && (
                                    <ul>
                                        {bulkResults.errorsList.map((err, idx) => (
                                            <li key={idx}>
                                                Fila {err.row}: {err.errorMessage}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Alert>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseBulkDialog}>Cerrar</Button>
                    <Button
                        onClick={handleUploadBulk}
                        variant="contained"
                        color="primary"
                        disabled={!bulkFile || bulkLoading}
                    >
                        Subir
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </SchoolsContainer>
    );
};

export default SchoolsManagementPage;
