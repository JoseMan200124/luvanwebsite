// src/pages/BulkScheduleUpdatePage.jsx
import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Alert,
    LinearProgress,
    Paper,
    List,
    ListItem,
    ListItemText,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Collapse,
    TextField
} from '@mui/material';
import {
    CloudUpload,
    GetApp,
    Assessment,
    ExpandMore,
    Warning,
    Error
} from '@mui/icons-material';
import api from '../utils/axiosConfig';

const BulkScheduleUpdatePage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState(null);
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [showResults, setShowResults] = useState(false);
    
    // Estados para debug
    const [debugMode, setDebugMode] = useState(false);
    const [debugData, setDebugData] = useState({
        apellidoFamilia: '',
        nombreEstudiante: '',
        gradoEstudiante: ''
    });
    const [debugResult, setDebugResult] = useState(null);
    const [debugLoading, setDebugLoading] = useState(false);

    // Manejar selección de archivo
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Validar que sea un archivo Excel
            if (file.name.match(/\.(xlsx|xls)$/)) {
                setSelectedFile(file);
                setResults(null);
            } else {
                alert('Por favor selecciona un archivo Excel válido (.xlsx o .xls)');
                event.target.value = '';
            }
        }
    };

    // Subir y procesar archivo
    const handleUpload = async () => {
        if (!selectedFile) {
            alert('Por favor selecciona un archivo primero');
            return;
        }

        setUploading(true);
        
        try {
            const formData = new FormData();
            formData.append('excelFile', selectedFile);

            const response = await api.post('/bulk-schedule/upload-schedule-update', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setResults(response.data.results);
            setShowResults(true);
            
            // Refrescar estadísticas después de la carga
            await fetchStats();

        } catch (error) {
            console.error('Error uploading file:', error);
            
            const errorMessage = error.response?.data?.message || 'Error al procesar el archivo';
            setResults({
                totalRows: 0,
                studentsProcessed: 0,
                slotsCreated: 0,
                slotsUpdated: 0,
                errors: [errorMessage],
                warnings: [],
                summary: 'Error en el procesamiento'
            });
            setShowResults(true);
        } finally {
            setUploading(false);
        }
    };

    // Obtener estadísticas
    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const response = await api.get('/bulk-schedule/schedule-slots-stats');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    // Limpiar selección
    const handleClearFile = () => {
        setSelectedFile(null);
        setResults(null);
        document.getElementById('file-input').value = '';
    };

    // Descargar plantilla Excel
    const downloadTemplate = () => {
        // Aquí podrías generar un Excel real o simplemente mostrar instrucciones
        alert('La plantilla de ejemplo estará disponible próximamente. Por favor, asegúrate de que tu Excel tenga las columnas correctas según la documentación.');
    };

    // Función para probar búsqueda de estudiantes
    const handleDebugSearch = async () => {
        if (!debugData.apellidoFamilia || !debugData.nombreEstudiante || !debugData.gradoEstudiante) {
            alert('Por favor completa todos los campos de debug');
            return;
        }

        setDebugLoading(true);
        try {
            const response = await api.post('/bulk-schedule/debug-students', debugData);
            setDebugResult(response.data);
        } catch (error) {
            console.error('Error en debug:', error);
            setDebugResult({
                success: false,
                message: 'Error en la búsqueda de debug',
                error: error.response?.data?.message || error.message
            });
        } finally {
            setDebugLoading(false);
        }
    };

    React.useEffect(() => {
        fetchStats();
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Carga Masiva de Horarios
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Actualiza los horarios de múltiples estudiantes utilizando un archivo Excel.
            </Typography>

            {/* Estadísticas Actuales */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Estadísticas Actuales
                        </Typography>
                        <Button
                            startIcon={<Assessment />}
                            onClick={fetchStats}
                            disabled={loadingStats}
                        >
                            Refrescar
                        </Button>
                    </Box>
                    
                    {loadingStats ? (
                        <LinearProgress />
                    ) : stats ? (
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography variant="h4" color="primary">
                                        {stats.overview?.total || 0}
                                    </Typography>
                                    <Typography variant="body2">
                                        Total Horarios
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography variant="h4" color="secondary">
                                        {stats.overview?.uniqueStudents || 0}
                                    </Typography>
                                    <Typography variant="body2">
                                        Estudiantes Únicos
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography variant="h4" color="success.main">
                                        {stats.overview?.uniqueBuses || 0}
                                    </Typography>
                                    <Typography variant="body2">
                                        Buses Asignados
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    ) : null}
                </CardContent>
            </Card>

            {/* Sección de Debug */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            🔍 Debug - Probar Búsqueda de Estudiantes
                        </Typography>
                        <Button
                            variant={debugMode ? "contained" : "outlined"}
                            onClick={() => setDebugMode(!debugMode)}
                            size="small"
                        >
                            {debugMode ? 'Ocultar' : 'Mostrar'} Debug
                        </Button>
                    </Box>

                    <Collapse in={debugMode}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Usa esta sección para probar si un estudiante específico puede ser encontrado en la base de datos.
                            </Typography>
                            
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Apellido Familia"
                                        value={debugData.apellidoFamilia}
                                        onChange={(e) => setDebugData({...debugData, apellidoFamilia: e.target.value})}
                                        placeholder="ej: Zuchini Juárez"
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Nombre Estudiante"
                                        value={debugData.nombreEstudiante}
                                        onChange={(e) => setDebugData({...debugData, nombreEstudiante: e.target.value})}
                                        placeholder="ej: Daniela"
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Grado Estudiante"
                                        value={debugData.gradoEstudiante}
                                        onChange={(e) => setDebugData({...debugData, gradoEstudiante: e.target.value})}
                                        placeholder="ej: 6E"
                                    />
                                </Grid>
                            </Grid>
                            
                            <Button
                                variant="contained"
                                onClick={handleDebugSearch}
                                disabled={debugLoading}
                                sx={{ mb: 2 }}
                            >
                                {debugLoading ? 'Buscando...' : 'Buscar Estudiante'}
                            </Button>
                            
                            {debugResult && (
                                <Alert 
                                    severity={debugResult.success ? "success" : "error"}
                                    sx={{ mt: 2 }}
                                >
                                    <Typography variant="body2">
                                        <strong>{debugResult.message}</strong>
                                    </Typography>
                                    {debugResult.success && debugResult.data && (
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Estudiante encontrado: {debugResult.data.student.fullName} (ID: {debugResult.data.student.id})
                                            <br />
                                            Familia: {debugResult.data.family.familyLastName} (ID: {debugResult.data.family.id})
                                        </Typography>
                                    )}
                                    {debugResult.error && (
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Error: {debugResult.error}
                                        </Typography>
                                    )}
                                </Alert>
                            )}
                        </Box>
                    </Collapse>
                </CardContent>
            </Card>

            {/* Sección de Carga */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Subir Archivo Excel
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<GetApp />}
                            onClick={downloadTemplate}
                            sx={{ mr: 2 }}
                        >
                            Descargar Plantilla
                        </Button>
                        
                        <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography variant="body2">
                                <strong>Formato requerido:</strong> El archivo Excel debe contener las columnas:
                                "Apellido Familia", "Estudiante X - Nombre", "Estudiante X - Grado", 
                                "Estudiante X - [Día] - Hora [Franja]", "Estudiante X - [Día] - Ruta [Franja]", 
                                "Estudiante X - [Día] - Parada [Franja]"
                                <br />
                                Donde X = 1-4, Día = Lunes-Viernes, Franja = AM/MD/PM/EX
                            </Typography>
                        </Alert>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <input
                            id="file-input"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="file-input">
                            <Button
                                variant="outlined"
                                component="span"
                                startIcon={<CloudUpload />}
                            >
                                Seleccionar Archivo
                            </Button>
                        </label>
                        
                        {selectedFile && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">
                                    {selectedFile.name}
                                </Typography>
                                <Button size="small" onClick={handleClearFile}>
                                    Quitar
                                </Button>
                            </Box>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            onClick={handleUpload}
                            disabled={!selectedFile || uploading}
                            startIcon={<CloudUpload />}
                        >
                            {uploading ? 'Procesando...' : 'Subir y Procesar'}
                        </Button>
                    </Box>

                    {uploading && (
                        <Box sx={{ mt: 2 }}>
                            <LinearProgress />
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Procesando archivo, esto puede tomar unos momentos...
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de Resultados */}
            <Dialog 
                open={showResults} 
                onClose={() => setShowResults(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Resultados del Procesamiento
                </DialogTitle>
                <DialogContent>
                    {results && (
                        <Box>
                            {/* Resumen */}
                            <Alert 
                                severity={results.errors.length > 0 ? "error" : "success"} 
                                sx={{ mb: 2 }}
                            >
                                {results.summary}
                            </Alert>

                            {/* Estadísticas */}
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="h6">{results.totalRows}</Typography>
                                        <Typography variant="caption">Filas Procesadas</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="h6">{results.studentsProcessed}</Typography>
                                        <Typography variant="caption">Estudiantes</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="h6">{results.slotsCreated}</Typography>
                                        <Typography variant="caption">Horarios Creados</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="h6">{results.slotsUpdated}</Typography>
                                        <Typography variant="caption">Horarios Actualizados</Typography>
                                    </Paper>
                                </Grid>
                            </Grid>

                            {/* Errores */}
                            {results.errors.length > 0 && (
                                <Accordion sx={{ mb: 2 }}>
                                    <AccordionSummary expandIcon={<ExpandMore />}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Error color="error" />
                                            <Typography>
                                                Errores ({results.errors.length})
                                            </Typography>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <List dense>
                                            {results.errors.map((error, index) => (
                                                <ListItem key={index}>
                                                    <ListItemText 
                                                        primary={error}
                                                        primaryTypographyProps={{ 
                                                            variant: 'body2',
                                                            color: 'error'
                                                        }}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </AccordionDetails>
                                </Accordion>
                            )}

                            {/* Advertencias */}
                            {results.warnings.length > 0 && (
                                <Accordion>
                                    <AccordionSummary expandIcon={<ExpandMore />}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Warning color="warning" />
                                            <Typography>
                                                Advertencias ({results.warnings.length})
                                            </Typography>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <List dense>
                                            {results.warnings.slice(0, 50).map((warning, index) => (
                                                <ListItem key={index}>
                                                    <ListItemText 
                                                        primary={warning}
                                                        primaryTypographyProps={{ 
                                                            variant: 'body2',
                                                            color: 'text.secondary'
                                                        }}
                                                    />
                                                </ListItem>
                                            ))}
                                            {results.warnings.length > 50 && (
                                                <ListItem>
                                                    <ListItemText 
                                                        primary={`... y ${results.warnings.length - 50} advertencias más`}
                                                        primaryTypographyProps={{ 
                                                            variant: 'body2',
                                                            fontStyle: 'italic'
                                                        }}
                                                    />
                                                </ListItem>
                                            )}
                                        </List>
                                    </AccordionDetails>
                                </Accordion>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowResults(false)}>
                        Cerrar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BulkScheduleUpdatePage;
