// src/components/Sidebar.jsx
import React, { useState, useContext, useEffect, useRef } from 'react';
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
    Settings,
    Home as HomeIcon,
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import NotificationsMenu from './NotificationsMenu';
import api from '../utils/axiosConfig';
import userImage from '../assets/img/user.png';
import { modules } from '../modules';

const ITEM_HEIGHT = 48;

const SidebarContainer = styled.div`
    ${tw`bg-gray-800 text-white h-screen fixed top-0 left-0 z-40 flex flex-col`}
    width: ${({ isOpen }) => (isOpen ? '250px' : '60px')};
    transition: width 0.3s ease;
    overflow: hidden;

    @media (max-width: 768px) {
        /* En móviles, el sidebar ocupa todo el ancho al estar abierto */
        width: ${({ isOpen }) => (isOpen ? '100%' : '0')};
    }
`;

const SidebarHeader = styled.div`
    ${tw`flex items-center justify-between p-4 bg-gray-900 rounded-t-lg relative`}
`;

const ProfileInfo = tw.div`flex items-center`;
const ProfileDetails = tw.div`ml-4`;

const MainMenu = styled.div`
    ${tw`flex-1 overflow-y-auto`}
`;

const SidebarMenu = styled.ul`
    ${tw`mt-4`}
    list-style: none;
    margin: 0;
    padding: 0;
`;

const MenuItem = styled.li`
    ${tw`px-4 py-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center`}
    transition: background-color 0.2s ease;
    height: ${ITEM_HEIGHT}px;
    position: relative;
`;

const SubMenuItem = styled.li`
    ${tw`px-8 py-2 hover:bg-gray-700 cursor-pointer`}
    transition: background-color 0.2s ease;
`;

const LogoutItem = styled.li`
    ${tw`px-4 py-2 mt-auto hover:bg-gray-700 cursor-pointer flex items-center`}
    transition: background-color 0.2s ease;
`;

/*
  ToggleTab:
  - En ordenadores se usa la posición original (usando left:
    • Si el sidebar está abierto: left: 250px
    • Si está cerrado: left: 60px)
  - En móviles (max-width: 768px) se reubica el botón usando right: 60px,
    de modo que quede a la par del ícono de notificaciones (ubicado en right: 10px).
*/
const ToggleTab = styled.div`
    ${tw`bg-red-500 cursor-pointer flex items-center justify-center shadow-md`}
    width: 40px;
    height: 40px;
    z-index: 1000; /* Asegura prioridad en el apilamiento */
    transition: all 0.3s ease;
    position: fixed;
    top: 10px;
    left: ${({ isOpen }) => (isOpen ? '250px' : '60px')};

    @media (max-width: 768px) {
        left: auto;
        right: 60px;
    }
`;

const SubMenuPopout = styled.div`
    ${tw`bg-gray-800 text-white rounded-md shadow-lg`}
    position: fixed;
    left: 60px;
    top: ${({ popY }) => `${popY}px`};
    width: 200px;
    z-index: 60;
    border: 1px solid #444;
    overflow: hidden;
`;

const PopoutList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
`;

const PopoutItem = styled.li`
    ${tw`px-4 py-2 hover:bg-gray-700 cursor-pointer`}
    transition: background-color 0.2s ease;
`;

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const [openMenus, setOpenMenus] = useState({});
    const [permissions, setPermissions] = useState({});
    const { auth, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [hoveredItem, setHoveredItem] = useState(null);
    const hoverTimer = useRef(null);

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

    const handleMenuClick = (index) => {
        if (!isOpen) return;
        setOpenMenus((prev) => ({ ...prev, [index]: !prev[index] }));
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Función auxiliar para cerrar el sidebar al seleccionar una opción (por ejemplo, en móviles)
    const handleLinkClick = () => {
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    if (!auth.user) {
        return null;
    }

    const user = {
        name: auth.user.name,
        role: auth.user.role,
        avatar: userImage,
    };

    const getPopoutPosition = (index) => {
        const headerOffset = 64;
        return headerOffset + index * ITEM_HEIGHT;
    };

    const handleItemMouseEnter = (index, hasSubmodules) => {
        if (!isOpen && hasSubmodules) {
            if (hoverTimer.current) {
                clearTimeout(hoverTimer.current);
            }
            setHoveredItem(index);
        }
    };

    const handleItemMouseLeave = (index, hasSubmodules) => {
        if (!isOpen && hasSubmodules) {
            hoverTimer.current = setTimeout(() => {
                setHoveredItem(null);
            }, 200);
        }
    };

    const handlePopoutMouseEnter = () => {
        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
        }
    };

    const handlePopoutMouseLeave = () => {
        hoverTimer.current = setTimeout(() => {
            setHoveredItem(null);
        }, 200);
    };

    // Verifica si el usuario tiene permiso de Dashboard
    const canAccessDashboard = !!permissions['dashboard'];

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

                <MainMenu>
                    <SidebarMenu>
                        {canAccessDashboard && (
                            <RouterLink
                                to="/admin/dashboard"
                                onClick={handleLinkClick}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <MenuItem
                                    onMouseEnter={() => setHoveredItem(null)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                >
                                    <div tw="flex items-center">
                                        <HomeIcon tw="mr-2" />
                                        {isOpen && <span>Dashboard</span>}
                                    </div>
                                </MenuItem>
                            </RouterLink>
                        )}

                        {/* Módulos dinámicos */}
                        {modules.map((module, index) => {
                            const { key, name, icon: ModuleIcon, submodules } = module;
                            const canAccessModule = !!permissions[key];
                            if (!canAccessModule) return null;

                            const hasSubmodules = submodules && submodules.length > 0;
                            const isMenuOpen = openMenus[index];

                            return (
                                <React.Fragment key={key}>
                                    <MenuItem
                                        onMouseEnter={() => handleItemMouseEnter(index, hasSubmodules)}
                                        onMouseLeave={() => handleItemMouseLeave(index, hasSubmodules)}
                                        onClick={() => handleMenuClick(index)}
                                    >
                                        <div tw="flex items-center">
                                            {ModuleIcon && <ModuleIcon tw="mr-2" />}
                                            {isOpen && <span>{name}</span>}
                                        </div>
                                        {isOpen && hasSubmodules && (
                                            isMenuOpen ? <ExpandLess /> : <ExpandMore />
                                        )}
                                    </MenuItem>

                                    {/* Submenú inline cuando el sidebar está expandido */}
                                    {isOpen && hasSubmodules && isMenuOpen && (
                                        <div>
                                            {submodules.map((submodule) => {
                                                const { key: subKey, name: subName, path } = submodule;
                                                const canAccessSub = !!permissions[subKey];
                                                if (!canAccessSub) return null;

                                                return (
                                                    <RouterLink
                                                        to={`/admin/${path}`}
                                                        onClick={handleLinkClick}
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

                                    {/* Popout (cuando el sidebar está cerrado) */}
                                    {!isOpen && hasSubmodules && hoveredItem === index && (
                                        <SubMenuPopout
                                            popY={getPopoutPosition(index)}
                                            onMouseEnter={handlePopoutMouseEnter}
                                            onMouseLeave={handlePopoutMouseLeave}
                                        >
                                            <PopoutList>
                                                {submodules.map((submodule) => {
                                                    const { key: subKey, name: subName, path } = submodule;
                                                    const canAccessSub = !!permissions[subKey];
                                                    if (!canAccessSub) return null;

                                                    return (
                                                        <RouterLink
                                                            to={`/admin/${path}`}
                                                            onClick={handleLinkClick}
                                                            key={subKey}
                                                            style={{ textDecoration: 'none', color: 'inherit' }}
                                                        >
                                                            <PopoutItem>{subName}</PopoutItem>
                                                        </RouterLink>
                                                    );
                                                })}
                                            </PopoutList>
                                        </SubMenuPopout>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </SidebarMenu>
                </MainMenu>

                {/* Roles & Permisos + Logout */}
                <SidebarMenu tw="flex flex-col">
                    {(user.role === 'Administrador' || user.role === 'Gestor') && (
                        <RouterLink
                            to="/admin/roles-permisos"
                            onClick={handleLinkClick}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <MenuItem
                                onMouseEnter={() => setHoveredItem(null)}
                                onMouseLeave={() => setHoveredItem(null)}
                            >
                                <div tw="flex items-center">
                                    <Settings tw="mr-2" />
                                    {isOpen && <span>Roles y Permisos</span>}
                                </div>
                            </MenuItem>
                        </RouterLink>
                    )}

                    <LogoutItem
                        onMouseEnter={() => setHoveredItem(null)}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={() => {
                            handleLogout();
                            handleLinkClick();
                        }}
                    >
                        <div tw="flex items-center">
                            <LogoutIcon tw="mr-2" />
                            {isOpen && <span>Cerrar Sesión</span>}
                        </div>
                    </LogoutItem>
                </SidebarMenu>
            </SidebarContainer>

            <ToggleTab isOpen={isOpen} onClick={toggleSidebar}>
                {isOpen ? (
                    <CloseIcon style={{ color: 'white' }} />
                ) : (
                    <MenuIcon style={{ color: 'white' }} />
                )}
            </ToggleTab>

            {/* Menú de notificaciones */}
            <div
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 999,
                }}
            >
                <NotificationsMenu authToken={auth.token} />
            </div>
        </>
    );
};

export default Sidebar;
