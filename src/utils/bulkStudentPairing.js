// Emparejamiento de alumnos en la revisión de la carga masiva de padres. Para una familia que ya existe en el
// ciclo, cada alumno del archivo se empareja con un alumno actual (o es nuevo) y los actuales sin pareja salen o
// se conservan. El usuario puede cambiar el emparejamiento; mientras no lo toque, se preselecciona con la
// misma heurística que usa el servidor cuando no recibe emparejamiento.
//
// Estado por alumno del borrador: `matchedStudentId` solo existe si el usuario lo eligió (número = ese alumno
// actual o inactivo, null = alumno nuevo); ausente = automático. Estado por familia: `leavingActions` = qué pasa con
// cada actual sin pareja ('desactivar' por defecto, 'conservar' o 'eliminar'). Los inactivos (desactivados por el
// colegio) solo vuelven si una fila los elige; una fila que coincide por nombre con uno no se empareja sola.

// Ignora tildes, mayúsculas y espacios al emparejar alumnos (igual que el servidor). También la usa la edición de
// familia para detectar coincidencias con alumnos inactivos.
export const normalizeStudentText = (value) =>
    String(value || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLowerCase();

export const studentKey = (student) => `${normalizeStudentText(student.fullName)}|${normalizeStudentText(student.grade)}`;

// Primero nombre + grado y luego solo nombre (cambio de grado). Devuelve, alineado con `incomingStudents`, el id
// del alumno actual emparejado o null.
export const pairByHeuristic = (existingStudents, incomingStudents) => {
    const result = incomingStudents.map(() => null);
    const available = [...existingStudents];
    const takeFirst = (predicate) => {
        const index = available.findIndex(predicate);
        return index < 0 ? null : available.splice(index, 1)[0];
    };
    const incomingKeys = new Set(incomingStudents.map(studentKey));

    incomingStudents.forEach((incoming, index) => {
        const match = takeFirst(existing => studentKey(existing) === studentKey(incoming));
        if (match) {
            result[index] = match.id;
        }
    });
    incomingStudents.forEach((incoming, index) => {
        if (result[index] !== null) {
            return;
        }
        const match = takeFirst(existing =>
            !incomingKeys.has(studentKey(existing)) && normalizeStudentText(existing.fullName) === normalizeStudentText(incoming.fullName));
        if (match) {
            result[index] = match.id;
        }
    });
    return result;
};

// Emparejamiento vigente de una familia: respeta lo elegido por el usuario y completa el resto por heurística
// con los alumnos actuales que quedan libres. needsDecision[i]: la fila no tiene pareja y su nombre coincide con un
// inactivo; el usuario debe elegir si es ese alumno (se reactiva) o uno nuevo.
export const resolvePairing = (existingStudents, students, leavingActions = {}, inactiveStudents = []) => {
    const matchedIds = students.map(student => student.matchedStudentId);
    const taken = new Set(matchedIds.filter(id => id !== undefined && id !== null));
    const free = existingStudents.filter(existing => !taken.has(existing.id));
    const pendingIndexes = matchedIds.map((id, index) => (id === undefined ? index : -1)).filter(index => index >= 0);
    const automatic = pairByHeuristic(free, pendingIndexes.map(index => students[index]));
    pendingIndexes.forEach((studentIndex, position) => {
        matchedIds[studentIndex] = automatic[position];
    });

    const inactiveNames = new Set(inactiveStudents.map(student => normalizeStudentText(student.fullName)));
    const needsDecision = matchedIds.map((id, index) =>
        students[index].matchedStudentId === undefined && id === null && inactiveNames.has(normalizeStudentText(students[index].fullName)));

    const pairedIds = new Set(matchedIds.filter(id => id !== null));
    const unpaired = existingStudents
        .filter(existing => !pairedIds.has(existing.id))
        .map(existing => ({ ...existing, action: leavingActions[existing.id] || 'desactivar' }));
    return { matchedIds, unpaired, needsDecision };
};

export const STUDENT_STATUS_LABELS = {
    new: 'Nuevo',
    same: 'Sin cambios',
    name: 'Cambia nombre',
    grade: 'Cambia grado',
    nameAndGrade: 'Cambia nombre y grado',
    reactivate: 'Se reactiva'
};

export const getStudentStatus = (student, existingStudent) => {
    if (!existingStudent) {
        return 'new';
    }
    const nameChanged = String(student.fullName || '').trim() !== String(existingStudent.fullName || '').trim();
    const gradeChanged = String(student.grade || '').trim() !== String(existingStudent.grade || '').trim();
    if (nameChanged && gradeChanged) {
        return 'nameAndGrade';
    }
    if (nameChanged) {
        return 'name';
    }
    return gradeChanged ? 'grade' : 'same';
};

// Alumnos actuales de la familia que el servidor tiene para el correo del borrador; null si el correo no es una
// cuenta con familia en este ciclo.
export const getExistingFamilyStudents = (draft) => {
    const existing = draft.existing;
    const sameAccount = Boolean(existing) && existing.email === String(draft.correo || '').trim().toLowerCase();
    return sameAccount && existing.hasFamily ? (existing.students || []) : null;
};

// Descarta lo elegido que ya no corresponde a la familia (cambió el correo o el servidor refrescó a la familia).
export const pruneStalePairing = (draft, existingStudents) => {
    const ids = new Set([...(existingStudents || []), ...(existingStudents ? (draft.existing?.inactiveStudents || []) : [])].map(student => student.id));
    const activeIds = new Set((existingStudents || []).map(student => student.id));
    return {
        ...draft,
        students: draft.students.map((student) => {
            if (typeof student.matchedStudentId !== 'number' || ids.has(student.matchedStudentId)) {
                return student;
            }
            const next = { ...student };
            delete next.matchedStudentId;
            return next;
        }),
        leavingActions: Object.fromEntries(Object.entries(draft.leavingActions || {}).filter(([id]) => activeIds.has(Number(id))))
    };
};

// Lo que se manda al guardar: el emparejamiento resuelto, para que el servidor aplique exactamente lo que se vio.
// keepStudentIds = sin pareja que se conservan; deleteStudentIds = sin pareja que se eliminan; el resto se desactiva.
export const getServerPairing = (draft) => {
    const existingStudents = getExistingFamilyStudents(draft);
    if (!existingStudents) {
        return {
            students: draft.students.map((student) => {
                const next = { ...student };
                delete next.matchedStudentId;
                return next;
            }),
            keepStudentIds: [],
            deleteStudentIds: []
        };
    }
    const { matchedIds, unpaired } = resolvePairing(existingStudents, draft.students, draft.leavingActions || {}, draft.existing?.inactiveStudents || []);
    return {
        students: draft.students.map((student, index) => ({ ...student, matchedStudentId: matchedIds[index] })),
        keepStudentIds: unpaired.filter(student => student.action === 'conservar').map(student => student.id),
        deleteStudentIds: unpaired.filter(student => student.action === 'eliminar').map(student => student.id)
    };
};

// Hay filas que coinciden por nombre con un alumno inactivo y el usuario aún no decidió: no se puede guardar.
export const hasPendingInactiveDecision = (draft) => {
    const existingStudents = getExistingFamilyStudents(draft);
    if (!existingStudents) {
        return false;
    }
    return resolvePairing(existingStudents, draft.students, draft.leavingActions || {}, draft.existing?.inactiveStudents || [])
        .needsDecision.some(Boolean);
};
