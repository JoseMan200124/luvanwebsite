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

/**
 * Send a push notification to a single user.
 * @param {{ userId: number, title: string, message: string, schoolId?: number, cicloEscolarId?: number }} payload
 */
export const sendDirectUserNotification = async (payload) => {
    const { userId, title, message, schoolId, cicloEscolarId } = payload || {};
    const res = await api.post('/notifications', {
        type: 'manual',
        sendPush: true,
        title,
        message,
        cicloEscolarId: cicloEscolarId ? Number(cicloEscolarId) : null,
        metadata: {
            source: 'direct-user-notification-service',
            channel: 'push',
            targetUserId: Number(userId),
            schoolId: schoolId ? Number(schoolId) : null,
            cicloEscolarId: cicloEscolarId ? Number(cicloEscolarId) : null,
        },
        targetingCriteria: {
            userIds: [Number(userId)],
            ...(cicloEscolarId ? { cicloEscolarId: Number(cicloEscolarId) } : {}),
        },
    });
    return res.data;
};
