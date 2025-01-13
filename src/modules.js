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
import SchoolsManagementPage from './pages/SchoolsManagementPage';
import MonitorsManagementPage from './pages/MonitorsManagementPage';
import ReportsUsagePage from './pages/ReportsUsagePage';
import FinancialStatisticsPage from './pages/FinancialStatisticsPage';
import ContractsManagementPage from './pages/ContractsManagementPage';
import BusesManagementPage from './pages/BusesManagementPage';
import PaymentsManagementPage from './pages/PaymentsManagementPage';

/**
 * Cada "module" debe tener una key y un icon (opcional),
 * y cada "submodule" debe tener:
 *   key, name, path, component, roles (opcional).
 */
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
                component: RolesManagementPage, // Importado arriba
                roles: ['Administrador', 'Gestor'], // Ejemplo
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
                component: SchoolsManagementPage,
                roles: ['Administrador', 'Gestor'],
            },

            {
                key: 'buses',
                name: 'Buses',
                path: 'buses',
                component: BusesManagementPage,
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
                component: PaymentsManagementPage
            }
        ]
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
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
            {
                key: 'pilotos',
                name: 'Pilotos',
                path: 'pilotos',
                component: MonitorsManagementPage,
                roles: ['Administrador', 'Gestor', 'Supervisor'],
            },
            {
                key: 'supervisores',
                name: 'Supervisores',
                path: 'supervisores',
                component: MonitorsManagementPage,
                roles: ['Administrador', 'Supervisor'],
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
                component: FinancialStatisticsPage,
                roles: ['Administrador', 'Supervisor'],
            },
            {
                key: 'auditoria-seguridad',
                name: 'Auditoría de Seguridad',
                path: 'auditoria-seguridad',
                component: FinancialStatisticsPage,
                roles: ['Administrador', 'Supervisor'],
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
        ],
    },
];
