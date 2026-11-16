// src/hooks/useDebouncedValue.js
import { useEffect, useState } from 'react';

// Devuelve `value` recién cuando dejó de cambiar durante `delay` ms. Solo para buscar opciones, nunca para aplicar filtros.
const useDebouncedValue = (value, delay = 300) => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
};

export default useDebouncedValue;
