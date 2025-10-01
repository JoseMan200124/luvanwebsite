// src/components/CircularMasivaModal.jsx
import React, { useMemo, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Snackbar,
    Alert,
    Box,
    Checkbox,
    ListItemText,
    FormHelperText,
    Typography,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Stack,
    Divider,
} from '@mui/material';
import { FileUpload, ExpandMore } from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';
import api from '../utils/axiosConfig';

/**
 * Recibe: schools: [{ id, name, routeNumbers: [...] }, ...]
 *
 * Comportamiento:
 * - Si se selecciona un colegio específico, aparece un panel (Accordion) con un Autocomplete múltiple
 *   para elegir rutas (con búsqueda, checkboxes, chips compactos).
 * - Si no se seleccionan rutas => se envía a todos los involucrados del colegio.
 * - Si se seleccionan rutas => sólo a Padres/Monitoras/Pilotos/Supervisores involucrados en esas rutas.
 * - Si se selecciona "Todos" los colegios => no hay selector de rutas y se envía a todos los involucrados del sistema.
 */
const CircularMasivaModal = ({ open, onClose, schools, onSuccess }) => {
    const [selectedSchool, setSelectedSchool] = useState('all');
    const [selectedRoutes, setSelectedRoutes] = useState([]); // array de strings (routeNumbers)
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Colegio actual (si no es "Todos")
    const currentSchool = useMemo(() => {
        if (selectedSchool === 'all') return null;
        return schools.find(s => String(s.id) === String(selectedSchool)) || null;
    }, [selectedSchool, schools]);

    // Rutas disponibles del colegio (normalizadas a string)
    const availableRoutes = useMemo(() => {
        if (!currentSchool) return [];
        const rn = Array.isArray(currentSchool.routeNumbers) ? currentSchool.routeNumbers : [];
        return rn.map(r => String(r)).filter(Boolean);
    }, [currentSchool]);

    // Opciones para Autocomplete (como objetos para labels uniformes)
    const routeOptions = useMemo(
        () => availableRoutes.map(r => ({ value: r, label: `Ruta ${r}` })),
        [availableRoutes]
    );

    const selectedRouteOptions = useMemo(
        () => routeOptions.filter(opt => selectedRoutes.includes(opt.value)),
        [routeOptions, selectedRoutes]
    );

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        const maxSize = 5 * 1024 * 1024;
        if (selectedFile && selectedFile.size > maxSize) {
            setSnackbar({ open: true, message: 'El archivo no puede superar los 5MB.', severity: 'error' });
            e.target.value = null;
            setFile(null);
            return;
        }
        setFile(selectedFile);
    };

    const handleSendCircular = async () => {
        if (!subject || !message) {
            setSnackbar({ open: true, message: 'Asunto y mensaje son requeridos.', severity: 'error' });
            return;
        }
        if (selectedSchool !== 'all' && selectedRoutes.some(r => !r)) {
            setSnackbar({ open: true, message: 'Hay rutas inválidas seleccionadas.', severity: 'error' });
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('body', message);
            formData.append('schoolId', selectedSchool);
            formData.append('useSmtp', true);

            // Si hay colegio específico y rutas seleccionadas, las enviamos como JSON
            if (selectedSchool !== 'all' && selectedRoutes.length > 0) {
                formData.append('routeNumbers', JSON.stringify(selectedRoutes));
            }

            if (file) formData.append('file', file);

            await api.post('/mail/send-circular', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSnackbar({ open: true, message: 'Circular enviada correctamente.', severity: 'success' });
            if (onSuccess) onSuccess();

            // Reset de estado
            setSubject('');
            setMessage('');
            setFile(null);
            setSelectedSchool('all');
            setSelectedRoutes([]);
            onClose();
        } catch (error) {
            console.error('Error al enviar circular:', error);
            setSnackbar({ open: true, message: 'Error al enviar la circular.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAllRoutes = () => {
        setSelectedRoutes(availableRoutes);
    };

    const handleClearRoutes = () => {
        setSelectedRoutes([]);
    };

    // Render de chips compactos con contador "+N"
    const renderCompactTags = (value, getTagProps) => {
        const maxShown = 3;
        const shown = value.slice(0, maxShown);
        const hiddenCount = value.length - shown.length;

        return (
            <>
                {shown.map((option, index) => (
                    <Chip
                        key={option.value}
                        label={option.label}
                        size="small"
                        {...getTagProps({ index })}
                    />
                ))}
                {hiddenCount > 0 && (
                    <Chip
                        label={`+${hiddenCount} más`}
                        size="small"
                        disabled
                    />
                )}
            </>
        );
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Enviar Circular Masiva</DialogTitle>

                <DialogContent>
                    {/* Selección de colegio */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            value={selectedSchool}
                            label="Colegio"
                            onChange={(e) => {
                                setSelectedSchool(e.target.value);
                                // Reiniciamos rutas al cambiar de colegio
                                setSelectedRoutes([]);
                            }}
                        >
                            <MenuItem value="all">
                                <em>Todos</em>
                            </MenuItem>
                            {schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                    {school.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            Si eliges un colegio, podrás filtrar por rutas específicas de ese colegio.
                        </FormHelperText>
                    </FormControl>

                    {/* Selector de rutas: en un Accordion para ahorrar espacio */}
                    {selectedSchool !== 'all' && (
                        <Box sx={{ mt: 1 }}>
                            <Accordion disableGutters elevation={0} square>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            Rutas (opcional)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedRoutes.length > 0
                                                ? `${selectedRoutes.length} seleccionadas`
                                                : 'Ninguna seleccionada'}
                                            {availableRoutes.length > 0 ? ` • ${availableRoutes.length} disponibles` : ''}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    {availableRoutes.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Este colegio no tiene rutas registradas.
                                        </Typography>
                                    ) : (
                                        <>
                                            <Stack direction="row" spacing={1} sx={{ mb: 1 }} useFlexGap flexWrap="wrap">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={handleSelectAllRoutes}
                                                    disabled={selectedRoutes.length === availableRoutes.length}
                                                >
                                                    Seleccionar todas
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={handleClearRoutes}
                                                    disabled={selectedRoutes.length === 0}
                                                >
                                                    Limpiar
                                                </Button>
                                            </Stack>

                                            <Autocomplete
                                                multiple
                                                disableCloseOnSelect
                                                disablePortal
                                                options={routeOptions}
                                                value={selectedRouteOptions}
                                                onChange={(_, newValue) => {
                                                    setSelectedRoutes(newValue.map(v => v.value));
                                                }}
                                                getOptionLabel={(option) => option.label}
                                                renderOption={(props, option, { selected }) => (
                                                    <li {...props} key={option.value}>
                                                        <Checkbox
                                                            style={{ marginRight: 8 }}
                                                            checked={selected}
                                                        />
                                                        {option.label}
                                                    </li>
                                                )}
                                                renderTags={renderCompactTags}
                                                ListboxProps={{ style: { maxHeight: 280, overflow: 'auto' } }}
                                                filterSelectedOptions
                                                fullWidth
                                                size="small"
                                                noOptionsText="Sin coincidencias"
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Buscar y seleccionar rutas"
                                                        placeholder="Escribe para filtrar..."
                                                    />
                                                )}
                                                sx={{
                                                    '& .MuiAutocomplete-inputRoot': { paddingRight: '60px' }
                                                }}
                                            />

                                            {/* Chips en línea (compactas) para feedback visual */}
                                            {selectedRoutes.length > 0 && (
                                                <>
                                                    <Divider sx={{ my: 1.5 }} />
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {selectedRouteOptions.slice(0, 10).map(opt => (
                                                            <Chip key={opt.value} label={opt.label} size="small" />
                                                        ))}
                                                        {selectedRoutes.length > 10 && (
                                                            <Chip label={`+${selectedRoutes.length - 10} más`} size="small" disabled />
                                                        )}
                                                    </Box>
                                                </>
                                            )}

                                            <FormHelperText sx={{ mt: 1 }}>
                                                Si no seleccionas rutas, la circular se enviará a todos los involucrados del colegio.
                                            </FormHelperText>
                                        </>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    )}

                    {/* Asunto y mensaje */}
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Asunto"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Mensaje"
                        multiline
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />

                    {/* Archivo adjunto */}
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                            Seleccionar Archivo
                            <input type="file" hidden onChange={handleFileChange} />
                        </Button>
                        {file && <Box sx={{ mt: 1 }}>{file.name}</Box>}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleSendCircular} variant="contained" color="primary" disabled={loading}>
                        {loading ? 'Enviando...' : 'Enviar Circular'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar de feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default CircularMasivaModal;
