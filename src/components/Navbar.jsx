// src/components/Navbar.jsx

import React, { useState, useEffect } from 'react';
import tw, { styled } from 'twin.macro';
import { HashLink } from 'react-router-hash-link'; // Importar HashLink
import { Menu as MenuIcon, Close as CloseIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

// Contenedor del Navbar con estilos dinámicos según el scroll
const NavbarContainer = styled.nav`
  ${tw`fixed top-0 left-0 w-full z-50 transition duration-300 ease-in-out`}
  background-color: ${({ scrolled }) => (scrolled ? '#FFFFFF' : 'transparent')};
  box-shadow: ${({ scrolled }) => (scrolled ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none')};
`;

// Contenedor interno para alinear contenido
const NavContent = tw.div`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`;

// Wrapper para el logo y los enlaces
const NavWrapper = tw.div`flex items-center justify-between h-16`;

// Sección del logo
const Logo = tw.div`flex-shrink-0`;

// Enlace del logo
const LogoLink = styled.a`
  ${tw`text-2xl font-bold text-black cursor-pointer`}
`;

// Botón para el menú móvil
const MenuIconButton = tw.button`inline-flex items-center justify-center p-2 rounded-md text-black focus:outline-none sm:hidden transition duration-300 ease-in-out`;

// Contenedor de enlaces para escritorio
const MenuLinks = styled.div`
  ${tw`hidden sm:flex items-center space-x-4`}
`;

// Menú desplegable para móviles
const MobileMenu = styled.div`
  ${tw`sm:hidden absolute top-16 left-0 w-full bg-white shadow-lg transition-all duration-300 ease-in-out`}
  max-height: ${({ open }) => (open ? '500px' : '0')};
  overflow: hidden;
`;

// Contenedor de enlaces dentro del menú móvil
const MobileMenuLinks = tw.div`flex flex-col px-4 py-6 space-y-4`;

// Estilo para enlaces del Navbar con animación de subrayado
const NavLink = styled(HashLink)`
  ${tw`relative text-black px-3 py-2 rounded-md text-sm font-medium cursor-pointer`}
  text-decoration: none;

  &::after {
    content: '';
    ${tw`absolute left-0 bottom-0 w-0 h-0.5 bg-green-600 transition-all duration-300`}
  }

  &:hover::after {
    ${tw`w-full`}
  }

  &:hover {
    color: #144CCC;
  }
`;

// Estilo para enlaces del menú móvil con animación de subrayado
const MobileNavLink = styled(HashLink)`
  ${tw`relative block text-black px-3 py-2 rounded-md text-base font-medium cursor-pointer`}
  text-decoration: none;

  &::after {
    content: '';
    ${tw`absolute left-0 bottom-0 w-0 h-0.5 bg-green-600 transition-all duration-300`}
  }

  &:hover::after {
    ${tw`w-full`}
  }

  &:hover {
    color: #144CCC;
  }
`;

// Botón para "Iniciar Sesión" en escritorio
const LoginButton = styled.button`
  ${tw`ml-4 px-4 py-2 rounded-full text-white font-semibold transition duration-300 ease-in-out`}
  background-color: #2D966C;
  &:hover {
    background-color: #1e704e;
  }
`;

// Botón para "Iniciar Sesión" en móvil
const MobileLoginButton = styled.button`
  ${tw`w-full text-center px-4 py-2 rounded-full text-white font-semibold transition duration-300 ease-in-out`}
  background-color: #2D966C;
  &:hover {
    background-color: #1e704e;
  }
`;

const Navbar = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Estado para el menú móvil
    const [scrolled, setScrolled] = useState(false); // Estado para cambiar estilos al hacer scroll
    const navigate = useNavigate(); // Hook para navegación programática
    const location = useLocation(); // Hook para detectar cambios de ruta

    // Función para alternar el menú móvil
    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    // Función para manejar el cambio de scroll
    const handleScroll = () => {
        const offset = window.scrollY;
        if (offset > 50) {
            setScrolled(true);
        } else {
            setScrolled(false);
        }
    };

    // Función para manejar el clic en "Iniciar Sesión"
    const handleLoginClick = () => {
        navigate('/login');
    };

    useEffect(() => {
        // Añadir listener para scroll
        window.addEventListener('scroll', handleScroll);
        // Cerrar el menú móvil al cambiar de ruta
        setMobileMenuOpen(false);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [location]);

    // Función para cerrar el menú móvil
    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    return (
        <NavbarContainer scrolled={scrolled}>
            <NavContent>
                <NavWrapper>
                    <Logo>
                        <LogoLink href="/">Transportes Luvan</LogoLink>
                    </Logo>
                    {/* Menú Desktop */}
                    <MenuLinks>
                        <NavLink
                            smooth
                            to="/#inicio"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Inicio
                        </NavLink>
                        <NavLink
                            smooth
                            to="/#servicios"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Servicios
                        </NavLink>
                        <NavLink
                            smooth
                            to="/#nosotros"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Sobre Nosotros
                        </NavLink>
                        <NavLink
                            smooth
                            to="/#contacto"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Contacto
                        </NavLink>
                        <LoginButton onClick={handleLoginClick}>Iniciar Sesión</LoginButton>
                    </MenuLinks>
                    {/* Botón del Menú Móvil */}
                    <MenuIconButton onClick={handleMobileMenuToggle} aria-label="Menu">
                        {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                    </MenuIconButton>
                </NavWrapper>
            </NavContent>
            {/* Menú Móvil */}
            <MobileMenu open={mobileMenuOpen}>
                <MobileMenuLinks>
                    <MobileNavLink
                        smooth
                        to="/#inicio"
                        scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        onClick={closeMobileMenu}
                    >
                        Inicio
                    </MobileNavLink>
                    <MobileNavLink
                        smooth
                        to="/#servicios"
                        scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        onClick={closeMobileMenu}
                    >
                        Servicios
                    </MobileNavLink>
                    <MobileNavLink
                        smooth
                        to="/#nosotros"
                        scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        onClick={closeMobileMenu}
                    >
                        Sobre Nosotros
                    </MobileNavLink>
                    <MobileNavLink
                        smooth
                        to="/#contacto"
                        scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        onClick={closeMobileMenu}
                    >
                        Contacto
                    </MobileNavLink>
                    <MobileLoginButton onClick={() => { closeMobileMenu(); handleLoginClick(); }}>
                        Iniciar Sesión
                    </MobileLoginButton>
                </MobileMenuLinks>
            </MobileMenu>
        </NavbarContainer>
    );
};

export default Navbar;
