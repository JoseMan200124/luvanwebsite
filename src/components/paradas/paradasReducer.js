// src/components/paradas/paradasReducer.js
// Estado del editor: { orden: [familyDetailId], porId: { [id]: FamiliaEditor } }. Actualizaciones
// inmutables y localizadas: lo que no cambia conserva su identidad (React.memo + caches de
// validación dependen de eso).
import { DIA_KEYS } from './paradasModel';
import { aplicarEleccion } from './reconciliacion';

export const estadoInicial = { orden: [], porId: {} };

const ordenar = (porId) => Object.values(porId)
    .sort((a, b) => String(a.familyLastName).localeCompare(String(b.familyLastName), 'es'))
    .map(f => f.familyDetailId);

function conFamilias(estado, familias) {
    const porId = { ...estado.porId };
    familias.forEach((f) => { porId[f.familyDetailId] = f; });
    return { orden: ordenar(porId), porId };
}

function conEstudiante(estado, familyDetailId, studentId, fn) {
    const fam = estado.porId[familyDetailId];
    if (!fam) return estado;
    const students = fam.students.map(s => (s.studentId === studentId ? fn(s) : s));
    return { ...estado, porId: { ...estado.porId, [familyDetailId]: { ...fam, students } } };
}

const conParadas = (estado, a, fn) => conEstudiante(estado, a.familyDetailId, a.studentId, s => ({ ...s, paradas: fn(s.paradas), touched: true }));

export function paradasReducer(estado, a) {
    switch (a.tipo) {
    case 'cargar':
        return conFamilias(estadoInicial, a.familias);
    case 'reemplazarFamilias':
    case 'agregarFamilias':
        return conFamilias(estado, a.familias);
    case 'quitarFamilia': {
        const porId = { ...estado.porId };
        delete porId[a.familyDetailId];
        return { orden: estado.orden.filter(id => id !== a.familyDetailId), porId };
    }
    case 'editarParada':
        return conParadas(estado, a, ps => ps.map((p, i) => (i === a.indice ? { ...p, [a.campo]: a.valor } : p)));
    case 'alternarDia':
        return conParadas(estado, a, ps => ps.map((p, i) => {
            if (i !== a.indice) return p;
            const marcado = p.days.includes(a.dia);
            return { ...p, days: DIA_KEYS.filter(d => (d === a.dia ? !marcado : p.days.includes(d))) };
        }));
    case 'agregarParada':
        return conParadas(estado, a, ps => [...ps, a.parada]);
    case 'duplicarParada':
        return conParadas(estado, a, ps => [...ps.slice(0, a.indice + 1), { ...ps[a.indice] }, ...ps.slice(a.indice + 1)]);
    case 'quitarParada':
        return conParadas(estado, a, ps => ps.filter((_, i) => i !== a.indice));
    case 'resolverConflicto':
        return conEstudiante(estado, a.familyDetailId, a.studentId, s => aplicarEleccion(s, a.eleccion));
    case 'resolverTodos': {
        const porId = { ...estado.porId };
        for (const id of estado.orden) {
            const fam = porId[id];
            if (!fam.students.some(s => s.conflicto)) continue;
            porId[id] = { ...fam, students: fam.students.map(s => (s.conflicto ? aplicarEleccion(s, a.eleccion) : s)) };
        }
        return { ...estado, porId };
    }
    case 'quitarFueraDeScope': {
        const familias = new Set(a.familias || []);
        const estudiantes = new Set(a.estudiantes || []);
        const porId = {};
        for (const id of estado.orden) {
            if (familias.has(id)) continue;
            const fam = estado.porId[id];
            porId[id] = fam.students.some(s => estudiantes.has(s.studentId))
                ? { ...fam, students: fam.students.filter(s => !estudiantes.has(s.studentId)) }
                : fam;
        }
        return { orden: estado.orden.filter(id => !familias.has(id)), porId };
    }
    default:
        return estado;
    }
}

/** Qué familias ensucia una acción (para el autoguardado). cargar/reemplazar se guardan aparte. */
export function familiasAfectadas(a, estado) {
    switch (a.tipo) {
    case 'editarParada':
    case 'alternarDia':
    case 'agregarParada':
    case 'duplicarParada':
    case 'quitarParada':
    case 'resolverConflicto':
        return { sucias: [a.familyDetailId], quitadas: [] };
    case 'agregarFamilias':
        return { sucias: a.familias.map(f => f.familyDetailId), quitadas: [] };
    case 'quitarFamilia':
        return { sucias: [], quitadas: [a.familyDetailId] };
    case 'resolverTodos':
        return { sucias: estado.orden.filter(id => estado.porId[id].students.some(s => s.conflicto)), quitadas: [] };
    case 'quitarFueraDeScope': {
        const quitadas = a.familias || [];
        const estudiantes = new Set(a.estudiantes || []);
        const sucias = estado.orden.filter(id => !quitadas.includes(id) && estado.porId[id].students.some(s => estudiantes.has(s.studentId)));
        return { sucias, quitadas };
    }
    default:
        return { sucias: [], quitadas: [] };
    }
}
