// src/components/Footer.jsx

import React from 'react';
import tw, { styled } from 'twin.macro';
import { Typography, Container, Grid, IconButton } from '@mui/material';
import { Facebook, Twitter, Instagram } from '@mui/icons-material';
import { keyframes } from 'styled-components';

// Animación de FadeIn para el Footer (opcional)
const fadeIn = keyframes`
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

// Contenedor del Footer con animación
const FooterContainer = styled.footer`
    ${tw`bg-gray-800 text-white py-6`}
    animation: ${fadeIn} 0.5s ease-out;
`;

const SocialIcons = tw.div`flex space-x-4 mt-4`;

const Footer = () => {
    return (
        <FooterContainer>
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
                            <IconButton href="#" target="_blank" style={{ color: '#FFFFFF' }} aria-label="Facebook">
                                <Facebook />
                            </IconButton>
                            <IconButton href="#" target="_blank" style={{ color: '#FFFFFF' }} aria-label="Twitter">
                                <Twitter />
                            </IconButton>
                            <IconButton href="#" target="_blank" style={{ color: '#FFFFFF' }} aria-label="Instagram">
                                <Instagram />
                            </IconButton>
                        </SocialIcons>
                    </Grid>
                </Grid>
            </Container>
        </FooterContainer>
    );
};

export default Footer;
