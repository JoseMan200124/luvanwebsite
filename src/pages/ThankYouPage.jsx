import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';

// Solo rutas internas ("/algo"): "//otro.com", URLs absolutas o "javascript:" sacarían al usuario del sitio.
const isInternalPath = (path) => typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');

const ThankYouPage = () => {
    const location = useLocation();
    const { title, body, footer, redirectTo: requestedRedirect, redirectSeconds = 5 } = location.state || {};
    const redirectTo = isInternalPath(requestedRedirect) ? requestedRedirect : null;
    // Con redirectTo, cuenta regresiva y recarga completa de la página en ese destino.
    const [secondsLeft, setSecondsLeft] = useState(redirectTo ? redirectSeconds : null);

    useEffect(() => {
        if (!redirectTo) {
            return undefined;
        }
        if (secondsLeft <= 0) {
            window.location.assign(redirectTo);
            return undefined;
        }
        const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
        return () => clearTimeout(timer);
    }, [redirectTo, secondsLeft]);
    
    return (
        <Box
            sx={{
                backgroundColor: '#f7f7f7',
                minHeight: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '20px'
            }}
        >
            <Box
                sx={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    maxWidth: '600px',
                    width: '100%',
                    boxShadow: 3,
                    padding: '30px',
                    textAlign: 'center'
                }}
            >
                <Typography variant="h4" gutterBottom>
                    {title}
                </Typography>
                <Typography variant="body1">
                    {body}
                </Typography>
                {redirectTo && (
                    <Typography variant="body2" sx={{ marginTop: '16px', fontWeight: 600 }}>
                        {secondsLeft > 0
                            ? `Se recargará la página para mostrar el nuevo ciclo en ${secondsLeft} ${secondsLeft === 1 ? 'segundo' : 'segundos'}…`
                            : 'Recargando…'}
                    </Typography>
                )}
                <Typography variant="body2" color="textSecondary" sx={{ marginTop: '20px' }}>
                    {footer}
                </Typography>
            </Box>
        </Box>
    );
};

export default ThankYouPage;