import React, { useState, useContext } from 'react';
import tw, { styled } from 'twin.macro';
import {
    Dialog,
    Typography,
    Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

import logoLuvan from '../../assets/img/logo-sin-fondo.png';

const Logo = styled.img`
    ${tw`h-20 w-auto my-4`}
`;

const ButtonsContainer = styled.div`
    ${tw`relative bg-gray-50 rounded-lg shadow-lg w-full max-w-md mx-auto flex flex-col items-center pt-12 pb-8 px-8 gap-4`}
`;

const ErrorMessage = styled(Typography)`
    ${tw`mb-4 text-center text-red-600`}
`;

const EnrollmentModal = ({ open, onClose }) => {
    const navigate = useNavigate();

    const [error, setError] = useState('');

    return (
        <Dialog open={open}>
            <ButtonsContainer>
                <Logo src={logoLuvan} alt="Transportes Luvan" />
                {error && (
                    <ErrorMessage variant="body1">
                        {error}
                    </ErrorMessage>
                )}

                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={onClose}
                >
                    Continuar a formulario de inscripción
                </Button>
                    
                <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    onClick={() => navigate('/update-parent-info')}
                >
                    Ir a Actualizar Datos
                </Button>
            </ButtonsContainer>
        </Dialog>
    );
};

export default EnrollmentModal;