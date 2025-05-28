// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import ProtectedRoute from './components/ProtectedRoute';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import AuthProvider from './context/AuthProvider';
import MFAVerify from './components/MFAVerify';
import PermissionsManagementPage from './pages/PermissionsManagmentPage';
import ContractsManagementPage from './pages/ContractsManagementPage';
import ContractFillPage from './pages/ContractFillPage';
import ContractViewer from './pages/ContractViewer';
import FilledContractViewer from './pages/FilledContractViewer';
import SchoolsManagementPage from './pages/SchoolsManagementPage';
import SchoolEnrollmentPage from './pages/SchoolEnrollmentPage';
import ThankYouPage from './pages/ThankYouPage';
import DefaultAdminRoute from './components/DefaultAdminRoute';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';
import UpdateParentInfoPage from './pages/UpdateParentInfoPage';
import ParentDashboardPage from './pages/ParentDashboardPage';
import ParentPaymentPage   from './pages/ParentPaymentPage';
import { modules } from './modules';

function App() {
    /* ------------------------------------------------------ */
    /* Rutas dinámicas de módulos (panel administrativo)      */
    /* ------------------------------------------------------ */
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
                    {/* ------------------ Rutas públicas ------------------ */}
                    <Route path="/"                 element={<LandingPage />} />
                    <Route path="/login"            element={<LoginPage />} />
                    <Route path="/register"         element={<RegisterPage />} />
                    <Route path="/mfa"              element={<MFAVerify />} />
                    <Route path="/privacy-policy"   element={<PrivacyPolicyPage />} />
                    <Route path="/thank-you"        element={<ThankYouPage />} />
                    <Route path="/update-parent-info" element={<UpdateParentInfoPage />} />

                    {/* Forzar cambio de contraseña */}
                    <Route path="/force-password-change" element={<ForcePasswordChangePage />} />

                    {/* Contratos públicos */}
                    <Route path="/contracts"                 element={<ContractsManagementPage />} />
                    <Route path="/contracts/share/:uuid"     element={<ContractFillPage />} />

                    {/* Contratos protegidos */}
                    <Route
                        path="/admin/contratos-llenados/:uuid"
                        element={
                            <ProtectedRoute roles={['Administrador','Supervisor','Gestor']}>
                                <FilledContractViewer />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/contratos/:uuid"
                        element={
                            <ProtectedRoute roles={['Administrador','Supervisor','Gestor']}>
                                <ContractViewer />
                            </ProtectedRoute>
                        }
                    />

                    {/* Inscripción colegios (pública) */}
                    <Route path="/schools/enroll/:schoolId" element={<SchoolEnrollmentPage />} />

                    {/* ---------------- Panel administrativo -------------- */}
                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute>
                                <ProtectedLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index           element={<DefaultAdminRoute />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        {renderDynamicRoutes()}

                        <Route
                            path="roles-permisos"
                            element={
                                <ProtectedRoute roles={['Gestor','Administrador']}>
                                    <PermissionsManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        {/* Redirect genérico */}
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Route>

                    {/* ---------------- Área PADRES (sin sidebar) --------- */}
                    <Route
                        path="/parent/dashboard"
                        element={
                            <ProtectedRoute roles={['Padre','PadreFamilia',3]}>
                                <ParentDashboardPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent/payment"
                        element={
                            <ProtectedRoute roles={['Padre','PadreFamilia',3]}>
                                <ParentPaymentPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
