// frontend/src/components/dashboard/Filters.jsx

import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { TextField, MenuItem, Button } from '@mui/material';
import api from '../../utils/axiosConfig';

const FiltersContainer = tw.div`flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-8`;

const Filters = ({ filters, setFilters }) => {
    const [schools, setSchools] = useState([]);

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const response = await api.get('/schools');
                setSchools(response.data.schools || []);
            } catch (error) {
                console.error('Error fetching schools:', error);
            }
        };

        fetchSchools();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <FiltersContainer>
            <TextField
                select
                label="Colegio"
                name="colegio"
                value={filters.colegio}
                onChange={handleChange}
                variant="outlined"
                fullWidth
            >
                <MenuItem value="">Todas</MenuItem>
                {schools.map((school) => (
                    <MenuItem key={school.id} value={school.name}>
                        {school.name}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                select
                label="Mes"
                name="mes"
                value={filters.mes}
                onChange={handleChange}
                variant="outlined"
                fullWidth
            >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="Enero">Enero</MenuItem>
                <MenuItem value="Febrero">Febrero</MenuItem>
                <MenuItem value="Marzo">Marzo</MenuItem>
                <MenuItem value="Abril">Abril</MenuItem>
                <MenuItem value="Mayo">Mayo</MenuItem>
                <MenuItem value="Junio">Junio</MenuItem>
                <MenuItem value="Julio">Julio</MenuItem>
                <MenuItem value="Agosto">Agosto</MenuItem>
                <MenuItem value="Septiembre">Septiembre</MenuItem>
                <MenuItem value="Octubre">Octubre</MenuItem>
                <MenuItem value="Noviembre">Noviembre</MenuItem>
                <MenuItem value="Diciembre">Diciembre</MenuItem>
            </TextField>

            <TextField
                label="Fecha Inicio"
                name="fechaInicio"
                type="date"
                value={filters.fechaInicio}
                onChange={handleChange}
                variant="outlined"
                fullWidth
                InputLabelProps={{
                    shrink: true,
                }}
            />
            <TextField
                label="Fecha Fin"
                name="fechaFin"
                type="date"
                value={filters.fechaFin}
                onChange={handleChange}
                variant="outlined"
                fullWidth
                InputLabelProps={{
                    shrink: true,
                }}
            />

        </FiltersContainer>
    );
};

export default Filters;
