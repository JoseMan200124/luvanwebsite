import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';

const ThankYouPage = () => {
    const location = useLocation();
    const { title, body, footer } = location.state || {};
    
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
                <Typography variant="body2" color="textSecondary" sx={{ marginTop: '20px' }}>
                    {footer}
                </Typography>
            </Box>
        </Box>
    );
};

export default ThankYouPage;