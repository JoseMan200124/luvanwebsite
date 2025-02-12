// src/components/Footer.jsx

import React from 'react';
import tw, { styled } from 'twin.macro';
import { Typography, Container, Grid, Link } from '@mui/material';
import { keyframes } from 'styled-components';

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

const FooterContainer = styled.footer`
    ${tw`bg-gray-800 text-white py-6`}
    animation: ${fadeIn} 0.5s ease-out;
`;

const Footer = () => {
    return (
        <FooterContainer>
            <Container>
                <Grid container spacing={6} alignItems="center" justifyContent="center">
                    <Grid item xs={12}>
                        <Typography variant="h6" align="center" tw="mb-2">
                            Transportes Luvan
                        </Typography>
                        <Typography variant="body2" align="center">
                            © {new Date().getFullYear()} Transportes Luvan. Todos los derechos reservados.
                        </Typography>
                    </Grid>
                </Grid>

                <Typography variant="body2" align="center" tw="mt-8">
                    Desarrollado por{' '}
                    <Link
                        href="https://www.haricode.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="inherit"
                        underline="always"
                        tw="font-semibold"
                    >
                        Haricode
                    </Link>
                </Typography>
            </Container>
        </FooterContainer>
    );
};

export default Footer;
