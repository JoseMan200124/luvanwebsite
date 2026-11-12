// Emparejamiento de alumnos en la revisión de la carga masiva de padres. Para una familia que ya existe en el
// ciclo, cada alumno del archivo se empareja con un alumno actual (o es nuevo) y los actuales sin pareja salen o
// se conservan. El usuario puede cambiar el emparejamiento; mientras no lo toque, se preselecciona con la
// misma heurística que usa el servidor cuando no recibe emparejamiento.
//
// Estado por alumno del borrador: `matchedStudentId` solo existe si el usuario lo eligió (número = ese alumno
// actual, null = alumno nuevo); ausente = automático. Estado por familia: `keepStudentIds` = actuales sin pareja que
// se conservan.

// Ignora tildes, mayúsculas y espacios al emparejar alumnos (igual que el servidor).
const normalizeStudentText = (value) =>
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
// con los alumnos actuales que quedan libres.
export const resolvePairing = (existingStudents, students, keepStudentIds = []) => {
    const matchedIds = students.map(student => student.matchedStudentId);
    const taken = new Set(matchedIds.filter(id => id !== undefined && id !== null));
    const free = existingStudents.filter(existing => !taken.has(existing.id));
    const pendingIndexes = matchedIds.map((id, index) => (id === undefined ? index : -1)).filter(index => index >= 0);
    const automatic = pairByHeuristic(free, pendingIndexes.map(index => students[index]));
    pendingIndexes.forEach((studentIndex, position) => {
        matchedIds[studentIndex] = automatic[position];
    });

    const pairedIds = new Set(matchedIds.filter(id => id !== null));
    const keep = new Set(keepStudentIds.filter(id => !pairedIds.has(id)));
    const unpaired = existingStudents
        .filter(existing => !pairedIds.has(existing.id))
        .map(existing => ({ ...existing, keep: keep.has(existing.id) }));
    return { matchedIds, unpaired };
};

export const STUDENT_STATUS_LABELS = {
    new: 'Nuevo',
    same: 'Sin cambios',
    name: 'Cambia nombre',
    grade: 'Cambia grado',
    nameAndGrade: 'Cambia nombre y grado'
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
    const ids = new Set((existingStudents || []).map(student => student.id));
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
        keepStudentIds: (draft.keepStudentIds || []).filter(id => ids.has(id))
    };
};

// Lo que se manda al guardar: el emparejamiento resuelto, para que el servidor aplique exactamente lo que se vio.
export const getServerPairing = (draft) => {
    const existingStudents = getExistingFamilyStudents(draft);
    if (!existingStudents) {
        return {
            students: draft.students.map((student) => {
                const next = { ...student };
                delete next.matchedStudentId;
                return next;
            }),
            keepStudentIds: []
        };
    }
    const { matchedIds, unpaired } = resolvePairing(existingStudents, draft.students, draft.keepStudentIds || []);
    return {
        students: draft.students.map((student, index) => ({ ...student, matchedStudentId: matchedIds[index] })),
        keepStudentIds: unpaired.filter(student => student.keep).map(student => student.id)
    };
};
