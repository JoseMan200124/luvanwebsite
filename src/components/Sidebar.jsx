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
    History as HistoryIcon
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import NotificationsMenu from './NotificationsMenu';
import api from '../utils/axiosConfig';
import userImage from '../assets/img/user.png';
import { modules } from '../modules';

const ITEM_HEIGHT = 48;

// Offset inicial: altura de cabecera + primer item
const HEADER_OFFSET = 64 + ITEM_HEIGHT;

const SidebarContainer = styled.div`
    ${tw`bg-gray-800 text-white h-screen fixed top-0 left-0 z-40 flex flex-col`}
    width: ${({ isOpen }) => (isOpen ? '250px' : '60px')};
    transition: width 0.3s ease;
    overflow: hidden;

    @media (max-width: 768px) {
        width: ${({ isOpen }) => (isOpen ? '100%' : '0')};
    }
`;

const SidebarHeader = styled.div`
    ${tw`flex items-center justify-between p-4 bg-gray-900 rounded-t-lg`}
`;

const ProfileInfo    = tw.div`flex items-center`;
const ProfileDetails = tw.div`ml-4`;

const MainMenu    = styled.div`${tw`flex-1 overflow-y-auto`}`;
const SidebarMenu = styled.ul`${tw`mt-4`} list-style: none; margin: 0; padding: 0;`;
const MenuItem    = styled.li`${tw`px-4 py-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center`} height: ${ITEM_HEIGHT}px; transition: background-color 0.2s ease;`;
const SubMenuItem = styled.li`${tw`px-8 py-2 hover:bg-gray-700 cursor-pointer`} transition: background-color 0.2s ease;`;
const LogoutItem  = styled.li`${tw`px-4 py-2 mt-auto hover:bg-gray-700 cursor-pointer flex items-center`} transition: background-color 0.2s ease;`;

const ToggleTab = styled.div`
    ${tw`bg-red-500 cursor-pointer flex items-center justify-center shadow-md`}
    width: 40px;
    height: 40px;
    z-index: 1000;
    position: fixed;
    top: 10px;
    left: ${({ isOpen }) => (isOpen ? '250px' : '60px')};
    transition: all 0.3s ease;

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
`;

const PopoutList = styled.ul`list-style: none; margin: 0; padding: 0;`;
const PopoutItem = styled.li`${tw`px-4 py-2 hover:bg-gray-700 cursor-pointer`} transition: background-color 0.2s ease;`;

export default function Sidebar({ isOpen, toggleSidebar }) {
    const [openMenus, setOpenMenus] = useState({});
    const [permissions, setPermissions] = useState({});
    const { auth, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [hoveredItem, setHoveredItem] = useState(null);
    const hoverTimer = useRef(null);

    // Carga permisos al montar / cuando cambie el rol
    useEffect(() => {
        // El rol Auxiliar tiene acceso completo, no necesita cargar permisos
        if (auth?.user?.role === 'Auxiliar') {
            // Configurar todos los permisos como true para el rol Auxiliar
            const allPermissions = {};
            modules.forEach(module => {
                allPermissions[module.key] = true;
                if (module.submodules) {
                    module.submodules.forEach(submodule => {
                        allPermissions[submodule.key] = true;
                    });
                }
            });
            setPermissions(allPermissions);
            return;
        }
        
        if (auth?.token && auth?.user?.roleId) {
            api.get(`/permissions/role/${auth.user.roleId}`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            })
                .then(res => setPermissions(res.data.permissions || {}))
                .catch(console.error);
        }
    }, [auth?.token, auth?.user?.roleId, auth?.user?.role]);

    const handleMenuClick = idx => {
        if (!isOpen) return;
        setOpenMenus(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleLinkClick = () => {
        if (window.innerWidth < 768) toggleSidebar();
    };

    if (!auth?.user) return null;

    const user = { name: auth.user.name, role: auth.user.role, avatar: userImage };

    const canAccessDashboard = !!permissions['dashboard'];

    // Admin / Gestor
    const isAdminOrGestor = user.role === 'Administrador' || user.role === 'Gestor';

    /**
     * Visibilidad de "Roles y Permisos":
     * - Siempre se muestra para Admin / Gestor,
     *   sin importar qué valor venga en permissions['roles-permisos'].
     */
    const canSeeRolesPermisos = isAdminOrGestor;

    // Calcula la posición vertical del pop-up
    const getPopoutPosition = idx => HEADER_OFFSET + idx * ITEM_HEIGHT;

    const handleItemMouseEnter = (idx, hasSubs) => {
        if (!isOpen && hasSubs) {
            clearTimeout(hoverTimer.current);
            setHoveredItem(idx);
        }
    };

    const handleItemMouseLeave = (idx, hasSubs) => {
        if (!isOpen && hasSubs) {
            hoverTimer.current = setTimeout(() => setHoveredItem(null), 200);
        }
    };

    const handlePopoutMouseEnter = () => clearTimeout(hoverTimer.current);

    const handlePopoutMouseLeave = () => {
        hoverTimer.current = setTimeout(() => setHoveredItem(null), 200);
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

                <MainMenu>
                    <SidebarMenu>
                        {canAccessDashboard && (
                            <RouterLink
                                to="/admin/dashboard"
                                onClick={handleLinkClick}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <MenuItem>
                                    <div tw="flex items-center">
                                        <HomeIcon tw="mr-2" />
                                        {isOpen && <span>Dashboard</span>}
                                    </div>
                                </MenuItem>
                            </RouterLink>
                        )}

                        {/* Enlace a Historial (sin restricción por ahora) */}
                        <RouterLink
                            to="/admin/historial"
                            onClick={handleLinkClick}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <MenuItem>
                                <div tw="flex items-center">
                                    <HistoryIcon tw="mr-2" />
                                    {isOpen && <span>Historial</span>}
                                </div>
                            </MenuItem>
                        </RouterLink>

                        {/* Módulos dinámicos */}
                        {modules.map((module, idx) => {
                            if (!permissions[module.key]) return null;
                            const hasSubs = module.submodules?.length > 0;
                            const isOpenMenu = openMenus[idx];

                            return (
                                <React.Fragment key={module.key}>
                                    <MenuItem
                                        onMouseEnter={() => handleItemMouseEnter(idx, hasSubs)}
                                        onMouseLeave={() => handleItemMouseLeave(idx, hasSubs)}
                                        onClick={() => handleMenuClick(idx)}
                                    >
                                        <div tw="flex items-center">
                                            {module.icon && <module.icon tw="mr-2" />}
                                            {isOpen && <span>{module.name}</span>}
                                        </div>
                                        {isOpen && hasSubs && (isOpenMenu ? <ExpandLess /> : <ExpandMore />)}
                                    </MenuItem>

                                    {/* Submenú inline */}
                                    {isOpen && hasSubs && isOpenMenu && (
                                        <div>
                                            {module.submodules.map(sm => permissions[sm.key] && (
                                                <RouterLink
                                                    key={sm.key}
                                                    to={`/admin/${sm.path}`}
                                                    onClick={handleLinkClick}
                                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                                >
                                                    <SubMenuItem>{sm.name}</SubMenuItem>
                                                </RouterLink>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pop-up lateral cuando el sidebar está colapsado */}
                                    {!isOpen && hasSubs && hoveredItem === idx && (
                                        <SubMenuPopout
                                            popY={getPopoutPosition(idx)}
                                            onMouseEnter={handlePopoutMouseEnter}
                                            onMouseLeave={handlePopoutMouseLeave}
                                        >
                                            <PopoutList>
                                                {module.submodules.map(sm => permissions[sm.key] && (
                                                    <RouterLink
                                                        key={sm.key}
                                                        to={`/admin/${sm.path}`}
                                                        onClick={handleLinkClick}
                                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                                    >
                                                        <PopoutItem>{sm.name}</PopoutItem>
                                                    </RouterLink>
                                                ))}
                                            </PopoutList>
                                        </SubMenuPopout>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </SidebarMenu>
                </MainMenu>

                <SidebarMenu tw="flex flex-col">
                    {canSeeRolesPermisos && (
                        <RouterLink
                            to="/admin/roles-permisos"
                            onClick={handleLinkClick}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <MenuItem>
                                <div tw="flex items-center">
                                    <Settings tw="mr-2" />
                                    {isOpen && <span>Roles y Permisos</span>}
                                </div>
                            </MenuItem>
                        </RouterLink>
                    )}

                    <LogoutItem onClick={() => { handleLogout(); handleLinkClick(); }}>
                        <div tw="flex items-center">
                            <LogoutIcon tw="mr-2" />
                            {isOpen && <span>Cerrar Sesión</span>}
                        </div>
                    </LogoutItem>
                </SidebarMenu>
            </SidebarContainer>

            <ToggleTab isOpen={isOpen} onClick={toggleSidebar}>
                {isOpen
                    ? <CloseIcon style={{ color: 'white' }} />
                    : <MenuIcon style={{ color: 'white' }} />
                }
            </ToggleTab>

            {/* Notificaciones */}
            <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 999 }}>
                <NotificationsMenu authToken={auth.token} />
            </div>
        </>
    );
}
