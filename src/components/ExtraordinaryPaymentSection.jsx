// src/components/ExtraordinaryPaymentSection.jsx

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
    Button
} from '@mui/material';
import api from '../utils/axiosConfig';

const ExtraordinaryPaymentSection = ({ onPaymentCreated }) => {
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

    const [schools, setSchools] = useState([]);

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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        // Validación mínima de campos obligatorios
        if (!formData.schoolId || !formData.familyLastName || !formData.amount) {
            alert('Por favor complete los campos obligatorios: Colegio, Apellidos de Familia y Monto.');
            return;
        }
        try {
            const response = await api.post('/payments/extraordinary', formData);
            alert(response.data.message);
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
        } catch (error) {
            console.error('Error al crear pago extraordinario:', error);
            alert('Error al crear pago extraordinario');
        }
    };

    return (
        <Paper elevation={3} style={{ padding: '16px', marginBottom: '32px' }}>
            <Typography variant="h5" gutterBottom>
                Registro de Pago Extraordinario
            </Typography>
            <Grid container spacing={2}>
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
                    <TextField
                        name="familyLastName"
                        label="Apellidos de Familia"
                        variant="outlined"
                        fullWidth
                        value={formData.familyLastName}
                        onChange={handleChange}
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
                            <MenuItem value=""><em>Ninguno</em></MenuItem>
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
        </Paper>
    );
};

export default ExtraordinaryPaymentSection;
