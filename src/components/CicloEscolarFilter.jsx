/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import {
    FormControl,
    InputLabel,
    MenuItem,
    Select
} from '@mui/material';
import { getCiclosEscolares, getCicloEscolarOptionLabel } from '../services/cicloEscolarService';

export const ALL_CYCLES_VALUE = 'all';

export const getInitialCicloEscolarFilter = () => localStorage.getItem('selectedCicloEscolarId') || ALL_CYCLES_VALUE;

export const getCicloEscolarFilterParams = (value) => {
    if (!value || value === ALL_CYCLES_VALUE) {
        return { allCycles: true };
    }
    return { cicloEscolarId: value };
};

const CicloEscolarFilter = ({
    value,
    onChange,
    label = 'Ciclo escolar',
    allLabel = 'Todos los ciclos',
    size = 'small',
    fullWidth = true,
    sx,
    allowAll = true,
}) => {
    const [ciclosEscolares, setCiclosEscolares] = useState([]);

    useEffect(() => {
        let mounted = true;

        const fetchCiclosEscolares = async () => {
            try {
                const data = await getCiclosEscolares();
                const ciclos = data?.ciclosEscolares || data?.data || data || [];
                if (mounted) setCiclosEscolares(Array.isArray(ciclos) ? ciclos : []);
            } catch (error) {
                console.error('Error al cargar ciclos escolares:', error);
                if (mounted) setCiclosEscolares([]);
            }
        };

        fetchCiclosEscolares();
        return () => {
            mounted = false;
        };
    }, []);

    // If allowAll is false and current value is ALL or falsy, auto-select first ciclo when loaded
    useEffect(() => {
        if (!allowAll && ciclosEscolares.length > 0) {
            const current = (value || ALL_CYCLES_VALUE);
            if (current === ALL_CYCLES_VALUE || !current) {
                const firstId = String(ciclosEscolares[0].id);
                onChange(firstId);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowAll, ciclosEscolares]);

    return (
        <FormControl fullWidth={fullWidth} size={size} sx={sx}>
            <InputLabel>{label}</InputLabel>
            <Select
                value={value || (allowAll ? ALL_CYCLES_VALUE : (ciclosEscolares[0] ? String(ciclosEscolares[0].id) : ''))}
                label={label}
                onChange={(event) => onChange(event.target.value)}
            >
                {allowAll && <MenuItem value={ALL_CYCLES_VALUE}>{allLabel}</MenuItem>}
                {ciclosEscolares.map((cicloEscolar) => (
                    <MenuItem key={cicloEscolar.id} value={String(cicloEscolar.id)}>
                        {getCicloEscolarOptionLabel(cicloEscolar)}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

export default CicloEscolarFilter;