// src/pages/LandingPage.jsx

import React from 'react';
import tw, { styled } from 'twin.macro';
import { Typography, Container, Grid, TextField, Button, IconButton, Snackbar, Alert } from '@mui/material';
import { Phone, Email, AccessTime, LocationOn, Facebook, Twitter, Instagram, Group } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import ServiceCard from '../components/ServiceCard'; // Importar el nuevo ServiceCard
import Footer from '../components/Footer'; // Importar el nuevo Footer
import landingBg from '../assets/img/landing-bg.jpg';
import logoLuvan from '../assets/img/logo-luvan.jpg';

// Sección Hero con fondo de imagen y contenido centrado
const HeroSection = styled.section`
    ${tw`flex items-center justify-center bg-cover bg-center h-screen relative`}
    background-image: url(${landingBg});
`;

const Overlay = tw.div`bg-black bg-opacity-50 w-full h-full absolute top-0 left-0`;

const HeroContent = styled.div`
    ${tw`relative z-10 text-center text-white max-w-4xl px-4`}
`;

// Sección de Servicios
const ServicesSection = tw.section`py-20 bg-gray-100`;

const AboutSection = tw.section`py-20`;

const ContactSection = styled.section`
    ${tw`py-20 bg-gray-100`}
    scroll-margin-top: 100px;
`;

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

    // Datos de Servicios
    const services = [
        {
            icon: LocationOn,
            title: 'Transporte Seguro',
            description: 'Flota de buses modernos con todas las medidas de seguridad para garantizar un viaje seguro.',
        },
        {
            icon: AccessTime,
            title: 'Horarios Flexibles',
            description: 'Horarios adaptados a las necesidades de cada colegio y familia para mayor comodidad.',
        },
        {
            icon: Group,
            title: 'Conductores Capacitados',
            description: 'Conductores profesionales y capacitados para brindar el mejor servicio y atención.',
        },
        // Puedes añadir más servicios aquí
    ];

    return (
        <div tw="flex flex-col min-h-screen">
            {/* Navbar */}
            <Navbar />

            {/* Hero Section */}
            <HeroSection id="inicio">
                <Overlay />
                <HeroContent>
                    <Typography variant="h2" tw="font-bold mb-6 text-4xl md:text-5xl lg:text-6xl" style={{ lineHeight: '1.2' }}>
                        Soluciones de Transporte Escolar Seguras y Confiables
                    </Typography>
                    <Typography variant="h6" tw="mb-8 text-lg md:text-xl lg:text-2xl">
                        Transportes Luvan ofrece servicios de transporte escolar para garantizar la seguridad y comodidad de tus hijos.
                    </Typography>
                    <div tw="space-x-4">
                        <Button
                            variant="contained"
                            size="large"
                            onClick={() => {
                                const section = document.getElementById('contacto');
                                if (section) {
                                    section.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                            style={{ backgroundColor: '#2D966C', color: '#FFFFFF' }}
                        >
                            Contáctanos
                        </Button>
                    </div>
                </HeroContent>
            </HeroSection>

            {/* Servicios */}
            <ServicesSection id="servicios">
                <Container>
                    <Typography variant="h4" tw="text-center mb-12">
                        Nuestros Servicios
                    </Typography>
                    <Grid container spacing={6} justifyContent="center">
                        {services.map((service, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index} tw="flex">
                                <ServiceCard
                                    icon={service.icon}
                                    title={service.title}
                                    description={service.description}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </ServicesSection>

            {/* Sobre Nosotros */}
            <AboutSection id="nosotros">
                <Container>
                    <Typography variant="h4" tw="text-center mb-12">
                        Sobre Transportes Luvan
                    </Typography>
                    <Grid container spacing={6} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Typography variant="body1" tw="text-lg mb-6">
                                En Transportes Luvan, nos dedicamos a ofrecer servicios de transporte escolar de alta calidad, garantizando la seguridad y bienestar de los estudiantes. Con años de experiencia en el sector, hemos consolidado una flota moderna y conductores altamente capacitados para brindar el mejor servicio a nuestros clientes.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <img src={logoLuvan} alt="Transporte Escolar" tw="rounded-lg shadow-lg w-full h-auto object-cover" />
                        </Grid>
                    </Grid>
                </Container>
            </AboutSection>

            {/* Contacto */}
            <ContactSection id="contacto">
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
                                <Phone style={{ marginRight: '8px', color: '#2D966C' }} />
                                <Typography variant="body1">
                                    502 23600026
                                </Typography>
                            </div>
                            <div tw="flex items-center mb-4">
                                <Email style={{ marginRight: '8px', color: '#2D966C' }} />
                                <Typography variant="body1">
                                    administracion@transportesluvan.com
                                </Typography>
                            </div>
                            <div tw="flex items-center">
                                <AccessTime style={{ marginRight: '8px', color: '#2D966C' }} />
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
                                        <Button type="submit" variant="contained" fullWidth
                                                style={{ backgroundColor: '#2D966C', color: '#FFFFFF' }}>
                                            Enviar Mensaje
                                        </Button>
                                    </Grid>
                                </Grid>
                            </form>
                        </Grid>
                    </Grid>
                </Container>
            </ContactSection>

            {/* Footer */}
            <Footer />

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
