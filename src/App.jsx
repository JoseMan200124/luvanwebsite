// src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import AuthProvider from './context/AuthProvider';
import MFAVerify from './components/MFAVerify';
import SchoolsManagementPage from './pages/SchoolsManagementPage';
import RoutesManagementPage from './pages/RoutesManagementPage';
import ProfilePage from './pages/ProfilePage';
import RolesManagementPage from './pages/RolesManagementPage';
import MonitorsManagementPage from './pages/MonitorsManagementPage'; // Asegúrate de importar este componente si existe
import ReportsUsagePage from "./pages/ReportsUsagePage";
import FinancialStatisticsPage from "./pages/FinancialStatisticsPage";
// Importa otros componentes según sea necesario

import { modules } from './modules';

function App() {
    const renderDynamicRoutes = () => {
        let routes = [];
        modules.forEach((module) => {
            module.submodules.forEach((submodule) => {
                routes.push(
                    <Route
                        key={submodule.path}
                        path={submodule.path.replace(/^\/+/, '')} // Remover barras iniciales
                        element={
                            <ProtectedRoute roles={submodule.roles}>
                                {/* Renderizar componente específico basado en el path */}
                                {getComponentByPath(submodule.path)}
                            </ProtectedRoute>
                        }
                    />
                );
            });
        });
        return routes;
    };

    const getComponentByPath = (path) => {
        switch (path) {
            case '/usuarios':
                return <RolesManagementPage />;
            case '/colegios':
                return <SchoolsManagementPage />;
            case '/rutas':
                return <RoutesManagementPage />;
            case '/colegios':
                return <SchoolsManagementPage />;
                case '/rutas':
                return <RoutesManagementPage />;
            // Añade más casos según los submódulos
            case '/monitores':
                return <MonitorsManagementPage />;
            case '/reportes-uso':
                return <ReportsUsagePage />;
            case '/estadisticas-financieras':
                return <FinancialStatisticsPage />;

            // Agrega más rutas aquí
            default:
                return <Dashboard />;
        }
    };

    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/mfa" element={<MFAVerify />} />

                    {/* Ruta protegida principal con layout */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <ProtectedLayout />
                            </ProtectedRoute>
                        }
                    >
                        {/* Rutas hijas protegidas */}
                        <Route index element={<Dashboard />} />

                        {/* Rutas dinámicas desde modules.js */}
                        {renderDynamicRoutes()}

                        {/* Rutas específicas */}
                        <Route
                            path="perfil"
                            element={
                                <ProtectedRoute roles={['Padre', 'Monitora', 'Piloto', 'Supervisor', 'Administrador']}>
                                    <ProfilePage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="roles-permisos"
                            element={
                                <ProtectedRoute roles={['Gestor', 'Administrador']}>
                                    <RolesManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="colegios"
                            element={
                                <ProtectedRoute roles={['Gestor', 'Administrador']}>
                                    <SchoolsManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="rutas"
                            element={
                                <ProtectedRoute roles={['Gestor', 'Administrador']}>
                                    <RoutesManagementPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="monitores"
                            element={
                                <ProtectedRoute roles={['Gestor', 'Administrador']}>
                                    <MonitorsManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="reportes-uso"
                            element={
                                <ProtectedRoute roles={['Gestor', 'Administrador']}>
                                    <ReportsUsagePage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="estadisticas-financieras"
                            element={
                                <ProtectedRoute roles={['Gestor', 'Administrador']}>
                                    <FinancialStatisticsPage />
                                </ProtectedRoute>
                            }
                        />
                            {/* Ruta por defecto para rutas no encontradas */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
