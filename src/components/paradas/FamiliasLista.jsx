// src/components/paradas/FamiliasLista.jsx
// Familias paginadas con la paginación común, colapsadas; solo la expandida dibuja controles (rinde con 500+).
import React, { useEffect, useMemo, useState } from 'react';
import { Box, MenuItem, TextField, Typography } from '@mui/material';
import { revisarFamilia, sinTildes as normalizar } from './paradasModel';
import FamiliaCard from './FamiliaCard';
import useTableState from '../../hooks/useTableState';
import AppTablePagination from '../table/AppTablePagination';
import SearchInput from '../form/SearchInput';

const FILTROS = [
    { valor: 'todas', texto: 'Todas las familias' },
    { valor: 'errores', texto: 'Con errores o incompletas' },
    { valor: 'modificadas', texto: 'Modificadas' },
    { valor: 'conflicto', texto: 'Con conflicto' },
    { valor: 'excel', texto: 'Editados en Excel' },
];

export default function FamiliasLista({ familias, contexto, soloLectura, despachar, onQuitarFamilia }) {
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState('todas');
    const tabla = useTableState();
    const { resetPage } = tabla;
    const [expandida, setExpandida] = useState(null);

    const filtradas = useMemo(() => {
        const q = normalizar(busqueda.trim());
        return familias.filter((f) => {
            if (q && !normalizar(f.familyLastName).includes(q) && !f.students.some(s => normalizar(s.fullName).includes(q))) {
                return false;
            }
            const r = revisarFamilia(f, contexto);
            switch (filtro) {
            case 'errores': return r.conErrores > 0 || r.incompletas > 0;
            case 'modificadas': return r.modificados > 0;
            case 'conflicto': return r.conflictos > 0;
            case 'excel': return r.editadosExcel > 0;
            default: return true;
            }
        });
    }, [familias, contexto, busqueda, filtro]);

    useEffect(() => { resetPage(); }, [busqueda, filtro, resetPage]);
    const visibles = tabla.paginate(filtradas);

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <SearchInput label="Buscar por apellido o estudiante" value={busqueda} onChange={setBusqueda} sx={{ flex: 1, minWidth: 240 }} />
                <TextField size="small" select label="Mostrar" value={filtro} onChange={e => setFiltro(e.target.value)} sx={{ minWidth: 240 }}>
                    {FILTROS.map(f => <MenuItem key={f.valor} value={f.valor}>{f.texto}</MenuItem>)}
                </TextField>
            </Box>
            {!visibles.length && <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No hay familias con este filtro.</Typography>}
            {visibles.map(f => (
                <FamiliaCard
                    key={f.familyDetailId} familia={f} contexto={contexto} expandida={expandida === f.familyDetailId}
                    soloLectura={soloLectura} onExpandir={setExpandida} despachar={despachar} onQuitarFamilia={onQuitarFamilia}
                />
            ))}
            <AppTablePagination count={filtradas.length} {...tabla.paginationProps} />
        </Box>
    );
}
