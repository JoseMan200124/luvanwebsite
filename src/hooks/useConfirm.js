// src/hooks/useConfirm.js
import { useContext } from 'react';
import { ConfirmContext } from '../components/feedback/ConfirmDialog';

const useConfirm = () => {
    const confirm = useContext(ConfirmContext);
    if (!confirm) {
        throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
    }
    return confirm;
};

export default useConfirm;
