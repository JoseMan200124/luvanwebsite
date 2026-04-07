// src/services/notificationService.js
import api from '../utils/axiosConfig';

/**
 * Send a manual push notification to a targeted audience.
 * @param {{ title: string, message: string, targetingCriteria: object, sendPush?: boolean }} payload
 */
export const sendManualNotification = async (payload) => {
    const res = await api.post('/notifications', {
        type: 'manual',
        sendPush: true,
        ...payload,
    });
    return res.data;
};
