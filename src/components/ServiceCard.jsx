// src/components/ServiceCard.jsx

import React from 'react';
import tw, { styled } from 'twin.macro';
import { Card, Typography } from '@mui/material';

const CardContainer = styled(Card)`
  ${tw`h-full min-h-[300px] shadow-lg flex flex-col items-center p-6 transition-transform duration-300 ease-in-out hover:scale-105`}
  background-color: #FFFFFF;
`;

const IconWrapper = tw.div`mb-4 flex items-center justify-center`;

const ServiceCard = ({ icon: Icon, title, description }) => {
    return (
        <CardContainer>
            <IconWrapper>
                <Icon style={{ fontSize: '48px', color: '#144CCC' }} />
            </IconWrapper>
            <Typography variant="h6" tw="font-bold mb-2 text-center">
                {title}
            </Typography>
            <Typography variant="body1" tw="text-center">
                {description}
            </Typography>
        </CardContainer>
    );
};

export default ServiceCard;
