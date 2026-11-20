// src/hooks/useNotify.js
import { useContext } from 'react';
import { NotificationContext } from '../components/feedback/NotificationProvider';

const useNotify = () => {
    const notify = useContext(NotificationContext);
    if (!notify) {
        throw new Error('useNotify debe usarse dentro de NotificationProvider');
    }
    return notify;
};

export default useNotify;
