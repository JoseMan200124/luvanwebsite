// src/components/modals/RouteHistoryModal.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Chip,
    Divider,
    CircularProgress,
    Alert,
    TextField,
    Autocomplete,
    Popover,
    FormControlLabel,
    Checkbox,
    Paper,
    InputAdornment,
    Pagination,
    } from '@mui/material';
import Collapse from '@mui/material/Collapse';
import {
    DirectionsBus,
    Person,
    AccessTime,
    Speed,
    Warning,
    CheckCircle,
    Close,
    CalendarToday,
    School as SchoolIcon,
    Search as SearchIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AuthContext } from '../../context/AuthProvider';
import api from '../../utils/axiosConfig';


const RouteHistoryModal = ({ open, onClose, routeNumber, clientId }) => {
    const { auth } = useContext(AuthContext);
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
    const [statusFilter, setStatusFilter] = useState(''); // '', 'inprogress', 'completed'
    const [startHour, setStartHour] = useState('');
    const [endHour, setEndHour] = useState('');
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [initialFetchDone, setInitialFetchDone] = useState(false);
    const [dateAnchorEl, setDateAnchorEl] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const fetchRouteHistory = async (opts = {}) => {
        setLoading(true);
        setError(null);
        try {
            const selectedClientId = (selectedClient && (selectedClient.id || selectedClient.value || selectedClient._id)) || clientId || null;
            const selectedClientType = selectedClient?.type || null;
            
            // Require a selected client (or prop clientId) before fetching to avoid global queries
            if (!selectedClientId) {
                setLoading(false);
                setError('Seleccione un cliente antes de aplicar los filtros.');
                return;
            }
            
            // Build params based on client type
            const clientParam = {};
            if (selectedClientType === 'school') {
                clientParam.schoolId = selectedClientId;
            } else if (selectedClientType === 'corporation') {
                clientParam.corporationId = selectedClientId;
            } else {
                // Fallback: if type is unknown, use schoolId (backward compatibility)
                clientParam.schoolId = selectedClientId;
            }
            
            const params = {
                ...clientParam,
                routeNumber: routeNumber,
                page,
                pageSize,
                ...opts
            };
            console.debug('[RouteHistoryModal] fetching with params:', params);
            const response = await api.get('/transportistas/historial-rutas', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params
            });
            setRoutes(response.data.routes || []);
            setTotal(response.data.total || 0);
            // mark that we've performed a fetch (either initial or via Apply) so pagination can request pages
            setInitialFetchDone(true);
        } catch (err) {
            console.error('Error fetching route history:', err);
            // Try to surface a useful error message from server
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
        if (!open) return;
    // Do not auto-apply filters on open; fetching must be triggered by the user pressing "APLICAR FILTROS"
    }, [open, routeNumber, clientId]);

    // When clients are loaded and a default client is selected, perform a single initial fetch
    useEffect(() => {
        if (!open) return;
        if (initialFetchDone) return;
        if (!selectedClient && !clientId) return;
        // Do one initial fetch for the default selected client
        setInitialFetchDone(true);
        setPage(1);
        fetchRouteHistory({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClient, open, clientId, initialFetchDone]);

    // Reset initialFetchDone when modal closes
    useEffect(() => {
        if (!open) {
            setInitialFetchDone(false);
            setRoutes([]);
            setTotal(0);
            setError(null);
        }
    }, [open]);

    // Cargar lista de colegios cuando se abre el modal
    useEffect(() => {
        if (!open) return;
        const loadClients = async () => {
            try {
                // Fetch schools and corporations in parallel
                const [schoolsResp, corpsResp] = await Promise.all([
                    api.get('/schools', { headers: { Authorization: `Bearer ${auth.token}` } }),
                    api.get('/corporations', { headers: { Authorization: `Bearer ${auth.token}` } })
                ]);

                const schoolsList = schoolsResp.data?.schools || schoolsResp.data || [];
                const corpsList = corpsResp.data?.corporations || corpsResp.data || [];

                // Normalize and combine, excluding deleted entries
                const combined = [];
                const pushIfValid = (item, type) => {
                    if (!item) return;
                    if (item.deleted) return;
                    const id = item.id || item._id || item.value || item.uuid || item.name;
                    const name = item.name || item.nombre || item.label || String(id);
                    combined.push({ id, name, _raw: item, type });
                };

                (Array.isArray(schoolsList) ? schoolsList : []).forEach((s) => pushIfValid(s, 'school'));
                (Array.isArray(corpsList) ? corpsList : []).forEach((c) => pushIfValid(c, 'corporation'));

                setClients(combined);

                // If clientId is provided as a prop, try to find matching client
                // Note: clientId alone can't distinguish school vs corporation, so we just pick first match by id
                const found = clientId ? combined.find(s => String(s.id) === String(clientId)) : null;
                setSelectedClient(found || (combined.length > 0 ? combined[0] : null));
            } catch (err) {
                console.error('No se pudieron cargar los clientes:', err);
            }
        };
        loadClients();
    }, [open, auth.token, clientId]);

    const formatTime = (dateTime) => {
        if (!dateTime) return 'N/A';
        const date = new Date(dateTime);
        return date.toLocaleTimeString('es-GT', {
            hour: '2-digit',
            minute: '2-digit'
        });
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

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2, maxHeight: '90vh' }
            }}
        >
            <DialogTitle sx={{ 
                backgroundColor: 'primary.main', 
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DirectionsBus />
                    <Typography variant="h6">
                        Historial de Ruta {routeNumber}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>{`Cargados ${total} registros`}</Typography>
                    <Button 
                        onClick={onClose}
                        sx={{ color: 'white', minWidth: 'auto' }}
                    >
                        <Close />
                    </Button>
                </Box>
            </DialogTitle>
            
            <DialogContent sx={{ mt: 2 }}>
                {/* Controles de filtrado: primary row visible + advanced collapse */}
                <Box sx={{ mb: 2 }}>
                    <Paper elevation={1} sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.paper' }}>
                        <Grid container spacing={2} alignItems="center">
                            {/* Primary inputs row */}
                            <Grid item xs={12} md={3}>
                                <Autocomplete
                                        size="small"
                                        options={clients}
                                        getOptionLabel={(opt) => opt ? (opt.name || opt.nombre || opt.label || String(opt.id || opt.value || opt._id)) : ''}
                                        value={selectedClient}
                                        onChange={(e, newVal) => setSelectedClient(newVal)}
                                        isOptionEqualToValue={(option, value) => {
                                            if (!value) return false;
                                            return String(option.id) === String(value.id) && option.type === value.type;
                                        }}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Cliente" variant="outlined" InputProps={{ ...params.InputProps, startAdornment: (<InputAdornment position="start"><SchoolIcon fontSize="small" color="action"/></InputAdornment>) }} />
                                        )}
                                        renderOption={(props, option) => (
                                            <li {...props} key={`${option.type}-${option.id || option.value || option._id}`}>
                                                {option.name || option.nombre || option.label}
                                            </li>
                                        )}
                                        clearOnEscape
                                    />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField size="small" variant="outlined" label="Estado" select fullWidth InputLabelProps={{ shrink: true }} SelectProps={{ native: true }} value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
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
                                <FormControlLabel control={<Checkbox checked={onlyFailures} onChange={(e)=>setOnlyFailures(e.target.checked)} />} label="Solo fallas" />
                            </Grid>

                            {/* Actions & toggle row */}
                            <Grid item xs={12} md={12}>
                                        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2 }}>
                                    <Box>
                                        <Button size="small" startIcon={<ExpandMoreIcon sx={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }} />} onClick={()=>setShowAdvanced(s=>!s)}>MÁS FILTROS</Button>
                                    </Box>
                                    <Box sx={{ display:'flex', gap:1 }}>
                                        <Button size="small" variant="outlined" color="inherit" startIcon={<ClearIcon />} onClick={() => { setStartDate(''); setEndDate(''); setPilotoFilter(''); setBusFilter(''); setSelectedClient(null); setOnlyFailures(false); setStatusFilter(''); setStartHour(''); setEndHour(''); setPage(1); }}>LIMPIAR</Button>
                                        <Button size="small" variant="contained" color="primary" startIcon={<SearchIcon />} onClick={() => { setPage(1); fetchRouteHistory({ startDate: startDate||undefined, endDate: endDate||undefined, pilotoName: pilotoFilter||undefined, busPlaca: busFilter||undefined, onlyFailures: onlyFailures?'1':undefined, status: statusFilter||undefined, startHour: startHour||undefined, endHour: endHour||undefined, page: 1 }); }}>APLICAR FILTROS</Button>
                                    </Box>
                                </Box>
                            </Grid>

                            {/* Advanced collapse */}
                            <Grid item xs={12}>
                                <Collapse in={showAdvanced} timeout="auto" unmountOnExit>
                                    <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                                        
                                        <Grid item xs={12} sm={6} md={4}>
                                            <TextField size="small" label="Piloto" placeholder="Nombre piloto" fullWidth value={pilotoFilter} onChange={(e)=>setPilotoFilter(e.target.value)} InputProps={{ startAdornment:(<InputAdornment position="start"><Person fontSize="small" color="action"/></InputAdornment>) }} />
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={4}>
                                            <TextField size="small" label="Bus (Placa)" placeholder="Placa" fullWidth value={busFilter} onChange={(e)=>setBusFilter(e.target.value)} InputProps={{ startAdornment:(<InputAdornment position="start"><DirectionsBus fontSize="small" color="action"/></InputAdornment>) }} />
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <TextField size="small" label="Hora inicio" type="time" fullWidth InputLabelProps={{ shrink:true }} value={startHour} onChange={(e)=>setStartHour(e.target.value)} />
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <TextField size="small" label="Hora fin" type="time" fullWidth InputLabelProps={{ shrink:true }} value={endHour} onChange={(e)=>setEndHour(e.target.value)} />
                                        </Grid>
                                    </Grid>
                                </Collapse>
                            </Grid>
                        </Grid>
                    </Paper>
                </Box>
                {/* Keep a stable content box height so the dialog doesn't collapse/expand on loading */}
                {(() => {
                    const isInitialLoading = loading && (!routes || routes.length === 0);
                    const contentMinHeight = 320; // px, adjust as needed

                    if (isInitialLoading) {
                        return (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, minHeight: contentMinHeight }}>
                                <CircularProgress />
                            </Box>
                        );
                    }

                    if (error) {
                        return <Alert severity="error" sx={{ mb: 2, minHeight: contentMinHeight }}>{error}</Alert>;
                    }

                    if (!routes || routes.length === 0) {
                        return (
                            <Box sx={{ textAlign: 'center', py: 4, minHeight: contentMinHeight }}>
                                <DirectionsBus sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                                <Typography variant="h6" color="textSecondary">
                                    No hay historial de rutas disponible
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Esta ruta aún no ha sido utilizada
                                </Typography>
                            </Box>
                        );
                    }

                    // When we have routes, render them inside a container with minHeight and, if loading is true
                    // (meaning user navigated pages or applied filters), overlay a spinner while keeping the list visible.
                    return (
                        <Box sx={{ position: 'relative', minHeight: contentMinHeight }}>
                            <Grid container spacing={2}>
                                {routes.map((route, index) => (
                                    <Grid item xs={12} key={route.id || index}>
                                        <Card 
                                            variant="outlined" 
                                            sx={{ 
                                                borderRadius: 2,
                                                borderLeft: route.reporteFalla ? '4px solid #f44336' : '4px solid #4caf50',
                                                transition: 'all 0.3s',
                                                '&:hover': {
                                                    boxShadow: 3,
                                                    transform: 'translateY(-2px)'
                                                }
                                            }}
                                        >
                                            <CardContent>
                                                {/* Encabezado de la tarjeta */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <DirectionsBus color="primary" />
                                                        <Typography variant="h6" fontWeight="bold">
                                                            {route.placa || 'Sin placa'}
                                                        </Typography>
                                                    </Box>
                                                    <Chip 
                                                        icon={route.reporteFalla ? <Warning /> : <CheckCircle />}
                                                        label={route.reporteFalla ? 'Con falla' : 'Sin falla'}
                                                        color={route.reporteFalla ? 'error' : 'success'}
                                                        size="small"
                                                    />
                                                </Box>

                                                <Divider sx={{ mb: 2 }} />

                                                {/* Información del piloto */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                    <Person color="action" fontSize="small" />
                                                    <Typography variant="body2" color="textSecondary">
                                                        Piloto:
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {route.piloto || 'N/A'}
                                                    </Typography>
                                                </Box>

                                                {/* Colegio */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                    <SchoolIcon color="action" fontSize="small" />
                                                    <Typography variant="body2" color="textSecondary">Cliente:</Typography>
                                                    <Typography variant="body2" fontWeight="medium">{route.colegio || 'N/A'}</Typography>
                                                </Box>

                                                {/* Hora de inicio */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                    <AccessTime color="action" fontSize="small" />
                                                    <Typography variant="body2" color="textSecondary">
                                                        Hora inicio:
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {formatTime(route.startTime)}
                                                    </Typography>
                                                </Box>

                                                {/* Hora de fin */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                    <AccessTime color="action" fontSize="small" />
                                                    <Typography variant="body2" color="textSecondary">
                                                        Hora fin:
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {route.endTime ? formatTime(route.endTime) : 'En progreso'}
                                                    </Typography>
                                                </Box>

                                                {/* Duración */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                                    <AccessTime color="action" fontSize="small" />
                                                    <Typography variant="body2" color="textSecondary">
                                                        Duración:
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {formatDuration(route.startTime, route.endTime)}
                                                    </Typography>
                                                </Box>

                                                {/* Kilometraje */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Speed color="action" fontSize="small" />
                                                    <Typography variant="body2" color="textSecondary">
                                                        Kilometraje:
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {route.kilometraje ? `${parseFloat(route.kilometraje).toFixed(2)} km` : '0.00 km'}
                                                    </Typography>
                                                </Box>

                                                {/* Nota adicional de fecha */}
                                                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="caption" color="textSecondary">
                                                        Registrado el {new Date(route.createdAt).toLocaleDateString('es-GT', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </Typography>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>

                            {loading && (
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }}>
                                    <CircularProgress />
                                </Box>
                            )}
                        </Box>
                    );
                })()}
            </DialogContent>
            
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap' }}>
                    <Box sx={{ width: 56, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflowX: 'auto' }}>
                        <Pagination
                            sx={{ display: 'inline-flex', whiteSpace: 'nowrap' }}
                            count={Math.max(1, Math.ceil((total || 0) / pageSize))}
                            page={page}
                            onChange={(e, p) => {
                                setPage(p);
                                // trigger fetch for the newly selected page
                                fetchRouteHistory({
                                    startDate: startDate || undefined,
                                    endDate: endDate || undefined,
                                    pilotoName: pilotoFilter || undefined,
                                    busPlaca: busFilter || undefined,
                                    onlyFailures: onlyFailures ? '1' : undefined,
                                    status: statusFilter || undefined,
                                    startHour: startHour || undefined,
                                    endHour: endHour || undefined,
                                    schoolName: undefined,
                                    schoolId: (selectedClient && (selectedClient.id || selectedClient.value || selectedClient._id)) || clientId,
                                    page: p
                                });
                            }}
                            color="primary"
                        />
                    </Box>
                    <Box sx={{ width: 120, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={onClose} variant="contained" color="primary">
                            Cerrar
                        </Button>
                    </Box>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default RouteHistoryModal;
