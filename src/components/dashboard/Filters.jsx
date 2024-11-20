// src/components/dashboard/Filters.jsx

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import tw from 'twin.macro';
import styled from 'styled-components';

// Contenedor de los filtros con mayor espacio
const FiltersContainer = styled.div`
    ${tw`flex flex-wrap space-x-4 space-y-2 md:space-y-0`}
`;

// Ajuste de los FormControl para mayor ancho
const StyledFormControl = styled(FormControl)`
    ${tw`min-w-[200px]`}
`;

const Filters = ({ filters, setFilters }) => {
    const handleFilterChange = (name, value) => {
        setFilters({
            ...filters,
            [name]: value,
        });
    };

    return (
        <FiltersContainer>
            {/* Filtro de Colegio */}
            <StyledFormControl variant="outlined" size="small">
                <InputLabel>Colegio</InputLabel>
                <Select
                    value={filters.colegio}
                    onChange={(e) => handleFilterChange('colegio', e.target.value)}
                    label="Colegio"
                >
                    <MenuItem value="">
                        <em>Todos</em>
                    </MenuItem>
                    <MenuItem value="Colegio A">Colegio A</MenuItem>
                    <MenuItem value="Colegio B">Colegio B</MenuItem>
                    {/* Añade más opciones según sea necesario */}
                </Select>
            </StyledFormControl>

            {/* Filtro de Ruta */}
            <StyledFormControl variant="outlined" size="small">
                <InputLabel>Ruta</InputLabel>
                <Select
                    value={filters.ruta}
                    onChange={(e) => handleFilterChange('ruta', e.target.value)}
                    label="Ruta"
                >
                    <MenuItem value="">
                        <em>Todas</em>
                    </MenuItem>
                    <MenuItem value="Ruta 1">Ruta 1</MenuItem>
                    <MenuItem value="Ruta 2">Ruta 2</MenuItem>
                    {/* Añade más opciones según sea necesario */}
                </Select>
            </StyledFormControl>

            {/* Filtro de Mes */}
            <StyledFormControl variant="outlined" size="small">
                <InputLabel>Mes</InputLabel>
                <Select
                    value={filters.mes}
                    onChange={(e) => handleFilterChange('mes', e.target.value)}
                    label="Mes"
                >
                    <MenuItem value="">
                        <em>Todos</em>
                    </MenuItem>
                    <MenuItem value="Enero">Enero</MenuItem>
                    <MenuItem value="Febrero">Febrero</MenuItem>
                    {/* Añade más opciones según sea necesario */}
                </Select>
            </StyledFormControl>

            {/* Filtro de Fecha Inicio */}
            <StyledFormControl variant="outlined" size="small">
                <TextField
                    label="Fecha Inicio"
                    type="date"
                    InputLabelProps={{
                        shrink: true,
                    }}
                    value={filters.fechaInicio}
                    onChange={(e) => handleFilterChange('fechaInicio', e.target.value)}
                />
            </StyledFormControl>

            {/* Filtro de Fecha Fin */}
            <StyledFormControl variant="outlined" size="small">
                <TextField
                    label="Fecha Fin"
                    type="date"
                    InputLabelProps={{
                        shrink: true,
                    }}
                    value={filters.fechaFin}
                    onChange={(e) => handleFilterChange('fechaFin', e.target.value)}
                />
            </StyledFormControl>
        </FiltersContainer>
    );
};

export default Filters;
