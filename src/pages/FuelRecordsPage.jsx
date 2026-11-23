// src/pages/FuelRecordsPage.jsx

import { useEffect, useRef, useState } from 'react';
import useTableState from '../hooks/useTableState';
import AppTablePagination from '../components/table/AppTablePagination';
import SortableTableHead from '../components/table/SortableTableHead';
import AppTableContainer from '../components/table/AppTableContainer';
import RowActions from '../components/table/RowActions';
import usePermissions from '../hooks/usePermissions';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import {
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableRow,
    CircularProgress,
    Box,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Autocomplete,
    TextField,
    Chip,
    IconButton,
    Tooltip,
    Button,
    FormHelperText,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    LocalGasStation as GasIcon,
    InfoOutlined as InfoOutlinedIcon,
    Add as AddIcon
} from '@mui/icons-material';
import moment from 'moment-timezone';
import { formatDateTime } from '../utils/dateFormat';
import { formatQ } from '../utils/currency';
import {
    getFuelRecords,
    getFuelStatistics,
    getFuelRecordById,
    createFuelRecordWeb,
    updateFuelRecord,
    deleteFuelRecord,
    exportFuelRecordsExcel,
    FUELING_REASONS,
    FUEL_TYPES
} from '../services/fuelRecordService';
import api from '../utils/axiosConfig';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../utils/cicloEscolarFilterParams';
import ClientSelector from '../components/ClientSelector';
import FilterBar from '../components/filters/FilterBar';
import useFilters from '../hooks/useFilters';
import { F, toRouteOptions } from '../components/filters/filterFields';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import useNotify from '../hooks/useNotify';
import useConfirm from '../hooks/useConfirm';
import AppDialog from '../components/dialogs/AppDialog';
import EntitySelect from '../components/form/EntitySelect';
import { buildFileName } from '../utils/fileName';
import { todayForFileName } from '../utils/download';
import MoneyField from '../components/form/MoneyField';
import { validate, hasErrors, focusFirstError, clearError } from '../utils/validators';
import { LocalGasStation as LocalGasStationIcon, Payments as PaymentsIcon, Sell as PriceIcon, Speed as SpeedIcon } from '@mui/icons-material';
import { StatCard, StatCardGrid } from '../components/StatCard';
import { loadCatalog } from '../services/catalogStore';

// Campos obligatorios de los formularios (los mismos que exige el servidor; galones y precio, mayores que 0).
const CREATE_RULES = {
    client: ['required'],
    busId: ['required'],
    fuelingReason: ['required'],
    fuelType: ['required'],
    gallonage: ['required', 'positive'],
    pricePerGallon: ['required', 'positive'],
};
const EDIT_RULES = { ...CREATE_RULES, routeNumber: ['required'] };

const failedResponse = (response, fallback) => {
    const error = new Error(response?.message || fallback);
    error.response = { data: { message: response?.message || fallback } };
    return error;
};

// Id del colegio o corporación al que pertenece un bus, según el tipo de cliente.
const getBusClientId = (bus, type) => {
    if (type === 'school') {
        return bus.schoolId ?? bus.school?.id;
    }
    if (type === 'corp') {
        return bus.corporationId ?? bus.corporation?.id;
    }
    return null;
};

// Feature flag: mostrar la nueva métrica de consumo (activar manualmente cuando corresponda)
const SHOW_NEW_FUEL_METRIC = false;

// Columnas de la tabla
const COLUMNS = [
    { id: 'recordDate', label: 'Fecha', sortable: true },
    { id: 'client', label: 'Cliente', sortable: true },
    { id: 'routeNumber', label: 'Ruta', sortable: true },
    { id: 'plate', label: 'Placa', sortable: true },
    { id: 'pilotName', label: 'Piloto', sortable: true },
    { id: 'fuelingReason', label: 'Razón', sortable: true },
    { id: 'fuelType', label: 'Tipo de combustible', sortable: true },
    { id: 'anotacion', label: 'Anotación', align: 'center' },
    { id: 'gallonage', label: 'Galones', sortable: true, align: 'right' },
    { id: 'pricePerGallon', label: 'Precio/Galón', sortable: true, align: 'right' },
    { id: 'totalAmount', label: 'Total', sortable: true, align: 'right' },
    { id: 'acciones', label: 'Acciones', align: 'center' },
];

const FuelRecordsPage = () => {
    const { hasPermission } = usePermissions();
    const notify = useNotify();
    const confirm = useConfirm();
    const [fuelRecords, setFuelRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    // Paginación y orden (en el servidor)
    const table = useTableState({ defaultOrderBy: 'recordDate', defaultOrder: 'desc' });
    const { page, rowsPerPage, orderBy, order } = table;
    const [totalCount, setTotalCount] = useState(0);
    // Ordenamiento

    // Filtros
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [buses, setBuses] = useState([]);
    const [pilots, setPilots] = useState([]);
    // Rutas del cliente elegido en el modal de creación
    const [clientRouteNumbers, setClientRouteNumbers] = useState([]);
    // Rutas del cliente elegido en el filtro (separadas para que el modal no las pise)
    const [filterRouteNumbers, setFilterRouteNumbers] = useState([]);

    // Las opciones de Ruta y Placa dependen del cliente del borrador. Se toma del render anterior: cambiar el cliente recarga buses y rutas, y ese nuevo render ya trae las opciones correctas.
    const draftClientRef = useRef(null);
    const optionsClient = draftClientRef.current;
    const busesForSelectedClient = optionsClient
        ? buses.filter((bus) => {
            const busClientId = getBusClientId(bus, optionsClient.type);
            return busClientId === null || busClientId === undefined || String(busClientId) === String(optionsClient.id);
        })
        : buses;
    const plateOptions = [...new Set(busesForSelectedClient.map((bus) => bus.plate).filter(Boolean))]
        .sort((firstPlate, secondPlate) => String(firstPlate).localeCompare(String(secondPlate)))
        .map((plate) => ({ value: plate, label: plate }));
    const filterRouteOptions = toRouteOptions(optionsClient ? filterRouteNumbers : buses.map((bus) => bus.routeNumber));

    // Los filtros solo consultan al aplicar.
    const pageFilters = useFilters({
        fields: [
            F.cycle(),
            F.client({ schools, corporations }),
            F.route({ options: filterRouteOptions }),
            F.autocomplete('plate', {
                label: 'Placa', width: 'sm', options: plateOptions, dependsOn: ['client', 'route'], requireParent: false,
            }),
            F.select('fuelingReason', { label: 'Razón', allLabel: 'Todas', options: FUELING_REASONS }),
            F.select('fuelType', { label: 'Tipo de combustible', options: FUEL_TYPES }),
            F.dateRange('dates'),
        ],
        onApplied: table.resetPage,
    });
    draftClientRef.current = pageFilters.draft.client;
    const {
        cycle: selectedCicloEscolar,
        client: selectedClient,
        route: selectedRoute,
        fuelingReason: selectedFuelingReason,
        fuelType: selectedFuelType,
        dates,
    } = pageFilters.applied;
    const selectedPlate = pageFilters.applied.plate?.value || '';
    const draftCycle = pageFilters.draft.cycle;
    const draftClient = pageFilters.draft.client;

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);

    // Editar registro
    const [editOpen, setEditOpen] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [editSchools, setEditSchools] = useState([]);
    const [editCorporations, setEditCorporations] = useState([]);
    const [editBuses, setEditBuses] = useState([]);
    const [editClientRouteNumbers, setEditClientRouteNumbers] = useState([]);
    const [editForm, setEditForm] = useState({
        client: null,
        busId: '',
        routeNumber: '',
        fuelingReason: '',
        fuelType: '',
        pricePerGallon: '',
        gallonage: '',
        recordDateDate: moment(),
        recordDateTime: moment().format('HH:mm'),
        notes: ''
    });

    // Modal explicación eficiencia
    const [efficiencyInfoOpen, setEfficiencyInfoOpen] = useState(false);

    // Crear registro
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        fuelingReason: '',
        fuelType: '',
        client: '', // format: 'school-<id>' or 'corp-<id>'
        busId: '',
        pilotId: '',
        routeNumber: '',
        pricePerGallon: '',
        gallonage: '',
        recordDateDate: moment(),
        recordDateTime: moment().format('hh:mm A'),
        notes: ''
    });
    const [createErrors, setCreateErrors] = useState({});
    const [editErrors, setEditErrors] = useState({});
    // Valores con que se abrió cada formulario: cerrar con cambios pide confirmación.
    const createInitialRef = useRef('');
    const editInitialRef = useRef('');

    // Estadísticas
    const [clientBreakdown, setClientBreakdown] = useState({ colegios: 0, corporativos: 0 });
    const [statistics, setStatistics] = useState({
        totalRecords: 0,
        totalGallons: 0,
        totalAmount: 0,
        averagePrice: 0,
        efficiency: {
            estimatedConsumptionPerDay: 0,
            estimatedConsumptionPerRoute: 0,
            kmPerGallon: 0,
            gallonsPerKm: 0,
            totalKmTraveled: 0,
            totalRoutesCompleted: 0,
            drivingDaysCount: 0,
            avgKmPerRoute: 0,
            byBus: []
        },
        byReason: {},
    });

    useEffect(() => {
        fetchSchools();
        fetchCorporations();
        fetchBusesBySchool();
        fetchPilots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftCycle]);

    const fetchPilots = async () => {
        if (!hasPermission('usuarios-listar-pilotos')) {
            setPilots([]);
            return;
        }
        try {
            setPilots(await loadCatalog('pilots'));
        } catch (error) {
            console.error('Error al cargar pilotos:', error);
            setPilots([]);
        }
    };

    // No dependemos del colegio para las placas; cargamos todos los buses al montar.

    useEffect(() => {
        fetchFuelRecords();
        fetchStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedClient, selectedPlate, selectedRoute, selectedFuelingReason, selectedFuelType, selectedCicloEscolar, dates, orderBy, order]);

    const fetchSchools = async () => {
        try {
            setSchools(await loadCatalog('schools', { ...getCicloEscolarFilterParams(draftCycle), includeArchived: true }));
        } catch (error) {
            console.error('Error al cargar colegios:', error);
            setSchools([]);
        }
    };

    const fetchBusesBySchool = async (schoolId) => {
        try {
            // Si no se pasa schoolId, traemos todos los buses para permitir seleccionar placa independientemente.
            if (!schoolId) {
                setBuses(await loadCatalog('buses'));
                return;
            }
            const response = await api.get(`/buses/school/${schoolId}`);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    const fetchCorporations = async () => {
        try {
            setCorporations(await loadCatalog('corporations'));
        } catch (error) {
            console.error('Error al cargar corporaciones:', error);
            setCorporations([]);
        }
    };

    const fetchBusesByCorporation = async (corporationId) => {
        try {
            const url = corporationId ? `/buses/corporation/${corporationId}` : '/buses/simple';
            const response = await api.get(url);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    const isSpecificCicloEscolarSelected = selectedCicloEscolar && selectedCicloEscolar !== ALL_CYCLES_VALUE;

    useEffect(() => {
        if (draftClient) {
            const { type, id } = draftClient;
            if (type === 'school') {
                fetchBusesBySchool(id);
            } else if (type === 'corp') {
                fetchBusesByCorporation(id);
            }
        } else {
            // load all buses
            fetchBusesBySchool();
        }
        fetchRouteNumbersForClient(draftClient, setFilterRouteNumbers).catch(() => setFilterRouteNumbers([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftClient]);

    // keep routeNumbers in sync for the edit modal when its client changes
    useEffect(() => {
        if (editForm.client) {
            fetchRouteNumbersForClient(editForm.client, setEditClientRouteNumbers).catch(() => setEditClientRouteNumbers([]));
        } else {
            setEditClientRouteNumbers([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editForm.client]);

    // keep routeNumbers in sync for the create modal when its client changes
    useEffect(() => {
        if (createForm.client) {
            fetchRouteNumbersForClient(createForm.client).catch(() => setClientRouteNumbers([]));
        } else {
            // if no client in create modal, clear client-specific routeNumbers
            setClientRouteNumbers([]);
            // also clear any previously selected routeNumber in the create form
            setCreateForm(prev => ({ ...prev, routeNumber: '' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createForm.client]);

    // Fetch route numbers (routeNumbers field) for a given client object { type, id }
    const fetchRouteNumbersForClient = async (client, setter = setClientRouteNumbers) => {
        if (!client) {
            setter([]);
            return [];
        }
        try {
            const { type, id } = client;
            if (type === 'school') {
                const resp = await api.get(`/schools/${id}`);
                const rn = resp.data?.school?.routeNumbers || [];
                const arr = Array.isArray(rn) ? rn.map(x => String(x)) : [];
                setter(arr);
                return arr;
            }
            if (type === 'corp') {
                const resp = await api.get(`/corporations/${id}`);
                const rn = resp.data?.corporation?.routeNumbers || [];
                const arr = Array.isArray(rn) ? rn.map(x => String(x)) : [];
                setter(arr);
                return arr;
            }
        } catch (error) {
            console.error('Error al cargar routeNumbers del cliente:', error);
            setter([]);
            return [];
        }
        setter([]);
        return [];
    };

    const fetchFuelRecords = async () => {
        setLoading(true);
        try {
            const filters = {
                page: page + 1,
                limit: rowsPerPage,
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
            };

            if (selectedClient) {
                const { type, id } = selectedClient;
                if (type === 'school') {
                    filters.schoolId = id;
                }
                if (type === 'corp') {
                    filters.corporationId = id;
                }
            }
            if (selectedPlate) {
                filters.plate = selectedPlate;
            }
            if (selectedRoute) {
                filters.routeNumber = selectedRoute;
            }
            if (selectedFuelingReason) {
                filters.fuelingReason = selectedFuelingReason;
            }
            if (selectedFuelType) {
                filters.fuelType = selectedFuelType;
            }
            if (dates.from) {
                filters.startDate = dates.from;
            }
            if (dates.to) {
                filters.endDate = dates.to;
            }

            // Ordenamiento
            if (orderBy) {
                filters.orderBy = orderBy;
            }
            if (order) {
                filters.order = order;
            }

            const response = await getFuelRecords(filters);
            
            // El backend retorna: { success: true, data: [...], pagination: { total, page, limit, totalPages } }
            if (response.success && response.data) {
                setFuelRecords(response.data);
                setTotalCount(response.pagination?.total || 0);
                setClientBreakdown({
                    colegios: Number(response.clientBreakdown?.colegios || 0),
                    corporativos: Number(response.clientBreakdown?.corporativos || 0)
                });
                // Preferir totales/estadísticas devueltas por el endpoint de list (si las incluye)
                const totalsFromList = response.totals || response.statistics || response.meta;
                if (totalsFromList) {
                    const t = totalsFromList;
                    setStatistics(prev => ({
                        totalRecords: Number.parseInt(t.totalRecords || t.total || prev.totalRecords) || 0,
                        totalGallons: Number.parseFloat(t.totalGallonage || t.totalGallons || prev.totalGallons) || 0,
                        totalAmount: Number.parseFloat(t.totalAmount || prev.totalAmount) || 0,
                        averagePrice: Number.parseFloat(t.avgPricePerGallon || t.averagePrice || prev.averagePrice) || 0,
                        byReason: prev.byReason
                    }));
                }
            } else {
                setFuelRecords([]);
                setTotalCount(0);
            }
        } catch (error) {
            console.error('Error al cargar registros de combustible:', error);
            notify.fromError(error, 'Error al cargar los registros de combustible');
            setFuelRecords([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };


    const fetchStatistics = async () => {
        try {
            const filters = {
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
            };

            if (selectedClient) {
                    const { type, id } = selectedClient || {};
                    if (type === 'school') {
                        filters.schoolId = id;
                    }
                    if (type === 'corp') {
                        filters.corporationId = id;
                    }
                }
            if (selectedPlate) {
                filters.plate = selectedPlate;
            }
            if (selectedRoute) {
                filters.routeNumber = selectedRoute;
            }
            if (dates.from) {
                filters.startDate = dates.from;
            }
            if (dates.to) {
                filters.endDate = dates.to;
            }

            const response = await getFuelStatistics(filters);
            
            // El backend retorna: { success: true, data: { byFuelType: [...], byBus: [...], totals: {...} } }
            if (response.success && response.data) {
                const totals = response.data.totals || {};
                const byFuelType = response.data.byFuelType || [];
                
                // Organizar por razón de abastecimiento
                const byReason = {};
                byFuelType.forEach(stat => {
                    byReason[stat.fuelingReason] = {
                        count: Number.parseInt(stat.count) || 0,
                        totalGallonage: Number.parseFloat(stat.totalGallonage) || 0,
                        totalAmount: Number.parseFloat(stat.totalAmount) || 0,
                        avgPricePerGallon: Number.parseFloat(stat.avgPricePerGallon) || 0
                    };
                });

                setStatistics({
                    totalRecords: Number.parseInt(totals.totalRecords) || 0,
                    totalGallons: Number.parseFloat(totals.totalGallonage) || 0,
                    totalAmount: Number.parseFloat(totals.totalAmount) || 0,
                    averagePrice: Number.parseFloat(totals.avgPricePerGallon) || 0,
                    efficiency: response.data.efficiency || {
                        estimatedConsumptionPerDay: 0,
                        estimatedConsumptionPerRoute: 0,
                        kmPerGallon: 0,
                        gallonsPerKm: 0,
                        totalKmTraveled: 0,
                        totalRoutesCompleted: 0,
                        drivingDaysCount: 0,
                        avgKmPerRoute: 0,
                        byBus: []
                    },
                    byReason: byReason,
                });
            } else {
                setStatistics({
                    totalRecords: 0,
                    totalGallons: 0,
                    totalAmount: 0,
                    averagePrice: 0,
                    efficiency: {
                        estimatedConsumptionPerDay: 0,
                        estimatedConsumptionPerRoute: 0,
                        kmPerGallon: 0,
                        gallonsPerKm: 0,
                        totalKmTraveled: 0,
                        totalRoutesCompleted: 0,
                        drivingDaysCount: 0,
                        avgKmPerRoute: 0,
                        byBus: []
                    },
                    byReason: {},
                });
            }
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
            setStatistics({
                totalRecords: 0,
                totalGallons: 0,
                totalAmount: 0,
                averagePrice: 0,
                efficiency: {
                    estimatedConsumptionPerDay: 0,
                    estimatedConsumptionPerRoute: 0,
                    kmPerGallon: 0,
                    gallonsPerKm: 0,
                    totalKmTraveled: 0,
                    totalRoutesCompleted: 0,
                    drivingDaysCount: 0,
                    avgKmPerRoute: 0,
                    byBus: []
                },
                byReason: {},
            });
        }
    };


    const handleDownloadExcel = async () => {
        if (!totalCount || totalCount === 0) {
            notify.warning('No hay registros para exportar con los filtros seleccionados');
            return;
        }
        try {
            setExporting(true);

            const filters = {
                ...getCicloEscolarFilterParams(selectedCicloEscolar),
            };

            if (selectedClient) {
                const { type, id } = selectedClient;
                if (type === 'school') {
                    filters.schoolId = id;
                }
                if (type === 'corp') {
                    filters.corporationId = id;
                }
            }
            if (selectedPlate) {
                filters.plate = selectedPlate;
            }
            if (selectedRoute) {
                filters.routeNumber = selectedRoute;
            }
            if (selectedFuelingReason) {
                filters.fuelingReason = selectedFuelingReason;
            }
            if (selectedFuelType) {
                filters.fuelType = selectedFuelType;
            }
            if (dates.from) {
                filters.startDate = dates.from;
            }
            if (dates.to) {
                filters.endDate = dates.to;
            }

            await exportFuelRecordsExcel(filters, buildFileName({ object: 'registros combustible', date: todayForFileName(), extension: 'xlsx' }));
        } catch (error) {
            console.error('Error al generar el reporte de combustible:', error);
            notify.fromError(error, 'Error al generar el reporte');
        } finally {
            setExporting(false);
        }
    };

    // Register handler so the global refresh control triggers this page's refresh
    useRegisterPageRefresh(async () => {
        await Promise.all([fetchFuelRecords(), fetchStatistics()]);
    }, [fetchFuelRecords, fetchStatistics]);

    const handleViewDetails = async (recordId) => {
        try {
            const response = await getFuelRecordById(recordId);
            // El backend retorna: { success: true, data: {...} }
            if (response.success && response.data) {
                setSelectedRecord(response.data);
                setDetailsOpen(true);
            }
        } catch (error) {
            console.error('Error al cargar detalles del registro:', error);
            notify.fromError(error, 'Error al cargar los detalles del registro');
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedRecord(null);
    };

    const loadEditReferenceData = async () => {
        try {
            // Siempre colegios de todos los ciclos: un registro puede corregirse a un colegio de otro ciclo
            // (p. ej. creado en un colegio de 2027 que en realidad es de 2026).
            // Sin allCycles, interceptor y backend limitarían a uno.
            const params = { allCycles: true, includeArchived: true };
            const [schoolsData, corporationsData, busesData] = await Promise.all([
                loadCatalog('schools', params),
                loadCatalog('corporations'),
                loadCatalog('buses')
            ]);

            setEditSchools(schoolsData);
            setEditCorporations(corporationsData);
            setEditBuses(busesData);
        } catch (error) {
            console.error('Error al cargar datos de edición:', error);
            setEditSchools([]);
            setEditCorporations([]);
            setEditBuses([]);
        }
    };

    const buildEditFormFromRecord = (record) => {
        const recordMoment = moment(record?.recordDate);
        const client = record?.schoolId
            ? { type: 'school', id: record.schoolId, label: record?.school?.name || 'Colegio' }
            : (record?.corporationId ? { type: 'corp', id: record.corporationId, label: record?.corporation?.name || 'Corporación' } : null);
        return {
            client,
            busId: record?.busId ? String(record.busId) : '',
            routeNumber: record?.routeNumber !== undefined && record?.routeNumber !== null ? String(record.routeNumber) : '',
            fuelingReason: record?.fuelingReason || '',
            fuelType: record?.fuelType || '',
            pricePerGallon: record?.pricePerGallon !== undefined && record?.pricePerGallon !== null ? String(record.pricePerGallon) : '',
            gallonage: record?.gallonage !== undefined && record?.gallonage !== null ? String(record.gallonage) : '',
            recordDateDate: recordMoment.isValid() ? recordMoment : moment(),
            recordDateTime: recordMoment.isValid() ? recordMoment.format('HH:mm') : moment().format('HH:mm'),
            notes: record?.notes || ''
        };
    };

    const handleOpenEdit = (record) => {
        if (!record?.canEdit) {
            return;
        }
        setSelectedRecord(record);
        setEditSchools([]);
        setEditCorporations([]);
        setEditBuses([]);
        const form = buildEditFormFromRecord(record);
        editInitialRef.current = JSON.stringify(form);
        setEditErrors({});
        setEditForm(form);
        loadEditReferenceData();
        setEditOpen(true);
        setDetailsOpen(false);
    };

    const handleCloseEdit = () => {
        setEditOpen(false);
        setUpdating(false);
        setEditErrors({});
        setEditSchools([]);
        setEditCorporations([]);
        setEditBuses([]);
        setEditClientRouteNumbers([]);
        setEditForm({
            client: null,
            busId: '',
            routeNumber: '',
            fuelingReason: '',
            fuelType: '',
            pricePerGallon: '',
            gallonage: '',
            recordDateDate: moment(),
            recordDateTime: moment().format('HH:mm'),
            notes: ''
        });
    };

    const handleEditChange = (field, value) => {
        setEditErrors((prev) => clearError(prev, field));
        if (field === 'client') {
            setEditForm(prev => ({ ...prev, client: value, routeNumber: '' }));
            return;
        }
        if (field === 'busId') {
            const bus = editBuses.find((item) => String(item.id) === String(value));
            const busRouteNumber = bus?.routeNumber !== undefined && bus?.routeNumber !== null ? String(bus.routeNumber) : '';
            const belongsToClient = busRouteNumber && editClientRouteNumbers.includes(busRouteNumber);
            setEditForm(prev => ({ ...prev, busId: value, routeNumber: belongsToClient ? busRouteNumber : prev.routeNumber }));
            return;
        }
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handleEditSubmit = async () => {
        if (!selectedRecord) {
            notify.error('No se pudo cargar el registro a editar');
            return;
        }

        const found = validate(editForm, EDIT_RULES);
        setEditErrors(found);
        if (hasErrors(found)) {
            focusFirstError(found);
            return;
        }

        let recordDateIso = null;
        if (editForm.recordDateDate && editForm.recordDateTime) {
            const datePart = moment(editForm.recordDateDate);
            const timePart = moment(editForm.recordDateTime, 'HH:mm');
            if (datePart.isValid() && timePart.isValid()) {
                datePart.hour(timePart.hour());
                datePart.minute(timePart.minute());
                datePart.second(0);
                recordDateIso = datePart.toISOString();
            }
        }

        const payload = {
            fuelingReason: editForm.fuelingReason,
            fuelType: editForm.fuelType,
            busId: Number(editForm.busId),
            routeNumber: editForm.routeNumber,
            schoolId: editForm.client?.type === 'school' ? Number(editForm.client.id) : undefined,
            corporationId: editForm.client?.type === 'corp' ? Number(editForm.client.id) : undefined,
            pilotId: selectedRecord.pilotId || undefined,
            pricePerGallon: Number(editForm.pricePerGallon),
            gallonage: Number(editForm.gallonage),
            recordDate: recordDateIso || new Date().toISOString(),
            notes: editForm.notes || undefined,
        };

        try {
            setUpdating(true);
            const response = await updateFuelRecord(selectedRecord.id, payload);
            if (response?.success) {
                handleCloseEdit();
                handleCloseDetails();
                await Promise.all([fetchFuelRecords(), fetchStatistics()]);
                notify.success('Registro actualizado');
            } else {
                notify.error(response?.message || 'No se pudo actualizar el registro');
            }
        } catch (error) {
            console.error('Error al actualizar registro:', error);
            notify.fromError(error, 'Error al actualizar el registro');
        } finally {
            setUpdating(false);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Eliminar registro de combustible',
            message: 'Se eliminará el registro de combustible. Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            tone: 'danger',
            onConfirm: async () => {
                const response = await deleteFuelRecord(id);
                if (!response?.success) {
                    throw failedResponse(response, 'No se pudo eliminar el registro');
                }
            },
            errorMessage: 'Error al eliminar el registro',
        });
        if (ok) {
            handleCloseDetails();
            await Promise.all([fetchFuelRecords(), fetchStatistics()]);
            notify.success('Registro eliminado');
        }
    };

    const getFuelingReasonColor = (reason) => {
        const colors = {
            'ruta': 'primary',
            'mecanico': 'warning',
            'excursion': 'info',
            'admin': 'secondary',
        };
        return colors[reason] || 'default';
    };

    const editPlateOptions = [...new Set(editBuses.map((bus) => bus.plate).filter(Boolean))]
        .sort((firstPlate, secondPlate) => String(firstPlate).localeCompare(String(secondPlate)));

    const selectedRecordBus = selectedRecord?.bus || null;

    const selectedEditBusValue = editForm.busId
        ? (() => {
            const bus = editBuses.find((item) => String(item.id) === String(editForm.busId))
                || selectedRecordBus
                || null;
            return bus ? { label: bus.plate, id: String(bus.id), plate: bus.plate } : null;
        })()
        : null;

    // Crear registro: handlers
    const handleOpenCreate = () => {
        createInitialRef.current = JSON.stringify(createForm);
        setCreateErrors({});
        setCreateOpen(true);
    };

    const handleCloseCreate = () => {
        setCreateOpen(false);
        setCreating(false);
        setCreateErrors({});
        setCreateForm({
            fuelingReason: '',
            fuelType: '',
            client: '',
            busId: '',
            pilotId: '',
            routeNumber: '',
            pricePerGallon: '',
            gallonage: '',
            recordDateDate: moment(),
            recordDateTime: moment(),
            notes: ''
        });
    };

    const handleCreateChange = (field, value) => {
        setCreateErrors((prev) => clearError(prev, field));
        // If the client changes, clear previously selected routeNumber to avoid stale values
        if (field === 'client') {
            setCreateForm(prev => ({ ...prev, client: value, routeNumber: '' }));
            return;
        }
        setCreateForm(prev => ({ ...prev, [field]: value }));
    };

    const handleCreateSubmit = async () => {
        const found = validate(createForm, CREATE_RULES);
        setCreateErrors(found);
        if (hasErrors(found)) {
            focusFirstError(found);
            return;
        }

        // Combine selected date and time into a single ISO timestamp
        let recordDateIso = null;
        if (createForm.recordDateDate && createForm.recordDateTime) {
            const datePart = moment(createForm.recordDateDate);
            const timePart = moment(createForm.recordDateTime, 'hh:mm A');
            if (timePart.isValid()) {
                datePart.hour(timePart.hour());
                datePart.minute(timePart.minute());
                datePart.second(0);
                recordDateIso = datePart.toISOString();
            }
        }

        const payload = {
            fuelingReason: createForm.fuelingReason,
            fuelType: createForm.fuelType,
            busId: Number(createForm.busId),
            pilotId: createForm.pilotId ? Number(createForm.pilotId) : undefined,
            routeNumber: createForm.routeNumber || undefined,
            pricePerGallon: Number(createForm.pricePerGallon),
            gallonage: Number(createForm.gallonage),
            recordDate: recordDateIso || new Date().toISOString(),
            notes: createForm.notes || undefined,
        };

        // Map client to schoolId or corporationId
        if (createForm.client) {
            const { type, id } = createForm.client || {};
            if (type === 'school') {
                payload.schoolId = Number(id);
            }
            if (type === 'corp') {
                payload.corporationId = Number(id);
            }
        }

        try {
            setCreating(true);
            const response = await createFuelRecordWeb(payload);
            if (response?.success) {
                handleCloseCreate();
                // Refresh list and stats
                table.resetPage();
                fetchFuelRecords();
                fetchStatistics();
                notify.success('Registro creado');
            } else {
                notify.error(response?.message || 'No se pudo crear el registro');
            }
        } catch (error) {
            console.error('Error al crear registro:', error);
            notify.fromError(error, 'Error al crear el registro');
        } finally {
            setCreating(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <PageContainer width="xl">
                <PageHeader
                    eyebrow={MODULE_GROUPS.buses}
                    title="Registros de Combustible"
                    subtitle="Visualiza y gestiona los registros de abastecimiento de combustible"
                    actions={[
                        { key: 'report', label: 'Generar reporte', group: 'download', loading: exporting, disabled: totalCount === 0, onClick: handleDownloadExcel },
                        { key: 'create', label: 'Nuevo registro', icon: <AddIcon />, primary: true, permission: 'combustible-crear-registro', onClick: handleOpenCreate },
                    ]}
                />

                {/* Estadísticas */}
                <StatCardGrid columns={SHOW_NEW_FUEL_METRIC ? 5 : 4}>
                    <StatCard
                        label="Total registros"
                        value={statistics.totalRecords}
                        icon={<GasIcon />}
                        format="number"
                        hint={`${clientBreakdown.colegios} de colegios · ${clientBreakdown.corporativos} corporativos`}
                    />
                    <StatCard label="Total galones" value={statistics.totalGallons.toFixed(2)} icon={<LocalGasStationIcon />} />
                    <StatCard label="Total gastado" value={statistics.totalAmount || 0} icon={<PaymentsIcon />} format="money" />
                    <StatCard label="Precio promedio/galón" value={statistics.averagePrice || 0} icon={<PriceIcon />} format="money" />
                    {SHOW_NEW_FUEL_METRIC && (
                        <StatCard
                            label={(
                                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                    Consumo de combustible por días/recorrido
                                    <Tooltip title="¿Cómo se calcula esto?">
                                        <IconButton size="small" onClick={() => setEfficiencyInfoOpen(true)} sx={{ ml: 0.5, p: 0.25 }}>
                                            <InfoOutlinedIcon fontSize="small" color="action" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            )}
                            value={`${(Number(statistics.efficiency?.estimatedConsumptionPerDay) || 0).toFixed(2)} gal/día`}
                            icon={<SpeedIcon />}
                            hint={`${(Number(statistics.efficiency?.estimatedConsumptionPerRoute) || 0).toFixed(2)} gal/recorrido`}
                        />
                    )}
                </StatCardGrid>

                {/* Filtros */}
                <FilterBar
                    {...pageFilters.barProps}
                    loading={loading}
                    caption={isSpecificCicloEscolarSelected
                        ? 'Al filtrar por ciclo escolar, los registros de corporaciones se incluyen siempre, porque las corporaciones son válidas en todos los ciclos.'
                        : undefined}
                />

                {/* Tabla */}
                <Paper>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" p={5}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <AppTableContainer>
                                <Table sx={{ minWidth: 1200 }}>
                                    <SortableTableHead columns={COLUMNS} {...table.sortProps} />
                                    <TableBody>
                                        {fuelRecords.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell>
                                                    {formatDateTime(record.recordDate)}
                                                </TableCell>
                                                <TableCell>
                                                    {record.school?.name || record.corporation?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.routeNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.plate || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.pilot?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={FUELING_REASONS[record.fuelingReason] || record.fuelingReason}
                                                        size="small"
                                                        color={getFuelingReasonColor(record.fuelingReason)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {FUEL_TYPES[record.fuelType] || record.fuelType}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {record.notes?.trim() && (
                                                        <Tooltip title={`Anotación: ${record.notes.trim()}`}>
                                                            <Box
                                                                component="span"
                                                                sx={{
                                                                    width: 14,
                                                                    height: 14,
                                                                    borderRadius: '50%',
                                                                    display: 'inline-block',
                                                                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                                                    boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.15)',
                                                                    border: '1px solid rgba(251, 191, 36, 0.35)',
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {Number.parseFloat(record.gallonage).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {formatQ(record.pricePerGallon || 0)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {formatQ(record.totalAmount || 0)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <RowActions
                                                        actions={[
                                                            { key: 'view', kind: 'view', color: 'primary', label: 'Ver detalles', icon: <VisibilityIcon fontSize="small" />, onClick: () => handleViewDetails(record.id) },
                                                            record.canEdit && { key: 'edit', kind: 'edit', color: 'secondary', label: 'Editar registro', icon: <EditIcon fontSize="small" />, permission: 'combustible-editar', onClick: () => handleOpenEdit(record) },
                                                            { key: 'delete', kind: 'delete', label: 'Eliminar registro', icon: <DeleteIcon fontSize="small" />, permission: 'combustible-eliminar', onClick: () => handleDelete(record.id) },
                                                        ]}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {fuelRecords.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={11} align="center">
                                                    No se encontraron registros de combustible
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </AppTableContainer>
                            <AppTablePagination count={totalCount} {...table.paginationProps} />
                        </>
                    )}
                </Paper>

                {/* Modal de Crear Registro */}
                <AppDialog
                    open={createOpen}
                    onClose={handleCloseCreate}
                    title="Nuevo registro de combustible"
                    icon={<GasIcon />}
                    size="sm"
                    onSubmit={handleCreateSubmit}
                    submitLabel="Crear"
                    submitting={creating}
                    readOnly={!hasPermission('combustible-crear-registro')}
                    dirty={JSON.stringify(createForm) !== createInitialRef.current}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <ClientSelector
                                size="medium"
                                schools={schools}
                                corporations={corporations}
                                value={createForm.client}
                                onChange={(client) => handleCreateChange('client', client)}
                                name="client"
                                required
                                error={Boolean(createErrors.client)}
                                helperText={createErrors.client}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <EntitySelect
                                entity="bus"
                                label="Bus (placa)"
                                name="busId"
                                size="medium"
                                options={buses}
                                value={createForm.busId}
                                onChange={(busId) => handleCreateChange('busId', busId)}
                                required
                                error={Boolean(createErrors.busId)}
                                helperText={createErrors.busId}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <EntitySelect
                                entity="pilot"
                                size="medium"
                                options={pilots}
                                value={createForm.pilotId}
                                onChange={(pilotId) => handleCreateChange('pilotId', pilotId)}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <Autocomplete
                                options={(createForm.client ? (clientRouteNumbers.length ? clientRouteNumbers : []) : []).map(String).sort((a,b) => a - b)}
                                value={createForm.routeNumber || null}
                                onChange={(e, newValue) => handleCreateChange('routeNumber', newValue || '')}
                                getOptionLabel={(option) => String(option)}
                                renderInput={(params) => <TextField {...params} label="Número de ruta" variant="outlined" />}
                                fullWidth
                                disabled={!createForm.client}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required error={Boolean(createErrors.fuelingReason)}>
                                <InputLabel>Razón de abastecimiento</InputLabel>
                                <Select
                                    name="fuelingReason"
                                    value={createForm.fuelingReason}
                                    label="Razón de abastecimiento"
                                    onChange={(e) => handleCreateChange('fuelingReason', e.target.value)}
                                >
                                    <MenuItem value="">Seleccione</MenuItem>
                                    {Object.entries(FUELING_REASONS).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>{label}</MenuItem>
                                    ))}
                                </Select>
                                {createErrors.fuelingReason ? <FormHelperText>{createErrors.fuelingReason}</FormHelperText> : null}
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required error={Boolean(createErrors.fuelType)}>
                                <InputLabel>Tipo de combustible</InputLabel>
                                <Select
                                    name="fuelType"
                                    value={createForm.fuelType}
                                    label="Tipo de combustible"
                                    onChange={(e) => handleCreateChange('fuelType', e.target.value)}
                                >
                                    <MenuItem value="">Seleccione</MenuItem>
                                    {Object.entries(FUEL_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>{label}</MenuItem>
                                    ))}
                                </Select>
                                {createErrors.fuelType ? <FormHelperText>{createErrors.fuelType}</FormHelperText> : null}
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Galones"
                                type="number"
                                fullWidth
                                name="gallonage"
                                required
                                inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                                value={createForm.gallonage}
                                onChange={(e) => handleCreateChange('gallonage', e.target.value)}
                                error={Boolean(createErrors.gallonage)}
                                helperText={createErrors.gallonage}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <MoneyField
                                label="Precio por galón"
                                name="pricePerGallon"
                                required
                                value={createForm.pricePerGallon}
                                onChange={(e) => handleCreateChange('pricePerGallon', e.target.value)}
                                error={Boolean(createErrors.pricePerGallon)}
                                helperText={createErrors.pricePerGallon}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <DatePicker
                                label="Fecha"
                                value={createForm.recordDateDate}
                                onChange={(newValue) => handleCreateChange('recordDateDate', newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Hora"
                                type="time"
                                value={createForm.recordDateTime}
                                onChange={(e) => handleCreateChange('recordDateTime', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Notas (opcional)"
                                fullWidth
                                multiline
                                minRows={2}
                                value={createForm.notes}
                                onChange={(e) => handleCreateChange('notes', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </AppDialog>

                {/* Modal de Detalles */}
                <AppDialog
                    open={detailsOpen}
                    onClose={handleCloseDetails}
                    title="Detalle del registro de combustible"
                    icon={<GasIcon />}
                    size="md"
                    readOnly
                    extraActions={selectedRecord?.canEdit ? (
                        <Button onClick={() => handleOpenEdit(selectedRecord)} variant="outlined" color="secondary">
                            Editar
                        </Button>
                    ) : null}
                >
                    {selectedRecord && (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Fecha y hora
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {formatDateTime(selectedRecord.recordDate)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Placa
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedRecord.plate || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Ruta
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedRecord.routeNumber || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Piloto
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedRecord.pilot?.name || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Cliente
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedRecord.school?.name || selectedRecord.corporation?.name || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Razón de abastecimiento
                                </Typography>
                                <Chip
                                    label={FUELING_REASONS[selectedRecord.fuelingReason] || selectedRecord.fuelingReason}
                                    color={getFuelingReasonColor(selectedRecord.fuelingReason)}
                                    sx={{ mt: 1 }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Tipo de combustible
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {FUEL_TYPES[selectedRecord.fuelType] || selectedRecord.fuelType}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Galones
                                </Typography>
                                <Typography variant="h6" gutterBottom>
                                    {Number.parseFloat(selectedRecord.gallonage).toFixed(2)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Precio por galón
                                </Typography>
                                <Typography variant="h6" gutterBottom>
                                    {formatQ(selectedRecord.pricePerGallon || 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Total pagado
                                </Typography>
                                <Typography variant="h6" color="primary" gutterBottom>
                                    {formatQ(selectedRecord.totalAmount || 0)}
                                </Typography>
                            </Grid>
                            {selectedRecord.notes && (
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Notas
                                    </Typography>
                                    <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                        <Typography variant="body1">
                                            {selectedRecord.notes}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            )}
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Creado por
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedRecord.creator?.name || 'N/A'}
                                </Typography>
                            </Grid>
                        </Grid>
                    )}
                </AppDialog>

                {/* Modal de Edición. La regla de mismo día (canEdit) la sigue imponiendo el registro. */}
                <AppDialog
                    open={editOpen}
                    onClose={handleCloseEdit}
                    title="Editar registro de combustible"
                    subtitle={selectedRecord
                        ? `${selectedRecord.school?.name || selectedRecord.corporation?.name || 'N/A'} · Bus ${selectedRecord.plate || 'N/A'}`
                        : undefined}
                    icon={<EditIcon />}
                    size="sm"
                    onSubmit={handleEditSubmit}
                    submitLabel="Guardar cambios"
                    submitting={updating}
                    readOnly={!(selectedRecord?.canEdit && hasPermission('combustible-editar'))}
                    dirty={JSON.stringify(editForm) !== editInitialRef.current}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <ClientSelector
                                size="medium"
                                schools={editSchools}
                                corporations={editCorporations}
                                value={editForm.client}
                                onChange={(client) => handleEditChange('client', client)}
                                name="client"
                                required
                                error={Boolean(editErrors.client)}
                                helperText={editErrors.client}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <Autocomplete
                                options={editPlateOptions.map((plate) => {
                                    const bus = editBuses.find((item) => item.plate === plate);
                                    return { label: plate, id: bus?.id ? String(bus.id) : '', plate };
                                })}
                                value={selectedEditBusValue}
                                onChange={(e, newValue) => handleEditChange('busId', newValue ? String(newValue.id) : '')}
                                getOptionLabel={(option) => option?.label || ''}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Placa / bus"
                                        variant="outlined"
                                        name="busId"
                                        required
                                        error={Boolean(editErrors.busId)}
                                        helperText={editErrors.busId}
                                    />
                                )}
                                fullWidth
                                isOptionEqualToValue={(opt, val) => String(opt?.id) === String(val?.id)}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <Autocomplete
                                options={editClientRouteNumbers.map(String).sort((a, b) => a - b)}
                                value={editForm.routeNumber || null}
                                onChange={(e, newValue) => handleEditChange('routeNumber', newValue || '')}
                                getOptionLabel={(option) => String(option)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Número de ruta"
                                        variant="outlined"
                                        name="routeNumber"
                                        required
                                        error={Boolean(editErrors.routeNumber)}
                                        helperText={editErrors.routeNumber}
                                    />
                                )}
                                fullWidth
                                disabled={!editForm.client}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required error={Boolean(editErrors.fuelingReason)}>
                                <InputLabel>Razón de abastecimiento</InputLabel>
                                <Select
                                    name="fuelingReason"
                                    value={editForm.fuelingReason}
                                    label="Razón de abastecimiento"
                                    onChange={(e) => handleEditChange('fuelingReason', e.target.value)}
                                >
                                    <MenuItem value="">Seleccione</MenuItem>
                                    {Object.entries(FUELING_REASONS).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>{label}</MenuItem>
                                    ))}
                                </Select>
                                {editErrors.fuelingReason ? <FormHelperText>{editErrors.fuelingReason}</FormHelperText> : null}
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required error={Boolean(editErrors.fuelType)}>
                                <InputLabel>Tipo de combustible</InputLabel>
                                <Select
                                    name="fuelType"
                                    value={editForm.fuelType}
                                    label="Tipo de combustible"
                                    onChange={(e) => handleEditChange('fuelType', e.target.value)}
                                >
                                    <MenuItem value="">Seleccione</MenuItem>
                                    {Object.entries(FUEL_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>{label}</MenuItem>
                                    ))}
                                </Select>
                                {editErrors.fuelType ? <FormHelperText>{editErrors.fuelType}</FormHelperText> : null}
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Galones"
                                type="number"
                                fullWidth
                                name="gallonage"
                                required
                                inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                                value={editForm.gallonage}
                                onChange={(e) => handleEditChange('gallonage', e.target.value)}
                                error={Boolean(editErrors.gallonage)}
                                helperText={editErrors.gallonage}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <MoneyField
                                label="Precio por galón"
                                name="pricePerGallon"
                                required
                                value={editForm.pricePerGallon}
                                onChange={(e) => handleEditChange('pricePerGallon', e.target.value)}
                                error={Boolean(editErrors.pricePerGallon)}
                                helperText={editErrors.pricePerGallon}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <DatePicker
                                label="Fecha"
                                value={editForm.recordDateDate}
                                onChange={(newValue) => handleEditChange('recordDateDate', newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Hora"
                                type="time"
                                value={editForm.recordDateTime}
                                onChange={(e) => handleEditChange('recordDateTime', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Notas (opcional)"
                                fullWidth
                                multiline
                                minRows={2}
                                value={editForm.notes}
                                onChange={(e) => handleEditChange('notes', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </AppDialog>

                {SHOW_NEW_FUEL_METRIC && (
                    /* ── Modal: Explicación del cálculo de eficiencia ── */
                    <AppDialog
                        open={efficiencyInfoOpen}
                        onClose={() => setEfficiencyInfoOpen(false)}
                        title="¿Cómo se calcula el consumo de combustible?"
                        icon={<InfoOutlinedIcon />}
                        size="sm"
                        actions={(
                            <Button onClick={() => setEfficiencyInfoOpen(false)} variant="contained" disableElevation>
                                Entendido
                            </Button>
                        )}
                    >
                        {/* ── Resumen ── */}
                        <Typography variant="body1" gutterBottom>
                            Estas cifras estiman cuántos galones consume la flota <strong>por día de operación</strong> y <strong>por recorrido completado</strong>. El cálculo se basa en datos reales de distancia recorrida y combustible abastecido.
                        </Typography>

                        {/* ── Paso 1 ── */}
                        <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 700 }}>
                            Paso 1 — Eficiencia real (km / galón)
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                            Cruzamos dos fuentes de datos dentro del mismo período y para los mismos buses:
                        </Typography>
                        <Box component="ul" sx={{ pl: 2.5, mt: 0.5 }}>
                            <li><Typography variant="body2"><strong>Kilómetros recorridos:</strong> suma de la distancia registrada en cada recorrido <em>completado</em> (aquellos que tienen hora de inicio <em>y</em> hora de fin).</Typography></li>
                            <li><Typography variant="body2"><strong>Galones abastecidos:</strong> suma de todos los registros de combustible del período.</Typography></li>
                        </Box>
                        <Box sx={{ bgcolor: 'grey.100', borderRadius: 1, px: 2, py: 1, mt: 1 }}>
                            <Typography variant="body2" fontFamily="monospace">
                                Eficiencia = km totales ÷ galones totales abastecidos
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            <strong>¿Por qué galones abastecidos ≈ galones consumidos?</strong> En períodos largos, el nivel del tanque al inicio y al final del período se cancela estadísticamente, de modo que lo que se surtió equivale a lo que se consumió.
                        </Typography>

                        {/* ── Paso 2 ── */}
                        <Typography variant="subtitle1" sx={{ mt: 2.5, fontWeight: 700 }}>
                            Paso 2 — Consumo estimado por recorrido
                        </Typography>
                        <Box sx={{ bgcolor: 'grey.100', borderRadius: 1, px: 2, py: 1, mt: 0.5 }}>
                            <Typography variant="body2" fontFamily="monospace">
                                Consumo/recorrido = km promedio por recorrido ÷ eficiencia (km/galón)
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            Primero se calcula el promedio de kilómetros por recorrido. Luego, dividiendo esa distancia entre la eficiencia, se obtiene cuántos galones demanda un recorrido típico.
                        </Typography>

                        {/* ── Paso 3 ── */}
                        <Typography variant="subtitle1" sx={{ mt: 2.5, fontWeight: 700 }}>
                            Paso 3 — Consumo estimado por día de operación
                        </Typography>
                        <Box sx={{ bgcolor: 'grey.100', borderRadius: 1, px: 2, py: 1, mt: 0.5 }}>
                            <Typography variant="body2" fontFamily="monospace">
                                Consumo/día = (km totales ÷ días con recorridos) ÷ eficiencia (km/galón)
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            Se cuentan únicamente los días en que hubo al menos un recorrido completado. Dividir los km de ese día entre la eficiencia da el gasto estimado de combustible para ese día promedio.
                        </Typography>

                        {/* ── Notas importantes ── */}
                        <Typography variant="subtitle1" sx={{ mt: 2.5, fontWeight: 700, color: 'warning.dark' }}>
                            ⚠ Notas importantes
                        </Typography>
                        <Box component="ul" sx={{ pl: 2.5, mt: 0.5 }}>
                            <li>
                                <Typography variant="body2">
                                    <strong>Certeza de los datos:</strong> la precisión depende directamente de que los recorridos se <em>cierren correctamente</em> en el sistema (con hora de fin registrada) y de que todos los abastecimientos se carguen en tiempo real. Datos faltantes o incompletos reducen la exactitud.
                                </Typography>
                            </li>
                            <li>
                                <Typography variant="body2" sx={{ mt: 0.75 }}>
                                    <strong>Período corto:</strong> con pocos días o pocos abastecimientos, el nivel inicial/final del tanque puede distorsionar el resultado. Los valores son más confiables en períodos de al menos 2–3 semanas.
                                </Typography>
                            </li>
                            <li>
                                <Typography variant="body2" sx={{ mt: 0.75 }}>
                                    <strong>Buses sin datos cruzados:</strong> si un bus tiene registros de combustible pero ningún recorrido completado (o viceversa) en el período, no se incluye en el cálculo global de eficiencia.
                                </Typography>
                            </li>
                            <li>
                                <Typography variant="body2" sx={{ mt: 0.75 }}>
                                    <strong>Mejora futura:</strong> cuando se activen las lecturas de odómetro y el indicador de tanque lleno, el sistema pasará al método <em>tank-to-tank</em> (lleno a lleno), que es el estándar de mayor precisión en gestión de flotas.
                                </Typography>
                            </li>
                        </Box>

                        {/* ── Datos del período actual ── */}
                        {statistics.efficiency?.kmPerGallon > 0 && (
                            <>
                                <Typography variant="subtitle1" sx={{ mt: 2.5, fontWeight: 700 }}>
                                    Datos del período actual
                                </Typography>
                                <Box sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', borderRadius: 1, px: 2, py: 1.5, mt: 0.5 }}>
                                    <Grid container spacing={1}>
                                        <Grid item xs={6}><Typography variant="body2"><strong>Eficiencia:</strong> {(statistics.efficiency.kmPerGallon || 0).toFixed(3)} km/gal</Typography></Grid>
                                        <Grid item xs={6}><Typography variant="body2"><strong>Km totales:</strong> {(statistics.efficiency.totalKmTraveled || 0).toFixed(1)} km</Typography></Grid>
                                        <Grid item xs={6}><Typography variant="body2"><strong>Recorridos completados:</strong> {statistics.efficiency.totalRoutesCompleted || 0}</Typography></Grid>
                                        <Grid item xs={6}><Typography variant="body2"><strong>Días con operación:</strong> {statistics.efficiency.drivingDaysCount || 0}</Typography></Grid>
                                        <Grid item xs={6}><Typography variant="body2"><strong>Km prom./recorrido:</strong> {(statistics.efficiency.avgKmPerRoute || 0).toFixed(2)} km</Typography></Grid>
                                        <Grid item xs={6}><Typography variant="body2"><strong>Galones/km:</strong> {(statistics.efficiency.gallonsPerKm || 0).toFixed(4)} gal/km</Typography></Grid>
                                    </Grid>
                                </Box>
                            </>
                        )}
                        {(!statistics.efficiency?.kmPerGallon || statistics.efficiency.kmPerGallon === 0) && (
                            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                                <Typography variant="body2" color="textSecondary">
                                    No hay datos suficientes para calcular la eficiencia en el período o filtros seleccionados actualmente.
                                </Typography>
                            </Box>
                        )}
                    </AppDialog>
                )}
            </PageContainer>
        </LocalizationProvider>
    );
};

export default FuelRecordsPage;
