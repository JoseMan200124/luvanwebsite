import React from 'react';
import tw, { styled } from 'twin.macro';
import { Card, CardContent, Typography } from '@mui/material';
import * as Icons from '@mui/icons-material';

const StyledCard = styled(Card)`
    /* Aseguramos que la tarjeta ocupe toda la altura y
       que el contenido se alinee al inicio (top). */
    ${tw`w-full h-full flex flex-col items-center justify-start p-6`}
`;

const ServiceCard = ({ iconName, title, description }) => {
    const IconComponent = Icons[iconName] || Icons['HelpOutline'];

    return (
        <StyledCard elevation={3}>
            {/* Ícono centrado horizontalmente */}
            {IconComponent && (
                <IconComponent
                    style={{
                        fontSize: '3rem',
                        color: '#2D966C'
                    }}
                />
            )}

            <CardContent tw="w-full">
                <Typography
                    variant="h6"
                    align="center"
                    sx={{ fontWeight: 'bold', mt: 4, mb: 2 }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        textAlign: 'justify',
                        pt: 2,
                        fontSize: '0.875rem'
                    }}
                >
                    {description}
                </Typography>
            </CardContent>
        </StyledCard>
    );
};

export default ServiceCard;
