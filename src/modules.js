// src/modules.js

import RolesManagementPage from './pages/RolesManagementPage';
import SchoolsManagementPage from './pages/SchoolsManagementPage';
import RoutesManagementPage from './pages/RoutesManagementPage';
import MonitorsManagementPage from './pages/MonitorsManagementPage';
import ReportsUsagePage from './pages/ReportsUsagePage';
import FinancialStatisticsPage from './pages/FinancialStatisticsPage';
import ContractsManagementPage from './pages/ContractsManagementPage';

// Importa otros componentes según sea necesario

export const modules = [
    {
        name: 'Gestión de Usuarios y Roles',
        icon: 'Group',
        submodules: [
            { name: 'Usuarios', path: 'usuarios', roles: ['Gestor', 'Administrador'], component: <RolesManagementPage /> },
            // Añade más submódulos según sea necesario
        ],
    },
    {
        name: 'Gestión de Colegios y Rutas',
        icon: 'School',
        submodules: [
            { name: 'Colegios', path: 'colegios', roles: ['Gestor', 'Administrador'], component: <SchoolsManagementPage /> },
            { name: 'Rutas', path: 'rutas', roles: ['Gestor', 'Administrador'], component: <RoutesManagementPage /> },
            // Añade más submódulos según sea necesario
        ],
    },
    {
        name: 'Reportes y Estadísticas',
        icon: 'BarChart',
        submodules: [
            { name: 'Reportes de Uso', path: 'reportes-uso', roles: ['Gestor', 'Administrador'], component: <ReportsUsagePage /> },
            { name: 'Estadísticas Financieras', path: 'estadisticas-financieras', roles: ['Gestor', 'Administrador'], component: <FinancialStatisticsPage /> },
            // Asegúrate de que cada submódulo tenga 'roles'
        ],
    },
    {
        name: 'Gestión Financiera',
        icon: 'AttachMoney',
        submodules: [
            { name: 'Facturación', path: 'facturacion', roles: ['Administrador'], component: <FinancialStatisticsPage /> }, // Asigna el componente adecuado
            { name: 'Pagos y Cobros', path: 'pagos-cobros', roles: ['Administrador'], component: <FinancialStatisticsPage /> }, // Asigna el componente adecuado
            // Añade más submódulos según sea necesario
        ],
    },
    {
        name: 'Gestión de Personal',
        icon: 'People',
        submodules: [
            { name: 'Monitores', path: 'monitores', roles: ['Gestor', 'Administrador'], component: <MonitorsManagementPage /> },
            { name: 'Pilotos', path: 'pilotos', roles: ['Gestor', 'Administrador'], component: <MonitorsManagementPage /> }, // Asigna el componente adecuado
            { name: 'Supervisores', path: 'supervisores', roles: ['Administrador'], component: <MonitorsManagementPage /> }, // Asigna el componente adecuado
            // Añade más submódulos según sea necesario
        ],
    },
    {
        name: 'Seguridad y Auditoría',
        icon: 'Security',
        submodules: [
            { name: 'Registro de Actividades', path: 'registro-actividades', roles: ['Administrador'], component: <FinancialStatisticsPage /> }, // Asigna el componente adecuado
            { name: 'Auditoría de Seguridad', path: 'auditoria-seguridad', roles: ['Administrador'], component: <FinancialStatisticsPage /> }, // Asigna el componente adecuado
            // Añade más submódulos según sea necesario
        ],
    },
    {
        name: 'Contratos',
        icon: 'Description',
        submodules: [
            {
                name: 'Gestión de Contratos',
                path: 'contratos',
                roles: ['Administrador', 'Gestor'],
                component: <ContractsManagementPage />,
            },
        ],
    },
    // Continúa añadiendo los demás módulos y submódulos con 'roles'
];
