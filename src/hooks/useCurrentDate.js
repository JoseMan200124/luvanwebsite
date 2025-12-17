import { useState, useEffect } from 'react';
import moment from 'moment';
import dateService from '../services/dateService';

/**
 * Hook personalizado para obtener la fecha actual del sistema (simulada o real)
 * @returns {Object} { currentDate: moment, isLoading: boolean, refresh: function }
 */
export const useCurrentDate = () => {
    const [currentDate, setCurrentDate] = useState(dateService.getCurrentDateSync());
    const [isLoading, setIsLoading] = useState(false);

    const refresh = async () => {
        setIsLoading(true);
        try {
            const date = await dateService.getCurrentDate();
            setCurrentDate(date);
        } catch (error) {
            console.error('[useCurrentDate] Error fetching date:', error);
            setCurrentDate(moment());
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Fetch on mount
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        currentDate,
        isLoading,
        refresh,
        // Helper methods
        format: (format = 'YYYY-MM-DD') => currentDate.format(format),
        toISOString: () => currentDate.toISOString(),
        moment: () => currentDate
    };
};

/**
 * Helper síncrono para obtener fecha actual (usa cache)
 * Útil para casos donde no se puede usar async/await
 */
export const getCurrentDateSync = () => {
    return dateService.getCurrentDateSync();
};

/**
 * Helper asíncrono para obtener fecha actual del backend
 */
export const getCurrentDate = async () => {
    return await dateService.getCurrentDate();
};
