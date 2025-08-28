import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import useScheduleSlots from '../../hooks/useScheduleSlots';

// Minimal modal + weekly editor for student's schedule slots
export default function StudentScheduleModal({ studentId, students, schoolId, open, onClose }) {
  // slotsMap: { [studentId]: [slots...] }
  const [slotsMap, setSlotsMap] = useState({});
  const [loading, setLoading] = useState(false);
  // form (quick-add) removed — assignments handled via popup
  const [schoolSchedules, setSchoolSchedules] = useState([]);

  const { fetchSlots: loadSlots, fetchSchoolSchedules: loadSchoolSchedules, fetchRoutesByTime: loadRoutesByTime, createSlot: createRemoteSlot, deleteSlot: deleteRemoteSlot, updateSlot: updateRemoteSlot, fetchSchoolRouteNumbers: loadSchoolRouteNumbers } = useScheduleSlots();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargetStudentId, setAssignTargetStudentId] = useState(null); // current student for the assign popup
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState({ slotId: null, day: null, studentId: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Assign Route form state (separate popup)
  const [assignForm, setAssignForm] = useState({ schoolSchedule: '', routeId: '', paradaTime: '', note: '', days: [] });
  const [assignRoutesOptions, setAssignRoutesOptions] = useState([]);
  const [assignEditing, setAssignEditing] = useState(null); // { slotId, day } when editing

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        // load school schedules
        const sch = schoolId ? await loadSchoolSchedules(schoolId) : [];
        setSchoolSchedules(sch);
  // load canonical routeNumbers for this school
  const canonical = schoolId ? await loadSchoolRouteNumbers(schoolId) : [];
  // canonical is an array of route numbers (strings or numbers)
  setAssignRoutesOptions((canonical || []).map(rn => ({ routeNumber: rn, id: `school-${String(rn)}` })));
  console.log('[StudentScheduleModal] loaded schoolSchedules for schoolId=', schoolId, sch);
        // load slots for all students in the family
        const map = {};
        const list = Array.isArray(students) && students.length > 0 ? students : (studentId ? [{ id: studentId }] : []);
        await Promise.all(list.map(async (st) => {
          try {
            const s = await loadSlots(st.id);
            map[st.id] = s || [];
          } catch (e) {
            map[st.id] = [];
          }
        }));
        setSlotsMap(map);
  console.log('[StudentScheduleModal] loaded slotsMap:', map);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, studentId, students, schoolId, loadSlots, loadSchoolSchedules, loadSchoolRouteNumbers]);

  // Helper: parse a stored schoolSchedule string like "07:15 AM" or "07:15" into { time, code }
  function parseSchoolScheduleString(s) {
    if (!s) return { time: null, code: null };
    const str = String(s).trim();
    const timeMatch = str.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : null;
    // try to extract code (AM/MD/PM/EX) after the time
    let code = null;
    if (time) {
      const after = str.slice(str.indexOf(time) + time.length).trim().toUpperCase();
      const m = after.match(/\b(AM|PM|MD|EX)\b/);
      if (m) code = m[1];
    }
    return { time, code };
  }

  // week day labels (UI labels are defined inline where needed)

  // Validate assignment before save: time format and conflicts with existing slots
  function validateAssign({ time, days }, editing) {
  if (!Array.isArray(days) || days.length === 0) return { ok: false, message: 'Selecciona al menos un día.' };

  // Conflict check removed: allow same time on the same day
  return { ok: true };
  }

  async function openAssignPopup(slot=null, day=null, studentArg=null) {
    console.log('[StudentScheduleModal] openAssignPopup called with slot=', slot, 'day=', day);
    setAssignEditing(null);
    setAssignRoutesOptions([]);
    // ensure school schedules loaded
    if (!schoolSchedules || schoolSchedules.length === 0) {
      const sch = schoolId ? await loadSchoolSchedules(schoolId) : [];
      setSchoolSchedules(sch);
    }

    // if caller passed a student (new signature supported below), handle it
    // Caller will call openAssignPopup(student, null, null) for new assignment
    // or openAssignPopup(student, slot, day) for edit
  let targetStudent = null;
    // allow caller to explicitly pass a student id/object as third arg
    if (studentArg) {
      targetStudent = typeof studentArg === 'object' ? studentArg : { id: studentArg };
    }
    if (!targetStudent && slot && slot.studentId) targetStudent = { id: slot.studentId };
    // if first arg is a student object
    if (slot && slot.id && slot.fullName && !day) {
      // called as openAssignPopup(student)
      targetStudent = slot;
      slot = null;
    }

    if (targetStudent == null && students && students.length === 1) {
      // fallback to prop studentId / single student in students
      targetStudent = { id: studentId || (students[0] && students[0].id) };
    }

    if (targetStudent) {
      setAssignTargetStudentId(targetStudent.id);
      console.log('[StudentScheduleModal] resolved targetStudent=', targetStudent.id);
    }

  if (slot && day) {
      // open as edit for a specific day
    const editing = { studentId: targetStudent ? targetStudent.id : (studentId || null), slotId: slot.id, day };
    setAssignEditing(editing);
    console.log('[StudentScheduleModal] opening edit for slotId=', slot.id, 'day=', day, 'studentId=', editing.studentId);
      // parse note JSON if present (backwards compatibility) but prefer column
      let parsed = {};
      try { parsed = typeof slot.note === 'string' ? JSON.parse(slot.note) : slot.note || {}; } catch(e) {}
      const ss = slot.schoolSchedule || parsed.schoolSchedule || '';
      const parsedSS = parseSchoolScheduleString(ss);
      const ssTime = parsedSS.time || '';
      setAssignForm({
        // keep select values as time-only so existing option values still match
        schoolSchedule: ssTime,
        // prefer routeNumber stored on slot
        routeId: slot.routeNumber ? String(slot.routeNumber) : '',
        paradaTime: slot.time || '',
        note: parsed.note || (slot.note && typeof slot.note === 'string' ? slot.note : ''),
        days: [day]
      });
      // load routes for the time-only value and intersect with canonical routeNumbers
      if (ssTime) {
        try {
          const timeRoutes = await loadRoutesByTime(schoolId, ssTime);
          // If we already have canonical routeNumbers loaded, prefer those and intersect
          const canonicalRNs = Array.isArray(assignRoutesOptions) && assignRoutesOptions.length > 0 ? assignRoutesOptions.map(x => String(x.routeNumber)) : [];
          if (canonicalRNs.length > 0) {
            const intersect = (timeRoutes || []).filter(r => canonicalRNs.includes(String(r.routeNumber)));
            // If intersection empty, fallback to timeRoutes
            setAssignRoutesOptions(intersect.length > 0 ? intersect : (timeRoutes || []));
            console.log('[StudentScheduleModal] intersected canonical and timeRoutes:', intersect);
          } else {
            setAssignRoutesOptions(timeRoutes || []);
            console.log('[StudentScheduleModal] loaded routes for schoolSchedule(time)=', ssTime, timeRoutes);
          }
        } catch (err) {
          console.error(err);
          setAssignRoutesOptions([]);
        }
      }
      setAssignOpen(true);
      return;
    }

    // new assignment
  setAssignForm({ schoolSchedule: '', routeId: '', paradaTime: '', note: '', days: [] });
    setAssignOpen(true);
  }

  async function handleAssignScheduleSelect(timeVal) {
    // fetch routes for selected schedule
    setAssignForm(f => ({ ...f, schoolSchedule: timeVal }));
    console.log('[StudentScheduleModal] schedule selected=', timeVal);
    if (!timeVal) return setAssignRoutesOptions([]);
    try {
      const r = await loadRoutesByTime(schoolId, timeVal);
      setAssignRoutesOptions(r || []);
      console.log('[StudentScheduleModal] routes loaded for time=', timeVal, r);
    } catch (err) {
      console.error(err);
      setAssignRoutesOptions([]);
    }
  }

  async function saveAssignedRoute() {
  const resolvedStudent = (assignEditing && assignEditing.studentId) || assignTargetStudentId || studentId || (students && students[0] && students[0].id);
  console.log('[StudentScheduleModal] saveAssignedRoute called. resolvedStudent=', resolvedStudent, 'assignEditing=', assignEditing, 'assignForm=', assignForm);
    if (!resolvedStudent) return alert('Selecciona o proporciona un alumno antes de guardar');
    // validate
  const { schoolSchedule, routeId, paradaTime, note: noteText, days } = assignForm;
    if (!schoolSchedule || !paradaTime || !days || days.length === 0) return alert('Completa todos los campos');
  // validate time format and conflicts
  const validation = validateAssign({ time: paradaTime, days }, assignEditing);
  if (!validation.ok) return alert(validation.message);
    // Build schoolSchedule string including code (AM/MD/PM/EX) when possible
    const matchedSchedule = (schoolSchedules || []).find(s => {
      const times = Array.isArray(s && s.times) ? s.times : (s && s.times ? [s.times] : []);
      return times.includes(schoolSchedule);
    });
    const matchedCode = matchedSchedule && matchedSchedule.code ? String(matchedSchedule.code).toUpperCase() : null;
    const schoolScheduleOut = schoolSchedule ? (matchedCode ? `${schoolSchedule} ${matchedCode}` : schoolSchedule) : null;

    // build payload: routeId represents the routeNumber. Send only routeNumber.
    const payload = {
      time: paradaTime,
      note: noteText || '',
      schoolSchedule: schoolScheduleOut,
      days,
      routeNumber: routeId ? String(routeId) : null
    };
    console.log('[StudentScheduleModal] payload prepared=', payload);
    try {
  const targetStudent = resolvedStudent;
      if (!assignEditing) {
        // create new slot (may include multiple days)
        console.log('[StudentScheduleModal] creating new slot for student=', targetStudent);
    await createRemoteSlot(targetStudent, payload);
      } else {
        // editing a specific day of an existing slot
        const { slotId, day } = assignEditing;
        const original = (slotsMap[targetStudent] || []).find(s => s.id === slotId);
        console.log('[StudentScheduleModal] editing slotId=', slotId, 'original=', original);
        if (!original) {
          // fallback: create new
          console.log('[StudentScheduleModal] original slot not found, creating new');
          await createRemoteSlot(targetStudent, payload);
        } else {
          const currentDays = Array.isArray(original.days) ? original.days : [];
          const editedDays = Array.isArray(days) ? days : [day];
            if (currentDays.length <= 1) {
            // original only for this day; update it to reflect new selection (may include multiple days)
            console.log('[StudentScheduleModal] updating original slot (single-day) slotId=', slotId, 'editedDays=', editedDays, 'routeNumber=', payload.routeNumber);
            await updateRemoteSlot(targetStudent, slotId, { time: paradaTime, note: payload.note, days: editedDays, routeNumber: payload.routeNumber, schoolSchedule: payload.schoolSchedule });
          } else {
            // original spans multiple days. Remove the original day being edited and any days
            // that are being moved to the new slot (editedDays). Then create a new slot for editedDays.
            const remaining = currentDays.filter(d => d !== day && !editedDays.includes(d));
            if (remaining.length === 0) {
              // if nothing remains, delete original
              console.log('[StudentScheduleModal] deleting original slot because no remaining days slotId=', slotId);
              await deleteRemoteSlot(targetStudent, slotId);
            } else {
              console.log('[StudentScheduleModal] updating original slot removing edited day. slotId=', slotId, 'remaining=', remaining);
              await updateRemoteSlot(targetStudent, slotId, { days: remaining });
            }
            // create new slot for edited days
            console.log('[StudentScheduleModal] creating new slot for editedDays=', editedDays);
            await createRemoteSlot(targetStudent, { ...payload, days: editedDays });
          }
        }
      }

  const map = { ...slotsMap };
  map[targetStudent] = await loadSlots(targetStudent);
  console.log('[StudentScheduleModal] refreshed slots for student=', targetStudent, map[targetStudent]);
  setSlotsMap(map);
      setAssignOpen(false);
      setAssignEditing(null);
    } catch (err) {
      console.error(err);
      alert('Error guardando la parada');
    }
  }


  

  // Remove a slot only for a specific day: if slot has multiple days, remove that day from the days array
  async function removeSlotForDay(slotId, day, targetStudentIdParam) {
    try {
      const targetStudent = (typeof targetStudentIdParam !== 'undefined' && targetStudentIdParam !== null)
        ? targetStudentIdParam
        : (assignTargetStudentId || studentId || (students && students[0] && students[0].id));
      if (!targetStudent) return;
      const slot = (slotsMap[targetStudent] || []).find(s => s.id === slotId);
      if (!slot) return;
      const currentDays = Array.isArray(slot.days) ? slot.days : [];
      if (currentDays.length <= 1) {
        // delete entire row
        try {
          await deleteRemoteSlot(targetStudent, slotId);
        } catch (err) {
          // If not found, try to locate the slot across other students and retry
          console.error('[removeSlotForDay] delete failed, attempting fallback check', err);
          if (err && err.response && err.response.status === 404) {
            // refresh all students' slots and try to find correct owner
            const allStudents = Array.isArray(students) && students.length > 0 ? students : (studentId ? [{ id: studentId }] : []);
            const freshMap = {};
            await Promise.all(allStudents.map(async (st) => { try { freshMap[st.id] = await loadSlots(st.id); } catch(e){ freshMap[st.id]=[]; }}));
            // find slotId in freshMap
            let foundOwner = null;
            for (const sid of Object.keys(freshMap)) {
              if ((freshMap[sid] || []).some(s => s.id === slotId)) { foundOwner = sid; break; }
            }
            if (foundOwner && Number(foundOwner) !== Number(targetStudent)) {
              console.log('[removeSlotForDay] found slot owner mismatch, retrying delete with owner=', foundOwner);
              await deleteRemoteSlot(foundOwner, slotId);
            } else {
              throw err; // rethrow original
            }
          } else throw err;
        }
      } else {
        // update existing slot removing only that day
        const newDays = currentDays.filter(d => d !== day);
        try {
          await updateRemoteSlot(targetStudent, slotId, { days: newDays });
        } catch (err) {
          console.error('[removeSlotForDay] update failed, attempting fallback check', err);
          if (err && err.response && err.response.status === 404) {
            // refresh and try to find correct owner and retry update
            const allStudents = Array.isArray(students) && students.length > 0 ? students : (studentId ? [{ id: studentId }] : []);
            const freshMap = {};
            await Promise.all(allStudents.map(async (st) => { try { freshMap[st.id] = await loadSlots(st.id); } catch(e){ freshMap[st.id]=[]; }}));
            let foundOwner = null;
            for (const sid of Object.keys(freshMap)) {
              if ((freshMap[sid] || []).some(s => s.id === slotId)) { foundOwner = sid; break; }
            }
            if (foundOwner && Number(foundOwner) !== Number(targetStudent)) {
              console.log('[removeSlotForDay] found slot owner mismatch, retrying update with owner=', foundOwner);
              // refetch the slot from freshMap to compute days again
              const orig = (freshMap[foundOwner] || []).find(s => s.id === slotId);
              const origDays = Array.isArray(orig.days) ? orig.days : [];
              const recomputed = origDays.filter(d => d !== day);
              await updateRemoteSlot(foundOwner, slotId, { days: recomputed });
            } else {
              throw err;
            }
          } else throw err;
        }
      }
      const map = { ...slotsMap };
      map[targetStudent] = await loadSlots(targetStudent);
      setSlotsMap(map);
    } catch (err) {
      console.error(err);
    }
  }

  

  

  if (!open) return null;

  // week constant no longer used; grid renders only mon-fri

  const modalContent = (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30000 }}>
      <div style={{ background: 'white', padding: 24, borderRadius: 8, width: '95vw', maxWidth: 1400, maxHeight: '85vh', overflow: 'auto', zIndex: 30001 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>Horario por estudiante</h3>
          <button type="button" style={{ fontSize: 13, color: '#4B5563' }} onClick={onClose}>Cerrar</button>
        </div>

  {/* Top quick-add form removed — assignment handled in the "Asignar Ruta" popup */}

        <div>
              {loading ? <div>Cargando...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(Array.isArray(students) && students.length > 0 ? students : (studentId ? [{ id: studentId, fullName: 'Alumno' }] : [])).map(st => (
                <div key={st.id} style={{ border: '1px solid #eef2f7', borderRadius: 8, padding: 12, background: '#FBFDFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{st.fullName || `Alumno ${st.id}`}</div>
                    <div>
                      <button type="button" onClick={()=>openAssignPopup(st)} style={{ background: '#0ea5a4', color: '#fff', padding: '6px 10px', borderRadius: 6 }}>Asignar Ruta</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                    {['monday','tuesday','wednesday','thursday','friday'].map(d => {
                      const labelMap = { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes' };
                      const daySlots = (slotsMap[st.id] || []).filter(s => Array.isArray(s.days) && s.days.includes(d));

                      const getSlotType = (s) => {
                        try {
                          const parsed = typeof s.note === 'string' ? JSON.parse(s.note) : s.note;
                          const sch = parsed && parsed.schoolSchedule;
                          if (sch) return s.time <= sch ? 'entrada' : 'salida';
                        } catch (e) {}
                        // fallback by time of day
                        if (s.time && s.time < '12:00') return 'entrada';
                        return 'salida';
                      }

                      const entradaSlots = daySlots.filter(s=>getSlotType(s) === 'entrada');
                      const salidaSlots = daySlots.filter(s=>getSlotType(s) === 'salida');

                      const renderCard = (s, day) => (
                        <div key={s.id} style={{ marginBottom: 8, padding: 10, borderRadius: 8, background: '#ffffff', boxShadow: '0 4px 10px rgba(2,6,23,0.04)', border: '1px solid #e6eef6' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{s.time}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={()=>{ setConfirmTarget({ slotId: s.id, day, studentId: st.id }); setConfirmDeleteOpen(true); }} style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer' }} title="Eliminar">🗑</button>
                              <button type="button" onClick={()=>{ openAssignPopup(s, day, st.id); }} style={{ background: 'transparent', border: 'none', color: '#2563EB', cursor: 'pointer' }} title="Editar">✏️</button>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 6 }}>Hora colegio: {(() => { try { const parsed = typeof s.note === 'string' ? JSON.parse(s.note) : s.note; return s.schoolSchedule || (parsed && parsed.schoolSchedule) || '—'; } catch(e) { return s.schoolSchedule || '—'; } })()}</div>
                          <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 6 }}>{s.routeNumber ? `Ruta ${s.routeNumber}` : 'Ruta: —'}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>Hora parada: {s.time}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>Nota parada: {(() => { try { const parsed = typeof s.note === 'string' ? JSON.parse(s.note) : s.note; return parsed && parsed.note ? parsed.note : (s.note && typeof s.note === 'string' ? s.note : ''); } catch(e) { return s.note || ''; } })()}</div>
                        </div>
                      );

                      return (
                        <div key={d} style={{ border: '1px solid #eef2f7', borderRadius: 8, padding: 12, background: '#FBFDFF' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textAlign: 'center', color: '#374151' }}>{labelMap[d]}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Entrada</div>
                              {entradaSlots.length === 0 ? <div style={{ padding: 10, borderRadius: 6, background: '#f3f7fa', color: '#6B7280', textAlign: 'center' }}>Sin asignación</div> : entradaSlots.map(s => renderCard(s, d))}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Salida</div>
                              {salidaSlots.length === 0 ? <div style={{ padding: 10, borderRadius: 6, background: '#f3f7fa', color: '#6B7280', textAlign: 'center' }}>Sin asignación</div> : salidaSlots.map(s => renderCard(s, d))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

          {/* Assign Route popup */}
          {assignOpen && (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 31000 }}>
              <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 'min(720px, 95vw)', boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                <h3 style={{ marginTop: 0 }}>Asignar Ruta</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 13 }}>Seleccionar Hora Colegio</label>
                    <select style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} value={assignForm.schoolSchedule} onChange={e=>handleAssignScheduleSelect(e.target.value)}>
                      <option value=''>-- seleccionar --</option>
                      {schoolSchedules.map((s, i) => {
                        const isStr = typeof s === 'string';
                        const times = isStr ? [s] : (Array.isArray(s.times) ? s.times : (s && s.times ? [s.times] : []));
                        const val = times[0] || '';
                        const label = isStr ? s : `${s.name || 'Horario'} — ${times.join(', ')}`;
                        return <option key={i} value={val}>{label}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>Número de Ruta</label>
                    <select style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} value={assignForm.routeId} onChange={e=>setAssignForm(f=>({...f, routeId: e.target.value}))}>
                      <option value=''>-- seleccionar --</option>
                      {assignRoutesOptions.map(r => {
                        // Prefer an explicit routeNumber. If missing, mark option as disabled
                        const hasRouteNumber = r && r.routeNumber !== undefined && r.routeNumber !== null && String(r.routeNumber).trim() !== '';
                        const value = hasRouteNumber ? String(r.routeNumber) : '';
                        const label = hasRouteNumber ? `Ruta ${r.routeNumber}` : `Ruta (sin número) — ID ${r.id || '—'}`;
                        // Use r.id or a fallback for key stability
                        const key = r && (r.id || (r.routeNumber || String(Math.random())));
                        return (
                          <option key={key} value={value} disabled={!hasRouteNumber}>{label}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>Hora Parada (HH:mm)</label>
                    <input type='time' style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} value={assignForm.paradaTime} onChange={e=>setAssignForm(f=>({...f, paradaTime: e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>Nota Parada</label>
                    <input type='text' style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} value={assignForm.note} onChange={e=>setAssignForm(f=>({...f, note: e.target.value}))} />
                  </div>
                  <div style={{ gridColumn: '1 / span 2' }}>
                    <label style={{ fontSize: 13 }}>Días</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {['monday','tuesday','wednesday','thursday','friday'].map(day => (
                        <button key={day} type='button' onClick={()=>{
                          setAssignForm(f=>({ ...f, days: f.days.includes(day) ? f.days.filter(d=>d!==day) : [...f.days, day] }));
                        }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: assignForm.days.includes(day)?'#2563EB':'#fff', color: assignForm.days.includes(day)?'#fff':'#374151' }}>{day.substring(0,3)}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type='button' onClick={()=>setAssignOpen(false)} style={{ padding: '8px 12px', borderRadius: 6 }}>Cancelar</button>
                  <button type='button' onClick={saveAssignedRoute} style={{ padding: '8px 12px', borderRadius: 6, background: '#059669', color: '#fff' }}>Guardar</button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm delete popup */}
          {confirmDeleteOpen && (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 32000 }}>
              <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 'min(520px, 95vw)', boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                <h3 style={{ marginTop: 0 }}>Confirmar eliminación</h3>
                <div style={{ marginTop: 8 }}>¿Estás seguro que deseas eliminar esta parada?</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type='button' onClick={() => { if (confirmLoading) return; setConfirmDeleteOpen(false); setConfirmTarget({ slotId: null, day: null, studentId: null }); }} style={{ padding: '8px 12px', borderRadius: 6 }}>Cancelar</button>
                  <button type='button' onClick={async () => {
                    if (confirmLoading) return;
                    setConfirmLoading(true);
                    try {
                      await removeSlotForDay(confirmTarget.slotId, confirmTarget.day, confirmTarget.studentId);
                      setConfirmDeleteOpen(false);
                      setConfirmTarget({ slotId: null, day: null, studentId: null });
                    } catch (err) {
                      console.error('[confirmDelete] Error deleting slot:', err);
                    } finally {
                      setConfirmLoading(false);
                    }
                  }} style={{ padding: '8px 12px', borderRadius: 6, background: '#DC2626', color: '#fff' }}>
                    {confirmLoading ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          )}

      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
