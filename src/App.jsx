// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import ProtectedRoute from './components/ProtectedRoute';
import AuthProvider from './context/AuthProvider';
import MFAVerify from './components/MFAVerify';
import PermissionsManagementPage from "./pages/PermissionsManagmentPage";
import ProfilePage from './pages/ProfilePage';

// Importas tu "modules" que definimos arriba
import { modules } from './modules';

function App() {

    // Este método crea <Route> dinámicos para cada submódulo
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
                                {/* AQUÍ la corrección: Invocamos al componente con <submodule.component /> */}
                                <submodule.component />
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
                    {/* Rutas públicas */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/mfa" element={<MFAVerify />} />

                    {/* Rutas protegidas con layout */}
                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute>
                                <ProtectedLayout />
                            </ProtectedRoute>
                        }
                    >
                        {/* Ruta por defecto al dashboard */}
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />

                        {/* Rutas dinámicas generadas a partir de "modules.js" */}
                        {renderDynamicRoutes()}

                        {/* Perfil del usuario */}
                        <Route
                            path="perfil"
                            element={
                                <ProtectedRoute roles={['Padre', 'Monitora', 'Piloto', 'Supervisor', 'Administrador']}>
                                    <ProfilePage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Roles y Permisos */}
                        <Route
                            path="roles-permisos"
                            element={
                                <ProtectedRoute roles={['Gestor', 'Administrador']}>
                                    <PermissionsManagementPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Cualquier otra ruta dentro de /admin que no coincida */}
                        <Route
                            path="*"
                            element={<Navigate to="dashboard" replace />}
                        />
                    </Route>

                    {/* Resto de rutas que no coincidan */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
