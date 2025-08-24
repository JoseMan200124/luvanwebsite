import { useCallback } from 'react';
import axios from '../utils/axiosConfig';

export default function useScheduleSlots() {
  const fetchSlots = useCallback(async (studentId) => {
    const res = await axios.get(`/students/${studentId}/scheduleSlots`);
    // API returns { slots: [...] }
    const raw = (res && res.data && Array.isArray(res.data.slots)) ? res.data.slots : [];
    // Normalize `days` to always be an array (DB may return JSON string or null)
    // Also ensure we work with plain objects: if the backend returned Sequelize instances
    // they might still have `toJSON` or `dataValues` so convert them first.
    const slots = raw.map(s => {
      // convert Sequelize instance to plain object if needed
      let slot = s;
      if (slot && typeof slot.toJSON === 'function') {
        try { slot = slot.toJSON(); } catch (e) { /* ignore */ }
      } else if (slot && slot.dataValues) {
        slot = slot.dataValues;
      }
      let days = slot && slot.days;
      if (typeof days === 'string') {
        try { days = JSON.parse(days); } catch (e) { days = []; }
      }
      if (!Array.isArray(days)) days = [];
      return { ...(slot || {}), days };
    });
    return slots;
  }, []);

  const createSlot = useCallback(async (studentId, payload) => {
    const res = await axios.post(`/students/${studentId}/scheduleSlots`, payload);
    return res.data;
  }, []);

  const updateSlot = useCallback(async (studentId, slotId, payload) => {
    const res = await axios.put(`/students/${studentId}/scheduleSlots/${slotId}`, payload);
    return res.data;
  }, []);

  const deleteSlot = useCallback(async (studentId, slotId) => {
    const res = await axios.delete(`/students/${studentId}/scheduleSlots/${slotId}`);
    return res.data;
  }, []);

  const fetchSchoolSchedules = useCallback(async (schoolId) => {
  const res = await axios.get(`/schools/${schoolId}`);
  // API returns { school: { schedules: [...] } }
  return (res.data && res.data.school && Array.isArray(res.data.school.schedules)) ? res.data.school.schedules : [];
  }, []);

  const fetchRoutesByTime = useCallback(async (schoolId, time) => {
    const res = await axios.get(`/schools/${schoolId}/routes-by-schedule?time=${encodeURIComponent(time)}`);
    return res.data.routes || [];
  }, []);

  return { fetchSlots, createSlot, updateSlot, deleteSlot, fetchSchoolSchedules, fetchRoutesByTime };
}
