// src/components/Sidebar.jsx

import React, { useState, useContext } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, IconButton, Badge, Tooltip } from '@mui/material';
import {
    Menu as MenuIcon,
    Close as CloseIcon,
    ExpandLess,
    ExpandMore,
    Notifications,
    Group,
    School,
    BarChart,
    AttachMoney,
    People,
    ReportProblem,
    Security,
    Logout as LogoutIcon,
    AccountCircle,
    Settings,
} from '@mui/icons-material';
import { modules } from '../modules';
import { AuthContext } from '../context/AuthProvider';
import NotificationsMenu from './NotificationsMenu'; // Asegúrate de importar correctamente

const iconMap = {
    Group,
    School,
    BarChart,
    AttachMoney,
    Notifications,
    People,
    ReportProblem,
    Security,
    AccountCircle,
    Settings,
};

const SidebarContainer = styled.div`
    ${tw`bg-gray-800 text-white h-screen fixed top-0 left-0 z-50`}
    width: ${(props) => (props.isOpen ? '250px' : '60px')};
    transition: width 0.3s ease;
    overflow: visible; /* Aseguramos que el botón no se corte */
    @media (max-width: 768px) {
        width: ${(props) => (props.isOpen ? '100%' : '0')};
    }
`;

const SidebarHeader = styled.div`
    ${tw`flex items-center justify-between p-4 bg-gray-900 rounded-t-lg`}
`;

const ProfileInfo = tw.div`flex items-center`;
const ProfileDetails = tw.div`ml-4`;

const SidebarMenu = styled.ul`
    ${tw`mt-4`}
    padding: 0;
    list-style: none;
`;

const MenuItem = styled.li`
    ${tw`px-4 py-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center`}
    transition: background-color 0.2s ease;
`;

const SubMenuItem = styled.li`
    ${tw`px-8 py-2 hover:bg-gray-700 cursor-pointer`}
    transition: background-color 0.2s ease;
`;

const ToggleTab = styled.div`
    ${tw`absolute right-0 bg-red-500 rounded-r-md cursor-pointer`}
    width: 40px;
    height: 40px;
    top: 4%; /* Colocamos el botón a un 4% desde la parte superior */
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
    right: -20px; /* Ajusta para que sobresalga */
    @media (max-width: 768px) {
        right: -20px;
    }
`;

const LogoutItem = styled.li`
    ${tw`px-4 py-2 mt-auto hover:bg-gray-700 cursor-pointer flex items-center`}
    transition: background-color 0.2s ease;
`;

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const [openMenus, setOpenMenus] = useState({});
    const navigate = useNavigate();
    const { auth, logout } = useContext(AuthContext);

    const handleMenuClick = (index) => {
        if (!isOpen) {
            toggleSidebar(); // Abrimos el sidebar si está cerrado
            setOpenMenus({ [index]: true }); // Abrimos el submenú del módulo clicado
        } else {
            setOpenMenus({ ...openMenus, [index]: !openMenus[index] });
        }
    };

    // Asegurarse de que el usuario está autenticado
    if (!auth.user) {
        return null; // O muestra un spinner de carga
    }

    const user = {
        name: auth.user.name,
        role: auth.user.role,
        avatar: 'https://i.pravatar.cc/150?img=3', // Puedes obtener la foto real del usuario
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <>
            <SidebarContainer isOpen={isOpen}>
                <SidebarHeader>
                    {isOpen && (
                        <ProfileInfo>
                            <Avatar src={user.avatar} />
                            <ProfileDetails>
                                <div>{user.name}</div>
                                <div tw="text-sm text-gray-400">{user.role}</div>
                            </ProfileDetails>
                        </ProfileInfo>
                    )}
                </SidebarHeader>
                <SidebarMenu>
                    {modules.map((module, index) => {
                        // Verificar si el usuario tiene acceso a este módulo
                        const hasAccess = module.submodules.some(sub => {
                            if (sub.roles && Array.isArray(sub.roles)) {
                                return sub.roles.includes(user.role);
                            }
                            return true;
                        });

                        if (!hasAccess) return null;

                        const ModuleIcon = iconMap[module.icon] || Group;
                        return (
                            <div key={index}>
                                <MenuItem onClick={() => handleMenuClick(index)}>
                                    <div tw="flex items-center">
                                        {ModuleIcon && <ModuleIcon tw="mr-2" />}
                                        {isOpen && <span>{module.name}</span>}
                                    </div>
                                    {isOpen && (
                                        <>
                                            {openMenus[index] ? (
                                                <ExpandLess tw="text-gray-400" />
                                            ) : (
                                                <ExpandMore tw="text-gray-400" />
                                            )}
                                        </>
                                    )}
                                </MenuItem>
                                {isOpen && module.submodules && openMenus[index] && (
                                    <div>
                                        {module.submodules.map((submodule, subIndex) => {
                                            // Verificar si 'roles' está definido y si el usuario tiene acceso
                                            const canAccess = submodule.roles && Array.isArray(submodule.roles)
                                                ? submodule.roles.includes(user.role)
                                                : true; // Si 'roles' no está definido, permitir acceso

                                            if (!canAccess) return null;

                                            return (
                                                <Link
                                                    to={submodule.path}
                                                    key={subIndex}
                                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                                >
                                                    <SubMenuItem>
                                                        <span tw="text-sm">{submodule.name}</span>
                                                    </SubMenuItem>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </SidebarMenu>
                {/* Enlaces adicionales según el rol */}
                <SidebarMenu tw="flex flex-col mt-auto">
                    {/* Perfil de Usuario */}
                    <Link to="/perfil" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <MenuItem>
                            <div tw="flex items-center">
                                <AccountCircle tw="mr-2" />
                                {isOpen && <span>Perfil</span>}
                            </div>
                        </MenuItem>
                    </Link>
                    {/* Gestión de Roles y Permisos (solo para Administradores y Gestores) */}
                    {(user.role === 'Administrador' || user.role === 'Gestor') && (
                        <Link to="/roles-permisos" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <MenuItem>
                                <div tw="flex items-center">
                                    <Settings tw="mr-2" />
                                    {isOpen && <span>Roles y Permisos</span>}
                                </div>
                            </MenuItem>
                        </Link>
                    )}
                    {/* Logout */}
                    <LogoutItem onClick={handleLogout}>
                        <div tw="flex items-center">
                            <LogoutIcon tw="mr-2" />
                            {isOpen && <span>Cerrar Sesión</span>}
                        </div>
                    </LogoutItem>
                </SidebarMenu>
                {/* Toggle Button */}
                <ToggleTab onClick={toggleSidebar}>
                    {isOpen ? (
                        <CloseIcon style={{ color: 'white' }} />
                    ) : (
                        <MenuIcon style={{ color: 'white' }} />
                    )}
                </ToggleTab>
            </SidebarContainer>
            {/* Campana de Notificaciones */}
            <div
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 40,
                }}
            >
                <NotificationsMenu authToken={auth.token} />
            </div>
        </>
    );
};

export default Sidebar;