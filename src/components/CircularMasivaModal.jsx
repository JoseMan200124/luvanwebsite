// src/components/CircularMasivaModal.jsx
import React, { useState } from 'react';
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
    Box
} from '@mui/material';
import { FileUpload } from '@mui/icons-material';
import api from '../utils/axiosConfig';

const CircularMasivaModal = ({ open, onClose, schools, onSuccess }) => {
    const [selectedSchool, setSelectedSchool] = useState('all');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

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
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('body', message);
            formData.append('schoolId', selectedSchool);
            if (file) {
                formData.append('file', file);
            }
            // Se asume que el endpoint es /api/mail/send-circular
            await api.post('/mail/send-circular', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSnackbar({ open: true, message: 'Circular enviada correctamente.', severity: 'success' });
            if (onSuccess) onSuccess();
            onClose();
            // Limpiar estados
            setSubject('');
            setMessage('');
            setFile(null);
            setSelectedSchool('all');
        } catch (error) {
            console.error('Error al enviar circular:', error);
            setSnackbar({ open: true, message: 'Error al enviar la circular.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Enviar Circular Masiva</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            value={selectedSchool}
                            onChange={(e) => setSelectedSchool(e.target.value)}
                            label="Colegio"
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
                    </FormControl>
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
                    <Box sx={{ mt: 2 }}>
                        <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                            Seleccionar Archivo
                            <input type="file" hidden onChange={handleFileChange} />
                        </Button>
                        {file && <Box sx={{ mt: 1 }}>{file.name}</Box>}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSendCircular} variant="contained" color="primary" disabled={loading}>
                        {loading ? 'Enviando...' : 'Enviar Circular'}
                    </Button>
                </DialogActions>
            </Dialog>
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
