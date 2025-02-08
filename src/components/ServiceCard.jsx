// src/components/ServiceCard.jsx
import React from 'react';
import tw, { styled } from 'twin.macro';
import { Typography, Paper, Box } from '@mui/material';
import * as Icons from '@mui/icons-material';

const CardContainer = styled(Paper)`
  ${tw`flex flex-col items-center p-6 rounded-lg shadow-md bg-white`}
  text-align: center;
  transition: transform 0.3s;

  &:hover {
    transform: translateY(-4px);
  }
`;

const IconWrapper = tw.div`mb-4 flex justify-center`;

const ServiceCard = ({ iconName, title, description }) => {
    const IconComponent = Icons[iconName] || Icons.Info;

    return (
        <CardContainer>
            <IconWrapper>
                <IconComponent style={{ fontSize: '3rem', color: '#2D966C' }} />
            </IconWrapper>
            <Typography variant="h6" tw="mb-2 font-semibold">
                {title}
            </Typography>
            <Box>
                <Typography variant="body2">{description}</Typography>
            </Box>
        </CardContainer>
    );
};

export default ServiceCard;
