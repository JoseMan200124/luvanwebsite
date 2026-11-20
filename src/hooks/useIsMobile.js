// src/hooks/useIsMobile.js
// true por debajo del breakpoint sm (vista de tarjetas en las tablas).
import { useMediaQuery, useTheme } from '@mui/material';

const useIsMobile = () => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down('sm'));
};

export default useIsMobile;
