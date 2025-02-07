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
import PermissionsManagementPage from "./pages/PermissionsManagmentPage"; // Cambia si tu archivo se llama distinto
import ContractsManagementPage from './pages/ContractsManagementPage';
import ContractFillPage from './pages/ContractFillPage';
import ContractViewer from './pages/ContractViewer';
import FilledContractViewer from './pages/FilledContractViewer';
import SchoolsManagementPage from './pages/SchoolsManagementPage';
import SchoolEnrollmentPage from './pages/SchoolEnrollmentPage';

// El archivo con todos los módulos
import { modules } from './modules';
// Nuestro componente de redirección por defecto
import DefaultAdminRoute from './components/DefaultAdminRoute';

function App() {
    // Crea rutas dinámicas según "modules.js"
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

                    {/* Rutas para llenar contratos (públicas o semipúblicas) */}
                    <Route path="/contracts" element={<ContractsManagementPage />} />
                    <Route path="/contracts/share/:uuid" element={<ContractFillPage />} />

                    {/* Ver detalles de contratos llenados */}
                    <Route
                        path="/admin/contratos-llenados/:uuid"
                        element={
                            <ProtectedRoute roles={['Administrador', 'Supervisor', 'Gestor']}>
                                <FilledContractViewer />
                            </ProtectedRoute>
                        }
                    />

                    {/* Ver detalles de contratos originales */}
                    <Route
                        path="/admin/contratos/:uuid"
                        element={
                            <ProtectedRoute roles={['Administrador', 'Supervisor', 'Gestor']}>
                                <ContractViewer />
                            </ProtectedRoute>
                        }
                    />

                    {/* Ruta pública para inscripción de alumnos a un colegio */}
                    <Route
                        path="/schools/enroll/:schoolId"
                        element={<SchoolEnrollmentPage />}
                    />

                    {/* Rutas protegidas con layout */}
                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute>
                                <ProtectedLayout />
                            </ProtectedRoute>
                        }
                    >
                        {/* En lugar de redirigir por defecto al Dashboard,
                            ahora usamos <DefaultAdminRoute /> */}
                        <Route index element={<DefaultAdminRoute />} />

                        {/* Dashboard */}
                        <Route path="dashboard" element={<Dashboard />} />

                        {/* Rutas dinámicas según modules.js */}
                        {renderDynamicRoutes()}

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
