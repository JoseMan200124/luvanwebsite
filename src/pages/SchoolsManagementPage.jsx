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
    MenuItem,
    Card,
    CardContent,
    CardActions,
    DialogContentText
} from '@mui/material';
import {
    Edit,
    Delete,
    Add,
    ContentCopy,
    FileUpload,
    Visibility
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';

import {
    PieChart,
    Pie,
    Tooltip as ReTooltip,
    Legend,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';

import SubmissionPreview from './SubmissionPreview';

// Ajustes de contenedor responsivo con tw.macro
const SchoolsContainer = tw.div`
  p-8 bg-gray-100 min-h-screen w-full
`;

/**
 * Función para formatear fecha/hora (p.e. para nombre de plantillas).
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

    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const [schoolSchedules, setSchoolSchedules] = useState([]);
    const [schoolGrades, setSchoolGrades] = useState([]);
    const [schoolExtraFields, setSchoolExtraFields] = useState([]);

    const [anchorEl, setAnchorEl] = useState(null);
    const [popoverGrades, setPopoverGrades] = useState([]);

    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    const [selectedSchoolForSubmissions, setSelectedSchoolForSubmissions] = useState(null);
    const [submissions, setSubmissions] = useState([]);

    const [openSubmissionDialog, setOpenSubmissionDialog] = useState(false);
    const [submissionDetail, setSubmissionDetail] = useState(null);

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const response = await api.get('/schools', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            let fetchedSchools = Array.isArray(response.data.schools)
                ? response.data.schools
                : [];

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
            setSnackbar({
                open: true,
                message: 'Error al obtener colegios',
                severity: 'error'
            });
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchools();
        // eslint-disable-next-line
    }, [auth.token]);

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
            duePaymentDay: '',
            // NUEVO: Inicializamos los campos banco y cuenta
            bankName: '',
            bankAccount: ''
        });
        setSchoolSchedules([]);
        setSchoolGrades([]);
        setSchoolExtraFields([]);
        setOpenDialog(true);
    };

    const handleEditClick = (school) => {
        const transportFeeCompleteValue = school.transportFeeComplete ?? '';
        const transportFeeHalfValue = school.transportFeeHalf ?? '';
        const duePaymentDayValue = school.duePaymentDay ?? '';

        // NUEVO: Tomamos bankName y bankAccount, si no existen los ponemos en ''
        const bankNameValue = school.bankName ?? '';
        const bankAccountValue = school.bankAccount ?? '';

        setSelectedSchool({
            ...school,
            transportFeeComplete: transportFeeCompleteValue,
            transportFeeHalf: transportFeeHalfValue,
            duePaymentDay: duePaymentDayValue,
            // NUEVO
            bankName: bankNameValue,
            bankAccount: bankAccountValue
        });

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

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedSchool(null);
        setSchoolSchedules([]);
        setSchoolGrades([]);
        setSchoolExtraFields([]);
    };

    const handleDeleteClick = async (schoolId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este colegio?')) {
            try {
                await api.delete(`/schools/${schoolId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({
                    open: true,
                    message: 'Colegio eliminado exitosamente',
                    severity: 'success'
                });
                fetchSchools();
            } catch (err) {
                console.error('Error al eliminar colegio:', err);
                setSnackbar({
                    open: true,
                    message: 'Error al eliminar colegio',
                    severity: 'error'
                });
            }
        }
    };

    const handleInputChange = (e) => {
        setSelectedSchool((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    // ────── Horarios ──────────────────────────────────────────
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

    // ────── Grados ────────────────────────────────────────────
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

    // ────── Campos Extra ──────────────────────────────────────
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

    const handleSave = async () => {
        if (!selectedSchool) return;

        if (
            Number(selectedSchool.transportFeeComplete) < 0 ||
            Number(selectedSchool.transportFeeHalf) < 0
        ) {
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
                transportFeeComplete:
                    Number(selectedSchool.transportFeeComplete) || 0.0,
                transportFeeHalf:
                    Number(selectedSchool.transportFeeHalf) || 0.0,
                duePaymentDay:
                    Number(selectedSchool.duePaymentDay) || 1,
                extraEnrollmentFields: schoolExtraFields,
                // NUEVO: agregamos estos dos
                bankName: selectedSchool.bankName || '',
                bankAccount: selectedSchool.bankAccount || ''
            };

            if (selectedSchool.id) {
                // Actualizar
                await api.put(`/schools/${selectedSchool.id}`, payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({
                    open: true,
                    message: 'Colegio actualizado exitosamente',
                    severity: 'success'
                });
            } else {
                // Crear
                await api.post('/schools', payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({
                    open: true,
                    message: 'Colegio creado exitosamente',
                    severity: 'success'
                });
            }

            fetchSchools();
            handleDialogClose();
        } catch (err) {
            console.error('Error al guardar el colegio:', err);
            setSnackbar({
                open: true,
                message: 'Error al guardar el colegio',
                severity: 'error'
            });
        }
    };

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

    const handleViewSubmissions = async (school) => {
        setSelectedSchoolForSubmissions(school);
        setSubmissions([]);
        try {
            setLoading(true);
            const resp = await api.get(`/schools/${school.id}/submissions`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });

            let rawSubmissions = resp.data.submissions || [];
            const parsedSubmissions = rawSubmissions.map((sub) => {
                let parsedData;
                if (typeof sub.data === 'string') {
                    try {
                        parsedData = JSON.parse(sub.data);
                    } catch (err) {
                        parsedData = {};
                    }
                } else {
                    parsedData = sub.data || {};
                }
                return {
                    ...sub,
                    data: parsedData
                };
            });

            setSubmissions(parsedSubmissions);
        } catch (error) {
            console.error('Error al obtener inscripciones:', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener formularios de este colegio',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSubmissionDialog = (submission) => {
        setSubmissionDetail(submission);
        setOpenSubmissionDialog(true);
    };
    const handleCloseSubmissionDialog = () => {
        setSubmissionDetail(null);
        setOpenSubmissionDialog(false);
    };

    const getRouteTypeStats = () => {
        const counts = {};
        submissions.forEach((sub) => {
            const rt = sub.data.routeType || 'Desconocido';
            counts[rt] = (counts[rt] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    };

    const totalAlumnos = submissions.reduce((acc, sub) => {
        return acc + (Number(sub.data.studentsCount) || 0);
    }, 0);

    const getGradeCounts = () => {
        if (!selectedSchoolForSubmissions) return [];
        if (!Array.isArray(selectedSchoolForSubmissions.grades)) return [];

        const counts = {};
        selectedSchoolForSubmissions.grades.forEach((g) => {
            if (g.name) {
                counts[g.name] = 0;
            }
        });

        submissions.forEach((sub) => {
            if (Array.isArray(sub.data.students)) {
                sub.data.students.forEach((st) => {
                    const gName = st.grade;
                    if (counts[gName] !== undefined) {
                        counts[gName]++;
                    }
                });
            }
        });

        return Object.entries(counts).map(([gradeName, count]) => ({
            name: gradeName,
            value: count
        }));
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF6666'];

    return (
        <SchoolsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Colegios
            </Typography>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    gap: '8px'
                }}
            >
                <TextField
                    label="Buscar colegios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: '100%', maxWidth: '300px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <Button
                        variant="contained"
                        color="info"
                        startIcon={<FileUpload />}
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
                <Paper sx={{ width: '100%', overflowX: 'auto' }}>
                    <TableContainer
                        sx={{
                            // Forzamos scroll horizontal en pantallas más pequeñas
                            overflowX: 'auto',
                            maxHeight: { xs: 400, sm: 'none' },
                        }}
                    >
                        <Table stickyHeader>
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
                                                    <Tooltip title="Ver Formularios Llenados">
                                                        <IconButton onClick={() => handleViewSubmissions(school)}>
                                                            <Visibility />
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

            {selectedSchoolForSubmissions && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h5">
                        Formularios llenados para: {selectedSchoolForSubmissions.name}
                    </Typography>

                    <Box
                        sx={{
                            display: 'flex',
                            gap: 3,
                            mt: 2,
                            flexWrap: 'wrap',
                        }}
                    >
                        <Box>
                            <Typography variant="subtitle1">Tipos de Ruta (Gráfica)</Typography>
                            <PieChart width={300} height={300}>
                                <Pie
                                    data={getRouteTypeStats()}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label
                                >
                                    {getRouteTypeStats().map((entry, index) => (
                                        <Cell
                                            key={`cell-rt-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <ReTooltip />
                                <Legend />
                            </PieChart>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1">
                                Cantidad de Alumnos por Grado
                            </Typography>
                            <BarChart width={400} height={300} data={getGradeCounts()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <ReTooltip />
                                <Legend />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1">
                                Total de Formularios: {submissions.length}
                            </Typography>
                            <Typography variant="subtitle1">
                                Total de Alumnos: {totalAlumnos}
                            </Typography>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: 2,
                            mt: 2
                        }}
                    >
                        {submissions.map((sub) => (
                            <Card key={sub.id} sx={{ border: '1px solid #ccc' }}>
                                <CardContent>
                                    <Typography variant="h6">
                                        {sub.data.familyLastName || 'Sin Apellido Familiar'}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Ruta: {sub.data.routeType || 'Desconocido'}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Cant. Alumnos: {sub.data.studentsCount || 0}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Fecha de envío: {new Date(sub.createdAt).toLocaleString()}
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        onClick={() => handleOpenSubmissionDialog(sub)}
                                    >
                                        VER DETALLES
                                    </Button>
                                </CardActions>
                            </Card>
                        ))}
                    </Box>
                </Box>
            )}

            <Dialog
                open={openSubmissionDialog}
                onClose={handleCloseSubmissionDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Detalle del Formulario</DialogTitle>
                <DialogContent>
                    {submissionDetail ? (
                        <SubmissionPreview submission={submissionDetail} />
                    ) : (
                        <DialogContentText>
                            No hay datos para mostrar.
                        </DialogContentText>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseSubmissionDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

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

                    {/** NUEVO: Campos de Banco y Cuenta Bancaria */}
                    <TextField
                        margin="dense"
                        name="bankName"
                        label="Banco"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.bankName : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="bankAccount"
                        label="Cuenta Bancaria"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.bankAccount : ''}
                        onChange={handleInputChange}
                    />

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

            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Colegios</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Sube un archivo Excel/CSV con las columnas necesarias.
                        <br />
                        <strong>¡No necesitas usar JSON!</strong> <br />
                        Para <em>Horarios</em> puedes escribir algo como:
                        <br />
                        <code>Lunes=08:00,09:00;Martes=07:00,09:30</code> <br />
                        Para <em>Grados</em>:
                        <br />
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
