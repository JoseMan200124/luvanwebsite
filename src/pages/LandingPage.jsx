// src/pages/LandingPage.jsx

import React from 'react';
import tw, { styled } from 'twin.macro';
import { Typography, Container, Grid, Card, CardContent, TextField, Button, IconButton, Snackbar, Alert } from '@mui/material';
import { Phone, Email, AccessTime, LocationOn, Facebook, Twitter, Instagram, Group } from '@mui/icons-material';
import Navbar from '../components/Navbar'; // Importar el nuevo Navbar
import { Link } from 'react-router-dom';
import landingBg from '../assets/img/landing-bg.jpg';
import logoLuvan from '../assets/img/logo-luvan.jpg';

// Estilos personalizados utilizando styled-components y twin.macro
const HeroSection = styled.section`
    ${tw`flex items-center justify-center bg-cover bg-center h-screen relative`}
    background-image: url(${landingBg});
`;

const Overlay = tw.div`bg-black bg-opacity-50 w-full h-full absolute top-0 left-0`;

const HeroContent = styled.div`
    ${tw`relative z-10 text-center text-white`}
`;

const ServicesSection = tw.section`py-20 bg-gray-100`;

const AboutSection = tw.section`py-20`;

const ContactSection = tw.section`py-20 bg-gray-100`;

// Asegurarse de que la sección de contacto tenga un ID para hacer scroll
const ContactSectionStyled = styled.section`
    ${tw`py-20 bg-gray-100`}
    && {
        scroll-margin-top: 100px; /* Ajusta según el alto del Navbar */
    }
`;

const Footer = tw.footer`bg-gray-800 text-white py-6`;

const SocialIcons = tw.div`flex space-x-4 mt-4`;

const LandingPage = () => {
    const [openSnackbar, setOpenSnackbar] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const [snackbarSeverity, setSnackbarSeverity] = React.useState('success');

    const handleFormSubmit = (e) => {
        e.preventDefault();
        // Aquí puedes manejar el envío del formulario de contacto
        // Por ejemplo, enviar los datos a una API
        // Para este ejemplo, simplemente mostramos una Snackbar
        setSnackbarMessage('¡Mensaje enviado exitosamente!');
        setSnackbarSeverity('success');
        setOpenSnackbar(true);
        // Resetear el formulario si es necesario
        e.target.reset();
    };

    const handleSnackbarClose = () => {
        setOpenSnackbar(false);
    };

    return (
        <div>
            {/* Navbar */}
            <Navbar />

            {/* Hero Section */}
            <HeroSection>
                <Overlay />
                <HeroContent tw="max-w-2xl">
                    <Typography variant="h2" tw="font-bold mb-4">
                        Soluciones de Transporte Escolar Seguras y Confiables
                    </Typography>
                    <Typography variant="h6" tw="mb-8">
                        Transportes Luvan ofrece servicios de transporte escolar para garantizar la seguridad y comodidad de tus hijos.
                    </Typography>
                    <div tw="space-x-4">
                        <Button
                            variant="contained"
                            color="secondary"
                            size="large"
                            onClick={(e) => {
                                const section = document.getElementById('contacto');
                                if (section) {
                                    section.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                        >
                            Contáctanos
                        </Button>
                        {/* <Button component={Link} to="/servicios" variant="outlined" color="inherit" size="large">
                            Nuestros Servicios
                        </Button> */}
                    </div>
                </HeroContent>
            </HeroSection>

            {/* Servicios */}
            <ServicesSection>
                <Container>
                    <Typography variant="h4" tw="text-center mb-12">
                        Nuestros Servicios
                    </Typography>
                    <Grid container spacing={6}>
                        <Grid item xs={12} md={4}>
                            <Card tw="h-full shadow-lg">
                                <CardContent tw="text-center">
                                    <LocationOn tw="text-4xl text-blue-500 mb-4" />
                                    <Typography variant="h6" tw="font-bold mb-2">
                                        Transporte Seguro
                                    </Typography>
                                    <Typography variant="body1">
                                        Flota de buses modernos con todas las medidas de seguridad para garantizar un viaje seguro.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card tw="h-full shadow-lg">
                                <CardContent tw="text-center">
                                    <AccessTime tw="text-4xl text-blue-500 mb-4" />
                                    <Typography variant="h6" tw="font-bold mb-2">
                                        Horarios Flexibles
                                    </Typography>
                                    <Typography variant="body1">
                                        Horarios adaptados a las necesidades de cada colegio y familia para mayor comodidad.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card tw="h-full shadow-lg">
                                <CardContent tw="text-center">
                                    <Group tw="text-4xl text-blue-500 mb-4" />
                                    <Typography variant="h6" tw="font-bold mb-2">
                                        Conductores Capacitados
                                    </Typography>
                                    <Typography variant="body1">
                                        Conductores profesionales y capacitados para brindar el mejor servicio y atención.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </ServicesSection>

            {/* Sobre Nosotros */}
            <AboutSection>
                <Container>
                    <Typography variant="h4" tw="text-center mb-12">
                        Sobre Transportes Luvan
                    </Typography>
                    <Grid container spacing={6} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Typography variant="body1" tw="text-lg">
                                En Transportes Luvan, nos dedicamos a ofrecer servicios de transporte escolar de alta calidad, garantizando la seguridad y bienestar de los estudiantes. Con años de experiencia en el sector, hemos consolidado una flota moderna y conductores altamente capacitados para brindar el mejor servicio a nuestros clientes.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <img src={logoLuvan} alt="Transporte Escolar" tw="rounded-lg shadow-lg w-full" />
                        </Grid>
                    </Grid>
                </Container>
            </AboutSection>

            {/* Contacto */}
            <ContactSectionStyled id="contacto">
                <Container>
                    <Typography variant="h4" tw="text-center mb-12">
                        Contáctanos
                    </Typography>
                    <Grid container spacing={6}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" tw="mb-4">
                                Información de Contacto
                            </Typography>
                            <div tw="flex items-center mb-4">
                                <Phone tw="mr-2 text-blue-500" />
                                <Typography variant="body1">
                                    502 23600026
                                </Typography>
                            </div>
                            <div tw="flex items-center mb-4">
                                <Email tw="mr-2 text-blue-500" />
                                <Typography variant="body1">
                                    administracion@transportesluvan.com
                                </Typography>
                            </div>
                            <div tw="flex items-center">
                                <AccessTime tw="mr-2 text-blue-500" />
                                <Typography variant="body1">
                                    Horario de Atención: 8AM - 5PM
                                </Typography>
                            </div>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <form onSubmit={handleFormSubmit}>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            label="Nombre"
                                            name="name"
                                            variant="outlined"
                                            fullWidth
                                            required
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            label="Correo Electrónico"
                                            name="email"
                                            type="email"
                                            variant="outlined"
                                            fullWidth
                                            required
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Asunto"
                                            name="subject"
                                            variant="outlined"
                                            fullWidth
                                            required
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Mensaje"
                                            name="message"
                                            variant="outlined"
                                            fullWidth
                                            multiline
                                            rows={4}
                                            required
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Button type="submit" variant="contained" color="secondary" fullWidth>
                                            Enviar Mensaje
                                        </Button>
                                    </Grid>
                                </Grid>
                            </form>
                        </Grid>
                    </Grid>
                </Container>
            </ContactSectionStyled>

            {/* Footer */}
            <Footer>
                <Container>
                    <Grid container spacing={6} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" tw="mb-2">
                                Transportes Luvan
                            </Typography>
                            <Typography variant="body2">
                                © {new Date().getFullYear()} Transportes Luvan. Todos los derechos reservados.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" tw="mb-2">
                                Síguenos
                            </Typography>
                            <SocialIcons>
                                <IconButton href="#" target="_blank" color="inherit">
                                    <Facebook />
                                </IconButton>
                                <IconButton href="#" target="_blank" color="inherit">
                                    <Twitter />
                                </IconButton>
                                <IconButton href="#" target="_blank" color="inherit">
                                    <Instagram />
                                </IconButton>
                            </SocialIcons>
                        </Grid>
                    </Grid>
                </Container>
            </Footer>

            {/* Snackbar para retroalimentación */}
            <Snackbar
                open={openSnackbar}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </div>
    );

};

export default LandingPage;
