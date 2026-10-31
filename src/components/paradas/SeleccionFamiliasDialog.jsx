// src/components/paradas/SeleccionFamiliasDialog.jsx
// Selector liviano (GET /familias): filtro Activas/Inactivas/Todas del lado del cliente; la
// selección se conserva al cambiar el filtro. "Seleccionar todas" marca las que muestra el filtro.
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText, MenuItem, TextField, Typography,
} from '@mui/material';
import paradasService, { mensajeError } from '../../services/paradasService';
import { sinTildes as normalizar } from './paradasModel';

const FILTRO = { activas: f => f.activa, inactivas: f => !f.activa, todas: () => true };

export default function SeleccionFamiliasDialog({
    open, schoolId, titulo, descripcion, textoConfirmar, excluirIds = [], permitirTodasDelFiltro = false,
    accionesExtra = null, onConfirmar, onCancelar,
}) {
    const [familias, setFamilias] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [estado, setEstado] = useState('activas');
    const [busqueda, setBusqueda] = useState('');
    const [seleccion, setSeleccion] = useState(() => new Set());
    const [todasDelFiltro, setTodasDelFiltro] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCargando(true); setError(null); setSeleccion(new Set()); setTodasDelFiltro(false); setBusqueda(''); setEstado('activas');
        paradasService.familias(schoolId)
            .then(r => setFamilias(r.familias))
            .catch(e => setError(mensajeError(e, 'No se pudieron cargar las familias')))
            .finally(() => setCargando(false));
    }, [open, schoolId]);

    const excluir = useMemo(() => new Set(excluirIds), [excluirIds]);
    const disponibles = useMemo(() => familias.filter(f => !excluir.has(f.familyDetailId)), [familias, excluir]);
    const visibles = useMemo(() => {
        const q = normalizar(busqueda.trim());
        return disponibles.filter(FILTRO[estado]).filter(f => !q || normalizar(f.familyLastName).includes(q));
    }, [disponibles, estado, busqueda]);

    const porId = useMemo(() => new Map(familias.map(f => [f.familyDetailId, f])), [familias]);
    const estudiantes = [...seleccion].reduce((n, id) => n + (porId.get(id)?.numEstudiantes || 0), 0);

    const alternar = (id) => {
        setTodasDelFiltro(false);
        setSeleccion((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };
    const seleccionarVisibles = () => {
        setSeleccion(new Set(visibles.map(f => f.familyDetailId)));
        setTodasDelFiltro(permitirTodasDelFiltro && !busqueda.trim());
    };

    return (
        <Dialog open={open} onClose={onCancelar} maxWidth="sm" fullWidth>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogContent dividers>
                {descripcion && <Typography variant="body2" sx={{ mb: 2 }}>{descripcion}</Typography>}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <TextField size="small" select label="Estado" value={estado} onChange={e => setEstado(e.target.value)} sx={{ minWidth: 140 }}>
                        <MenuItem value="activas">Activas</MenuItem>
                        <MenuItem value="inactivas">Inactivas</MenuItem>
                        <MenuItem value="todas">Todas</MenuItem>
                    </TextField>
                    <TextField size="small" label="Buscar por apellido" value={busqueda} onChange={e => setBusqueda(e.target.value)} sx={{ flex: 1 }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Button size="small" onClick={seleccionarVisibles} disabled={!visibles.length}>Seleccionar todas las que se muestran ({visibles.length})</Button>
                    <Button size="small" onClick={() => { setSeleccion(new Set()); setTodasDelFiltro(false); }} disabled={!seleccion.size}>Quitar selección</Button>
                </Box>
                {cargando ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box> : (
                    <List dense sx={{ maxHeight: 360, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        {visibles.map(f => (
                            <ListItem key={f.familyDetailId} disablePadding>
                                <ListItemButton onClick={() => alternar(f.familyDetailId)}>
                                    <ListItemIcon><Checkbox edge="start" checked={seleccion.has(f.familyDetailId)} tabIndex={-1} disableRipple /></ListItemIcon>
                                    <ListItemText primary={`Familia ${f.familyLastName}`} secondary={`${f.numEstudiantes} estudiante(s)${f.activa ? '' : ' · inactiva'}`} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                        {!visibles.length && <ListItem><ListItemText secondary="No hay familias con este filtro." /></ListItem>}
                    </List>
                )}
                <Typography variant="body2" sx={{ mt: 1 }}><strong>{seleccion.size}</strong> familia(s), <strong>{estudiantes}</strong> estudiante(s) seleccionados.</Typography>
            </DialogContent>
            <DialogActions>
                {accionesExtra}
                <Box sx={{ flex: 1 }} />
                <Button onClick={onCancelar}>Cancelar</Button>
                <Button variant="contained" disabled={!seleccion.size} onClick={() => onConfirmar({ familyIds: [...seleccion], todasDelFiltro, estado })}>
                    {textoConfirmar}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
