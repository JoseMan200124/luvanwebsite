// src/components/Sidebar.jsx

import React, { useState, useContext, useEffect } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Avatar } from '@mui/material';
import {
    Menu as MenuIcon,
    Close as CloseIcon,
    ExpandLess,
    ExpandMore,
    Logout as LogoutIcon,
    AccountCircle,
    Settings,
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import NotificationsMenu from './NotificationsMenu';
import api from '../utils/axiosConfig';
import userImage from '../assets/img/user.png';
import { modules } from '../modules';

// =============== Estilos con styled-components y twin.macro ===============
const SidebarContainer = styled.div`
    ${tw`bg-gray-800 text-white h-screen fixed top-0 left-0 z-50 flex flex-col`}
    width: ${(props) => (props.isOpen ? '250px' : '60px')};
    transition: width 0.3s ease;
    overflow: hidden;
    @media (max-width: 768px) {
        width: ${(props) => (props.isOpen ? '250px' : '0')};
    }
`;

const SidebarHeader = styled.div`
    ${tw`flex items-center justify-between p-4 bg-gray-900 rounded-t-lg`}
`;

const ProfileInfo = tw.div`flex items-center`;
const ProfileDetails = tw.div`ml-4`;

const MainMenu = styled.div`
    ${tw`flex-1 overflow-y-auto`}
`;

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
    ${tw`absolute bg-red-500 rounded-r-md cursor-pointer`}
    width: 40px;
    height: 40px;
    top: 10px;
    right: -20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
    @media (min-width: 769px) {
        display: none;
    }
`;

const LogoutItem = styled.li`
    ${tw`px-4 py-2 mt-auto hover:bg-gray-700 cursor-pointer flex items-center`}
    transition: background-color 0.2s ease;
`;

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const [openMenus, setOpenMenus] = useState({});
    const [permissions, setPermissions] = useState({});
    const navigate = useNavigate();
    const { auth, logout } = useContext(AuthContext);

    // 1) Cargar permisos del usuario logueado
    useEffect(() => {
        if (auth?.token && auth?.user?.roleId) {
            fetchUserPermissions(auth.user.roleId);
        }
    }, [auth?.token, auth?.user?.roleId]);

    const fetchUserPermissions = async (roleId) => {
        try {
            const res = await api.get(`/permissions/role/${roleId}`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            setPermissions(res.data.permissions || {});
        } catch (err) {
            console.error('Error obteniendo permisos de usuario:', err);
        }
    };

    // 2) Manejo de apertura/cierre de submenús
    const handleMenuClick = (index) => {
        setOpenMenus((prev) => ({ ...prev, [index]: !prev[index] }));
    };

    // 3) Logout
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Si no hay usuario autenticado, no renderizamos nada
    if (!auth.user) {
        return null;
    }

    const user = {
        name: auth.user.name,
        role: auth.user.role,
        avatar: userImage,
    };

    return (
        <>
            <SidebarContainer isOpen={isOpen}>
                {/* Encabezado con perfil de usuario */}
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

                {/* Menú principal */}
                <MainMenu>
                    <SidebarMenu>
                        {modules.map((module, index) => {
                            const { key, name, icon: ModuleIcon, submodules } = module;

                            const canAccessModule = !!permissions[key];
                            if (!canAccessModule) return null;

                            return (
                                <div key={key}>
                                    <MenuItem onClick={() => handleMenuClick(index)}>
                                        <div tw="flex items-center">
                                            {/* Icono dinámico (ModuleIcon) si existe; sino muestra algo por defecto */}
                                            {ModuleIcon && <ModuleIcon tw="mr-2" />}
                                            {isOpen && <span>{name}</span>}
                                        </div>
                                        {isOpen && (
                                            openMenus[index] ? <ExpandLess /> : <ExpandMore />
                                        )}
                                    </MenuItem>

                                    {/* Submódulos */}
                                    {isOpen && submodules && openMenus[index] && (
                                        <div>
                                            {submodules.map((submodule) => {
                                                const { key: subKey, name: subName, path } = submodule;
                                                const canAccessSub = !!permissions[subKey];
                                                if (!canAccessSub) return null;

                                                return (
                                                    <RouterLink
                                                        to={`/admin/${path}`}
                                                        key={subKey}
                                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                                    >
                                                        <SubMenuItem>
                                                            <span tw="text-sm">{subName}</span>
                                                        </SubMenuItem>
                                                    </RouterLink>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </SidebarMenu>
                </MainMenu>

                <SidebarMenu tw="flex flex-col">

                    {(user.role === 'Administrador' || user.role === 'Gestor') && (
                        <RouterLink to="/admin/roles-permisos" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <MenuItem>
                                <div tw="flex items-center">
                                    <Settings tw="mr-2" />
                                    {isOpen && <span>Roles y Permisos</span>}
                                </div>
                            </MenuItem>
                        </RouterLink>
                    )}

                    {/* Logout */}
                    <LogoutItem onClick={handleLogout}>
                        <div tw="flex items-center">
                            <LogoutIcon tw="mr-2" />
                            {isOpen && <span>Cerrar Sesión</span>}
                        </div>
                    </LogoutItem>
                </SidebarMenu>

                <ToggleTab onClick={toggleSidebar}>
                    {isOpen ? (
                        <CloseIcon style={{ color: 'white' }} />
                    ) : (
                        <MenuIcon style={{ color: 'white' }} />
                    )}
                </ToggleTab>
            </SidebarContainer>

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
