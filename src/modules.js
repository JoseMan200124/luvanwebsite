// modules.js
import {
    Group,
    School,
    CalendarMonth,
    BarChart,
    People,
    Groups,
    DirectionsBus,
    History
} from '@mui/icons-material';

import RolesManagementPage from './pages/RolesManagementPage';
import MonitorsManagementPage from './pages/MonitorsManagementPage';
import PilotsManagementPage from './pages/PilotsManagementPage';
import SupervisorsManagementPage from './pages/SupervisorsManagementPage';
import AuxiliaresManagementPage from './pages/AuxiliaresManagementPage';
import ReportsUsagePage from './pages/ReportsUsagePage';
import FinancialStatisticsPage from './pages/FinancialStatisticsPage';
import CircularHistoryPage from './pages/CircularHistoryPage';
import BusesManagementPage from './pages/BusesManagementPage';
import RouteHistoryPage from './pages/RouteHistoryPage';
// ✅ REMOVIDO: import ActivityLogPage from './pages/ActivityLogPage';
import CicloEscolarSelectionPage from './pages/CicloEscolarSelectionPage';
import CiclosEscolaresPage from './pages/CiclosEscolaresPage';
import AttendanceManagementPage from './pages/AttendanceManagementPage';
import StudentIncidentsPage from './pages/StudentIncidentsPage';
import BusIncidentsPage from './pages/BusIncidentsPage';
import FailureMappingPage from './pages/FailureMappingPage';
import BusEmergenciesPage from './pages/BusEmergenciesPage';
import MechanicRequestsPage from './pages/MechanicRequestsPage';
import RequestsPage from './pages/RequestsPage';
import RouteTimeLogsPage from './pages/RouteTimeLogsPage';
import FuelRecordsPage from './pages/FuelRecordsPage';
import CorporationsPage from './pages/CorporationsPage';
import AssignmentHistoryPage from './pages/AssignmentHistoryPage';
import HistoricalDataPage from './pages/HistoricalDataPage';

export const modules = [
    {
        key: 'gestion-personal',
        name: 'Gestión de Personal',
        icon: People,
        submodules: [
            {
                key: 'usuarios',
                name: 'Usuarios',
                path: 'usuarios',
                component: RolesManagementPage,
            },
            {
                key: 'monitores',
                name: 'Monitores',
                path: 'monitores',
                component: MonitorsManagementPage,
            },
            {
                key: 'pilotos',
                name: 'Pilotos',
                path: 'pilotos',
                component: PilotsManagementPage,
            },
            {
                key: 'supervisores',
                name: 'Supervisores',
                path: 'supervisores',
                component: SupervisorsManagementPage,
            },
            {
                key: 'auxiliares',
                name: 'Auxiliares',
                path: 'auxiliares',
                component: AuxiliaresManagementPage,
            },
        ],
    },
    {
        key: 'gestion-colegios-rutas',
        name: 'Gestión de Clientes',
        icon: School,
        submodules: [
            {
                key: 'colegios',
                name: 'Colegios',
                path: 'colegios',
                component: CicloEscolarSelectionPage,
            },
            {
                key: 'ciclos-escolares',
                name: 'Ciclos Escolares',
                path: 'ciclos-escolares',
                component: CiclosEscolaresPage,
                icon: CalendarMonth,
            },
            {
                key: 'corporaciones',
                name: 'Corporaciones',
                path: 'corporaciones',
                component: CorporationsPage,
            },
            {
                key: 'circulares-admin-listar',
                name: 'Historial de Circulares',
                path: 'circulares',
                component: CircularHistoryPage,
            },
            {
                key: 'solicitudes-usuarios',
                name: 'Solicitudes Usuarios',
                path: 'solicitudes-usuarios',
                component: RequestsPage,
            },
        ],
    },
    {
        key: 'gestion-buses',
        name: 'Gestión de Buses',
        icon: DirectionsBus,
        submodules: [
            {
                key: 'buses',
                name: 'Buses',
                path: 'buses',
                component: BusesManagementPage,
            },
            {
                key: 'historial-recorridos-rutas',
                name: 'Recorridos',
                path: 'historial-recorridos-rutas',
                component: RouteHistoryPage,
            },
            {
                key: 'mapeo-fallas',
                name: 'Mapeo de Fallas',
                path: 'mapeo-fallas',
                component: FailureMappingPage,
            },
            {
                key: 'registros-combustible',
                name: 'Registros de Combustible',
                path: 'registros-combustible',
                component: FuelRecordsPage,
            },
            {
                key: 'incidentes-buses',
                name: 'Incidentes',
                path: 'incidentes-buses',
                component: BusIncidentsPage,
            },
            {
                key: 'emergencias-buses',
                name: 'Emergencias',
                path: 'emergencias-buses',
                component: BusEmergenciesPage,
            },
            {
                key: 'solicitudes-mecanica',
                name: 'Solicitudes de Mecánica',
                path: 'solicitudes-mecanica',
                component: MechanicRequestsPage,
            },
        ],
    },
    {
        key: 'gestion-monitoras',
        name: 'Gestión de Monitoras',
        icon: Groups,
        submodules: [
            {
                key: 'asistencias',
                name: 'Asistencias',
                path: 'asistencias',
                component: AttendanceManagementPage,
            },
            {
                key: 'incidentes-conducta',
                name: 'Reportes de Conducta',
                path: 'incidentes-conducta',
                component: StudentIncidentsPage,
            },
            {
                key: 'horarios-rutas',
                name: 'Horarios de Rutas',
                path: 'horarios-rutas',
                component: RouteTimeLogsPage,
            },
        ],
    },
    {
        key: 'historiales',
        name: 'Historiales',
        icon: History,
        submodules: [
            {
                key: 'historial-ciclos',
                name: 'Historial de Ciclos Escolares',
                path: 'historial',
                component: HistoricalDataPage,
            },
            {
                key: 'historial-asignaciones',
                name: 'Historial de Asignaciones',
                path: 'historial-asignaciones',
                component: AssignmentHistoryPage,
            },
        ],
    },
    {
        key: 'reportes-estadisticas',
        name: 'Reportes y Estadísticas',
        icon: BarChart,
        submodules: [
            {
                key: 'reportes-uso',
                name: 'Reportes de Uso',
                path: 'reportes-uso',
                component: ReportsUsagePage,
            },
            {
                key: 'estadisticas-financieras',
                name: 'Estadísticas Financieras',
                path: 'estadisticas-financieras',
                component: FinancialStatisticsPage,
            },
        ],
    },
];
