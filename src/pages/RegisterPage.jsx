// src/pages/RegisterPage.jsx

import React, { useState, useContext } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import {
    TextField,
    Button,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import { Link } from 'react-router-dom';

const RegisterContainer = styled.div`
    ${tw`flex flex-col items-center justify-center bg-gray-100 w-full min-h-screen`}
    padding: 2rem;

    // Ajustes para pantallas muy pequeñas
    @media (max-width: 480px) {
        padding: 1rem;
    }
`;

const Form = styled.form`
    ${tw`bg-white p-8 rounded-lg shadow-md w-full max-w-md`}

            // Ajustes para pantallas muy pequeñas
    @media (max-width: 480px) {
    padding: 1rem;
}
`;

const FormField = tw.div`mb-4`;

const RegisterPage = () => {
    const { register } = useContext(AuthContext);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
    });
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await register(formData);
        } catch (err) {
            setError(err.response?.data?.message || 'Error en el registro');
        }
    };

    return (
        <RegisterContainer>
            <Form onSubmit={handleSubmit}>
                <Typography variant="h5" tw="text-center mb-6">
                    Registro de Usuario
                </Typography>
                {error && (
                    <Typography variant="body1" color="error" tw="mb-4 text-center">
                        {error}
                    </Typography>
                )}
                <FormField>
                    <TextField
                        label="Nombre Completo"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        required
                    />
                </FormField>
                <FormField>
                    <TextField
                        label="Correo Electrónico"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        required
                    />
                </FormField>
                <FormField>
                    <TextField
                        label="Contraseña"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        required
                    />
                </FormField>
                <FormField>
                    <FormControl variant="outlined" fullWidth required>
                        <InputLabel>Rol</InputLabel>
                        <Select
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            label="Rol"
                        >
                            <MenuItem value="">
                                <em>Seleccione un rol</em>
                            </MenuItem>
                            <MenuItem value="Gestor">Gestor</MenuItem>
                            <MenuItem value="Administrador">Administrador</MenuItem>
                            <MenuItem value="Padre">Padre</MenuItem>
                            <MenuItem value="Monitora">Monitora</MenuItem>
                            <MenuItem value="Piloto">Piloto</MenuItem>
                            <MenuItem value="Supervisor">Supervisor</MenuItem>
                        </Select>
                    </FormControl>
                </FormField>
                <Button type="submit" variant="contained" color="primary" fullWidth tw="py-2">
                    Registrarse
                </Button>
                <Typography variant="body2" tw="mt-4 text-center">
                    ¿Ya tienes una cuenta? <Link to="/login">Inicia Sesión</Link>
                </Typography>
            </Form>
        </RegisterContainer>
    );
};

export default RegisterPage;
