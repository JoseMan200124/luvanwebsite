// src/components/paradas/FamiliasLista.jsx
// 25 familias por página, colapsadas; solo la expandida dibuja controles (rinde con 500+).
import React, { useEffect, useMemo, useState } from 'react';
import { Box, MenuItem, TablePagination, TextField, Typography } from '@mui/material';
import { revisarFamilia, sinTildes as normalizar } from './paradasModel';
import FamiliaCard from './FamiliaCard';

const POR_PAGINA = 25;

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
    const [pagina, setPagina] = useState(0);
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

    useEffect(() => { setPagina(0); }, [busqueda, filtro]);
    const visibles = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <TextField size="small" label="Buscar por apellido o estudiante" value={busqueda} onChange={e => setBusqueda(e.target.value)} sx={{ flex: 1, minWidth: 240 }} />
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
            <TablePagination
                component="div" count={filtradas.length} page={pagina} rowsPerPage={POR_PAGINA} rowsPerPageOptions={[POR_PAGINA]}
                onPageChange={(_, p) => setPagina(p)}
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count} familias`}
            />
        </Box>
    );
}
