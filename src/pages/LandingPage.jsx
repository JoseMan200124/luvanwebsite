import React from 'react';
import tw, { styled } from 'twin.macro';
import {
    Typography,
    Container,
    Grid,
    TextField,
    Button,
    Snackbar,
    Alert
} from '@mui/material';
import {
    Phone,
    Email,
    AccessTime,
    WhatsApp
} from '@mui/icons-material';

import Navbar from '../components/Navbar';
import ServiceCard from '../components/ServiceCard';
import Footer from '../components/Footer';

import landingBg from '../assets/img/school-bus.jpg';
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

// Sección de "¿Por qué elegirnos?" (Key Points)
const KeyPointsSection = tw.section`py-20`;

// Sección de Servicios
const ServicesSection = tw.section`py-20 bg-gray-100`;

// Sección de "Sobre Nosotros"
const AboutSection = tw.section`py-20`;

// Sección de Contacto
const ContactSection = styled.section`
    ${tw`py-20 bg-gray-100`}
    scroll-margin-top: 100px;
`;

const LandingPage = () => {
    const [openSnackbar, setOpenSnackbar] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const [snackbarSeverity, setSnackbarSeverity] = React.useState('success');

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setSnackbarMessage('¡Mensaje enviado exitosamente!');
        setSnackbarSeverity('success');
        setOpenSnackbar(true);
        e.target.reset();
    };

    const handleSnackbarClose = () => {
        setOpenSnackbar(false);
    };

    // Arreglo de Key Points (puntos clave)
    const keyPoints = [
        {
            iconName: 'Security',
            title: 'Seguridad',
            description: 'Vehículos equipados y procesos diseñados para proteger a cada pasajero.'
        },
        {
            iconName: 'AlarmOn',
            title: 'Puntualidad',
            description: 'Compromiso con el cumplimiento de horarios en cada trayecto.'
        },
        {
            iconName: 'SupportAgent',
            title: 'Atención Personalizada',
            description: 'Adaptamos nuestros servicios a las necesidades de cada cliente.'
        }
    ];

    // Arreglo de Servicios (actualizado según la imagen)
    const services = [
        {
            iconName: 'DirectionsBus',
            title: 'Transporte Escolar',
            description: 'Brindamos un servicio de transporte seguro y confiable para estudiantes, con unidades monitoreadas y personal capacitado, garantizando tranquilidad para los padres y colegios.'
        },
        {
            iconName: 'BusinessCenter',
            title: 'Transporte Corporativo y Empresarial',
            description: 'Ofrecemos soluciones de movilidad eficientes para el traslado de colaboradores, optimizando rutas y tiempos para mejorar la productividad de tu empresa.'
        },
        {
            iconName: 'TravelExplore',
            title: 'Excursiones',
            description: 'Organizamos y coordinamos excursiones con cobertura a nivel nacional, asegurando comodidad y seguridad en cada viaje.'
        },
        {
            iconName: 'Event',
            title: 'Eventos Privados',
            description: 'Servicio de transporte para eventos especiales, incluyendo shuttles para actividades recreativas, fiestas, cumpleaños y más, con total comodidad y puntualidad.'
        }
    ];

    // Número de contacto y mensaje por default para WhatsApp
    const phoneNumber = "50237481552";
    const defaultMessage = "Hola, quisiera obtener más información sobre sus servicios.";
    const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMessage)}`;

    return (
        <div tw="flex flex-col min-h-screen">
            <Navbar />

            {/* Sección Hero */}
            <HeroSection id="inicio">
                <Overlay />
                <HeroContent>
                    <Typography
                        variant="h2"
                        tw="font-bold mb-4 text-center text-4xl md:text-5xl lg:text-6xl"
                        style={{ lineHeight: '1.2' }}
                    >
                        Transportes Luvan 100019
                    </Typography>

                    <Typography
                        variant="h6"
                        tw="mb-8 text-center text-lg md:text-xl lg:text-2xl"
                        style={{ maxWidth: '800px', margin: '0 auto' }}
                    >
                        Más de 10 años garantizando la seguridad y confianza en el transporte escolar y empresarial.
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

            {/* Sección "¿Por qué elegirnos?" */}
            <KeyPointsSection id="porque-elegirnos">
                <Container>
                    <Typography variant="h4" align="center" sx={{ mb: '50px' }}>
                        ¿Por qué elegirnos?
                    </Typography>
                    <Grid container spacing={6} justifyContent="center" alignItems="stretch">
                        {keyPoints.map((point, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                                <ServiceCard
                                    iconName={point.iconName}
                                    title={point.title}
                                    description={point.description}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </KeyPointsSection>

            {/* Sección de Servicios */}
            <ServicesSection id="servicios">
                <Container>
                    <Typography variant="h4" align="center" sx={{ mb: '50px' }}>
                        Nuestros Servicios
                    </Typography>
                    <Grid
                        container
                        spacing={6}
                        justifyContent="center"
                        alignItems="stretch"
                    >
                        {services.map((service, index) => (
                            // Cambiado a md={6} para que sean más anchos (2 columnas en pantallas medianas+)
                            <Grid item xs={12} sm={6} md={6} key={index}>
                                <ServiceCard
                                    iconName={service.iconName}
                                    title={service.title}
                                    description={service.description}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </ServicesSection>

            {/* Sección "Sobre Nosotros" */}
            <AboutSection id="nosotros">
                <Container>
                    <Typography variant="h4" tw="text-center mb-12">
                        Sobre Nosotros
                    </Typography>
                    <Grid container spacing={6} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Typography
                                variant="body1"
                                sx={{ textAlign: 'justify', fontSize: '1rem', pt: 2, mb: 2 }}
                            >
                                Contamos con un equipo profesional y unidades de diversas capacidades para garantizar
                                un servicio eficiente y confiable. Nos enorgullece ser el aliado estratégico de las
                                instituciones educativas y empresariales, superando expectativas en cada trayecto.
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{ textAlign: 'justify', fontSize: '1rem', pt: 2, fontStyle: 'italic' }}
                            >
                                ¡Confía en nosotros para la logística de transporte!
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <img
                                src={logoLuvan}
                                alt="Transportes Luvan"
                                tw="rounded-lg shadow-lg w-full h-auto object-cover"
                            />
                        </Grid>
                    </Grid>
                </Container>
            </AboutSection>

            {/* Sección de Contacto */}
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
                                <Typography variant="body1">3748-1552</Typography>
                            </div>
                            <div tw="flex items-center mb-4">
                                <Email style={{ marginRight: '8px', color: '#2D966C' }} />
                                <Typography variant="body1">
                                    administracion@transportesluvan.com
                                </Typography>
                            </div>
                            <div tw="flex items-center mb-4">
                                <AccessTime style={{ marginRight: '8px', color: '#2D966C' }} />
                                <Typography variant="body1">
                                    Horario de Atención: 8AM - 5PM
                                </Typography>
                            </div>
                            <div tw="flex items-center">
                                <WhatsApp style={{ marginRight: '8px', color: '#25D366' }} />
                                <a
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <Typography variant="body1">Chat en WhatsApp</Typography>
                                </a>
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
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            fullWidth
                                            style={{ backgroundColor: '#2D966C', color: '#FFFFFF' }}
                                        >
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

            {/* Botón flotante de WhatsApp */}
            <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: '#25D366',
                    borderRadius: '50%',
                    padding: '12px',
                    zIndex: 1000,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                }}
            >
                <WhatsApp style={{ color: '#fff', fontSize: '2rem' }} />
            </a>

            {/* Snackbar */}
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
