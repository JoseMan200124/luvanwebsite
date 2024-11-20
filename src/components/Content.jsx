// src/components/Content.jsx

import React from 'react';
import tw from 'twin.macro';

const ContentContainer = tw.div`p-8`;

const Content = ({ title }) => {
    return (
        <ContentContainer>
            <h1 tw="text-2xl font-bold">{title}</h1>
            <p>Contenido para {title}</p>
        </ContentContainer>
    );
};

export default Content;
