// src/components/dashboard/StatsCard.jsx

import React from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { Card, CardContent, Typography } from '@mui/material';
import { Group, AttachMoney, ReportProblem, School } from '@mui/icons-material';

const CardContainer = styled(Card)`
  ${tw`shadow-lg`}
`;

const IconWrapper = styled.div`
  ${tw`flex items-center justify-center h-12 w-12 rounded-full`}
  background-color: ${({ iconColor }) => iconColor || '#144CCC'};
`;

const StatsCard = ({ title, value, icon }) => {
    let IconComponent;
    let iconColor;

    switch (icon) {
        case 'Group':
            IconComponent = Group;
            iconColor = '#2D966C';
            break;
        case 'AttachMoney':
            IconComponent = AttachMoney;
            iconColor = '#144CCC';
            break;
        case 'ReportProblem':
            IconComponent = ReportProblem;
            iconColor = '#F44336'; // Red color for alerts
            break;
        case 'School':
            IconComponent = School;
            iconColor = '#FFC107'; // Amber color
            break;
        default:
            IconComponent = Group;
            iconColor = '#144CCC';
    }

    return (
        <CardContainer>
            <CardContent tw="flex items-center">
                <IconWrapper iconColor={iconColor}>
                    <IconComponent style={{ color: '#FFFFFF' }} />
                </IconWrapper>
                <div tw="ml-4">
                    <Typography variant="h6" tw="font-bold">
                        {title}
                    </Typography>
                    <Typography variant="h4" tw="font-bold">
                        {value}
                    </Typography>
                </div>
            </CardContent>
        </CardContainer>
    );
};

export default StatsCard;
