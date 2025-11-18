import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import api from '../../utils/axiosConfig';

// Modal de horarios para empleados - similar a StudentScheduleModal
export default function EmployeeScheduleModal({ employee, corporation, open, onClose, onScheduleUpdated }) {
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignEditing, setAssignEditing] = useState(null); // { slotId, day }
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [confirmTarget, setConfirmTarget] = useState({ slotId: null, day: null });
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
    const [confirmDeleteAllLoading, setConfirmDeleteAllLoading] = useState(false);

    // Formulario de asignación de horario
    const [assignForm, setAssignForm] = useState({
        pickupTime: '',
        dropoffTime: '',
        stopName: '',
        routeNumber: '', // Número de ruta
        note: '',
        days: []
    });

    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const DAY_LABELS = {
        monday: 'Lunes',
        tuesday: 'Martes',
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes'
    };

    const loadScheduleSlots = async () => {
        if (!employee || !employee.id) return;
        setLoading(true);
        try {
            // Cargar los horarios del empleado usando el nuevo endpoint
            const response = await api.get(`/schedule-slots/employee/${employee.id}`);
            const slots = response.data || [];
            setScheduleSlots(slots);
            console.log('[EmployeeScheduleModal] loaded slots:', slots);
        } catch (err) {
            console.error('[EmployeeScheduleModal] Error loading slots:', err);
            setScheduleSlots([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open || !employee) return;
        loadScheduleSlots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, employee]);

    const openAssignPopup = (slot = null, day = null) => {
        setAssignEditing(null);
        
        if (slot && day) {
            // Editando un horario existente
            setAssignEditing({ slotId: slot.id, day });
            setAssignForm({
                pickupTime: slot.time || '',
                dropoffTime: '', // No tenemos dropoffTime en el modelo actual
                stopName: slot.note || '',
                routeNumber: slot.routeNumber || '',
                note: '',
                days: [day]
            });
        } else {
            // Nuevo horario
            setAssignForm({
                pickupTime: '',
                dropoffTime: '',
                stopName: '',
                routeNumber: '',
                note: '',
                days: []
            });
        }
        
        setAssignOpen(true);
    };

    const saveAssignedSchedule = async () => {
        const { pickupTime, stopName, routeNumber, days } = assignForm;
        
        if (!pickupTime || !stopName || !routeNumber || !days || days.length === 0) {
            alert('Completa todos los campos obligatorios (hora, parada, ruta y días)');
            return;
        }

        if (!employee || !employee.id) {
            alert('No se encontró el empleado');
            return;
        }

        if (!corporation || !corporation.id) {
            alert('No se encontró el corporativo asociado');
            return;
        }

        const payload = {
            employeeId: employee.id,
            corporationId: corporation.id,
            time: pickupTime,
            note: stopName,
            routeNumber: routeNumber,
            days: days
        };

        console.log('[EmployeeScheduleModal] Saving schedule with payload:', payload);

        try {
            if (!assignEditing) {
                // Crear nuevo
                await api.post('/schedule-slots', payload);
            } else {
                // Editar existente
                const { slotId, day } = assignEditing;
                const original = scheduleSlots.find(s => s.id === slotId);
                
                if (!original) {
                    // Fallback: crear nuevo
                    await api.post('/schedule-slots', payload);
                } else {
                    const currentDays = Array.isArray(original.days) ? original.days : [];
                    
                    if (currentDays.length <= 1) {
                        // Actualizar el slot existente
                        await api.put(`/schedule-slots/${slotId}`, {
                            time: pickupTime,
                            note: stopName,
                            routeNumber: routeNumber,
                            days: days,
                            employeeId: employee.id,
                            corporationId: corporation.id
                        });
                    } else {
                        // Remover el día editado del slot original
                        const remaining = currentDays.filter(d => d !== day && !days.includes(d));
                        
                        if (remaining.length === 0) {
                            await api.delete(`/schedule-slots/${slotId}`);
                        } else {
                            await api.put(`/schedule-slots/${slotId}`, { days: remaining });
                        }
                        
                        // Crear nuevo slot para los días editados
                        await api.post('/schedule-slots', payload);
                    }
                }
            }

            await loadScheduleSlots();
            setAssignOpen(false);
            setAssignEditing(null);
            if (onScheduleUpdated) onScheduleUpdated();
        } catch (err) {
            console.error('[EmployeeScheduleModal] Error saving schedule:', err);
            alert('Error guardando el horario: ' + (err.response?.data?.message || err.message));
        }
    };

    const removeSlotForDay = async (slotId, day) => {
        try {
            const slot = scheduleSlots.find(s => s.id === slotId);
            if (!slot) return;

            const currentDays = Array.isArray(slot.days) ? slot.days : [];
            
            if (currentDays.length <= 1) {
                // Eliminar el slot completo
                await api.delete(`/schedule-slots/${slotId}`);
            } else {
                // Solo remover ese día
                const newDays = currentDays.filter(d => d !== day);
                await api.put(`/schedule-slots/${slotId}`, { days: newDays });
            }

            await loadScheduleSlots();
            if (onScheduleUpdated) onScheduleUpdated();
        } catch (err) {
            console.error('[EmployeeScheduleModal] Error deleting slot:', err);
            alert('Error eliminando el horario');
        }
    };

    const removeAllSlots = async () => {
        try {
            for (const slot of scheduleSlots) {
                await api.delete(`/schedule-slots/${slot.id}`);
            }
            await loadScheduleSlots();
            if (onScheduleUpdated) onScheduleUpdated();
        } catch (err) {
            console.error('[EmployeeScheduleModal] Error deleting all slots:', err);
            alert('Error eliminando los horarios');
        }
    };

    if (!open) return null;

    const modalContent = (
        <div style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0,0,0,0.45)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 30000 
        }}>
            <div style={{ 
                background: 'white', 
                padding: 24, 
                borderRadius: 8, 
                width: '95vw', 
                maxWidth: 1400, 
                maxHeight: '85vh', 
                overflow: 'auto', 
                zIndex: 30001 
            }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 12 
                }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600 }}>
                        Horario del Empleado
                    </h3>
                    <button 
                        type="button" 
                        style={{ fontSize: 13, color: '#4B5563', cursor: 'pointer' }} 
                        onClick={onClose}
                    >
                        Cerrar
                    </button>
                </div>

                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>Cargando...</div>
                    ) : (
                        <div style={{ 
                            border: '1px solid #eef2f7', 
                            borderRadius: 8, 
                            padding: 12, 
                            background: '#FBFDFF' 
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginBottom: 8 
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                                        {employee?.name || 'Empleado'}
                                    </div>
                                    <div style={{ fontSize: 15, color: '#6B7280' }}>
                                        {employee?.FamilyDetail?.department || '—'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button 
                                        type="button" 
                                        onClick={() => openAssignPopup()} 
                                        style={{ 
                                            background: '#0ea5a4', 
                                            color: '#fff', 
                                            padding: '6px 10px', 
                                            borderRadius: 6,
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Asignar Horario
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteAllOpen(true)}
                                        style={{ 
                                            background: '#ffffff', 
                                            color: '#DC2626', 
                                            padding: '6px 10px', 
                                            borderRadius: 6, 
                                            border: '1px solid #fecaca',
                                            cursor: 'pointer'
                                        }}
                                        disabled={scheduleSlots.length === 0}
                                    >
                                        Eliminar todo
                                    </button>
                                </div>
                            </div>

                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(5, 1fr)', 
                                gap: 12 
                            }}>
                                {DAYS.map(day => {
                                    const daySlots = scheduleSlots.filter(s => 
                                        Array.isArray(s.days) && s.days.includes(day)
                                    );

                                    // Separar por tipo (entrada/salida basado en hora)
                                    const entradaSlots = daySlots.filter(s => 
                                        s.time && s.time < '12:00'
                                    );
                                    const salidaSlots = daySlots.filter(s => 
                                        s.time && s.time >= '12:00'
                                    );

                                    const renderCard = (slot) => (
                                        <div 
                                            key={slot.id} 
                                            style={{ 
                                                marginBottom: 8, 
                                                padding: 10, 
                                                borderRadius: 8, 
                                                background: '#ffffff', 
                                                boxShadow: '0 4px 10px rgba(2,6,23,0.04)', 
                                                border: '1px solid #e6eef6' 
                                            }}
                                        >
                                            <div style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                marginBottom: 6 
                                            }}>
                                                <div style={{ fontSize: 15, fontWeight: 700 }}>
                                                    {slot.time}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setConfirmTarget({ slotId: slot.id, day });
                                                            setConfirmDeleteOpen(true);
                                                        }}
                                                        style={{ 
                                                            background: 'transparent', 
                                                            border: 'none', 
                                                            color: '#DC2626', 
                                                            cursor: 'pointer',
                                                            fontSize: 16
                                                        }}
                                                        title="Eliminar"
                                                    >
                                                        🗑
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => openAssignPopup(slot, day)}
                                                        style={{ 
                                                            background: 'transparent', 
                                                            border: 'none', 
                                                            color: '#2563EB', 
                                                            cursor: 'pointer',
                                                            fontSize: 16
                                                        }}
                                                        title="Editar"
                                                    >
                                                        ✏️
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 6 }}>
                                                Parada: {slot.note || '—'}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6B7280' }}>
                                                Ruta: {slot.routeNumber || '—'}
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <div 
                                            key={day} 
                                            style={{ 
                                                border: '1px solid #eef2f7', 
                                                borderRadius: 8, 
                                                padding: 12, 
                                                background: '#FBFDFF' 
                                            }}
                                        >
                                            <div style={{ 
                                                fontSize: 13, 
                                                fontWeight: 600, 
                                                marginBottom: 8, 
                                                textAlign: 'center', 
                                                color: '#374151' 
                                            }}>
                                                {DAY_LABELS[day]}
                                            </div>
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: '1fr 1fr', 
                                                gap: 8 
                                            }}>
                                                <div>
                                                    <div style={{ 
                                                        fontSize: 13, 
                                                        fontWeight: 600, 
                                                        marginBottom: 6 
                                                    }}>
                                                        Entrada
                                                    </div>
                                                    {entradaSlots.length === 0 ? (
                                                        <div style={{ 
                                                            padding: 10, 
                                                            borderRadius: 6, 
                                                            background: '#f3f7fa', 
                                                            color: '#6B7280', 
                                                            textAlign: 'center',
                                                            fontSize: 12
                                                        }}>
                                                            Sin asignación
                                                        </div>
                                                    ) : (
                                                        entradaSlots.map(s => renderCard(s))
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ 
                                                        fontSize: 13, 
                                                        fontWeight: 600, 
                                                        marginBottom: 6 
                                                    }}>
                                                        Salida
                                                    </div>
                                                    {salidaSlots.length === 0 ? (
                                                        <div style={{ 
                                                            padding: 10, 
                                                            borderRadius: 6, 
                                                            background: '#f3f7fa', 
                                                            color: '#6B7280', 
                                                            textAlign: 'center',
                                                            fontSize: 12
                                                        }}>
                                                            Sin asignación
                                                        </div>
                                                    ) : (
                                                        salidaSlots.map(s => renderCard(s))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Popup de asignación */}
                {assignOpen && (
                    <div style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        zIndex: 31000 
                    }}>
                        <div style={{ 
                            background: '#fff', 
                            padding: 20, 
                            borderRadius: 8, 
                            width: 'min(720px, 95vw)', 
                            boxShadow: '0 6px 24px rgba(0,0,0,0.2)' 
                        }}>
                            <h3 style={{ marginTop: 0 }}>Asignar Horario</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                    <label style={{ fontSize: 13 }}>Hora de Recogida *</label>
                                    <input 
                                        type="time" 
                                        style={{ 
                                            width: '100%', 
                                            padding: 8, 
                                            borderRadius: 6, 
                                            border: '1px solid #d1d5db' 
                                        }}
                                        value={assignForm.pickupTime}
                                        onChange={e => setAssignForm(f => ({ ...f, pickupTime: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 13 }}>Hora de Entrega (opcional)</label>
                                    <input 
                                        type="time" 
                                        style={{ 
                                            width: '100%', 
                                            padding: 8, 
                                            borderRadius: 6, 
                                            border: '1px solid #d1d5db' 
                                        }}
                                        value={assignForm.dropoffTime}
                                        onChange={e => setAssignForm(f => ({ ...f, dropoffTime: e.target.value }))}
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / span 2' }}>
                                    <label style={{ fontSize: 13 }}>Nombre de Parada *</label>
                                    <input 
                                        type="text" 
                                        style={{ 
                                            width: '100%', 
                                            padding: 8, 
                                            borderRadius: 6, 
                                            border: '1px solid #d1d5db' 
                                        }}
                                        value={assignForm.stopName}
                                        onChange={e => setAssignForm(f => ({ ...f, stopName: e.target.value }))}
                                        placeholder="Ej: Oficina Central, Casa del empleado, etc."
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / span 2' }}>
                                    <label style={{ fontSize: 13 }}>Ruta Asignada *</label>
                                    <select
                                        style={{ 
                                            width: '100%', 
                                            padding: 8, 
                                            borderRadius: 6, 
                                            border: '1px solid #d1d5db',
                                            background: '#fff'
                                        }}
                                        value={assignForm.routeNumber}
                                        onChange={e => setAssignForm(f => ({ ...f, routeNumber: e.target.value }))}
                                    >
                                        <option value="">Seleccionar ruta...</option>
                                        {corporation?.routeNumbers && Array.isArray(corporation.routeNumbers) && corporation.routeNumbers.map(route => (
                                            <option key={route} value={route}>
                                                Ruta {route}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / span 2' }}>
                                    <label style={{ fontSize: 13 }}>Días</label>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allSelected = DAYS.every(d => 
                                                    assignForm.days.includes(d)
                                                );
                                                setAssignForm(f => ({ 
                                                    ...f, 
                                                    days: allSelected ? [] : [...DAYS] 
                                                }));
                                            }}
                                            style={{ 
                                                padding: '6px 10px', 
                                                borderRadius: 6, 
                                                border: '1px solid #d1d5db', 
                                                background: assignForm.days.length === DAYS.length 
                                                    ? '#2563EB' 
                                                    : '#fff', 
                                                color: assignForm.days.length === DAYS.length 
                                                    ? '#fff' 
                                                    : '#374151',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Todos
                                        </button>
                                        {DAYS.map(day => (
                                            <button 
                                                key={day} 
                                                type="button"
                                                onClick={() => {
                                                    setAssignForm(f => ({ 
                                                        ...f, 
                                                        days: f.days.includes(day) 
                                                            ? f.days.filter(d => d !== day) 
                                                            : [...f.days, day] 
                                                    }));
                                                }}
                                                style={{ 
                                                    padding: '6px 10px', 
                                                    borderRadius: 6, 
                                                    border: '1px solid #d1d5db', 
                                                    background: assignForm.days.includes(day) 
                                                        ? '#2563EB' 
                                                        : '#fff', 
                                                    color: assignForm.days.includes(day) 
                                                        ? '#fff' 
                                                        : '#374151',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {DAY_LABELS[day].substring(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'flex-end', 
                                gap: 8, 
                                marginTop: 12 
                            }}>
                                <button 
                                    type="button" 
                                    onClick={() => setAssignOpen(false)}
                                    style={{ 
                                        padding: '8px 12px', 
                                        borderRadius: 6,
                                        border: '1px solid #d1d5db',
                                        background: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button" 
                                    onClick={saveAssignedSchedule}
                                    style={{ 
                                        padding: '8px 12px', 
                                        borderRadius: 6, 
                                        background: '#059669', 
                                        color: '#fff',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Popup de confirmación de eliminación */}
                {confirmDeleteOpen && (
                    <div style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        zIndex: 32000 
                    }}>
                        <div style={{ 
                            background: '#fff', 
                            padding: 20, 
                            borderRadius: 8, 
                            width: 'min(520px, 95vw)', 
                            boxShadow: '0 6px 24px rgba(0,0,0,0.2)' 
                        }}>
                            <h3 style={{ marginTop: 0 }}>Confirmar eliminación</h3>
                            <div style={{ marginTop: 8 }}>
                                ¿Estás seguro que deseas eliminar este horario?
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'flex-end', 
                                gap: 8, 
                                marginTop: 12 
                            }}>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        if (confirmLoading) return;
                                        setConfirmDeleteOpen(false);
                                        setConfirmTarget({ slotId: null, day: null });
                                    }}
                                    style={{ 
                                        padding: '8px 12px', 
                                        borderRadius: 6,
                                        border: '1px solid #d1d5db',
                                        background: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button"
                                    onClick={async () => {
                                        if (confirmLoading) return;
                                        setConfirmLoading(true);
                                        try {
                                            await removeSlotForDay(
                                                confirmTarget.slotId, 
                                                confirmTarget.day
                                            );
                                            setConfirmDeleteOpen(false);
                                            setConfirmTarget({ slotId: null, day: null });
                                        } catch (err) {
                                            console.error(err);
                                        } finally {
                                            setConfirmLoading(false);
                                        }
                                    }}
                                    style={{ 
                                        padding: '8px 12px', 
                                        borderRadius: 6, 
                                        background: '#DC2626', 
                                        color: '#fff',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {confirmLoading ? 'Eliminando...' : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Popup de confirmación de eliminar todo */}
                {confirmDeleteAllOpen && (
                    <div style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        zIndex: 32000 
                    }}>
                        <div style={{ 
                            background: '#fff', 
                            padding: 20, 
                            borderRadius: 8, 
                            width: 'min(520px, 95vw)', 
                            boxShadow: '0 6px 24px rgba(0,0,0,0.2)' 
                        }}>
                            <h3 style={{ marginTop: 0 }}>Eliminar todos los horarios</h3>
                            <div style={{ marginTop: 8 }}>
                                ¿Seguro que deseas eliminar todos los horarios de {employee?.name || 'este empleado'}?
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'flex-end', 
                                gap: 8, 
                                marginTop: 12 
                            }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirmDeleteAllLoading) return;
                                        setConfirmDeleteAllOpen(false);
                                    }}
                                    style={{ 
                                        padding: '8px 12px', 
                                        borderRadius: 6,
                                        border: '1px solid #d1d5db',
                                        background: '#fff',
                                        cursor: 'pointer'
                                    }}
                                    disabled={confirmDeleteAllLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (confirmDeleteAllLoading) return;
                                        setConfirmDeleteAllLoading(true);
                                        try {
                                            await removeAllSlots();
                                            setConfirmDeleteAllOpen(false);
                                        } catch (err) {
                                            console.error(err);
                                        } finally {
                                            setConfirmDeleteAllLoading(false);
                                        }
                                    }}
                                    style={{ 
                                        padding: '8px 12px', 
                                        borderRadius: 6, 
                                        background: '#DC2626', 
                                        color: '#fff',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                    disabled={confirmDeleteAllLoading}
                                >
                                    {confirmDeleteAllLoading ? 'Eliminando...' : 'Eliminar todo'}
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
