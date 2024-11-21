// src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage'; // Importar la Landing Page
import ProtectedRoute from './components/ProtectedRoute';
import AuthProvider from './context/AuthProvider';
import MFAVerify from './components/MFAVerify';
import SchoolsManagementPage from './pages/SchoolsManagementPage';
import RoutesManagementPage from './pages/RoutesManagementPage';
import ProfilePage from './pages/ProfilePage';
import RolesManagementPage from './pages/RolesManagementPage';
import MonitorsManagementPage from './pages/MonitorsManagementPage';
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
                        path={submodule.path}
                        element={
                            <ProtectedRoute roles={submodule.roles}>
                                {submodule.component}
                            </ProtectedRoute>
                        }
                    />
                );
            });
        });
        return routes;
    };

    return (
        <Router>
            <AuthProvider>
                <Routes>
                    {/* Ruta para la Landing Page */}
                    <Route path="/" element={<LandingPage />} />

                    {/* Rutas de Autenticación */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/mfa" element={<MFAVerify />} />

                    {/* Ruta protegida principal con layout */}
                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute>
                                <ProtectedLayout />
                            </ProtectedRoute>
                        }
                    >
                        {/* Rutas hijas protegidas */}
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />

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
                        {/* Añade más rutas específicas si es necesario */}

                        {/* Ruta por defecto para rutas no encontradas dentro de /admin */}
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Route>

                    {/* Ruta por defecto para rutas no encontradas */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
