// modules.js
import {
    Group,
    School,
    BarChart,
    Payments,
    People,
    Security,
    Description
} from '@mui/icons-material';

import RolesManagementPage from './pages/RolesManagementPage';
//import SchoolsManagementPage from './pages/SchoolsManagementPage';
import MonitorsManagementPage from './pages/MonitorsManagementPage';
import PilotsManagementPage from './pages/PilotsManagementPage';
import SupervisorsManagementPage from './pages/SupervisorsManagementPage';
import AuxiliaresManagementPage from './pages/AuxiliaresManagementPage';
import ReportsUsagePage from './pages/ReportsUsagePage';
import FinancialStatisticsPage from './pages/FinancialStatisticsPage';
import ContractsManagementPage from './pages/ContractsManagementPage';
import ProtocolsManagementPage from './pages/ProtocolsManagementPage';
import BusesManagementPage from './pages/BusesManagementPage';
import PaymentsManagementPage from './pages/PaymentsManagementPage';
import ActivityLogPage from './pages/ActivityLogPage';
import BulkScheduleUpdatePage from './pages/BulkScheduleUpdatePage';
import SchoolYearSelectionPage from './pages/SchoolYearSelectionPage';

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
        name: 'Gestión de Colegios y Rutas',
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
        key: 'pagos',
        name: 'Pagos y Cobros',
        icon: Payments,
        submodules: [
            {
                key: 'pagosIndex',
                name: 'Gestión de Pagos',
                path: 'pagos',
                roles: ['Administrador', 'Gestor'],
                component: PaymentsManagementPage,
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
    {
        key: 'contratos',
        name: 'Contratos',
        icon: Description,
        submodules: [
            {
                key: 'gestion-contratos',
                name: 'Gestión de Contratos',
                path: 'contratos',
                component: ContractsManagementPage,
                roles: ['Administrador', 'Gestor'],
            },
            {
                key: 'gestion-protocolos',
                name: 'Protocolos y Reglamentos',
                path: 'protocolos',
                component: ProtocolsManagementPage,
                roles: ['Administrador', 'Gestor'],
            },
        ],
    },
];
