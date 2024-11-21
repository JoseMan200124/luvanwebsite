// src/components/Navbar.jsx

import React, { useState } from 'react';
import tw, { styled } from 'twin.macro';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import { Menu as MenuIcon, Close as CloseIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const StyledAppBar = styled(AppBar)`
    ${tw`bg-transparent shadow-none`}
`;

const NavLinks = styled.div`
    ${tw`hidden md:flex space-x-4`}
`;

const MobileMenu = styled.div`
    ${tw`w-64`}
`;

const Navbar = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const toggleDrawer = (open) => () => {
        setDrawerOpen(open);
    };

    return (
        <>
            <StyledAppBar position="fixed" color="transparent" elevation={0}>
                <Toolbar tw="flex justify-between">
                    <Typography variant="h6" tw="font-bold text-white">
                        Transportes Luvan
                    </Typography>
                    <NavLinks>
                        <Button component={RouterLink} to="/" color="inherit">
                            Inicio
                        </Button>
                        {/* <Button component={RouterLink} to="/servicios" color="inherit">
                            Servicios
                        </Button> */}
                        <Button
                            component={RouterLink}
                            to="#contacto"
                            color="inherit"
                            onClick={(e) => {
                                e.preventDefault();
                                const section = document.getElementById('contacto');
                                if (section) {
                                    section.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                        >
                            Contáctanos
                        </Button>
                        <Button component={RouterLink} to="/login" variant="outlined" color="inherit">
                            Iniciar Sesión
                        </Button>
                        <Button component={RouterLink} to="/register" variant="contained" color="secondary">
                            Registrarse
                        </Button>
                    </NavLinks>
                    {/* Icono de menú para móviles */}
                    <IconButton
                        edge="end"
                        color="inherit"
                        aria-label="menu"
                        tw="md:hidden"
                        onClick={toggleDrawer(true)}
                    >
                        <MenuIcon />
                    </IconButton>
                </Toolbar>
            </StyledAppBar>

            {/* Drawer para el menú móvil */}
            <Drawer anchor="right" open={drawerOpen} onClose={toggleDrawer(false)}>
                <MobileMenu>
                    <div tw="flex justify-between items-center p-4">
                        <Typography variant="h6" tw="font-bold">
                            Menu
                        </Typography>
                        <IconButton onClick={toggleDrawer(false)}>
                            <CloseIcon />
                        </IconButton>
                    </div>
                    <List>
                        <ListItem
                            button
                            component={RouterLink}
                            to="/"
                            onClick={() => {
                                const section = document.getElementById('contacto');
                                if (section) {
                                    section.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                        >
                            <ListItemText primary="Inicio" />
                        </ListItem>
                        {/* <ListItem button component={RouterLink} to="/servicios">
                            <ListItemText primary="Servicios" />
                        </ListItem> */}
                        <ListItem
                            button
                            component={RouterLink}
                            to="#contacto"
                            onClick={() => {
                                const section = document.getElementById('contacto');
                                if (section) {
                                    section.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                        >
                            <ListItemText primary="Contáctanos" />
                        </ListItem>
                        <ListItem button component={RouterLink} to="/login">
                            <ListItemText primary="Iniciar Sesión" />
                        </ListItem>
                        <ListItem button component={RouterLink} to="/register">
                            <ListItemText primary="Registrarse" />
                        </ListItem>
                    </List>
                </MobileMenu>
            </Drawer>
        </>
    );

};

export default Navbar;
