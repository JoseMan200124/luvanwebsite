// src/components/Navbar.jsx

import React, { useState, useEffect } from 'react';
import tw, { styled } from 'twin.macro';
import { HashLink } from 'react-router-hash-link';
import { Menu as MenuIcon, Close as CloseIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const NavbarContainer = styled.nav`
    ${tw`fixed top-0 left-0 w-full z-50 transition duration-300 ease-in-out`}
    background-color: ${({ scrolled }) => (scrolled ? '#FFFFFF' : 'transparent')};
    box-shadow: ${({ scrolled }) => (scrolled ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none')};
`;

const NavContent = tw.div`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`;
const NavWrapper = tw.div`flex items-center justify-between h-16`;

const Logo = tw.div`flex-shrink-0`;

const LogoLink = styled.a`
    ${tw`text-2xl font-bold cursor-pointer`}
    color: ${({ scrolled }) => (scrolled ? '#000000' : '#FFFFFF')};
    transition: color 0.3s ease-in-out;
`;

const MenuIconButton = styled.button`
    ${tw`inline-flex items-center justify-center p-2 rounded-md focus:outline-none sm:hidden transition duration-300 ease-in-out`}
    color: ${({ scrolled }) => (scrolled ? '#000000' : '#FFFFFF')};
`;

const MenuLinks = styled.div`
    ${tw`hidden sm:flex items-center space-x-4`}
`;

const MobileMenu = styled.div`
    ${tw`sm:hidden absolute top-16 left-0 w-full transition-all duration-300 ease-in-out`}
    background-color: #FFFFFF;
    box-shadow: ${({ scrolled }) => (scrolled ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none')};
    max-height: ${({ open }) => (open ? '500px' : '0')};
    overflow: hidden;
`;

const MobileMenuLinks = tw.div`flex flex-col px-4 py-6 space-y-4`;

const NavLink = styled(HashLink)`
    ${tw`relative px-3 py-2 rounded-md text-sm font-medium cursor-pointer`}
    text-decoration: none;
    color: ${({ scrolled }) => (scrolled ? '#000000' : '#FFFFFF')};
    transition: color 0.3s ease-in-out;

    &::after {
        content: '';
        ${tw`absolute left-0 bottom-0 h-0.5 bg-green-600 transition-all duration-300`}
        width: 0;
    }

    &:hover::after {
        width: 100%;
    }

    &:hover {
        color: #144ccc;
    }
`;

const MobileNavLink = styled(HashLink)`
    ${tw`relative block px-3 py-2 rounded-md text-base font-medium cursor-pointer`}
    text-decoration: none;
    color: #000000;
    transition: color 0.3s ease-in-out;

    &::after {
        content: '';
        ${tw`absolute left-0 bottom-0 h-0.5 bg-green-600 transition-all duration-300`}
        width: 0;
    }

    &:hover::after {
        width: 100%;
    }

    &:hover {
        color: #144ccc;
    }
`;

const LoginButton = styled.button`
    ${tw`ml-4 px-4 py-2 rounded-full font-semibold transition duration-300 ease-in-out`}
    background-color: #2D966C;
    color: #FFFFFF;
    &:hover {
        background-color: #1e704e;
    }
`;

const MobileLoginButton = styled.button`
    ${tw`w-full text-center px-4 py-2 rounded-full font-semibold transition duration-300 ease-in-out`}
    background-color: #2D966C;
    color: #FFFFFF;
    &:hover {
        background-color: #1e704e;
    }
`;

const Navbar = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const handleScroll = () => {
        const offset = window.scrollY;
        if (offset > 50) {
            setScrolled(true);
        } else {
            setScrolled(false);
        }
    };

    const handleLoginClick = () => {
        navigate('/login');
    };

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        setMobileMenuOpen(false);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [location]);

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    return (
        <NavbarContainer scrolled={scrolled}>
            <NavContent>
                <NavWrapper>
                    <Logo>
                        <LogoLink href="/" scrolled={scrolled}>
                            Transportes Luvan
                        </LogoLink>
                    </Logo>

                    {/* Menú de escritorio */}
                    <MenuLinks>
                        <NavLink
                            scrolled={scrolled}
                            smooth
                            to="/#inicio"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Inicio
                        </NavLink>
                        <NavLink
                            scrolled={scrolled}
                            smooth
                            to="/#servicios"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Servicios
                        </NavLink>
                        <NavLink
                            scrolled={scrolled}
                            smooth
                            to="/#nosotros"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Sobre Nosotros
                        </NavLink>
                        <NavLink
                            scrolled={scrolled}
                            smooth
                            to="/#contacto"
                            scroll={(el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Contacto
                        </NavLink>
                        <LoginButton onClick={handleLoginClick}>Iniciar Sesión</LoginButton>
                    </MenuLinks>

                    {/* Botón Menú Móvil */}
                    <MenuIconButton onClick={handleMobileMenuToggle} aria-label="Menu" scrolled={scrolled}>
                        {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                    </MenuIconButton>
                </NavWrapper>
            </NavContent>

            {/* Menú Móvil */}
            <MobileMenu open={mobileMenuOpen} scrolled={scrolled}>
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
                    <MobileLoginButton
                        onClick={() => {
                            closeMobileMenu();
                            handleLoginClick();
                        }}
                    >
                        Iniciar Sesión
                    </MobileLoginButton>
                </MobileMenuLinks>
            </MobileMenu>
        </NavbarContainer>
    );
};

export default Navbar;
