// src/pages/RouteHistoryPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    TextField,
    Autocomplete,
    InputAdornment,
    Button,
    FormControlLabel,
    Checkbox,
    Collapse,
    Chip,
    Card,
    CardContent,
    Divider,
    CircularProgress,
    Pagination,
    Alert,
    Popover,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    IconButton,
    Tooltip,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import {
    DirectionsBus,
    Person,
    AccessTime,
    Speed,
    Warning,
    CheckCircle,
    CalendarToday,
    School as SchoolIcon,
    Search as SearchIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
// RouteIcon removed; using a simple numeral adornment for route number filter
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import { useSearchParams } from 'react-router-dom';

const RouteHistoryPage = () => {
    const { auth } = useContext(AuthContext);
    const [searchParams] = useSearchParams();

    const initialRouteNumber = searchParams.get('routeNumber') || '';
    const initialClientId = searchParams.get('clientId') || null;

    const [loading, setLoading] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [total, setTotal] = useState(0);

    // filtros
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pilotoFilter, setPilotoFilter] = useState('');
    const [busFilter, setBusFilter] = useState('');
    const [onlyFailures, setOnlyFailures] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [startHour, setStartHour] = useState('');
    const [endHour, setEndHour] = useState('');
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientTouched, setClientTouched] = useState(false);
    const [availablePilots, setAvailablePilots] = useState([]);
    const [pilotSelected, setPilotSelected] = useState(null);
    const [availableBuses, setAvailableBuses] = useState([]);
    const [busSelected, setBusSelected] = useState(null);
    const [availableRoutesList, setAvailableRoutesList] = useState([]);
    const [routeSelected, setRouteSelected] = useState(null);
    const [loadingRoutes, setLoadingRoutes] = useState(false);
    const routesCacheRef = React.useRef(new Map());
    const [pilotInput, setPilotInput] = useState('');
    const [busInput, setBusInput] = useState('');
    const [loadingPilots, setLoadingPilots] = useState(false);
    const [loadingBuses, setLoadingBuses] = useState(false);
    const pilotsCacheRef = React.useRef(new Map());
    const busesCacheRef = React.useRef(new Map());
    const pilotTimerRef = React.useRef(null);
    const busTimerRef = React.useRef(null);
    const [initialFetchDone, setInitialFetchDone] = useState(false);
    const [dateAnchorEl, setDateAnchorEl] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [routeNumber, setRouteNumber] = useState(initialRouteNumber);
    const [clientId, setClientId] = useState(initialClientId);

    const fetchRouteHistory = async (opts = {}) => {
        setLoading(true);
        setError(null);
        try {
            const selectedClientId = (selectedClient && (selectedClient.id || selectedClient.value || selectedClient._id)) || clientId || null;
            const selectedClientType = selectedClient?.type || null;

            // Require a selected client (or clientId param) before fetching
            if (!selectedClientId) {
                setLoading(false);
                setError('Seleccione un cliente antes de aplicar los filtros.');
                return;
            }

            const clientParam = {};
            if (selectedClientType === 'school') {
                clientParam.schoolId = selectedClientId;
            } else if (selectedClientType === 'corporation') {
                clientParam.corporationId = selectedClientId;
            } else {
                clientParam.schoolId = selectedClientId;
            }

            const params = {
                ...clientParam,
                routeNumber: routeNumber,
                page,
                pageSize,
                ...opts
            };

            const response = await api.get('/transportistas/historial-rutas', {
                headers: { Authorization: `Bearer ${auth.token}` },
                params
            });

            setRoutes(response.data.routes || []);
            setTotal(response.data.total || 0);
            setInitialFetchDone(true);
        } catch (err) {
            console.error('Error fetching route history (page):', err);
            const serverMessage = err?.response?.data?.message || err?.response?.data || err?.response?.statusText;
            const status = err?.response?.status;
            if (status || serverMessage) {
                setError(`Error ${status || ''}${serverMessage ? ` - ${serverMessage}` : ''}`);
            } else {
                setError(err.message || 'No se pudo cargar el historial de rutas');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialFetchDone && (selectedClient || clientId)) {
            setPage(1);
            fetchRouteHistory({ page: 1 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClient, clientId]);

    useEffect(() => {
        // load clients when mounted
                const loadClients = async () => {
                    try {
                        const [schoolsResp, corpsResp] = await Promise.all([
                            api.get('/schools', { headers: { Authorization: `Bearer ${auth.token}` } }),
                            api.get('/corporations', { headers: { Authorization: `Bearer ${auth.token}` } })
                        ]);

                        const schoolsList = schoolsResp.data?.schools || schoolsResp.data || [];
                        const corpsList = corpsResp.data?.corporations || corpsResp.data || [];

                        // Build grouped options: Colegios, Corporaciones (no 'Todos' ni 'Sin afiliación')
                        const combined = [];
                        const pushIfValid = (item, type) => {
                            if (!item) return;
                            if (item.deleted) return;
                            const id = item.id || item._id || item.value || item.uuid || item.name;
                            const name = item.name || item.nombre || item.label || String(id);
                            const group = type === 'school' ? 'Colegios' : 'Corporaciones';
                            combined.push({ id, name, _raw: item, type, group });
                        };

                        (Array.isArray(schoolsList) ? schoolsList : []).forEach((s) => pushIfValid(s, 'school'));
                        (Array.isArray(corpsList) ? corpsList : []).forEach((c) => pushIfValid(c, 'corporation'));

                        setClients(combined);

                        // select default: if clientId provided try to find it, otherwise default to first client
                        const found = clientId ? combined.find(s => String(s.id) === String(clientId)) : null;
                        setSelectedClient(found || (combined.length > 0 ? combined[0] : null));
                    } catch (err) {
                        console.error('No se pudieron cargar los clientes (page):', err);
                    }
                };
        loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced server-side search for pilots
    useEffect(() => {
        if (!selectedClient) {
            setAvailablePilots([]);
            return;
        }

        // clear previous timer
        if (pilotTimerRef.current) clearTimeout(pilotTimerRef.current);

        // require at least 2 chars to search
        if (!pilotInput || pilotInput.length < 2) {
            setAvailablePilots([]);
            return;
        }

        const cacheKey = `${selectedClient.type}:${selectedClient.id}:` + pilotInput;
        if (pilotsCacheRef.current.has(cacheKey)) {
            setAvailablePilots(pilotsCacheRef.current.get(cacheKey));
            return;
        }

        pilotTimerRef.current = setTimeout(async () => {
            setLoadingPilots(true);
            try {
                let url = `/users/pilots?query=${encodeURIComponent(pilotInput)}`;
                if (selectedClient.type === 'school') url += `&schoolId=${selectedClient.id}`;
                if (selectedClient.type === 'corporation') url += `&corporationId=${selectedClient.id}`;
                const resp = await api.get(url, { headers: { Authorization: `Bearer ${auth.token}` } });
                const pilots = Array.isArray(resp.data?.users) ? resp.data.users : (resp.data || []);
                const pilotsOpts = pilots.map(p => ({ id: p.id || p._id, name: p.name || p.fullName || p.nombre }));
                pilotsCacheRef.current.set(cacheKey, pilotsOpts);
                setAvailablePilots(pilotsOpts);
            } catch (err) {
                console.error('Error searching pilots:', err);
                setAvailablePilots([]);
            } finally {
                setLoadingPilots(false);
            }
        }, 300);

        return () => { if (pilotTimerRef.current) clearTimeout(pilotTimerRef.current); };
    }, [pilotInput, selectedClient, auth.token]);

    // Debounced server-side search for buses
    useEffect(() => {
        if (!selectedClient) {
            setAvailableBuses([]);
            return;
        }

        if (busTimerRef.current) clearTimeout(busTimerRef.current);

        if (!busInput || busInput.length < 2) {
            setAvailableBuses([]);
            return;
        }

        const cacheKey = `${selectedClient.type}:${selectedClient.id}:` + busInput;
        if (busesCacheRef.current.has(cacheKey)) {
            setAvailableBuses(busesCacheRef.current.get(cacheKey));
            return;
        }

        busTimerRef.current = setTimeout(async () => {
            setLoadingBuses(true);
            try {
                let url = `/buses?query=${encodeURIComponent(busInput)}`;
                if (selectedClient.type === 'school') url += `&schoolId=${selectedClient.id}`;
                if (selectedClient.type === 'corporation') url += `&corporationId=${selectedClient.id}`;
                const resp = await api.get(url, { headers: { Authorization: `Bearer ${auth.token}` } });
                const busesList = resp.data?.buses || resp.data || [];
                const busesOpts = (Array.isArray(busesList) ? busesList : []).map(b => ({ id: b.id || b._id, placa: b.placa || b.plate || b.licensePlate }));
                busesCacheRef.current.set(cacheKey, busesOpts);
                setAvailableBuses(busesOpts);
            } catch (err) {
                console.error('Error searching buses:', err);
                setAvailableBuses([]);
            } finally {
                setLoadingBuses(false);
            }
        }, 300);

        return () => { if (busTimerRef.current) clearTimeout(busTimerRef.current); };
    }, [busInput, selectedClient, auth.token]);

    // Load route numbers for selected client (no debounce; small payload)
    useEffect(() => {
        if (!selectedClient) {
            setAvailableRoutesList([]);
            return;
        }

        const cacheKey = `${selectedClient.type}:${selectedClient.id}`;
        if (routesCacheRef.current.has(cacheKey)) {
            setAvailableRoutesList(routesCacheRef.current.get(cacheKey));
            return;
        }

        const loadRoutes = async () => {
            setLoadingRoutes(true);
            try {
                let url = '';
                if (selectedClient.type === 'school') {
                    url = `/routes/school/${selectedClient.id}/numbers`;
                } else if (selectedClient.type === 'corporation') {
                    url = `/routes/corporation/${selectedClient.id}/numbers`;
                } else {
                    // fallback: try school endpoint
                    url = `/routes/school/${selectedClient.id}/numbers`;
                }

                const resp = await api.get(url, { headers: { Authorization: `Bearer ${auth.token}` } });
                const nums = resp.data?.routeNumbers || resp.data?.routes || resp.data || [];
                // Normalize to objects { number }
                const opts = (Array.isArray(nums) ? nums : []).map(n => (typeof n === 'object' ? ({ number: n.routeNumber || n.routeNumber || n.routeNumber }) : ({ number: String(n) })));
                routesCacheRef.current.set(cacheKey, opts);
                setAvailableRoutesList(opts);
            } catch (err) {
                console.error('Error loading route numbers:', err);
                setAvailableRoutesList([]);
            } finally {
                setLoadingRoutes(false);
            }
        };

        loadRoutes();
    }, [selectedClient, auth.token]);

    const formatTime = (dateTime) => {
        if (!dateTime) return 'N/A';
        const date = new Date(dateTime);
        return date.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return 'En progreso';
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        return `${diffHrs}h ${diffMins}m`;
    };

    const contentMinHeight = 320;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Box sx={{ p: 4, backgroundColor: 'background.default', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DirectionsBus />
                    <Typography variant="h5">Historial de Recorridos de Rutas</Typography>
                </Box>
            </Box>

            {/* Placeholder para estadísticas */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
                <Typography variant="h6">Estadísticas</Typography>
                <Typography variant="body2" color="textSecondary">(Sección reservada — Actualmente en desarrollo)</Typography>
            </Paper>

            {/* Historial: transferido desde RouteHistoryModal */}
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
                        <Autocomplete
                            size="small"
                            options={clients}
                            groupBy={(option) => option.group || ''}
                            getOptionLabel={(opt) => opt ? (opt.name || opt.nombre || opt.label || String(opt.id || opt.value || opt._id)) : ''}
                            value={selectedClient}
                            onChange={(e, newVal) => { setSelectedClient(newVal); setClientTouched(true); }}
                            isOptionEqualToValue={(option, value) => {
                                if (!value) return false;
                                return String(option.id) === String(value.id) && option.type === value.type;
                            }}
                            renderInput={(params) => (
                                <TextField {...params} label="Cliente (Todos/Colegios/Corporaciones)" variant="outlined" InputProps={{ ...params.InputProps, startAdornment: (<InputAdornment position="start"><SchoolIcon fontSize="small" color="action"/></InputAdornment>) }} sx={ clientTouched ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                            )}
                            renderOption={(props, option) => (
                                <li {...props} key={`${option.type}-${option.id || option.value || option._id}`}>
                                    {option.name || option.nombre || option.label}
                                </li>
                            )}
                                autoHighlight
                                selectOnFocus
                                clearOnEscape
                        />
                    </Grid>

                        <Grid item xs={12} md={3}>
                        <TextField size="small" variant="outlined" label="Estado" select fullWidth InputLabelProps={{ shrink: true }} SelectProps={{ native: true }} value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} sx={ statusFilter ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} }>
                            <option value="">Todos</option>
                            <option value="inprogress">En progreso</option>
                            <option value="completed">Completado</option>
                        </TextField>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <TextField
                            size="small"
                            variant="outlined"
                            label="Rango de fechas"
                            fullWidth
                            value={startDate && endDate ? `${startDate} — ${endDate}` : (startDate ? `${startDate} —` : (endDate ? `— ${endDate}` : ''))}
                            onClick={(e) => setDateAnchorEl(e.currentTarget)}
                            InputProps={{ readOnly: true, startAdornment: (<InputAdornment position="start"><CalendarToday fontSize="small" color="action"/></InputAdornment>) }}
                            sx={ (startDate || endDate) ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} }
                        />
                        <Popover
                            open={Boolean(dateAnchorEl)}
                            anchorEl={dateAnchorEl}
                            onClose={() => setDateAnchorEl(null)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                            <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center', minWidth: 360 }}>
                                <TextField
                                    size="small"
                                    label="Fecha inicio"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1 }}
                                />
                                <TextField
                                    size="small"
                                    label="Fecha fin"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1 }}
                                />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                                <Button size="small" onClick={() => { setStartDate(''); setEndDate(''); setDateAnchorEl(null); setPage(1); }}>Limpiar</Button>
                                <Button size="small" variant="contained" onClick={() => { setDateAnchorEl(null); setPage(1); }} sx={{ ml: 1 }}>Aplicar</Button>
                            </Box>
                        </Popover>
                    </Grid>

                    <Grid item xs={12} md={1}>
                        <FormControlLabel
                            control={<Checkbox checked={onlyFailures} onChange={(e)=>setOnlyFailures(e.target.checked)} />}
                            label="Solo fallas"
                            sx={{ '& .MuiFormControlLabel-label': { whiteSpace: 'nowrap' } }}
                        />
                    </Grid>

                    <Grid item xs={12} md={12}>
                        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2 }}>
                            <Box>
                                <Button size="small" startIcon={<ExpandMoreIcon sx={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }} />} onClick={()=>setShowAdvanced(s=>!s)}>MÁS FILTROS</Button>
                            </Box>
                            <Box sx={{ display:'flex', gap:1 }}>
                                        <Button size="small" variant="outlined" color="inherit" startIcon={<ClearIcon />} onClick={() => { setStartDate(''); setEndDate(''); setPilotoFilter(''); setBusFilter(''); setPilotSelected(null); setBusSelected(null); setRouteNumber(''); setRouteSelected(null); /* preserve selectedClient for comparison */ setOnlyFailures(false); setStatusFilter(''); setStartHour(''); setEndHour(''); setPage(1); }}>LIMPIAR</Button>
                                <Button size="small" variant="contained" color="primary" startIcon={<SearchIcon />} onClick={() => { setPage(1); fetchRouteHistory({ startDate: startDate||undefined, endDate: endDate||undefined, pilotoName: pilotoFilter||undefined, busPlaca: busFilter||undefined, onlyFailures: onlyFailures?'1':undefined, status: statusFilter||undefined, startHour: startHour||undefined, endHour: endHour||undefined, page: 1 }); }}>APLICAR FILTROS</Button>
                            </Box>
                        </Box>
                    </Grid>

                            
                    

                    <Grid item xs={12}>
                        <Collapse in={showAdvanced} timeout="auto" unmountOnExit>
                            <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={6} md={2}>
                                    <Autocomplete
                                        size="small"
                                        options={availablePilots}
                                        getOptionLabel={(opt) => opt ? (opt.name || '') : ''}
                                        value={pilotSelected}
                                        inputValue={pilotInput}
                                        onInputChange={(e, v) => setPilotInput(v)}
                                        onChange={(e, newVal) => { setPilotSelected(newVal); setPilotoFilter(newVal ? newVal.name : ''); }}
                                        loading={loadingPilots}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Piloto" placeholder="Nombre piloto" fullWidth InputProps={{ ...params.InputProps, startAdornment:(<InputAdornment position="start"><Person fontSize="small" color="action"/></InputAdornment>), endAdornment: (loadingPilots ? <CircularProgress color="inherit" size={16} /> : params.InputProps.endAdornment) }} sx={ pilotoFilter ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>
                                        <Grid item xs={12} sm={6} md={2}>
                                    <Autocomplete
                                        size="small"
                                        options={availableRoutesList}
                                        getOptionLabel={(opt) => opt ? (opt.number || String(opt)) : ''}
                                        value={routeSelected}
                                        onChange={(e, newVal) => { setRouteSelected(newVal); setRouteNumber(newVal ? (newVal.number || String(newVal)) : ''); }}
                                        loading={loadingRoutes}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Número de ruta" placeholder="Número de ruta" fullWidth InputProps={{ ...params.InputProps, startAdornment: (<InputAdornment position="start"><Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>#</Box></InputAdornment>), endAdornment: (loadingRoutes ? <CircularProgress color="inherit" size={16} /> : params.InputProps.endAdornment) }} sx={ routeNumber ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    <Autocomplete
                                        size="small"
                                        options={availableBuses}
                                        getOptionLabel={(opt) => opt ? (opt.placa || '') : ''}
                                        value={busSelected}
                                        inputValue={busInput}
                                        onInputChange={(e, v) => setBusInput(v)}
                                        onChange={(e, newVal) => { setBusSelected(newVal); setBusFilter(newVal ? newVal.placa : ''); }}
                                        loading={loadingBuses}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Bus (Placa)" placeholder="Placa" fullWidth InputProps={{ ...params.InputProps, startAdornment:(<InputAdornment position="start"><DirectionsBus fontSize="small" color="action"/></InputAdornment>), endAdornment: (loadingBuses ? <CircularProgress color="inherit" size={16} /> : params.InputProps.endAdornment) }} sx={ busFilter ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                        )}
                                        clearOnEscape
                                        autoHighlight
                                        selectOnFocus
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField size="small" label="Hora inicio" type="time" fullWidth InputLabelProps={{ shrink:true }} value={startHour} onChange={(e)=>setStartHour(e.target.value)} sx={ startHour ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField size="small" label="Hora fin" type="time" fullWidth InputLabelProps={{ shrink:true }} value={endHour} onChange={(e)=>setEndHour(e.target.value)} sx={ endHour ? { backgroundColor: 'rgba(25,118,210,0.04)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'primary.main', borderWidth: 1 }, '&:hover fieldset': { borderColor: 'primary.dark' } }, boxShadow: '0 0 0 3px rgba(25,118,210,0.06)' } : {} } />
                                </Grid>
                            </Grid>
                        </Collapse>
                    </Grid>

                    <Grid item xs={12}>
                        {/* Content area */}
                        {loading && (!routes || routes.length === 0) ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, minHeight: contentMinHeight }}>
                                <CircularProgress />
                            </Box>
                        ) : error ? (
                            <Alert severity="error" sx={{ mb: 2, minHeight: contentMinHeight }}>{error}</Alert>
                        ) : (!routes || routes.length === 0) ? (
                            <Box sx={{ textAlign: 'center', py: 4, minHeight: contentMinHeight }}>
                                <DirectionsBus sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                                <Typography variant="h6" color="textSecondary">No hay historial de rutas disponible</Typography>
                                <Typography variant="body2" color="textSecondary">Esta ruta aún no ha sido utilizada</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ position: 'relative', minHeight: contentMinHeight }}>
                                {isMobile ? (
                                    <Grid container spacing={2}>
                                        {routes.map((route, index) => (
                                            <Grid item xs={12} key={route.id || index}>
                                                <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: route.reporteFalla ? '4px solid #f44336' : '4px solid #4caf50', transition: 'all 0.3s', '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' } }}>
                                                    <CardContent>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <DirectionsBus color="primary" />
                                                                <Typography variant="h6" fontWeight="bold">{route.placa || 'Sin placa'}</Typography>
                                                            </Box>
                                                            <Chip icon={route.reporteFalla ? <Warning /> : <CheckCircle />} label={route.reporteFalla ? 'Con falla' : 'Sin falla'} color={route.reporteFalla ? 'error' : 'success'} size="small" />
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                            <Typography variant="body2" color="textSecondary">Ruta:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.routeNumber || route.number || '—'}</Typography>
                                                        </Box>

                                                        <Divider sx={{ mb: 2 }} />

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <Person color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Piloto:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.piloto || 'N/A'}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <SchoolIcon color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Cliente:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.colegio || 'N/A'}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <AccessTime color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Hora inicio:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{formatTime(route.startTime)}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <AccessTime color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Hora fin:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.endTime ? formatTime(route.endTime) : 'En progreso'}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                            <AccessTime color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Duración:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{formatDuration(route.startTime, route.endTime)}</Typography>
                                                        </Box>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Speed color="action" fontSize="small" />
                                                            <Typography variant="body2" color="textSecondary">Kilometraje:</Typography>
                                                            <Typography variant="body2" fontWeight="medium">{route.kilometraje ? `${parseFloat(route.kilometraje).toFixed(2)} km` : '0.00 km'}</Typography>
                                                        </Box>

                                                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                                            <Typography variant="caption" color="textSecondary">Registrado el {new Date(route.createdAt).toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })}</Typography>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                ) : (
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Fecha</TableCell>
                                                    <TableCell align="center">Número de ruta</TableCell>
                                                    <TableCell>Placa</TableCell>
                                                    <TableCell>Piloto</TableCell>
                                                    <TableCell>Cliente</TableCell>
                                                    <TableCell>Hora inicio</TableCell>
                                                    <TableCell>Hora fin</TableCell>
                                                    <TableCell>Duración</TableCell>
                                                    <TableCell>Kilometraje</TableCell>
                                                    <TableCell>Estado</TableCell>
                                                    {/* Acciones removidas: vista solo lectura */}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {routes.map((route, idx) => (
                                                    <TableRow key={route.id || idx} hover>
                                                        <TableCell>{new Date(route.createdAt).toLocaleDateString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                                                        <TableCell align="center">{route.routeNumber || route.number || '—'}</TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <DirectionsBus fontSize="small" />
                                                                <Typography variant="body2">{route.placa || 'Sin placa'}</Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>{route.piloto || 'N/A'}</TableCell>
                                                        <TableCell>{route.colegio || 'N/A'}</TableCell>
                                                        <TableCell>{formatTime(route.startTime)}</TableCell>
                                                        <TableCell>{route.endTime ? formatTime(route.endTime) : 'En progreso'}</TableCell>
                                                        <TableCell>{formatDuration(route.startTime, route.endTime)}</TableCell>
                                                        <TableCell>{route.kilometraje ? `${parseFloat(route.kilometraje).toFixed(2)} km` : '0.00 km'}</TableCell>
                                                        <TableCell>
                                                            <Chip icon={route.reporteFalla ? <Warning /> : <CheckCircle />} label={route.reporteFalla ? 'Con falla' : 'Sin falla'} color={route.reporteFalla ? 'error' : 'success'} size="small" />
                                                        </TableCell>
                                                        {/* Acciones removidas: no hay botones en historial */}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}

                                {loading && (
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }}>
                                        <CircularProgress />
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Grid>

                    <Grid item xs={12}>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap' }}>
                            <Box sx={{ width: 56 }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflowX: 'auto' }}>
                                <Pagination count={Math.max(1, Math.ceil((total || 0) / pageSize))} page={page} onChange={(e, p) => { setPage(p); fetchRouteHistory({ startDate: startDate || undefined, endDate: endDate || undefined, pilotoName: pilotoFilter || undefined, busPlaca: busFilter || undefined, onlyFailures: onlyFailures ? '1' : undefined, status: statusFilter || undefined, startHour: startHour || undefined, endHour: endHour || undefined, page: p }); }} color="primary" />
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default RouteHistoryPage;
