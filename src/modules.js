// modules.js
import {
    Group,
    School,
    BarChart,
    People,
    Security,
    Smartphone
} from '@mui/icons-material';

import RolesManagementPage from './pages/RolesManagementPage';
import MonitorsManagementPage from './pages/MonitorsManagementPage';
import PilotsManagementPage from './pages/PilotsManagementPage';
import SupervisorsManagementPage from './pages/SupervisorsManagementPage';
import AuxiliaresManagementPage from './pages/AuxiliaresManagementPage';
import ReportsUsagePage from './pages/ReportsUsagePage';
import FinancialStatisticsPage from './pages/FinancialStatisticsPage';
import BusesManagementPage from './pages/BusesManagementPage';
import ActivityLogPage from './pages/ActivityLogPage';
import BulkScheduleUpdatePage from './pages/BulkScheduleUpdatePage';
import SchoolYearSelectionPage from './pages/SchoolYearSelectionPage';
import AttendanceManagementPage from './pages/AttendanceManagementPage';
import StudentIncidentsPage from './pages/StudentIncidentsPage';
import BusIncidentsPage from './pages/BusIncidentsPage';
import RouteTimeLogsPage from './pages/RouteTimeLogsPage';
import FuelRecordsPage from './pages/FuelRecordsPage';
import CorporationsPage from './pages/CorporationsPage';

export const modules = [
    {
        key: 'gestion-usuarios-roles',
        name: 'Gestión de Usuarios y Roles',
        icon: Group,
        submodules: [
            {
                key: 'usuarios',
                name: 'Usuarios',
                path: 'usuarios',
                component: RolesManagementPage,
                roles: ['Administrador', 'Gestor'],
            },
        ],
    },
    {
        key: 'gestion-colegios-rutas',
        name: 'Gestión de Clientes y Rutas',
        icon: School,
        submodules: [
            {
                key: 'colegios',
                name: 'Colegios',
                path: 'colegios',
                component: SchoolYearSelectionPage,
                roles: ['Administrador', 'Gestor'],
            },
            {
                key: 'corporaciones',
                name: 'Corporaciones',
                path: 'corporaciones',
                component: CorporationsPage,
                roles: ['Administrador', 'Gestor'],
            },
            {
                key: 'buses',
                name: 'Buses',
                path: 'buses',
                component: BusesManagementPage,
                roles: ['Administrador', 'Gestor'],
            },
            {
                key: 'carga-masiva-horarios',
                name: 'Carga Masiva de Horarios',
                path: 'carga-masiva-horarios',
                component: BulkScheduleUpdatePage,
                roles: ['Administrador', 'Gestor'],
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
                roles: ['Administrador', 'Gestor'],
            },
            {
                key: 'estadisticas-financieras',
                name: 'Estadísticas Financieras',
                path: 'estadisticas-financieras',
                component: FinancialStatisticsPage,
                roles: ['Administrador', 'Gestor'],
            },
        ],
    },
    {
        key: 'gestion-personal',
        name: 'Gestión de Personal',
        icon: People,
        submodules: [
            {
                key: 'monitores',
                name: 'Monitores',
                path: 'monitores',
                component: MonitorsManagementPage,
                roles: ['Administrador', 'Gestor', 'Supervisor', 'Auxiliar'],
            },
            {
                key: 'pilotos',
                name: 'Pilotos',
                path: 'pilotos',
                component: PilotsManagementPage,
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
            {
                key: 'supervisores',
                name: 'Supervisores',
                path: 'supervisores',
                component: SupervisorsManagementPage,
                roles: ['Administrador', 'Gestor'],
            },
            {
                key: 'auxiliares',
                name: 'Auxiliares',
                path: 'auxiliares',
                component: AuxiliaresManagementPage,
                roles: ['Administrador', 'Gestor'],
            },
        ],
    },
    {
        key: 'operaciones-moviles',
        name: 'Operaciones Móviles',
        icon: Smartphone,
        submodules: [
            {
                key: 'asistencias',
                name: 'Asistencias',
                path: 'asistencias',
                component: AttendanceManagementPage,
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
            {
                key: 'incidentes-conducta',
                name: 'Reportes de Conducta',
                path: 'incidentes-conducta',
                component: StudentIncidentsPage,
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
            {
                key: 'incidentes-buses',
                name: 'Incidentes de Buses',
                path: 'incidentes-buses',
                component: BusIncidentsPage,
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
            {
                key: 'horarios-rutas',
                name: 'Horarios de Rutas',
                path: 'horarios-rutas',
                component: RouteTimeLogsPage,
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
            {
                key: 'registros-combustible',
                name: 'Registros de Combustible',
                path: 'registros-combustible',
                component: FuelRecordsPage,
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
        ],
    },
    {
        key: 'seguridad-auditoria',
        name: 'Seguridad y Auditoría',
        icon: Security,
        submodules: [
            {
                key: 'registro-actividades',
                name: 'Registro de Actividades',
                path: 'registro-actividades',
                component: ActivityLogPage,
                roles: ['Gestor', 'Administrador', 'Supervisor'],
            },
        ],
    },
];
